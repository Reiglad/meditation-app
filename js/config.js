// config.js
// 瞑想・NSDRで再生する音声ファイルの設定。
//
// YouTube埋め込みは画面ロック中に再生が止まってしまう制約があったため、
// ロイヤリティフリー音源の音声ファイル（audio/ 配下、mp3）を自前ホスティングし、
// <audio> 要素で再生する方式に変更した（詳細はCLAUDE.md参照）。
// 同一オリジンの <audio> 要素はMedia Session APIとの連携でiOS Safariの
// バックグラウンド再生に正式対応しているため、YouTube埋め込みより
// 画面ロック中も再生が継続しやすい。

const CONFIG = {
  // 瞑想で選べる音声の候補（3種類）。ユーザーが瞑想画面で自由に選択する。
  MEDITATION_AUDIO_OPTIONS: [
    { id: 'night-meditation', label: '夜瞑想', icon: '🌙', file: 'audio/night-meditation.mp3' },
    { id: 'tibetan-bowl', label: 'チベタン', icon: '🎐', file: 'audio/tibetan-bowl.mp3' },
    { id: 'meditation-bgm', label: '瞑想BGM', icon: '🎼', file: 'audio/meditation-bgm.mp3' },
  ],

  // NSDR実施時に再生する誘導ナレーション音声（固定1種類）
  NSDR_NARRATION_AUDIO: { id: 'nsdr-narration', label: 'NSDRナレーション', file: 'audio/nsdr-narration.mp3' },

  // 瞑想「そのまま寝るモード」で選べる時間プリセット（分）。
  // 選んだ時間ちょうどで無音になるよう、SLEEP_FADE_OUT_SEC分だけ前倒しでフェードアウトを始める。
  SLEEP_DURATION_PRESETS_MIN: [15, 30, 45, 60],
  SLEEP_FADE_OUT_SEC: 30,
};
