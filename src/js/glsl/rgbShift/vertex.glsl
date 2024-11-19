varying vec2 vUv;
uniform float uTick;
uniform float uScrollOffset;
#pragma glslify: PI = require(glsl-constants/PI)

void main() {
  vUv = uv;
  vec3 pos = position;
  float pos_scale = 0.01;
  float freq = 0.02;
  float amp = 0.1;
  // 上下方向のみ振動させる
  pos.y = pos.y + sin(2.0 * PI * (pos.x * pos_scale + uTick * freq)) * amp * uScrollOffset;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

}