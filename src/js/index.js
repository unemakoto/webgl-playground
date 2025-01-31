import "../css/style.css";
import { WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Mesh, AxesHelper, DoubleSide, Points } from "three";
import viewport from "./viewport";
import loader from "./loader";
import switchTexVertexGlsl from "./glsl/switchTex/vertex.glsl";
import switchTexFragmentGlsl from "./glsl/switchTex/fragment.glsl";
import wavePlaneVertexGlsl from "./glsl/wavePlane/vertex.glsl";
import wavePlaneFragmentGlsl from "./glsl/wavePlane/fragment.glsl";
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

  // 波打つ平面（ここから）=========================
  // 湾曲する平面のジオメトリ（30x30に分割）
  const wave_plane = new PlaneGeometry(1000, 1000, 30, 30);

  // 湾曲する平面のマテリアル
  const wave_material = new ShaderMaterial({
    uniforms: {
      // uTex: { value: texture },
      uProgress: { value: 0.0 },
      uTick: { value: 0 }
    },
    vertexShader: wavePlaneVertexGlsl,
    fragmentShader: wavePlaneFragmentGlsl,
    side: DoubleSide,
    transparent: true,
    alphaTest: 0.5
  });

  // 湾曲する平面のPoints
  const points = new Points(wave_plane, wave_material);
  world.scene.add(points);
  // 平面を90度回転
  wave_plane.rotateX(Math.PI / 2);
  // 少し下に下げる
  wave_plane.translate(0, -400, 0);

  // ScrollTriggerを利用したscrub操作のアニメーション
  // 回転角度を管理する補助変数
  const rotation = { angle: Math.PI / 2 }; // 初期値: 90度
  // 湾曲平面のスクラブ処理
  gsap.to(rotation, {
    angle: Math.PI, // 最終値: 180度
    scrollTrigger: {
      trigger: "body", // トリガー要素としてbodyタグを指定
      start: "top top", // アニメーション開始位置
      end: "bottom bottom", // アニメーション終了位置
      scrub: true,
      markers: true, // デバッグ用マーカー
    },
    onUpdate: () => {
      // rotateXで更新
      wave_plane.rotateX(rotation.angle - wave_plane.userData.lastAngle || 0); // 差分を適用
      wave_plane.userData.lastAngle = rotation.angle; // 最後の角度を保存
    }
  });
  // 波打つ平面（ここまで）=========================

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

    if (dataWebgl == "switchTex") {
      material = new ShaderMaterial({
        vertexShader: switchTexVertexGlsl,
        fragmentShader: switchTexFragmentGlsl,
        side: DoubleSide,
        uniforms: {
          uProgress: { value: 0.0 },
          uTick: { value: 0 }
        },
        transparent: true,
        alphaTest: 0.5
      });
    }
    else {
      console.warn("指定のエフェクト名(data-webgl属性)が見つかりませんでした");
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

  // initInview()相当の処理（ここから）---------
  // ScrollTriggerを利用したscrub操作のアニメーション
  for (let i = 0; i < obj_array.length; i++) {
    if (obj_array[i].dataWebgl == "switchTex") {
      gsap.to(obj_array[i].material.uniforms.uProgress, {
        value: 1.0, // 遷移後の値
        scrollTrigger: {
          trigger: obj_array[i].$.el, // スクロール操作のトリガーとなる要素
          start: "top 80%",          // アニメーション開始位置
          end: "bottom 20%",         // アニメーション終了位置
          scrub: true,               // スクロールに連動させる
          markers: true              // デバッグ用にマーカーを表示
        }
      });
    }
  }
  // initInview()相当の処理（ここまで）---------

  render();
  function render() {
    requestAnimationFrame(render);
    wave_material.uniforms.uTick.value++;
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

// // scrollTriggerの初期化処理
// function initInview(){
//   gsap.registerPlugin(ScrollTrigger);
//   const elements = document.querySelectorAll('[data-webgl]');
//   elements.forEach(el => {
//     gsap.to(el, {
//       x: 100,
//       scrollTrigger: {
//         trigger: el,
//         start: "center 60%"
//       }
//     });
//   });
// }