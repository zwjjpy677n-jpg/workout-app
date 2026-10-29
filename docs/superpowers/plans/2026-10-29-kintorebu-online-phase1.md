# キントレ部 オンライン共有 第1段階（アカウント・友達・自動共有・メニューをアプリで送る） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** メールと 6 桁コードでログインし、招待リンクで友達になると、終えたトレーニング（ワークアウト時間を含む）が自動で友達の画面に出る。予定のメニューもアプリの中で友達に送れる。

**Architecture:**
- サーバーとのやり取りは、すべて `OnlineApi` という 1 つの窓口（インターフェース）を通す。本番は Supabase、テストはメモリ上の偽物 `createFakeApi()` で差し替える。
- 記録の本体は今までどおり端末の Dexie。送る分は `outbox` にためて送り、受け取った分は今の `friends` / `friendWorkouts` / `menuLog` にしまう。これで今の友達の画面がそのまま使える。
- サーバー側の表と「誰が見られるか」の決まり（RLS）は、`supabase/schema.sql` 1 枚にまとめる。ユーザーが Supabase の管理画面で実行する。

**Tech Stack:** React 18 + TypeScript + Vite、Dexie、Vitest + Testing Library、`@supabase/supabase-js` v2、Supabase（Postgres + RLS + Auth のメール OTP）

**Spec:** `docs/superpowers/specs/2026-10-29-kintorebu-online-design.md`（この計画は §7 の段階 1）

## Global Constraints

- オンライン機能は、`VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` が空ならすべて非表示にする。今の機能はすべてそのまま動く
- 共有しないもの：体重、体脂肪率、メモ、コンディション、ウォームアップ、未完了のセット
- 上限は今の `LIMIT`（`name: 40, entries: 50, sets: 50`）に合わせる。表示名は 1〜20 字
- 招待リンクは `#/join?c=<code>`。code は 22 字（`crypto.getRandomValues` の 16 バイトを base64url にしたもの）。期限は 7 日。友達の招待は 1 回で使用済み
- 表示の呼び方：全体の長さは「ワークアウト時間」（例「62分」）、セットの秒数は「秒数」
- 文言（仕様 §6 のとおり）
  - 「今はつながりません。あとで自動で送ります」
  - 「コードが違うか、期限が切れています」
  - 「このリンクはもう使えません。もう一度送ってもらってください」
  - 「自分の招待リンクです」
- 端末に保存する新しい値の localStorage キーは `ironlog:` で始める。新しい Dexie の表はバックアップに入れない（`OWN_TABLES` は変えない）
- 今のリンク共有（記録・フィードバック・メニュー）とその画面は残す
- コミットの末尾は `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` と `Claude-Session: https://claude.ai/code/session_01N5pgkHG4CbSTbrZQYnRufH`

## Review Focus

1. 「終了」を押した瞬間に電波が無い、またはサーバーが一時停止中 → 記録は保存され、`outbox` に残り、次にアプリを開いたときやネットに戻ったときに送られる（Task 4 のテスト）
2. 送ったあとに記録を直した、または消した → 相手の画面も直る、または消える。同じ記録が二重に並ばない（Task 4・Task 5 のテスト）
3. ログインしていない間に終えた記録 → ログインして「直近 8 週間を共有」を選べば送られる。選ばなければ送られない。ログアウト中は `outbox` にためない（Task 4・Task 6 のテスト）
4. 招待リンクを、未ログインの状態で開いた → ログインを済ませてから自動で友達になる。途中でアプリを閉じても、リンクを開き直せば続けられる（Task 7 のテスト）
5. リンクで追加した友達と、オンラインの友達が同じ人 → 別々の行として並び、どちらも消えない。名前の横に「オンライン」と出る（Task 6 のテスト）

---

### Task 1: サーバーの表と決まり（schema.sql）

**Files:**
- Create: `supabase/schema.sql`
- Create: `src/supabaseSchema.test.ts`

**Interfaces:**
- Produces（表と関数の名前。Task 10 の supabase-js 実装が使う）:
  - 表：`profiles`、`friendships`、`invites`、`shared_workouts`、`menu_messages`。仕様 §4.1 の列のとおり
    - 第 2 段階の `groups`、`group_members`、`reactions`、`comments`、`blocks`、`reports` も、ここで作っておく
  - 関数（`security definer`、`search_path = public`）
    - `create_invite(kind text, group_id uuid default null) returns text`
    - `accept_invite(code text) returns json` → `{kind, user_id, name}`。失敗は例外で、メッセージは `invalid` / `expired` / `used` / `self`
    - `is_connected(a uuid, b uuid) returns boolean`：友達、または同じグループのメンバー。どちらかがブロックしていれば false

- [ ] **Step 1: 失敗するテストを書く**（`supabaseSchema.test.ts`、ファイルの文字列を読んで確かめる）
  - `すべての表で RLS が有効`：`create table <name>` のすべての name について、`alter table <name> enable row level security` がある
  - `決まりで使う関数がある`：`create or replace function public.is_connected`、`accept_invite`、`create_invite` がある
  - `shared_workouts は本人とつながっている人だけが読める`：`shared_workouts` の select の policy に `is_connected(auth.uid(), user_id)` と `user_id = auth.uid()` がある
  - `menu_messages は送った人と受け取った人だけが読める`：select の policy に `sender = auth.uid() or recipient = auth.uid()` がある
  - `reports は誰も読めない`：`reports` に `for select` の policy が無い
- [ ] **Step 2:** `npx vitest run src/supabaseSchema.test.ts` を実行し、FAIL（ファイルが無い）を確かめる
- [ ] **Step 3: `supabase/schema.sql` を書く**（仕様 §4 のとおり。決まりの要点）
  - 招待
    - `accept_invite` は、`used_by is not null and kind='friend'` → `used`、期限切れ → `expired`、owner が自分 → `self`
    - 友達なら `friendships` に `(least, greatest)` で入れ、`used_by` を埋める
  - 書き込みの制限
    - `shared_workouts` の insert / update は `user_id = auth.uid()`
    - `menu_messages` の insert は `sender = auth.uid()`、かつ `recipient` と友達で、ブロックが無いこと
    - `profiles.name` は `check (char_length(name) between 1 and 20)`
  - 受け取りの差分を取るため `updated_at` に index を張る。update のたびに `updated_at = now()` にするトリガーを付ける
- [ ] **Step 4:** テストが PASS になることを確かめる
- [ ] **Step 5: コミット** `feat: オンライン共有のサーバーの表と決まり（schema.sql）`

### Task 2: 窓口（OnlineApi）・偽物・設定

**Files:**
- Create: `src/lib/online/types.ts`, `src/lib/online/api.ts`, `src/lib/online/fakeApi.ts`, `src/lib/online/config.ts`
- Test: `src/lib/online/fakeApi.test.ts`

**Interfaces:**
- Produces（`types.ts`）
  - `type SharedEntry = [x8: string, name: string, part: number, type: number, sets: SetTuple[]]`
  - `type SharedBody = { e: SharedEntry[] }`
  - `type SharedWorkout = { id: string; name: string; startedAt: number; endedAt: number; body: SharedBody }`
  - `type SharedWorkoutRow = SharedWorkout & { userId: string; updatedAt: string; deleted: boolean }`
  - `type MenuMessage = { id: string; sender: string; recipient: string; kind: 'built' | 'mine'; body: MenuPayload; createdAt: string }`
  - `type OnlineUser = { userId: string; email: string }`
  - `type FriendRow = { userId: string; name: string }`
  - `class OnlineError extends Error { code: 'offline' | 'auth' | 'code' | 'invalid' | 'expired' | 'used' | 'self' | 'unknown' }`
- Produces（`api.ts`）
  - `interface OnlineApi`
    - `sendCode(email): Promise<void>`
    - `verifyCode(email, code): Promise<OnlineUser>`
    - `currentUser(): Promise<OnlineUser | null>`
    - `signOut(): Promise<void>`
    - `getMyName(): Promise<string | null>`
    - `saveMyName(name): Promise<void>`
    - `createInvite(): Promise<string>`
    - `acceptInvite(code): Promise<FriendRow>`
    - `listFriends(): Promise<FriendRow[]>`
    - `upsertWorkout(w: SharedWorkout): Promise<void>`
    - `deleteWorkout(id): Promise<void>`
    - `pullWorkouts(since: string): Promise<SharedWorkoutRow[]>`
    - `sendMenu(to, kind, body): Promise<void>`
    - `pullMenus(since: string): Promise<MenuMessage[]>`
  - `getApi(): OnlineApi | null`（未設定なら null）、`setApiForTest(api: OnlineApi | null): void`
- Produces（`config.ts`）
  - `ONLINE: { url: string; anonKey: string }`（`import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`。無ければ `''`）
  - `isOnlineConfigured(): boolean`
- Produces（`fakeApi.ts`）
  - `createFakeApi(): FakeApi`
  - `FakeApi = OnlineApi & { as(userId: string, email?: string): void; offline: boolean; now: number }`
  - サーバーの決まり（RLS）と同じ見え方をまねる。テスト専用で、アプリのコードからは import しない

- [ ] **Step 1: 失敗するテストを書く**（`fakeApi.test.ts`。後の Task のテストが偽物に頼るので、偽物自体を確かめる）
  - `招待で友達になると、お互いの記録が見える`：A が `createInvite` → B が `acceptInvite` → A の `upsertWorkout` が B の `pullWorkouts('')` に出る。友達でない C には出ない
  - `友達の招待は 1 回だけ`：2 人目の `acceptInvite` が `OnlineError('used')`
  - `期限切れと自分の招待`：`now` を 8 日進めると `expired`。自分の code は `self`。でたらめな code は `invalid`
  - `更新と削除は差分で届く`：`pullWorkouts(since)` は `updatedAt > since` だけを返し、`deleteWorkout` の分は `deleted: true` で返る
  - `メニューは友達にだけ送れる`：友達でない相手への `sendMenu` は `OnlineError('invalid')`。受け取った人の `pullMenus` に出る
  - `オフラインのときはすべて offline`：`offline = true` でどのメソッドも `OnlineError('offline')`
  - `コードの間違い`：`verifyCode` は `'123456'` だけを通し、ほかは `OnlineError('code')`
- [ ] **Step 2:** FAIL になることを確かめる
- [ ] **Step 3:** `types.ts` / `api.ts` / `config.ts` / `fakeApi.ts` を実装する。`updatedAt` は ISO 文字列で、偽物は `now` から作る
- [ ] **Step 4:** PASS になることを確かめる
- [ ] **Step 5: コミット** `feat: オンライン共有の窓口と、テスト用の偽サーバー`

### Task 3: 記録を共有用の形に変える・戻す

**Files:**
- Create: `src/lib/online/sharedWorkout.ts`, `src/lib/online/sharedWorkout.test.ts`

**Interfaces:**
- Consumes：`LIMIT` / `TYPES` / `SetTuple`（`sharePayload.ts`）、`topSet`（`lib/calc.ts`）
- Produces
  - `toSharedWorkout(w: Workout, exercises: Map<string, Exercise>): SharedWorkout | null`（終わっていない、または完了セットが 0 なら null）
  - `fromSharedRows(friendId: string, rows: SharedWorkoutRow[]): { workouts: FriendWorkout[]; exercises: Exercise[] }`
  - `friendPrs(exercises: Exercise[], workouts: FriendWorkout[]): Friend['prs']`
  - `workoutMinutes(w: { startedAt: number; endedAt: number | null }): number | null`（`endedAt` が無い、または `endedAt <= startedAt` なら null。それ以外は分に四捨五入）

- [ ] **Step 1: 失敗するテストを書く**
  - `ウォームアップと未完了のセットは送らない`
  - `メモ・コンディションは送らない`：`SharedWorkout` に note / condition の項目が無い
  - `開始と終了を送る`：`startedAt` と `endedAt` がそのまま入る
  - `上限で切る`：名前は 40 字、種目は 50、セットは 50
  - `戻すと友達の記録になる`
    - 種目 id は `${friendId}:${x8}`、記録 id は `${friendId}:${w.id}`
    - `endedAt` が残る
    - 同じ x8 の種目は 1 つにまとまる
  - `ワークアウト時間`：`workoutMinutes({startedAt:0,endedAt:62*60000+20000}) === 62`、リンクで受け取った記録（`endedAt === startedAt`）は null
  - `自己ベスト`：`friendPrs` が種目ごとに `topSet` の結果を返す
- [ ] **Step 2:** FAIL になることを確かめる → 実装する → PASS になることを確かめる
- [ ] **Step 3: コミット** `feat: 記録を共有用の形に変換（ワークアウト時間つき）`

### Task 4: 送る予定の箱（outbox）と自動共有

**Files:**
- Modify: `src/db/db.ts`（v4：`outbox: 'id'`、`sync: 'key'` を足す。`Friend` に `online?: { userId: string }` を足す）
- Create: `src/lib/online/outbox.ts`, `src/lib/online/outbox.test.ts`, `src/lib/online/prefs.ts`
- Modify: `src/db/repository.ts`（`finishWorkout` / `saveEditedWorkout` / `deleteWorkout` の最後で `queueWorkout(id, 'upsert' | 'delete')` を呼ぶ）
- Modify: `src/db/migration.test.ts`（v3 → v4 で今の表が残る）

**Interfaces:**
- Consumes：`toSharedWorkout`（Task 3）、`getApi`（Task 2）
- Produces
  - `type OutboxItem = { id: string; kind: 'workout'; workoutId: string; op: 'upsert' | 'delete'; at: number } | { id: string; kind: 'menu'; to: string; menuKind: 'built' | 'mine'; body: MenuPayload; at: number }`
    - id は記録なら `w:<workoutId>`（上書き）、メニューなら `m:<random>`
  - `queueWorkout(workoutId: string, op: 'upsert' | 'delete'): Promise<void>`：ログイン済み（`getSession()` が null でない）かつ自動共有オンのときだけ入れる。そのあと `void flushOutbox()`
  - `queueMenu(to: string, menuKind: 'built' | 'mine', body: MenuPayload): Promise<void>`
  - `queueRecentWorkouts(now: number, days = 56): Promise<number>`：直近 8 週間の終わった記録を入れ、入れた件数を返す
  - `flushOutbox(): Promise<'done' | 'offline' | 'skipped'>`：古い順に送り、成功した分を消す。`offline` で止める。`auth` なら止めて `getSession` を消す
  - `prefs.ts`
    - `getAutoShare(): boolean` / `setAutoShare(on: boolean)`（localStorage `ironlog:autoShare`、既定 true）
    - `getSession(): { userId: string } | null` / `setSession(s | null)`（localStorage `ironlog:onlineSession`。ログイン済みかを端末で素早く判断するため）

- [ ] **Step 1: 失敗するテストを書く**（`setApiForTest(createFakeApi())` を使う）
  - `終了すると送られる`：ログイン済みで `finishWorkout` → 友達の `pullWorkouts('')` に出る。`outbox` は空
  - `オフラインなら残り、あとで送られる`：`offline=true` で終了 → `outbox` に 1 件 → `offline=false` で `flushOutbox()` → 送られて空になる
  - `直すと上書き、消すと削除が送られる`：同じ記録の `outbox` は 1 件だけ。`deleteWorkout` で相手側が `deleted: true`
  - `自動共有オフ・未ログインなら入れない`
  - `直近 8 週間をまとめて入れる`：57 日前の記録は入らない。進行中の記録は入らない
  - `ログインが切れたら止まり、記録は残る`：`flushOutbox` が auth で止まり、`outbox` は残り、`getSession()` が null
- [ ] **Step 2:** FAIL になることを確かめる → 実装する → PASS になることを確かめる。`npx vitest run` で全部 PASS（`repository.test.ts` も含む）
- [ ] **Step 3: コミット** `feat: 終えた記録を自動でサーバーに送る（送れない分は送り直し）`

### Task 5: 受け取る（記録・メニュー・未読）

**Files:**
- Create: `src/lib/online/pull.ts`, `src/lib/online/pull.test.ts`
- Modify: `src/db/db.ts`（v4 に `menuInbox: 'id, at'` を足す）
- Modify: `src/lib/share/importShare.ts`（`FriendWorkout` に `receivedAt?: number` を足す）

**Interfaces:**
- Consumes：`fromSharedRows` / `friendPrs`（Task 3）、`mergeMenus` の動き（`src/db/friends.ts`。そこから export して使う）
- Produces
  - `pullAll(now: number): Promise<'done' | 'offline' | 'skipped'>`
    - `listFriends` → `friends` に `{ id: userId, name, online: { userId }, receivedAt: now, sharedAt: now, exercises, routines, prs }` を入れる。既にあれば名前と中身を更新する
    - `pullWorkouts(sync.workoutsSince)` → `friendWorkouts` に入れる（`receivedAt: now`）。`deleted` の分は消す。最後に `sync.workoutsSince` を最大の `updatedAt` に進める
    - `pullMenus(sync.menusSince)` → `kind='mine'` は `mergeMenus` でその友達の `routines` / `menuHistory` へ。`kind='built'` は `menuInbox` に `{ id, from: sender, fromName, body, at }`
  - `markFriendsSeen(now: number): Promise<void>`（`sync.seenAt = now`）
  - `useUnread(): { friends: Set<string>; total: number }`（`receivedAt > seenAt` の記録がある友達、と `menuInbox` の未処理の件数）

- [ ] **Step 1: 失敗するテストを書く**
  - `友達と記録が入る`：オンラインの友達が `listFriends()` に出て、記録の `endedAt` が残る
  - `差分だけ取る`：2 回目の `pullAll` で、同じ記録が二重にならない。直した記録は内容が新しくなる
  - `消された記録は端末からも消える`
  - `自分のメニュー（mine）は友達のメニュー一覧へ、同じ名前の古い版は履歴へ`
  - `組んだメニュー（built）は届いたメニューに入る`
  - `未読`：取ってきたあとは未読 1、`markFriendsSeen` のあとは 0
  - `オフラインなら 'offline' で何も変えない`
- [ ] **Step 2:** FAIL になることを確かめる → 実装する → PASS になることを確かめる
- [ ] **Step 3: コミット** `feat: 友達の記録とメニューをサーバーから受け取る（未読つき）`

### Task 6: 友達タブの「オンラインでつながる」とログイン

**Files:**
- Create: `src/lib/online/auth.ts`, `src/features/friends/OnlineSection.tsx`, `src/features/friends/OnlineSection.test.tsx`
- Modify: `src/features/friends/FriendsPage.tsx`（一番上に `<OnlineSection />`。友達の行にオンラインなら「オンライン」の印と未読の点）
- Modify: `src/bootstrap.tsx`（描画のあと `startOnlineSync()`）
- Modify: `src/components/TabBar.tsx`（友達タブに未読の点。`useUnread().total > 0`）

**Interfaces:**
- Consumes：`getApi`、`queueRecentWorkouts`、`flushOutbox`、`pullAll`、`markFriendsSeen`、`useUnread`、`setSession`
- Produces
  - `auth.ts`
    - `signIn(email, code): Promise<OnlineUser>`（成功で `setSession`）
    - `signOutOnline(): Promise<void>`（`setSession(null)`。`outbox` は消さない）
  - `startOnlineSync(): void`：起動時と、`online` イベント・`visibilitychange`（visible）のたびに `flushOutbox()` → `pullAll(Date.now())`
  - `syncNow(): Promise<'done' | 'offline' | 'skipped'>`

画面の流れ（`OnlineSection`）：
- 未設定（`isOnlineConfigured()` が false）なら何も出さない
- 未ログイン：見出し「オンラインでつながる」→ メール入力 →「コードを送る」→ 6 桁入力 →「ログイン」→ 名前が無ければ表示名の入力（1〜20 字）→ 初回だけ確認「直近8週間の記録を共有しますか？」（はい → `queueRecentWorkouts` → `flushOutbox`）
- ログイン済み：「友達を招待」（`createInvite` → `${PUBLIC_URL}#/join?c=${code}` を今の `sendText` で共有）、`syncNow()` の結果が offline なら `role="status"` で「今はつながりません。あとで自動で送ります」
- 友達タブを開いたら `syncNow()` → `markFriendsSeen(Date.now())`

- [ ] **Step 1: 失敗するテストを書く**（偽サーバーを使う）
  - `未設定なら出ない`
  - `コードを送ってログインし、名前を決める`：`verifyCode` の成功後に「表示名」が出て、保存後に「友達を招待」が出る
  - `コードが違うと「コードが違うか、期限が切れています」`
  - `初回の確認で「はい」なら直近の記録が送られる、「いいえ」なら送られない`
  - `招待リンクを共有する`：`sendText` に `#/join?c=` を含む文が渡る（`useShareMine` の `sendText` を差し替える）
  - `つながらないときの表示`
  - `リンクの友達とオンラインの友達が同じ名前でも 2 行並び、オンラインの行に「オンライン」が付く`
  - `未読の点が友達の行に付き、タブを開くと消える`
- [ ] **Step 2:** FAIL になることを確かめる → 実装する → PASS になることを確かめる
- [ ] **Step 3: コミット** `feat: 友達タブにログインと友達の招待を追加`

### Task 7: 招待リンクを開いたとき（#/join）

**Files:**
- Create: `src/features/friends/JoinPage.tsx`, `src/features/friends/JoinPage.test.tsx`
- Modify: `src/App.tsx`（`<Route path="/join" element={<JoinPage />} />` をタブの中に足す）

**Interfaces:**
- Consumes：`acceptInvite`、`OnlineSection` のログインの部品（Task 6 で `LoginForm` として切り出し、export する）、`pullAll`
- Produces：`JoinPage`。code は `sessionStorage['ironlog:pendingInvite']` にも置き、ログインのあとで使う

- [ ] **Step 1: 失敗するテストを書く**
  - `ログイン済みなら友達になって、その友達の画面へ`：`acceptInvite` → `pullAll` → `/friends/<userId>` に移る
  - `未ログインならログインのあとで友達になる`
  - `使用済み・期限切れ・でたらめは「このリンクはもう使えません。もう一度送ってもらってください」`
  - `自分のリンクは「自分の招待リンクです」`
  - `オンライン未設定なら「この版ではオンライン機能が使えません」`
- [ ] **Step 2:** FAIL になることを確かめる → 実装する → PASS になることを確かめる
- [ ] **Step 3: コミット** `feat: 招待リンクから友達になる`

### Task 8: メニューをアプリで送る・届いたメニュー

**Files:**
- Modify: `src/features/friends/MenuEditorPage.tsx`（相手が `friend.online` なら、主ボタンを「アプリで送る」→ `queueMenu(userId, 'built', payload)`。「リンクで送る」も残す）
- Modify: `src/features/friends/FriendsPage.tsx` と `MenuPickSheet.tsx`（オンラインの友達がいれば、選んだメニューを「アプリで送る」→ 相手を選んで、メニューごとに `queueMenu(userId, 'mine', payload)`）
- Create: `src/features/friends/MenuInbox.tsx`（「届いたメニュー」。`ImportPage` の `MenuCard` を export して使う。保存したら `menuInbox` から消す）
- Modify: `src/features/friends/ImportPage.tsx`（`MenuCard` を export）
- Test: `src/features/friends/MenuOnline.test.tsx`

**Interfaces:**
- Consumes：`queueMenu`（Task 4）、`menuInbox` と `pullAll`（Task 5）、`buildMenuLink` の `payload`（`menuPayload.ts`）、`importMenu`（`db/menus.ts`）、`logSentMenu`
- Produces：`MenuInbox` コンポーネント（FriendsPage の `Inbox` の下に置く）。自分のメニューを送るための `routineToMenuPayload(r: Routine, exercises: Map<string, Exercise>, from, to, now): MenuPayload`（`menuPayload.ts`）

- [ ] **Step 1: 失敗するテストを書く**
  - `オンラインの友達に組んだメニューをアプリで送ると、相手の届いたメニューに出て、自分の送信履歴に入る`
  - `届いたメニューを「追加する」と自分のルーティンに入り、届いたメニューから消える`
  - `自分のメニューを選んでアプリで送ると、相手の友達の画面のメニューに出る`
  - `リンクの友達には「アプリで送る」が出ない`
  - `オフラインで送ると「今はつながりません。あとで自動で送ります」が出て、つながったら届く`
- [ ] **Step 2:** FAIL になることを確かめる → 実装する → PASS になることを確かめる
- [ ] **Step 3: コミット** `feat: オンラインの友達にメニューをアプリで送る`

### Task 9: ワークアウト時間の表示とアカウントの設定

**Files:**
- Modify: `src/features/friends/FriendWeeks.tsx`（記録の見出しに `workoutMinutes` が null でなければ「・ 62分」）
- Create: `src/features/manage/AccountSection.tsx`, `src/features/manage/AccountSection.test.tsx`
- Modify: `src/features/manage/SettingsForm.tsx`（ログイン済みなら `AppearanceSection` の下に `AccountSection`）
- Test: `src/features/friends/FriendPage.test.tsx` に追加

**Interfaces:**
- Consumes：`workoutMinutes`（Task 3）、`getAutoShare` / `setAutoShare`、`saveMyName`、`signOutOnline`

`AccountSection` の中身：
- 見出しは「アカウント」。メールアドレスを表示する
- 「表示名」（変更して保存）
- 「自動共有」（チェックボックス。説明「トレーニングを終えると、友達に自動で表示されます」）
- 「ログアウト」（確認「ログアウトしますか？ 端末の記録は消えません」）

- [ ] **Step 1: 失敗するテストを書く**
  - `オンラインの友達の記録に「62分」が出る、リンクの友達の記録には出ない`
  - `自動共有をオフにすると、終了しても送られない`
  - `表示名を変えると相手の一覧の名前が変わる`
  - `ログアウトするとアカウントの欄が消え、友達タブがログイン前に戻る`
- [ ] **Step 2:** FAIL になることを確かめる → 実装する → PASS になることを確かめる
- [ ] **Step 3: コミット** `feat: ワークアウト時間の表示とアカウントの設定`

### Task 10: 本物の Supabase 版の窓口・手順書・プライバシー

**Files:**
- Modify: `package.json`（`@supabase/supabase-js@^2`）
- Create: `src/lib/online/supabaseApi.ts`, `src/lib/online/supabaseApi.test.ts`
- Modify: `src/lib/online/api.ts`（`getApi()` は `isOnlineConfigured()` なら `createSupabaseApi(ONLINE)` を 1 回だけ作る）
- Create: `.env.example`（`VITE_SUPABASE_URL=`、`VITE_SUPABASE_ANON_KEY=`）
- Modify: `.github/workflows/deploy.yml`（build に `VITE_SUPABASE_URL: ${{ vars.SUPABASE_URL }}`、`VITE_SUPABASE_ANON_KEY: ${{ vars.SUPABASE_ANON_KEY }}` を渡す）
- Create: `docs/online-setup.md`（ユーザー向け。Supabase のアカウント作成 → プロジェクト作成 → SQL Editor で `schema.sql` を実行 → Auth のメール OTP とテンプレート「キントレ部の確認コード: {{ .Token }}」→ URL と anon key を GitHub の Variables に登録 → 確認リスト）
- Modify: `public/privacy.html`（メールアドレス・表示名・共有した記録をサーバー（Supabase）に置くこと、見られるのは友達だけ、消し方。アカウント削除の機能は第 2 段階で足すので、それまでは「問い合わせで削除」と書く）
- Modify: `docs/app-store/listing.md`（App のプライバシー：メールアドレスとユーザーコンテンツを「収集、ユーザーに紐づく、トラッキングなし」）

**Interfaces:**
- Consumes：`OnlineApi`（Task 2）、`schema.sql` の名前（Task 1）
- Produces：`createSupabaseApi(cfg: { url: string; anonKey: string }): OnlineApi`
  - supabase-js のエラーを `OnlineError` に直す
    - `fetch` 失敗 → `offline`
    - 401 / JWT 期限切れ → `auth`
    - OTP の間違い → `code`
    - `accept_invite` の例外メッセージ → 同じ名前の code
  - `verifyCode` は `auth.verifyOtp({ email, token, type: 'email' })`

- [ ] **Step 1: 失敗するテストを書く**（`@supabase/supabase-js` の `createClient` を差し替え、エラーの直し方だけ確かめる）
  - `通信の失敗は offline`
  - `OTP の間違いは code`
  - `accept_invite の expired は expired`
  - `upsertWorkout は shared_workouts に user_id 付きで upsert する`
- [ ] **Step 2:** FAIL になることを確かめる → 実装する → PASS になることを確かめる
- [ ] **Step 3:** `npm run build` が通ること（環境変数が空でもビルドでき、オンライン機能が出ないこと）を確かめる
- [ ] **Step 4: コミット** `feat: Supabase 版の窓口・セットアップ手順・プライバシーの更新`

### Task 11: 画面の確認と仕上げ

- [ ] **Step 1:** 偽サーバーを使う開発用の入口を作る。`?fake-online` を付けて開くと `setApiForTest(createFakeApi())` にする。これは `import.meta.env.DEV` のときだけで、本番のビルドには入らない
- [ ] **Step 2:** Playwright（375px）で次を撮って確かめる。横スクロールが無いことも見る
  - ログインの流れ
  - 友達タブ（オンラインの友達・未読の点）
  - 友達の画面（ワークアウト時間）
  - 届いたメニュー
  - アカウントの設定
- [ ] **Step 3:** `npx vitest run`、`npm run build`、`npx cap sync ios` がすべて通ることを確かめる
- [ ] **Step 4: コミット**（直しがあれば）`fix: オンライン共有の表示を調整`
