varying vec2 vUv;
uniform sampler2D uTex1;
uniform float uOpacity; // opacityをJSからもらう
// uniform sampler2D uTex2;
// uniform float uProgress;

void main() {
  vec4 t1 = texture2D(uTex1, vUv);
  // vec4 t2 = texture2D(uTex2, vUv);
  // vec4 color = mix(t1, t2, uProgress);
  vec3 _rgb = t1.rgb;
  gl_FragColor = vec4(_rgb, uOpacity);
}
