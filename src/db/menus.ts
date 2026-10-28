import type { MenuLog, MenuPayload } from '../lib/share/menuPayload';
import { TYPES } from '../lib/share/sharePayload';
import { BODY_PARTS, type Exercise, type Routine, type RoutineItem } from '../lib/types';
import { db } from './db';
import { getProfile } from './friends';
import { addExercise, saveRoutine } from './repository';

const logId = (direction: MenuLog['direction'], mid: string) => `${direction}:${mid}`;
const norm = (s: string) => s.trim();

export async function logSentMenu(friend: { id: string; name: string }, menu: MenuPayload, at: number): Promise<void> {
  await db.menuLog.put({ id: logId('sent', menu.mid), direction: 'sent', friendId: friend.id, friendName: friend.name, at, menu, result: null });
}

export async function listMenuLog(direction: MenuLog['direction'], friendId?: string): Promise<MenuLog[]> {
  return (await db.menuLog.toArray()).filter((l) => l.direction === direction && (friendId == null || l.friendId === friendId)).sort((a, b) => b.at - a.at);
}

/** 名前（前後の空白を除いて完全一致）で、使える（アーカイブしていない）自分の種目を探す */
async function exerciseByName(): Promise<Map<string, Exercise>> {
  const list = (await db.exercises.toArray()).filter((e) => !e.archived);
  return new Map(list.map((e) => [norm(e.name), e]));
}

export async function previewMenu(p: MenuPayload) {
  const mine = (await getProfile())?.id === p.to;
  const received = !!(await db.menuLog.get(logId('received', p.mid)));
  const byName = await exerciseByName();
  const newExercises = [...new Set(p.items.map((it) => norm(it[0])).filter((n) => !byName.has(n)))];
  const sameName = (await db.routines.toArray()).find((r) => norm(r.name) === norm(p.name)) ?? null;
  return { mine, received, newExercises, sameName };
}

/** 無い種目を作り、メニューを置き換え（ID はそのまま）または追加して、受け取った履歴を残す */
export async function importMenu(p: MenuPayload, mode: 'replace' | 'add', now: number): Promise<Routine> {
  return db.transaction('rw', db.exercises, db.routines, db.menuLog, async () => {
    const byName = await exerciseByName();
    const items: RoutineItem[] = [];
    for (const [name, part, type, restSec, sets, reps, main, inc, note] of p.items) {
      let e = byName.get(norm(name));
      if (!e) {
        e = await addExercise({ name: norm(name), bodyPart: BODY_PARTS[part], type: TYPES[type], restSec, barKg: null });
        byName.set(norm(name), e);
      }
      items.push({ exerciseId: e.id, sets, reps, main: main === 1, inc, note, restSec });
    }
    const same = mode === 'replace' ? (await db.routines.toArray()).find((r) => norm(r.name) === norm(p.name)) : undefined;
    const weekday = p.weekday < 0 ? null : p.weekday;
    const routine = same ? await saveRoutine({ ...same, weekday, items }) : await saveRoutine({ name: norm(p.name), weekday, items });
    await db.menuLog.put({ id: logId('received', p.mid), direction: 'received', friendId: p.id, friendName: p.n, at: now, menu: p, result: same ? 'replaced' : 'added' });
    return routine;
  });
}
