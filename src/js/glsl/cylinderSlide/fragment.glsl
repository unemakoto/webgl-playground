varying vec2 vUv;
varying float vScaleProgress;
varying float vDistanceProgress; //0.0～1.0
uniform sampler2D uTex1;

void main() {
  // 最初0.7倍に縮小しておく
  float scale = mix(0.7, 1.0, vScaleProgress);
  vec2 uv = vUv;
  uv -= 0.5; // scaleの基準を左下から中央にずらしておく
  uv = uv * scale;
  uv += 0.5; // scaleの基準を元に戻す
  vec4 t1 = texture2D(uTex1, uv);
  gl_FragColor = t1;
  // 最小値を0.3にする
  float tmp_a = clamp(vDistanceProgress + 0.3, 0.0, 1.0);
  gl_FragColor.a = mix(0.0, t1.a, tmp_a);
}
