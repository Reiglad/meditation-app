# 瞑想記録アプリ - CLAUDE.md

## プロジェクト概要
瞑想（通常瞑想）とNSDR（Non-Sleep Deep Rest）を記録・実施できる、iPhone向けの個人用PWA。
ホーム画面に追加してワンタップで開ける状態を目指す。完全無料構成で運用する。

- 公開URL：https://reiglad.github.io/meditation-app/
- リポジトリ：https://github.com/Reiglad/meditation-app （**Public**。GitHub Freeプランでは Private リポジトリで GitHub Pages が使えないため Public にしている。コードは公開されるが、アプリのデータはiPhone内のlocalStorageのみなので個人情報は含まれない）

## 技術スタック
- Vanilla HTML / CSS / JavaScript（ビルドツール・フレームワーク不要）
- PWA（`manifest.json` + Service Worker によるホーム画面追加・オフラインキャッシュ）
- ホスティング：GitHub Pages（無料、独自ドメイン不要）
- 音声再生：YouTube IFrame Player API（埋め込み再生。音声ファイルの自前配信は行わない）

**過去に検討し、不採用にしたもの**：生活ルーティン全般（日光浴・サプリ等）のリマインダー通知（Cloudflare Workers + Web Push）を一時実装したが、「専用のリマインダーアプリで十分できることの車輪の再発明」と判断し撤去した。瞑想記録アプリとしてのスコープに集中する方針。

## ディレクトリ構成（案）
```
meditation-app/
├── index.html
├── manifest.json
├── sw.js
├── css/
│   └── style.css
├── js/
│   ├── timer.js         # 瞑想タイマー
│   ├── nsdr.js          # NSDR再生
│   ├── player.js        # YouTube IFrame Player 共通ラッパー
│   ├── storage.js       # localStorage 読み書き
│   ├── stats.js         # 統計計算（連続日数・週間/月間合計）
│   ├── config.js        # BGM/ナレーション動画ID等の設定
│   ├── quotes.js        # ホーム画面に表示する「自分を大切にする」言葉集
│   └── backgrounds.js   # 起動ごとに切り替わる自然写真背景のファイルリスト
├── images/
│   └── nature/           # 背景写真15枚（Unsplash無料ライセンス、下記UI方針参照）
└── icons/            # PWA用アイコン
```

## 機能要件（必要最低限）

瞑想とNSDRは別物として扱う。データ上も別セッション種別（`type`）で区別し、再生する音源（YouTube動画）も種別ごとに分離管理する。

1. **瞑想（通常瞑想）**：実施方法を「動画」「タイマー」の2モードから選べる（`#screen-meditation` 内の `.mode-toggle`）
   - **動画モード**：`config.js` の `MEDITATION_BGM_VIDEO_ID` を画面に表示しながら再生。動画の再生終了（`MeditationPlayer` の `onEnded`、YT.PlayerState.ENDED）と同時にセッションを自動終了・記録する。手動で「終了して記録」を押すこともできる
   - **タイマーモード**：5/10/15/20/30分のプリセットから時間を選んで開始。`config.js` の `MEDITATION_TIMER_BGM_VIDEO_ID`（チベタンシンギングボウルの倍音、瞑想と相性の良い音源）を音声のみで再生（`.timer-bgm-player` で画面上は視覚的に隠す）。指定時間の経過（`MeditationTimer.start({ targetSec, onComplete })`）で自動終了・記録する
   - 実施中はモード切替・プリセット選択を無効化する
2. **NSDR**
   - `config.js` の `NSDR_NARRATION_VIDEO_ID` に設定した誘導ナレーション用YouTube動画を埋め込み再生
   - 実施したら記録として保存
   - 当面は固定1動画ずつの割り当て（複数候補からの選択は将来拡張）
3. **記録閲覧**
   - 履歴一覧：日付・種類（`meditation` / `nsdr`）・実施時間
   - 統計：連続日数（ストリーク）、今週の合計時間、今月の合計時間
4. **名言表示**
   - ホーム画面を表示するたびに、`js/quotes.js` の `SELF_CARE_QUOTES` からランダムに1つ選んで表示する（`getRandomQuote()`）
   - 特定の著作物からの引用ではなく、このアプリのために書き下ろしたオリジナルの言葉のみを収録する（著作権上の配慮）。追加する場合も既存の言葉を参考にしつつオリジナルの文章にすること

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
- **書体**：[Upmind](https://upmind.co.jp/) と同じフォント構成。本文は Noto Sans JP、見出し・数字（`h1`, `.timer-display`, `.duration-btn`, `.stat-card .value`）は Wix Madefor Display を優先。Google Fontsから読み込む（`index.html` の `<link>`）。オフライン等で読み込めない場合はシステムフォントにフォールバックする
- **背景**：`js/backgrounds.js` の `NATURE_BACKGROUNDS`（滝・川・森・ジャングル・海・山・湖・星空・雪山・桜、計15枚）からアプリ起動のたびにランダムに1枚選び、全画面の背景写真として表示する（`#bg-layer`）。画像は `images/nature/` に同梱。すべてUnsplashの無料ライセンス（商用利用可・クレジット表記不要）で取得したもの。画像を追加する際も同じライセンス条件のものを選ぶこと
- **すりガラス（glassmorphism）UI**：カード・ボタン類（`.big-button`, `.quote-card`, `.stat-card`, `.history-item`, `.notice`, `.btn`, `.mode-toggle`, `.duration-btn` 等）は半透明の背景＋`backdrop-filter: blur()`で統一し、背景の自然写真を透かして見せる。可読性は `.bg-overlay`（写真の上にかける暗めのグラデーション）と白文字＋`text-shadow`で確保している
- ダーク／ライト自動切り替え（`prefers-color-scheme` に連動。手動トグルは設けない）。ダークモードでは `.bg-overlay` をより暗く、カードの不透明度も調整
- iPhone Safariのセーフエリア（ノッチ・ホームインジケータ）に対応（`viewport-fit=cover` + `env(safe-area-inset-*)`）
- ホーム画面のみ挨拶ヘッダー（「こんにちは」＋タイトル＋連続日数バッジ）と名言カードを表示。瞑想／NSDR／記録画面はシンプルな見出し＋戻るリンクのみ

## 既知の技術的制約
- **バックグラウンドタイマーの精度**：iOS SafariのPWAは画面ロック中・バックグラウンド時にJSタイマー（`setInterval`等）の精度が落ちる、または停止しうる。正確な計測は画面ONでの利用を前提とし、`Date`オブジェクトの差分計算でフォアグラウンド復帰時に補正する設計にする。
- **公開範囲**：GitHub PagesはURLを知っていれば誰でもアプリを開ける（認証なし）。ただしデータはiPhone内のlocalStorageのみに保存されるため、他人がアプリを開いても稲澤さんの記録が見えることはない。
- **GitHub Pagesはリポジトリを Public にする必要がある**：GitHub Freeプランでは、Privateリポジトリに対してGitHub Pagesを有効化できない（Pro以上が必要）。そのためこのリポジトリは Public にしてある。ソースコード（config.jsのYouTube動画IDなど）は誰でも閲覧できる状態である点に留意する。
- **Service Workerのキャッシュ更新**：`index.html` / `css` / `js`（`config.js`の動画ID変更を含む）/ `manifest.json` / `icons` のいずれかを更新したら、**必ず `sw.js` の `CACHE_NAME` の数字をインクリメントする**こと。Service Workerはファイル内容がバイト単位で前回と同一だと更新を検知せず、古いキャッシュ（差し替え前の動画ID等）を使い続けてしまう。CACHE_NAMEを変えるとsw.js自体のバイト内容が変わり、確実に新バージョンとして再キャッシュされる。iPhone実機では、それでも反映されない場合はSafariで一度サイトを開き直す（ホーム画面から削除して再追加、またはSafariの「Webサイトデータを消去」）ことで解消できる。GitHub Pages側のHTTPキャッシュが残ることもあり、その場合はハードリロード（PC）や上記のサイトデータ消去（iPhone）で解消する。
- **背景写真は事前キャッシュ対象外**：`images/nature/*.webp`（15枚・合計約7.2MB）は`sw.js`の`PRECACHE_URLS`に含めていない。含めると初回ロード時に全部ダウンロードされ重くなるため、`fetch`ハンドラのcache-first戦略に任せ、実際に表示された画像から順にキャッシュされる設計にしている。画像を追加・入れ替える場合、この方針は維持すること。
- **YouTube動画の埋め込み可否は `https://www.youtube.com/embed/{id}` を直接ブラウザで開いて判定しない**：直接アクセスすると埋め込み許可済みの動画でも「Error 153 / Video player configuration error」が表示されることがある（トップレベルナビゲーションとしてのアクセスに対する専用エラーの可能性が高い）。実際にアプリで使う `YT.Player` 経由（`js/player.js` の `MeditationPlayer.create()`）でテストしないと正しく判定できない。新しいBGM/ナレーション動画を検証する際は、ローカルにテスト用HTMLを作り `new YT.Player(id, { events: { onReady, onError } })` で確認すること。

## 今後の拡張余地（現時点ではやらない）
- クラウド同期（Firebase / Supabase等の無料枠を想定）による複数端末対応
- BGM・ナレーションを複数候補から選択できるようにする
- 簡易パスワードロックの追加

## 応答スタイル
グローバル設定（`~/.claude/CLAUDE.md`）に準拠：日本語で簡潔に。バグ・エラー対応は①原因説明→②修正コード→③補足説明の順。
