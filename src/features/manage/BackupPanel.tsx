import { useState } from 'react';
import { Button } from '../../components/Button';
import { exportAll, importAll } from '../../db/repository';
import { parseBackup } from '../../lib/backup';
import { toDateKey } from '../../lib/dates';
import s from './manage.module.css';

export function BackupPanel() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function doExport() {
    const data = await exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ironlog-${toDateKey(Date.now())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg({ ok: true, text: 'エクスポートしました' });
  }

  async function doImport(file: File | undefined) {
    if (!file) return;
    try {
      const data = parseBackup(await file.text());
      if (!window.confirm('現在のデータをすべて置き換えます。よろしいですか？')) return;
      await importAll(data);
      setMsg({ ok: true, text: `インポートしました（ワークアウト ${data.workouts.length}件）` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <>
      <p className={s.note}>データはこの端末のブラウザ内にだけ保存されています。機種変更やブラウザのデータ削除に備えて、定期的にエクスポートしてください。</p>
      <Button block onClick={doExport}>エクスポート（JSON）</Button>
      <label className={s.field} style={{ marginTop: 12 }}>
        <span>インポート（現在のデータは置き換えられます）</span>
        <input type="file" accept="application/json,.json" aria-label="インポート" onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? s.ok : s.error}>{msg.text}</p>}
    </>
  );
}
