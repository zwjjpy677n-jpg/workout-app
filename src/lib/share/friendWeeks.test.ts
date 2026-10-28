import { entry, ex, exMap, set, wk } from '../../test/factories';
import { friendWeeks } from './friendWeeks';
import type { FriendWorkout } from './importShare';

const sq = ex('f:sq', { name: 'スクワット' });
const pull = ex('f:pull', { name: '懸垂', type: 'bodyweight' });
const fw = (d: Date, sets: Parameters<typeof set>[0][], id = String(d.getTime())): FriendWorkout => ({ ...wk(d, [entry(sq.id, sets.map((o) => set(o))), entry(pull.id, [set({ weight: 10, reps: 8 })])], { id }), friendId: 'f' });

test('月曜はじまりで新しい週から分かれ、同じ日の2回は1日、総ボリュームは重量種目の本番セットだけ', () => {
  const ws = [
    fw(new Date(2026, 9, 26, 9), [{ weight: 100, reps: 5 }]), // 月
    fw(new Date(2026, 9, 26, 18), [{ weight: 100, reps: 5 }, { weight: 60, reps: 10, warmup: true }]), // 月（同じ日）
    fw(new Date(2026, 9, 28, 18), [{ weight: 50, reps: 10 }]), // 水
    fw(new Date(2026, 9, 25, 18), [{ weight: 80, reps: 5 }]), // 前の週の日曜
    fw(new Date(2026, 9, 5, 18), [{ weight: 70, reps: 5 }]), // 3週前（間の週は記録なし）
  ];
  const weeks = friendWeeks(ws, exMap(sq, pull));
  expect(weeks.map((w) => [new Date(w.start).getDate(), w.days, w.volume, w.workouts.length])).toEqual([
    [26, 2, 1500, 3],
    [19, 1, 400, 1],
    [5, 1, 350, 1],
  ]);
  expect(weeks[0].workouts.map((w) => new Date(w.startedAt).getDate())).toEqual([28, 26, 26]);
  expect(new Date(weeks[0].end).getDate()).toBe(1);
});
