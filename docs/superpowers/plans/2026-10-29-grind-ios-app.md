# GRIND iPhone アプリ化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 今の GRIND を Capacitor で iPhone アプリにし、レスト終了の通知・振動・アプリ用の共有／書き出しを足して、App Store に無料で出せる一式（Xcode プロジェクト・ストア用ページ・手順書）をそろえる。

**Architecture:** 同じ `dist/` を Web 版（GitHub Pages）とアプリ（Capacitor の `ios/`）で使う。アプリ専用の処理は `src/lib/platform.ts` の `isNativeApp()` で分け、Capacitor のプラグインは小さな部品（`device.ts` / `restNotify.ts` / `haptics.ts`）の中だけで呼ぶ。Web 版の動きは変えない。

**Tech Stack:** Capacitor 8.x（core / cli / ios / local-notifications / haptics / share / clipboard / filesystem、開発用 assets）、React 18 + TypeScript + Vite PWA、Vitest

**Spec:** `docs/superpowers/specs/2026-10-29-grind-ios-app-design.md`

## Global Constraints

- `appId: 'io.github.zwjjpy677njpg.grind'`、`appName: 'GRIND'`、`webDir: 'dist'`、背景色 `#0B0B0D`、縦向きのみ、`ITSAppUsesNonExemptEncryption = NO`
- iOS のパッケージ管理は Swift Package Manager（CocoaPods を使わない）。`ios/` はリポジトリに含める
- 公開サイトの URL: `PUBLIC_URL = 'https://zwjjpy677n-jpg.github.io/workout-app/'`
- アプリでは Service Worker を登録しない。Web 版は今まで通り登録する
- Capacitor のプラグインは `src/lib/device.ts`・`src/lib/restNotify.ts`・`src/lib/haptics.ts` の中だけで import する（ほかのファイルはこれらを使う）
- Web 版の動き・既存テストは変えない
- 問い合わせ先は `https://github.com/zwjjpy677n-jpg/workout-app/issues`（メールアドレスは載せない）
- 内部の識別子 `ironlog` は変えない

## Review Focus

1. アプリから共有したリンクを Web 版の友達が開く → `https://zwjjpy677n-jpg.github.io/workout-app/#/friends/add?d=…` で読める（Task 2）
2. レスト中に ±15 秒・スキップ・別のセット完了で開始し直す → 通知の予約が常に最新の 1 件だけ（ID 固定 `1`）（Task 4）
3. 通知を許可しなかった・プラグインが失敗した → タイマー・アプリ内の音はそのまま動き、エラーを出さない（Task 4）
4. 共有画面のキャンセル（Capacitor の Share は「キャンセル」で reject する）→ コメントは未送信のまま等、Web の `AbortError` と同じ扱い（Task 2）
5. アプリを開いたまま時間が来た → 通知を重ねて出さず、アプリ内の音と表示だけ（Task 4）

---

### Task 1: Capacitor の土台と、アプリかどうかの判定

**Files:**
- Modify: `package.json`（依存・`build:ios` スクリプト）, `vite.config.ts`（`VitePWA({ injectRegister: null, ... })`）, `src/bootstrap.tsx`（または `src/main.tsx`）
- Create: `capacitor.config.ts`, `src/lib/platform.ts`, `src/lib/registerSW.ts`, `ios/`（`npx cap add ios` で生成）
- Modify: `ios/App/App/Info.plist`（`ITSAppUsesNonExemptEncryption` = false、`UISupportedInterfaceOrientations` は縦のみ、`CFBundleDisplayName` = GRIND）
- Test: `src/lib/registerSW.test.ts`

**Interfaces:**
- Produces: `isNativeApp(): boolean`（`Capacitor.isNativePlatform()`。テストでは `vi.mock('../lib/platform')` で差し替える）、`registerServiceWorker(): void`（アプリでは何もしない。Web では `virtual:pwa-register` の `registerSW({ immediate: true })`）

- [ ] **Step 1:** `npm i @capacitor/core@^8 @capacitor/ios@^8 @capacitor/local-notifications@^8 @capacitor/haptics@^8 @capacitor/share@^8 @capacitor/clipboard@^8 @capacitor/filesystem@^8` と `npm i -D @capacitor/cli@^8 @capacitor/assets@^3`
- [ ] **Step 2: 失敗するテストを書く** — `registerServiceWorker` が Web では `registerSW` を1回呼び、アプリ（`isNativeApp` → true）では呼ばない（`vi.mock('virtual:pwa-register', ...)`）
- [ ] **Step 3: FAIL を確認**（`npx vitest run src/lib/registerSW.test.ts`）
- [ ] **Step 4: 実装する。** `vite.config.ts` は `injectRegister: null` にして、`bootstrap` から `registerServiceWorker()` を呼ぶ。`capacitor.config.ts` は Global Constraints の値＋`ios.backgroundColor: '#0B0B0D'`、`plugins.LocalNotifications.presentationOptions: []`。`package.json` に `"build:ios": "npm run build && npx cap sync ios"`。`npm run build && npx cap add ios`（SPM）で `ios/` を作り、Info.plist を直す。`.gitignore` に `ios/App/App/public` と `ios/App/App/capacitor.config.json` を足す（`cap sync` で毎回作られるため）
- [ ] **Step 5: 確認** — テスト PASS、`npm run lint`、`npm run build` の `dist/index.html` に `registerSW.js` が無い、`npx cap sync ios` が成功、`npx vitest run` 全体が PASS
- [ ] **Step 6: Commit** — `feat: Capacitor で iPhone アプリの土台を追加（アプリでは Service Worker を使わない）`

### Task 2: 共有リンクの URL と、アプリ用の共有・コピー・貼り付け

**Files:**
- Create: `src/lib/device.ts`
- Modify: `src/lib/share/codec.ts`（`shareUrl`）, `src/features/friends/useShareMine.ts`（`send`）, `src/features/friends/PasteSheet.tsx`
- Test: `src/lib/device.test.ts`, `src/lib/share/codec.test.ts`

**Interfaces:**
- Consumes: `isNativeApp`（Task 1）
- Produces（`src/lib/device.ts`）:
  - `PUBLIC_URL = 'https://zwjjpy677n-jpg.github.io/workout-app/'`
  - `shareSheet(opts: { text?: string; files?: string[] }): Promise<'shared' | 'cancelled' | 'unavailable'>` — アプリ: `Share.share`。reject のメッセージに `cancel`（大小区別なし）を含めば `'cancelled'`、それ以外は throw。Web: `navigator.share` が無ければ `'unavailable'`、`AbortError`/`InvalidStateError` は `'cancelled'`、それ以外は throw
  - `copyText(text: string): Promise<void>` — アプリ: `Clipboard.write({ string: text })`、Web: `navigator.clipboard.writeText`
  - `canReadClipboard(): boolean`、`readClipboard(): Promise<string>` — アプリ: `Clipboard.read()` の `value`、Web: `navigator.clipboard.readText`
- `shareUrl(data)`: アプリでは `${PUBLIC_URL}#/friends/add?d=${data}`、Web は今まで通り
- `sendText` の外から見た動き（4 種類の結果、二重タップ防止）は変えず、中身を `shareSheet` / `copyText` に置き換える

- [ ] **Step 1: 失敗するテストを書く**（`@capacitor/share`・`@capacitor/clipboard` は `vi.mock`）
  - `アプリでは共有リンクが公開サイトの URL`: `shareUrl('r1abc')` === `'https://zwjjpy677n-jpg.github.io/workout-app/#/friends/add?d=r1abc'`、Web では `location` 由来のまま
  - `アプリの共有: 成功は shared、"Share canceled" は cancelled`
  - `アプリのコピーと貼り付けは Clipboard プラグイン`、`Web は navigator.clipboard`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS と、`src/features/friends` の既存テストが通ることを確認**
- [ ] **Step 5: Commit** — `feat: アプリでは公開サイトの URL で共有し、共有・コピー・貼り付けをアプリの仕組みで行う`

### Task 3: アプリでのバックアップ書き出し

**Files:**
- Modify: `src/lib/device.ts`（`saveFile`）, `src/features/manage/BackupPanel.tsx`
- Test: `src/lib/device.test.ts`, `src/features/manage/ManagePage.test.tsx`

**Interfaces:**
- Produces: `saveFile(name: string, text: string): Promise<'saved' | 'cancelled'>` — アプリ: `Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })` → `shareSheet({ files: [uri] })`（cancelled はそのまま返す）。Web: 今の `<a download>` の処理を移して `'saved'`

- [ ] **Step 1: 失敗するテストを書く** — `アプリでは Cache に grind-YYYY-MM-DD.json を書いて、その uri で共有画面を出す`、`共有をキャンセルしたら「エクスポートしました」を出さない`、`書き込みに失敗したら「書き出せませんでした」`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**（BackupPanel は `saveFile` を呼ぶだけにする）
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: アプリではバックアップを共有画面から書き出す`

### Task 4: レスト終了の通知

**Files:**
- Create: `src/lib/restNotify.ts`
- Modify: `src/hooks/useRestTimer.ts`
- Test: `src/lib/restNotify.test.ts`, `src/hooks/useRestTimer.test.ts`

**Interfaces:**
- Consumes: `isNativeApp`（Task 1）, `getSoundPrefs`（既存 `src/lib/sound.ts`）
- Produces（`src/lib/restNotify.ts`）:
  - `scheduleRestEnd(endAt: number): Promise<void>` — Web では何もしない。アプリ: 音の設定がオフなら取り消しだけ。`requestPermissions()` の `display` が `'granted'` でなければ何もしない。`cancel({ notifications: [{ id: 1 }] })` → `schedule({ notifications: [{ id: 1, title: 'レスト終了', body: '次のセットへ', schedule: { at: new Date(endAt), allowWhileIdle: true } }] })`。例外はすべて握りつぶす
  - `cancelRestEnd(): Promise<void>` — Web では何もしない。アプリ: `cancel` ID 1（例外は握りつぶす）
- `useRestTimer` から: `start(sec)` → `sec > 0 ? schedule(endAt) : cancel`、`add` → 残りが 0 より大きければ新しい `endAt` で schedule、0 以下は cancel、`skip` → cancel、アプリ内で終了を迎えた（interval で 0 になった）→ cancel

- [ ] **Step 1: 失敗するテストを書く**（`@capacitor/local-notifications` を `vi.mock`、`platform` を true に）
  - `restNotify`: `許可されたら ID 1 で endAt に予約し、前の予約は先に取り消す`、`許可されなければ予約しない`、`音の設定がオフなら予約しない`、`プラグインが失敗しても例外を出さない`、`Web では何も呼ばない`
  - `useRestTimer`（`restNotify` を `vi.mock`）: `start(90) で予約、add(15) で新しい時刻で予約し直し、skip で取り消し`、`start(0) と add で 0 以下は取り消し`、`画面を開いたまま 0 になったら取り消し`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS と `src/features/workout` の既存テストを確認**
- [ ] **Step 5: Commit** — `feat: アプリではレスト終了を通知で知らせる（画面を消していても届く）`

### Task 5: 振動

**Files:**
- Create: `src/lib/haptics.ts`
- Modify: `src/hooks/useRestTimer.ts`（今の `navigator.vibrate?.(300)` を `notifyEnd()` に）, `src/features/workout/ExerciseRow.tsx`（セットを完了にしたとき `tap()`）
- Test: `src/lib/haptics.test.ts`, `src/hooks/useRestTimer.test.ts`

**Interfaces:**
- Produces: `tap(): void`（アプリ: `Haptics.impact({ style: ImpactStyle.Light })`、Web: 何もしない）、`notifyEnd(): void`（アプリ: `Haptics.notification({ type: NotificationType.Success })`、Web: `navigator.vibrate?.(300)`）。どちらも例外を握りつぶす

- [ ] **Step 1: 失敗するテストを書く** — `アプリではセット完了で Light、レスト終了で Success`、`Web ではレスト終了で vibrate(300)、セット完了では何もしない`（既存の useRestTimer のバイブのテストはそのまま通ること）
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: アプリではセット完了とレスト終了で振動する`

### Task 6: ストア用のアイコン・起動画面・公開ページ・ストア文

**Files:**
- Create: `assets/icon.png`（1024×1024、透過なし。今の `public/icon-512.png` の元 SVG から作る）, `assets/splash.png` と `assets/splash-dark.png`（2732×2732、背景 `#0B0B0D`、中央にロゴ「GRIND.」）
- Create: `public/privacy.html`, `public/support.html`, `docs/app-store/listing.md`
- Test: Playwright で 375px 表示・横スクロールなし（スクリプトは scratchpad に置く）

内容（スペック §7）:
- `privacy.html`: 見出し「プライバシーポリシー」、記録・体重・メモはすべて端末の中だけに保存し開発者は集めない、外部に送らない、友達との共有は自分が送ったリンクだけ（体重・体脂肪率・メモ・コンディションは含まない）、通知は端末の中だけで予約、問い合わせ先、制定日 2026-10-29
- `support.html`: 見出し「サポート」、よくある質問（記録をアプリに引っ越す／バックアップ／友達との共有のしかた／通知が来ないとき）、問い合わせ先
- どちらも 1 ファイルで完結（CSS は中に書く）、ダーク×レッド、`<meta name="viewport">` あり
- `listing.md`: アプリ名「GRIND - 筋トレ記録」、サブタイトル（30 字以内）、説明文、キーワード（100 字以内）、カテゴリ、年齢区分の答え（すべて「なし」→ 4+）、App のプライバシー（データの収集なし）、プライバシーポリシー URL `https://zwjjpy677n-jpg.github.io/workout-app/privacy.html`、サポート URL `https://zwjjpy677n-jpg.github.io/workout-app/support.html`、スクリーンショットの撮り方（6.9 インチと 6.5 インチ、ホーム／記録画面／カレンダー／グラフ／友達の順）

- [ ] **Step 1:** 画像を作る（Playwright で SVG を描いて PNG に）。サイズと透過なしを `file`/画像の読み込みで確認
- [ ] **Step 2:** ページと `listing.md` を書く
- [ ] **Step 3:** `npm run build` で `dist/privacy.html`・`dist/support.html` があること、Playwright で 375px・横スクロールなし・スクリーンショット確認
- [ ] **Step 4: Commit** — `feat: App Store 用のアイコン・起動画面・プライバシーポリシー・サポートページ・ストア文`

### Task 7: Mac での手順書

**Files:**
- Create: `docs/app-store/ios-release.md`

内容（スペック §8 の 1〜8 と記録の引っ越し）。コマンドはこのリポジトリで実際に動くもの（`npm ci` → `npm run build:ios` → `npx cap open ios`、`npx capacitor-assets generate --ios`）。Xcode の操作は画面の名前で書く（Signing & Capabilities → Team、Product → Archive、Distribute App → App Store Connect）。実機での確認リスト（記録・通知・振動・共有・書き出し／読み込み・友達のリンク）

- [ ] **Step 1:** 書く
- [ ] **Step 2:** 書いたコマンドをこの環境で実行できるもの（`npm ci`・`npm run build:ios`）は実行して確認
- [ ] **Step 3: Commit** — `docs: Mac で組み立てて App Store に出す手順書`

### Task 8: 通しの確認

- [ ] **Step 1:** `npm run lint`・`npx vitest run`・`npm run build`・`npx cap sync ios`
- [ ] **Step 2:** Web 版を Playwright（375px）で開き、記録 → 共有（コピー）→ 別の端末で貼り付けまでが今まで通り動き、コンソールエラーが無いこと
- [ ] **Step 3: Commit**（直したものがあれば）
