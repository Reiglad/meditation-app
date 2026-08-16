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

      return {
        /**
         * 再生する音声ファイルを指定する（再生中の場合は先頭から再読み込みされる）
         * @param {string} src
         */
        load(src) {
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
          el.pause();
        },
        /**
         * 再生を止めて先頭に巻き戻す
         */
        stop() {
          el.pause();
          el.currentTime = 0;
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
