// レスト終了の音。設定は端末ごとの好み（マナーモードの扱いが端末で違う）なので端末に保存する
export type SoundPrefs = { on: boolean; silent: boolean };

const KEY = 'ironlog:sound';
const DEFAULT: SoundPrefs = { on: true, silent: false };

export function getSoundPrefs(): SoundPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SoundPrefs> | null;
    if (v && typeof v.on === 'boolean' && typeof v.silent === 'boolean') return { on: v.on, silent: v.silent };
  } catch {
    // 壊れた値・保存領域が使えない環境は既定に戻す
  }
  return { ...DEFAULT };
}

export function setSoundPrefs(p: SoundPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 保存できなくても今回の操作だけ反映されないだけ
  }
}

type AudioSessionNav = Navigator & { audioSession?: { type: string } };
type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;

/** iPhone は画面操作の中でしか音を出す準備ができないので、タップのたびに呼んでおく */
export function unlockSound() {
  try {
    const C = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext) as Ctor | undefined;
    if (!C) return;
    ctx ??= new C();
    if (ctx.state !== 'running') void ctx.resume();
    // 無音を一瞬鳴らして、以後の音を許可させる
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start();
  } catch {
    // 音が出せない環境では何もしない
  }
}

const TONES = {
  tick: [{ at: 0, hz: 880, len: 0.12 }],
  end: [
    { at: 0, hz: 1320, len: 0.18 },
    { at: 0.25, hz: 1320, len: 0.18 },
    { at: 0.5, hz: 1760, len: 0.4 },
  ],
};

export function beep(kind: keyof typeof TONES) {
  try {
    if (!ctx) return;
    const session = (navigator as AudioSessionNav).audioSession;
    // 'playback' にすると iPhone のマナーモード中でも鳴る（再生中の音楽は止まることがある）
    if (session && getSoundPrefs().silent) session.type = 'playback';
    if (ctx.state !== 'running') void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    let end = 0;
    for (const { at, hz, len } of TONES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = hz;
      // 立ち上がり・立ち下がりをなめらかにしてプツッという音を防ぐ
      gain.gain.setValueAtTime(0, t0 + at);
      gain.gain.linearRampToValueAtTime(0.25, t0 + at + 0.01);
      gain.gain.setValueAtTime(0.25, t0 + at + len - 0.03);
      gain.gain.linearRampToValueAtTime(0, t0 + at + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + len);
      end = Math.max(end, at + len);
    }
    if (session?.type === 'playback') setTimeout(() => (session.type = 'auto'), (end + 0.3) * 1000);
  } catch {
    // 同上
  }
}
