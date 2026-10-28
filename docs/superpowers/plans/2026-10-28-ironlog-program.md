# IRON LOG プログラム機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8週間プログラム、曜日メニュー（参考メニュー初期投入）、おすすめ重量、開閉式の記録画面、8週間テストを既存の IRON LOG に追加する。

**Architecture:** 新しい判断ロジック（週・回復週・おすすめ・エントリー生成・完了判定・プレート配置）はすべて `src/lib/` の純粋関数にする。データ形式の変更は Dexie version 2 の upgrade とバックアップ v1→v2 変換で吸収し、リポジトリ経由で画面に渡す。画面は v1 の構成（hooks + CSS Modules + Sheet）を踏襲する。

**Tech Stack:** 既存どおり（React 18, TypeScript, Vite, Dexie 4, Recharts, Vitest + Testing Library + fake-indexeddb）

**Spec:** `docs/superpowers/specs/2026-10-28-ironlog-program-design.md`（前提: `docs/superpowers/specs/2026-10-28-ironlog-design.md`）

## Global Constraints

- 見た目は v1 のトークン（`--bg #0B0B0D` `--red #E10600` 等、Oswald / Noto Sans JP）のまま。新色はプレート色のみ: 25 `#D7263D`、20 `#1F5BC6`、15 `#E3B22A`、10 `#2E8F56`、5 `#F7F8FA`、2.5 `#5A6470`、1.25 `#AEB6C0`
- プログラムは8週固定、回復週は4・8週目固定
- 回復週のセット数 = `max(1, ceil(sets / 2))`
- おすすめ理由の文言は仕様 §6 の文字列をそのまま使う
- 参考メニューの内容は仕様 §4.2 の表をそのまま使う
- 既存のテストは新UIに合わせて書き換えてよいが、v1 の振る舞い（前回表示・ウォームアップ・PR・レスト・終了処理・入力範囲）を守るテストは残す
- 1タスク終わるごとに `npm run lint && npx vitest run` が通ること
- UI文言は日本語

## Review Focus

1. 曜日や週の境界 — 日曜（getDay()=0）のルーティン、開始日当日が1週目・7日後が2週目、開始日前の日付 → Task 1 `weekOf` / Task 7 今日カードにテスト
2. 前回の記録が「同じ重さのセットが一部だけ」— 前回 80×5, 80×4, 75×6 で目標5回なら hit=false（80kg のセットだけで判定）→ Task 1 `suggest` にテスト
3. ルーティン内のアーカイブ済み・削除済み種目 — 開始時に飛ばされ、画面に空行が出ない → Task 4 `startRoutineWorkout` にテスト
4. v1 形式のバックアップの読み込み — 変換されて読み込め、v2 で書き出すと program を含む → Task 3 `parseBackup` にテスト
5. 記録中の再読み込み — 開閉状態は失われても、入力値・完了・スピード低下は DB に残る → Task 6 にテスト

---

## File Structure

```
src/lib/types.ts            変更: Exercise.barKg, RoutineItem, Routine(items, weekday), EntryTarget, WorkoutEntry(target, slowed), Workout.routineId, TestResult, Program, WEEKDAY_LABEL
src/lib/program.ts          新規: targetNumber, weekOf, isDeload, programStatus
src/lib/suggest.ts          新規: suggest
src/lib/routineEntries.ts   新規: buildRoutineEntries, entryComplete
src/lib/tools.ts            変更: plateLayout, PLATE_COLORS
src/lib/backup.ts           変更: version 2 + v1 変換
src/db/db.ts                変更: version(2) upgrade
src/db/seed.ts              変更: barKg 初期値
src/db/menuSeed.ts          新規: REFERENCE_MENU, ensureMenuSeeded, loadReferenceMenu
src/db/repository.ts        変更: saveRoutine(items), startRoutineWorkout, getProgram/saveProgram, export/import v2
src/components/Stepper.tsx  新規
src/components/PlateBar.tsx 新規
src/features/workout/       変更: WorkoutPage（開閉式）, ExerciseRow（新規、ExerciseCard を置換）, SetCard（新規、SetRow を置換）, SuggestionBlock（新規）
src/features/home/          変更: HomePage, 新規 ProgramHeader, TodayCard
src/features/manage/        変更: ExerciseForm(barKg), RoutineForm(曜日・目標), RoutineList(参考メニュー), 新規 ProgramPanel, ManagePage(タブ追加)
src/features/progress/      新規 TestCard, TestSheet; 変更 ProgressPage
src/features/tools/PlateSheet.tsx 変更: PlateBar を使う
src/test/factories.ts       変更: routine(), item() ヘルパ
```

---

### Task 1: 週・回復週・おすすめの純粋関数

**Files:**
- Modify: `src/lib/types.ts`（追加のみ: `EntryTarget`, `TestResult`, `Program`, `WEEKDAY_LABEL`）
- Create: `src/lib/program.ts`, `src/lib/suggest.ts`, `src/lib/program.test.ts`, `src/lib/suggest.test.ts`

**Interfaces:**
- Produces（types.ts）: 仕様 §3 の `EntryTarget`, `TestResult`, `Program`。`WEEKDAY_LABEL = ['日','月','火','水','木','金','土']`
- Produces（program.ts）:
  - `targetNumber(reps: string): number | null`
  - `weekOf(startDate: string, dateKey: string): number`
  - `isDeload(week: number): boolean`（4 または 8）
  - `programStatus(program: Program | null, dateKey: string): { active: boolean; week: number; inRange: boolean; deload: boolean; label: string }` — label は仕様 §5 の文言（1–8週の非回復週は ''）。program が null なら `{ active: false, week: 0, inRange: false, deload: false, label: '' }`
- Produces（suggest.ts）: `suggest(args: { target: EntryTarget; type: ExerciseType; prev: { sets: WorkoutSet[]; slowed: boolean } | null; deload: boolean }): { sets: number; weight: number | null; reps: number | null; durationSec: number | null; reason: string }`

- [ ] **Step 1: 失敗するテストを書く（program）**

```ts
test('targetNumber', () => {
  expect(targetNumber('5')).toBe(5);
  expect(targetNumber('8〜10')).toBe(8);
  expect(targetNumber('左右8')).toBe(8);
  expect(targetNumber('左右30秒')).toBe(30);
  expect(targetNumber('6〜8本')).toBe(6);
  expect(targetNumber('最大')).toBeNull();
});
test('weekOf: 開始日が1週目、7日後が2週目、前日は0', () => {
  expect(weekOf('2026-10-26', '2026-10-26')).toBe(1);
  expect(weekOf('2026-10-26', '2026-11-01')).toBe(1);
  expect(weekOf('2026-10-26', '2026-11-02')).toBe(2);
  expect(weekOf('2026-10-26', '2026-10-25')).toBe(0);
  expect(weekOf('2026-10-26', '2026-12-21')).toBe(9);
});
test('isDeload', () => expect([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(isDeload)).toEqual([4, 8]));
test('programStatus', () => {
  const p = { startDate: '2026-10-05', tests: { start: null, end: null } };
  expect(programStatus(p, '2026-10-28')).toMatchObject({ active: true, week: 4, inRange: true, deload: true, label: '回復週：重さはそのまま、セット数を半分に' });
  expect(programStatus(p, '2026-10-04').label).toBe('開始前');
  expect(programStatus(p, '2026-12-01')).toMatchObject({ week: 9, inRange: false, label: '8週間完了' });
  expect(programStatus(null, '2026-10-28').active).toBe(false);
});
```

- [ ] **Step 2: 失敗するテストを書く（suggest）** — `const t = (o) => ({ sets: 3, reps: '5', main: false, inc: 2.5, note: '', ...o })`、`ws = (...pairs) => pairs.map(([w, r]) => set({ weight: w, reps: r }))`

```ts
test('初回', () => expect(suggest({ target: t({}), type: 'weight', prev: null, deload: false })).toEqual({ sets: 3, weight: null, reps: 5, durationSec: null, reason: '初回：フォームが崩れず、目標回数をきれいにこなせる重さで' }));
test('メイン: 達成→+inc', () => expect(suggest({ target: t({ main: true }), type: 'weight', prev: { sets: ws([80, 5], [80, 5], [80, 6]), slowed: false }, deload: false })).toMatchObject({ weight: 82.5, reason: '前回はスピードを保てたので+2.5kg' }));
test('メイン: スピード低下→同じ', () => expect(suggest({ target: t({ main: true }), type: 'weight', prev: { sets: ws([80, 5]), slowed: true }, deload: false })).toMatchObject({ weight: 80, reason: '前回スピードが落ちたので、同じ重さでやり直し' }));
test('メイン: 未達→同じ', () => expect(suggest({ target: t({ main: true }), type: 'weight', prev: { sets: ws([80, 5], [80, 4]), slowed: false }, deload: false })).toMatchObject({ weight: 80, reason: '前回は目標回数に届かなかったので、同じ重さ' }));
test('補助: 最大重量のセットだけで判定', () => {
  expect(suggest({ target: t({ inc: 2 }), type: 'weight', prev: { sets: ws([80, 5], [80, 5], [75, 3]), slowed: false }, deload: false })).toMatchObject({ weight: 82, reason: '全セット目標回数に届いたので+2kg' });
  expect(suggest({ target: t({}), type: 'weight', prev: { sets: ws([80, 5], [80, 4], [75, 6]), slowed: false }, deload: false })).toMatchObject({ weight: 80, reason: '全セットで目標回数に届くまで同じ重さ' });
});
test('ウォームアップと未完了は無視', () => expect(suggest({ target: t({}), type: 'weight', prev: { sets: [set({ weight: 100, reps: 1, warmup: true }), set({ weight: 60, reps: 5 })], slowed: false }, deload: false }).weight).toBe(62.5));
test('回復週: 同じ重さでセット半分', () => {
  expect(suggest({ target: t({ sets: 3 }), type: 'weight', prev: { sets: ws([80, 5]), slowed: false }, deload: true })).toMatchObject({ sets: 2, weight: 80, reason: '回復週：重さはそのまま、セット数を半分に' });
  expect(suggest({ target: t({ sets: 1 }), type: 'weight', prev: null, deload: true }).sets).toBe(1);
});
test('自重・時間', () => {
  expect(suggest({ target: t({ reps: '8' }), type: 'bodyweight', prev: { sets: [set({ weight: 10, reps: 8 })], slowed: false }, deload: false })).toEqual({ sets: 3, weight: 10, reps: 8, durationSec: null, reason: '前回より質を上げることを意識' });
  expect(suggest({ target: t({ reps: '左右30秒' }), type: 'time', prev: null, deload: true })).toEqual({ sets: 2, weight: null, reps: null, durationSec: 30, reason: '回復週：セット数を減らして軽めに' });
});
```

- [ ] **Step 3: 失敗確認** — `npx vitest run src/lib/program.test.ts src/lib/suggest.test.ts` → FAIL（モジュールなし）
- [ ] **Step 4: 実装** — weekOf は `fromDateKey` の差を `Math.round(ms / 86_400_000)` で日数にしてから `floor(days / 7) + 1`（夏時間ずれ対策）。suggest の判定は「前回ワーキングセットのうち重量 = lw のセットすべてで reps ≥ r」。重量は `Math.round(x * 100) / 100`。inc の表示は `formatKg`
- [ ] **Step 5: 通過確認** — PASS
- [ ] **Step 6: Commit** — `git commit -m "feat: プログラム週計算とおすすめ重量の純粋関数"`

---

### Task 2: プレート配置とプレート図

**Files:**
- Modify: `src/lib/tools.ts`, `src/lib/tools.test.ts`, `src/features/tools/PlateSheet.tsx`, `src/features/tools/tools.module.css`
- Create: `src/components/PlateBar.tsx`, `src/components/PlateBar.module.css`, `src/components/PlateBar.test.tsx`

**Interfaces:**
- Consumes: 既存 `platesFor(targetKg, barKg, plates)`
- Produces:
  - `PLATE_COLORS: Record<string, string>`（キーは `formatKg` 済み文字列 '25','20','15','10','5','2.5','1.25'。それ以外のプレートは `#8B8B94`）
  - `PlateBar({ targetKg: number; barKg: number; plates: number[] })` — SVG（片側のみ、重いほど高い）と文字「片側 25 + 5 + 1.25 ・ バー20kg」、端数ありは「（端数 1kg）」を付ける。プレートなしは「バーのみ ・ バー20kg」。target < bar なら何も描画しない

- [ ] **Step 1: 失敗するテストを書く**

```tsx
test('PlateBar: 色と文言', () => {
  const { container } = render(<PlateBar targetKg={82.5} barKg={20} plates={[25, 20, 15, 10, 5, 2.5, 1.25]} />);
  expect(screen.getByText('片側 25 + 5 + 1.25 ・ バー20kg')).toBeInTheDocument();
  expect([...container.querySelectorAll('rect[data-plate]')].map((r) => r.getAttribute('fill'))).toEqual(['#D7263D', '#F7F8FA', '#AEB6C0']);
});
test('PlateBar: 端数とバーのみ', () => {
  render(<PlateBar targetKg={61} barKg={20} plates={[20, 10]} />);
  expect(screen.getByText('片側 20 ・ バー20kg（端数 1kg）')).toBeInTheDocument();
});
test('PlateBar: バーのみ / バー未満', () => {
  const { container, rerender } = render(<PlateBar targetKg={20} barKg={20} plates={[20]} />);
  expect(screen.getByText('バーのみ ・ バー20kg')).toBeInTheDocument();
  rerender(<PlateBar targetKg={15} barKg={20} plates={[20]} />);
  expect(container).toBeEmptyDOMElement();
});
```

既存 `tools.test.tsx` の PlateSheet テストはそのまま通ること（「25 + 5 + 1.25」は PlateSheet 側の大きな表示に残す）。

- [ ] **Step 2: 失敗確認** — FAIL
- [ ] **Step 3: 実装** — PlateSheet の既存 `.viz` を `PlateBar` に置換
- [ ] **Step 4: 通過確認** — `npx vitest run src/components src/features/tools src/lib/tools.test.ts` PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: 色分けしたプレート図"`

---

### Task 3: データ形式 v2（型・移行・リポジトリ・バックアップ）

**Files:**
- Modify: `src/lib/types.ts`, `src/db/db.ts`, `src/db/seed.ts`, `src/db/repository.ts`, `src/db/repository.test.ts`, `src/lib/backup.ts`, `src/lib/backup.test.ts`, `src/test/factories.ts`, `src/features/manage/RoutineForm.tsx`, `src/features/manage/RoutineList.tsx`, `src/features/home/HomePage.tsx`, 影響する既存テスト
- Create: `src/db/migration.test.ts`

**Interfaces:**
- Consumes: Task 1 の `Program`, `EntryTarget`
- Produces（types.ts、仕様 §3 どおりに変更）: `Exercise.barKg`, `RoutineItem`, `Routine { id; name; weekday: number | null; items: RoutineItem[]; createdAt }`, `WorkoutEntry.target?`, `WorkoutEntry.slowed?`, `Workout.routineId: string | null`。`defaultItem(exerciseId: string): RoutineItem`（`{ sets: 3, reps: '10', main: false, inc: 2.5, note: '' }`）
- Produces（db.ts）: `this.version(2).stores({...v1}).upgrade(tx => ...)` で仕様 §3 の移行
- Produces（seed.ts）: シード種目に `barKg`（ベンチプレス/スクワット/デッドリフト = 20、他 null）
- Produces（repository.ts）:
  - `addExercise(input: Omit<Exercise, 'id' | 'archived' | 'createdAt'>)`（barKg を含む）
  - `saveRoutine(r: { id?: string; name: string; weekday: number | null; items: RoutineItem[]; createdAt?: number }): Promise<Routine>`
  - `startWorkout(opts: { name: string; exerciseIds: string[] })` は `routineId: null` を入れる
  - `removeExercise(id)` は items から該当 exerciseId を除く
  - `getProgram(): Promise<Program | null>`, `saveProgram(p: Program | null): Promise<void>`（null で削除）
  - `exportAll(now?)` → `BackupData` v2（`program` 含む）、`importAll(data)` は program も置換
- Produces（backup.ts）: `BackupData { app: 'ironlog'; version: 2; ...; program: Program | null }`、`parseBackup(text)` は v1 を v2 に変換して返す（移行規則は db と同じ。変換関数 `migrateRoutineV1`, `migrateExerciseV1`, `migrateWorkoutV1` を `src/lib/backup.ts` から export し db.ts の upgrade でも使う）
- Produces（factories.ts）: `routine(name: string, items: RoutineItem[], o?: Partial<Routine>): Routine`、`item(exerciseId: string, o?: Partial<RoutineItem>): RoutineItem`、`ex()` は `barKg: null` を含む、`wk()` は `routineId: null` を含む

- [ ] **Step 1: 失敗するテストを書く（移行）** — `migration.test.ts`: `new Dexie('ironlog')` で version(1) スキーマを開き v1 形式（routine `{ exerciseIds: ['a','b'] }`、exercise 名「スクワット」と「懸垂」、workout `routineId` なし）を入れて閉じる → `db.open()` 後に:

```ts
expect((await listRoutines())[0]).toMatchObject({ weekday: null, items: [defaultItem('a'), defaultItem('b')] });
expect((await listExercises()).map((e) => [e.name, e.barKg])).toEqual([['スクワット', 20], ['懸垂', null]]);
expect((await listWorkouts())[0].routineId).toBeNull();
```

（`db` は既に開いている可能性があるので、テスト冒頭で `db.close(); await Dexie.delete('ironlog')`、末尾で `await db.open()`）

- [ ] **Step 2: 失敗するテストを書く（リポジトリ・バックアップ）**
  - `saveRoutine` が weekday と items を保存し、`removeExercise` で items からも外れる（既存テストを items 版に書き換え）
  - `getProgram()` は未保存で null、`saveProgram(p)` 後に p、`saveProgram(null)` で null
  - export→import の往復で program が保たれる
  - `parseBackup`: v1 のデータ（既存テストの valid を version 1 / exerciseIds 形式で）を渡すと version 2・items 形式・program null で返る。`version: 3` は拒否。v2 で `routines[0].items[0].sets` が文字列なら拒否、`program.startDate` が `'2026/10/1'` なら拒否
- [ ] **Step 3: 失敗確認** — FAIL
- [ ] **Step 4: 実装** — 型変更でコンパイルが壊れる箇所（RoutineList の件数表示 → `items.length`、RoutineForm は内部で `exerciseIds` 相当を items に変換して保存（目標編集UIは Task 8）、HomePage のルーティン開始は `r.items.map(i => i.exerciseId)`）を最小限直す
- [ ] **Step 5: 通過確認** — `npm run lint && npx vitest run` 全件 PASS
- [ ] **Step 6: Commit** — `git commit -m "feat: データ形式v2（ルーティン目標・曜日、プログラム、バーの重さ）と移行"`

---

### Task 4: 参考メニュー投入とルーティンからの開始

**Files:**
- Create: `src/db/menuSeed.ts`, `src/db/menuSeed.test.ts`, `src/lib/routineEntries.ts`, `src/lib/routineEntries.test.ts`
- Modify: `src/db/repository.ts`, `src/db/repository.test.ts`, `src/bootstrap.tsx`

**Interfaces:**
- Consumes: Task 1 `suggest`, `programStatus`, `isDeload`; Task 3 型・`saveRoutine`・`getProgram`; v1 `previousEntry`
- Produces（menuSeed.ts）:
  - `REFERENCE_MENU: { name: string; weekday: number; items: { name: string; alias?: string; bodyPart: BodyPart; type: ExerciseType; sets: number; reps: string; main: boolean; inc: number; barKg: number | null; restSec: number; note: string }[] }[]` — 仕様 §4.2 の4日分（月=1 脚・筋力、火=2 上半身・筋肥大、水=3 脚・瞬発、金=5 上半身・瞬発）。alias は既存名（スクワット・懸垂・ディップス・ベントオーバーロウ）
  - `loadReferenceMenu(): Promise<Routine[]>` — 種目は「名前 or alias と一致する非アーカイブ種目」を再利用、無ければ addExercise。同名ルーティンがあれば名前に「(2)」
  - `ensureMenuSeeded(): Promise<void>` — settings に key 'menuSeeded' が無く、ルーティン0件なら `loadReferenceMenu()`。いずれの場合も 'menuSeeded' を記録
- Produces（routineEntries.ts）:
  - `buildRoutineEntries(args: { routine: Routine; exercises: Map<string, Exercise>; history: Workout[]; deload: boolean; at: number }): WorkoutEntry[]` — 仕様 §7.2。アーカイブ/存在しない種目は除外
  - `entryComplete(entry: WorkoutEntry): boolean` — ワーキングセット（warmup でない）が1つ以上あり全て done
- Produces（repository.ts）: `startRoutineWorkout(routineId: string, now?: number): Promise<Workout>` — 進行中があればそれを返す。deload は `programStatus(await getProgram(), toDateKey(now)).deload`
- bootstrap: `ensureSeeded()` の後に `ensureMenuSeeded()`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// menuSeed.test.ts（beforeEach: resetDb + ensureSeeded）
test('ensureMenuSeeded: 4ルーティン、曜日、既存種目の再利用、冪等', async () => {
  await ensureMenuSeeded(); await ensureMenuSeeded();
  const rs = await listRoutines();
  expect(rs.map((r) => [r.name, r.weekday, r.items.length])).toEqual([['脚・筋力', 1, 8], ['上半身・筋肥大', 2, 11], ['脚・瞬発', 3, 8], ['上半身・瞬発', 5, 9]]);
  const ex = await listExercises();
  expect(ex.filter((e) => e.name === 'スクワット')).toHaveLength(1);
  expect(ex.some((e) => e.name === 'ベントオーバーロー')).toBe(false);
  expect(ex.find((e) => e.name === 'ヘックスバーデッドリフト')).toMatchObject({ barKg: 25, restSec: 180, type: 'weight', bodyPart: 'legs' });
  expect(rs[3].items.find((i) => ex.find((e) => e.id === i.exerciseId)?.name === 'ピンベンチ')).toMatchObject({ main: true, inc: 1.25, reps: '5' });
});
test('ルーティンが既にあれば自動投入しない', async () => { await saveRoutine({ name: 'X', weekday: null, items: [] }); await ensureMenuSeeded(); expect(await listRoutines()).toHaveLength(1); });
test('loadReferenceMenu は追加し同名に(2)を付ける', async () => { await ensureMenuSeeded(); await loadReferenceMenu(); expect((await listRoutines()).map((r) => r.name)).toContain('脚・筋力(2)'); });

// routineEntries.test.ts
test('buildRoutineEntries: おすすめ値を実値で入れ target を写す', () => { /* 前回 squat 80×5×3 完了・メイン → entry.sets 3件 weight 82.5 reps 5 done false、target 一致 */ });
test('buildRoutineEntries: 回復週はセット半分', () => { /* deload true → 2セット 80kg */ });
test('buildRoutineEntries: アーカイブ・存在しない種目は除外', () => { /* items 3、うち1つ archived、1つ未登録 → entries 1 */ });
test('buildRoutineEntries: 時間種目は durationSec', () => { /* reps '左右30秒' → sets[0].durationSec 30 */ });
test('entryComplete', () => {
  expect(entryComplete(entry('a', [set({ warmup: true }), set()]))).toBe(true);
  expect(entryComplete(entry('a', [set(), set({ done: false })]))).toBe(false);
  expect(entryComplete(entry('a', [set({ warmup: true })]))).toBe(false);
});

// repository.test.ts
test('startRoutineWorkout: routineId と名前、進行中があればそれを返す', async () => { /* … */ });
test('startRoutineWorkout: プログラム4週目は回復週', async () => { /* saveProgram startDate = 今日-21日 → セット数半分 */ });
```

- [ ] **Step 2: 失敗確認** — FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通過確認** — `npm run lint && npx vitest run` PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: 参考メニューの投入とルーティンからのおすすめ付き開始"`

---

### Task 5: ステッパー

**Files:**
- Create: `src/components/Stepper.tsx`, `src/components/Stepper.module.css`, `src/components/Stepper.test.tsx`

**Interfaces:**
- Consumes: `NumberInput`
- Produces: `Stepper({ value: number | null; onChange(v: number | null): void; step: number; min: number; max: number; unit: string; inputMode: 'decimal' | 'numeric'; label: string })` — `[−][入力 unit][＋]`。ボタンの aria-label は `${label}を減らす` / `${label}を増やす`、入力の aria-label は `label`。null から＋は step、−は min。結果は min–max に収め小数第2位で丸める

- [ ] **Step 1: 失敗するテストを書く** — 80 で＋（step 2.5）→ 82.5、−→ 77.5、null で＋→ 2.5、0 で−→ 0 のまま、999 で＋（max 999）→ 999、入力欄に '85' と打てば 85
- [ ] **Step 2: 失敗確認** — FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通過確認** — PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: −/＋ステッパー"`

---

### Task 6: 開閉式の記録画面

**Files:**
- Create: `src/features/workout/ExerciseRow.tsx`, `src/features/workout/SetCard.tsx`, `src/features/workout/SuggestionBlock.tsx`
- Modify: `src/features/workout/WorkoutPage.tsx`, `src/features/workout/workout.module.css`, `src/features/workout/WorkoutPage.test.tsx`
- Delete: `src/features/workout/ExerciseCard.tsx`, `src/features/workout/SetRow.tsx`

**Interfaces:**
- Consumes: Task 1 `suggest`, `programStatus`; Task 2 `PlateBar`; Task 4 `entryComplete`; Task 5 `Stepper`; v1 `workoutOps`（completeSet 等）、`previousEntry`、`isPR`、`summarizeSets`（calendar から import）
- Produces:
  - `ExerciseRow({ index: number; entry: WorkoutEntry; exercise: Exercise; prev: { workout: Workout; entry: WorkoutEntry } | null; open: boolean; onToggle(): void; pr: boolean; deload: boolean; barKg: number; plates: number[]; onChange(entry: WorkoutEntry): void; onRemove(): void; onSetDone?(): void; onCompleteAndNext(): void; extraActions?(close: () => void): ReactNode })` — `section aria-label={exercise.name}`、ヘッダーは `button aria-expanded`
  - `SuggestionBlock({ exercise: Exercise; target: EntryTarget; prev: ...; deload: boolean; barKg: number; plates: number[] })` — 仕様 §7.3（おすすめは `suggest` をその場で計算して表示のみ。値の投入は Task 4 の開始時に済んでいる）
  - `SetCard({ type: ExerciseType; set: WorkoutSet; number: number | null; prevSet: WorkoutSet | null; placeholder: WorkoutSet | null; weightStep: number; canRemove: boolean; onChange; onToggleWarmup; onToggleDone; onRemove; onNote })` — 見出しボタン「{n} セット目」/「W ウォームアップ」、前回「前回 80kg×8」、Stepper（重量/回数/秒）、RPE は NumberInput（aria-label 'RPE'）、完了ボタン（aria-label '完了'、aria-pressed）
  - WorkoutPage: `open` は state（初期 = 最初の `!entryComplete` の index、全完了なら null）。`onCompleteAndNext`: 入力値のあるセット（weight/reps/durationSec のいずれか非null）を完了にし（completeSet と同じ必須値規則。満たさないセットは未完了のまま）、次の未完了の種目を開く

- [ ] **Step 1: 既存テストを新UIに書き換え** — `rows()` を「`region` 内の `SetCard`（`role="group"` `aria-label="{n}セット目"`）」に変える。前回表示・プレースホルダー（自由追加の種目）・ウォームアップ繰り上げ・完了で前回値採用・種目追加・終了・破棄・進行中なし・レスト・コンディション・メモ・PR・プレート計算・過去編集の各テストの期待値は維持
- [ ] **Step 2: 新しい失敗するテストを書く**（ルーティン開始ワークアウトを `startRoutineWorkout` で用意）
  - 最初の種目だけ開いており（`aria-expanded="true"`）、2つ目のヘッダーをタップすると1つ目が閉じる
  - 開いた種目に「今回のおすすめ」「82.5」「前回はスピードを保てたので+2.5kg」とプレート図の文言「片側 25 + 5 + 1.25 ・ バー20kg」
  - ヘッダーに「メイン」タグと「3セット×5 ・ レスト 3:00」
  - 重量の「重量を増やす」で 82.5 → 85 になり DB に保存される
  - 「この種目を完了して次へ」で全セット done、番号バッジが ✓（aria-label「完了」）、次の種目が開く
  - 「最後の回でスピードが落ちた」で entry.slowed が true になり DB に保存（再描画後も aria-pressed true）
  - 再読み込み相当（アンマウント→再描画）で入力値・完了・slowed が残る
- [ ] **Step 3: 失敗確認** — FAIL
- [ ] **Step 4: 実装** — ExerciseCard/SetRow を削除し ExerciseRow/SetCard に置換。レスト表示は `formatDuration(restSec)`。target なしの種目は SuggestionBlock を出さず、ヘッダー2行目は「レスト m:ss」
- [ ] **Step 5: 通過確認** — `npm run lint && npx vitest run` PASS
- [ ] **Step 6: Commit** — `git commit -m "feat: 開閉式の記録画面（おすすめ・ステッパー・完了して次へ）"`

---

### Task 7: ホーム（週ヘッダー・今日のトレーニング）

**Files:**
- Create: `src/features/home/ProgramHeader.tsx`, `src/features/home/TodayCard.tsx`
- Modify: `src/features/home/HomePage.tsx`, `src/features/home/home.module.css`, `src/features/home/HomePage.test.tsx`, `src/hooks/useData.ts`

**Interfaces:**
- Consumes: Task 1 `programStatus`, `WEEKDAY_LABEL`; Task 3 `getProgram`; Task 4 `startRoutineWorkout`, `entryComplete`
- Produces:
  - `useProgram()`（useData.ts、`useLiveQuery(async () => (await getProgram()) ?? null)`）
  - `ProgramHeader({ status: ReturnType<typeof programStatus> })` — 1–8週は「{n}」+「週目 / 8」、8本のバー（`data-state` = done / now / future、回復週は `data-deload`）、label。範囲外は label を大きく
  - `TodayCard({ routines: Routine[]; workouts: Workout[]; active: Workout | null; status; now: number })` — 仕様 §7.1
- HomePage: プログラム中は ProgramHeader、その下に TodayCard、その下に「自由に記録する」ボタン（v1 START WORKOUT を改名。進行中があれば「RESUME WORKOUT」のまま）、以降 v1 の内容

- [ ] **Step 1: 失敗するテストを書く**（`vi.setSystemTime(new Date(2026, 9, 28, 10))` = 水曜）
  - 参考メニュー投入済みで「今日のトレーニング」「脚・瞬発」「8種目 ・ 24セット」「トレーニングを始める」→ 押すと `/workout`、進行中の name が「脚・瞬発」で routineId 一致
  - その進行中で1種目を完了 → ホームで「進捗 1 / 8」「続きを記録する」
  - 完了済み（endedAt あり、今日、routineId 一致）→「記録を見直す」で `/calendar?date=2026-10-28`
  - 木曜（10/29）にすると「今日は休み」「次は金曜 上半身・瞬発」
  - 日曜（11/1）に曜日 0 のルーティンを作ると今日カードに出る
  - プログラム開始日 2026-10-07 → 「4」「週目 / 8」、「回復週：重さはそのまま、セット数を半分に」、4本目のバーが `data-state="now"` かつ `data-deload`
  - プログラムなしでは週ヘッダーが出ない
  - 「自由に記録する」で routineId null の進行中が作られる
- [ ] **Step 2: 失敗確認** — FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通過確認** — `npm run lint && npx vitest run` PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: ホームに週ヘッダーと今日のトレーニング"`

---

### Task 8: 管理（バー重量・ルーティン目標・参考メニュー・プログラム）

**Files:**
- Create: `src/features/manage/ProgramPanel.tsx`
- Modify: `src/features/manage/ExerciseForm.tsx`, `src/features/manage/RoutineForm.tsx`, `src/features/manage/RoutineList.tsx`, `src/features/manage/ManagePage.tsx`, `src/features/manage/ManagePage.test.tsx`

**Interfaces:**
- Consumes: Task 3 `saveRoutine`, `getProgram`, `saveProgram`; Task 4 `loadReferenceMenu`; Task 7 `useProgram`
- Produces:
  - ExerciseForm: NumberInput「バー重量（kg・空欄なら設定値）」aria-label 'バー重量'（0–100、空欄 = null）
  - RoutineForm: 「曜日」select（aria-label '曜日'、なし/日〜土）。並べ替え欄の各行に セット数（NumberInput 1–20, aria-label `${名前} セット数`）、回数表記（text, aria-label `${名前} 回数`）、メイン（checkbox, `${名前} メイン`）、上げ幅（NumberInput 0.5–20, `${名前} 上げ幅`）、メモ（text, `${名前} メモ`）、↑↓。種目のチェックで追加すると `defaultItem`
  - RoutineList: 各行の副題を「{曜日}曜 ・ {n}種目」（曜日なしは「{n}種目」）。一覧の下に「参考メニューを読み込む」（confirm 後 `loadReferenceMenu`）
  - ProgramPanel（ManagePage のタブ「プログラム」を「ルーティン」の次に追加）: 未開始 → 説明文「8週間で取り組みます。4週目と8週目は回復週（重さはそのまま、セット数を半分）、8週目にテストで伸びを確かめます。」、date input（aria-label '開始日'、初期値今日）、「この日から始める」。開始中 → 「開始日 YYYY/MM/DD」「今 N週目」と programStatus.label、「次の8週間を始める」（confirm → startDate 今日、tests リセット）、「プログラムを終了」（confirm → saveProgram(null)）

- [ ] **Step 1: 失敗するテストを書く**
  - 種目のバー重量 25 を保存 → `listExercises()` の barKg 25、空欄で null
  - ルーティン編集で曜日「火」、ベンチのセット数 5・回数「3〜5」・メイン・上げ幅 1.25 を保存 → `listRoutines()` に反映
  - 一覧の副題「火曜 ・ 1種目」
  - 「参考メニューを読み込む」→ confirm → 4件追加
  - プログラム: 開始日 2026-10-26 で開始 → `getProgram()` の startDate、表示「今 1週目」（setSystemTime 10/28）。「プログラムを終了」→ null
- [ ] **Step 2: 失敗確認** — FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通過確認** — `npm run lint && npx vitest run` PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: 管理画面にバー重量・ルーティン目標・参考メニュー・プログラム"`

---

### Task 9: 8週間テスト

**Files:**
- Create: `src/features/progress/TestCard.tsx`, `src/features/progress/TestSheet.tsx`, `src/features/progress/TestCard.test.tsx`
- Modify: `src/features/progress/ProgressPage.tsx`, `src/features/progress/progress.module.css`

**Interfaces:**
- Consumes: Task 3 `getProgram`, `saveProgram`, `TestResult`; Task 7 `useProgram`; `useRoutines`, `useExerciseMap`, `useBodyweights`
- Produces:
  - `mainExerciseIds(routines: Routine[]): string[]`（`src/lib/program.ts` に追加、出現順・重複なし）
  - TestCard: プログラムがあるときだけ ProgressPage 先頭に表示。見出し「8週間テスト」。表: 行 = メイン種目名 + 「体重」、列 = 開始時 / 8週目 / 伸び（両方あるとき `▲ 7.5kg` / `▼ 1kg` / `±0`）。ボタン「開始時を入力」「8週目を入力」
  - TestSheet: 各メイン種目の NumberInput（aria-label `${名前} 5RM`、0–1000）、体重（aria-label '体重'、20–300。初期値は今日の体重記録があればそれ）、「保存」→ `saveProgram({ ...p, tests: { ...p.tests, [which]: { date: 今日, bodyweight, lifts } } })`
- [ ] **Step 1: 失敗するテストを書く**
  - `mainExerciseIds`（参考メニュー → スクワット, ヘックスバーデッドリフト, ピンベンチ の順）
  - プログラムなしではカードが出ない
  - 開始時にスクワット 100・体重 70、8週目に 110・71.5 を入力 → 行「スクワット」に `100kg` `110kg` `▲ 10kg`、体重行 `▲ 1.5kg`
- [ ] **Step 2: 失敗確認** — FAIL
- [ ] **Step 3: 実装**
- [ ] **Step 4: 通過確認** — `npm run lint && npx vitest run` PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: 8週間テストの入力と伸びの表示"`

---

### Task 10: 仕上げと実機確認

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README** の機能一覧に「8週間プログラム（回復週・テスト）」「曜日メニュー（参考メニュー入り）」「おすすめ重量とプレート図」「開閉式の記録画面」を追記
- [ ] **Step 2: 全体確認** — `npm run lint && npm test && npm run build` 成功
- [ ] **Step 3: Playwright 確認** — `npm run preview` を 390×844 で開き、プログラム開始（開始日 = 今日-21日で4週目）→ ホーム（週ヘッダー・今日カード）、今日のメニューを開始 → 記録画面（おすすめ・プレート図・ステッパー）、管理のルーティン編集、グラフのテストカードをスクリーンショット。全画面で `scrollWidth === 390`、コンソールエラー0
- [ ] **Step 4: Commit** — `git commit -m "docs: READMEにプログラム機能を追記"`
