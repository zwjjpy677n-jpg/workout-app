import { useLiveQuery } from 'dexie-react-hooks';
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
  return (
    <MenuCard
      st={{ kind: 'menu', p, preview }}
      failed={null}
      cancel={<Button block onClick={discard}>削除</Button>}
      onSave={(mode) => void importMenu(p, mode, Date.now()).then(discard)}
    />
  );
}
