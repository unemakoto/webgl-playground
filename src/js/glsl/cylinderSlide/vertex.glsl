varying vec2 vUv;
uniform float uRadius;
uniform float uSlideIdx; // スライドのindex番号(0～4)
uniform float uActiveSlideIdx; // 現時点で正面にあるスライドのindex番号
uniform float uSlideTotal; // スライドの合計枚数
uniform float uTick;
varying float vScaleProgress;
varying float vDistanceProgress;

void main() {
  vUv = uv;
  vec3 pos = position;

  // moduloで戻り値を 0.0～4.999 に制限
  float activeSlideIdx = mod(uActiveSlideIdx, uSlideTotal);
  // 自分が正面のスライドとどれだけ離れているかの差分
  float distance = abs(activeSlideIdx - uSlideIdx);

  // 最も遠方にあるidxの値
  float longest = uSlideTotal / 2.0; // 5枚だと2.5（6枚だと3.0）
  // 正面の位置（distance=0） : distanceProgress= 1.0
  // その右隣（distance=1） :   distanceProgress= 0.6
  // その右隣（distance=2） :   distanceProgress= 0.2
  // その右隣（distance=3） :   distanceProgress= 0.2
  // その右隣（distance=4） :   distanceProgress= 0.6
  // 【結論】distanceProgress：正面にあると1.0、最も遠くにあると0.0
  float distanceProgress = abs(distance - longest) / longest;
  vDistanceProgress = distanceProgress; // fragmentに渡す（0.0～1.0）

  // 動きをワンテンポ遅らせて急峻にする
  float scaleProgress = clamp((5.0 * distanceProgress - 4.0), 0.0, 1.0);
  vScaleProgress = scaleProgress; // fragmentに渡す

  // 手前にあるほど拡大し、奥にあるほど縮小する
  pos.xy = pos.xy * (0.9 + 0.2 * scaleProgress);

  float d = uRadius - sqrt(pow(uRadius, 2.0) - pow(pos.x, 2.0));
  // pos.zからdだけ引く
  pos.z -= d;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}