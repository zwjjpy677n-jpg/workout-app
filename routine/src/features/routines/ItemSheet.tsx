import { useState } from 'react';
import { Button } from '../../../../src/components/Button';
import { NumberInput } from '../../../../src/components/NumberInput';
import { Sheet } from '../../../../src/components/Sheet';
import { deleteItem, saveItem, setItemActive } from '../../db/repo';
import { SLOTS, type Item, type Slot } from '../../lib/types';
import s from './routines.module.css';

const EVERY = [0, 1, 2, 3, 4, 5, 6];
const WD = ['日', '月', '火', '水', '木', '金', '土'];

function Choice<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange(v: T): void }) {
  return (
    <div className={s.choice}>
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>{o.label}</button>
      ))}
    </div>
  );
}

/** 項目の追加・編集。item がなければ追加 */
export function ItemSheet({ item, onClose }: { item?: Item; onClose(): void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [slot, setSlot] = useState<Slot>(item?.slot ?? 'morning');
  const [days, setDays] = useState<number[]>(item?.days ?? EVERY);
  const [pickDays, setPickDays] = useState(item ? item.days.length < 7 : false);
  const [kind, setKind] = useState<Item['kind']>(item?.kind ?? 'check');
  const [target, setTarget] = useState<number | null>(item?.target ?? null);
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [step, setStep] = useState<number | null>(item?.step ?? 1);
  const [confirming, setConfirming] = useState(false);

  const ok = name.trim() !== '' && days.length > 0 && (kind === 'check' || (target != null && target > 0));
  const toggleDay = (d: number) => setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d].sort((a, b) => a - b)));
  const done = (f: () => Promise<unknown>) => async () => {
    await f();
    onClose();
  };

  async function save() {
    const base = { id: item?.id, name: name.trim(), slot, days, kind };
    const input = kind === 'number' ? { ...base, target: target!, unit: unit.trim(), step: step ?? 1 } : base;
    await saveItem(input, Date.now());
    onClose();
  }

  return (
    <Sheet open title={item ? '項目を編集' : '項目を追加'} onClose={onClose}>
      <div className={s.form}>
        <label className={s.field}>
          <span>名前</span>
          <input aria-label="名前" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className={s.field}>
          <span>時間帯</span>
          <Choice<Slot> options={SLOTS} value={slot} onChange={setSlot} />
        </div>
        <div className={s.field}>
          <span>曜日</span>
          <Choice
            options={[{ key: 'every', label: '毎日' }, { key: 'pick', label: '曜日を選ぶ' }]}
            value={pickDays ? 'pick' : 'every'}
            onChange={(v) => {
              setPickDays(v === 'pick');
              if (v === 'every') setDays(EVERY);
            }}
          />
          {pickDays && (
            <div className={s.days}>
              {WD.map((w, d) => (
                <button key={w} type="button" aria-pressed={days.includes(d)} onClick={() => toggleDay(d)}>{w}</button>
              ))}
            </div>
          )}
        </div>
        <div className={s.field}>
          <span>種類</span>
          <Choice<Item['kind']> options={[{ key: 'check', label: 'チェック' }, { key: 'number', label: '数値' }]} value={kind} onChange={setKind} />
        </div>
        {kind === 'number' && (
          <div className={s.nums}>
            <label className={s.field}>
              <span>目標</span>
              <NumberInput aria-label="目標" value={target} onChange={setTarget} min={0} max={100000} inputMode="decimal" />
            </label>
            <label className={s.field}>
              <span>単位</span>
              <input aria-label="単位" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ml" />
            </label>
            <label className={s.field}>
              <span>増減の幅</span>
              <NumberInput aria-label="増減の幅" value={step} onChange={setStep} min={0.01} max={10000} inputMode="decimal" />
            </label>
          </div>
        )}
        <Button variant="primary" block disabled={!ok} onClick={() => void save()}>保存</Button>
        {item && (
          <div className={s.danger}>
            <Button block onClick={done(() => setItemActive(item.id, !item.active))}>{item.active ? '休止する' : '再開する'}</Button>
            {confirming ? (
              <Button block variant="danger" onClick={done(() => deleteItem(item.id, Date.now()))}>削除する</Button>
            ) : (
              <Button block variant="danger" onClick={() => setConfirming(true)}>削除</Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
