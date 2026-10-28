import type { BodyPart, ExerciseType, Routine, RoutineItem } from '../lib/types';
import { db } from './db';
import { addExercise, listExercises, listRoutines, saveRoutine } from './repository';

type MenuItem = {
  name: string;
  /** 既存のシード種目の名前（参考メニューと表記が違う場合） */
  alias?: string;
  bodyPart: BodyPart;
  type: ExerciseType;
  sets: number;
  reps: string;
  main: boolean;
  inc: number;
  barKg: number | null;
  restSec: number;
  note: string;
};

type Opt = Partial<Pick<MenuItem, 'alias' | 'main' | 'inc' | 'barKg' | 'note' | 'sets'>>;
const W = (name: string, bodyPart: BodyPart, reps: string, restSec: number, o: Opt = {}): MenuItem =>
  ({ name, bodyPart, type: 'weight', sets: 3, reps, main: false, inc: 2.5, barKg: null, restSec, note: '', ...o });
const B = (name: string, bodyPart: BodyPart, reps: string, restSec: number, o: Opt = {}): MenuItem => ({ ...W(name, bodyPart, reps, restSec, o), type: 'bodyweight' });
const T = (name: string, bodyPart: BodyPart, reps: string, restSec: number, o: Opt = {}): MenuItem => ({ ...W(name, bodyPart, reps, restSec, o), type: 'time' });

export const REFERENCE_MENU: { name: string; weekday: number; items: MenuItem[] }[] = [
  {
    name: '脚・筋力',
    weekday: 1,
    items: [
      W('スクワット', 'legs', '5', 180, { main: true, barKg: 20 }),
      W('ヘックスバーデッドリフト', 'legs', '5', 180, { main: true, barKg: 25, note: 'バーの重さはジムのものに合わせて種目設定で変更' }),
      W('ブルガリアンスクワット', 'legs', '左右8', 120, { inc: 2 }),
      W('ヒップスラスト', 'legs', '8〜10', 120),
      W('カーフレイズ', 'legs', '12〜15', 60, { note: '下ろすときは3秒' }),
      T('片脚バランス', 'core', '左右30秒', 30),
      B('チューブで足首を外側にひねる', 'legs', '15', 30),
      W('パロフプレス(足を前後に開いて)', 'core', '左右10', 45, { inc: 1 }),
    ],
  },
  {
    name: '上半身・筋肥大',
    weekday: 2,
    items: [
      W('インクラインスミスベンチ', 'chest', '8', 60, { note: '週ごとにフラットベンチと交互。懸垂と交互に' }),
      B('懸垂', 'back', '8', 60, { note: 'インクラインと交互に' }),
      B('ディップス', 'chest', '10', 60, { note: 'ベントオーバーローと交互に' }),
      W('ベントオーバーロー', 'back', '10', 60, { alias: 'ベントオーバーロウ' }),
      W('ケーブルフライ', 'chest', '12', 90, { inc: 1 }),
      W('インクラインダンベルカール', 'arms', '10', 60, { inc: 1, note: 'サイドレイズと交互に' }),
      W('サイドレイズ', 'shoulders', '15', 60, { inc: 1 }),
      W('スカルクラッシャー', 'arms', '10', 60, { inc: 1, note: 'リアデルトフライと交互に' }),
      W('リアデルトフライ', 'shoulders', '15', 60, { inc: 1 }),
      W('ハンマーカール', 'arms', '12', 60, { inc: 1 }),
      W('パロフプレス(立って)', 'core', '左右10', 45, { inc: 1 }),
    ],
  },
  {
    name: '脚・瞬発',
    weekday: 3,
    items: [
      W('ヘックスバージャンプ', 'legs', '3〜5', 120, { note: '最後まで同じ高さで跳べる回数で' }),
      W('ハイプル', 'legs', '3', 120),
      B('垂直ジャンプ・着地で止める', 'legs', '3', 90, { note: 'その場で跳んで、着地で2秒ピタッと止める。足首が痛む日はスナップダウンに変える' }),
      W('ドロップランジ', 'legs', '左右5', 90, { inc: 2 }),
      W('片足デッドリフト', 'legs', '左右5', 90, { inc: 2 }),
      B('ノルディックハムストリング', 'legs', '5', 120),
      T('コペンハーゲンプランク', 'core', '20秒', 45),
      W('パロフプレス(押したまま3秒止める)', 'core', '左右10', 45, { inc: 1 }),
    ],
  },
  {
    name: '上半身・瞬発',
    weekday: 5,
    items: [
      B('10〜20mダッシュ', 'other', '6〜8本', 60, { sets: 1, note: '1本ごとに1分以上休む' }),
      B('切り返しドリル(5-10-5)', 'other', '4〜6本', 60, { sets: 1, note: '足首が治るまでは7〜8割のスピード' }),
      W('ランドマインローテーション', 'core', '左右5', 90, { note: 'とにかく速く' }),
      W('ピンベンチ', 'chest', '5', 180, { main: true, inc: 1.25, barKg: 20, note: 'ピンの上で1秒止めてから押す' }),
      B('プライオプッシュアップ', 'chest', '5', 60, { note: 'ピンベンチの各セットのあと30〜60秒休んでから' }),
      B('懸垂(スピード重視)', 'back', '5', 120),
      W('ランドマインショルダープレス(片手)', 'shoulders', '5', 120),
      W('ワンハンドダンベルロー', 'back', '10', 90, { inc: 2 }),
      W('パロフプレス(片膝立ち)', 'core', '左右10', 45, { inc: 1 }),
    ],
  },
];

/** 参考メニューの4ルーティンを追加する。種目は名前（alias）一致の非アーカイブ種目を再利用し、無ければ作る */
export async function loadReferenceMenu(): Promise<Routine[]> {
  return db.transaction('rw', [db.routines, db.exercises, db.workouts], () => loadReferenceMenuTx());
}

async function loadReferenceMenuTx(): Promise<Routine[]> {
  const exercises = await listExercises();
  const byName = new Map(exercises.map((e) => [e.name, e.id]));
  const routineNames = new Set((await listRoutines()).map((r) => r.name));
  const created: Routine[] = [];
  for (const day of REFERENCE_MENU) {
    const items: RoutineItem[] = [];
    for (const m of day.items) {
      let id = byName.get(m.alias ?? m.name) ?? byName.get(m.name);
      if (!id) {
        id = (await addExercise({ name: m.name, bodyPart: m.bodyPart, type: m.type, restSec: m.restSec, barKg: m.barKg })).id;
        byName.set(m.name, id);
      }
      items.push({ exerciseId: id, sets: m.sets, reps: m.reps, main: m.main, inc: m.inc, note: m.note });
    }
    let name = day.name;
    for (let n = 2; routineNames.has(name); n++) name = `${day.name}(${n})`;
    routineNames.add(name);
    created.push(await saveRoutine({ name, weekday: day.weekday, items }));
  }
  return created;
}

/** 初回だけ参考メニューを入れる（ルーティンが1件も無い場合） */
export async function ensureMenuSeeded(): Promise<void> {
  // 1つのトランザクションで「確認→投入→記録」を行い、途中失敗や複数タブでの二重投入を防ぐ
  await db.transaction('rw', [db.settings, db.routines, db.exercises, db.workouts], async () => {
    if (await db.settings.get('menuSeeded')) return;
    if ((await db.routines.count()) === 0) await loadReferenceMenu();
    await db.settings.put({ key: 'menuSeeded', at: Date.now() });
  });
}
