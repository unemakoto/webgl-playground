import "../css/style.css";
import { WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, CylinderGeometry, MeshBasicMaterial, ShaderMaterial, Mesh, AxesHelper, DoubleSide, Vector3, VideoTexture } from "three";
import viewport from "./viewport";
import loader from "./loader";
import utils from "./utils";
import cylinderSlideVertexGlsl from "./glsl/cylinderSlide/vertex.glsl";
import cylinderSlideFragmentGlsl from "./glsl/cylinderSlide/fragment.glsl";
import GUI from "lil-gui";
import { mountNavBtnHandler } from "./slide-handler";

// デバッグモードにしたい場合は引数を1にする。
window.debug = enableDebugMode(1);

function enableDebugMode(debug) {
  return debug && import.meta.env.DEV;
}

const world = {};
const obj_array = [];// objが入る配列
let plane_material = null;
let slide_array = []; // 外に出した

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

  // // ScrollTriggerの登録はページ全体で一度だけ実行すればいい
  // gsap.registerPlugin(ScrollTrigger);

  // 円柱の回転軸を定義
  // 回転軸はy軸（クオータニオンなのでnormalize()で正規化する）
  const rotateAxis = new Vector3(0.0, 1.0, 0.0).normalize();
  const state = { activeSlideIdx: 0 }; // 参照渡しに変更するためオブジェクト化
  let diffRad = 0.0;

  // 外で定義する
  let cylinder_mesh = null;

  // 左右ボタンclickハンドラー（activeSlideIdxを参照渡しにするためstateを渡す）
  mountNavBtnHandler(".sliderMain", ".sliderBtn--prev", ".sliderBtn--next", state, goTo);

  const elements = document.querySelectorAll('[data-webgl]');
  const prms = [...elements].map(async (el) => {
    // テクスチャ画像読み込み
    // 引数でdata属性を渡すとその連想配列を返す関数
    const texes = await loader.getTexByElement(el); // 先にコール
    const rect = el.getBoundingClientRect(); // awaitの後で実行

    // 円柱の半径
    const radius = rect.width;

    // 分割数は100に
    const cylinder_geometry = new CylinderGeometry(radius, radius, rect.height, 100, 1, true);

    // 円柱はMeshBasicMaterial()で表示（これにテクスチャは設定しないため）
    const cylinder_material = new MeshBasicMaterial({
      transparent: true,
      opacity: 0.0,
      alphaTest: 0.5
      //wireframe: true,
      //color: 0xff0000
    });

    // data-webglの属性値を取得
    const dataWebgl = el.getAttribute('data-webgl');
    console.log(dataWebgl);

    if (dataWebgl == "cylinderSlide") {
      plane_material = new ShaderMaterial({
        vertexShader: cylinderSlideVertexGlsl,
        fragmentShader: cylinderSlideFragmentGlsl,
        side: DoubleSide,
        uniforms: {
          uProgress: { value: 0.0 },
          uTick: { value: 0 },
          uRadius: { value: radius }, // 円柱の半径
          uSlideIdx : {value: 0}, // スライドのindex番号(0～4)
          uActiveSlideIdx : {value: state.activeSlideIdx}, // 現時点で正面にあるスライドのindex番号
          uSlideTotal : {value: texes.size} // スライドの合計枚数
        },
        transparent: true,
        alphaTest: 0.5
      });
    }

    // ここではuTex1しか使わないので以下が不要になる。
    // // 複数のテクスチャ画像をuniform変数に設定
    // texes.forEach((tex, key) => {
    //   // keyにはuTex1,uTex2などが入る
    //   return plane_material.uniforms[key] = { value: tex };
    // });

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

    cylinder_mesh = new Mesh(cylinder_geometry, cylinder_material);

    // cylinder_meshを奥方向にずらす（カメラに近すぎて大きく投影されるため）
    cylinder_mesh.position.z = -radius;

    // 円筒メッシュの頂点属性を確認
    // console.log(cylinder_geometry.attributes);

    // 円筒メッシュの頂点属性のpositionを分割代入で取得し、cylinder_posに設定。
    // 同様に法線もcylinder_normalに設定。
    const { position: cylinder_pos, normal: cylinder_normal } = cylinder_geometry.attributes;
    // 2が余分なので引いておく
    const CYLINDER_VERTEX_NUM = cylinder_geometry.attributes.position.count - 2; //200

    // 一周の頂点数はtopかbottomのどちらかだけの合計でいい
    const CYLINDER_VERTEX_ONE_LOOP = CYLINDER_VERTEX_NUM / 2.0; // 100

    // plane一枚にアサインできる頂点数を計算（除算なので整数値で返す）
    const step = Math.floor(CYLINDER_VERTEX_ONE_LOOP / texes.size); // 画像の枚数「5」で割る
    let idx = 0;

    // 複数のテクスチャ画像を読み込むためループで回す
    texes.forEach((tex) => {
      // 各平面のメッシュを作成していく
      // テクスチャのShaderMaterialをクローンする（マテリアルは5つとも異なる）
      const planeMate = plane_material.clone();

      // テクスチャ画像をそのまま表示するのでtex1のみ設定でよい
      planeMate.uniforms.uTex1 = { value: tex };

      // 各平面にindex番号を設定（0～4）
      planeMate.uniforms.uSlideIdx.value = idx;
      // 各平面に正面の平面がどれなのかを知らせる
      // （参照渡しにすることでclone()した全てのplaneのuActiveSlideIdxが一括で更新可能に（render()内））
      planeMate.uniforms.uActiveSlideIdx = plane_material.uniforms.uActiveSlideIdx;

      // console.log(planeMate.uniforms);

      // 平面の横方向の分割数だけ50に上げておく
      const planeGeo = new PlaneGeometry(rect.width, rect.height, 50, 1);
      // 平面のメッシュを生成
      const plane = new Mesh(planeGeo, planeMate);

      // slide_arrayに追加する前にplane_materialを設定
      plane.plane_material = planeMate; // 各スライドにplane_materialを直接設定

      // 円柱メッシュのどこの頂点なのかを指定
      const pickIdx = idx * step; // index*24
      // 円柱メッシュの各頂点の座標を取得してplaneの座標として設定（y座標は不要）
      plane.position.x = cylinder_pos.getX(pickIdx);
      plane.position.z = cylinder_pos.getZ(pickIdx);

      // 各平面の向きを円筒の法線方向にする
      // 元の向きはz軸方向
      const originalDir = { x: 0, y: 0, z: 1 };
      // 変更後の向きは円柱の「各pickIdxの頂点」の法線方向 
      const targetDir = { x: cylinder_normal.getX(pickIdx), y: 0, z: cylinder_normal.getZ(pickIdx) };
      utils.pointTo(plane, originalDir, targetDir);

      // planeを引数にするため中に移動
      // slide_array = [...cylinder_mesh.children];
      slide_array.push(plane); // slide_arrayに直接追加

      // この平面のメッシュを円筒のメッシュに追加する
      cylinder_mesh.add(plane);

      // 動画だったら一時停止にしておく
      tex.source.data.pause?.();

      idx++;
    });

    // // 平面メッシュを配列slide_array[]に入れておく（枚数を数えるため）
    // slide_array = [...cylinder_mesh.children];

    world.scene.add(cylinder_mesh);
    // メッシュ位置を相棒DOMの座標に合わせる
    const { x, y } = getWorldPosition(rect, canvasRect);
    cylinder_mesh.position.x = x;
    cylinder_mesh.position.y = y;

    // 取得したメッシュ情報をオブジェクトにまとめておく（ここでは円柱一つだけか）
    const obj = {
      cylinder_mesh,
      cylinder_geometry,
      plane_material,
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
  // 引数で指定した画像が正面になるように円柱を回転させる
  function goTo(idx) {
    // 回転させる量を0.0～1.0で導出
    // activeSlideIdx：現時点で正面にあるスライドのidx
    // slide_array.lengthはスライドの合計枚数
    const diff_rate = (idx - state.activeSlideIdx) / slide_array.length;

    // diffRad：回転させる量（値域：0.0～1.0の値に2πをかけて0～2πの値に）
    // （これで戻り値がラジアンになる）
    diffRad -= diff_rate * 2 * Math.PI;

    // 動画再生の指示（画像であってもコールする）
    playVideo(idx);

    // 新しいidxで更新
    state.activeSlideIdx = idx;
  }
  // 左右ボタン処理（ここまで）-------------------

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
      mesh_obj.plane_material.uniforms.uTick.value++;
    }

    if (window.debug) statsJsControl?.begin(); // fpsの計測（ここから）
    world.renderer.render(world.scene, world.camera);
    if (window.debug) statsJsControl?.end(); // fpsの計測（ここまで）

    // 円柱の回転処理（diffRadが0.0は回転不要）
    if(diffRad){
      // lerp()でアニメーション化
      const tmp_diffRad = utils.lerp(diffRad, 0, 0.9, 0.0001) || diffRad;
      // 回転する量をtmp_diffRadに変更
      cylinder_mesh.rotateOnWorldAxis(rotateAxis, tmp_diffRad);
      
      // 進んだ分を引く
      diffRad -= tmp_diffRad;
      // console.log(`${diffRad}`);
      
      // plane_material.uniforms.uActiveSlideIdxを更新すると全てのplaneMate.uniforms.uActiveSlideIdxも更新（参照渡しを設定済み）
      const tmp_activeSlideIdx = plane_material.uniforms.uActiveSlideIdx.value;
      const idx = utils.lerp(tmp_activeSlideIdx, state.activeSlideIdx, 0.15);
      plane_material.uniforms.uActiveSlideIdx.value = idx;
    }
  }
}

let playInterval = null;
let playingVideo = null; // 再生中の動画を設定

function playVideo(idx){
  console.log(`idx= ${idx}`);
  // moduloでidxが0～4に
  const i = idx % slide_array.length;
  // idxは負になる可能性があるため.at()を使用
  const slide = slide_array.at(i);

  // テクスチャが画像か動画かの判定
  const tex1Value = slide.plane_material.uniforms.uTex1.value;

  // 前回再生した動画を一時停止（初回は値が未設定なので ?.pause() としている）
  playingVideo?.pause();
  if(tex1Value instanceof VideoTexture){
    // console.log(`idx:${idx}：動画`);
    // 真になるまで200msec単位で繰り返し判定
    playInterval = setInterval(() => {
      // activeSlideIdxに等しかったら再生
      // console.log(`${plane_material.uniforms.uActiveSlideIdx.value} : ${idx}`);
      if(plane_material.uniforms.uActiveSlideIdx.value === idx) {
        // 再生指示した動画情報を退避
        playingVideo = tex1Value.source.data;
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
  const { $: { el }, cylinder_mesh } = mesh_obj;
  // 最新のDOM位置のtopプロパティを別途取得する
  const rect = el.getBoundingClientRect();
  // DOMのrectをワールド座標に変換
  const { x, y } = getWorldPosition(rect, canvasRect);
  cylinder_mesh.position.x = x;
  cylinder_mesh.position.y = y;
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
  const { $: { el }, cylinder_mesh, cylinder_geometry, rect } = mesh_obj;
  const newRect = el.getBoundingClientRect();
  // DOMと同じ座標にする
  const { x, y } = getWorldPosition(newRect, newCanvasRect);
  cylinder_mesh.position.x = x;
  cylinder_mesh.position.y = y;

  // メッシュのサイズも変更する
  cylinder_geometry.scale(newRect.width / rect.width, newRect.height / rect.height, 1);
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