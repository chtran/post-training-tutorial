#!/usr/bin/env python3
"""Screenshot lessons of the compiled tutorial through the VM's Chrome (CDP on :29229).
Usage: python3 shots.py <compiled.html> <outdir> [--width 1280] [--dark] [nav label ...]
Writes <outdir>/<label>-NN.png, one 1400px-tall slice per file, and prints console errors.
Needs: pip install playwright pillow
"""
import asyncio, os, sys
from playwright.async_api import async_playwright
from PIL import Image
args = sys.argv[1:]
html, outdir = os.path.abspath(args[0]), args[1]; rest = args[2:]
width = 1280; dark = False; labels = []
i = 0
while i < len(rest):
    if rest[i] == "--width": width = int(rest[i + 1]); i += 2
    elif rest[i] == "--dark": dark = True; i += 1
    else: labels.append(rest[i]); i += 1
os.makedirs(outdir, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.connect_over_cdp("http://localhost:29229")
        pg = await b.contexts[0].new_page()
        await pg.set_viewport_size({"width": width, "height": 900})
        if dark: await pg.emulate_media(color_scheme="dark")
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file://" + html); await pg.wait_for_timeout(2500)
        nav = pg.get_by_role("navigation", name="Lessons")
        names = labels or [await x.inner_text() for x in await nav.get_by_role("button").all()]
        for name in names:
            name = name.split("\n")[-1].strip()
            await nav.get_by_role("button", name=name, exact=False).first.click(); await pg.wait_for_timeout(1500)
            tmp = os.path.join(outdir, "_full.png"); await pg.screenshot(path=tmp, full_page=True)
            im = Image.open(tmp); w, h = im.size; slug = name.lower().replace(" ", "-")
            for n, y in enumerate(range(0, h, 1400)):
                im.crop((0, y, w, min(h, y + 1400))).save(os.path.join(outdir, f"{slug}-{n:02d}.png"))
            print(name, "height", h)
            os.remove(tmp)
        print("console errors:", errs[:10])
        await pg.close()
asyncio.run(main())
