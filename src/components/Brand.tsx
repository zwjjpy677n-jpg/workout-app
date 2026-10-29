import { iconUrl, useAppearance } from '../lib/appearance';

/** アプリ名のロゴ（選んだ色の猫アイコン + キントレ部） */
export function Brand({ size = 22 }: { size?: number }) {
  const { icon } = useAppearance();
  const px = Math.round(size * 1.25);
  return (
    <div role="img" aria-label="キントレ部" style={{ display: 'flex', alignItems: 'center', gap: size * 0.4, lineHeight: 1 }}>
      <img src={iconUrl(icon, 64)} alt="" width={px} height={px} style={{ borderRadius: '22%', display: 'block' }} />
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: size * 0.9, letterSpacing: '.04em' }}>キントレ部</span>
    </div>
  );
}
