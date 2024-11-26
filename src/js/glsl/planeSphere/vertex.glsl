precision mediump float;
varying vec2 vUv;
uniform float uProgress;
attribute vec3 initGeometry;
attribute vec3 finalGeometry;

void main() {
  vUv = uv;
  float coeff1 = 0.4;
  float coeff2 = 0.3;

  // テクスチャ画像の中心からの距離を計算
  float distance_center = distance(uv, vec2(0.5)) * coeff1;
  // 中心から遠いほどprogressの値を増やす
  float progress = uProgress * (1.0 + coeff2) - distance_center;
  // 範囲を0.0～1.0に制限
  progress = clamp(progress, 0.0, 1.0);
  vec3 pos = mix(finalGeometry, initGeometry, progress);

  // 各Pointの座標（ビュー座標）を取得
  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPos; // ここは前と同じ計算でOK
}
