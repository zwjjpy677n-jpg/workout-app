# GRIND 友達とのフィードバック・メニュー送信（第2弾） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 友達の記録にコメントを付けてリンクで送り返し、相手のカレンダーに表示する。友達のメニューを一から組んで（レスト付き）送り、相手は確認して置き換え／追加する。

**Architecture:** 第1弾と同じ「圧縮 JSON を URL の `#` 以降に入れて LINE で送り、貼り付けて読む」仕組みに、種類 `f`（フィードバック）と `m`（メニュー）を足す。送る側は Dexie v3 で用意済みの `feedbackOut` / `menuLog`、受け取る側は `feedbackIn` / `menuLog` と既存の `exercises` / `routines` に保存する。メニューごとのレストは `RoutineItem.restSec` → 記録開始時に `EntryTarget.restSec` へ写し、記録画面は `target.restSec ?? exercise.restSec` を使う。

**Tech Stack:** React 18 + TypeScript + Vite PWA、HashRouter、Dexie 4、CSS Modules、Vitest + Testing Library + fake-indexeddb

**Spec:** `docs/superpowers/specs/2026-10-28-grind-friends-design.md`（§4.3・§4.4・§5 の第2弾部分・§8・§9・§10・§11 の第2弾部分）

## Global Constraints

- 第1弾の仕組みを使う: `encodeShare` / `decodeShare` / `shareData` / `shareUrl` / `ShareError`（`src/lib/share/codec.ts`）、`sendText`（`src/features/friends/useShareMine.ts`）、`MAX_LINK = 7500`、`LIMIT`（`sharePayload.ts`）
- **iPhone の共有はタップ直後でないと出せない**: リンクは前もって作っておき、ボタンの onClick の中で同期的に `navigator.share` を呼ぶ（第1弾 Task 5 の Ruling）。押してから `await` でリンクを作ってはいけない
- 送る側に自分の名前（プロフィール）が無ければ、第1弾の `NameSheet` で先に名前を保存させる
- 宛先 `to` が自分の ID でない、または自分に ID が無いときは保存しない（「あなた宛てではないフィードバックです」「あなた宛てではないメニューです」）
- コメント 1〜300 文字、1つのリンクのコメントは最大 50 件
- メニュー: 名前 1〜40、曜日 −1〜6、種目 1〜50 件、種目名 1〜40、セット 1〜20、目標の表記 0〜20、レスト 10〜600 秒、上げ幅 0〜20、メモ 0〜100
- 友達に送るメニューは**一から作る**。レストは −/＋ で 15 秒刻み、初期値 90 秒
- 受け取ったメニューの種目は**名前（前後の空白を除いて完全一致）**で自分の種目に合わせ、無ければ作る（作る種目の `restSec` は送られてきた値）。既存の種目のレスト設定は変えない
- メニューを置き換えても `Routine.id` は変えない。過去の記録は変わらない
- 内部の識別子 `ironlog` は変えない

## Review Focus

1. 同じフィードバック／メニューのリンクを2回貼る → 重複しない／「このメニューは受け取り済みです」（Task 5・Task 7）
2. コメント先の記録を消してからフィードバックを貼る → 保存され、「届いたフィードバック」に残る（Task 5）
3. 共有をキャンセルした → コメントは「未送信」のまま、メニューは送信履歴に入らない（Task 4・Task 6）
4. 受け取ったメニューの種目名が自分の種目と前後の空白だけ違う → 同じ種目として使う（Task 7）
5. メニューを置き換えたあとも、過去の記録・カレンダー・グラフが変わらない（Task 7）

---

### Task 1: メニューごとのレスト（restSec）

**Files:**
- Modify: `src/lib/types.ts`（`RoutineItem.restSec?: number | null`, `EntryTarget.restSec?: number | null`）
- Modify: `src/lib/routineEntries.ts`（target に `restSec: it.restSec ?? null`）
- Create: `src/lib/rest.ts` — `restOf(entry: WorkoutEntry, exercise: Exercise): number`（`entry.target?.restSec ?? exercise.restSec`）
- Modify: `src/features/workout/WorkoutPage.tsx`（自動開始・手動の初期値）, `ExerciseRow.tsx`（「レスト M:SS」）, `SuggestionBlock.tsx`（「レスト」）で `restOf` を使う
- Modify: `src/features/manage/RoutineForm.tsx`（種目ごとに「レスト（秒）」の `NumberInput`、空欄 = 種目の設定、10〜600 以外は保存しない）
- Modify: `src/lib/backup.ts`（`isItem` と `isTarget` が `restSec` 無し／null／10〜600 を受け付ける）
- Test: `src/lib/routineEntries.test.ts`, `src/features/workout/WorkoutPage.test.tsx`, `src/features/manage/ManagePage.test.tsx`, `src/lib/backup.test.ts`

**Interfaces:**
- Produces: `restOf(entry, exercise)`、`RoutineItem.restSec`、`EntryTarget.restSec`

- [ ] **Step 1: 失敗するテストを書く**
  - `buildRoutineEntries` が item の `restSec: 45` を `target.restSec: 45` に、無ければ `null` にする
  - 記録画面: ルーティンの item に `restSec: 45` があるベンチプレス（種目のレストは 180）で、完了を押すとタイマーが `00:45`、種目の見出しに「レスト 0:45」
  - 管理 → ルーティン編集で「レスト（秒）」に 60 を入れて保存すると `restSec: 60`、空欄なら `null`、5 なら保存されない
  - バックアップ: `restSec` 無し・null・60 は読める、5 は拒否
- [ ] **Step 2: FAIL を確認**（`npx vitest run src/lib/routineEntries.test.ts src/features/workout src/features/manage src/lib/backup.test.ts`）
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS と `npm run lint` を確認**
- [ ] **Step 5: Commit** — `feat: メニューの種目ごとにレスト時間を決められるように`

### Task 2: フィードバック・メニューのリンクの中身と、前もって作るリンク

**Files:**
- Create: `src/lib/share/feedbackPayload.ts`, `src/lib/share/menuPayload.ts`
- Create: `src/features/friends/usePreparedLink.ts`
- Modify: `src/features/friends/useShareMine.ts`（`usePreparedLink` を使う形に整理。動きは変えない）
- Test: `src/lib/share/feedbackPayload.test.ts`, `src/lib/share/menuPayload.test.ts`, 既存の `FriendsPage.test.tsx` がそのまま通る

**Interfaces:**
- Produces:
  - `type FeedbackPayload`（スペック §4.3）、`parseFeedbackPayload(data: unknown): FeedbackPayload`（範囲は Global Constraints。`fid` は id 形式、`week` は `YYYY-MM-DD` か null、`wid8`/`xid8` は id 形式か null、`wid8` も `week` も null は invalid）
  - `buildFeedbackLink(from: Profile, to: string, comments: FeedbackOut[], now: number): Promise<{ text: string; sent: string[]; rest: number }>` — 古いコメントから入れて `MAX_LINK` を超える手前で止める。`sent` は入った `FeedbackOut.id`、`rest` は入らなかった件数。文: 「GRIND のフィードバックです（N件）。GRIND の『友達』タブに貼り付けてね\n<リンク>」
  - `type MenuPayload`（§4.4）、`parseMenuPayload(data: unknown): MenuPayload`
  - `type MenuDraft = { name: string; weekday: number | null; items: { name: string; bodyPart: BodyPart; type: ExerciseType; restSec: number; sets: number; reps: string; main: boolean; inc: number; note: string }[] }`
  - `buildMenuLink(from: Profile, to: string, menu: MenuDraft, now: number): Promise<{ text: string; payload: MenuPayload }>` — `mid` は新しい12文字。文: 「GRIND のメニュー『名前（曜）』です。GRIND の『友達』タブに貼り付けてね\n<リンク>」
  - `usePreparedLink<T>(build: (() => Promise<T>) | null, deps: unknown[]): T | ShareError | null` — deps が変わるたびに作り直す（古い結果は捨てる）
  - `FeedbackOut` / `FeedbackIn` / `MenuLog` の型はスペック §5 のとおり `src/lib/share/feedbackPayload.ts` と `menuPayload.ts` に置く。`Profile` は `src/db/friends.ts` の型

- [ ] **Step 1: 失敗するテストを書く**
  - 往復: `buildFeedbackLink` → `decodeShare` → `parseFeedbackPayload` で、`wid8` は `FeedbackOut.workoutId` の `:` の後ろ、`xid8` は `exerciseId` の `:` の後ろ、週は `week`
  - 長すぎる: 300 文字のコメント 60 件で `rest > 0` かつリンクが 7,500 文字以内、`sent` は古い順
  - 範囲外: 301 文字、0 文字、51 件、`week: '2026-1-1'`、`wid8` と `week` が両方 null → `invalid`
  - メニュー往復: `buildMenuLink` → 読むと同じ名前・曜日・種目（レスト・目標・メイン・上げ幅・メモ）。曜日 null は −1
  - メニュー範囲外: レスト 5、セット 21、種目 0 件、種目名 41 文字 → `invalid`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS と、既存の `src/features/friends` のテストが通ることを確認**
- [ ] **Step 5: Commit** — `feat: フィードバック・メニューのリンクの中身`

### Task 3: フィードバックとメニューの保存（DB）

**Files:**
- Create: `src/db/feedback.ts`, `src/db/menus.ts`
- Modify: `src/db/db.ts`（`feedbackIn`・`feedbackOut`・`menuLog` に型を付ける。ストアは v3 のまま）, `src/hooks/useData.ts`
- Test: `src/db/feedback.test.ts`, `src/db/menus.test.ts`

**Interfaces:**
- Consumes: Task 2 の型・`parse*`
- Produces（`src/db/feedback.ts`）:
  - `saveDraft(d: { id?: string; friendId: string; workoutId: string | null; week: string | null; exerciseId: string | null; text: string }): Promise<FeedbackOut>`、`deleteDraft(id)`、`listFeedbackOut(friendId): Promise<FeedbackOut[]>`（古い順）、`markSent(ids: string[], at: number)`
  - `previewFeedback(p: FeedbackPayload): Promise<{ mine: boolean; count: number; newCount: number }>`（`mine` = 宛先が自分）
  - `importFeedback(p: FeedbackPayload): Promise<number>` — 自分の記録・種目を uuid の前方一致で探して完全な ID を入れる（見つからなければ null）。`fid` で put（重複しない）、`read: false`。保存件数を返す
  - `listInbox(): Promise<FeedbackIn[]>`（新しい順）、`markRead(id)`、`feedbackForWorkout(workoutId): Promise<FeedbackIn[]>`
  - hooks: `useFeedbackOut(friendId)`, `useInbox()`, `useFeedbackForDay(dateKey)`（その日の記録へのコメント）
- Produces（`src/db/menus.ts`）:
  - `logSentMenu(friend: { id: string; name: string }, payload: MenuPayload, at: number)`、`listMenuLog(direction, friendId?)`（新しい順）
  - `previewMenu(p: MenuPayload): Promise<{ mine: boolean; received: boolean; newExercises: string[]; sameName: Routine | null }>`
  - `importMenu(p: MenuPayload, mode: 'replace' | 'add', now: number): Promise<Routine>` — 1トランザクションで: 名前の一致しない種目を `addExercise`（部位・タイプ・レストは送られてきた値、`barKg: null`）→ `replace` なら同じ名前のメニューの `items`・`weekday` を更新（ID・createdAt はそのまま）、`add` なら新規 → `menuLog` に `direction: 'received'`, `result`
  - hooks: `useMenuLog(direction, friendId?)`

- [ ] **Step 1: 失敗するテストを書く**
  - フィードバック: 下書き → 編集 → 削除、`markSent` 後も一覧に残る
  - `importFeedback`: 前方一致で完全な ID が入る／記録が無ければ null で保存される／同じリンク2回で件数が増えない／宛先違いは `previewFeedback().mine === false`
  - `importMenu`: 名前が前後の空白違いの既存種目を使い、無い種目だけ作る（レストは送られた値、既存種目の `restSec` は変わらない）／`replace` で同じ ID・`items` 更新、`add` で別のメニュー／`menuLog` に `received` と `result`／同じ `mid` は `previewMenu().received === true`
  - 置き換え前に始めた記録（target 付き）と終わった記録の `entries` が置き換え後も変わらない
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS と `npm run lint`**
- [ ] **Step 5: Commit** — `feat: フィードバックとメニューの保存`

### Task 4: フィードバックを書いて送る（見る側）

**Files:**
- Create: `src/features/friends/CommentSheet.tsx`, `src/features/friends/CommentList.tsx`
- Modify: `src/features/friends/FriendWeeks.tsx`（週見出し・日ごとの記録・種目の行に「💬」、その下に自分のコメント）, `src/features/friends/FriendPage.tsx`（上部に「フィードバックを送る（N件）」）
- Test: `src/features/friends/FriendFeedback.test.tsx`

**Interfaces:**
- Consumes: `saveDraft`, `deleteDraft`, `useFeedbackOut`, `markSent`（Task 3）, `buildFeedbackLink`, `usePreparedLink`（Task 2）, `sendText`, `NameSheet`

画面と文言（§8.1）:
- 「💬」の aria-label: 週「この週にコメント」、記録「この日にコメント」、種目「〇〇にコメント」
- `CommentSheet`: 見出し「コメント」、`textarea` aria-label「コメント」、1〜300 文字で「保存」が押せる。既存の下書きを開いたときは「削除」もある
- その場所の下に「あなた: …（未送信）」／「あなた: …（送信済み）」。未送信を押すと編集
- 「フィードバックを送る（N件）」は未送信が1件以上のとき。押した onClick の中で `navigator.share`。共有が終わったら（キャンセル以外。コピーした場合も）`sent` の ID を `markSent`。`rest > 0` ならボタンの下に「N件だけ送ります。残りは次に送ってください」を前もって出す
- プロフィールが無ければ先に `NameSheet`（第1弾と同じ「保存 → 共有する」）

- [ ] **Step 1: 失敗するテストを書く** — `種目に💬→書いて保存→「あなた: …（未送信）」`、`週へのひとこと`、`下書きを編集・削除`、`送ると share がタップ中に呼ばれ、送信済みになる`、`キャンセルすると未送信のまま`、`共有が無い端末ではコピーして送信済み`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: 友達の記録にコメントを書いて送る`

### Task 5: フィードバックを受け取る（記録した側）

**Files:**
- Modify: `src/features/friends/ImportPage.tsx`（種類 `f` の確認画面）, `src/features/calendar/DayDetail.tsx`（記録の下・種目の下にコメント）, `src/features/friends/FriendsPage.tsx`（「届いたフィードバック」）
- Create: `src/features/friends/Inbox.tsx`
- Test: `src/features/friends/ImportFeedback.test.tsx`, `src/features/calendar/CalendarPage.test.tsx`, `src/features/friends/FriendsPage.test.tsx`

**Interfaces:**
- Consumes: `parseFeedbackPayload`（Task 2）, `previewFeedback`, `importFeedback`, `useInbox`, `markRead`, `useFeedbackForDay`（Task 3）

画面と文言（§8.2）:
- 確認画面: 「〇〇さんからのフィードバック（N件）」→「保存」で `/friends` へ。宛先違い: 「あなた宛てではないフィードバックです」（保存ボタンなし）
- カレンダーの日: 記録へのコメントは記録のカードの下に「〇〇さん: …」、種目へのコメントはその種目の行の下
- 「届いたフィードバック」（友達タブ、1件以上のとき）: 新しい順に「〇〇さん M/D」「本文」、未読に赤い点（aria-label「未読」）。押すと `markRead` → `/calendar?date=<記録の日、無ければ週の月曜、どちらも無ければ受け取った日>`

- [ ] **Step 1: 失敗するテストを書く** — `確認→保存→届いたフィードバックに未読で出る`、`宛先違いは保存できない`、`同じリンクを2回保存しても1件`、`カレンダーの日に記録・種目へのコメント`、`押すと既読になりカレンダーのその日へ`、`記録が消えていても届いたフィードバックに残り、受け取った日へ移る`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: 届いたフィードバックをカレンダーと友達タブで見る`

### Task 6: メニューを組んで送る（見る側）

**Files:**
- Create: `src/features/friends/MenuEditorPage.tsx`, `src/features/friends/SentMenus.tsx`
- Modify: `src/features/friends/FriendMenus.tsx`（「メニューを組んで送る」ボタン、下に「送ったメニュー」）, `src/App.tsx`（`/friends/:id/menu/new`）
- Test: `src/features/friends/MenuEditor.test.tsx`

**Interfaces:**
- Consumes: `MenuDraft`, `buildMenuLink`, `usePreparedLink`（Task 2）, `logSentMenu`, `useMenuLog`（Task 3）, `sendText`, `NameSheet`, `Stepper`（components）

画面と文言（§9.1）:
- 見出し「〇〇さんに送るメニュー」。「メニュー名」（1〜40）、曜日（なし・月〜日のボタン）
- 「＋ 種目を追加」→ シート: 友達の種目と自分の種目の名前を合わせた一覧（同じ名前は1つ）から選ぶ、または「新しい種目」（名前・部位・タイプ）を入力
- 種目ごと: セット数（Stepper 1〜20）、目標（テキスト 0〜20）、**レスト**（Stepper 15 秒刻み、10〜600、初期 90、表示は M:SS）、メイン、上げ幅（0〜20）、メモ（0〜100）、上下の並べ替え、外す
- 「送る」: 名前と種目が1つ以上で押せる。onClick の中で `navigator.share`（リンクは入力が変わるたびに作り直しておく）。共有が終わったら（キャンセル以外）`logSentMenu` して友達の詳細のメニュータブへ
- 「送ったメニュー」: 新しい順に「M/D メニュー名（曜） ・ N種目」。押すと内容（種目・セット×目標・レスト）がシートで見られる

- [ ] **Step 1: 失敗するテストを書く** — `種目を選んでレストを−/＋で変え、送ると share が呼ばれ送信履歴に出る（レスト 75 秒が入っている）`、`新しい種目を作って入れられる`、`名前が無い・種目0件では送れない`、`キャンセルすると履歴に入らない`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: 友達のメニューを一から組んで送る`

### Task 7: メニューを受け取る（記録した側）

**Files:**
- Modify: `src/features/friends/ImportPage.tsx`（種類 `m`）, `src/features/manage/RoutineList.tsx`（下に「受け取ったメニュー」）
- Test: `src/features/friends/ImportMenu.test.tsx`, `src/features/manage/ManagePage.test.tsx`

**Interfaces:**
- Consumes: `parseMenuPayload`（Task 2）, `previewMenu`, `importMenu`, `useMenuLog`（Task 3）

画面と文言（§9.2）:
- 「〇〇さんからのメニュー『名前（曜）』」、種目ごとに「種目名 Nセット×目標 ・ レスト M:SS」、新しく作る種目には「新しく追加」
- 同じ名前のメニューがあれば「置き換える」「別のメニューとして追加」、無ければ「追加する」。「やめる」
- 保存したら `/manage`（ルーティン）へ
- 受け取り済み: 「このメニューは受け取り済みです」。宛先違い: 「あなた宛てではないメニューです」
- 管理 → ルーティンの下に「受け取ったメニュー」: 新しい順に「M/D 〇〇さん メニュー名 ・ 置き換え／追加」

- [ ] **Step 1: 失敗するテストを書く** — `無い種目は「新しく追加」と出て、追加すると種目とメニューができる`、`同じ名前のメニューを置き換えても過去の記録とカレンダーの表示は変わらない`、`受け取り済み・宛先違い`、`管理に受け取った履歴`、`置き換えたメニューで記録を始めるとレストが送られた値`
- [ ] **Step 2: FAIL を確認**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: PASS を確認**
- [ ] **Step 5: Commit** — `feat: 受け取ったメニューを確認して置き換え・追加`

### Task 8: 通しの確認

- [ ] **Step 1:** `npm run lint`・`npx vitest run`・`npm run build`
- [ ] **Step 2:** Playwright（375px・390px、2つのブラウザ）: A が記録を共有 → B が貼り付け → B が A の種目にコメント → B がフィードバックを送る（コピー）→ A が貼り付け → A のカレンダーにコメント・友達タブで未読→既読。B が A にメニュー（レスト 75 秒）を送る → A が貼り付けて追加 → A のルーティンにあり、記録を始めて完了するとタイマー 01:15。横スクロール・コンソールエラーなしを確認し、スクリーンショットを撮る
- [ ] **Step 3: Commit**（直したものがあれば）
