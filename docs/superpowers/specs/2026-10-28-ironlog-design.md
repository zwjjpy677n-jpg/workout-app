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
  - 種目ごとの成長（推定1RM・最大重量・ボリューム）がグラフで分かる
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

## 3. 画面構成

下部タブ4つ（ホーム / カレンダー / グラフ / 管理）＋タブ外の全画面「記録中」画面。

### 3.1 ホーム (`/`)
- 「START WORKOUT」ボタン（空のワークアウトを開始）
- 今週（月曜始まり）のトレーニング日数・総ボリューム
- ルーティン一覧（タップでその種目入りのワークアウトを開始）
- 最近のワークアウト3件（日付・名前・ボリューム、タップで詳細＝カレンダーの該当日へ）
- 進行中のワークアウトがある場合、ボタンは「RESUME WORKOUT」になる

### 3.2 記録中 (`/workout`) — 全画面
- ヘッダー: ワークアウト名、経過タイマー、「終了」ボタン
- 種目カード（追加順）:
  - 種目名、PRバッジ（このワークアウトで推定1RMの自己ベストを更新したら表示）
  - 「前回 MM/DD・80kg × 8 @RPE8」= 前回その種目を行ったワークアウトのトップセット（推定1RM最大のセット）
  - セット表: SET / 前回（前回ワークアウトの同じ番号のセット）/ KG / REP / RPE / 完了チェック
  - セットごとのメモ（行を長押しまたはメモアイコンで入力）
  - 「＋セット追加」: 直前セットの重量・回数をコピーして追加
  - 種目メニュー: 種目削除、セット削除
- 「＋種目追加」: 種目選択シート（部位フィルタ・検索）
- 新規セットの初期値: 前回の同番号セットがあればその重量・回数をプレースホルダー表示（未入力扱い）。完了チェック時に空欄ならプレースホルダー値を採用
- セット完了チェック → レストタイマー起動（種目のデフォルトレスト秒数）。下部にフローティング表示、−15s / +15s / スキップ。終了時にバイブレーション（対応端末）
- 「終了」: 確認ダイアログ → 完了セットが1つもない種目は除外して保存 → カレンダーの当日へ。完了セットが0なら破棄確認
- 進行中ワークアウトはDBに随時保存（リロード・アプリ切替でも消えない）

### 3.3 カレンダー (`/calendar`)
- 月表示（月曜始まり）、‹ › で月移動、左右スワイプ対応、「今日」ボタン
- 上部に月の合計: トレーニング日数・総ボリューム
- トレーニング日を赤で塗り、その日のボリュームで3段階の濃さ（その月のトレーニング日の最大ボリュームに対する比率: 〜33% / 〜66% / それ以上）
- 日付タップ → 下に当日のワークアウト一覧（複数可）。各ワークアウトは種目ごとのセット要約（例: `80kg × 8 / 8 / 7`）
- ワークアウトの「編集」→ 記録画面と同じUIで過去ワークアウトを編集（タイマー・レストタイマーなし）、「削除」→ 確認後削除

### 3.4 グラフ (`/progress`)
- 種目セレクト（記録がある種目のみ）
- 期間: 1M / 3M / 1Y / ALL
- 指標切替: 推定1RM / 最大重量 / ボリューム（各ワークアウト日ごとに1点）
- 現在値（期間内最新）と期間内の増減を大きく表示
- 自己ベスト（全期間の推定1RM最大セット）を表示
- データが2点未満のときは「記録が増えるとグラフが表示されます」

### 3.5 管理 (`/manage`)
- **種目**: 部位別一覧、追加・編集（名前、部位、デフォルトレスト秒数）・削除。記録で使用中の種目は削除不可でアーカイブ（一覧・選択から非表示、履歴・グラフには残る）
- **ルーティン**: 一覧、追加・編集（名前、種目の追加・並べ替え・削除）・削除
- **バックアップ**: JSONエクスポート（ファイルダウンロード）、JSONインポート（確認後に全データ置換）

## 4. データモデル

```ts
type BodyPart = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'other';

interface Exercise {
  id: string;            // crypto.randomUUID()
  name: string;
  bodyPart: BodyPart;
  restSec: number;       // デフォルト 90
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
  weight: number | null; // kg
  reps: number | null;
  rpe: number | null;    // 1–10, 0.5刻み
  note: string;
  done: boolean;
}

interface WorkoutEntry {
  exerciseId: string;
  sets: WorkoutSet[];
}

interface Workout {
  id: string;
  name: string;          // ルーティン名 or "Workout"
  startedAt: number;     // epoch ms
  endedAt: number | null;// null = 進行中（同時に1件まで）
  note: string;
  entries: WorkoutEntry[];
}
```

Dexieテーブル: `exercises`（index: bodyPart, archived）、`routines`、`workouts`（index: startedAt, endedAt）。

初回起動時のシード種目: ベンチプレス、インクラインDBプレス、ショルダープレス、ディップス、デッドリフト、懸垂、ベントオーバーロウ、ラットプルダウン、スクワット、ルーマニアンデッドリフト、レッグプレス、バーベルカール、トライセプスプレスダウン、プランク。

## 5. 計算ロジック（純粋関数）

`src/lib/` に置き、すべてユニットテストする。

- `estimate1RM(weight, reps)`: Epley式 `weight × (1 + reps / 30)`。reps=1 なら weight。reps≤0 または未入力なら 0
- `setVolume(set)`: `weight × reps`（未入力は0）
- 集計対象は `done === true` のセットのみ
- `topSet(sets)`: 推定1RM最大の完了セット
- `previousEntry(workouts, exerciseId, beforeTime)`: beforeTime より前に終了したワークアウトのうち、最新でその種目を含むもののエントリー
- `workoutVolume(workout)`、`weekSummary(workouts, now)`、`monthSummary(workouts, year, month)`、`volumeLevel(volume, maxVolume)` → 0–3
- `progressSeries(workouts, exerciseId, metric, range, now)`: `{date, value}[]`
- `personalBest(workouts, exerciseId)`
- `isPR(workout, exerciseId, history)`: このワークアウトの最大推定1RMが過去全ワークアウトの最大を超えるか
- `parseBackup(json)`: スキーマ検証。不正なら例外（インポートは中止しデータは変更しない）

## 6. アーキテクチャ

```
src/
  lib/          純粋関数（計算・日付・バックアップ検証）
  db/           Dexie定義、シード、repository（CRUD関数）
  hooks/        useLiveQuery ラッパー、useRestTimer、useElapsed
  components/   共通UI（TabBar, Button, Card, Sheet, NumberInput, Stat）
  features/
    home/ workout/ calendar/ progress/ manage/
  styles/       tokens.css（色・余白・フォント）, global.css
  App.tsx, main.tsx
```

- UIはDBへ直接触れず、`db/repository.ts` の関数と hooks 経由でアクセス
- 画面コンポーネントは表示に専念し、計算は `lib/` を呼ぶ

## 7. デザイン

- 色: 背景 `#0B0B0D`、カード `#16161A`、サブ面 `#1F1F25`、線 `#2A2A31`、文字 `#F4F4F5`、補助文字 `#8B8B94`、アクセント `#E10600`
- 赤は「押せる主要ボタン・完了・強度・選択中」のみに使用
- フォント: 数字・見出し英字は Oswald、日本語は Noto Sans JP（Google Fonts。オフライン時はシステムフォントにフォールバック）
- タップ領域は最低44px。数値入力は `inputmode="decimal"` / `numeric`
- ダーク固定（ライトモードなし）

## 8. エラーハンドリング

- IndexedDB が使えない環境（プライベートモード等）: 起動時に検出し、データ保存できない旨の全画面メッセージ
- 数値入力: 負数・非数は受け付けない（weight 0–1000、reps 0–999、RPE 1–10）
- インポート失敗: エラーメッセージ表示、既存データは変更しない
- 削除操作はすべて確認ダイアログ

## 9. テスト方針

- `lib/` の全関数: Vitest ユニットテスト（TDD）
- `db/repository`: fake-indexeddb で CRUD・シード・アーカイブのテスト
- 主要画面: Testing Library で「前回記録の表示」「セット完了→レストタイマー表示」「カレンダーの日付タップで詳細表示」「インポート失敗時にデータ不変」
- `npm run build` が通ること、`npm test` が全件パスすること

## 10. スコープ外（YAGNI）

- アカウント・クラウド同期・複数端末共有
- ポンド単位切替
- SNS共有、コーチ機能、栄養管理
- ライトモード
