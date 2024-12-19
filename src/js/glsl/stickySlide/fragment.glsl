varying vec2 vUv;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform sampler2D uTex3;
uniform sampler2D uTex4;
uniform sampler2D uTex5;
uniform float uSlideTotal; // スライドの合計枚数(5)
uniform float uActiveSlideIdx; // 現時点で正面にあるスライドのindex番号(0,1,2,3,4)

#pragma glslify: grayscale = require(../shader-func/grayscale)

float blockStep(int a, float x){
  float N = uSlideTotal;
  float _a = float(a); // (float)a のキャストだと古いためエラーになる！
  float _x = fract(x); // 無限ループにするためfract(x)で計算
  return step((_a / N), _x) * (1.0 - step((_a + 1.0) / N, _x));
}

void main() {
  vec2 uv = vUv;
  float N = uSlideTotal;
  //moduloで戻り値を0,1,2,3,4に収める（idxが来るのでマイナスや5以上も取り得る）
  float mod_uActiveSlideIdx = mod(uActiveSlideIdx, uSlideTotal);
  // modを0.0～1.0に収める（uv座標系に収める）
  float activeSlideIdxRate = mod_uActiveSlideIdx / N;

  // uvを5回繰り返す（x軸方向のみ）
  vec2 fractUv = vec2(fract((uv.x + activeSlideIdxRate) * uSlideTotal) , uv.y);
  vec4 t1 = texture2D(uTex1, fractUv); // 0.0~0.2
  vec4 t2 = texture2D(uTex2, fractUv); // 0.2~0.4
  vec4 t3 = texture2D(uTex3, fractUv); // 0.4~0.6
  vec4 t4 = texture2D(uTex4, fractUv); // 0.6~0.8
  vec4 t5 = texture2D(uTex5, fractUv); // 0.8~1.0
  // block波形の生成
  float bs1 = blockStep(0, uv.x + activeSlideIdxRate);
  float bs2 = blockStep(1, uv.x + activeSlideIdxRate);
  float bs3 = blockStep(2, uv.x + activeSlideIdxRate);
  float bs4 = blockStep(3, uv.x + activeSlideIdxRate);
  float bs5 = blockStep(4, uv.x + activeSlideIdxRate);

  // 乗算して重ね合わせる
  vec4 color = (t1 * bs1) + (t2 * bs2) + (t3 * bs3) + (t4 * bs4) + (t5 * bs5);

  // 一旦全てモノクロ化
  vec4 gray = grayscale(color);

  // 中央となるidxの値を導出
  float center_idx = floor(N / 2.0);

  // ブロック波形の生成
  float step_color = blockStep(int(center_idx), uv.x);
  // step_colorは0.0または1.0
  color = mix(gray, color, step_color);
  // モノクロ時の不透明度を下げる
  color.a *= mix(0.7, 1.0, step_color);
  gl_FragColor = color;
}
