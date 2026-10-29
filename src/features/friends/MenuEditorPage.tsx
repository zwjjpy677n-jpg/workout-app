import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { NumberInput } from '../../components/NumberInput';
import { Sheet } from '../../components/Sheet';
import { Stepper } from '../../components/Stepper';
import { logSentMenu } from '../../db/menus';
import { useExercises, useFriend, useProfile } from '../../hooks/useData';
import { formatDuration } from '../../lib/calc';
import { ShareError } from '../../lib/share/codec';
import { queueMenu } from '../../lib/online/outbox';
import { buildMenuLink, buildMenuPayload, MENU, type MenuDraftItem } from '../../lib/share/menuPayload';
import { BODY_PART_LABEL, BODY_PARTS, EXERCISE_TYPE_LABEL, WEEKDAY_LABEL, type BodyPart, type ExerciseType } from '../../lib/types';
import { flushNote, SENT_NOTE, senderIdentity } from './appSend';
import { NameSheet } from './NameSheet';
import { usePreparedLink } from './usePreparedLink';
import { sendText, type ShareNote } from './useShareMine';
import s from './friends.module.css';

type Item = Omit<MenuDraftItem, 'inc'> & { inc: number | null };
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const REST_STEP = 15;

/** 友達に送るメニューを一から組む */
export function MenuEditorPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const friend = useFriend(id);
  const mine = useExercises();
  const profile = useProfile();
  const [name, setName] = useState('');
  const [weekday, setWeekday] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [picking, setPicking] = useState(false);
  const [naming, setNaming] = useState(false);
  const [note, setNote] = useState<ShareNote>(null);
  const [sending, setSending] = useState(false);

  const valid = name.trim().length >= 1 && name.trim().length <= MENU.name && items.length > 0 && items.every((it) => it.inc != null && it.reps.trim() !== '');
  const draft = { name: name.trim(), weekday, items: items.map((it) => ({ ...it, reps: it.reps.trim(), note: it.note.trim(), inc: it.inc ?? 0 })) };
  const link = usePreparedLink(profile && valid ? () => buildMenuLink(profile, id, draft, Date.now()) : null, [profile, valid, JSON.stringify(draft)]);

  if (friend === null) return <Navigate to="/friends" replace />;
  if (!friend || !mine) return null;

  // 友達の種目 → 自分の種目の順、同じ名前は1つ
  const candidates = new Map<string, { bodyPart: BodyPart; type: ExerciseType; restSec: number }>();
  for (const e of [...friend.exercises, ...mine]) if (!candidates.has(e.name.trim())) candidates.set(e.name.trim(), e);
  const add = (n: string, bodyPart: BodyPart, type: ExerciseType) => {
    setItems((cur) => [...cur, { name: n, bodyPart, type, restSec: 90, sets: 3, reps: '10', main: false, inc: 2.5, note: '' }]);
    setPicking(false);
  };
  const patch = (i: number, p: Partial<Item>) => setItems((cur) => cur.map((it, j) => (j === i ? { ...it, ...p } : it)));
  const move = (i: number, d: number) =>
    setItems((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const send = () => {
    setNote(null);
    if (!profile) return setNaming(true);
    if (!link) return;
    if (link instanceof ShareError) return setNote({ kind: 'alert', text: '共有できませんでした' });
    const { text, payload } = link;
    void sendText(text, setNote).then(async (r) => {
      if (r !== 'shared' && r !== 'copied') return;
      await logSentMenu(friend, payload, Date.now());
      navigate(`/friends/${id}?tab=menus`);
    });
  };

  const onlineId = friend.online?.userId;
  const sendInApp = async () => {
    if (!onlineId || sending) return;
    setSending(true);
    setNote(null);
    try {
      const payload = buildMenuPayload(await senderIdentity(), onlineId, draft, Date.now());
      await queueMenu(onlineId, 'built', payload);
      await logSentMenu(friend, payload, Date.now());
      const text = await flushNote();
      // 送れたら送信履歴へ。つながらなかったときは、あとで自動で送ることを見せてから移る
      if (text === SENT_NOTE) navigate(`/friends/${id}?tab=menus`);
      else {
        setNote({ kind: 'status', text });
        setTimeout(() => navigate(`/friends/${id}?tab=menus`), 1500);
      }
    } catch {
      setNote({ kind: 'alert', text: '送れませんでした' });
      setSending(false);
    }
  };

  return (
    <div className="page">
      <button type="button" className={s.back} onClick={() => navigate(`/friends/${id}?tab=menus`)}>‹ {friend.name}</button>
      <h1 className={s.friendName}>{`${friend.name}さんに送るメニュー`}</h1>
      <input className={s.text} aria-label="メニュー名" placeholder="メニュー名（PUSH など）" value={name} onChange={(e) => setName(e.target.value)} maxLength={MENU.name} />
      <div className={s.weekdays}>
        <button type="button" aria-pressed={weekday == null} onClick={() => setWeekday(null)}>なし</button>
        {WEEK.map((d) => (
          <button key={d} type="button" aria-pressed={weekday === d} onClick={() => setWeekday(d)}>{WEEKDAY_LABEL[d]}</button>
        ))}
      </div>

      {items.map((it, i) => (
        <div key={i} role="group" aria-label={it.name} className={s.menuItem}>
          <div className={s.menuItemHead}>
            <b>{it.name}</b>
            <button type="button" aria-label="上へ" onClick={() => move(i, -1)}>↑</button>
            <button type="button" aria-label="下へ" onClick={() => move(i, 1)}>↓</button>
            <button type="button" aria-label="外す" onClick={() => setItems((cur) => cur.filter((_, j) => j !== i))}>×</button>
          </div>
          <div className={s.menuGrid}>
            <div className={s.small}>
              <span>セット</span>
              <Stepper label="セット" unit="セット" value={it.sets} onChange={(v) => v != null && patch(i, { sets: v })} step={1} min={1} max={MENU.setsMax} inputMode="numeric" />
            </div>
            <div className={s.small}>
              <span>レスト</span>
              <div className={s.rest}>
              <button type="button" aria-label="レストを減らす" onClick={() => patch(i, { restSec: Math.max(MENU.restMin, it.restSec - REST_STEP) })}>−</button>
              <output aria-label="レスト">{formatDuration(it.restSec)}</output>
              <button type="button" aria-label="レストを増やす" onClick={() => patch(i, { restSec: Math.min(MENU.restMax, it.restSec + REST_STEP) })}>＋</button>
              </div>
            </div>
            <label className={s.small}><span>目標</span><input className={s.text} aria-label="目標" value={it.reps} maxLength={MENU.reps} onChange={(e) => patch(i, { reps: e.target.value })} /></label>
            <label className={s.small}><span>上げ幅kg</span><NumberInput aria-label="上げ幅" value={it.inc} onChange={(v) => patch(i, { inc: v })} min={MENU.incMin} max={MENU.incMax} inputMode="decimal" keepInvalid /></label>
          </div>
          <div className={s.menuGrid}>
            <label className={s.checkRow}><input type="checkbox" aria-label="メイン" checked={it.main} onChange={(e) => patch(i, { main: e.target.checked })} />メイン</label>
            <input className={s.text} aria-label="メモ" placeholder="メモ" value={it.note} maxLength={MENU.note} onChange={(e) => patch(i, { note: e.target.value })} />
          </div>
        </div>
      ))}

      {items.length < MENU.items && <Button block onClick={() => setPicking(true)}>＋ 種目を追加</Button>}
      {note && <p role={note.kind} className={note.kind === 'alert' ? s.error : s.ok}>{note.text}</p>}
      {onlineId && <Button block variant="primary" className={s.sendFb} disabled={!valid || sending} onClick={sendInApp}>アプリで送る</Button>}
      <Button block variant={onlineId ? undefined : 'primary'} className={s.sendFb} disabled={!valid || (!!profile && !link)} onClick={send}>{onlineId ? 'リンクで送る' : '送る'}</Button>

      <PickSheet open={picking} candidates={candidates} added={new Set(items.map((it) => it.name.trim()))} onPick={add} onClose={() => setPicking(false)} />
      <NameSheet open={naming} initial="" onClose={() => setNaming(false)} onShare={send} ready={!!link} />
    </div>
  );
}

type PickProps = {
  open: boolean;
  candidates: Map<string, { bodyPart: BodyPart; type: ExerciseType }>;
  /** 追加済みの種目名（同じ種目は2回入れられない） */
  added: Set<string>;
  onPick(name: string, bodyPart: BodyPart, type: ExerciseType): void;
  onClose(): void;
};

function PickSheet({ open, candidates, added, onPick, onClose }: PickProps) {
  const [name, setName] = useState('');
  const [part, setPart] = useState<BodyPart>('chest');
  const [type, setType] = useState<ExerciseType>('weight');
  const n = name.trim();
  return (
    <Sheet open={open} title="種目を追加" onClose={onClose}>
      <div className={s.pickList}>
        {[...candidates].map(([nm, e]) => (
          <button key={nm} type="button" className={s.pick} disabled={added.has(nm)} onClick={() => onPick(nm, e.bodyPart, e.type)}>{nm}</button>
        ))}
      </div>
      <div className={s.newEx}>
        <input className={s.text} aria-label="新しい種目の名前" placeholder="新しい種目の名前" value={name} maxLength={MENU.name} onChange={(e) => setName(e.target.value)} />
        <select className={s.text} aria-label="部位" value={part} onChange={(e) => setPart(e.target.value as BodyPart)}>
          {BODY_PARTS.map((b) => <option key={b} value={b}>{BODY_PART_LABEL[b]}</option>)}
        </select>
        <select className={s.text} aria-label="タイプ" value={type} onChange={(e) => setType(e.target.value as ExerciseType)}>
          {(Object.keys(EXERCISE_TYPE_LABEL) as ExerciseType[]).map((t) => <option key={t} value={t}>{EXERCISE_TYPE_LABEL[t]}</option>)}
        </select>
        <Button
          block
          disabled={!n || added.has(n)}
          onClick={() => {
            onPick(n, part, type);
            setName('');
          }}
        >
          追加
        </Button>
      </div>
    </Sheet>
  );
}
