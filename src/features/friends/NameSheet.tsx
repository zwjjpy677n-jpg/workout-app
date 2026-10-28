import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { saveProfileName } from '../../db/friends';
import s from './friends.module.css';

type Props = { open: boolean; initial: string; onClose(): void; /** 渡すと、保存のあとに「共有する」ボタンを出す */ onShare?(): void; ready?: boolean };

export function NameSheet({ open, initial, onClose, onShare, ready }: Props) {
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(initial);
    setSaved(false);
  }, [open, initial]);
  const v = name.trim();
  const ok = v.length >= 1 && v.length <= 20;
  return (
    <Sheet open={open} title="友達に表示する名前" onClose={onClose}>
      {saved && onShare ? (
        <>
          <p className={s.hint}>「{v}」で保存しました。続けて記録を共有します</p>
          <Button
            block
            variant="primary"
            disabled={!ready}
            onClick={() => {
              onClose();
              onShare();
            }}
          >
            共有する
          </Button>
        </>
      ) : (
        <>
          <input className={s.text} value={name} onChange={(e) => setName(e.target.value)} placeholder="1〜20文字" autoFocus />
          <Button
            block
            variant="primary"
            disabled={!ok}
            onClick={async () => {
              await saveProfileName(v);
              if (onShare) setSaved(true);
              else onClose();
            }}
          >
            保存
          </Button>
        </>
      )}
    </Sheet>
  );
}
