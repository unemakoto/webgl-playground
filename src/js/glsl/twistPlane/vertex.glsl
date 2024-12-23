#pragma glslify: easeCubic = require(glsl-easings/cubic-in-out)
#pragma glslify: rotate = require(glsl-rotate/rotate)
#pragma glslify: PI = require(glsl-constants/PI)

varying vec2 vUv;
uniform float uProgress;

void main() {
  vUv = uv;
  vec3 pos = position;

  float delay = 1.41 * distance(vec2(0.0, 1.0), uv) / distance(vec2(0.0, 1.0), vec2(1.0, 0.0));
  float x = clamp(uProgress * 1.3 - delay * 0.3, 0.0, 1.0);
  float progress = easeCubic(x);

  vec3 axis = vec3(1.0, 0.0, 0.0); // 回転軸の定義（ここではX軸を指定）
  pos = rotate(pos, axis, (2.0 * PI) * (1.0 - progress)); // 2回転に変更
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
