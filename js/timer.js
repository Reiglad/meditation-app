// timer.js
// 瞑想（通常瞑想）タイマー。BGM動画を再生しながら経過時間を計測し、
// 終了時にセッション記録を保存する。
//
// iOS SafariのPWAは画面ロック中・バックグラウンド時にJSタイマーの精度が
// 落ちる（または停止する）ため、経過時間は setInterval の呼び出し回数ではなく
// 常に Date.now() との差分から再計算する。visibilitychange でフォアグラウンド
// 復帰時にも即座に補正する。

const MeditationTimer = (() => {
  let startTimestamp = null;
  let intervalId = null;
  let running = false;
  let onTick = null; // (elapsedSec) => void
  let onStateChange = null; // (running) => void

  function tick() {
    if (!running || startTimestamp === null) return;
    const elapsedSec = Math.floor((Date.now() - startTimestamp) / 1000);
    if (typeof onTick === 'function') onTick(elapsedSec);
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && running) {
      // バックグラウンドから復帰した際、即座に経過時間を再計算して表示を補正する
      tick();
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return {
    /**
     * コールバックを登録する
     * @param {Function} tickCallback - (elapsedSec) => void
     * @param {Function} stateChangeCallback - (running: boolean) => void
     */
    setCallbacks(tickCallback, stateChangeCallback) {
      onTick = tickCallback;
      onStateChange = stateChangeCallback;
    },

    /**
     * タイマーを開始する
     */
    start() {
      if (running) return;
      startTimestamp = Date.now();
      running = true;
      intervalId = setInterval(tick, 1000);
      tick();
      if (typeof onStateChange === 'function') onStateChange(true);
    },

    /**
     * タイマーを終了し、経過秒数を返す。セッション保存はしない（呼び出し側の責務）。
     * @returns {number} 経過秒数
     */
    stop() {
      if (!running || startTimestamp === null) return 0;
      const elapsedSec = Math.floor((Date.now() - startTimestamp) / 1000);
      clearInterval(intervalId);
      intervalId = null;
      running = false;
      startTimestamp = null;
      if (typeof onStateChange === 'function') onStateChange(false);
      return elapsedSec;
    },

    isRunning() {
      return running;
    },
  };
})();

/**
 * 瞑想セッションを終了して記録を保存するヘルパー
 * @param {number} elapsedSec
 * @returns {Object} 保存されたセッション記録
 */
function finishMeditationSession(elapsedSec) {
  return addSession({
    type: 'meditation',
    durationSec: elapsedSec,
    youtubeVideoId: CONFIG.MEDITATION_BGM_VIDEO_ID,
  });
}
