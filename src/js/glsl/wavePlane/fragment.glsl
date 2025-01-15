varying vec2 vUv;
// uniform float uProgress;

void main() {
  // Point形状を正方形でなく円形にする
  float d = length(gl_PointCoord - vec2(0.5, 0.5));
  if(d > 0.5) {
    discard; // ピクセルを描画せず抜ける
  }

  // ワールド原点から遠いPointほど透明にする
  float world_d = length(vUv - vec2(0.5, 0.5));
  // y = 0.5*cos(4x)のグラフに変更
  float uv_alpha = 0.5 * cos(world_d * 4.0);
  gl_FragColor = vec4(0.5, 0.5, 0.5, uv_alpha);
}
