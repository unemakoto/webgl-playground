import { defineConfig } from 'vite';
import glslify from 'rollup-plugin-glslify';

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  // base: "/",
  // base: "/hoge/three_js_shader4/",
  plugins: [
    glslify()
  ]
})