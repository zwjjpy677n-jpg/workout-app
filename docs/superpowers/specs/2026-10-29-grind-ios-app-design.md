# GRIND — iPhone アプリ化（App Store 無料公開） 設計仕様

- 作成日: 2026-10-29
- ステータス: レビュー待ち
- 前提: 既存の GRIND（React 18 + TypeScript + Vite PWA、Dexie、HashRouter、GitHub Pages 公開）。仕様書 `2026-10-28-*` の機能はすべてそのまま

## 1. 目的

今の GRIND を、App Store で**無料**公開できる iPhone アプリにする。中身は今のコードをそのまま使い、アプリならではの機能（レスト終了の通知・振動）を足す。Web 版（GitHub Pages）も今までどおり残す。

ユーザーが決めたこと:
- App Store で無料公開（課金なし）
- Mac を持っている → 私がアプリの中身を作り、ユーザーが Mac（Xcode）で組み立てて提出する
- 方式は Capacitor
- 最初の版に入れる: iPhone アプリの形、ストア用一式、記録の引っ越し手順、レスト終了の通知、振動
- 次の版に回す: 友達のリンクを押すだけでアプリが開く（Universal Links）、iCloud 自動バックアップ
- アプリの ID（Bundle ID）: `io.github.zwjjpy677njpg.grind`

成功基準:
- Mac で手順書どおりに進めると、Xcode で組み立てて iPhone 実機で動き、App Store Connect に提出できる
- アプリでレストタイマーを始めて画面を消すと、時間になったら通知（音つき）が届く
- アプリから共有した友達用リンクを、Web 版でもアプリでも読み込める
- アプリでバックアップを書き出せる（共有画面から「ファイルに保存」など）。Web 版で書き出したバックアップをアプリで読み込める
- Web 版はこれまでどおり動き、テストもすべて通る

## 2. 対象外

- 課金・広告・アカウント・サーバー
- Android 版（同じ方式で作れるが今回はしない）
- Universal Links（リンクを押してアプリを開く）、iCloud バックアップ
- ウィジェット、Apple Watch、HealthKit 連携
- App Store への実際の提出作業（ユーザーが Mac で行う。手順書を用意する）

## 3. 構成

- 依存を追加: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`（8.x）、`@capacitor/local-notifications`, `@capacitor/haptics`, `@capacitor/share`, `@capacitor/clipboard`, `@capacitor/filesystem`（8.x）。開発用に `@capacitor/assets`（アイコン・起動画面の生成、Mac で実行）
- `capacitor.config.ts`: `appId: 'io.github.zwjjpy677njpg.grind'`, `appName: 'GRIND'`, `webDir: 'dist'`, iOS の背景色 `#0B0B0D`
- `ios/` フォルダ（Xcode プロジェクト）をリポジトリに含める。パッケージ管理は Swift Package Manager（CocoaPods 不要）
- `Info.plist`: `ITSAppUsesNonExemptEncryption = NO`（暗号の輸出申告を不要にする）、表示名 `GRIND`、画面の向きは縦のみ
- ビルド: `npm run build` の出力（`base: './'`、HashRouter）をそのまま使う。`npm run build:ios` = `npm run build && npx cap sync ios`
- **アプリでは Service Worker（PWA の自動更新）を登録しない**（アプリの更新は App Store 経由のため。WKWebView では動作も不安定）

### 3.1 アプリか Web かの判定

- `src/lib/platform.ts`: `isNativeApp(): boolean`（`Capacitor.isNativePlatform()`）。テストで差し替えられるようにする
- アプリ専用の処理はこの判定で分け、Web 版の動きは変えない

## 4. アプリでだけ変える部分

### 4.1 共有リンクの URL（重要）

- 今の `shareUrl` は `location.origin + location.pathname` で作るため、アプリでは `capacitor://localhost/...` になり、友達が開けない
- アプリでは公開サイトの URL を使う: `PUBLIC_URL = 'https://zwjjpy677n-jpg.github.io/workout-app/'` → `${PUBLIC_URL}#/friends/add?d=…`
- Web 版は今までどおり（開発環境でも動くよう `location` を使う）

### 4.2 共有・コピー・貼り付け

- 共有: アプリでは `@capacitor/share` の `Share.share({ text })`。キャンセルは「cancelled」として扱う（今の `sendText` の結果と同じ 4 種類を返す）
- コピー: アプリでは `@capacitor/clipboard` の `Clipboard.write`
- 貼り付けボタン（「クリップボードから貼り付け」）: アプリでは `Clipboard.read`
- 「タップの直後に呼ぶ」制約は Web 版のため。アプリでも同じ呼び方のまま問題ない

### 4.3 バックアップの書き出し

- Web 版: 今までどおりファイルのダウンロード
- アプリ: `@capacitor/filesystem` で一時フォルダ（Cache）に `grind-YYYY-MM-DD.json` を書き、`Share.share({ files: [uri] })` で共有画面を出す（「ファイルに保存」「AirDrop」など）
- 読み込み（ファイル選択）はアプリでもそのまま動く

## 5. レスト終了の通知

- 対象: アプリのときだけ。Web 版は今までどおり（音・振動・画面表示）
- `src/lib/restNotify.ts`:
  - `scheduleRestEnd(endAt: number): Promise<void>` — 予約済みを取り消してから `endAt` に 1 件予約（ID は固定 `1`）。タイトル「レスト終了」、本文「次のセットへ」、音はシステムの通知音
  - `cancelRestEnd(): Promise<void>`
  - 許可: 初めて予約するときに `LocalNotifications.requestPermissions()`。拒否されたら予約しない（エラーは出さず、アプリ内の音・表示はそのまま）
- `useRestTimer` から呼ぶ:
  - `start` → 予約（0 秒なら取り消し）、`add` → 新しい `endAt` で予約し直し（0 以下なら取り消し）、`skip` → 取り消し
  - 終了してアプリ内で鳴らしたとき（画面を開いていた）→ 取り消し（同じ内容を二重に出さない）
  - 設定「レスト終了を音で知らせる」がオフなら予約しない
- アプリを開いている間に予約時刻が来た場合は、通知を画面に出さない（アプリ内の音と表示で知らせる）。`capacitor.config.ts` の `LocalNotifications.presentationOptions` は空

## 6. 振動

- `src/lib/haptics.ts`: `tap()`（セット完了）と `notifyEnd()`（レスト終了）
- アプリ: `@capacitor/haptics`（`impact({ style: 'Light' })` / `notification({ type: 'Success' })`）
- Web 版: 今までどおり `navigator.vibrate`（レスト終了 300ms）。セット完了の振動は Web 版では足さない

## 7. ストア用一式

- アイコン: 今のレーシング案の SVG から 1024×1024 の PNG（透過なし）を作り `assets/icon.png` に置く。起動画面は背景 `#0B0B0D` に中央のロゴ（`assets/splash.png` 2732×2732）。Mac で `npx capacitor-assets generate --ios` を実行して Xcode 用の画像を作る
- 公開ページ（GitHub Pages、`public/` に置く）:
  - `privacy.html`（プライバシーポリシー）: 記録・体重・メモなどはすべて端末の中だけに保存し、開発者は集めない／外部に送らない。友達との共有はユーザー自身が送ったリンクだけで、内容は §4 の共有仕様のとおり（体重・メモなどは含まない）。通知は端末の中だけで予約する。問い合わせ先
  - `support.html`（サポート）: よくある質問（記録の引っ越し、バックアップ、友達との共有、通知が来ないとき）と問い合わせ先
  - 問い合わせ先: GitHub の Issues ページ（`https://github.com/zwjjpy677n-jpg/workout-app/issues`）。メールアドレスは載せない
  - どちらもダーク×レッドの見た目、スマホで読める
- `docs/app-store/listing.md`: アプリ名案（「GRIND - 筋トレ記録」）、サブタイトル、説明文、キーワード、カテゴリ（ヘルスケア／フィットネス）、年齢区分の答え方、App のプライバシー（「データを収集していません」）、スクリーンショットの撮り方（6.9 インチ・6.5 インチ、撮る画面の順）

## 8. 引っ越しと Mac の手順書

- `docs/app-store/ios-release.md`（日本語、画面の順に）:
  1. 準備: Apple Developer Program 登録、Xcode のインストール、リポジトリの取得、`npm ci`
  2. `npm run build:ios` → `npx cap open ios`
  3. Xcode: Signing & Capabilities でチームを選ぶ、Bundle ID の確認、実機で起動
  4. アイコン・起動画面の生成（`npx capacitor-assets generate --ios`）
  5. 実機での確認リスト（記録・通知・振動・共有・バックアップ書き出し／読み込み・友達のリンクの貼り付け）
  6. App Store Connect でアプリを作る（`listing.md` の内容を入れる、プライバシーポリシー URL・サポート URL）
  7. Archive → アップロード → TestFlight で確認 → 審査に提出
  8. 更新の出し方（バージョン番号の上げ方）
- 記録の引っ越し（`support.html` と手順書の両方に載せる）: Web 版の「管理 → バックアップ → 書き出す」→ ファイルに保存 → アプリの「管理 → バックアップ → 読み込む」でそのファイルを選ぶ

## 9. エラー処理

| 状況 | 動き |
|---|---|
| 通知を許可しなかった | 予約しない。アプリ内の音・表示はそのまま |
| 通知の予約・取り消しに失敗 | 何も表示しない（タイマーは動く） |
| 共有画面でキャンセル | 「cancelled」（コメントは未送信のまま等、今と同じ） |
| バックアップの書き出しに失敗 | 「書き出せませんでした」 |
| Capacitor のプラグインが無い（Web 版） | アプリ専用の処理は呼ばない |

## 10. テスト

- `platform` を差し替えて、アプリのとき／Web のときを両方確かめる:
  - 共有リンクがアプリでは公開サイトの URL になる（Web では今まで通り）
  - レストタイマー: 開始で予約、±15 秒で予約し直し、スキップで取り消し、0 秒で取り消し、アプリ内で鳴ったら取り消し、音オフなら予約しない、許可されなければ予約しない（プラグインはテスト用の偽物に差し替える）
  - 振動: セット完了・レスト終了でアプリ用の振動が呼ばれる
  - 共有・コピー・貼り付けがアプリではプラグイン経由になる
  - バックアップ書き出しがアプリではファイル書き込み＋共有になる
- Web 版の既存テストがすべて通る
- `npx cap sync ios` がこの環境（Linux）で通ること（Xcode プロジェクトの生成と Web 資源のコピーまで）。実機での組み立ては Mac でユーザーが手順書に沿って確認
- `privacy.html` / `support.html` を Playwright で 375px 表示し、横スクロールが無いこと
