import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { importFeedback, previewFeedback } from '../../db/feedback';
import { getProfile, previewImport, saveImportedShare } from '../../db/friends';
import { formatMD, formatMDRange } from '../../lib/dates';
import { decodeShare, ShareError } from '../../lib/share/codec';
import { parseFeedbackPayload, type FeedbackPayload } from '../../lib/share/feedbackPayload';
import { parseSharePayload } from '../../lib/share/importShare';
import type { SharePayload } from '../../lib/share/sharePayload';
import { READ_ERRORS } from './PasteSheet';
import s from './friends.module.css';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; text: string }
  | { kind: 'records'; p: SharePayload; mine: boolean; preview: Awaited<ReturnType<typeof previewImport>> }
  | { kind: 'feedback'; p: FeedbackPayload; preview: Awaited<ReturnType<typeof previewFeedback>> };

async function load(d: string): Promise<State> {
  try {
    const { kind, data } = await decodeShare(d);
    if (kind === 'r') {
      const p = parseSharePayload(data);
      return { kind: 'records', p, mine: (await getProfile())?.id === p.id, preview: await previewImport(p) };
    }
    if (kind === 'f') {
      const p = parseFeedbackPayload(data);
      return { kind: 'feedback', p, preview: await previewFeedback(p) };
    }
    return { kind: 'error', text: 'このアプリではまだ読み込めません。GRIND を最新にしてください' };
  } catch (e) {
    return { kind: 'error', text: (e instanceof ShareError && READ_ERRORS[e.code]) || READ_ERRORS.invalid };
  }
}

export function ImportPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const d = params.get('d') ?? '';
  const [st, setSt] = useState<State>({ kind: 'loading' });
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void load(d).then((x) => alive && setSt(x));
    return () => {
      alive = false;
    };
  }, [d]);

  const save = async (run: () => Promise<unknown>, to: string) => {
    setSaveFailed(false);
    try {
      await run();
      navigate(to, { replace: true });
    } catch {
      setSaveFailed(true);
    }
  };
  const failed = saveFailed && <p role="alert" className={s.error}>保存できませんでした。もう一度お試しください</p>;
  const cancel = <Button block onClick={() => navigate('/friends')}>やめる</Button>;

  return (
    <div className="page">
      <h1 className="page-title">FRIENDS</h1>
      {st.kind === 'error' && (
        <>
          <p role="alert" className={s.error}>{st.text}</p>
          <Button block onClick={() => navigate('/friends')}>友達タブへ</Button>
        </>
      )}
      {st.kind === 'records' && (
        <Card>
          <h2 className={s.importTitle}>
            {st.p.n}さんの記録（{st.preview.total}回分{st.preview.from != null && `・${formatMDRange(st.preview.from, st.preview.to!)}`}）
          </h2>
          <p className={s.sub}>種目 {st.p.x.length} ・ メニュー {st.p.r.length}</p>
          {st.mine ? (
            <p role="alert" className={s.error}>自分の記録です</p>
          ) : (
            st.preview.existing && (
              <p className={s.hint}>前回の受け取り {formatMD(st.preview.existing.receivedAt)}。新しい記録 {st.preview.newCount}回分が追加されます</p>
            )
          )}
          {failed}
          <div className={s.actions}>
            {!st.mine && <Button block variant="primary" onClick={() => save(() => saveImportedShare(st.p, Date.now()), `/friends/${st.p.id}`)}>保存</Button>}
            {cancel}
          </div>
        </Card>
      )}
      {st.kind === 'feedback' && (
        <Card>
          <h2 className={s.importTitle}>{`${st.p.n}さんからのフィードバック（${st.p.c.length}件）`}</h2>
          {!st.preview.mine && <p role="alert" className={s.error}>あなた宛てではないフィードバックです</p>}
          {failed}
          <div className={s.actions}>
            {st.preview.mine && <Button block variant="primary" onClick={() => save(() => importFeedback(st.p), '/friends')}>保存</Button>}
            {cancel}
          </div>
        </Card>
      )}
      <p className={s.hint}>ホーム画面に追加した GRIND で使うには、このリンクをコピーして『友達』タブに貼り付けてください</p>
    </div>
  );
}
