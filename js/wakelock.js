// wakelock.js
// 瞑想・NSDR実施中に画面が自動でスリープしないようにする（Screen Wake Lock API）。
//
// 【できること】画面の自動消灯（一定時間操作がないと暗くなる動作）を防ぐ。
// 【できないこと】ユーザーが自分で電源ボタンを押して画面を消す操作までは防げない。
//   これはOS側の仕様で、Webアプリからは制御できない。手動で画面を消した後も
//   BGM再生・タイマー計測をできるだけ継続させる対応は timer.js 側の
//   Date.now()差分による補正、および index.html の Media Session 設定で行う。
//
// iOS Safariは16.4以降でWake Lock APIに対応。非対応環境では何もしない
// （画面はOS標準の動作＝一定時間で自動消灯する）。
// Wake Lockはタブが非表示になると自動的に解放されるため、visibilitychangeで
// 再取得を試みる。

const WakeLockManager = (() => {
  let wakeLock = null;
  let wanted = false; // 現在「取得しておきたい」状態かどうか

  async function requestLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch (e) {
      // 非対応・許可されない等。BGM/タイマー自体は動作するため致命的ではない。
      console.warn('Wake Lockを取得できませんでした', e);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible' && wakeLock === null) {
      requestLock();
    }
  });

  return {
    /**
     * 瞑想・NSDR開始時に呼ぶ。以降、タブがアクティブな間は画面の自動スリープを防ぐ。
     */
    enable() {
      wanted = true;
      requestLock();
    },

    /**
     * 瞑想・NSDR終了時に呼ぶ。Wake Lockを解放し、通常の自動消灯動作に戻す。
     */
    disable() {
      wanted = false;
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    },
  };
})();
