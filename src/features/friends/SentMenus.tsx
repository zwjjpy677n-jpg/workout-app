import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useMenuLog } from '../../hooks/useData';
import { formatDuration } from '../../lib/calc';
import { formatMD } from '../../lib/dates';
import { menuTitle, type MenuLog } from '../../lib/share/menuPayload';
import s from './friends.module.css';

/** 送った（または受け取った）メニューの中身 */
export function MenuLogSheet({ log, onClose }: { log: MenuLog | null; onClose(): void }) {
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
    </Sheet>
  );
}

export function SentMenus({ friendId }: { friendId: string }) {
  const logs = useMenuLog('sent', friendId);
  const [open, setOpen] = useState<MenuLog | null>(null);
  if (!logs?.length) return null;
  return (
    <section aria-label="送ったメニュー" className={s.sentList}>
      <h2 className={s.weekHead}>送ったメニュー</h2>
      {logs.map((l) => (
        <button key={l.id} type="button" className={s.item} onClick={() => setOpen(l)}>
          <span>{`${formatMD(l.at)} ${menuTitle(l.menu.name, l.menu.weekday)} ・ ${l.menu.items.length}種目`}</span>
          <span className={s.chev}>›</span>
        </button>
      ))}
      <MenuLogSheet log={open} onClose={() => setOpen(null)} />
    </section>
  );
}
