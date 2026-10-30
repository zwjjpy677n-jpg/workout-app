# ルーティン（毎日の習慣とその日のやること） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GRIND と同じリポジトリに、毎日のルーティンとその日のやることをチェックする別アプリ「ルーティン」を作る。

**Architecture:**
- `routine/` に入口とソースを置き、`vite.routine.config.ts` でビルドする（`package.json` は GRIND と共通）。
- 計算は `routine/src/lib/`（純粋関数）、保存は `routine/src/db/`（Dexie）、画面は `routine/src/features/` に分ける。
- 部品は `src/components` の Button / Card / Sheet / Stepper / NumberInput を読み、`src/styles` のトークンを使う。GRIND 側のファイルは変えない。

**Tech Stack:** React 18 + TypeScript + Vite 5、react-router-dom 6、Dexie 4 + dexie-react-hooks、recharts、vite-plugin-pwa、Vitest + Testing Library + fake-indexeddb

**Spec:** `docs/superpowers/specs/2026-10-30-routine-app-design.md`

## Global Constraints

- GRIND のソース（`src/` 以下）は変えない。読み込むだけ
- データベース名は `routine`。テーブルは `items: 'id'`、`logs: 'id, date, itemId'`、`todos: 'id, date'`、`meta: 'key'`
- 日付キーは `YYYY-MM-DD`（端末の日付）。作るのも読むのも `src/lib/dates.ts` の `toDateKey` / `fromDateKey`
- 時間帯は `morning` 朝 / `pre` 練習前 / `post` 練習後 / `night` 夜 の順で並べる
- `logs.id` は `${date}:${itemId}`
- カレンダーの色は3段階。〜49% → `data-level="1"`、50〜99% → `2`、100% → `3`。やる項目が0件の日は `data-level` なし
- アクセント色は `--red` 変数を上書きして変える。ルーティンでは `--red: #22C55E`、`--red-rgb: 34 197 94`、`--red-soft: rgb(34 197 94 / 0.15)`、`--on-accent: #0B0B0D`
- PWA の名前は `ルーティン`、`theme_color` と `background_color` は `#0B0B0D`
- 画面の文言は日本語
- コミットの末尾は `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` と `Claude-Session: https://claude.ai/code/session_01N5pgkLB3R2nUamr2x5BgS4`

## Review Focus

1. アプリを開いたまま日付が変わる → 画面に戻った（`visibilitychange`）ときに今日の日付が変わり、新しい日のルーティンが出る（Task 5 の `useToday` のテスト）
2. 数値の欄を空にする → `value` は消え、`done` は false に戻る（Task 2 の `applyValue` のテスト）
3. 起動時の初期データが2回入る（React StrictMode で effect が2回走る、または全部消したあと開き直す） → `meta` の `seeded` で1回だけにする（Task 4 のテスト）
4. 記録がある項目を消した → 消す前の日の達成率は変わらず、項目ごとの一覧に「（削除済み）」で残る（Task 3 と Task 9 のテスト）
5. 記録が1件もない最初の日に連続日数を出す → 0 日と出て、例外にならない（Task 3 のテスト）

---

## ファイル構成

```
vite.routine.config.ts          ビルド設定（root: routine, 出力 dist-routine）
routine/index.html
routine/public/icon-192.png, icon-512.png, apple-touch-icon.png   仮アイコン
routine/src/main.tsx            起動（フォント・トークン・checkStorage）
routine/src/App.tsx             ルーティングと TabBar
routine/src/App.test.tsx
routine/src/components/TabBar.tsx      3タブ。CSS は src/components/TabBar.module.css を読む
routine/src/styles/accent.css   アクセント色の上書き
routine/src/lib/types.ts        Slot, Item, Log, Todo, SLOTS
routine/src/lib/day.ts          addDays, weekday
routine/src/lib/schedule.ts     itemsForDay, applyValue
routine/src/lib/stats.ts        dayResult, currentStreak, longestStreak, rangeRate, itemRate, rateLevel
routine/src/db/db.ts            Dexie 定義
routine/src/db/repo.ts          読み書き
routine/src/db/seed.ts          初期データ
routine/src/hooks/useToday.ts
routine/src/features/today/     TodayPage, RoutineRow, TodoList, CarrySheet
routine/src/features/routines/  RoutinesPage, ItemSheet
routine/src/features/history/   HistoryPage, DaySheet, Stats
```

---

### Task 1: 起動するだけの空のアプリ

**Files:**
- Create: `vite.routine.config.ts`, `routine/index.html`, `routine/src/main.tsx`, `routine/src/App.tsx`, `routine/src/components/TabBar.tsx`, `routine/src/styles/accent.css`, `routine/public/*.png`
- Modify: `package.json`（scripts）、`tsconfig.json`（include）、`.gitignore`（`dist-routine`）、`.github/workflows/deploy.yml`（build ジョブに `npm run build:routine` を1行）
- Test: `routine/src/App.test.tsx`

**Interfaces:**
- Produces: `App` コンポーネント。ルーターは中に持たず、main.tsx で `HashRouter`（GRIND と同じ `future` 指定）、テストでは `MemoryRouter` で包む。ルートは `/` 今日、`/history` 記録、`/routines` ルーティン。この Task では各ページは見出しだけの仮のもの

- [ ] **Step 1: 失敗するテストを書く** — `routine/src/App.test.tsx`

```tsx
test('3つのタブがあり、最初は今日の画面', () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  expect(screen.getByRole('link', { name: '今日' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: '記録' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'ルーティン' })).toBeInTheDocument();
});
test('記録タブを押すと記録の画面', async () => {
  render(<MemoryRouter><App /></MemoryRouter>);
  await userEvent.click(screen.getByRole('link', { name: '記録' }));
  expect(screen.getByRole('heading', { name: '記録' })).toBeInTheDocument();
});
```

- [ ] **Step 2: 失敗を確かめる** — `npx vitest run routine/src/App.test.tsx` → `Cannot find module './App'` で FAIL
- [ ] **Step 3: 作る**
  - `vite.routine.config.ts`: `root: 'routine'`、`base: './'`、`build.outDir: '../dist-routine'`、`emptyOutDir: true`。VitePWA は GRIND の設定と同じ形で、`name`/`short_name` を `ルーティン`、`description` を `毎日のルーティンとやること` にする
  - `TabBar`: `src/components/TabBar.tsx` と同じ NavLink の形で3タブ。`useUnread` は使わない。アイコンは GRIND のホーム・カレンダー・管理の path を流用
  - `main.tsx`: GRIND の main.tsx と同じフォント、`src/styles/tokens.css`、`global.css`、`./styles/accent.css` を読み、`HashRouter` で `App` を描画
  - アイコンは GRIND の `public/` の png をコピーして仮に置く
  - `package.json`: `"dev:routine": "vite --config vite.routine.config.ts"`、`"build:routine": "tsc -b && vite build --config vite.routine.config.ts"`、`"preview:routine": "vite preview --config vite.routine.config.ts"`
  - `tsconfig.json` の `include` に `"routine/src"` と `"vite.routine.config.ts"` を足す
- [ ] **Step 4: 通ることを確かめる** — `npx vitest run routine/` が PASS、`npm run lint` がエラーなし、`npm run build:routine` で `dist-routine/index.html` と `dist-routine/sw.js` ができる、`npm run build` も通る
- [ ] **Step 5: コミット** — `feat(routine): 3タブだけのルーティンアプリを起動できるようにする`

---

### Task 2: 型と「その日にやる項目」の計算

**Files:**
- Create: `routine/src/lib/types.ts`, `routine/src/lib/day.ts`, `routine/src/lib/schedule.ts`
- Test: `routine/src/lib/day.test.ts`, `routine/src/lib/schedule.test.ts`

**Interfaces:**
- Produces:

```ts
export type Slot = 'morning' | 'pre' | 'post' | 'night';
export const SLOTS: { key: Slot; label: string }[]; // 朝 / 練習前 / 練習後 / 夜 の順
export interface Item { id: string; name: string; slot: Slot; days: number[]; kind: 'check' | 'number';
  target?: number; unit?: string; step?: number; order: number; active: boolean; createdAt: number; deletedAt?: number }
export interface Log { id: string; date: string; itemId: string; done: boolean; value?: number }
export interface Todo { id: string; date: string; text: string; done: boolean; order: number; carriedFrom?: string }

// day.ts
export function addDays(date: string, n: number): string;
export function weekday(date: string): number; // 0=日
// schedule.ts
export function itemsForDay(items: Item[], date: string, logsOfDay: Log[], today: string): Item[]; // SLOTS の順 → order の順
export function applyValue(item: Item, value: number | null): { done: boolean; value?: number };
```

- [ ] **Step 1: 失敗するテストを書く**
  - `addDays('2026-10-31', 1) === '2026-11-01'`、`addDays('2026-12-31', 1) === '2027-01-01'`、`addDays('2026-03-01', -1) === '2026-02-28'`、`weekday('2026-10-30') === 5`
  - `itemsForDay`
    - `days: [1,3,5]` の項目は `'2026-10-30'`（金）に出て `'2026-10-31'`（土）に出ない
    - `createdAt` が `'2026-10-30'` の 12:00 の項目は 10-29 に出ず 10-30 に出る
    - `deletedAt` が 10-30 12:00 の項目は 10-29 に出て、10-30 にも 10-31 にも出ない
    - `active: false` の項目は、`today` の日には出ない。過去の日は、その日の log があれば出て、なければ出ない
    - 並び順：`night/order0`, `morning/order1`, `morning/order0` を入れると `morning/0, morning/1, night/0` で返る
  - `applyValue`
    - `{kind:'number', target:1500}` に 1500 → `{done:true, value:1500}`、1499 → `{done:false, value:1499}`、`null` → `{done:false}`（`value` キーなし）
    - `kind:'check'` の項目に呼んだら `{ done: false }` を返す（チェック項目は `toggleCheck` で切り替えるので、ここには来ない想定）
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run routine/src/lib` → FAIL
- [ ] **Step 3: 作る** — 「その日の終わり」は `fromDateKey(addDays(date, 1)).getTime()`。`deletedAt` は「その日の始まりより後なら出す」ではなく「その日の終わり以降なら出す」とする（消した当日は出さない）
- [ ] **Step 4: 通ることを確かめる** — 同じコマンドで PASS
- [ ] **Step 5: コミット** — `feat(routine): その日にやる項目と数値の達成判定`

---

### Task 3: 達成率と連続日数

**Files:**
- Create: `routine/src/lib/stats.ts`
- Test: `routine/src/lib/stats.test.ts`

**Interfaces:**
- Consumes: `itemsForDay`, `addDays`, 型（Task 2）
- Produces:

```ts
export type DayResult = { done: number; total: number } | null; // やる項目0件は null
export function dayResult(items: Item[], logs: Log[], date: string, today: string): DayResult;
export function currentStreak(items: Item[], logs: Log[], today: string): number;
export function longestStreak(items: Item[], logs: Log[], today: string): number;
export function rangeRate(items: Item[], logs: Log[], from: string, to: string, today: string): number | null; // 両端含む。分母0なら null
export function itemRate(item: Item, logs: Log[], from: string, to: string, today: string): number | null;
export function rateLevel(rate: number): 1 | 2 | 3;
```

`logs` は全期間を渡してよい。関数の中で日付ごとにまとめる。

- [ ] **Step 1: 失敗するテストを書く**
  - `dayResult`: 毎日の項目3つ、そのうち2つが done → `{done:2,total:3}`。項目0件の日 → `null`
  - `currentStreak`
    - 10-28, 10-29 が全部できて、今日 10-30 が未完了 → `2`
    - 10-28〜10-30 全部できた → `3`
    - 10-29 が未完了 → 今日が完了なら `1`、未完了なら `0`
    - 10-29 がやる項目0件（項目の曜日が合わない）で、10-28 と 10-30 が全部できた → `2`（0件の日は途切れも数えもしない）
    - 項目も記録も無い → `0`
    - 月またぎ：09-30, 10-01 が全部できて、今日 10-01 → `2`
  - `longestStreak`: 10-01〜10-05 全部、10-06 未完了、10-07〜10-08 全部 → `5`
  - `rangeRate`: 2日で `{2/3}` と `{3/3}` → `5/6`
  - `itemRate`: 消した項目でも、消す前の日の記録から計算できる（Review Focus 4）
  - `rateLevel`: `0.49 → 1`、`0.5 → 2`、`0.99 → 2`、`1 → 3`
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run routine/src/lib/stats.test.ts` → FAIL
- [ ] **Step 3: 作る** — さかのぼる下限は、全項目の中でいちばん古い `createdAt` の日。それより前に来たら止める（項目0件なら即 0）
- [ ] **Step 4: 通ることを確かめる** — PASS
- [ ] **Step 5: コミット** — `feat(routine): 達成率と連続日数の計算`

---

### Task 4: データベースと読み書き

**Files:**
- Create: `routine/src/db/db.ts`, `routine/src/db/repo.ts`, `routine/src/db/seed.ts`
- Test: `routine/src/db/repo.test.ts`

**Interfaces:**
- Consumes: 型と `applyValue`（Task 2）
- Produces:

```ts
// db.ts
export const db: Dexie & { items: Table<Item, string>; logs: Table<Log, string>; todos: Table<Todo, string>; meta: Table<{ key: string; at: number }, string> };
// seed.ts
export const SEED: Omit<Item, 'id' | 'createdAt' | 'order' | 'active'>[]; // 仕様 §4.3 の6件
export function seedIfEmpty(now: number): Promise<void>;
// repo.ts
export function saveItem(item: Omit<Item, 'id' | 'createdAt' | 'order' | 'active'> & { id?: string }, now: number): Promise<string>;
export function setItemActive(id: string, active: boolean): Promise<void>;
export function deleteItem(id: string, now: number): Promise<void>;          // deletedAt を入れるだけ
export function moveItem(id: string, dir: -1 | 1): Promise<void>;            // 同じ slot の隣と order を入れ替え
export function toggleCheck(date: string, itemId: string): Promise<void>;
export function setValue(date: string, item: Item, value: number | null): Promise<void>; // applyValue を通す
export function addTodo(date: string, text: string): Promise<void>;          // 空白だけなら何もしない
export function updateTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'done'>>): Promise<void>;
export function deleteTodo(id: string): Promise<void>;
export function moveTodo(id: string, dir: -1 | 1): Promise<void>;
export function pendingBefore(today: string): Promise<Todo[]>;               // date < today かつ !done、日付の古い順
export function carryOver(ids: string[], today: string): Promise<void>;      // date=today, carriedFrom=元の date, order は今日の末尾
```

- [ ] **Step 1: 失敗するテストを書く**（各テストの前に `db.delete(); db.open()`）
  - `seedIfEmpty` を2回続けて呼んでも items は6件。全部 `deleteItem` で消しても、もう一度呼んで増えない（Review Focus 3）
  - SEED の中身：`水を飲む` は `{slot:'morning', kind:'number', target:1500, unit:'ml', step:250}`、`睡眠` は `{slot:'night', kind:'number', target:7.5, unit:'時間', step:0.5}`、ほか4件は `check`、全部 `days: [0,1,2,3,4,5,6]`
  - `saveItem` 新規は `order` がその slot の末尾、`active: true`。`id` 付きなら上書きし `createdAt` と `order` を保つ
  - `toggleCheck` を2回 → log の `done` が true → false
  - `setValue(水, 1500)` → `{done:true, value:1500}`、続けて `null` → `done:false` で `value` なし
  - `moveItem` で morning の 0 番と 1 番が入れ替わる。先頭で `-1` は何もしない
  - `addTodo('2026-10-30', '  ')` は何も増えない
  - `pendingBefore('2026-10-30')` は 10-29 の未完了だけ返し、10-29 の完了と 10-30 の未完了は返さない
  - `carryOver` 後、その todo は `date:'2026-10-30', carriedFrom:'2026-10-29'` で、件数は増えていない
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run routine/src/db` → FAIL
- [ ] **Step 3: 作る** — DB 名 `routine`、version(1) で Global Constraints のテーブル。id は `crypto.randomUUID()`。`seedIfEmpty` は `meta` の `seeded` を見て、ないときだけ items と `seeded` を1トランザクションで入れる
- [ ] **Step 4: 通ることを確かめる** — PASS
- [ ] **Step 5: コミット** — `feat(routine): データベースと読み書き、初期データ`

---

### Task 5: 今日の画面（ルーティン部分）

**Files:**
- Create: `routine/src/hooks/useToday.ts`, `routine/src/features/today/TodayPage.tsx`, `RoutineRow.tsx`, `today.module.css`
- Modify: `routine/src/App.tsx`（`/` を TodayPage に）、`routine/src/main.tsx`（起動時に `seedIfEmpty(Date.now())`）
- Test: `routine/src/hooks/useToday.test.ts`, `routine/src/features/today/TodayPage.test.tsx`

**Interfaces:**
- Consumes: `itemsForDay`（Task 2）、`dayResult`, `currentStreak`（Task 3）、`db`, `toggleCheck`, `setValue`（Task 4）
- Produces: `useToday(): string`（今日の日付キー）。`<RoutineRow item={Item} log={Log | undefined} date={string} />`（日付を props で受けるので、Task 8 の過去の日でも同じ行を使える）

- [ ] **Step 1: 失敗するテストを書く**
  - `useToday`: `vi.setSystemTime` で 10-30 23:59 → `'2026-10-30'`。時刻を 10-31 00:01 に進めて `document` に `visibilitychange` を投げる → `'2026-10-31'`（Review Focus 1）
  - `TodayPage`（項目を db に直接入れてから描画）
    - 見出し「朝」「夜」が出て、今日やる項目がない「練習前」は出ない
    - 上に `0/3` と `0%`、🔥 `0日`
    - チェック項目の行を押すと `1/3` になり、行が `aria-checked="true"`
    - 水の行で「水を飲むを増やす」を6回押すと `1500 / 1500 ml` 表示になりチェックが付く
    - 曜日が合わない項目は出ない
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run routine/src/hooks routine/src/features/today` → FAIL
- [ ] **Step 3: 作る**
  - 読み込みは `useLiveQuery` で items 全件と今日の logs。連続日数用に logs 全件も読む
  - チェック行は `role="checkbox"` の button、`aria-checked`、`aria-label` は項目名
  - 数値行は `Stepper`（`label` は項目名、`step` は項目の step、`min: 0`、`max: target * 10`、`inputMode: 'decimal'`、`unit` は項目の unit）。横に `値 / 目標 単位` と、達成ならチェックの印
- [ ] **Step 4: 通ることを確かめる** — PASS
- [ ] **Step 5: コミット** — `feat(routine): 今日の画面でルーティンをチェック・記録できる`

---

### Task 6: 今日のやることと持ち越し

**Files:**
- Create: `routine/src/features/today/TodoList.tsx`, `CarrySheet.tsx`
- Modify: `routine/src/features/today/TodayPage.tsx`
- Test: `routine/src/features/today/TodoList.test.tsx`

**Interfaces:**
- Consumes: `addTodo`, `updateTodo`, `deleteTodo`, `moveTodo`, `pendingBefore`, `carryOver`（Task 4）、`Sheet`, `Button`（`src/components`）
- Produces: `<TodoList today={string} />`

- [ ] **Step 1: 失敗するテストを書く**
  - 「やることを追加」欄に `買い物` と入れて Enter → 一覧に出て、入力欄が空になる
  - 項目を押すと `aria-checked="true"`。もう一度押すと戻る
  - 項目の「…」メニューから「編集」→ 文字を変えて保存、「削除」→ 消える、「上へ」で順番が変わる
  - 昨日の未完了が2件ある → `未完了が2件あります` が出る。押すとシートに2件がチェック済みで並び、1件外して「持ち越す」→ 今日の一覧に1件増え、表示が `未完了が1件あります` になる
  - 持ち越したものには `10/29から` のように元の日付を小さく出す
  - 未完了が0件なら案内は出ない
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run routine/src/features/today/TodoList.test.tsx` → FAIL
- [ ] **Step 3: 作る** — 今日の todos は `useLiveQuery` で `order` 順。未完了の件数は `pendingBefore(today)` を `useLiveQuery` で読む
- [ ] **Step 4: 通ることを確かめる** — PASS
- [ ] **Step 5: コミット** — `feat(routine): 今日のやることと、前の日の未完了の持ち越し`

---

### Task 7: ルーティンの管理画面

**Files:**
- Create: `routine/src/features/routines/RoutinesPage.tsx`, `ItemSheet.tsx`, `routines.module.css`
- Modify: `routine/src/App.tsx`
- Test: `routine/src/features/routines/RoutinesPage.test.tsx`

**Interfaces:**
- Consumes: `saveItem`, `setItemActive`, `deleteItem`, `moveItem`（Task 4）、`SLOTS`（Task 2）、`Sheet`, `Button`, `NumberInput`

- [ ] **Step 1: 失敗するテストを書く**
  - 時間帯の見出しごとに項目が並ぶ。消した項目は出ない。休止中は `休止中` の印が付く
  - 「項目を追加」→ 名前 `日記`、時間帯 `夜`、曜日 `曜日を選ぶ` で月・水だけ、種類 `チェック` → 保存で夜の末尾に出る
  - 種類 `数値` を選ぶと 目標・単位・増減の幅 の欄が出て、目標が空なら保存ボタンが押せない。名前が空でも押せない
  - 曜日を全部外したら保存できない
  - 既存の項目を押して名前を変えて保存 → 一覧が変わる
  - 編集シートの「休止する」→ 一覧で `休止中`。「再開する」で戻る
  - 「削除」→ 確認の「削除する」を押すと一覧から消える
  - 「上へ」「下へ」で同じ時間帯の中の順番が変わる
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run routine/src/features/routines` → FAIL
- [ ] **Step 3: 作る** — 曜日は `毎日` / `曜日を選ぶ` の切り替えと、日〜土の7つのトグル（`aria-pressed`）
- [ ] **Step 4: 通ることを確かめる** — PASS
- [ ] **Step 5: コミット** — `feat(routine): ルーティン項目の追加・編集・並べ替え・休止・削除`

---

### Task 8: 記録の画面（カレンダーと日ごとの中身）

**Files:**
- Create: `routine/src/features/history/HistoryPage.tsx`, `DaySheet.tsx`, `history.module.css`
- Modify: `routine/src/App.tsx`
- Test: `routine/src/features/history/HistoryPage.test.tsx`

**Interfaces:**
- Consumes: `monthGrid`, `toDateKey`（`src/lib/dates.ts`）、`dayResult`, `rateLevel`（Task 3）、`RoutineRow`（Task 5。DaySheet ではその日の `date` を渡す）

- [ ] **Step 1: 失敗するテストを書く**（今日を 2026-10-30 に固定）
  - `2026年10月` の見出しと、`10月1日`〜`10月31日` のセル
  - 全部できた日は `data-level="3"`、2/3 の日は `2`、1/3 の日は `1`、項目0件の日（項目を作る前の日）は `data-level` なし
  - 「前の月」で `2026年9月` になる
  - `10月29日` を押すとシートにその日のルーティンが出て、チェックを付けるとセルの `data-level` が変わる
  - 明日以降のセルは押せない（`disabled`）
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run routine/src/features/history/HistoryPage.test.tsx` → FAIL
- [ ] **Step 3: 作る** — 色は GRIND の `calendar.module.css` の `data-level` の色付けを見て、`history.module.css` に同じ段階で書く（`--red` を使うので緑になる）
- [ ] **Step 4: 通ることを確かめる** — PASS
- [ ] **Step 5: コミット** — `feat(routine): 記録のカレンダーと、過去の日の修正`

---

### Task 9: 記録の画面（統計とグラフ）

**Files:**
- Create: `routine/src/features/history/Stats.tsx`
- Modify: `routine/src/features/history/HistoryPage.tsx`
- Test: `routine/src/features/history/Stats.test.tsx`

**Interfaces:**
- Consumes: `rangeRate`, `itemRate`, `currentStreak`, `longestStreak`（Task 3）、`addDays`（Task 2）、`startOfWeek`（`src/lib/dates.ts`。週は月曜始まり）、recharts の `LineChart`

- [ ] **Step 1: 失敗するテストを書く**
  - `今週` と `今月` の達成率が % で出る（例：`83%`）。分母0なら `—`
  - `連続` と `最長` の日数
  - 項目ごとの直近30日の達成率。消した項目は名前のあとに `（削除済み）` が付いて残る（Review Focus 4）。消した項目で記録が1件もないものは出さない
  - 数値の項目を選ぶ切り替え（`水を飲む` / `睡眠`）があり、選ぶとグラフの見出しが変わる。数値の項目がなければグラフの欄ごと出さない
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run routine/src/features/history/Stats.test.tsx` → FAIL
- [ ] **Step 3: 作る** — グラフは直近30日の `value` を日付順。値のない日は点を打たない（`connectNulls`）。jsdom では recharts の描画サイズが0になるので、`ResponsiveContainer` を使わず `width`/`height` を固定するか、テストは見出しと切り替えだけを見る
- [ ] **Step 4: 通ることを確かめる** — PASS
- [ ] **Step 5: コミット** — `feat(routine): 達成率・連続日数・項目ごとの統計と数値のグラフ`

---

### Task 10: 保存できない端末の案内と仕上げ

**Files:**
- Modify: `routine/src/main.tsx`, `routine/src/App.tsx`, `README.md`
- Test: `routine/src/App.test.tsx`

**Interfaces:**
- Consumes: `checkStorage`（`src/db/checkStorage.ts`）
- Produces: `App` が `storageOk?: boolean` を受け取る（既定 true）。main.tsx で `checkStorage()` の結果を渡す

- [ ] **Step 1: 失敗するテストを書く** — `<App storageOk={false} />` で `この端末では保存できません` が出る（タブは使える）
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run routine/src/App.test.tsx` → FAIL
- [ ] **Step 3: 作る** — 画面上部に帯で出す。README の末尾に「ルーティン（別アプリ）」の節を足し、機能の要約と `npm run dev:routine` / `build:routine` の使い方を書く
- [ ] **Step 4: 全体を確かめる**
  - `npm test` が全部 PASS（GRIND のテストも含む）
  - `npm run lint` がエラーなし
  - `npm run build` と `npm run build:routine` が通る
  - `npm run dev:routine` を立ち上げ、Playwright でスマホ幅（390×844）の今日・記録・ルーティンの画面を撮って、文字のはみ出しや色を目で確かめる
- [ ] **Step 5: コミット** — `feat(routine): 保存できない端末の案内と README`
