// player.js
// YouTube IFrame Player API の共通ラッパー。
// 瞑想（BGM）・NSDR（ナレーション）はそれぞれ別画面に固定のプレイヤー要素を持つため、
// createPlayerController() でコンテナごとに独立したコントローラーを生成できるようにする。
//
// 使い方：
//   const player = MeditationPlayer.create('yt-player-meditation');
//   player.load(videoId);
//   player.play();
//   player.stop();
//
// オフライン時はYouTube IFrame Player APIのスクリプト読み込みに失敗するため、
// MeditationPlayer.onApiUnavailable(callback) でUI側に通知できるようにする。

const MeditationPlayer = (() => {
  let apiReady = false;
  let apiLoadFailed = false;
  let apiLoadStarted = false;
  const pendingCreations = []; // API準備完了前に create() されたコントローラーの初期化関数
  const apiUnavailableListeners = [];

  window.onYouTubeIframeAPIReady = () => {
    apiReady = true;
    pendingCreations.forEach((fn) => fn());
    pendingCreations.length = 0;
  };

  function notifyApiUnavailable() {
    apiLoadFailed = true;
    apiUnavailableListeners.forEach((fn) => fn());
  }

  function loadApiScript() {
    if (apiLoadStarted) return;
    apiLoadStarted = true;

    if (window.YT && window.YT.Player) {
      apiReady = true;
      return;
    }

    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = notifyApiUnavailable;
    document.head.appendChild(tag);

    // オフライン等でタイムアウトした場合もエラー扱いにする
    setTimeout(() => {
      if (!apiReady) notifyApiUnavailable();
    }, 8000);
  }

  return {
    /**
     * 指定コンテナに紐づくプレイヤーコントローラーを生成する
     * @param {string} containerId - プレイヤーを埋め込むDOM要素のid
     * @returns {Object} プレイヤーコントローラー {load, play, pause, stop, onReady}
     */
    create(containerId) {
      let ytPlayer = null;
      let pendingVideoId = null;
      let readyCallback = null;
      let endedCallback = null;
      let isReady = false;
      // プレイヤー準備完了前に呼ばれた操作を溜めておき、準備完了後に順に実行する
      // （「開始」ボタンのクリック＝ユーザー操作という文脈をplay()が取りこぼさないようにするため）
      let queuedAction = null; // 'play' | 'pause' | 'stop' | null（最後の要求のみ保持すれば十分）

      function runQueuedAction() {
        if (!queuedAction) return;
        const action = queuedAction;
        queuedAction = null;
        if (action === 'play' && typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
        if (action === 'pause' && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo();
        if (action === 'stop' && typeof ytPlayer.stopVideo === 'function') ytPlayer.stopVideo();
      }

      function build() {
        ytPlayer = new YT.Player(containerId, {
          height: '200',
          width: '100%',
          videoId: pendingVideoId || undefined,
          playerVars: {
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              isReady = true;
              runQueuedAction();
              if (typeof readyCallback === 'function') readyCallback();
            },
            onStateChange: (e) => {
              // 動画の再生終了（YT.PlayerState.ENDED === 0）を検知する。
              // 「動画モード」でユーザーが再生時間＝瞑想時間として動画を選んだ場合、
              // 動画終了と同時にセッションも自動終了させるために使う。
              if (e.data === 0 && typeof endedCallback === 'function') {
                endedCallback();
              }
            },
            onError: (e) => {
              console.error('YouTube Player エラー', e);
            },
          },
        });
      }

      if (apiReady) {
        build();
      } else {
        pendingCreations.push(build);
        loadApiScript();
      }

      return {
        load(videoId) {
          pendingVideoId = videoId;
          if (ytPlayer && isReady && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById(videoId);
          }
        },
        play() {
          if (ytPlayer && isReady && typeof ytPlayer.playVideo === 'function') {
            ytPlayer.playVideo();
          } else {
            queuedAction = 'play';
          }
        },
        pause() {
          if (ytPlayer && isReady && typeof ytPlayer.pauseVideo === 'function') {
            ytPlayer.pauseVideo();
          } else {
            queuedAction = 'pause';
          }
        },
        stop() {
          if (ytPlayer && isReady && typeof ytPlayer.stopVideo === 'function') {
            ytPlayer.stopVideo();
          } else {
            queuedAction = 'stop';
          }
        },
        onReady(cb) {
          readyCallback = cb;
          if (isReady) cb();
        },
        /**
         * 動画の再生が最後まで終わったときに呼ばれるコールバックを登録する
         * @param {Function} cb
         */
        onEnded(cb) {
          endedCallback = cb;
        },
        isReady() {
          return isReady;
        },
      };
    },

    /**
     * APIの読み込みに失敗した場合に呼ばれるリスナーを登録する
     * @param {Function} cb
     */
    onApiUnavailable(cb) {
      apiUnavailableListeners.push(cb);
      if (apiLoadFailed) cb();
    },

    /**
     * API読み込みを開始する（明示的に呼びたい場合。create()内でも自動的に呼ばれる）
     */
    preload() {
      loadApiScript();
    },
  };
})();
