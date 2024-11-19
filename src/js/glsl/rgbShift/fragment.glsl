varying vec2 vUv;
uniform sampler2D uTex1;
// uniform float uTick;
uniform float uScrollOffset;

void main() {
  gl_FragColor = texture2D(uTex1, vUv);
}
