varying vec2 vUv;
uniform sampler2D uTex1;
uniform float uTick;
uniform float uProgress;
#pragma glslify: snoise = require(glsl-noise/simplex/2d)
#pragma glslify: PI = require(glsl-constants/PI)

void main() {
  vec2 uv = vUv;
  float time = uTick * 0.005;
  // cos()の引数はラジアンのため2PIを乗じる
  float n = snoise(vec2(cos(uv.x * PI * 2.0), uv.y - time));
  // gl_FragColor = vec4(n, 0.0, 0.0, 1.0); // noise test
  vec4 t1 = texture2D(uTex1, uv + n * 0.05 * (1.0 - uProgress));
  gl_FragColor = t1;
}
