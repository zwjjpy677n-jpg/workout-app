import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { getApi } from '../../lib/online/api';
import type { GroupRow } from '../../lib/online/types';
import { GROUP_NAME_MAX } from './GroupPage';
import f from '../friends/friends.module.css';
import s from './groups.module.css';

/** 友達タブの「グループ」。入っているグループの一覧と、グループを作る */
export function GroupsSection() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    getApi()
      ?.listGroups()
      .then(
        (g) => alive && setGroups(g),
        () => {
          /* つながらないときは一覧を出さない（上に「今はつながりません」が出る） */
        },
      );
    return () => {
      alive = false;
    };
  }, []);

  const v = name.trim();
  const create = async () => {
    if (busy.current || !v) return;
    busy.current = true;
    setError('');
    try {
      const g = await getApi()!.createGroup(v);
      navigate(`/friends/groups/${g.id}`);
    } catch {
      setError('作れませんでした。つながるところでもう一度お試しください');
    } finally {
      busy.current = false;
    }
  };

  return (
    <section aria-label="グループ" className={s.groups}>
      <h3 className={f.weekHead}>グループ</h3>
      {groups?.map((g) => (
        <button key={g.id} type="button" className={f.item} onClick={() => navigate(`/friends/groups/${g.id}`)}>
          <div className={f.name}>{g.name}</div>
          <span className={f.chev}>›</span>
        </button>
      ))}
      <Button block onClick={() => { setName(''); setError(''); setCreating(true); }}>グループを作る</Button>
      <Sheet open={creating} title="グループを作る" onClose={() => setCreating(false)}>
        <input className={f.text} aria-label="グループの名前" placeholder="グループの名前（朝練 など）" value={name} maxLength={GROUP_NAME_MAX} onChange={(e) => setName(e.target.value)} />
        <p className={f.hint}>作ったら、招待リンクを LINE などで送ってメンバーを呼べます。1つのリンクで7日間、何人でも入れます</p>
        {error && <p role="alert" className={f.error}>{error}</p>}
        <Button block variant="primary" disabled={!v} onClick={() => void create()}>作る</Button>
      </Sheet>
    </section>
  );
}
