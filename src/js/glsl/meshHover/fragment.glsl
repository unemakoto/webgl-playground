varying vec2 vUv;
uniform sampler2D uTex1;
uniform float uOpacity; // opacityをJSからもらう

void main() {
  vec4 t1 = texture2D(uTex1, vUv);
  vec3 _rgb = t1.rgb;
  gl_FragColor = vec4(_rgb, uOpacity);
}
