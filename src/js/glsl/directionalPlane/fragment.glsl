varying vec2 vUv;
uniform sampler2D uTex1;

void main() {
  vec4 color = texture2D(uTex1, vUv);
  gl_FragColor = color;
}
