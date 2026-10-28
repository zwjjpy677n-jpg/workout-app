/** アプリ名のロゴ（GRIND + 赤い点） */
export function Brand({ size = 22 }: { size?: number }) {
  return (
    <div
      role="img"
      aria-label="GRIND"
      style={{ fontFamily: 'var(--font-num)', fontWeight: 700, letterSpacing: '.12em', fontSize: size, lineHeight: 1 }}
    >
      GRIND<span style={{ color: 'var(--red)' }}>.</span>
    </div>
  );
}
