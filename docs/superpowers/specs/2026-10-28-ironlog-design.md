# IRON LOG — 筋トレ記録アプリ 設計仕様

- 作成日: 2026-10-28
- ステータス: レビュー待ち
- モックアップ: [2026-10-28-ironlog-mockup.html](./2026-10-28-ironlog-mockup.html)

## 1. 目的とターゲット

アスリートがジムでスマホから素早くトレーニングを記録し、前回の記録を超えることに集中できるアプリ。

- ターゲット: 定期的にウェイトトレーニングを行うアスリート
- 成功基準:
  - 記録中、各セットで「前回の数字」が常に目に入る
  - セット入力〜完了が数タップで終わる
  - 種目ごとの成長がグラフで分かる
  - 機能は多いが、画面はシンプルで見やすい（下部タブ4つ）
  - デザインはダーク×レッドでかっこいい

## 2. プラットフォームと技術スタック

| 項目 | 選定 |
|---|---|
| 形態 | スマホ向けWebアプリ（PWA、ホーム画面追加・オフライン動作） |
| 言語/UI | TypeScript + React 18 |
| ビルド | Vite |
| ルーティング | React Router（HashRouter: 静的ホスティングで動くように） |
| 保存 | IndexedDB（Dexie.js）— 端末内のみ、サーバーなし |
| DB購読 | dexie-react-hooks（`useLiveQuery`） |
| グラフ | Recharts |
| PWA | vite-plugin-pwa |
| テスト | Vitest + @testing-library/react + fake-indexeddb |
| スタイル | CSS Modules + CSS変数（デザイントークン） |

## 3. 種目タイプ

種目ごとに記録方式を持つ。入力欄・前回表示・集計・グラフ指標がタイプで切り替わる。

| タイプ | 入力欄 | 表示例 | トップセットの比較基準 | グラフ指標 |
|---|---|---|---|---|
| `weight` 重量×回数 | KG / REP / RPE | `80kg × 8` | 推定1RM | 推定1RM / 最大重量 / ボリューム |
| `bodyweight` 自重(＋加重)×回数 | ＋KG（加重、マイナスでアシスト）/ REP / RPE | `自重+10kg × 12`、`自重 × 15` | 加重 → 回数の順 | 最大加重 / 総回数 |
| `time` 時間 | 秒 / RPE | `1:30` | 時間 | 最長時間 / 合計時間 |

- ボリューム（kg）は `weight` タイプのみ集計
- %1RM計算・プレート計算は `weight` タイプのみ

## 4. 画面構成

下部タブ4つ（ホーム / カレンダー / グラフ / 管理）＋タブ外の全画面「記録中」画面。

### 4.1 ホーム (`/`)
- 「START WORKOUT」ボタン（空のワークアウトを開始）。進行中のワークアウトがあれば「RESUME WORKOUT」
- **今日の体重**カード: 未入力なら「体重を記録」、入力済みなら値と前回比。タップで入力シート
- 今週（月曜始まり）のトレーニング日数・総ボリューム
- **部位別の週セット数**: 部位ごとの横棒（完了したワーキングセット数、`weight`/`bodyweight` タイプ）。少ない部位がひと目で分かる
- ルーティン一覧（タップでその種目入りのワークアウトを開始）
- 最近のワークアウト3件（日付・名前・ボリューム、タップでカレンダーの該当日へ）

### 4.2 記録中 (`/workout`) — 全画面
- ヘッダー: ワークアウト名、経過タイマー、「終了」ボタン
- **コンディション**: 開始直後に任意入力シート（睡眠・疲労・やる気 各1–5、スキップ可）。ヘッダーのアイコンから後で変更可
- **ワークアウトメモ**: ヘッダーのメモアイコンから入力
- 種目カード（追加順）:
  - 種目名、PRバッジ（このワークアウトでトップセットが過去最高を更新したら表示）
  - 「前回 MM/DD・80kg × 8 @RPE8」= 前回その種目を行ったワークアウトのトップセット
  - セット表: SET / 前回（前回ワークアウトの同じ番号のワーキングセット）/ タイプ別入力欄 / 完了チェック
  - **ウォームアップ**: SET番号をタップで「W」⇔番号を切替。ウォームアップは番号を振らず、前回記録・トップセット・PR・ボリューム・部位別セット数・グラフから除外
  - セットごとのメモ（メモアイコンで入力）
  - 「＋セット追加」: 直前セットの値をコピーして追加
  - 種目メニュー（⋯）: **%1RM表**、**プレート計算**、種目削除、セット削除
- 「＋種目追加」: 種目選択シート（部位フィルタ・検索）
- 新規ワーキングセットの初期値: 前回の同番号セットがあればその値をプレースホルダー表示（未入力扱い）。完了チェック時に空欄ならプレースホルダー値を採用
- セット完了チェック → レストタイマー起動（種目のデフォルトレスト秒数）。下部にフローティング表示、−15s / +15s / スキップ。終了時にバイブレーション（対応端末）
- 「終了」: 確認ダイアログ → 完了セットが1つもない種目は除外して保存 → カレンダーの当日へ。完了セットが0なら破棄確認
- 進行中ワークアウトはDBに随時保存（リロード・アプリ切替でも消えない）

### 4.3 カレンダー (`/calendar`)
- 月表示（月曜始まり）、‹ › で月移動、左右スワイプ対応、「今日」ボタン
- 上部に月の合計: トレーニング日数・総ボリューム
- トレーニング日を赤で塗り、その日のボリュームで3段階の濃さ（その月のトレーニング日の最大ボリュームに対する比率: 〜33% / 〜66% / それ以上。ボリューム0のトレーニング日は最も薄い段階）
- 日付タップ → 下に当日の詳細:
  - 体重（記録があれば）
  - ワークアウト一覧（複数可）: コンディション、メモ、種目ごとのワーキングセット要約（例: `80kg × 8 / 8 / 7`）
- ワークアウトの「編集」→ 記録画面と同じUIで過去ワークアウトを編集（タイマー・レストタイマーなし）、「削除」→ 確認後削除

### 4.4 グラフ (`/progress`)
- 対象セレクト: 記録がある種目 ＋「体重」
- 期間: 1M / 3M / 1Y / ALL
- 指標切替: 種目タイプ別（§3）。体重は指標切替なし
- 各ワークアウト日ごとに1点（体重は記録日ごと）
- 現在値（期間内最新）と期間内の増減を大きく表示
- 自己ベスト（全期間のトップセット）を表示
- **%1RM表**（`weight` タイプ選択時）: 現在の推定1RMに対する 50%〜100%（5%刻み）の重量。2.5kg単位に丸める。行タップでプレート計算
- データが2点未満のときは「記録が増えるとグラフが表示されます」

### 4.5 %1RM表・プレート計算（共通シート）
- **%1RM表**: 基準の推定1RM（その種目の全期間最高）と %ごとの重量一覧。2.5kg単位に丸め
- **プレート計算**: 目標重量（初期値は直近セットの重量、編集可）→ 片側に付けるプレートの組み合わせを大きい順に表示（例: `20 + 10 + 2.5`）。設定のバー重量・利用可能プレートを使用。ちょうど作れない場合は作れる最も近い軽い重量と差分を表示

### 4.6 管理 (`/manage`)
- **種目**: 部位別一覧、追加・編集（名前、部位、タイプ、デフォルトレスト秒数）・削除。記録で使用中の種目は削除不可でアーカイブ（一覧・選択から非表示、履歴・グラフには残る）。使用中の種目はタイプ変更不可
- **ルーティン**: 一覧、追加・編集（名前、種目の追加・並べ替え・削除）・削除
- **体重履歴**: 一覧（日付・kg）、編集・削除
- **設定**: バー重量（初期20kg）、利用可能プレート（初期 25 / 20 / 15 / 10 / 5 / 2.5 / 1.25 kg、オンオフ切替）
- **バックアップ**: JSONエクスポート（ファイルダウンロード）、JSONインポート（確認後に全データ置換）

## 5. データモデル

```ts
type BodyPart = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'other';
type ExerciseType = 'weight' | 'bodyweight' | 'time';

interface Exercise {
  id: string;             // crypto.randomUUID()
  name: string;
  bodyPart: BodyPart;
  type: ExerciseType;
  restSec: number;        // デフォルト 90
  archived: boolean;
  createdAt: number;
}

interface Routine {
  id: string;
  name: string;
  exerciseIds: string[];
  createdAt: number;
}

interface WorkoutSet {
  weight: number | null;      // weight: kg / bodyweight: 加重kg（負=アシスト）/ time: 未使用
  reps: number | null;        // weight, bodyweight
  durationSec: number | null; // time
  rpe: number | null;         // 1–10, 0.5刻み
  warmup: boolean;
  note: string;
  done: boolean;
}

interface WorkoutEntry {
  exerciseId: string;
  sets: WorkoutSet[];
}

interface Condition {
  sleep: number | null;       // 1–5
  fatigue: number | null;     // 1–5（5 = 疲れていない）
  motivation: number | null;  // 1–5
}

interface Workout {
  id: string;
  name: string;               // ルーティン名 or "Workout"
  startedAt: number;          // epoch ms
  endedAt: number | null;     // null = 進行中（同時に1件まで）
  note: string;
  condition: Condition;
  entries: WorkoutEntry[];
}

interface BodyweightLog {
  date: string;               // 'YYYY-MM-DD'（主キー、1日1件・上書き）
  kg: number;
}

interface Settings {
  barKg: number;              // 20
  plates: number[];           // 利用可能プレート（kg）
}
```

Dexieテーブル: `exercises`（index: bodyPart, archived）、`routines`、`workouts`（index: startedAt, endedAt）、`bodyweights`（主キー: date）、`settings`（キー 'app' の1レコード）。

初回起動時のシード種目（タイプ）:
- weight: ベンチプレス、インクラインDBプレス、ショルダープレス、デッドリフト、ベントオーバーロウ、ラットプルダウン、スクワット、ルーマニアンデッドリフト、レッグプレス、バーベルカール、トライセプスプレスダウン
- bodyweight: ディップス、懸垂
- time: プランク

## 6. 計算ロジック（純粋関数）

`src/lib/` に置き、すべてユニットテストする。集計対象は原則「`done === true` かつ `warmup === false`」のセット（以下ワーキングセット）。

- `estimate1RM(weight, reps)`: Epley式 `weight × (1 + reps / 30)`。reps=1 なら weight。reps≤0・未入力なら 0
- `setVolume(set)`: `weight × reps`（未入力は0、`weight` タイプのみ）
- `compareSets(type, a, b)`: §3 の基準でセットを比較
- `topSet(type, sets)`: ワーキングセット中の最良セット
- `formatSet(type, set)`: 表示文字列（`80kg × 8 @RPE8`、`自重+10kg × 12`、`1:30`）
- `previousEntry(workouts, exerciseId, beforeTime)`: beforeTime より前に終了したワークアウトのうち、最新でその種目のワーキングセットを含むもののエントリー
- `workoutVolume(workout, exercises)`、`weekSummary(workouts, now)`、`monthSummary(workouts, year, month)`、`volumeLevel(volume, maxVolume)` → 1–3
- `weeklySetsByBodyPart(workouts, exercises, now)`: `Record<BodyPart, number>`
- `progressSeries(workouts, exercise, metric, range, now)`: `{date, value}[]`
- `bodyweightSeries(logs, range, now)`: `{date, value}[]`
- `personalBest(workouts, exercise)`
- `isPR(workout, exercise, history)`: このワークアウトのトップセットが過去全ワークアウトのトップセットより良いか（過去記録がない初回はPRにしない）
- `percentTable(oneRM)`: 50–100%（5%刻み）、2.5kg丸め
- `platesFor(targetKg, barKg, plates)`: `{ perSide: number[], achievedKg: number, diffKg: number }`（貪欲法、大きい順）
- `parseBackup(json)`: スキーマ検証。不正なら例外（インポートは中止しデータは変更しない）

## 7. アーキテクチャ

```
src/
  lib/          純粋関数（計算・日付・フォーマット・プレート・バックアップ検証）
  db/           Dexie定義、シード、repository（CRUD関数）
  hooks/        useLiveQuery ラッパー、useRestTimer、useElapsed
  components/   共通UI（TabBar, Button, Card, Sheet, NumberInput, Stat, RatingInput）
  features/
    home/ workout/ calendar/ progress/ manage/ tools/（%1RM表・プレート計算シート）
  styles/       tokens.css（色・余白・フォント）, global.css
  App.tsx, main.tsx
```

- UIはDBへ直接触れず、`db/repository.ts` の関数と hooks 経由でアクセス
- 画面コンポーネントは表示に専念し、計算は `lib/` を呼ぶ

## 8. デザイン

- 色: 背景 `#0B0B0D`、カード `#16161A`、サブ面 `#1F1F25`、線 `#2A2A31`、文字 `#F4F4F5`、補助文字 `#8B8B94`、アクセント `#E10600`
- 赤は「押せる主要ボタン・完了・強度・選択中」のみに使用
- フォント: 数字・見出し英字は Oswald、日本語は Noto Sans JP（Google Fonts。オフライン時はシステムフォントにフォールバック）
- タップ領域は最低44px。数値入力は `inputmode="decimal"` / `numeric`
- ダーク固定（ライトモードなし）
- 機能追加でもホームが縦に長くなりすぎないよう、各カードは1行〜数行の要約に留める

## 9. エラーハンドリング

- IndexedDB が使えない環境（プライベートモード等）: 起動時に検出し、データ保存できない旨の全画面メッセージ
- 数値入力の範囲: weight 0–1000（bodyweight の加重は −200–1000）、reps 0–999、durationSec 0–36000、RPE 1–10、体重 20–300、コンディション 1–5。範囲外・非数は受け付けない
- インポート失敗: エラーメッセージ表示、既存データは変更しない
- 削除操作はすべて確認ダイアログ

## 10. テスト方針

- `lib/` の全関数: Vitest ユニットテスト（TDD）。特にウォームアップ除外、タイプ別比較、プレート計算の端数
- `db/repository`: fake-indexeddb で CRUD・シード・アーカイブ・体重の1日1件上書きのテスト
- 主要画面: Testing Library で「前回記録の表示」「セット完了→レストタイマー表示」「ウォームアップ切替」「カレンダーの日付タップで詳細表示」「インポート失敗時にデータ不変」
- `npm run build` が通ること、`npm test` が全件パスすること

## 11. スコープ外（YAGNI）

- アカウント・クラウド同期・複数端末共有
- ポンド単位切替
- SNS共有、コーチ機能、栄養管理
- ライトモード
