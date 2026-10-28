import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { getProfile, previewImport, saveImportedShare } from '../../db/friends';
import { formatMD } from '../../lib/dates';
import { decodeShare, ShareError } from '../../lib/share/codec';
import { parseSharePayload } from '../../lib/share/importShare';
import type { SharePayload } from '../../lib/share/sharePayload';
import { READ_ERRORS } from './PasteSheet';
import s from './friends.module.css';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; text: string }
  | { kind: 'ready'; p: SharePayload; mine: boolean; preview: Awaited<ReturnType<typeof previewImport>> };

export function ImportPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const d = params.get('d') ?? '';
  const [st, setSt] = useState<State>({ kind: 'loading' });
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { kind, data } = await decodeShare(d);
        if (kind !== 'r') return { kind: 'error', text: 'このアプリではまだ読み込めません。GRIND を最新にしてください' } as const;
        const p = parseSharePayload(data);
        return { kind: 'ready', p, mine: (await getProfile())?.id === p.id, preview: await previewImport(p) } as const;
      } catch (e) {
        return { kind: 'error', text: (e instanceof ShareError && READ_ERRORS[e.code]) || READ_ERRORS.invalid } as const;
      }
    })().then((x) => alive && setSt(x));
    return () => {
      alive = false;
    };
  }, [d]);

  const save = async (p: SharePayload) => {
    setSaveFailed(false);
    try {
      await saveImportedShare(p, Date.now());
      navigate(`/friends/${p.id}`, { replace: true });
    } catch {
      setSaveFailed(true);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">FRIENDS</h1>
      {st.kind === 'error' && <p role="alert" className={s.error}>{st.text}</p>}
      {st.kind === 'ready' && (
        <Card>
          <h2 className={s.importTitle}>
            {st.p.n}さんの記録（{st.preview.total}回分{st.preview.from != null && `・${formatMD(st.preview.from)}〜${formatMD(st.preview.to!)}`}）
          </h2>
          <p className={s.sub}>種目 {st.p.x.length} ・ メニュー {st.p.r.length}</p>
          {st.mine ? (
            <p role="alert" className={s.error}>自分の記録です</p>
          ) : (
            st.preview.existing && (
              <p className={s.hint}>前回の受け取り {formatMD(st.preview.existing.receivedAt)}。新しい記録 {st.preview.newCount}回分が追加されます</p>
            )
          )}
          {saveFailed && <p role="alert" className={s.error}>保存できませんでした。もう一度お試しください</p>}
          <div className={s.actions}>
            {!st.mine && <Button block variant="primary" onClick={() => save(st.p)}>保存</Button>}
            <Button block onClick={() => navigate('/friends')}>やめる</Button>
          </div>
        </Card>
      )}
      {st.kind === 'error' && <Button block onClick={() => navigate('/friends')}>友達タブへ</Button>}
      <p className={s.hint}>ホーム画面に追加した GRIND で使うには、このリンクをコピーして『友達』タブに貼り付けてください</p>
    </div>
  );
}
