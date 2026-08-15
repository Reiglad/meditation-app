# 瞑想記録アプリ - CLAUDE.md

## プロジェクト概要
瞑想（通常瞑想）とNSDR（Non-Sleep Deep Rest）を記録・実施できる、iPhone向けの個人用PWA。
ホーム画面に追加してワンタップで開ける状態を目指す。完全無料構成で運用する。

## 技術スタック
- Vanilla HTML / CSS / JavaScript（ビルドツール・フレームワーク不要）
- PWA（`manifest.json` + Service Worker によるホーム画面追加・オフラインキャッシュ）
- ホスティング：GitHub Pages（無料、独自ドメイン不要）
- 音声再生：YouTube IFrame Player API（埋め込み再生。音声ファイルの自前配信は行わない）

## ディレクトリ構成（案）
```
meditation-app/
├── index.html
├── manifest.json
├── sw.js
├── css/
│   └── style.css
├── js/
│   ├── timer.js      # 瞑想タイマー
│   ├── nsdr.js        # NSDR再生
│   ├── player.js       # YouTube IFrame Player 共通ラッパー
│   ├── storage.js     # localStorage 読み書き
│   ├── stats.js         # 統計計算（連続日数・週間/月間合計）
│   └── config.js       # BGM/ナレーション動画ID等の設定
└── icons/            # PWA用アイコン
```

## 機能要件（必要最低限）

瞑想とNSDRは別物として扱う。データ上も別セッション種別（`type`）で区別し、再生する音源（YouTube動画）も種別ごとに分離管理する。

1. **瞑想（通常瞑想）**
   - `config.js` の `MEDITATION_BGM_VIDEO_ID` に設定したBGM用YouTube動画を再生しながらタイマーを実施
   - 開始〜終了操作で計測し、終了時に自動でセッション記録を保存
2. **NSDR**
   - `config.js` の `NSDR_NARRATION_VIDEO_ID` に設定した誘導ナレーション用YouTube動画を埋め込み再生
   - 実施したら記録として保存
   - 当面は固定1動画ずつの割り当て（複数候補からの選択は将来拡張）
3. **記録閲覧**
   - 履歴一覧：日付・種類（`meditation` / `nsdr`）・実施時間
   - 統計：連続日数（ストリーク）、今週の合計時間、今月の合計時間

## データモデル
`localStorage` にセッション記録の配列をJSONで保持する。

```json
{
  "id": "uuid",
  "date": "2026-08-15",
  "type": "meditation | nsdr",
  "durationSec": 600,
  "youtubeVideoId": "xxxxxxxxxxx",
  "createdAt": "2026-08-15T21:00:00+09:00"
}
```

- データはiPhone内のみに保存し、他端末との同期は行わない（現時点の方針）。
- 将来クラウド同期（Firebase等）を追加しやすいよう、`storage.js` にデータ層を薄く分離しておく。

## UI方針
- ダーク／ライト自動切り替え（`prefers-color-scheme` に連動。手動トグルは設けない）
- [Upmind](https://upmind.co.jp/) を参考にしたビジュアルトーン：グリーン基調のグラデーション背景、白カード＋大きめ角丸＋軽い影、ピル型バッジ（連続日数など）、丸みのあるボタン。カラートークンは `css/style.css` の `:root` にまとめてある
- iPhone Safariのセーフエリア（ノッチ・ホームインジケータ）に対応（`viewport-fit=cover` + `env(safe-area-inset-*)`）
- ホーム画面のみ挨拶ヘッダー（「こんにちは」＋タイトル＋連続日数バッジ）を表示。瞑想／NSDR／記録画面はシンプルな見出し＋戻るリンクのみ

## 既知の技術的制約
- **バックグラウンドタイマーの精度**：iOS SafariのPWAは画面ロック中・バックグラウンド時にJSタイマー（`setInterval`等）の精度が落ちる、または停止しうる。正確な計測は画面ONでの利用を前提とし、`Date`オブジェクトの差分計算でフォアグラウンド復帰時に補正する設計にする。
- **公開範囲**：GitHub PagesはURLを知っていれば誰でもアプリを開ける（認証なし）。ただしデータはiPhone内のlocalStorageのみに保存されるため、他人がアプリを開いても稲澤さんの記録が見えることはない。
- **Service Workerのキャッシュ更新**：`index.html` / `css` / `js`（`config.js`の動画ID変更を含む）/ `manifest.json` / `icons` のいずれかを更新したら、**必ず `sw.js` の `CACHE_NAME` の数字をインクリメントする**こと。Service Workerはファイル内容がバイト単位で前回と同一だと更新を検知せず、古いキャッシュ（差し替え前の動画ID等）を使い続けてしまう。CACHE_NAMEを変えるとsw.js自体のバイト内容が変わり、確実に新バージョンとして再キャッシュされる。iPhone実機では、それでも反映されない場合はSafariで一度サイトを開き直す（ホーム画面から削除して再追加、またはSafariの「Webサイトデータを消去」）ことで解消できる。

## 今後の拡張余地（現時点ではやらない）
- クラウド同期（Firebase / Supabase等の無料枠を想定）による複数端末対応
- BGM・ナレーションを複数候補から選択できるようにする
- 簡易パスワードロックの追加

## 応答スタイル
グローバル設定（`~/.claude/CLAUDE.md`）に準拠：日本語で簡潔に。バグ・エラー対応は①原因説明→②修正コード→③補足説明の順。
