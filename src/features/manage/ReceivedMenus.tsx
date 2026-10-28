import { useState } from 'react';
import { useMenuLog } from '../../hooks/useData';
import { formatMD } from '../../lib/dates';
import { menuTitle, type MenuLog } from '../../lib/share/menuPayload';
import { MenuLogSheet } from '../friends/SentMenus';
import s from './manage.module.css';

/** 友達から受け取ったメニューの履歴 */
export function ReceivedMenus() {
  const logs = useMenuLog('received');
  const [open, setOpen] = useState<MenuLog | null>(null);
  if (!logs?.length) return null;
  return (
    <section aria-label="受け取ったメニュー" className={s.group}>
      <h3>受け取ったメニュー</h3>
      <div className={s.list}>
        {logs.map((l) => (
          <button key={l.id} type="button" className={s.item} onClick={() => setOpen(l)}>
            <span>{`${formatMD(l.at)} ${l.friendName}さん ${menuTitle(l.menu.name, l.menu.weekday)} ・ ${l.result === 'replaced' ? '置き換え' : '追加'}`}</span>
            <span className={s.chev}>›</span>
          </button>
        ))}
      </div>
      <MenuLogSheet log={open} onClose={() => setOpen(null)} />
    </section>
  );
}
