"""猫アイコンを 12 色ぶん作る。`python3 scripts/make-icons.py`（Pillow と NumPy が必要）

元の絵は assets/cat.png（背景が透明な猫とバーベル）。大きい元画像が手に入ったら差し替えて再実行する。
今の cat.png は、もらった約 260px の黄色いアイコンから作った:
黄色の背景を色相で除く → 内側の穴を埋める → 黄色がかった縁は黒 (20,20,24) に → 4 倍 Lanczos 拡大 + アンシャープ。
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
COLORS = {
    'red': '#E5262B', 'yellow': '#FFC21A', 'orange': '#FF8A1F', 'pink': '#FF85B3',
    'purple': '#9B5CF6', 'blue': '#2F7FEB', 'sky': '#55C8F5', 'mint': '#5ED6B4',
    'green': '#3DBE57', 'navy': '#1E2A4A', 'black': '#141418', 'cream': '#FBEFD5',
}
ASSETS = ROOT / 'ios/App/App/Assets.xcassets'


def icon(cat: Image.Image, color: str, S: int = 1024) -> Image.Image:
    c = np.array([int(color[i:i + 2], 16) for i in (1, 3, 5)], float)
    yy, xx = np.mgrid[0:S, 0:S] / S
    t = ((xx + yy) / 2)[..., None]
    light, dark = np.clip(c * 1.08 + 12, 0, 255), c * 0.86
    base = Image.fromarray((light * (1 - t) + dark * t).astype(np.uint8)).convert('RGBA')
    w = int(S * 0.86)
    h = int(cat.height * w / cat.width)
    x, y = (S - w) // 2, (S - h) // 2 + int(S * 0.03)
    shadow = Image.new('L', (S, S), 0)
    ImageDraw.Draw(shadow).ellipse([S * 0.14, y + h - S * 0.07, S * 0.9, y + h + S * 0.03], fill=70)
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.02))
    base = Image.composite(Image.new('RGBA', (S, S), (0, 0, 0, 255)), base, shadow)
    base.alpha_composite(cat.resize((w, h), Image.LANCZOS), (x, y))
    return base.convert('RGB')


def appiconset(name: str, img: Image.Image) -> None:
    d = ASSETS / f'{name}.appiconset'
    d.mkdir(exist_ok=True)
    for old in d.glob('*.png'):
        old.unlink()
    img.save(d / 'AppIcon-512@2x.png')
    contents = {
        'images': [{'idiom': 'universal', 'size': '1024x1024', 'filename': 'AppIcon-512@2x.png', 'platform': 'ios'}],
        'info': {'author': 'xcode', 'version': 1},
    }
    (d / 'Contents.json').write_text(json.dumps(contents, indent=2) + '\n')


def main() -> None:
    cat = Image.open(ROOT / 'assets/cat.png').convert('RGBA')
    cat = cat.crop(cat.getbbox())
    out = ROOT / 'public/icons'
    out.mkdir(exist_ok=True)
    for key, color in COLORS.items():
        big = icon(cat, color)
        for size in (180, 64):
            big.resize((size, size), Image.LANCZOS).save(out / f'{key}-{size}.png', optimize=True)
        appiconset('AppIcon' if key == 'red' else f'AppIcon-{key}', big)
        if key == 'red':
            big.save(ROOT / 'assets/icon.png')
            big.resize((180, 180), Image.LANCZOS).save(ROOT / 'public/apple-touch-icon.png', optimize=True)
            big.resize((192, 192), Image.LANCZOS).save(ROOT / 'public/icon-192.png', optimize=True)
            big.resize((512, 512), Image.LANCZOS).save(ROOT / 'public/icon-512.png', optimize=True)


if __name__ == '__main__':
    main()
