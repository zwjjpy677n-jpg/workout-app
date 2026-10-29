import { useState } from 'react';
import { Button } from '../../components/Button';
import { exportAll, importAll } from '../../db/repository';
import { parseBackup } from '../../lib/backup';
import { saveFile } from '../../lib/device';
import { toDateKey } from '../../lib/dates';
import s from './manage.module.css';

export function BackupPanel() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function doExport() {
    setMsg(null);
    try {
      const r = await saveFile(`grind-${toDateKey(Date.now())}.json`, JSON.stringify(await exportAll()));
      if (r === 'saved') setMsg({ ok: true, text: 'エクスポートしました' });
    } catch {
      setMsg({ ok: false, text: '書き出せませんでした' });
    }
  }

  async function doImport(file: File | undefined) {
    if (!file) return;
    let data;
    try {
      data = parseBackup(await file.text());
    } catch (e) {
      return setMsg({ ok: false, text: (e as Error).message });
    }
    if (!window.confirm('現在のデータをすべて置き換えます。よろしいですか？')) return;
    try {
      await importAll(data);
      setMsg({ ok: true, text: `インポートしました（ワークアウト ${data.workouts.length}件）` });
    } catch {
      // 保存領域不足などのDBエラー。importAll は1トランザクションなので元のデータのまま
      setMsg({ ok: false, text: 'バックアップを読み込めませんでした。データは変更していません。端末の空き容量を確認して、もう一度お試しください。' });
    }
  }

  return (
    <>
      <p className={s.note}>データはこの端末の中にだけ保存されています。機種変更やアプリ・ブラウザのデータ削除に備えて、定期的にエクスポートしてください。</p>
      <Button block onClick={doExport}>エクスポート（JSON）</Button>
      <label className={s.field} style={{ marginTop: 12 }}>
        <span>インポート（現在のデータは置き換えられます）</span>
        <input type="file" accept="application/json,.json" aria-label="インポート" onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? s.ok : s.error}>{msg.text}</p>}
    </>
  );
}
