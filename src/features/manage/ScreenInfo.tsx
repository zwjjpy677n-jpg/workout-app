import { useEffect, useState } from 'react';

// 一時的な調査用: iPhone のホーム画面アプリで画面の高さがどう見えているかを表示する
export function ScreenInfo() {
  const [text, setText] = useState('');
  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);height:100vh;width:0';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const sv = document.createElement('div');
    sv.style.cssText = 'position:fixed;visibility:hidden;width:0;height:100svh';
    const lv = sv.cloneNode() as HTMLDivElement;
    lv.style.height = '100lvh';
    const dv = sv.cloneNode() as HTMLDivElement;
    dv.style.height = '100dvh';
    document.body.append(sv, lv, dv);
    const nav = document.querySelector('nav')?.getBoundingClientRect();
    const r = (n: number) => Math.round(n);
    setText(
      [
        `inner ${innerWidth}x${innerHeight}`,
        `screen ${screen.width}x${screen.height}`,
        `vv ${r(window.visualViewport?.height ?? 0)}`,
        `client ${document.documentElement.clientHeight}`,
        `root ${r(document.getElementById('root')?.getBoundingClientRect().height ?? 0)}`,
        `vh ${r(probe.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom))} svh ${r(sv.getBoundingClientRect().height)} lvh ${r(lv.getBoundingClientRect().height)} dvh ${r(dv.getBoundingClientRect().height)}`,
        `safe ${cs.paddingTop} ${cs.paddingBottom}`,
        `nav ${nav ? `${r(nav.top)}-${r(nav.bottom)}` : '-'}`,
        `standalone ${(navigator as Navigator & { standalone?: boolean }).standalone ? 'yes' : 'no'}`,
      ].join(' / '),
    );
    probe.remove();
    sv.remove();
    lv.remove();
    dv.remove();
  }, []);
  return <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 24, wordBreak: 'break-all' }}>{text}</p>;
}
