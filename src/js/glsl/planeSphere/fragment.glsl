precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex1;

void main() {
  vec4 tex = texture2D(uTex1, vUv);
  gl_FragColor = tex;
}
