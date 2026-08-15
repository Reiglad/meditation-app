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
- **バックエンド**：Cloudflare Workers（無料枠）＋ Workers KV ＋ Cron Triggers。リマインダー通知（Web Push）の送信を担当
- **Push通知**：Web Push API + Notification API（VAPID使用）。送信ライブラリは `@block65/webcrypto-web-push`（Web Crypto API実装、Cloudflare Workers対応）。Node.js版`web-push`ライブラリはWorkers非対応のため使用しない（VAPIDキー生成時のみ一時的に使用）

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
│   ├── config.js       # BGM/ナレーション動画ID等の設定
│   ├── push-config.js  # Web Push（Cloudflare Worker接続先・VAPID公開鍵等）の設定
│   └── push.js          # 通知許可・購読/解除ロジック
├── icons/            # PWA用アイコン
└── worker/            # Cloudflare Workers側（リマインダー通知バックエンド）
    ├── src/index.js   # fetch（API）/ scheduled（Cron）ハンドラ本体
    ├── wrangler.toml  # KV/Cron/環境変数の設定
    └── package.json
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

## Web Pushリマインダー機能（MVP）
朝の日光浴・サプリ摂取など生活ルーティン全般を通知でリマインドする機能。瞑想もこの一種として将来位置づける。現状は**単一リマインダーのMVP**（複数管理・起床オフセット・瞑想連携は未実装、下記「今後の拡張余地」参照）。

- **前提**：iOS SafariでWeb Pushが使えるのは iOS 16.4+ かつホーム画面に追加した状態（standalone）のみ。Safari単体タブでは動作しない
- **データモデル**（Cloudflare Workers KV、Namespace: `REMINDERS_KV`）
  ```
  subscription:default   → { endpoint, keys: { p256dh, auth }, registeredAt }
  reminder:default        → { id: "default", title, time: "HH:MM", enabled, updatedAt }
  sent:{date}:default     → "1"  (TTL 120秒、同一分内の重複送信防止)
  ```
- **API**（`worker/src/index.js`、`X-App-Secret`ヘッダーで簡易保護）

  | メソッド | パス | 用途 |
  |---|---|---|
  | POST | `/api/subscribe` | Push Subscription登録 |
  | DELETE | `/api/subscribe` | Subscription削除 |
  | GET | `/api/reminder` | リマインダー取得 |
  | PUT | `/api/reminder` | リマインダー作成・更新（title, time, enabled） |

- **Cron**：1分間隔（Cloudflare Free プランで許可される最小間隔）で`reminder:default`をチェックし、現在時刻（Asia/Tokyo）と一致すればPush送信
- **フロントエンド**：`js/push-config.js`（接続先・VAPID公開鍵）、`js/push.js`（許可要求・購読/解除）。ホーム画面の「🔔 リマインダー通知を有効にする」ボタンから操作する
- 現状、リマインダーの内容（title/time）を変更するUIはまだ無い。変更する場合は下記「運用手順」のcurlコマンドで直接Worker APIを叩く

## 運用手順
- **フロントエンドのデプロイ**：`git add -A && git commit && git push`（GitHub Pagesへ自動反映。数十秒〜1分程度かかる）
- **Workerのデプロイ**：`cd worker && npx wrangler deploy`
- **Workerのログ確認**：`cd worker && npx wrangler tail`
- **リマインダーの内容変更**（例：時刻を07:30、タイトルを「サプリを飲む」に変更）：
  ```
  curl -X PUT https://meditation-app-worker.rei-ina34171730.workers.dev/api/reminder \
    -H "X-App-Secret: <worker側のAPP_SECRETと同じ値>" \
    -H "Content-Type: application/json" \
    --data-binary @reminder.json
  ```
  （Windows/Git Bashでは日本語を含む場合、`-d`直書きだと文字化けするため、UTF-8で保存したJSONファイルを`--data-binary @file`で渡すこと）
- **VAPID鍵の再発行手順**：
  1. `npx web-push generate-vapid-keys` で新しい鍵ペアを生成
  2. `cd worker && npx wrangler secret put VAPID_PRIVATE_KEY` で秘密鍵を差し替え
  3. `worker/wrangler.toml` の `VAPID_PUBLIC_KEY` を新しい公開鍵に更新し `npx wrangler deploy`
  4. `js/push-config.js` の `VAPID_PUBLIC_KEY` も同じ値に更新し、フロントエンドをデプロイ
  5. **既存のPush Subscriptionは古い鍵ペアに紐づくため無効になる**。ホーム画面のボタンから再度「通知を有効にする」を押してもらう必要がある

## 既知の技術的制約
- **バックグラウンドタイマーの精度**：iOS SafariのPWAは画面ロック中・バックグラウンド時にJSタイマー（`setInterval`等）の精度が落ちる、または停止しうる。正確な計測は画面ONでの利用を前提とし、`Date`オブジェクトの差分計算でフォアグラウンド復帰時に補正する設計にする。
- **公開範囲**：GitHub PagesはURLを知っていれば誰でもアプリを開ける（認証なし）。ただしデータはiPhone内のlocalStorageのみに保存されるため、他人がアプリを開いても稲澤さんの記録が見えることはない。
- **GitHub Pagesはリポジトリを Public にする必要がある**：GitHub Freeプランでは、Privateリポジトリに対してGitHub Pagesを有効化できない（Pro以上が必要）。そのためこのリポジトリは Public にしてある。ソースコード（config.jsのYouTube動画IDなど）は誰でも閲覧できる状態である点に留意する。
- **Service Workerのキャッシュ更新**：`index.html` / `css` / `js`（`config.js`の動画ID変更を含む）/ `manifest.json` / `icons` のいずれかを更新したら、**必ず `sw.js` の `CACHE_NAME` の数字をインクリメントする**こと。Service Workerはファイル内容がバイト単位で前回と同一だと更新を検知せず、古いキャッシュ（差し替え前の動画ID等）を使い続けてしまう。CACHE_NAMEを変えるとsw.js自体のバイト内容が変わり、確実に新バージョンとして再キャッシュされる。iPhone実機では、それでも反映されない場合はSafariで一度サイトを開き直す（ホーム画面から削除して再追加、またはSafariの「Webサイトデータを消去」）ことで解消できる。GitHub Pages側のHTTPキャッシュが残ることもあり、その場合はハードリロード（PC）や上記のサイトデータ消去（iPhone）で解消する。
- **`APP_SECRET`は真の認証ではない**：Publicリポジトリの`js/push-config.js`に平文で埋め込まれるため、誰でも閲覧・使用できる。野良アクセスの抑止程度であり、本気で守りたい情報を置く用途には使えない。
- **Cloudflare Workers FreeプランのCPU時間制限**：1リクエストあたり10msの制限がある。VAPID署名＋ペイロード暗号化がこれを超過する可能性は理論上あるが、`wrangler tail`での実測では今のところCPU時間超過エラーは発生していない（Push Subscription登録後の実送信で継続して問題ないか要観察）。超過する場合は「ペイロードなしPush＋SW側で固定文言表示」のフォールバックに切り替える。
- **通知の遅延**：Cron Triggerは1分間隔が最小のため、通知は指定時刻から最大1分弱遅延しうる。
- **Workers KVは結果整合性**：リマインダー更新が反映されるまで最大60秒程度かかる場合がある。

## 今後の拡張余地（現時点ではやらない）
- クラウド同期（Firebase / Supabase等の無料枠を想定）による複数端末対応
- BGM・ナレーションを複数候補から選択できるようにする
- 簡易パスワードロックの追加
- リマインダーの複数管理UI（`reminder:<uuid>` + インデックスへのデータモデル移行）
- 起床オフセット計算（「予定起床時刻から何分後」を毎日HH:MMに正規化する仕組み）
- 通知タップで瞑想/NSDR画面へ直接遷移する連携

## 応答スタイル
グローバル設定（`~/.claude/CLAUDE.md`）に準拠：日本語で簡潔に。バグ・エラー対応は①原因説明→②修正コード→③補足説明の順。
