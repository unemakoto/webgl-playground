precision mediump float;
#pragma glslify: easeCubic = require(glsl-easings/cubic-in-out)
#pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
varying vec2 vUv;
varying float vProgress;
uniform float uProgress;
uniform float uTick;

void main() {
    vUv = uv;
    vec3 pos = position;

    float noise = snoise3(vec3(vec2(vUv * 1000.0), uTick * 0.001));

    // 各頂点に遅延を設定
    float delay = 1.0 * distance(vec2(0.0, 1.0), uv) / distance(vec2(0.0, 1.0), vec2(1.0, 0.0));
    // float x = clamp(uProgress * 1.2 - delay * 0.2, 0.0, 1.0);
    float x = clamp(uProgress * 2.0 - delay * 1.0, 0.0, 1.0);
    float progress = easeCubic(x);
    pos.x += noise * (1.0 - progress) * 200.0; // inviewアニメーション
    // pos.y += noise * (1.0 - progress) * 200.0; // inviewアニメーション
    // pos.z += noise * (1.0 - progress) * 200.0; // inviewアニメーション

    // fragmentにprogressを渡す
    vProgress = progress;

    // Pointsの記述（デフォルトサイズだと小さくて見えない）
    // gl_PointSize = 10.0;
    gl_PointSize = 2.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
