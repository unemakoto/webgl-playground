import "../css/style.css";
import { WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Mesh, AxesHelper, DoubleSide, Raycaster, Vector2 } from "three";
import viewport from "./viewport";
import loader from "./loader";
import directionalPlaneVertexGlsl from "./glsl/directionalPlane/vertex.glsl";
import directionalPlaneFragmentGlsl from "./glsl/directionalPlane/fragment.glsl";
import GUI from "lil-gui";

// デバッグモードにしたい場合は引数を1にする。
window.debug = enableDebugMode(1);

function enableDebugMode(debug) {
  return debug && import.meta.env.DEV;
}

const world = {};
const obj_array = [];// objが入る配列
let material = null;

const canvas = document.querySelector('#canvas');
let canvasRect = canvas.getBoundingClientRect();

// RayCast導入
const raycaster = new Raycaster();
const pointer = new Vector2();

init();
async function init() {
  // 画像・動画読み込み
  await loader.loadAllAssets();

  // resizeイベント監視
  bindResizeEvents();

  world.renderer = new WebGLRenderer({
    canvas,
    antialias: true
  });

  // レンダラーの設定
  world.renderer.setSize(canvasRect.width, canvasRect.height, false);
  world.renderer.setPixelRatio(window.devicePixelRatio);
  // world.renderer.setPixelRatio(1); // iMacのsafariでスクロールがガタつく
  world.renderer.setClearColor(0x000000, 0);

  // シーン、カメラの作成
  world.scene = new Scene();
  viewport.setParam(canvas);

  world.camera = new PerspectiveCamera(viewport.fov_deg, viewport.aspect, viewport.near, viewport.far);
  world.camera.position.z = viewport.cameraZ;


  const elements = document.querySelectorAll('[data-webgl]');
  // .forEach()から.map()に書き換え
  const prms = [...elements].map(async (el) => {
    // テクスチャ画像読み込み
    // 引数でdata属性を渡すとその連想配列を返す関数
    const texes = await loader.getTexByElement(el); // 先にコール
    const rect = el.getBoundingClientRect(); // awaitの後で実行

    // メッシュは相棒DOMと同じサイズを指定
    const geometry = new PlaneGeometry(rect.width, rect.height);

    // data-webglの属性値を取得
    const dataWebgl = el.getAttribute('data-webgl');
    console.log(dataWebgl);

    if (dataWebgl == "directionalPlane") {
      material = new ShaderMaterial({
        vertexShader: directionalPlaneVertexGlsl,
        fragmentShader: directionalPlaneFragmentGlsl,
        side: DoubleSide,
        uniforms: {
          uProgress: { value: 0.0 },
          uTick: { value: 0 },
          uHover: { value: 0.0 }, // 交差したメッシュは1.0にする
          uMouse: { value: new Vector2(0.5, 0.5) } // 初期値はuv座標の中心
        },
        transparent: true,
        alphaTest: 0.5
      });
    }

    // 複数のテクスチャ画像をuniform変数に設定
    texes.forEach((tex, key) => {
      // keyにはuTex1,uTex2などが入る
      return material.uniforms[key] = { value: tex };
    });

    // lil-gui（ここから）-----------------------
    if (window.debug) {
      let axesHelper = null;
      const gui = new GUI();
      // ON,OFFを切り替えるためのオブジェクト（初期値off）
      const isActive = { value: false };
      const folder1 = gui.addFolder("OrbitControls");

      // [folder1] OrbitControlsのチェックボックス
      // .onChange()はlil-guiの仕様。isActive.valueに変化があったら引数のコールバックを実行
      folder1.add(isActive, "value").name('OrbitControlsのON/OFF').onChange(() => {
        if (isActive.value) {
          _attachOrbitControl();
          // Axisの表示もついでにここでする
          axesHelper = new AxesHelper(1000);
          world.scene.add(axesHelper);
        }
        else {
          _detachOrbitControl();
          axesHelper?.dispose();
        }
      });
      // lil-gui（ここまで）-----------------------
    }

    // stats.js（ここから）-----------------------
    if (window.debug) {
      _attachStatsJs();
    }
    // stats.js（ここまで）-----------------------

    const mesh = new Mesh(geometry, material);
    world.scene.add(mesh);
    // メッシュ位置を相棒DOMの座標に合わせる
    const { x, y } = getWorldPosition(rect, canvasRect);
    mesh.position.x = x;
    mesh.position.y = y;

    // 取得したメッシュ情報をオブジェクトにまとめておく
    const obj = {
      mesh,
      geometry,
      material,
      rect,
      $: { el },
      dataWebgl
    };

    obj_array.push(obj); // メッシュ情報を配列に詰める

    // return文を追加（map()なので戻り値が配列に入る）
    return obj;
  });

  // prms[]を並列で待つ
  await Promise.all(prms);

  render();
  function render() {
    requestAnimationFrame(render);
    // 全てのメッシュの座標を更新する
    // obj_array.forEach((mesh_obj) => { updateMeshPosition(mesh_obj) });
    // 処理量削減のためforEach()をfor()で書き換え
    for (let i = 0; i < obj_array.length; i++) {
      const mesh_obj = obj_array[i];
      updateMeshPosition(mesh_obj);
      // uTickインクリメントはobj_array[]のループ内で
      mesh_obj.material.uniforms.uTick.value++;
      // uHoverのフラグが立っていたらそのメッシュのみ回転
      if (mesh_obj.material.uniforms.uHover.value) {
        // マウスの上下方向（y軸方向）の動きはx軸周りに回転
        mesh_obj.mesh.rotation.x = -(mesh_obj.material.uniforms.uMouse.value.y - 0.5) * 0.4;
        // マウスの左右方向（x軸方向）の動きはy軸周りに回転
        mesh_obj.mesh.rotation.y = (mesh_obj.material.uniforms.uMouse.value.x - 0.5) * 0.4;
      }
      else {
        // uHoverフラグがfalseになったら回転量を「滑らかに」0.0に戻す
        mesh_obj.mesh.rotation.x = lerp(mesh_obj.mesh.rotation.x, 0.0, 0.1);
        mesh_obj.mesh.rotation.y = lerp(mesh_obj.mesh.rotation.y, 0.0, 0.1);
      }
    }

    // RayCast処理
    raycast();

    if (window.debug) statsJsControl?.begin(); // fpsの計測（ここから）
    world.renderer.render(world.scene, world.camera);
    if (window.debug) statsJsControl?.end(); // fpsの計測（ここまで）
  }
}

// lerp関数
function lerp(start, end, rate) {
  let current = (1.0 - rate) * start + rate * end;
  // 差分が小さくなったら終点の値を設定
  if (Math.abs(end - current) < 0.001) {
    current = end;
  }
  return current;
}

// RayCast処理
function onPointerMove(event) {
  // calculate pointer position in normalized device coordinates
  // (-1 to +1) for both components
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
}

function raycast() {
  // update the picking ray with the camera and pointer position
  raycaster.setFromCamera(pointer, world.camera);

  // rayが交差した順（手前から）でintersects[]に入る
  const intersects = raycaster.intersectObjects(world.scene.children);
  // 現時点でのマウスカーソルのrayと交差するメッシュを取得
  const current_intersect = intersects[0];

  // ループ回数はメッシュの個数に直す（ここでは3回）
  for (let i = 0; i < world.scene.children.length; i++) {
    // 変数名が長いので_meshに入れているだけ
    const _mesh = world.scene.children[i];

    // helperのAxisなど、uniform変数がそもそもない場合はエラーになるため即抜けるようにする
    if (!_mesh.material?.uniforms) continue;

    // 変数名が長いので_uOpacityに入れているだけ
    const _uOpacity = _mesh.material.uniforms.uOpacity

    if (current_intersect?.object === _mesh) {
      // 交差したメッシュはuHoverを真にする
      _mesh.material.uniforms.uHover.value = 1.0;
      // 該当メッシュのuv座標を渡す
      _mesh.material.uniforms.uMouse.value = current_intersect.uv;
    }
    else {
      // 交差していないメッシュはuHoverを偽に戻す
      _mesh.material.uniforms.uHover.value = 0.0;
    }
  }
}

window.addEventListener('pointermove', onPointerMove);

// メッシュ座標を更新し続ける関数
function updateMeshPosition(mesh_obj) {
  const { $: { el }, mesh } = mesh_obj;
  // 最新のDOM位置のtopプロパティを別途取得する
  const rect = el.getBoundingClientRect();
  // DOMのrectをワールド座標に変換
  const { x, y } = getWorldPosition(rect, canvasRect);
  mesh.position.x = x;
  mesh.position.y = y;
}

// ワールド座標に変換する関数
// 第一引数：相棒DOMのgetBoundingClientRect()
// 第二引数：WebGLのcanvasのgetBoundingClientRect()
function getWorldPosition(dom, canvas) {
  const x = (dom.left + dom.width / 2) - (canvas.width / 2);
  const y = -(dom.top + dom.height / 2) + (canvas.height / 2);
  return { x, y };
}

function bindResizeEvents() {
  let timerId = null;
  window.addEventListener('resize', () => {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      if (window.debug) console.log("resize");

      // リサイズ後のcanvasサイズを変更
      const newCanvasRect = canvas.getBoundingClientRect();
      canvasRect = newCanvasRect;
      // newCanvasRectで「レンダラーの作成」のsetSize()だけやり直す
      world.renderer.setSize(newCanvasRect.width, newCanvasRect.height, false);
      // meshの位置とサイズの変更
      // 全てのメッシュをリサイズする
      obj_array.forEach((mesh_obj) => { resizeMesh(mesh_obj, newCanvasRect) });

      // 視錐台のパラメータ変更
      viewport.setParam(canvas);

      world.camera.fov = viewport.fov_deg;
      world.camera.near = viewport.near;
      world.camera.far = viewport.far;
      world.camera.aspect = viewport.aspect;
      // カメラのupdateProjectionMatrix()をコール
      world.camera.updateProjectionMatrix();
    }, 500);
  });
}

function resizeMesh(mesh_obj, newCanvasRect) {
  const { $: { el }, mesh, geometry, rect } = mesh_obj;
  const newRect = el.getBoundingClientRect();
  // DOMと同じ座標にする
  const { x, y } = getWorldPosition(newRect, newCanvasRect);
  mesh.position.x = x;
  mesh.position.y = y;

  // メッシュのサイズも変更する
  geometry.scale(newRect.width / rect.width, newRect.height / rect.height, 1);
  // mesh_obj.rectをリサイズ後の値で更新しておく
  mesh_obj.rect = newRect;
}

// OrbitControlのハンドラ関数（ここから）-----------------------
let orbitControl = null;

// OrbitControlのチェックボックスをONにしたとき
function _attachOrbitControl() {
  import('three/examples/jsm/controls/OrbitControls').then(({ OrbitControls }) => {
    orbitControl = new OrbitControls(world.camera, world.renderer.domElement);
    // canvasタグはz-indexが-1に設定してあるため手前に出す
    world.renderer.domElement.style.zIndex = 1;
  });
}

// OrbitControlのチェックボックスをOFFにしたとき
function _detachOrbitControl() {
  // OrbitControlを破棄
  orbitControl?.dispose();
  // canvasタグを元のz-indexに戻す
  world.renderer.domElement.style.zIndex = -1;
}
// OrbitControlのハンドラ関数（ここまで）-----------------------

// stats.jsのハンドラ関数（ここから）-----------------------
let statsJsControl = null;

function _attachStatsJs() {
  import('stats.js').then((module) => {
    const Stats = module.default;  // defaultエクスポートからStatsを取得
    statsJsControl = new Stats();
    // 通常はfps値を見ればいいので0にすること
    statsJsControl.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(statsJsControl.dom);
  });
}
// stats.jsのハンドラ関数（ここまで）-----------------------
