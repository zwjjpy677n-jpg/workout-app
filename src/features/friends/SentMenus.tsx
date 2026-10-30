import { useRef, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { deleteMenuLog } from '../../db/menus';
import { useMenuLog } from '../../hooks/useData';
import { formatDuration } from '../../lib/calc';
import { formatMD } from '../../lib/dates';
import { unsendMenu } from '../../lib/online/outbox';
import { OnlineError } from '../../lib/online/types';
import { menuTitle, type MenuLog } from '../../lib/share/menuPayload';
import s from './friends.module.css';

/** 送った（または受け取った）メニューの中身。actions はシートの下に出すボタン */
export function MenuLogSheet({ log, onClose, actions }: { log: MenuLog | null; onClose(): void; actions?: ReactNode }) {
  return (
    <Sheet open={!!log} title={log ? menuTitle(log.menu.name, log.menu.weekday) : ''} onClose={onClose}>
      {log?.menu.items.map(([name, , , rest, sets, reps, main, , note], i) => (
        <div key={i} className={s.entry}>
          <span>
            {name}
            {main === 1 && <em className={s.main}>メイン</em>}
            {note && <small className={s.sub}>{note}</small>}
          </span>
          <span className="num">{`${sets}セット×${reps} ・ レスト ${formatDuration(rest)}`}</span>
        </div>
      ))}
      {log && actions && <div className={s.sheetFoot}>{actions}</div>}
    </Sheet>
  );
}

const unsendError = (e: unknown) =>
  e instanceof OnlineError && e.code === 'offline'
    ? '今はつながりません。つながるところでもう一度お試しください'
    : e instanceof OnlineError && e.code === 'auth'
      ? 'ログインしていないため取り消せません'
      : '取り消せませんでした';

export function SentMenus({ friendId }: { friendId: string }) {
  const logs = useMenuLog('sent', friendId);
  const [open, setOpen] = useState<MenuLog | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);
  if (!logs?.length) return null;
  const close = () => {
    setOpen(null);
    setError('');
  };
  // 消えるのはこの端末の履歴だけ。友達に届いたメニューは友達の側に残る
  const remove = async (l: MenuLog) => {
    if (!window.confirm('この送ったメニューを履歴から削除しますか？ 友達に届いたメニューは消えません')) return;
    await deleteMenuLog(l.id);
    close();
  };
  // サーバーから消すと、友達がまだ追加していなければ友達の「届いたメニュー」からも消える
  const unsend = async (l: MenuLog) => {
    if (busy.current) return;
    if (!window.confirm('送信を取り消しますか？ 友達がまだ追加していなければ、友達のアプリからも消えます')) return;
    busy.current = true;
    setError('');
    try {
      await unsendMenu(l.menu.mid);
      await deleteMenuLog(l.id);
      close();
    } catch (e) {
      setError(unsendError(e));
    } finally {
      busy.current = false;
    }
  };
  return (
    <section aria-label="送ったメニュー" className={s.sentList}>
      <h2 className={s.weekHead}>送ったメニュー</h2>
      {logs.map((l) => (
        <button key={l.id} type="button" className={s.item} onClick={() => setOpen(l)}>
          <span>{`${formatMD(l.at)} ${menuTitle(l.menu.name, l.menu.weekday)} ・ ${l.menu.items.length}種目`}</span>
          <span className={s.chev}>›</span>
        </button>
      ))}
      <MenuLogSheet
        log={open}
        onClose={close}
        actions={
          open && (
            <>
              {error && <p role="alert" className={s.error}>{error}</p>}
              {open.viaApp && <Button block onClick={() => void unsend(open)}>送信を取り消す</Button>}
              <Button variant="danger" block onClick={() => void remove(open)}>この履歴を削除</Button>
            </>
          )
        }
      />
    </section>
  );
}
