"""Renders template.html into the share image and ad banners with headless
Chrome. Run: python marketing/render.py"""
import os
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
BROWSER = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
LAYOUTS = {
    'og': (1200, 630, HERE.parent / 'public' / 'og-cover.png'),
    'square': (1080, 1080, HERE / 'ad-square-1080.png'),
    'story': (1080, 1920, HERE / 'ad-story-1080x1920.png'),
}

src = (HERE / 'template.html').read_text(encoding='utf-8')
for name, (w, h, out) in LAYOUTS.items():
    page = HERE / f'_render_{name}.html'
    page.write_text(re.sub(r'<body class="[^"]*">', f'<body class="{name}">', src, count=1), encoding='utf-8')
    subprocess.run([
        BROWSER, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        f'--window-size={w},{h}', '--virtual-time-budget=10000',
        f'--screenshot={out}', page.as_uri(),
    ], check=True, capture_output=True)
    os.remove(page)
    print(name, '->', out)
