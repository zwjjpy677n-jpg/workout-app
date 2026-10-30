import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Sheet } from '../../components/Sheet';
import { formatMD } from '../../lib/dates';
import { getApi } from '../../lib/online/api';
import { getSession } from '../../lib/online/prefs';
import { workoutMinutes } from '../../lib/online/sharedWorkout';
import { EMOJIS, OnlineError, type Emoji } from '../../lib/online/types';
import { PUBLIC_URL } from '../../lib/platform';
import { summarizeSets } from '../calendar/summarizeSets';
import { sendText, type ShareNote } from '../friends/useShareMine';
import { FEED_DAYS, useGroup, type FeedItem, type GroupData } from './useGroup';
import f from '../friends/friends.module.css';
import s from './groups.module.css';

export const GROUP_NAME_MAX = 30;
export const COMMENT_MAX = 200;
const FAILED = 'できませんでした。つながるところでもう一度お試しください';

const hm = (t: number) => {
  const d = new Date(t);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const same = (a: FeedItem['key'], b: { owner: string; id: string }) => a.owner === b.owner && a.id === b.id;

/** 「たろう ・ 脚の日 ・ 62分 ・ 10/29 18:30」 */
export function feedTitle(it: FeedItem): string {
  const m = workoutMinutes(it.workout);
  return [it.who, it.workout.name, m == null ? null : `${m}分`, `${formatMD(it.workout.startedAt)} ${hm(it.workout.startedAt)}`].filter(Boolean).join(' ・ ');
}

export function GroupPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { state, reload } = useGroup(id);
  const me = getSession()?.userId ?? '';
  const [sheet, setSheet] = useState<'members' | 'rename' | null>(null);
  const [open, setOpen] = useState<FeedItem['key'] | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState<ShareNote>(null);

  // iPhone は共有をタップの直後に呼ぶ必要があるので、招待リンクは前もって作っておく
  const [link, setLink] = useState<string | null>(null);
  const [linkFailed, setLinkFailed] = useState(false);
  const made = useRef(0);
  const groupName = typeof state === 'object' ? state.group.name : null;
  const prepare = () => {
    const n = ++made.current;
    setLink(null);
    setLinkFailed(false);
    getApi()!
      .createGroupInvite(id)
      .then((c) => n === made.current && setLink(`キントレ部のグループ「${groupName}」に入ろう！ このリンクを開いてね\n${PUBLIC_URL}#/join?c=${c}&g=${id}`))
      .catch(() => n === made.current && setLinkFailed(true));
  };
  useEffect(() => {
    if (groupName != null) prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupName]);

  /** サーバーに書いて取り直す。失敗したら一言出す */
  const act = async (task: () => Promise<unknown>): Promise<boolean> => {
    setError('');
    try {
      await task();
      await reload();
      return true;
    } catch (e) {
      setError(e instanceof OnlineError && e.code === 'auth' ? 'ログインし直してください（友達タブ）' : FAILED);
      return false;
    }
  };

  const back = <button type="button" className={f.back} onClick={() => navigate('/friends')}>‹ 友達</button>;
  if (!getApi()) return <div className="page">{back}</div>;
  if (state === 'loading') return <div className="page">{back}<p role="status" className={f.hint}>読み込んでいます…</p></div>;
  if (typeof state === 'string') {
    const text =
      state === 'gone' ? 'このグループは見つかりません（抜けたか、なくなりました）'
        : state === 'auth' ? 'ログインが切れました。友達タブからログインし直してください'
          : '今はつながりません。つながるところでもう一度開いてください';
    return (
      <div className="page">
        {back}
        <p role="alert" className={f.error}>{text}</p>
        {state === 'offline' && <Button block onClick={() => void reload().catch(() => undefined)}>もう一度</Button>}
      </div>
    );
  }

  const { group, members, feed } = state;
  const owner = group.owner === me;
  const leave = async () => {
    const last = members.length <= 1;
    if (!window.confirm(last ? `グループ「${group.name}」を抜けますか？ 最後の1人なので、グループはなくなります` : `グループ「${group.name}」を抜けますか？`)) return;
    setError('');
    try {
      await getApi()!.leaveGroup(group.id);
      navigate('/friends', { replace: true });
    } catch {
      setError(FAILED);
    }
  };
  const openItem = open ? feed.find((it) => same(it.key, open)) ?? null : null;

  return (
    <div className="page">
      {back}
      <h1 className={f.friendName}>{group.name}</h1>
      <button type="button" className={s.membersLink} onClick={() => setSheet('members')}>{`メンバー ${members.length}人`}</button>

      <div className={f.actions}>
        <Button block variant="primary" disabled={!link && !linkFailed} onClick={() => (link ? void sendText(link, setNote) : prepare())}>
          {linkFailed ? 'メンバーを招待（もう一度）' : 'メンバーを招待'}
        </Button>
        {note && <p role={note.kind} className={note.kind === 'alert' ? f.error : f.ok}>{note.text}</p>}
      </div>
      {error && !openItem && sheet == null && <p role="alert" className={f.error}>{error}</p>}

      {feed.length === 0 && <p className={f.empty}>{`直近${FEED_DAYS}日の記録はまだありません。トレーニングを終えると、ここにメンバーの記録が出ます`}</p>}
      <div className={s.feed}>
        {feed.map((it) => (
          <FeedCard key={`${it.key.owner}|${it.key.id}`} item={it} data={state} me={me} onOpen={() => setOpen(it.key)} />
        ))}
      </div>

      {owner && <button type="button" className={f.link} onClick={() => setSheet('rename')}>グループの名前を変える</button>}
      <button type="button" className={f.link} onClick={() => void leave()}>グループを抜ける</button>

      <Sheet open={sheet === 'members'} title="メンバー" onClose={() => setSheet(null)}>
        <ul className={s.members}>
          {members.map((m) => (
            <li key={m.userId}>
              {m.name}
              {m.userId === group.owner && <small className={f.hint}> （作った人）</small>}
              {m.userId === me && <small className={f.hint}> （自分）</small>}
            </li>
          ))}
        </ul>
      </Sheet>
      <RenameSheet
        open={sheet === 'rename'}
        initial={group.name}
        error={error}
        onClose={() => setSheet(null)}
        onSave={async (name) => (await act(() => getApi()!.renameGroup(group.id, name))) && setSheet(null)}
      />
      <WorkoutSheet item={openItem} data={state} me={me} error={error} act={act} onClose={() => { setOpen(null); setError(''); }} />
    </div>
  );
}

function reactionCounts(data: GroupData, it: FeedItem, me: string) {
  const rs = data.reactions.filter((r) => same(it.key, r));
  return EMOJIS.map((e) => ({ emoji: e, count: rs.filter((r) => r.emoji === e).length, mine: rs.some((r) => r.emoji === e && r.userId === me) }));
}

function FeedCard({ item, data, me, onOpen }: { item: FeedItem; data: GroupData; me: string; onOpen(): void }) {
  const counts = reactionCounts(data, item, me).filter((c) => c.count > 0);
  const n = data.comments.filter((c) => same(item.key, c)).length;
  return (
    <Card onClick={onOpen}>
      <div className={f.day}>{feedTitle(item)}</div>
      <div className={s.meta}>
        <span>{`${item.workout.entries.length}種目`}</span>
        {counts.map((c) => <span key={c.emoji}>{`${c.emoji}${c.count}`}</span>)}
        {n > 0 && <span>{`💬${n}`}</span>}
      </div>
    </Card>
  );
}

type SheetProps = {
  item: FeedItem | null;
  data: GroupData;
  me: string;
  error: string;
  act(task: () => Promise<unknown>): Promise<boolean>;
  onClose(): void;
};

function WorkoutSheet({ item, data, me, error, act, onClose }: SheetProps) {
  const [text, setText] = useState('');
  const busy = useRef(false);
  useEffect(() => setText(''), [item?.key.owner, item?.key.id]);
  if (!item) return <Sheet open={false} title="" onClose={onClose}>{null}</Sheet>;
  const api = getApi()!;
  const comments = data.comments.filter((c) => same(item.key, c));
  const v = text.trim();
  const once = async (task: () => Promise<unknown>) => {
    if (busy.current) return false;
    busy.current = true;
    try {
      return await act(task);
    } finally {
      busy.current = false;
    }
  };
  const toggle = (emoji: Emoji, on: boolean) => void once(() => api.setReaction(item.key, emoji, on));
  const send = async () => {
    if (await once(() => api.addComment(item.key, v))) setText('');
  };
  const remove = (commentId: string) => {
    if (window.confirm('このコメントを削除しますか？')) void once(() => api.deleteComment(commentId));
  };

  return (
    <Sheet open title={feedTitle(item)} onClose={onClose}>
      {item.workout.entries.map((e, i) => {
        const ex = data.exercises.get(e.exerciseId);
        if (!ex) return null;
        return (
          <div key={i} className={f.entry}>
            <span>{ex.name}</span>
            <span className="num">{summarizeSets(ex.type, e.sets)}</span>
          </div>
        );
      })}
      <div role="group" aria-label="リアクション" className={s.reactions}>
        {reactionCounts(data, item, me).map((c) => (
          <button key={c.emoji} type="button" aria-pressed={c.mine} aria-label={`${c.emoji} ${c.count}`} className={s.reaction} onClick={() => toggle(c.emoji, !c.mine)}>
            {c.emoji}
            <span className="num">{c.count}</span>
          </button>
        ))}
      </div>
      <section aria-label="コメント" className={s.comments}>
        {comments.map((c) => (
          <div key={c.commentId} className={s.comment}>
            <b>{data.names.get(c.userId) ?? 'メンバー外の人'}</b>
            <span>{c.body}</span>
            {c.userId === me && <button type="button" className={s.del} aria-label="自分のコメントを削除" onClick={() => remove(c.commentId)}>削除</button>}
          </div>
        ))}
      </section>
      <textarea aria-label="コメントを書く" className={f.area} rows={2} maxLength={COMMENT_MAX} value={text} onChange={(e) => setText(e.target.value)} placeholder={`コメント（${COMMENT_MAX}文字まで）`} />
      {error && <p role="alert" className={f.error}>{error}</p>}
      <Button block variant="primary" disabled={!v} onClick={() => void send()}>コメントする</Button>
    </Sheet>
  );
}

function RenameSheet({ open, initial, error, onClose, onSave }: { open: boolean; initial: string; error: string; onClose(): void; onSave(name: string): void }) {
  const [name, setName] = useState(initial);
  useEffect(() => setName(initial), [open, initial]);
  const v = name.trim();
  return (
    <Sheet open={open} title="グループの名前" onClose={onClose}>
      <input className={f.text} aria-label="グループの名前" value={name} maxLength={GROUP_NAME_MAX} onChange={(e) => setName(e.target.value)} />
      {error && <p role="alert" className={f.error}>{error}</p>}
      <Button block variant="primary" disabled={!v || v === initial} onClick={() => onSave(v)}>保存</Button>
    </Sheet>
  );
}
