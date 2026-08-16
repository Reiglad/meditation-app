// audio-player.js
// <audio> 要素の共通ラッパー。以前はYouTube IFrame Player APIを使っていたが、
// 画面ロック中に再生が止まる制約があったため、自前ホスティングの音声ファイルを
// 同一オリジンの <audio> 要素で再生する方式に変更した。
//
// 使い方：
//   const player = AudioPlayer.create('meditation-audio');
//   player.load('audio/night-meditation.mp3');
//   player.setLoop(false);
//   player.play();
//   player.onEnded(() => { ... });
//   player.fadeOutAndStop(30000, () => { ... }); // 「そのまま寝るモード」用

const AudioPlayer = (() => {
  return {
    /**
     * 指定IDの <audio> 要素に紐づくコントローラーを生成する
     * @param {string} elementId - 対象の <audio> 要素のid
     * @returns {Object} プレイヤーコントローラー
     */
    create(elementId) {
      const el = document.getElementById(elementId);
      let endedCallback = null;

      el.addEventListener('ended', () => {
        if (typeof endedCallback === 'function') endedCallback();
      });
      el.addEventListener('error', (e) => {
        console.error('音声の読み込みに失敗しました', el.src, e);
      });

      let fadeIntervalId = null;

      function cancelFade() {
        if (fadeIntervalId !== null) {
          clearInterval(fadeIntervalId);
          fadeIntervalId = null;
        }
      }

      return {
        /**
         * 再生する音声ファイルを指定する（再生中の場合は先頭から再読み込みされる）
         * @param {string} src
         */
        load(src) {
          cancelFade();
          el.volume = 1; // 前回フェードアウトした音量が残らないようにリセットする
          if (el.src.endsWith(src)) return; // 同じファイルなら読み込み直さない
          el.src = src;
          el.load();
        },
        play() {
          const p = el.play();
          if (p && typeof p.catch === 'function') {
            p.catch((e) => console.error('音声の再生に失敗しました', e));
          }
        },
        pause() {
          cancelFade();
          el.pause();
        },
        /**
         * 再生を止めて先頭に巻き戻す
         */
        stop() {
          cancelFade();
          el.pause();
          el.currentTime = 0;
        },
        /**
         * 音量を徐々に下げながらフェードアウトし、無音になったら一時停止する
         * （「そのまま寝るモード」で、眠っている間に音がふっと消えるようにする用途）
         * @param {number} durationMs - フェードアウトにかける時間（ミリ秒）
         * @param {Function} [onComplete] - フェードアウト完了時に呼ばれる
         */
        fadeOutAndStop(durationMs, onComplete) {
          cancelFade();
          const steps = 30;
          const stepMs = Math.max(50, durationMs / steps);
          const startVolume = el.volume;
          let step = 0;
          fadeIntervalId = setInterval(() => {
            step += 1;
            el.volume = Math.max(0, startVolume * (1 - step / steps));
            if (step >= steps) {
              cancelFade();
              el.pause();
              el.volume = 1; // 次回再生のために音量を戻しておく
              if (typeof onComplete === 'function') onComplete();
            }
          }, stepMs);
        },
        /**
         * ループ再生のON/OFFを切り替える（タイマーモードで指定時間まで流し続ける用途）
         * @param {boolean} loop
         */
        setLoop(loop) {
          el.loop = loop;
        },
        /**
         * 音声の再生が最後まで終わったときに呼ばれるコールバックを登録する
         * （setLoop(true) の場合は呼ばれない）
         * @param {Function} cb
         */
        onEnded(cb) {
          endedCallback = cb;
        },
        element: el,
      };
    },
  };
})();
