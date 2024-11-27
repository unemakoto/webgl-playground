varying vec2 vUv;
uniform sampler2D uTex1;
uniform float uProgress;

// グレイスケール処理（NTSC加重平均法）
vec4 grayscale(vec4 tex) {
  const float redScale = 0.298912;
  const float greenScale = 0.586611;
  const float blueScale = 0.114478;
  const vec3 monochromeScale = vec3(redScale, greenScale, blueScale);
  // 元のテクスチャとRGB成分の内積を計算（アルファはそのまま）
  vec4 grayT = vec4(vec3(dot(tex.rbg, monochromeScale)), tex.a);
  return grayT;
}

void main() {
  vec4 t1 = texture2D(uTex1, vUv);
  vec4 grayT1 = grayscale(t1);
  // vec4 color = mix(grayT1, t1, uProgress); // 左右アニメーションなし
  vec4 color = mix(t1, grayT1, step(uProgress, vUv.x));
  gl_FragColor = color;
}
