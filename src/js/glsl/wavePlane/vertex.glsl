varying vec2 vUv;
uniform float uTick;

void main() {
  vUv = uv;
  // Pointsの記述（デフォルトサイズだと小さくて見えない）
  gl_PointSize = 5.0;

  // 各頂点に遅延を設定
  float delay = 2.0 * distance(vec2(0.0, 1.0), uv) / distance(vec2(0.0, 1.0), vec2(1.0, 0.0));

  vec3 pos = position;
  float sin_val = sin(uTick * 0.02 - delay * 5.0);
  pos.y += 30.0 * sin_val;
  pos.x += 10.0 * sin_val;
  pos.z += 30.0 * sin_val;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
