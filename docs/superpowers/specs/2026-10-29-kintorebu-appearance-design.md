# キントレ部 — 名前・猫アイコン・見た目の設定 設計仕様

- 作成日: 2026-10-29
- ステータス: レビュー待ち
- 前提: 既存の GRIND（React 18 + TypeScript + Vite PWA、Dexie、HashRouter、Capacitor 8 の iPhone アプリ）。これまでの仕様の機能はすべてそのまま

## 1. 目的

アプリの名前を「キントレ部」に変え、アイコンを「はちまきの白い猫がバーベルを持つ絵」にする。さらに、アイコンの色と画面の色を利用者が自分で選べるようにする。

ユーザーが決めたこと:
- 名前は「キントレ部」
- アイコンは猫の絵。最初の色は赤。12 色から選べる
- 画面は最初は今の赤×黒。強調色と背景を選べる
- アイコンの色と画面の色は**別々に**選ぶ
- 背景は暗い色の中からだけ選ぶ（明るい背景は今回は作らない）
- 猫の絵は、もらった小さい画像（約 260px）から切り抜いて拡大したものを使う。大きい元画像が手に入ったら差し替えられるようにしておく

成功基準:
- 表に出る名前がすべて「キントレ部」になる（ホーム画面、タブ、iPhone の表示名、共有メッセージ、公開ページ、ストア文面）
- 「管理 → 設定 → 見た目」で、アイコンの色・強調色・背景を選ぶと、画面がすぐ変わり、開き直しても残る
- どの強調色 × 背景の組み合わせでも、ボタンの文字や数字が読める
- iPhone アプリでは、ホーム画面のアイコンが選んだ色に変わる（Mac での実機確認）
- 今ある記録・友達・設定は消えない。テストがすべて通る

## 2. 対象外

- 明るい背景（白・クリームなど）
- 友達との自動共有・グループ（別の作業として後で設計する）
- Android の Chrome でホーム画面のアイコンを変えること（できない。赤のまま）
- 内部の識別子の変更: データベース名・バックアップの `app` 欄・localStorage のキーの `ironlog` と、Bundle ID `io.github.zwjjpy677njpg.grind` は変えない

## 3. 名前

- 次の「GRIND」を「キントレ部」に変える:
  - `index.html` の `<title>`（ホーム画面の名前用に `apple-mobile-web-app-title` も足す）
  - `vite.config.ts` の manifest の `name` / `short_name`
  - `capacitor.config.ts` の `appName`、`ios/App/App/Info.plist` の `CFBundleDisplayName`
  - 共有メッセージ（`sharePayload.ts`、`feedbackPayload.ts`、`menuPayload.ts` など）、画面の文言（`FriendsPage`、`PasteSheet`、`ImportPage` など）
  - `public/privacy.html`、`public/support.html`、`docs/app-store/listing.md`（アプリ名「キントレ部 - 筋トレ記録」）、`docs/app-store/ios-release.md`
- ロゴ（`Brand`）: 小さい猫のアイコン（選んだアイコンの色）＋「キントレ部」。読み上げ名は「キントレ部」
- 古い版の共有リンクは今までどおり読み込める（リンクの形式は変えない）

## 4. 猫のアイコン

### 4.1 画像

- 元: 切り抜いた猫（透過 PNG）を `assets/cat.png` に置く
- 生成スクリプト `scripts/make-icons.py`（Python + Pillow + NumPy）: `assets/cat.png` から各色のアイコンを作る
  - 1024×1024、透過なし、角は丸めない（丸めは OS が行う）
  - 背景は色ごとのグラデーション（左上が明るく右下が少し暗い）、バーベルの下に薄い影
  - 猫は幅 86%、中央より少し下
- 元画像を差し替えたら、スクリプトを再実行するだけで全部作り直せる
- 12 色:

| キー | 名前 | 色 |
|---|---|---|
| red | 赤 | #E5262B |
| yellow | 黄 | #FFC21A |
| orange | オレンジ | #FF8A1F |
| pink | ピンク | #FF85B3 |
| purple | 紫 | #9B5CF6 |
| blue | 青 | #2F7FEB |
| sky | 水色 | #55C8F5 |
| mint | ミント | #5ED6B4 |
| green | 緑 | #3DBE57 |
| navy | 紺 | #1E2A4A |
| black | 黒 | #141418 |
| cream | クリーム | #FBEFD5 |

### 4.2 置き場所

- `assets/icon.png` = 赤（App Store・iPhone の標準アイコン）
- `public/icons/<key>-180.png`（ホーム画面用）と `public/icons/<key>-64.png`（ロゴ・設定の選択肢用）を 12 色ぶん
- `public/apple-touch-icon.png`、`public/icon-192.png`、`public/icon-512.png` = 赤
- iPhone: `ios/App/App/Assets.xcassets/AppIcon.appiconset` = 赤。ほかの 11 色は `AppIcon-<key>.appiconset`（1024 の 1 枚）として同じ所に置き、ビルド設定 `ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES` で取り込む

## 5. 見た目の設定

### 5.1 保存

- `src/lib/appearance.ts`
  - `type Appearance = { icon: IconKey; accent: AccentKey; bg: BgKey }`
  - 既定値 `{ icon: 'red', accent: 'red', bg: 'black' }`
  - `getAppearance()` / `setAppearance(a)`: localStorage の `ironlog:appearance` に保存（端末ごと。バックアップには含めない）。読めない・壊れている・知らないキーのときは、その項目を既定値にする
  - `applyAppearance(a)`: 下の CSS 変数を `document.documentElement` に設定し、`<meta name="theme-color">` を背景色にし、`<link rel="apple-touch-icon">` を選んだ色のアイコンにする
- `main.tsx` で、最初の描画の前に `applyAppearance(getAppearance())` を呼ぶ（赤が一瞬見えることがない）

### 5.2 強調色（9 色）

- 変数: `--red`（名前は変えない。今のコードがそのまま使える）、`--red-soft`（15% の薄い色）、`--on-accent`（強調色の上の文字色）
- 明るい強調色の上は黒い文字、それ以外は白い文字にする

| キー | 色 | 上の文字 |
|---|---|---|
| red | #E10600（今と同じ） | 白 |
| yellow | #FFC21A | 黒 #111 |
| orange | #FF8A1F | 黒 #111 |
| pink | #FF6FA8 | 黒 #111 |
| purple | #A26BFA | 白 |
| blue | #3B82F6 | 白 |
| sky | #38BDF8 | 黒 #111 |
| mint | #34D3A6 | 黒 #111 |
| green | #22C55E | 黒 #111 |

### 5.3 背景（4 種類）

| キー | 名前 | --bg | --surface | --surface2 | --line |
|---|---|---|---|---|---|
| black | 黒 | #0B0B0D | #16161A | #1F1F25 | #2A2A31 |
| navy | 紺 | #0A0F1E | #131A2C | #1B2338 | #283149 |
| brown | こげ茶 | #120D0A | #1D1612 | #271E18 | #362A22 |
| forest | 深緑 | #08120E | #111D18 | #182821 | #22362D |

文字の色（`--text`、`--muted`）はどの背景でも同じ。

### 5.4 直接書かれている色の置き換え

- 強調色の上の `color: #fff` → `color: var(--on-accent)`（ボタン、選択中のタブ・チップ、PR バッジ、完了ボタン、レスト終了表示など）
- 強調色の影や薄い色 `rgba(225, 6, 0, …)` → `color-mix(in srgb, var(--red) N%, transparent)`（主ボタンの影、カレンダーの濃さ 3 段階と凡例）
- グラフ（`ProgressChart`）の `#E10600` → `var(--red)`、点の中の `#0B0B0D` → `var(--bg)`、目盛り線 `#2A2A31` → `var(--line)`
- タブバーの `rgba(14, 14, 17, .96)` → `color-mix(in srgb, var(--bg) 96%, transparent)`
- 提案カードの `#050506` → `color-mix(in srgb, var(--bg) 60%, black)`
- そのまま残す: エラー・削除の赤系（`#ff6b66`、`#5a1d1d` など）、注意の黄色（`#f5b041`）、プレートの色、成功の緑（`--green`）

### 5.5 設定画面

「管理 → 設定」の一番上に「見た目」の欄を足す:
- 「アイコンの色」: 12 色の猫のアイコンを並べ、押して選ぶ（選択中は枠で示す。`aria-pressed`、読み上げ名は色の名前）
- 「強調色」: その色で塗った 9 個の丸を並べて選ぶ
- 「背景」: その背景色で塗った 4 個の四角を並べて選ぶ（中に今の強調色の小さな点を入れ、組み合わせが分かるようにする）
- どの選択肢も、色そのもの（見本）と、その下に小さく色の名前（「赤」「黄」など）を出す。選択中は枠で示す
- 選ぶとすぐ反映し、保存する

## 6. アイコンの切り替え

- `src/lib/appIcon.ts`: `changeAppIcon(key): Promise<'changed' | 'reinstall' | 'failed'>`
  - iPhone アプリ: `@capacitor-community/app-icon`（7.x、Capacitor 8 対応）を使う。赤なら `reset()`、ほかは `change({ name: 'AppIcon-<key>' })`。iPhone が「アイコンを変更しました」と表示する（消せない）。成功で `'changed'`
  - 対応していない端末や失敗したとき: `'failed'`
  - Web 版: ホーム画面用アイコンの link を差し替えて `'reinstall'`
- 設定画面での表示:
  - `'reinstall'` → 「ホーム画面のアイコンをこの色にするには、ホーム画面に追加し直してください」
  - `'failed'` → 「アイコンを変えられませんでした」と出し、選択を前の色に戻す

## 7. エラー処理

| 状況 | 動き |
|---|---|
| 保存した見た目の設定が壊れている | その項目を既定値にする |
| localStorage が使えない | 既定値で表示し、選んだ色はその間だけ反映 |
| アイコンの切り替えに失敗 | 「アイコンを変えられませんでした」。選択を戻す |
| Web 版でアイコンを選んだ | 追加し直しの案内を出す |

## 8. テスト

- `appearance`: 既定値、保存と読み込み、壊れた値・知らないキーは既定値に、`applyAppearance` で CSS 変数・theme-color・apple-touch-icon が変わる
- `appIcon`: アプリでは赤で `reset`、ほかで `change`（プラグインは偽物に差し替え）、失敗で `'failed'`、Web では `'reinstall'`
- 設定画面: 選ぶと反映・保存、Web 版でアイコンを選ぶと案内が出る、失敗すると戻る
- 名前: 画面と共有メッセージが「キントレ部」。manifest・index.html・capacitor.config・Info.plist の名前を確かめる設定テスト（`appConfig.test.ts`）
- Info.plist やビルド設定に別アイコンの設定が入っていることを確かめる
- Playwright: 9 強調色 × 4 背景のうち代表の組み合わせでホーム・記録・設定の画面を撮り、文字が読めるか目で確かめる。375px で横スクロールがないこと
- iPhone での別アイコン切り替えは、Mac で手順書の確認項目に沿ってユーザーが確かめる
