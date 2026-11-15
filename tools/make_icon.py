"""Draws the home-screen icon: glossy copper pipe assembly with a red-handle ball valve on a dark
blueprint background, chrome "ASRP" lettering and an "INVENTORY" label.
Writes icon.png (512), icon-192.png and apple-touch-icon.png (180) to the repo root.
Run from the repo root:  python3 tools/make_icon.py   (needs Pillow and Poppins Bold)
"""
import math, pathlib, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
S = 2048                      # drawn at 2x, scaled down for smooth edges
random.seed(11)

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))

def ramp(stops, t):
    t = max(0.0, min(1.0, t))
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        if t <= p1:
            return lerp(c0, c1, (t - p0) / max(1e-6, p1 - p0))
    return stops[-1][1]

# cylinder shading across a pipe (0 = one edge, 1 = other edge)
COPPER = [(0, (70, 28, 10)), (0.18, (150, 70, 30)), (0.36, (226, 136, 78)), (0.46, (255, 222, 186)),
          (0.56, (222, 128, 70)), (0.8, (128, 56, 22)), (1, (60, 22, 8))]
CHROME = [(0, (40, 44, 50)), (0.2, (120, 128, 138)), (0.42, (236, 240, 244)), (0.5, (255, 255, 255)),
          (0.6, (170, 178, 188)), (0.85, (80, 86, 94)), (1, (34, 38, 44))]
BRASS = [(0, (70, 48, 10)), (0.2, (160, 118, 40)), (0.42, (236, 200, 110)), (0.5, (255, 240, 190)),
         (0.6, (206, 160, 70)), (0.85, (120, 84, 24)), (1, (60, 40, 8))]

img = Image.new("RGB", (S, S))
d = ImageDraw.Draw(img)

# --- background: deep blue-black radial gradient
cx, cy = S * 0.5, S * 0.42
for r in range(int(S * 0.95), 0, -6):
    t = r / (S * 0.95)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ramp([(0, (34, 52, 76)), (0.45, (16, 26, 40)), (1, (6, 9, 14))], t))

# blueprint grid
grid = Image.new("L", (S, S), 0)
gd = ImageDraw.Draw(grid)
for x in range(0, S, 64):
    gd.line([(x, 0), (x, S)], fill=34 if x % 256 else 70, width=2)
for y in range(0, S, 64):
    gd.line([(0, y), (S, y)], fill=34 if y % 256 else 70, width=2)
vign = Image.new("L", (S, S), 0)
ImageDraw.Draw(vign).ellipse((S * 0.05, S * 0.0, S * 0.95, S * 0.9), fill=255)
grid = ImageChops.multiply(grid, vign.filter(ImageFilter.GaussianBlur(220)))
img.paste((120, 180, 240), (0, 0), grid)

# warm glow behind the pipework
glow = Image.new("L", (S, S), 0)
ImageDraw.Draw(glow).ellipse((S * 0.18, S * 0.12, S * 0.82, S * 0.72), fill=150)
img.paste((255, 120, 40), (0, 0), glow.filter(ImageFilter.GaussianBlur(190)))

layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
L = ImageDraw.Draw(layer)

def hpipe(x0, x1, ymid, w, stops=COPPER):
    for i in range(w):
        L.line([(x0, ymid - w / 2 + i), (x1, ymid - w / 2 + i)], fill=ramp(stops, i / (w - 1)) + (255,))

def vpipe(y0, y1, xmid, w, stops=COPPER):
    for i in range(w):
        L.line([(xmid - w / 2 + i, y0), (xmid - w / 2 + i, y1)], fill=ramp(stops, i / (w - 1)) + (255,))

def elbow(ccx, ccy, R, w, a0, a1, stops=COPPER, flip=False):
    # concentric arcs: inside radius -> outside radius shading
    for i in range(w):
        r = R - w / 2 + i
        t = i / (w - 1)
        L.arc((ccx - r, ccy - r, ccx + r, ccy + r), a0, a1, fill=ramp(stops, 1 - t if flip else t) + (255,), width=2)

def hband(xc, ymid, w, bw, stops=COPPER):          # fitting socket on a horizontal pipe (slightly fatter)
    hpipe(xc - bw / 2, xc + bw / 2, ymid, int(w * 1.16), stops)
    L.line([(xc - bw / 2, ymid - w * 0.58), (xc - bw / 2, ymid + w * 0.58)], fill=(40, 14, 4, 255), width=5)
    L.line([(xc + bw / 2, ymid - w * 0.58), (xc + bw / 2, ymid + w * 0.58)], fill=(40, 14, 4, 255), width=5)

def vband(xmid, yc, w, bh, stops=COPPER):
    vpipe(yc - bh / 2, yc + bh / 2, xmid, int(w * 1.16), stops)
    L.line([(xmid - w * 0.58, yc - bh / 2), (xmid + w * 0.58, yc - bh / 2)], fill=(40, 14, 4, 255), width=5)
    L.line([(xmid - w * 0.58, yc + bh / 2), (xmid + w * 0.58, yc + bh / 2)], fill=(40, 14, 4, 255), width=5)

W = 150                   # pipe diameter
Y = 1040                  # main run height
XL, XR = 330, 1718        # elbow centers x
R = 190                   # elbow radius

# main horizontal run
hpipe(XL + R - 4, XR - R + 4, Y, W)
# left elbow: run turns down, right elbow: run turns up
elbow(XL + R, Y + R, R, W, 180, 270, flip=True)
vpipe(Y + R, S * 0.66, XL, W)
elbow(XR - R, Y - R, R, W, 0, 90, flip=False)
vpipe(Y - R - 2, 330, XR, W)
# tee in the middle with branch up to a ball valve
TX = 1024
vpipe(470, Y, TX, W)
hband(TX, Y, W, 260)       # tee body
vband(TX, Y - 150, W, 120)
# sockets at elbow ends
vband(XL, Y + R + 40, W, 90)
hband(XL + R + 40, Y, W, 90)
hband(XR - R - 40, Y, W, 90)
vband(XR, Y - R - 40, W, 90)
vband(XR, 330, W, 60)

# chrome ball valve on the branch
VY = 560
vpipe(VY - 120, VY + 120, TX, int(W * 1.45), CHROME)          # valve body
L.ellipse((TX - 128, VY - 128, TX + 128, VY + 128), fill=(0, 0, 0, 0))
for i in range(0, 120):
    r = 128 - i
    L.ellipse((TX - r, VY - r, TX + r, VY + r), fill=ramp(CHROME, 0.15 + 0.6 * i / 120) + (255,))
hband_stops = BRASS
vband(TX, VY - 150, W, 70, BRASS)
vband(TX, VY + 150, W, 70, BRASS)
# red lever handle
handle = Image.new("RGBA", (S, S), (0, 0, 0, 0))
hd = ImageDraw.Draw(handle)
hd.rounded_rectangle((TX - 30, VY - 70, TX + 470, VY + 10), 40, fill=(30, 4, 4, 255))
hd.rounded_rectangle((TX - 24, VY - 76, TX + 464, VY - 6), 36, fill=(214, 34, 30, 255))
hd.rounded_rectangle((TX + 10, VY - 66, TX + 440, VY - 46), 12, fill=(255, 120, 110, 255))
hd.ellipse((TX - 46, VY - 86, TX + 46, VY + 6), fill=(200, 205, 212, 255), outline=(60, 64, 70, 255), width=6)
handle = handle.rotate(14, center=(TX, VY - 40), resample=Image.BICUBIC)
layer.alpha_composite(handle)

# drop shadow for the whole assembly, then composite
shadow = layer.split()[3].filter(ImageFilter.GaussianBlur(26)).point(lambda v: int(v * 0.75))
img.paste((0, 0, 0), (26, 40), shadow)
img.paste(layer, (0, 0), layer)

# --- "ASRP" chrome lettering
d = ImageDraw.Draw(img)
def centered(txt, font, cy, tracking=0):
    widths = [d.textbbox((0, 0), ch, font=font)[2] - d.textbbox((0, 0), ch, font=font)[0] for ch in txt]
    total = sum(widths) + tracking * (len(txt) - 1)
    b = d.textbbox((0, 0), txt, font=font)
    return (S - total) / 2, cy - (b[3] - b[1]) / 2 - b[1], widths
big = ImageFont.truetype(FONT, 440)
x, y, ws = centered("ASRP", big, 1520, tracking=10)
tm = Image.new("L", (S, S), 0)
td = ImageDraw.Draw(tm)
xx = x
for ch, w in zip("ASRP", ws):
    td.text((xx - td.textbbox((0, 0), ch, font=big)[0], y), ch, font=big, fill=255)
    xx += w + 10
img.paste((0, 0, 0), (0, 0), tm.filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.GaussianBlur(10)))
img.paste((255, 130, 50), (0, 0), tm.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(24)).point(lambda v: int(v * 0.55)))
chrome = Image.new("RGB", (S, S))
cd = ImageDraw.Draw(chrome)
top, bot = y + d.textbbox((0, 0), "ASRP", font=big)[1], y + d.textbbox((0, 0), "ASRP", font=big)[3]
for yy in range(S):
    t = (yy - top) / max(1, bot - top)
    cd.line([(0, yy), (S, yy)], fill=ramp([(0, (255, 255, 255)), (0.45, (206, 214, 224)), (0.5, (120, 130, 142)), (0.62, (226, 232, 238)), (1, (150, 158, 168))], t))
img.paste(chrome, (0, 0), tm)
edge = ImageChops.subtract(tm, tm.filter(ImageFilter.MinFilter(5)))
img.paste((70, 76, 86), (0, 0), edge)

# --- "INVENTORY" label in copper, wide tracking, with rules either side
small = ImageFont.truetype(FONT, 132)
x, y, ws = centered("INVENTORY", small, 1830, tracking=34)
xx = x
for ch, w in zip("INVENTORY", ws):
    d.text((xx - d.textbbox((0, 0), ch, font=small)[0] + 4, y + 6), ch, font=small, fill=(0, 0, 0))
    d.text((xx - d.textbbox((0, 0), ch, font=small)[0], y), ch, font=small, fill=(244, 156, 88))
    xx += w + 34
d.rounded_rectangle((150, 1824, x - 50, 1836), 6, fill=(244, 156, 88))
d.rounded_rectangle((xx + 16, 1824, S - 150, 1836), 6, fill=(244, 156, 88))

out = img.resize((1024, 1024), Image.LANCZOS)
out.resize((512, 512), Image.LANCZOS).save(ROOT / "icon.png", optimize=True)
out.resize((192, 192), Image.LANCZOS).save(ROOT / "icon-192.png", optimize=True)
out.resize((180, 180), Image.LANCZOS).save(ROOT / "apple-touch-icon.png", optimize=True)
print("wrote icon.png, icon-192.png, apple-touch-icon.png")
