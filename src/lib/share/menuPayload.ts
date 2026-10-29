import { BODY_PARTS, WEEKDAY_LABEL, type BodyPart, type ExerciseType } from '../types';
import { encodeShare, shareUrl } from './codec';
import { randomId } from './ids';
import { TYPES } from './sharePayload';
import { arr, fail, id, int, num, str, tup } from './validate';

export type MenuItemTuple = [name: string, part: number, type: number, restSec: number, sets: number, reps: string, main: 0 | 1, inc: number, note: string];
export type MenuPayload = { id: string; n: string; to: string; at: number; mid: string; name: string; weekday: number; items: MenuItemTuple[] };

export type MenuDraftItem = { name: string; bodyPart: BodyPart; type: ExerciseType; restSec: number; sets: number; reps: string; main: boolean; inc: number; note: string };
export type MenuDraft = { name: string; weekday: number | null; items: MenuDraftItem[] };

export interface MenuLog {
  id: string;
  direction: 'sent' | 'received';
  friendId: string;
  friendName: string;
  at: number;
  menu: MenuPayload;
  /** 受け取ったとき: 置き換えたか追加したか */
  result: 'replaced' | 'added' | null;
}

export const MENU = { name: 40, items: 50, restMin: 10, restMax: 600, setsMax: 20, reps: 20, incMin: 0.5, incMax: 20, note: 100 };

export const menuTitle = (name: string, weekday: number | null) => (weekday == null || weekday < 0 ? name : `${name}（${WEEKDAY_LABEL[weekday]}）`);

export function parseMenuPayload(data: unknown): MenuPayload {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) fail();
  const d = data as Record<string, unknown>;
  const items = arr(d.items, MENU.items).map((e): MenuItemTuple => {
    const [name, part, type, rest, sets, reps, main, inc, note] = tup(e, 9);
    return [
      str(name, 1, MENU.name), int(part, 0, BODY_PARTS.length - 1), int(type, 0, TYPES.length - 1), int(rest, MENU.restMin, MENU.restMax),
      int(sets, 1, MENU.setsMax), str(reps, 0, MENU.reps), int(main, 0, 1) as 0 | 1, num(inc, MENU.incMin, MENU.incMax), str(note, 0, MENU.note),
    ];
  });
  if (items.length === 0) fail();
  // 同じ種目が2回あると、受け取った側のルーティン編集が壊れる。目標が空だと編集で保存できない
  const names = items.map((it) => it[0].trim());
  if (new Set(names).size !== names.length || items.some((it) => !it[5].trim())) fail();
  return {
    id: id(d.id), n: str(d.n, 1, 40), to: id(d.to), at: int(d.at, 0, Number.MAX_SAFE_INTEGER), mid: id(d.mid),
    name: str(d.name, 1, MENU.name), weekday: int(d.weekday, -1, 6), items,
  };
}

export async function buildMenuLink(from: { id: string; name: string }, to: string, menu: MenuDraft, now: number) {
  const payload: MenuPayload = {
    id: from.id, n: from.name, to, at: Math.floor(now / 60000), mid: randomId(), name: menu.name, weekday: menu.weekday ?? -1,
    items: menu.items.map((it) => [it.name, BODY_PARTS.indexOf(it.bodyPart), TYPES.indexOf(it.type), it.restSec, it.sets, it.reps, it.main ? 1 : 0, it.inc, it.note]),
  };
  const link = shareUrl(await encodeShare('m', payload));
  return { text: `キントレ部 のメニュー『${menuTitle(menu.name, menu.weekday)}』です。キントレ部 の『友達』タブに貼り付けてね\n${link}`, payload };
}
