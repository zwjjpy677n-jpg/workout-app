import { NumberInput } from '../../components/NumberInput';
import { AppearanceSection } from './AppearanceSection';
import { updateSettings } from '../../db/repository';
import { DEFAULT_SETTINGS } from '../../db/seed';
import { useState } from 'react';
import { useSettings } from '../../hooks/useData';
import { beep, getSoundPrefs, setSoundPrefs, unlockSound, type SoundPrefs } from '../../lib/sound';
import { formatKg } from '../../lib/calc';
import s from './manage.module.css';

export function SettingsForm() {
  const settings = useSettings();
  const [sound, setSound] = useState(getSoundPrefs);
  if (!settings) return null;
  const all = [...new Set([...DEFAULT_SETTINGS.plates, ...settings.plates])].sort((a, b) => b - a);

  const togglePlate = (p: number) =>
    updateSettings((cur) => ({
      ...cur,
      plates: cur.plates.includes(p) ? cur.plates.filter((x) => x !== p) : [...cur.plates, p].sort((a, b) => b - a),
    }));

  const changeSound = (p: SoundPrefs) => {
    setSoundPrefs(p);
    setSound(p);
  };

  return (
    <>
      <AppearanceSection />
      <div className={s.field}>
        <span>レスト終了の通知（この端末だけの設定）</span>
        <label className={s.check}>
          <input type="checkbox" checked={sound.on} onChange={(e) => changeSound({ ...sound, on: e.target.checked })} />
          レスト終了を音で知らせる
        </label>
        <label className={s.check}>
          <input type="checkbox" checked={sound.silent} disabled={!sound.on} onChange={(e) => changeSound({ ...sound, silent: e.target.checked })} />
          マナーモード中も鳴らす
        </label>
        <small className={s.hint}>「マナーモード中も鳴らす」をオンにすると、鳴るときに再生中の音楽が止まることがあります。記録中は画面が自動で消えません。</small>
        <button
          type="button"
          className={s.testBtn}
          disabled={!sound.on}
          onClick={() => {
            unlockSound();
            beep('end');
          }}
        >
          音を試す
        </button>
      </div>
      <label className={s.field}>
        <span>バー重量（kg）</span>
        <NumberInput
          value={settings.barKg}
          onChange={(v) => v != null && updateSettings((cur) => ({ ...cur, barKg: v }))}
          min={0}
          max={100}
          inputMode="decimal"
          aria-label="バー重量"
        />
      </label>
      <div className={s.field}>
        <span>使えるプレート（プレート計算で使用）</span>
        <div className={s.chips}>
          {all.map((p) => (
            <label key={p} className={s.chip}>
              <input type="checkbox" checked={settings.plates.includes(p)} onChange={() => togglePlate(p)} />
              {formatKg(p)}kg
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
