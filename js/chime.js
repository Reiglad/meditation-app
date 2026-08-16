// chime.js
// 瞑想・NSDRの終了時に鳴らす通知チャイム音。
// 外部の音声ファイルは使わず、Web Audio API でその場に生成する
// （著作権フリー・オフラインでも確実に再生できる・追加ダウンロード不要のため）。
//
// Bluetoothイヤホン等について：Webアプリ側から出力先（スピーカー/イヤホン）を
// 明示的に選ぶ手段はない。OSが「現在の音声出力先」を自動管理しており、
// イヤホン接続中はイヤホンが出力先になるため、この音もBGMと同じ経路で
// 自動的にイヤホンから鳴る。
//
// iOSの自動再生制限対策：AudioContextはユーザー操作（「開始」ボタンのタップ等）の
// コンテキスト内で resume() しておく必要がある。unlock() を「開始」ボタンの
// クリックハンドラ内で呼び、以降のタイマー自動終了時（ユーザー操作の外）でも
// 音が鳴るようにする。

const Chime = (() => {
  let ctx = null;

  function getContext() {
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      ctx = new AudioContextClass();
    }
    return ctx;
  }

  return {
    /**
     * AudioContextを生成・再開する。ユーザー操作（クリック等）のイベントハンドラ内で
     * 呼び出すこと。以降、自動終了時に unlock なしで play() しても鳴らせるようにする。
     */
    unlock() {
      const audioCtx = getContext();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    },

    /**
     * 瞑想・NSDRの終了を知らせる、シンギングボウル風の穏やかな2音チャイムを再生する。
     */
    play() {
      const audioCtx = getContext();
      if (!audioCtx) return; // Web Audio API非対応環境では何もしない
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const now = audioCtx.currentTime;
      // 完全5度の関係にある2音（基音 + 完全5度上）を少しずらして鳴らし、
      // 倍音を重ねてベルらしい響きにする。
      const notes = [
        { freq: 528, delay: 0, duration: 2.2 },
        { freq: 792, delay: 0.12, duration: 2.0 },
      ];

      notes.forEach(({ freq, delay, duration }) => {
        const startAt = now + delay;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startAt);
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        // ゆっくり立ち上がり、指数的に減衰する（ベルの響きに近い包絡線）
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(0.18, startAt + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

        osc.start(startAt);
        osc.stop(startAt + duration + 0.1);
      });
    },
  };
})();
