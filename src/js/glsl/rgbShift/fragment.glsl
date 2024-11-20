varying vec2 vUv;
uniform sampler2D uTex1;
// uniform float uTick;
uniform float uScrollOffset;

void main() {
  // float time = uTick * 0.01;
  float time = uScrollOffset * 0.01;
  vec2 uv_offset = vec2(0.0, time * 0.1);
  // R成分とG成分を遅延させる
  float r = texture2D(uTex1, vUv + uv_offset).r;
  float g = texture2D(uTex1, vUv + uv_offset * 0.5).g;
  float b = texture2D(uTex1, vUv).b;
  vec3 _tex = vec3(r, g, b);
  gl_FragColor = vec4(_tex, 1.0);
}
