import { BODY_PARTS, emptyCondition, type Exercise, type Routine, type Workout, type WorkoutSet } from '../types';
import { ShareError } from './codec';
import { TYPES, type SetTuple, type SharePayload } from './sharePayload';

export interface Friend {
  id: string;
  name: string;
  /** 最後に記録を受け取った時刻 */
  receivedAt: number;
  /** 友達がリンクを作った時刻 */
  sharedAt: number;
  exercises: Exercise[];
  routines: Routine[];
  prs: { exerciseId: string; set: WorkoutSet }[];
}

/** 自分の Workout と同じ形にして、グラフや要約の関数をそのまま使う */
export interface FriendWorkout extends Workout {
  friendId: string;
}

// --- 検証（細工されたリンクも来る前提で、型と値の範囲を全部確かめる） ---
const fail = (): never => {
  throw new ShareError('invalid');
};
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const int = (v: unknown, lo: number, hi: number) => (isNum(v) && Number.isInteger(v) && v >= lo && v <= hi ? v : fail());
const numOrNull = (v: unknown, lo: number, hi: number) => (v === null ? null : isNum(v) && v >= lo && v <= hi ? v : fail());
const str = (v: unknown, lo: number, hi: number) => (typeof v === 'string' && v.length >= lo && v.length <= hi ? v : fail());
const id = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : fail());
const arr = (v: unknown, max: number) => (Array.isArray(v) && v.length <= max ? v : fail());
const tup = (v: unknown, n: number) => (Array.isArray(v) && v.length === n ? v : fail());

const setTuple = (v: unknown): SetTuple => {
  const [w, r, s, rpe] = tup(v, 4);
  return [numOrNull(w, -200, 1000), numOrNull(r, 0, 999), numOrNull(s, 0, 36000), numOrNull(rpe, 1, 10)];
};

export function parseSharePayload(data: unknown): SharePayload {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) fail();
  const d = data as Record<string, unknown>;
  const x = arr(d.x, 300).map((e): SharePayload['x'][number] => {
    const [i8, name, part, type] = tup(e, 4);
    return [id(i8), str(name, 1, 40), int(part, 0, BODY_PARTS.length - 1), int(type, 0, TYPES.length - 1)];
  });
  const xi = (v: unknown) => int(v, 0, x.length - 1);
  return {
    id: id(d.id),
    n: str(d.n, 1, 40),
    at: int(d.at, 0, Number.MAX_SAFE_INTEGER),
    x,
    w: arr(d.w, 500).map((e): SharePayload['w'][number] => {
      const [w8, start, name, entries] = tup(e, 4);
      return [
        id(w8),
        int(start, 0, Number.MAX_SAFE_INTEGER),
        str(name, 0, 40),
        arr(entries, 50).map((en): [number, SetTuple[]] => {
          const [i, sets] = tup(en, 2);
          return [xi(i), arr(sets, 50).map(setTuple)];
        }),
      ];
    }),
    r: arr(d.r, 30).map((e): SharePayload['r'][number] => {
      const [name, weekday, items] = tup(e, 3);
      return [
        str(name, 1, 40),
        int(weekday, -1, 6),
        arr(items, 50).map((it): [number, number, string, 0 | 1] => {
          const [i, sets, reps, main] = tup(it, 4);
          return [xi(i), int(sets, 1, 20), str(reps, 0, 20), int(main, 0, 1) as 0 | 1];
        }),
      ];
    }),
    p: arr(d.p, 300).map((e): [number, SetTuple] => {
      const [i, s] = tup(e, 2);
      return [xi(i), setTuple(s)];
    }),
  };
}

// --- 変換 ---
const toSet = ([weight, reps, durationSec, rpe]: SetTuple): WorkoutSet => ({ weight, reps, durationSec, rpe, warmup: false, note: '', done: true });

export function toFriendRecords(p: SharePayload, receivedAt: number): { friend: Friend; workouts: FriendWorkout[] } {
  const exId = (i: number) => `${p.id}:${p.x[i][0]}`;
  const exercises: Exercise[] = p.x.map(([, name, part, type], i) => ({
    id: exId(i), name, bodyPart: BODY_PARTS[part], type: TYPES[type], restSec: 0, archived: false, createdAt: 0, barKg: null,
  }));
  const routines: Routine[] = p.r.map(([name, weekday, items], i) => ({
    id: `${p.id}:r${i}`,
    name,
    weekday: weekday < 0 ? null : weekday,
    createdAt: 0,
    items: items.map(([xi, sets, reps, main]) => ({ exerciseId: exId(xi), sets, reps, main: main === 1, inc: 0, note: '' })),
  }));
  const workouts: FriendWorkout[] = p.w.map(([w8, start, name, entries]) => ({
    id: `${p.id}:${w8}`,
    friendId: p.id,
    name,
    startedAt: start * 60000,
    endedAt: start * 60000,
    note: '',
    condition: emptyCondition(),
    routineId: null,
    entries: entries.map(([xi, sets]) => ({ exerciseId: exId(xi), sets: sets.map(toSet) })),
  }));
  const friend: Friend = {
    id: p.id, name: p.n, receivedAt, sharedAt: p.at * 60000, exercises, routines,
    prs: p.p.map(([xi, s]) => ({ exerciseId: exId(xi), set: toSet(s) })),
  };
  return { friend, workouts };
}
