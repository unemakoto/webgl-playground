import "../css/style.css";
import { WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, SphereGeometry, ShaderMaterial, Mesh, AxesHelper, DoubleSide } from "three";
import viewport from "./viewport";
import loader from "./loader";
import planeSphereVertexGlsl from "./glsl/planeSphere/vertex.glsl";
import planeSphereFragmentGlsl from "./glsl/planeSphere/fragment.glsl";
import GUI from "lil-gui";
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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

  // ScrollTriggerの登録はページ全体で一度だけ実行すればいい
  gsap.registerPlugin(ScrollTrigger);

  const elements = document.querySelectorAll('[data-webgl]');
  // .forEach()から.map()に書き換え
  const prms = [...elements].map(async (el) => {
    // テクスチャ画像読み込み
    // 引数でdata属性を渡すとその連想配列を返す関数
    const texes = await loader.getTexByElement(el); // 先にコール
    const rect = el.getBoundingClientRect(); // awaitの後で実行

    // 球と平面で分割数を合わせること
    const wSeg = rect.width / 10;
    const hSeg = rect.height / 10;
    const radius = rect.width / 10;
    const sphere_geometry = new SphereGeometry(radius, wSeg, hSeg);
    const plane_geometry = new PlaneGeometry(rect.width, rect.height, wSeg, hSeg);

    // u=0.5の位置が変形後に中央に来るように直す（-90度回転しておく）
    sphere_geometry.rotateY(Math.PI * (-1 / 2));
    // 画像の中心が動かないように半径分ずらす
    sphere_geometry.translate(0, 0, -radius);

    // 【注意】--------------------------------------
    // 初期状態は球体にしたいのだが、ここでは
    //   ・初期ジオメトリ：plane_geometry
    //   ・最終ジオメトリ：sphere_geometry
    // としている。これは球体から平面に変形するとなぜか変形後にテクスチャの端が欠けてしまうため。
    // これを回避するためJS側では初期ジオメトリを平面、最終ジオメトリを球体とする。
    // この状態を反転させるため、vertex.glslのmix()で引数を逆で指定している。
    //     mix(finalGeometry, initGeometry, progress)
    // ---------------------------------------------

    // 「position」に初期状態（ここではplane）を設定しておく（three.js仕様？）
    plane_geometry.setAttribute('position', plane_geometry.getAttribute('position'));
    // 「uv」に初期状態（ここではplane）を設定しておく（vertex.glslでの遅延処理を消したので以下は不要か）
    // plane_geometry.setAttribute('uv', plane_geometry.getAttribute('uv'));

    // 初期ジオメトリとして平面のジオメトリを設定
    plane_geometry.setAttribute('initGeometry', plane_geometry.getAttribute('position'));
    // 最終ジオメトリとして球体のジオメトリを設定
    plane_geometry.setAttribute('finalGeometry', sphere_geometry.getAttribute('position'));

    // data-webglの属性値を取得
    const dataWebgl = el.getAttribute('data-webgl');
    console.log(dataWebgl);

    if (dataWebgl == "planeSphere") {
      material = new ShaderMaterial({
        vertexShader: planeSphereVertexGlsl,
        fragmentShader: planeSphereFragmentGlsl,
        side: DoubleSide,
        uniforms: {
          uProgress: { value: 0.0 },
          uTick: { value: 0 }
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

    const mesh = new Mesh(plane_geometry, material);
    world.scene.add(mesh);
    // メッシュ位置を相棒DOMの座標に合わせる
    const { x, y } = getWorldPosition(rect, canvasRect);
    mesh.position.x = x;
    mesh.position.y = y;

    // 取得したメッシュ情報をオブジェクトにまとめておく
    const obj = {
      mesh,
      plane_geometry,
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

  // initInview()相当の処理（ここから）---------
  // 対象となるメッシュは複数個を想定するためループで回す
  for (let i = 0; i < obj_array.length; i++) {
    gsap.to(obj_array[i].material.uniforms.uProgress, {
      value: 1.0, // 遷移後の値
      duration: 0.5,
      ease: "none",
      scrollTrigger: {
        trigger: obj_array[i].$.el,
        start: "center 60%",
        // toggleActions: "play reverse play reverse",
        toggleActions: "play pause pause reverse",
        markers: true  // デバッグ用にマーカーを表示
      }
    });
  }
  // initInview()相当の処理（ここまで）---------

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
    }

    if (window.debug) statsJsControl?.begin(); // fpsの計測（ここから）
    world.renderer.render(world.scene, world.camera);
    if (window.debug) statsJsControl?.end(); // fpsの計測（ここまで）
  }
}

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
  const { $: { el }, mesh, plane_geometry, rect } = mesh_obj;
  const newRect = el.getBoundingClientRect();
  // DOMと同じ座標にする
  const { x, y } = getWorldPosition(newRect, newCanvasRect);
  mesh.position.x = x;
  mesh.position.y = y;

  // メッシュのサイズも変更する
  plane_geometry.scale(newRect.width / rect.width, newRect.height / rect.height, 1);
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
