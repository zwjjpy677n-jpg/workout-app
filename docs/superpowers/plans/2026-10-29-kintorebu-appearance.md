# キントレ部（名前・猫アイコン・見た目の設定） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 表に出る名前を「キントレ部」にし、猫のアイコン（12 色）と、強調色（9 色）・背景（4 種類）を利用者が選べるようにする。

**Architecture:**
- 見た目の設定は `src/lib/appearance.ts` が持つ。端末の localStorage に保存し、CSS 変数を上書きして全画面に効かせる。最初の描画より前に適用する。
- アイコンの切り替えは `src/lib/appIcon.ts` が受け持つ。
  - iPhone アプリ：`@capacitor-community/app-icon` を使う。
  - Web 版：ホーム画面用アイコンの link を差し替える。
- アイコン画像は `scripts/make-icons.py` で、`assets/cat.png` から全色を生成する。

**Tech Stack:** React 18 + TypeScript + Vite、Vitest + Testing Library、Capacitor 8、Python 3 + Pillow + NumPy（アイコン生成のみ）

**Spec:** `docs/superpowers/specs/2026-10-29-kintorebu-appearance-design.md`

## Global Constraints

- 名前は「キントレ部」。App Store の名前は「キントレ部 - 筋トレ記録」
- 変えないもの：
  - データベース名、バックアップの `app` 欄、localStorage キーの接頭辞 `ironlog`
  - Bundle ID `io.github.zwjjpy677njpg.grind`
  - 共有リンクの形式
- 見た目の保存キーは `ironlog:appearance`。端末ごとに保存し、バックアップには含めない
- 既定値は `{ icon: 'red', accent: 'red', bg: 'black' }`
- 色の値は、仕様 §4.1（アイコン 12 色）、§5.2（強調色 9 色と上の文字色）、§5.3（背景 4 種類）の表のとおり
- CSS 変数名 `--red` / `--red-soft` は変えない。強調色の上の文字色として `--on-accent` を足す
- エラー・削除の赤系、注意の黄（`#f5b041`）、プレートの色、`--green` は変えない
- 画面の文言は日本語
- コミットの末尾は `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` と `Claude-Session: https://claude.ai/code/session_01N5pgkHG4CbSTbrZQYnRufH`

## Review Focus

1. 前の版の端末で、保存された値がない、または壊れている（`{"accent":"gold"}` など） → 該当する項目だけ既定値にし、ほかの項目は残す（Task 2 のテスト）
2. 黄やミントなど明るい強調色で、主ボタン・選択中のタブ・PR バッジの文字が読める → `--on-accent` が `#111` になる（Task 2 のテスト）。全画面の目視は Task 7
3. Web 版でアイコンを選んだあと、開き直してからホーム画面に追加する → 起動時に apple-touch-icon が選んだ色になっている（Task 2 のテスト）
4. iPhone でアイコンの切り替えに失敗、または非対応 → 選択を前の色に戻し、「アイコンを変えられませんでした」を出す（Task 5 のテスト）
5. 強調色をそのまま書いた所が残っていて、色を変えても一部だけ赤のまま → `src` の CSS と TSX に `#E10600` と `rgba(225, 6, 0` が残っていないことを、テストで確かめる（Task 3）

---

### Task 1: 猫アイコンの画像と iPhone の別アイコン設定

**Files:**
- Create: `scripts/make-icons.py`
- Create: `assets/cat.png`
- Create: `public/icons/<key>-180.png`, `public/icons/<key>-64.png`（12 色）
- Modify: `assets/icon.png`, `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`
- Create: `ios/App/App/Assets.xcassets/AppIcon-<key>.appiconset/{Contents.json,icon.png}`（赤以外の 11 色）
- Modify: `ios/App/App/Assets.xcassets/AppIcon.appiconset/*`（赤）
- Modify: `ios/App/App.xcodeproj/project.pbxproj`
- Test: `src/appConfig.test.ts`

**Interfaces:**
- Produces:
  - アイコンの色キー一覧 `red yellow orange pink purple blue sky mint green navy black cream`
  - 公開パス `icons/<key>-180.png`、`icons/<key>-64.png`
  - iOS の別アイコン名 `AppIcon-<key>`

- [ ] **Step 1: 失敗するテストを書く**（`appConfig.test.ts` に追加）
  - `test('猫アイコンが 12 色そろっていて、iPhone の別アイコンとして組み込まれている')`
    - 12 キーそれぞれについて、`public/icons/<key>-180.png` と `-64.png` が存在すること
    - 赤以外の 11 キーについて、`ios/App/App/Assets.xcassets/AppIcon-<key>.appiconset/Contents.json` が存在すること
    - `project.pbxproj` に `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES;` が Debug と Release の 2 回あること
- [ ] **Step 2:** `npx vitest run src/appConfig.test.ts` を実行し、FAIL になることを確かめる
- [ ] **Step 3: 切り抜いた猫を `assets/cat.png` に置く**
  - 試作の切り抜き（scratchpad の `icon/catA.png` を `getbbox()` で余白を詰めたもの）を使う
  - 試作の手順（黄色の背景を色相で除く → 穴埋め → 黄色がかった縁は黒 `(20,20,24)` に → 4 倍 Lanczos ＋アンシャープ）は、`make-icons.py` の冒頭コメントに記録だけしておく（元画像が来たら不要になるため）
- [ ] **Step 4: `scripts/make-icons.py` を書く**
  - 引数なしで、上の Files に挙げた画像をすべて `assets/cat.png` から作る
  - 背景のグラデーション：`t=(x+y)/2S` として、明るい側 `min(255, c*1.08+12)` から暗い側 `c*0.86` へ
  - 影：楕円 `[0.14S, y+h-0.07S, 0.9S, y+h+0.03S]`、濃さ 70/255、ぼかし `0.02S`
  - 猫：幅 `0.86S`、縦位置 `(S-h)/2+0.03S`
  - 出力はすべて RGB（透過なし）
  - appiconset の `Contents.json` は、今の `AppIcon.appiconset/Contents.json` と同じ 1024 単一サイズの形式にする
- [ ] **Step 5: 生成して、ビルド設定を入れる**
  - `python3 scripts/make-icons.py` を実行する
  - `project.pbxproj` の App ターゲットの Debug / Release の buildSettings に `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES;` を足す
- [ ] **Step 6:** `npx vitest run src/appConfig.test.ts` が PASS になることを確かめる。`public/icons/red-180.png` を目で見て、猫が赤い背景の中央にあることを確かめる
- [ ] **Step 7: コミット** `feat: 猫アイコン 12 色と iPhone の別アイコン設定`

### Task 2: 見た目の設定（保存・適用）

**Files:**
- Create: `src/lib/appearance.ts`, `src/lib/appearance.test.ts`
- Modify: `src/styles/tokens.css`（`--on-accent: #fff;` を追加）
- Modify: `src/main.tsx`（`bootstrap` の前に `applyAppearance(getAppearance())`）
- Modify: `index.html`（`<meta name="theme-color">` と `<link rel="apple-touch-icon">` は残す。JS から書き換える）

**Interfaces:**
- Produces:
  - `type IconKey`（12 色）、`type AccentKey`（9 色）、`type BgKey = 'black' | 'navy' | 'brown' | 'forest'`
  - `type Appearance = { icon: IconKey; accent: AccentKey; bg: BgKey }`
  - `ICONS: { key: IconKey; name: string; color: string }[]`（表示順は仕様の表どおり。`name` は「赤」など）
  - `ACCENTS: { key: AccentKey; name: string; color: string; on: string }[]`
  - `BGS: { key: BgKey; name: string; bg: string; surface: string; surface2: string; line: string }[]`
  - `DEFAULT_APPEARANCE`
  - `getAppearance(): Appearance`、`setAppearance(a: Appearance): void`（保存、適用、購読者への通知まで行う）
  - `applyAppearance(a: Appearance): void`
  - `subscribeAppearance(fn: () => void): () => void`
  - `useAppearance(): Appearance`（`useSyncExternalStore` で作る）
  - `iconUrl(key: IconKey, size: 64 | 180): string` → `./icons/${key}-${size}.png`

- [ ] **Step 1: 失敗するテストを書く**
  - `既定は赤アイコン・赤・黒`：localStorage が空なら `getAppearance()` が `{icon:'red',accent:'red',bg:'black'}` を返す
  - `保存したものが読める`：`setAppearance({icon:'yellow',accent:'blue',bg:'navy'})` のあと、`getAppearance()` が同じ値を返す。`localStorage['ironlog:appearance']` に保存されている
  - `壊れた項目だけ既定に戻る`：`{"icon":"yellow","accent":"gold","bg":5}` → `{icon:'yellow',accent:'red',bg:'black'}`。JSON でない文字列なら全部既定値
  - `localStorage が使えなくても既定で動く`：`getItem`・`setItem` が例外を投げても、get も set も例外を出さない
  - `適用すると CSS 変数・theme-color・ホーム画面アイコンが変わる`：`applyAppearance({icon:'mint',accent:'yellow',bg:'navy'})` のあと
    - `--red` が `#FFC21A`
    - `--on-accent` が `#111`
    - `--red-soft` が `color-mix(in srgb, #FFC21A 15%, transparent)`
    - `--bg` が `#0A0F1E`、`--surface` が `#131A2C`、`--surface2` が `#1B2338`、`--line` が `#283149`
    - `meta[name=theme-color]` の content が `#0A0F1E`
    - `link[rel=apple-touch-icon]` の href が `./icons/mint-180.png` で終わる
  - `赤は今と同じ見た目`：既定値を適用すると `--red` が `#E10600`、`--on-accent` が `#fff`、`--bg` が `#0B0B0D`
  - `変えると購読者に通知される`：`subscribeAppearance` の fn が `setAppearance` で 1 回呼ばれる。解除すると呼ばれない
- [ ] **Step 2:** `npx vitest run src/lib/appearance.test.ts` を実行し、FAIL になることを確かめる
- [ ] **Step 3: `appearance.ts` を実装し、`main.tsx` から呼ぶ**
  - 保存の仕方と壊れた値の扱いは `src/lib/sound.ts` に合わせる
  - meta や link が無い環境では、その部分を飛ばす
- [ ] **Step 4:** テストが PASS になること、`npx vitest run` で全部 PASS になることを確かめる
- [ ] **Step 5: コミット** `feat: 見た目の設定を端末に保存して起動時に適用`

### Task 3: 強調色・背景を全画面に効かせる

**Files:**
- Modify: 次の CSS で、強調色の上にある `color: #fff` を `color: var(--on-accent)` に変える
  - `src/components/{RatingInput,Button}.module.css`
  - `src/features/{friends,progress,manage,home}/*.module.css`
  - `src/features/workout/{workout,rest}.module.css`
  - 対象は `background: var(--red)` と同じルールの中の `#fff`。`.badge.ok svg` の stroke と `.check[aria-pressed='true'] svg` も `var(--on-accent)` にする
- Modify: `src/components/Button.module.css`
  - 主ボタンの影を `color-mix(in srgb, var(--red) 35%, transparent)` にする
- Modify: `src/features/calendar/calendar.module.css` と `CalendarPage.tsx` の凡例
  - 強調色の濃さ 3 段階を、22% / 45% / 80% の `color-mix` にする
- Modify: `src/components/TabBar.module.css`
  - 背景を `color-mix(in srgb, var(--bg) 96%, transparent)` にする
- Modify: `src/features/workout/workout.module.css`
  - `.sugg` の背景を `color-mix(in srgb, var(--bg) 60%, black)` にする
- Modify: `src/features/progress/ProgressChart.tsx`
  - `RED` を `'var(--red)'`、点の中の `#0B0B0D` を `'var(--bg)'`、目盛り線を `'var(--line)'` にする
- Test: `src/theme.test.ts`（新規）

- [ ] **Step 1: 失敗するテストを書く**
  - `src` の `*.css` と `*.tsx` を `tokens.css` と `*.test.*` を除いて読み、次の 3 つが 0 件であること
    - `/#E10600/i`
    - `/rgba\(\s*225,\s*6,\s*0/`
    - `/background:\s*var\(--red\)[^}]*color:\s*#fff/`
- [ ] **Step 2:** FAIL になることを確かめる（今は複数のファイルで見つかる）
- [ ] **Step 3:** 上の Files のとおりに置き換える
- [ ] **Step 4:** `npx vitest run` で全部 PASS になることを確かめる。グラフのテストが色の値を見ていたら、新しい値に合わせる
- [ ] **Step 5: コミット** `feat: 強調色と背景を CSS 変数経由で全画面に反映`

### Task 4: アイコンの切り替え

**Files:**
- Modify: `package.json`（`@capacitor-community/app-icon@^7.0.0`）
- Create: `src/lib/appIcon.ts`, `src/lib/appIcon.test.ts`

**Interfaces:**
- Consumes: `IconKey`（Task 2）、`isNativeApp`（`src/lib/platform.ts`）
- Produces: `changeAppIcon(key: IconKey): Promise<'changed' | 'reinstall' | 'failed'>`

- [ ] **Step 1: インストールして、使い方を確かめる**
  - `npm i @capacitor-community/app-icon@^7.0.0` を実行する
  - `node_modules/@capacitor-community/app-icon/dist/esm/definitions.d.ts` で `isSupported` / `change({name, suppressNotification})` / `reset({suppressNotification})` の型を確かめる
  - SPM 用の `Package.swift` が入っていることを確かめる
  - 名前が違っていたら、この Task のテストを実際の型に合わせる
- [ ] **Step 2: 失敗するテストを書く**
  - プラグインと `isNativeApp` を `haptics.test.ts` と同じ形で差し替える
  - `アプリで赤なら reset`：`reset({suppressNotification:false})` が呼ばれ、`'changed'` が返る
  - `アプリで黄なら AppIcon-yellow に change`：`change({name:'AppIcon-yellow', suppressNotification:false})` が呼ばれ、`'changed'` が返る
  - `非対応なら failed`：`isSupported` が `{value:false}` なら `'failed'` が返り、change は呼ばれない
  - `失敗したら failed`：change が reject したら `'failed'` が返る
  - `Web ではプラグインを呼ばず reinstall`：`'reinstall'` が返り、プラグインは呼ばれない
- [ ] **Step 3:** FAIL になることを確かめ、実装して PASS になることを確かめる
- [ ] **Step 4:** `npm run build && npx cap sync ios` が通ること、`ios/App/CapApp-SPM/Package.swift` にプラグインが入ったことを確かめる
- [ ] **Step 5: コミット** `feat: iPhone でホーム画面のアイコンを切り替える`

### Task 5: 設定画面の「見た目」

**Files:**
- Create: `src/features/manage/AppearanceSection.tsx`, `src/features/manage/AppearanceSection.test.tsx`
- Modify: `src/features/manage/SettingsForm.tsx`（一番上に `<AppearanceSection />`）
- Modify: `src/features/manage/manage.module.css`（見本を並べるグリッドと選択中の枠）

**Interfaces:**
- Consumes: `ICONS / ACCENTS / BGS / useAppearance / setAppearance / iconUrl`（Task 2）、`changeAppIcon`（Task 4）

画面の構成：
- 見出しは「見た目」
- 3 つのグループ（`role="group"`、読み上げ名は「アイコンの色」「強調色」「背景」）
- 各選択肢は `button`（`aria-pressed`、読み上げ名は色の名前）
  - 中に見本を置く
    - アイコン：`<img src={iconUrl(key,64)} alt="">`
    - 強調色：その色の丸
    - 背景：その背景色の四角と、中に今の強調色の点
  - その下に色の名前を小さく出す
- 案内とエラーは `role="status"` で出す

- [ ] **Step 1: 失敗するテストを書く**
  - `appIcon` を差し替えておく
  - `3 つのグループに 12・9・4 個の選択肢があり、既定は赤・赤・黒が選択中`
  - `強調色の「青」を押すと --red が #3B82F6 になり保存される`
  - `背景の「紺」を押すと --bg が #0A0F1E になる`
  - `Web でアイコンの「黄」を押すと選択が黄になり「ホーム画面のアイコンをこの色にするには、ホーム画面に追加し直してください」が出る`
  - `アイコンの切り替えに失敗すると「アイコンを変えられませんでした」が出て、選択は赤に戻る`
  - `アプリで切り替えに成功すると、案内もエラーも出ない`
- [ ] **Step 2:** FAIL になることを確かめ、実装して PASS になることを確かめる
  - アイコンを選ぶ流れ：`setAppearance` で先に選択を反映する → `changeAppIcon` → `'failed'` なら前の icon に戻す
- [ ] **Step 3:** `npx vitest run` で全部 PASS になることを確かめる
- [ ] **Step 4: コミット** `feat: 設定に「見た目」（アイコンの色・強調色・背景）を追加`

### Task 6: 名前を「キントレ部」に

**Files:**
- Modify: `src/components/Brand.tsx`
  - 選んだ色の猫アイコン `iconUrl(icon,64)`（表示 `size*1.25` 四方、角丸 22%）と「キントレ部」を並べる
  - 読み上げ名は「キントレ部」
  - 文字は `var(--font-body)` の 700
- Modify: 文言の「GRIND」→「キントレ部」
  - `src/lib/share/{sharePayload,feedbackPayload,menuPayload}.ts`
  - `src/features/friends/{FriendsPage,PasteSheet,ImportPage}.tsx`
  - そのほか `grep -rn GRIND src` で出る画面の文言すべて
- Modify: `index.html`
  - `<title>キントレ部</title>`
  - `<meta name="apple-mobile-web-app-title" content="キントレ部" />` を追加
- Modify: `vite.config.ts`（`name: 'キントレ部'`, `short_name: 'キントレ部'`）
- Modify: `capacitor.config.ts`（`appName: 'キントレ部'`）
- Modify: `ios/App/App/Info.plist`（`CFBundleDisplayName` を `キントレ部`）
- Modify: `public/privacy.html`, `public/support.html`
  - タイトル、ロゴ、本文の GRIND。「設定 → 通知 → キントレ部」も含む
- Modify: `docs/app-store/listing.md`
  - アプリ名を「キントレ部 - 筋トレ記録」に
  - 説明文の GRIND
  - 見た目を選べることを説明文に 1 文足す
- Modify: `docs/app-store/ios-release.md`
  - 表示名の変更
  - 実機確認に「設定 → 見た目でアイコンの色を変えると、ホーム画面のアイコンが変わり確認が出る／赤に戻せる」を追加
  - 「アイコンは `python3 scripts/make-icons.py` で作り直せる（`npx capacitor-assets generate` は使わない。別アイコンを上書きしないため）」を追加
- Test: 既存のテストのうち、「GRIND」を期待している所を「キントレ部」に変える。`src/appConfig.test.ts` に名前のテストを足す

- [ ] **Step 1: 失敗するテストを書く**
  - `appConfig.test.ts`：`test('表に出る名前はキントレ部')`
    - `index.html` に `<title>キントレ部</title>` と `apple-mobile-web-app-title" content="キントレ部"` がある
    - `vite.config.ts` に `name: 'キントレ部'` がある
    - `capacitor.config.ts` に `appName: 'キントレ部'` がある
    - Info.plist の `CFBundleDisplayName` が `キントレ部`
    - `public/*.html` に `GRIND` が無い
  - `test('画面と共有メッセージに GRIND が残っていない')`
    - `src` の `.ts` と `.tsx`（テストを除く）に `/GRIND/` が無い
  - 共有メッセージのテストの期待値を「キントレ部 の記録です…」などに変える
- [ ] **Step 2:** FAIL になることを確かめる
- [ ] **Step 3:** 上の Files を書き換える
  - 共有メッセージは「キントレ部 の記録です（…）。キントレ部 の『友達』タブに貼り付けてね」のように、今の文の GRIND だけを置き換える
- [ ] **Step 4:** `npx vitest run` で全部 PASS になること、`npm run build` が通ることを確かめる
- [ ] **Step 5: コミット** `feat: アプリ名をキントレ部に変更し、ロゴを猫アイコンに`

### Task 7: 画面の目視確認と仕上げ

**Files:**
- Create: scratchpad の Playwright スクリプト（リポジトリには入れない）

- [ ] **Step 1:** `npm run build && npx vite preview` を起動する
- [ ] **Step 2: 画面を撮る**
  - 375×812 の画面で、localStorage に見た目の設定を入れてから開く
  - 組み合わせ（強調色/背景）：`red/black`、`yellow/black`、`mint/navy`、`purple/forest`、`sky/brown`
  - 画面：ホーム、記録中（セットを 1 つ完了、主ボタン・PR バッジが見える状態）、カレンダー、グラフ、設定の「見た目」
- [ ] **Step 3: 撮った画像を確かめる**
  - 強調色の上の文字が読めること
  - 赤のままの所が残っていないこと（エラー・削除の赤系は除く）
  - 横スクロールがないこと（`scrollWidth <= 375`）
  - 問題があれば直し、Task 3 のテストに足す
- [ ] **Step 4:** `npx vitest run`、`npm run build`、`npx cap sync ios` がすべて通ることを確かめる
- [ ] **Step 5: コミット**（直しがあれば） `fix: 見た目の組み合わせごとの表示を調整`
