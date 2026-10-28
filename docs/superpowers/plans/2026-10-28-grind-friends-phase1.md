# GRIND 友達との記録共有（第1弾） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自分の直近8週間の記録をリンクにして LINE で送り、受け取った友達の記録を「友達」タブで週ごと・種目ごと（グラフ付き）に見られるようにする。

**Architecture:** 記録をコンパクトな JSON にして `deflate-raw` で圧縮し、base64url で URL の `#/friends/add?d=` に入れる（サーバーなし）。受け取った記録は Dexie v3 の `friends` / `friendWorkouts` に、既存の `Workout` / `Exercise` と同じ形で保存し、`progressSeries`・`summarizeSets`・`ProgressChart` をそのまま使う。自分の記録とは別テーブルで、混ぜない。

**Tech Stack:** React 18 + TypeScript + Vite PWA、HashRouter、Dexie 4、Recharts、CSS Modules、Vitest + Testing Library + fake-indexeddb

**Spec:** `docs/superpowers/specs/2026-10-28-grind-friends-design.md`（§1〜§7、§10、§11 の第1弾部分。§8・§9 は第2弾で別計画）

## Global Constraints

- リンク: `https://zwjjpy677n-jpg.github.io/workout-app/#/friends/add?d=<データ>`。`<データ>` = 種類 `r` ＋ 版 `1` ＋ base64url(deflate-raw(JSON))。リンクは `location.origin + location.pathname + '#/friends/add?d='` で組み立てる（開発環境でも動く）
- リンク全体で **7,500 文字**以内。超えたら古い週（7日単位）から削る。1週間でも超えたら「記録が多すぎて共有できません」
- 期間は共有時点から直近 **56日**。終了済みの記録の、本番セット（`done && !warmup`）だけ
- **送らない**: 体重・体脂肪率・コンディション・記録のメモ・セットのメモ・ウォームアップ・未完了セット・target・slowed・プログラム／テスト
- 自分の ID: ランダム12文字（英数字）。名前は 1〜20 文字。`settings` の `{ key: 'profile', id, name }`
- 短い ID = uuid の先頭8文字。友達側の ID は `${friendId}:${id8}`
- 受け取りの値の範囲: 名前 1〜40、種目名 1〜40、重量 −200〜1000、回数 0〜999、秒 0〜36000、RPE 1〜10、配列上限 種目 300・記録 500・メニュー 30（1つでも外れたら拒否）
- 友達のデータはバックアップに含めない。`profile` だけ含める（`BackupData.profile?`、無いバックアップも読める）
- Dexie version 3 で `friends: 'id'`, `friendWorkouts: 'id, friendId, startedAt'`, `feedbackIn: 'id, friendId, workoutId, at'`, `feedbackOut: 'id, friendId, sentAt'`, `menuLog: 'id, friendId, at'` を追加（後の3つは第2弾用の空テーブル）
- 文言はスペックのとおり（下の各タスクに書いたものをそのまま使う）
- 内部の識別子 `ironlog`（DB名・バックアップの `app`・localStorage キー）は変えない

## Review Focus

1. LINE からコピーした文に、添えた文・改行・前後の空白がついたまま貼られる → `d=` 以降を取り出して読める（Task 1 のテストで固定）
2. 同じリンクを2回貼る、または週1回で8週間ぶんが重なって届く → 記録が重複せず、送られてこなかった古い記録は残る（Task 4）
3. 進行中の記録・ウォームアップしかない種目・8週間より前の記録がある → リンクに入らない（Task 2）
4. 名前が同じでも ID が違う友達 → 別の友達として2人並ぶ（Task 4）
5. 細工された巨大・範囲外の値のリンク → 拒否して何も保存しない（Task 3）

---

### Task 1: リンクの符号化（codec）

**Files:**
- Create: `src/lib/share/codec.ts`
- Test: `src/lib/share/codec.test.ts`
- Modify: `src/test/setup.ts`（jsdom に無い `CompressionStream` / `DecompressionStream` を `node:stream/web` から補う）

**Interfaces:**
- Produces:
  - `type ShareKind = 'r' | 'f' | 'm'`
  - `encodeShare(kind: ShareKind, data: unknown): Promise<string>` → `<データ>`（種類＋版`1`＋base64url）
  - `decodeShare(text: string): Promise<{ kind: ShareKind; data: unknown }>` — 貼り付けた文全体を受け取り、`d=` があればその後ろ（空白・改行まで）を、無ければ空白を除いた全体を `<データ>` とみなす
  - `class ShareError extends Error { code: 'invalid' | 'newer' | 'unsupported' }`
  - `shareUrl(data: string): string` → `location.origin + location.pathname + '#/friends/add?d=' + data`
  - `canCompress(): boolean`

- [ ] **Step 1: 失敗するテストを書く**

```ts
test('往復で同じ内容に戻る', async () => {
  const d = { a: [1, null, 'ベンチ'], b: 'x'.repeat(500) };
  const s = await encodeShare('r', d);
  expect(s.startsWith('r1')).toBe(true);
  expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(await decodeShare(s)).toEqual({ kind: 'r', data: d });
});
test('リンク全体・添えた文・改行つきの貼り付けでも読める', async () => {
  const s = await encodeShare('r', { ok: 1 });
  const pasted = `GRIND の記録です（10/21〜10/27・4回分）。\n${shareUrl(s)}\n `;
  expect((await decodeShare(pasted)).data).toEqual({ ok: 1 });
});
test('壊れた入力は invalid、版が新しすぎると newer', async () => {
  await expect(decodeShare('こんにちは')).rejects.toMatchObject({ code: 'invalid' });
  await expect(decodeShare('r1@@@')).rejects.toMatchObject({ code: 'invalid' });
  await expect(decodeShare('x1AAAA')).rejects.toMatchObject({ code: 'invalid' });
  await expect(decodeShare('r9AAAA')).rejects.toMatchObject({ code: 'newer' });
});
```

- [ ] **Step 2: `npx vitest run src/lib/share/codec.test.ts` → モジュールが無くて FAIL**
- [ ] **Step 3: 実装する。** 圧縮は `CompressionStream('deflate-raw')` に `TextEncoder` のバイトを writer で書き、reader で読み切る（`Blob.stream` は jsdom に無いので使わない）。base64url は `btoa`／`atob` を 0x8000 バイトずつ。版の数字が `1` より大きければ `newer`、種類が `r|f|m` 以外・base64 や展開や JSON.parse に失敗したら `invalid`。`canCompress()` が false のとき encode/decode は `unsupported`
- [ ] **Step 4: テストが通ることを確認**
- [ ] **Step 5: Commit** — `feat: 共有リンクの符号化（deflate-raw + base64url）`

### Task 2: 送る記録の組み立て（sharePayload）

**Files:**
- Create: `src/lib/share/sharePayload.ts`
- Test: `src/lib/share/sharePayload.test.ts`

**Interfaces:**
- Consumes: `encodeShare`, `shareUrl`（Task 1）, `topSet`, `isWorking`（calc）, `completed`（summary）
- Produces:
  - `type SetTuple = [number | null, number | null, number | null, number | null]`
  - `type SharePayload = { id: string; n: string; at: number; x: [string, string, number, number][]; w: [string, number, string, [number, SetTuple[]][]][]; r: [string, number, [number, number, string, 0 | 1][]][]; p: [number, SetTuple][] }`（スペック §4.2）
  - `buildSharePayload(src: { profile: { id: string; name: string }; exercises: Exercise[]; routines: Routine[]; workouts: Workout[] }, now: number, days = 56): SharePayload`
  - `buildShareLink(src, now): Promise<{ text: string; weeks: number; trimmed: boolean; count: number; from: number; to: number }>` — 56日から7日ずつ減らして、`shareUrl(...)` が 7,500 文字以内に収まる最長を選ぶ。1週間でも超えたら `ShareError('too-large')`（Task 1 の `code` に `'too-large'` を追加）。`text` は「GRIND の記録です（M/D〜M/D・N回分）。GRIND の『友達』タブに貼り付けてね\n<リンク>」

- [ ] **Step 1: 失敗するテストを書く**（`ex`, `wk`, `entry`, `set`, `routine`, `item` は `src/test/factories`）
  - `入れるのは56日以内・終了済み・本番セットだけ`: 57日前の記録、`endedAt: null` の記録、ウォームアップだけの種目、`done:false` のセットが `w` に無い。残った記録の `w[i][3]` は本番セットの `[weight, reps, durationSec, rpe]` だけ
  - `送らない項目が入らない`: 記録に `note`・`condition`・セットの `note`・`target`・`slowed` を入れても `JSON.stringify(payload)` にそのメモ文字列・`slowed`・`sleep` が含まれない
  - `種目は参照されるものだけ、短いIDは先頭8文字`: 使っていない種目は `x` に無い。`x[0][0] === exercise.id.slice(0, 8)`、部位とタイプは番号
  - `メニューと自己ベスト`: 曜日 null は `-1`、`p` は全期間（57日前の記録も含めた）`topSet`
  - `長すぎると古い週から削る`: 種目40・1日8種目×5セットの記録を56日毎日作ると `trimmed: true`・`weeks < 8`・`text.length` のうちリンク部分が 7,500 以下
  - `普通の量なら8週間ぶん収まる`: 週4回 × 8週・1回8種目×4セット（重量は 20〜200 のランダム、RPE あり）で `trimmed: false`, `weeks: 8`（この値を実測してコミットメッセージに文字数を書く）
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**（純粋関数。時刻は分単位 `Math.floor(ms / 60000)`）
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: 共有する記録の組み立て（8週間・本番セットのみ・長さ制限）`

### Task 3: 受け取った記録の検証と変換（importShare）

**Files:**
- Create: `src/lib/share/importShare.ts`
- Test: `src/lib/share/importShare.test.ts`

**Interfaces:**
- Consumes: `SharePayload`, `SetTuple`（Task 2）, `BODY_PARTS`, `emptyCondition`（types）
- Produces:
  - `interface Friend { id: string; name: string; receivedAt: number; sharedAt: number; exercises: Exercise[]; routines: Routine[]; prs: { exerciseId: string; set: WorkoutSet }[] }`
  - `interface FriendWorkout extends Workout { friendId: string }`
  - `parseSharePayload(data: unknown): SharePayload` — 型と値の範囲（Global Constraints）を確認し、外れたら `ShareError('invalid')`
  - `toFriendRecords(p: SharePayload, receivedAt: number): { friend: Friend; workouts: FriendWorkout[] }` — 種目 `id = ${p.id}:${id8}`、`restSec 0, archived false, barKg null, createdAt 0`。記録 `id = ${p.id}:${wid8}`, `startedAt = start*60000`, `endedAt = startedAt`, `note ''`, `condition` 空, `routineId null`, セットは `{ weight, reps, durationSec, rpe, warmup: false, note: '', done: true }`。メニュー `id = ${p.id}:r${i}`, `weekday -1 → null`, items の `inc 0, note ''`

- [ ] **Step 1: 失敗するテストを書く**
  - `Task 2 で作った payload を変換すると元の本番セット・種目名・メニューが戻る`（`buildSharePayload` → JSON 往復 → `parseSharePayload` → `toFriendRecords`）
  - `範囲外・型違い・巨大な配列は invalid`: 重量 1001、回数 -1、RPE 11、名前 ''、名前41文字、種目 301 個、`x` の番号を超える `xi`、`w` が配列でない → すべて `rejects/throws` `{ code: 'invalid' }`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: 受け取った記録の検証と友達データへの変換`

### Task 4: DB version 3・プロフィール・友達の保存

**Files:**
- Modify: `src/db/db.ts`（version 3、テーブル追加、`SettingsRow` に `{ key: 'profile'; id: string; name: string }`）
- Create: `src/db/friends.ts`
- Modify: `src/lib/backup.ts`, `src/db/repository.ts`（export/import に `profile`）, `src/hooks/useData.ts`
- Test: `src/db/friends.test.ts`, `src/lib/backup.test.ts`, 既存の移行テスト（`src/db/*.test.ts` の v1→v2 と同じ書き方で v2→v3）

**Interfaces:**
- Consumes: `Friend`, `FriendWorkout`, `toFriendRecords`（Task 3）
- Produces（`src/db/friends.ts`）:
  - `getProfile(): Promise<{ id: string; name: string } | null>`, `saveProfileName(name: string): Promise<{ id: string; name: string }>`（ID が無ければ作る）
  - `listFriends(): Promise<(Friend & { lastAt: number | null; count: number })[]>`（`receivedAt` の新しい順）
  - `getFriend(id): Promise<Friend | undefined>`, `listFriendWorkouts(friendId): Promise<FriendWorkout[]>`（新しい順）
  - `previewImport(p: SharePayload): Promise<{ existing: Friend | undefined; newCount: number; total: number; from: number; to: number }>`
  - `saveImportedShare(p: SharePayload, now: number): Promise<void>` — 1トランザクション。記録は `id` で put（貯める）。`p.at*60000 >= 保存済み sharedAt` のときだけ名前・種目・メニュー・自己ベスト・sharedAt を置き換える。`receivedAt` は常に更新
  - `deleteFriend(id): Promise<void>`（友達と記録をまとめて）
  - `useData.ts` に `useFriends()`, `useFriend(id)`, `useFriendWorkouts(id)`

- [ ] **Step 1: 失敗するテストを書く**
  - `同じリンクを2回保存しても記録は重複しない`
  - `新しいリンクで記録が増え、送られてこなかった古い記録は残る`（1回目: 記録 A,B / 2回目: B（内容変更）,C → A,B(新),C）
  - `古いリンクを後から貼ると記録だけ増え、名前やメニューは新しい方のまま`
  - `名前が同じでも ID が違えば別の友達`
  - `削除すると友達と記録が消え、自分の workouts は変わらない`
  - `saveProfileName は初回だけ12文字の ID を作り、2回目は名前だけ変える`
  - 移行: version 2 の DB（記録あり）を開くと version 3 になり、既存の記録・種目が変わらない
  - バックアップ: `profile` が書き出され、読み込める。`profile` の無いバックアップも読める。友達テーブルは書き出されない
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: `npx vitest run` 全体が PASS、`npm run lint` がクリーン**
- [ ] **Step 5: Commit** — `feat: 友達の記録を保存するテーブル（DB v3）とプロフィール`

### Task 5: 「友達」タブ（共有・名前・貼り付け）

**Files:**
- Modify: `src/components/TabBar.tsx`（ホーム・カレンダー・グラフ・**友達**・管理。友達のアイコンは人2人の線画）, `src/App.tsx`（`/friends` をタブの中に、`/friends/add`・`/friends/:id`・`/friends/:id/exercise/:exerciseId` もタブの中に）
- Create: `src/features/friends/FriendsPage.tsx`, `NameSheet.tsx`, `PasteSheet.tsx`, `useShareMine.ts`, `friends.module.css`
- Test: `src/features/friends/FriendsPage.test.tsx`

**Interfaces:**
- Consumes: `buildShareLink`（Task 2）, `decodeShare`, `ShareError`（Task 1）, `getProfile`, `saveProfileName`, `useFriends`（Task 4）
- Produces: `PasteSheet` は読めたら `navigate('/friends/add?d=' + <データ>)` する（確認画面は Task 6）

画面と文言（スペック §6.2）:
- 「自分の記録を共有」（赤の大きいボタン）→ プロフィールが無ければ `NameSheet`（見出し「友達に表示する名前」、1〜20文字、「保存」）→ 共有
  - 削ったとき: `window.confirm('直近N週ぶんを共有します')`、キャンセルなら中止
  - `navigator.share({ text })`。無い／`AbortError` 以外で失敗したら `navigator.clipboard.writeText(text)` → 「コピーしました。LINE に貼り付けて送ってください」。`AbortError` は何も出さない
  - エラー: 「記録が多すぎて共有できません」／「この端末では共有を使えません」
- 「リンクを貼り付けて追加」→ `PasteSheet`（`textarea` aria-label「リンク」、`navigator.clipboard.readText` があれば「クリップボードから貼り付け」、「読み込む」）。読めなければ「読み込めないリンクです」／「GRIND を最新にしてから貼り付けてください」
- 友達の一覧: 名前・「最後のトレーニング M/D」・「受け取り M/D」→ `/friends/:id`。0人のとき「まだ友達がいません。友達に GRIND の記録を送ってもらって、ここに貼り付けてください」
- 「名前を変える」→ `NameSheet`

- [ ] **Step 1: 失敗するテストを書く**
  - `初回は名前を聞いてから共有画面を出す`（`navigator.share` を `vi.fn` にし、`text` に「GRIND の記録です」とリンク `#/friends/add?d=r1` が入る。`getProfile()` に名前が保存される）
  - `共有が無い端末ではコピーして知らせる`
  - `共有をキャンセルしても何も出ない`（`AbortError`）
  - `貼り付けて読み込むと確認画面へ移る`（`location` が `/friends/add?d=r1...`）、`壊れたリンクは「読み込めないリンクです」`
  - `友達がいないときの案内` と `一覧に名前・最後のトレーニング・受け取り日`
  - `下のタブが5つで「友達」がある`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: 友達タブ（自分の記録を共有・名前・リンクの貼り付け）`

### Task 6: 受け取りの確認画面

**Files:**
- Create: `src/features/friends/ImportPage.tsx`
- Test: `src/features/friends/ImportPage.test.tsx`

**Interfaces:**
- Consumes: `decodeShare`（Task 1）, `parseSharePayload`（Task 3）, `previewImport`, `saveImportedShare`, `getProfile`（Task 4）

画面と文言（スペック §6.3）:
- 「〇〇さんの記録（N回分・M/D〜M/D）」「種目 X ・ メニュー Y」
- すでにいる友達: 「前回の受け取り M/D。新しい記録 N回分が追加されます」
- 「保存」→ 保存して `/friends/:id`。「やめる」→ `/friends`
- 自分の ID と同じ: 「自分の記録です」（保存ボタンなし）
- 種類が `f`／`m`: 「このアプリではまだ読み込めません。GRIND を最新にしてください」（第2弾で置き換える）
- 読めない: 「読み込めないリンクです」
- 下に小さく: 「ホーム画面に追加した GRIND で使うには、このリンクをコピーして『友達』タブに貼り付けてください」
- 保存失敗: 「保存できませんでした。もう一度お試しください」

- [ ] **Step 1: 失敗するテストを書く**（`renderRoute('/friends/add?d=' + data, '/friends/add', <ImportPage />)`）
  - `初めての友達: 件数と期間を出し、保存すると詳細へ`
  - `2回目: 前回の受け取りと新しい記録の数`
  - `自分の記録は保存できない`
  - `壊れたリンク`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: 受け取った記録の確認と保存`

### Task 7: 友達の詳細（週ごとの記録・種目・メニュー・削除）

**Files:**
- Create: `src/lib/share/friendWeeks.ts`（純粋関数）, `src/features/friends/FriendPage.tsx`, `FriendWeeks.tsx`, `FriendExercises.tsx`, `FriendMenus.tsx`
- Test: `src/lib/share/friendWeeks.test.ts`, `src/features/friends/FriendPage.test.tsx`

**Interfaces:**
- Consumes: `useFriend`, `useFriendWorkouts`, `deleteFriend`（Task 4）, `startOfWeek`, `endOfWeek`, `formatMD`, `formatMDW`（dates）, `workoutVolume`（summary）, `volumeParts`, `formatSet`（calc）, `summarizeSets`（calendar）
- Produces: `friendWeeks(workouts: FriendWorkout[], exercises: Map<string, Exercise>): { start: number; end: number; days: number; volume: number; workouts: FriendWorkout[] }[]`（新しい週から。記録の無い週は出さない。`days` は日付の種類数）

画面（スペック §6.4）:
- 上部: 名前、「受け取り M/D ・ 記録 N回分」、「…」→「この友達を削除」（`confirm('〇〇さんと受け取った記録を削除しますか？')`）→ `/friends`
- 切り替え（`role="tab"`）: 記録 / 種目 / メニュー
- 記録: 週見出し「M/D〜M/D ・ N日 ・ 12.3t」、日ごとに「M/D（曜） メニュー名」と種目ごとの「種目名 summarizeSets」
- 種目: 最後にやった日の新しい順。名前・部位・自己ベスト `formatSet`・「最後 M/D」→ `/friends/:id/exercise/:exerciseId`
- メニュー: 曜日順（なしは最後）。メニュー名・曜日・種目ごとに「Nセット×目標」、メイン種目に「メイン」

- [ ] **Step 1: 失敗するテストを書く**
  - `friendWeeks`: 月曜はじまりで分かれる・同じ日の2回は1日と数える・総ボリュームは重量種目の本番セットの合計
  - 画面: `週の見出しと日ごとの記録が新しい順に出る`、`種目タブで自己ベストと最後の日、押すとグラフの URL へ`、`メニュータブで曜日順`、`削除すると一覧へ戻り、友達が消える`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: 友達の記録を週ごと・種目・メニューで見る`

### Task 8: 友達の種目グラフ

**Files:**
- Create: `src/features/friends/FriendExercisePage.tsx`
- Test: `src/features/friends/FriendExercisePage.test.tsx`

**Interfaces:**
- Consumes: `progressSeries`, `METRICS`, `RANGES`, `Range`, `Metric`（progress）, `ProgressChart`（progress）, `useFriend`, `useFriendWorkouts`（Task 4）, `summarizeSets`, `formatSet`

画面（スペック §6.5）: 見出し「〇〇さん ・ 種目名」、指標の切り替え（自分の「グラフ」タブと同じ部品・同じラベル）、期間 1か月/3か月/1年/全期間、グラフ、自己ベスト、直近5回（日付と `summarizeSets`）。友達や種目が無ければ `/friends` へ。

- [ ] **Step 1: 失敗するテストを書く** — `重量種目は推定1RM・最大重量・ボリュームを切り替えられ、直近の記録が5回出る`、`自重種目は最大加重・総回数`、`存在しない種目は友達タブへ戻る`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**（自分の `ProgressPage` の指標・期間の切り替え部分が共通化できるなら、小さな部品に切り出して両方で使う）
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: 友達の種目ごとの推移グラフ`

### Task 9: 通しの確認

**Files:** なし（問題があれば該当タスクのファイルを直す）

- [ ] **Step 1:** `npm run lint`・`npx vitest run`・`npm run build` がすべて成功
- [ ] **Step 2:** `npx vite preview` を Playwright（375px と 390px）で開き、次を確認してスクリーンショットを撮る: 下の5タブの文字が切れない／友達タブ／自分の記録を共有（`navigator.share` を消して「コピーしました」）／コピーしたリンクを別のブラウザコンテキスト（＝別の端末）で貼り付け→確認→保存→詳細の3タブ→種目グラフ／横スクロールが無い／コンソールエラーが無い
- [ ] **Step 3:** 実際の量の目安（週4回×8週・1回8種目×4セット）でリンクが何文字になるかを記録し、PR の説明に書く
- [ ] **Step 4: Commit**（直したものがあれば）
