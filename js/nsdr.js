// nsdr.js
// NSDR（Non-Sleep Deep Rest）セッション。誘導ナレーション動画を再生しながら
// 経過時間を計測し、実施完了時にセッション記録を保存する。
//
// タイマーロジックは timer.js の MeditationTimer と同じ「Date.now()差分による
// 補正」方式を採用するため、別インスタンスとして同様の実装を持つ
//（瞑想とNSDRは仕様上明確に別セッション種別として扱うため、タイマー状態も分離する）。

const NsdrTimer = (() => {
  let startTimestamp = null;
  let intervalId = null;
  let running = false;
  let onTick = null;
  let onStateChange = null;

  function tick() {
    if (!running || startTimestamp === null) return;
    const elapsedSec = Math.floor((Date.now() - startTimestamp) / 1000);
    if (typeof onTick === 'function') onTick(elapsedSec);
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && running) {
      tick();
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return {
    setCallbacks(tickCallback, stateChangeCallback) {
      onTick = tickCallback;
      onStateChange = stateChangeCallback;
    },

    start() {
      if (running) return;
      startTimestamp = Date.now();
      running = true;
      intervalId = setInterval(tick, 1000);
      tick();
      if (typeof onStateChange === 'function') onStateChange(true);
    },

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
 * NSDRセッションを終了して記録を保存するヘルパー
 * @param {number} elapsedSec
 * @returns {Object} 保存されたセッション記録
 */
function finishNsdrSession(elapsedSec) {
  return addSession({
    type: 'nsdr',
    durationSec: elapsedSec,
    audioId: CONFIG.NSDR_NARRATION_AUDIO.id,
  });
}
