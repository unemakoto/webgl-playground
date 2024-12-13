/**
 * 左右ボタンのクリックイベントハンドラーを設定します。
 * @param {string} sliderSelector - スライダー本体のセレクタ
 * @param {string} prevBtnSelector - "前" ボタンのセレクタ
 * @param {string} nextBtnSelector - "次" ボタンのセレクタ
 * @param {object} state - activeSlideIdx（参照渡し）
 * @param {function} goTo - 外部の関数（参照渡し）
 */
function mountNavBtnHandler(sliderSelector, prevBtnSelector, nextBtnSelector, state, goTo) {
  const prev_el = document.querySelector(prevBtnSelector);
  const next_el = document.querySelector(nextBtnSelector);
  const slider_el = document.querySelector(sliderSelector);

  function invokeSlider(idx) {
      goTo(idx);
  }

  // 前のスライドへ
  prev_el.addEventListener("click", () => {
      const _idx = state.activeSlideIdx - 1;
      invokeSlider(_idx);
  });

  // 次のスライドへ
  next_el.addEventListener("click", () => {
      const _idx = state.activeSlideIdx + 1;
      invokeSlider(_idx);
  });
}

export { mountNavBtnHandler };