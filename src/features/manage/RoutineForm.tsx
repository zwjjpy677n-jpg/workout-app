import { useState } from 'react';
import { Button } from '../../components/Button';
import { NumberInput } from '../../components/NumberInput';
import { Sheet } from '../../components/Sheet';
import { deleteRoutine, saveRoutine } from '../../db/repository';
import { useExerciseMap, useExercises } from '../../hooks/useData';
import { BODY_PART_LABEL, BODY_PARTS, defaultItem, WEEKDAY_LABEL, type Routine, type RoutineItem } from '../../lib/types';
import s from './manage.module.css';

export function RoutineForm({ routine, onClose }: { routine: Routine | null; onClose(): void }) {
  const exercises = useExercises();
  const map = useExerciseMap();
  const [name, setName] = useState(routine?.name ?? '');
  const [weekday, setWeekday] = useState<number | null>(routine?.weekday ?? null);
  const [items, setItems] = useState<RoutineItem[]>(routine?.items ?? []);
  const [error, setError] = useState('');
  /** 範囲外・空の入力がある欄（`${exerciseId}:sets` / `${exerciseId}:inc`） */
  const [bad, setBad] = useState<Set<string>>(new Set());
  const mark = (key: string, ok: boolean) =>
    setBad((cur) => {
      const next = new Set(cur);
      if (ok) next.delete(key);
      else next.add(key);
      return next;
    });

  const has = (id: string) => items.some((i) => i.exerciseId === id);
  const toggle = (id: string) => {
    // 外す・付け直すと初期値に戻るので、その種目の入力エラーも消す
    mark(`${id}:sets`, true);
    mark(`${id}:inc`, true);
    mark(`${id}:rest`, true);
    setItems((cur) => (has(id) ? cur.filter((i) => i.exerciseId !== id) : [...cur, defaultItem(id)]));
  };
  const patch = (idx: number, p: Partial<RoutineItem>) => setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  const move = (i: number, d: number) =>
    setItems((cur) => {
      const next = [...cur];
      const j = i + d;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function save() {
    if (!name.trim()) return setError('名前を入力してください');
    if (items.length === 0) return setError('種目を1つ以上選んでください');
    if (items.some((i) => !i.reps.trim())) return setError('回数を入力してください');
    const badRest = items.find((i) => bad.has(`${i.exerciseId}:rest`));
    if (badRest) return setError(`${map?.get(badRest.exerciseId)?.name ?? ''}のレストは10〜600秒で入力してください`);
    const badItem = items.find((i) => bad.has(`${i.exerciseId}:sets`) || bad.has(`${i.exerciseId}:inc`));
    if (badItem) return setError(`${map?.get(badItem.exerciseId)?.name ?? ''}のセット数は1〜20、上げ幅は0.5〜20kgで入力してください`);
    await saveRoutine({ ...routine, name: name.trim(), weekday, items });
    onClose();
  }

  async function remove() {
    if (routine && window.confirm(`ルーティン「${routine.name}」を削除しますか？`)) {
      await deleteRoutine(routine.id);
      onClose();
    }
  }

  return (
    <Sheet open title={routine ? 'ルーティンを編集' : 'ルーティンを追加'} onClose={onClose}>
      <label className={s.field}>
        <span>ルーティン名</span>
        <input className={s.text} aria-label="ルーティン名" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={s.field}>
        <span>曜日</span>
        <select className={s.select} aria-label="曜日" value={weekday ?? ''} onChange={(e) => setWeekday(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">なし</option>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{WEEKDAY_LABEL[d]}曜</option>)}
        </select>
      </label>
      {items.length > 0 && (
        <div className={s.field}>
          <span>種目と目標</span>
          {items.map((it, i) => {
            const n = map?.get(it.exerciseId)?.name ?? '—';
            return (
              <div key={it.exerciseId} className={s.itemBox}>
                <div className={s.order}>
                  <span>{n}</span>
                  <button type="button" aria-label="上へ" onClick={() => move(i, -1)}>↑</button>
                  <button type="button" aria-label="下へ" onClick={() => move(i, 1)}>↓</button>
                </div>
                <div className={s.itemGrid}>
                  <label><span>セット（1〜20）</span><NumberInput aria-label={`${n} セット数`} value={it.sets} onChange={(v) => { mark(`${it.exerciseId}:sets`, v != null); if (v != null) patch(i, { sets: v }); }} min={1} max={20} inputMode="numeric" keepInvalid /></label>
                  <label><span>回数</span><input className={s.text} aria-label={`${n} 回数`} value={it.reps} onChange={(e) => patch(i, { reps: e.target.value })} /></label>
                  <label><span>上げ幅kg（0.5〜20）</span><NumberInput aria-label={`${n} 上げ幅`} value={it.inc} onChange={(v) => { mark(`${it.exerciseId}:inc`, v != null); if (v != null) patch(i, { inc: v }); }} min={0.5} max={20} inputMode="decimal" keepInvalid /></label>
                  <label><span>レスト秒（空欄=種目の設定）</span><NumberInput aria-label={`${n} レスト秒`} value={it.restSec ?? null} onChange={(v) => patch(i, { restSec: v })} onInvalidChange={(bad) => mark(`${it.exerciseId}:rest`, !bad)} min={10} max={600} inputMode="numeric" placeholder={String(map?.get(it.exerciseId)?.restSec ?? '')} keepInvalid allowEmpty /></label>
                  <label className={s.checkInline}><input type="checkbox" aria-label={`${n} メイン`} checked={it.main} onChange={(e) => patch(i, { main: e.target.checked })} />メイン</label>
                </div>
                <input className={s.text} aria-label={`${n} メモ`} placeholder="メモ" value={it.note} onChange={(e) => patch(i, { note: e.target.value })} />
              </div>
            );
          })}
        </div>
      )}
      {BODY_PARTS.map((bp) => {
        const list = exercises?.filter((e) => e.bodyPart === bp) ?? [];
        if (!list.length) return null;
        return (
          <div key={bp} className={s.group}>
            <h3>{BODY_PART_LABEL[bp]}</h3>
            {list.map((e) => (
              <label key={e.id} className={s.check}>
                <input type="checkbox" checked={has(e.id)} onChange={() => toggle(e.id)} />
                {e.name}
              </label>
            ))}
          </div>
        );
      })}
      {error && <p className={s.error}>{error}</p>}
      <div className={s.actions}>
        {routine && <Button variant="danger" onClick={remove}>削除</Button>}
        <Button variant="primary" onClick={save}>保存</Button>
      </div>
    </Sheet>
  );
}
