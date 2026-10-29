import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { db } from '../../db/db';
import { importMenu, previewMenu } from '../../db/menus';
import type { MenuInboxItem } from '../../lib/online/pull';
import { MenuCard } from './ImportPage';
import s from './friends.module.css';

/** 友達がアプリで送ってくれた、組んだメニュー。追加（置き換え）するか、削除するかを選ぶ */
export function MenuInbox() {
  const items = useLiveQuery(async () => {
    const list = (await db.menuInbox.toArray()).sort((a, b) => b.at - a.at);
    return Promise.all(list.map(async (item) => ({ item, preview: await previewMenu(item.body, { trustRecipient: true }) })));
  });
  if (!items?.length) return null;
  return (
    <section aria-label="届いたメニュー" className={s.inbox}>
      <h2 className={s.weekHead}>届いたメニュー</h2>
      {items.map(({ item, preview }) => (
        <Received key={item.id} item={item} preview={preview} />
      ))}
    </section>
  );
}

function Received({ item, preview }: { item: MenuInboxItem; preview: Awaited<ReturnType<typeof previewMenu>> }) {
  // 受け取った履歴の相手は、サーバー上の送り主にする
  const p = { ...item.body, id: item.from, n: item.fromName };
  const discard = () => db.menuInbox.delete(item.id);
  const busy = useRef(false);
  const [failed, setFailed] = useState(false);
  const save = async (mode: 'replace' | 'add') => {
    if (busy.current) return;
    busy.current = true;
    setFailed(false);
    try {
      await importMenu(p, mode, Date.now());
      await discard();
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  };
  return (
    <MenuCard
      st={{ kind: 'menu', p, preview }}
      failed={failed && <p role="alert" className={s.error}>保存できませんでした。もう一度お試しください</p>}
      cancel={<Button block onClick={discard}>削除</Button>}
      onSave={(mode) => void save(mode)}
    />
  );
}
