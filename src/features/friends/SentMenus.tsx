import { useState } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { deleteMenuLog } from '../../db/menus';
import { useMenuLog } from '../../hooks/useData';
import { formatDuration } from '../../lib/calc';
import { formatMD } from '../../lib/dates';
import { menuTitle, type MenuLog } from '../../lib/share/menuPayload';
import s from './friends.module.css';

/** 送った（または受け取った）メニューの中身。onDelete を渡すと履歴から消すボタンを出す */
export function MenuLogSheet({ log, onClose, onDelete }: { log: MenuLog | null; onClose(): void; onDelete?(log: MenuLog): void }) {
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
      {log && onDelete && (
        <div className={s.sheetFoot}>
          <Button variant="danger" block onClick={() => onDelete(log)}>この履歴を削除</Button>
        </div>
      )}
    </Sheet>
  );
}

export function SentMenus({ friendId }: { friendId: string }) {
  const logs = useMenuLog('sent', friendId);
  const [open, setOpen] = useState<MenuLog | null>(null);
  if (!logs?.length) return null;
  // 消えるのはこの端末の履歴だけ。友達に届いたメニューは友達の側に残る
  const remove = async (l: MenuLog) => {
    if (!window.confirm('この送ったメニューを履歴から削除しますか？ 友達に届いたメニューは消えません')) return;
    await deleteMenuLog(l.id);
    setOpen(null);
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
      <MenuLogSheet log={open} onClose={() => setOpen(null)} onDelete={(l) => void remove(l)} />
    </section>
  );
}
