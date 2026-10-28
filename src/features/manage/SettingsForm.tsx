import { NumberInput } from '../../components/NumberInput';
import { saveSettings } from '../../db/repository';
import { DEFAULT_SETTINGS } from '../../db/seed';
import { useSettings } from '../../hooks/useData';
import { formatKg } from '../../lib/calc';
import s from './manage.module.css';

export function SettingsForm() {
  const settings = useSettings();
  if (!settings) return null;
  const all = [...new Set([...DEFAULT_SETTINGS.plates, ...settings.plates])].sort((a, b) => b - a);

  const togglePlate = (p: number) => {
    const plates = settings.plates.includes(p) ? settings.plates.filter((x) => x !== p) : [...settings.plates, p].sort((a, b) => b - a);
    saveSettings({ ...settings, plates });
  };

  return (
    <>
      <label className={s.field}>
        <span>バー重量（kg）</span>
        <NumberInput
          value={settings.barKg}
          onChange={(v) => v != null && saveSettings({ ...settings, barKg: v })}
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
