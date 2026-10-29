import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { canReadClipboard, readClipboard } from '../../lib/device';
import { decodeShare, shareData, ShareError } from '../../lib/share/codec';
import s from './friends.module.css';

export const READ_ERRORS: Record<string, string> = {
  invalid: '読み込めないリンクです',
  newer: 'キントレ部 を最新にしてから貼り付けてください',
  unsupported: 'この端末では共有を使えません',
};

export function PasteSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const read = async () => {
    setError('');
    try {
      await decodeShare(text);
      navigate(`/friends/add?d=${shareData(text)}`);
    } catch (e) {
      setError((e instanceof ShareError && READ_ERRORS[e.code]) || READ_ERRORS.invalid);
    }
  };
  return (
    <Sheet open={open} title="リンクを貼り付けて追加" onClose={onClose}>
      <p className={s.hint}>LINE でリンクを長押し → コピーして、ここに貼り付けてください</p>
      <textarea aria-label="リンク" className={s.area} value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      {canReadClipboard() && (
        <Button block onClick={async () => setText(await readClipboard().catch(() => text))}>
          クリップボードから貼り付け
        </Button>
      )}
      {error && <p role="alert" className={s.error}>{error}</p>}
      <Button block variant="primary" disabled={!text.trim()} onClick={read}>
        読み込む
      </Button>
    </Sheet>
  );
}
