varying vec2 vUv;
uniform sampler2D uTex1;
uniform float uProgress;

void main() {
  vec4 t1 = texture2D(uTex1, vUv);
  // t1.a = mix(0.0, 1.0, uProgress);
  // 表示タイミングを遅らせる
  t1.a = clamp((2.0 * uProgress) - 1.0, 0.0, 1.0);
  gl_FragColor = t1;
}
