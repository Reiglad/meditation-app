// timer.js
// 瞑想（通常瞑想）タイマー。
// - 動画モード：BGM動画を画面に表示しながら経過時間を計測（従来どおりカウントアップのみ）。
// - タイマーモード：目標時間（targetSec）を指定して開始し、残り時間をカウントダウン表示。
//   目標時間に達すると自動的にタイマーを終了し、onCompleteコールバックを呼ぶ。
//
// iOS SafariのPWAは画面ロック中・バックグラウンド時にJSタイマーの精度が
// 落ちる（または停止する）ため、経過時間は setInterval の呼び出し回数ではなく
// 常に Date.now() との差分から再計算する。visibilitychange でフォアグラウンド
// 復帰時にも即座に補正する。

const MeditationTimer = (() => {
  let startTimestamp = null;
  let intervalId = null;
  let running = false;
  let targetSec = null; // タイマーモードの目標秒数。null なら動画モード（カウントアップのみ）
  let onTick = null; // (elapsedSec, targetSec|null) => void
  let onStateChange = null; // (running) => void
  let onComplete = null; // (elapsedSec) => void 目標秒数に達したときに呼ばれる

  function finishByTarget(elapsedSec) {
    const cb = onComplete;
    clearInterval(intervalId);
    intervalId = null;
    running = false;
    startTimestamp = null;
    targetSec = null;
    onComplete = null;
    if (typeof onStateChange === 'function') onStateChange(false);
    if (typeof cb === 'function') cb(elapsedSec);
  }

  function tick() {
    if (!running || startTimestamp === null) return;
    const elapsedSec = Math.floor((Date.now() - startTimestamp) / 1000);
    const currentTarget = targetSec;
    if (typeof onTick === 'function') onTick(elapsedSec, currentTarget);
    if (currentTarget !== null && elapsedSec >= currentTarget) {
      finishByTarget(elapsedSec);
    }
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
     * @param {Function} tickCallback - (elapsedSec, targetSec|null) => void
     * @param {Function} stateChangeCallback - (running: boolean) => void
     */
    setCallbacks(tickCallback, stateChangeCallback) {
      onTick = tickCallback;
      onStateChange = stateChangeCallback;
    },

    /**
     * タイマーを開始する
     * @param {Object} [options]
     * @param {number} [options.targetSec] - タイマーモードの目標秒数。指定すると
     *   到達時に自動終了し onComplete が呼ばれる。省略時は動画モード（カウントアップのみ）。
     * @param {Function} [options.onComplete] - (elapsedSec) => void
     */
    start(options) {
      if (running) return;
      const opts = options || {};
      targetSec = typeof opts.targetSec === 'number' ? opts.targetSec : null;
      onComplete = typeof opts.onComplete === 'function' ? opts.onComplete : null;
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
      targetSec = null;
      onComplete = null;
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
 * @param {string} audioId - 実施時に選択していた音声のid（CONFIG.MEDITATION_AUDIO_OPTIONS参照）
 * @returns {Object} 保存されたセッション記録
 */
function finishMeditationSession(elapsedSec, audioId) {
  return addSession({
    type: 'meditation',
    durationSec: elapsedSec,
    audioId,
  });
}
