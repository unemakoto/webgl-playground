varying vec2 vUv;
varying float vProgress;
uniform sampler2D uTex1;

void main() {
  vec4 t1 = texture2D(uTex1, vUv);
  // vProgressの最小値を0.0でなく0.01に変更
  float _alpha = clamp(vProgress, 0.02, 1.0);
  gl_FragColor = vec4(t1.rgb, _alpha);
}
