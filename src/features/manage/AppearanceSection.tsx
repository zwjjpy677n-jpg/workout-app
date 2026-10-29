import { useState } from 'react';
import { ACCENTS, BGS, ICONS, iconUrl, setAppearance, useAppearance, type IconKey } from '../../lib/appearance';
import { changeAppIcon } from '../../lib/appIcon';
import s from './manage.module.css';

/** 設定の「見た目」: アイコンの色・強調色・背景。押すとすぐ反映し、この端末に保存する */
export function AppearanceSection() {
  const a = useAppearance();
  const [msg, setMsg] = useState('');
  const accent = ACCENTS.find((x) => x.key === a.accent)!;

  const pickIcon = async (key: IconKey) => {
    const prev = a;
    setMsg('');
    setAppearance({ ...a, icon: key });
    const r = await changeAppIcon(key);
    if (r === 'reinstall') setMsg('iPhone のホーム画面のアイコンをこの色にするには、Safari からホーム画面に追加し直してください');
    if (r === 'failed') {
      setAppearance(prev);
      setMsg('アイコンを変えられませんでした');
    }
  };

  return (
    <div className={s.field}>
      <span>見た目（この端末だけの設定）</span>
      <div role="group" aria-label="アイコンの色" className={s.swatchGroup}>
        <small className={s.swatchTitle}>アイコンの色</small>
        <div className={s.swatches}>
          {ICONS.map((x) => (
            <button key={x.key} type="button" className={s.swatch} aria-pressed={a.icon === x.key} onClick={() => void pickIcon(x.key)}>
              <img src={iconUrl(x.key, 64)} alt="" className={s.swatchIcon} />
              <span className={s.swatchName}>{x.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label="強調色" className={s.swatchGroup}>
        <small className={s.swatchTitle}>強調色</small>
        <div className={s.swatches}>
          {ACCENTS.map((x) => (
            <button key={x.key} type="button" className={s.swatch} aria-pressed={a.accent === x.key} onClick={() => setAppearance({ ...a, accent: x.key })}>
              <i className={s.swatchDot} style={{ background: x.color }} aria-hidden />
              <span className={s.swatchName}>{x.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label="背景" className={s.swatchGroup}>
        <small className={s.swatchTitle}>背景</small>
        <div className={s.swatches}>
          {BGS.map((x) => (
            <button key={x.key} type="button" className={s.swatch} aria-pressed={a.bg === x.key} onClick={() => setAppearance({ ...a, bg: x.key })}>
              <i className={s.swatchBg} style={{ background: x.bg, borderColor: x.line }} aria-hidden>
                <b style={{ background: accent.color }} />
              </i>
              <span className={s.swatchName}>{x.name}</span>
            </button>
          ))}
        </div>
      </div>
      <p role="status" className={s.note}>
        {msg}
      </p>
    </div>
  );
}
