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
- 音声再生：`<audio>` 要素による音声ファイルの自前ホスティング再生（`audio/` 配下、mp3）

**過去に検討し、不採用にしたもの**：
- 生活ルーティン全般（日光浴・サプリ等）のリマインダー通知（Cloudflare Workers + Web Push）を一時実装したが、「専用のリマインダーアプリで十分できることの車輪の再発明」と判断し撤去した。瞑想記録アプリとしてのスコープに集中する方針。
- YouTube IFrame Player APIでの埋め込み再生：当初はこの方式だったが、iOS Safariで画面をロックするとBGM/ナレーションの再生が停止する制約があり解決できなかったため、`<audio>`要素での自前ホスティング再生に置き換えた（画面ロック中の動作継続には限界があるも改善、後述）。YouTube動画自体のダウンロード・自前配信は著作権・利用規約上の理由で行っておらず、現在の音声ファイルはすべてロイヤリティフリー音源（ダウンロード・再配布が許可されているもの）を使用している

## ディレクトリ構成
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
│   ├── audio-player.js  # <audio>要素の共通ラッパー
│   ├── storage.js       # localStorage 読み書き
│   ├── stats.js         # 統計計算（連続日数・週間/月間合計）
│   ├── config.js        # 瞑想・NSDRで使う音声ファイルの設定
│   ├── quotes.js        # ホーム画面に表示する「自分を大切にする」言葉集
│   ├── backgrounds.js   # 起動ごとに切り替わる自然写真背景のファイルリスト
│   ├── chime.js         # 瞑想・NSDR終了時の通知チャイム音（Web Audio APIで自前生成）
│   └── wakelock.js      # 実施中の画面自動スリープ防止（Screen Wake Lock API）
├── audio/                # 瞑想・NSDR用の音声ファイル4本（mp3、下記機能要件参照）
├── images/
│   └── nature/           # 背景写真15枚（Unsplash無料ライセンス、下記UI方針参照）
└── icons/            # PWA用アイコン
```

## 機能要件（必要最低限）

瞑想とNSDRは別物として扱う。データ上も別セッション種別（`type`）で区別し、再生する音声も種別ごとに分離管理する。

1. **瞑想（通常瞑想）**：`config.js` の `MEDITATION_AUDIO_OPTIONS`（3種類：夜瞑想 `night-meditation` / チベタン `tibetan-bowl` / 瞑想BGM `meditation-bgm`）から音声を選べる（`.audio-picker`）。実施方法は「選んだ音声に合わせて」「タイマー」「そのまま寝る」の3モードから選べる（`.mode-toggle`）
   - **音声に合わせてモード**：選んだ音声ファイルを最後まで再生。再生終了（`AudioPlayer` の `onEnded`）と同時にセッションを自動終了・記録する。手動で「終了して記録」を押すこともできる
   - **タイマーモード**：5/10/15/20/30分のプリセットから時間を選んで開始。選んだ音声をループ再生しながら、指定時間の経過（`MeditationTimer.start({ targetSec, onComplete })`）で自動終了・記録する
   - **そのまま寝るモード**：`config.js` の `SLEEP_DURATION_PRESETS_MIN`（15/30/45/60分）から時間を選んで開始。選んだ音声をループ再生し、`MeditationTimer`のtickコールバック内で残り時間が`SLEEP_FADE_OUT_SEC`（30秒）以下になったタイミングを検知して`AudioPlayer.fadeOutAndStop()`を呼び、選んだ時間ちょうどで無音になるよう音量を徐々に下げていく。目標時間到達で自動終了・記録する（そのまま眠ってしまってよい想定の機能）
   - 実施中はモード切替・プリセット選択を無効化するが、**音声選択（`.audio-picker`）だけは実施中も有効**：終了せずに音源を途中で変更できる（`setSelectedAudio()`）。経過時間・残り時間（`MeditationTimer`）は一切リセットせず、再生中の音声だけを差し替えて続行する。「音声に合わせてモード」で音源を変えた場合、自動終了の基準（`onEnded`）も新しい音声の終了に自然に切り替わる。「そのまま寝るモード」の途中で変えた場合、新しい音声はフルボリュームから始まるためフェード開始判定（`sleepFadeStarted`）をやり直す
   - 音声はすべて `<audio id="meditation-audio">` 要素（画面には表示せず、再生中かどうかは `.bgm-indicator` で伝える）
2. **NSDR**
   - `config.js` の `NSDR_NARRATION_AUDIO` に設定した誘導ナレーション音声を再生（`<audio id="nsdr-audio">`、`.bgm-indicator` で再生中を表示）。手動終了前提のためループ再生する
   - 実施したら記録として保存
   - 当面は固定1音声のみの割り当て（複数候補からの選択は将来拡張）
3. **記録閲覧**
   - 履歴一覧：日付・種類（`meditation` / `nsdr`）・実施時間
   - 統計：連続日数（ストリーク）、今週の合計時間、今月の合計時間
4. **終了チャイム音**
   - 瞑想（動画終了・タイマー到達・手動終了いずれも）とNSDR（手動終了）で、実施時間が0秒より大きい場合に `js/chime.js` の `Chime.play()` を鳴らす
   - 音源は外部ファイルではなく Web Audio API でその場に生成（著作権フリー・オフライン対応）
   - Bluetoothイヤホン等の出力先はWebアプリ側から選べない。OSが管理する「現在の音声出力先」にBGMと同じ経路で自動的に流れる（イヤホン接続中はイヤホンから鳴る）
   - iOSの自動再生制限対策として、「開始」ボタンのクリックハンドラ内で `Chime.unlock()` を呼びAudioContextを解放しておく（自動終了時にも鳴らせるようにするため）
5. **名言表示**
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
  "audioId": "night-meditation | tibetan-bowl | meditation-bgm | nsdr-narration",
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
- **画面ロック中の動作継続には限界がある**：`js/wakelock.js`（Screen Wake Lock API）で実施中の**自動**スリープは防いでいるが、これはユーザーが自分で電源ボタンを押して画面を消す操作までは防げない（OS側の仕様でWebアプリからは制御不可）。手動で画面を消した後は、
  - 音声再生は、以前のYouTube埋め込み方式では画面ロックと同時に停止する問題があったが、同一オリジンの `<audio>` 要素＋Media Session APIでの再生に変更したことで、iOS Safariのバックグラウンド再生に正式対応し、継続しやすくなっている（`index.html` で `navigator.mediaSession.setActionHandler('play'/'pause', ...)` を設定し、ロック画面からの一時停止・再開にも対応）。ただし実機でのYouTube方式からの改善は確認済みだが、100%の保証ではない
  - タイマーモードの「目標時間到達で自動終了」判定は`setInterval`が動いている間のみ働くため、画面ロック中は判定が止まり、フォアグラウンド復帰時にまとめて判定される（経過時間の表示自体はDate差分で正しく補正される）
- **公開範囲**：GitHub PagesはURLを知っていれば誰でもアプリを開ける（認証なし）。ただしデータはiPhone内のlocalStorageのみに保存されるため、他人がアプリを開いても稲澤さんの記録が見えることはない。
- **GitHub Pagesはリポジトリを Public にする必要がある**：GitHub Freeプランでは、Privateリポジトリに対してGitHub Pagesを有効化できない（Pro以上が必要）。そのためこのリポジトリは Public にしてある。ソースコード・音声ファイルは誰でも閲覧・ダウンロードできる状態である点に留意する。音声ファイルは必ずダウンロード・再配布が許可されたロイヤリティフリー音源のみを使うこと（著作権のある音源を無断で置かない）。
- **Service Workerのキャッシュ更新**：`index.html` / `css` / `js`（`config.js`の音声設定変更を含む）/ `manifest.json` / `icons` のいずれかを更新したら、**必ず `sw.js` の `CACHE_NAME` の数字をインクリメントする**こと。Service Workerはファイル内容がバイト単位で前回と同一だと更新を検知せず、古いキャッシュを使い続けてしまう。CACHE_NAMEを変えるとsw.js自体のバイト内容が変わり、確実に新バージョンとして再キャッシュされる。iPhone実機では、それでも反映されない場合はSafariで一度サイトを開き直す（ホーム画面から削除して再追加、またはSafariの「Webサイトデータを消去」）ことで解消できる。GitHub Pages側のHTTPキャッシュが残ることもあり、その場合はハードリロード（PC）や上記のサイトデータ消去（iPhone）で解消する。
- **背景写真・音声ファイルは事前キャッシュ対象外**：`images/nature/*.webp`（15枚・合計約7.2MB）と`audio/*.mp3`（4本・合計約77MB）は`sw.js`の`PRECACHE_URLS`に含めていない。含めると初回ロード時に全部ダウンロードされ重くなるため、`fetch`ハンドラのcache-first戦略に任せ、実際に表示・再生されたものから順にキャッシュされる設計にしている。つまり音声は**一度オンラインで再生済みのものだけがオフラインでも再生できる**（未再生のものは初回だけオンラインが必要）。画像・音声を追加する場合、この方針は維持すること。
- **音声ファイルのサイズ管理**：GitHubは単一ファイル100MBを超えると通常のpushで拒否される。音声を追加・差し替える際はffmpegでモノラル化・低ビットレート化（目安：ナレーション系64kbps、BGM系48kbps mono）してからコミットすること（`conda create -n ffmpeg_tools -c conda-forge ffmpeg` でインストール済み）。

## 今後の拡張余地（現時点ではやらない）
- クラウド同期（Firebase / Supabase等の無料枠を想定）による複数端末対応
- NSDRナレーションも複数候補から選択できるようにする
- 簡易パスワードロックの追加

## 応答スタイル
グローバル設定（`~/.claude/CLAUDE.md`）に準拠：日本語で簡潔に。バグ・エラー対応は①原因説明→②修正コード→③補足説明の順。
