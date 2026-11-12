# Renders the web app's (PWA) icons and iOS launch screens from the app's own brand assets.
# Run from the repo root after changing the icon or splash: python scripts/render-pwa-assets.py
# Output goes to public/icons and public/splash (copied into dist by `expo export -p web`).
from PIL import Image

ICON = 'assets/images/icon.png'            # 1024px, full-bleed green
SPLASH = {'light': ('assets/images/splash-icon.png', '#1F5B3F'), 'dark': ('assets/images/splash-icon-dark.png', '#0D1712')}
GREEN = '#1F5B3F'

icon = Image.open(ICON).convert('RGB')
for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
    icon.resize((size, size), Image.LANCZOS).save(f'public/icons/{name}', optimize=True)

# Maskable: Android and others crop to a circle or squircle, so keep the art inside the
# central 80% safe zone.
mask = Image.new('RGB', (512, 512), GREEN)
inner = icon.resize((410, 410), Image.LANCZOS)
mask.paste(inner, (51, 51))
mask.save('public/icons/icon-maskable-512.png', optimize=True)

# iOS launch screens (portrait, CSS width x height, device pixel ratio). Same look as the
# native splash: the logo 220pt wide on green (dark green in dark mode).
DEVICES = [(440, 956, 3), (402, 874, 3), (430, 932, 3), (393, 852, 3), (428, 926, 3), (390, 844, 3), (414, 896, 2), (375, 812, 3), (375, 667, 2)]
for mode, (src, bg) in SPLASH.items():
    logo = Image.open(src).convert('RGBA')
    for w, h, dpr in DEVICES:
        W, H, L = w * dpr, h * dpr, 220 * dpr
        img = Image.new('RGB', (W, H), bg)
        mark = logo.resize((L, L), Image.LANCZOS)
        img.paste(mark, ((W - L) // 2, (H - L) // 2), mark)
        img.save(f'public/splash/{mode}-{w}x{h}@{dpr}x.png', optimize=True)
print('Wrote public/icons and public/splash')
