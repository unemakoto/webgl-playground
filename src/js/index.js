import "../css/style.css";
import { WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, ShaderMaterial, Mesh, AxesHelper, DoubleSide, VideoTexture } from "three";
import viewport from "./viewport";
import loader from "./loader";
import utils from "./utils";
import stickySlideVertexGlsl from "./glsl/stickySlide/vertex.glsl";
import stickySlideFragmentGlsl from "./glsl/stickySlide/fragment.glsl";
import GUI from "lil-gui";
import { mountNavBtnHandler, mountCaptionBtnHandler, mountScrollHandler } from "./slide-handler";

// デバッグモードにしたい場合は引数を1にする。
window.debug = enableDebugMode(1);

function enableDebugMode(debug) {
  return debug && import.meta.env.DEV;
}

const world = {};
const obj_array = [];// objが入る配列
let material = null;
// let slide_array = []; // 外に出した
let texes = []; // 外に出した

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
  world.renderer.setClearColor(0x000000, 0);

  // シーン、カメラの作成
  world.scene = new Scene();
  viewport.setParam(canvas);

  world.camera = new PerspectiveCamera(viewport.fov_deg, viewport.aspect, viewport.near, viewport.far);
  world.camera.position.z = viewport.cameraZ;

  const state = { activeSlideIdx: 0 }; // 参照渡しに変更するためオブジェクト化

  // 左右ボタンclickハンドラー（activeSlideIdxを参照渡しにするためstateを渡す）
  // mountNavBtnHandler(".sliderMain", ".sliderBtn--prev", ".sliderBtn--next", state, goTo);
  // mountCaptionBtnHandler(".sliderMain", ".sliderBtn--prev", ".sliderBtn--next", state, goTo, ".sliderCaption > ul");
  // ScrollTrigger処理が入ったハンドラ
  mountScrollHandler( ".sliderWrap", goTo, ".sliderCaption > ul");


  const elements = document.querySelectorAll('[data-webgl]');
  // .forEach()から.map()に書き換え
  const prms = [...elements].map(async (el) => {
    // テクスチャ画像読み込み
    // 引数でdata属性を渡すとその連想配列を返す関数
    texes = await loader.getTexByElement(el); // 先にコール
    const rect = el.getBoundingClientRect(); // awaitの後で実行

    // メッシュは相棒DOMと同じサイズを指定
    const geometry = new PlaneGeometry(rect.width * texes.size, rect.height, 1, 1);

    // data-webglの属性値を取得
    const dataWebgl = el.getAttribute('data-webgl');
    console.log(dataWebgl);

    if (dataWebgl == "stickySlide") {
      material = new ShaderMaterial({
        vertexShader: stickySlideVertexGlsl,
        fragmentShader: stickySlideFragmentGlsl,
        side: DoubleSide,
        uniforms: {
          uProgress: { value: 0.0 },
          uTick: { value: 0 },
          uSlideIdx : {value: 0}, // スライドのindex番号(0～4)
          uActiveSlideIdx : {value: state.activeSlideIdx}, // 現時点で正面にあるスライドのindex番号
          uSlideTotal : {value: texes.size} // スライドの合計枚数
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
      // const folder1 = gui.addFolder("画像切り替え");
      const folder2 = gui.addFolder("OrbitControls");
      const folder3 = gui.addFolder("スライダーのidx");

      // // [folder1] 画像切り替え。0.0～1.0までの範囲で0.1刻みで動かせるようにする
      // folder1.add(material.uniforms.uProgress, "value", 0.0, 1.0, 0.1).name('mixの割合').listen();
      // const mix_check_box_data = {mixCheckBoxVal: Boolean(material.uniforms.uProgress.value)};
      // folder1.add(mix_check_box_data, "mixCheckBoxVal").name('mixの割合（checkbox）').onChange(() => {
      //   gsap.to(material.uniforms.uProgress, {
      //     value: Number(mix_check_box_data.mixCheckBoxVal),
      //     duration: 1.0,
      //     ease: "none"
      //   });
      // });

      // [folder2] OrbitControlsのチェックボックス
      // .onChange()はlil-guiの仕様。isActive.valueに変化があったら引数のコールバックを実行
      folder2.add(isActive, "value").name('OrbitControlsのON/OFF').onChange(() => {
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

      // [folder3]円柱の回転処理
      const sliderIdx = {value: 0};
      folder3.add(sliderIdx, "value", 0, 12, 1).name("goTo").listen().onChange(() => {
        // goTo()の中でplayVideo()をコール
        goTo(sliderIdx.value);
      });
      // lil-gui（ここまで）-----------------------
    }

    // stats.js（ここから）-----------------------
    if (window.debug) {
      _attachStatsJs();
    }
    // stats.js（ここまで）-----------------------

    let idx = 0;

    // 不要か？？
    // texes.forEach((tex) => {
    //   idx++;
    // });

    const mesh = new Mesh(geometry, material);
    mesh.rotation.y = 0.4; // radian
    // mesh.position.z = -300; // スクロールでDOMとずれる
    world.scene.add(mesh);

    // メッシュ位置を相棒DOMの座標に合わせる
    const { x, y } = getWorldPosition(rect, canvasRect);
    mesh.position.x = x;
    mesh.position.y = y;

    // 取得したメッシュ情報をオブジェクトにまとめておく（ここでは円柱一つだけか）
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

  // initInview()相当の処理（ここから）-------------------
  // initInview()相当の処理（ここまで）-------------------

  // 左右ボタン処理（ここから）-------------------
  function goTo(idx) {
    // 動画再生の指示（画像であってもコールする）
    playVideo(idx);

    // 新しいidxで更新
    state.activeSlideIdx = idx;
  }
  // 左右ボタン処理（ここまで）-------------------

  // 初期状態で全動画を一時停止しておく
  texes.forEach((tex) => {
    // 初期状態で動画が見えないときがあるため少し待ってからpause()を実行
    setTimeout(() => {
      tex.source.data.pause?.();
    }, 50);
  });

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

    // plane_material.uniforms.uActiveSlideIdxを更新すると全てのplaneMate.uniforms.uActiveSlideIdxも更新（オブジェクトの参照渡しを設定済み）
    const tmp_activeSlideIdx = material.uniforms.uActiveSlideIdx.value;
    const idx = utils.lerp(tmp_activeSlideIdx, state.activeSlideIdx, 0.1);
    material.uniforms.uActiveSlideIdx.value = idx;
    
  }
}

let playInterval = null;
let playingVideo = null; // 再生中の動画を設定

function playVideo(idx){
  // 初期表示でidX=2のものが正面に来るためidxに+2する（5枚のときだけ想定か）
  const offset = 2;
  // moduloでidxが0～4に
  const i = (idx + offset) % texes.size;
  console.log(`active index= ${i}`);

  const uTex_idx = i + 1; //uTex?は1オリジンなので+1する
  const texValue = material.uniforms["uTex" + uTex_idx].value;
  // console.log('active slide: ', texValue.source.data);
  
  // 前回再生した動画を一時停止（初回は値が未設定なので ?.pause() としている）
  playingVideo?.pause();

  // テクスチャが画像か動画かの判定
  if(texValue instanceof VideoTexture){
    // console.log(`idx:${idx}：動画`);
    // 真になるまで200msec単位で繰り返し判定
    playInterval = setInterval(() => {
      // activeSlideIdxに等しかったら再生
      if(material.uniforms.uActiveSlideIdx.value === idx) {
        // 再生指示した動画情報を退避
        playingVideo = texValue.source.data;
        // 画像だと.play()が未対応なので.play?.()としておく
        playingVideo.play?.();
        // 再生開始したのでタイマーをクリア
        clearInterval(playInterval);
      }
    }, 200);
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
  // 戻り値がオブジェクト
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
