"""Draws the home-screen icon (same dark metal-plate style as the ASRP Timesheet icon).
Writes icon.png (512), icon-192.png and apple-touch-icon.png (180) to the repo root.
Run from the repo root:  python3 tools/make_icon.py   (needs Pillow and Poppins Bold)
"""
import pathlib, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
S = 1024
random.seed(7)

def vgrad(w, h, top, bot):
    g = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return g

def mask_rr(w, h, box, r):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle(box, r, fill=255)
    return m

# --- base: dark brushed metal, full bleed (iOS rounds the corners itself)
img = vgrad(S, S, (58, 62, 66), (22, 24, 27))
noise = Image.effect_noise((S, S), 28).convert("RGB")
img = Image.blend(img, noise, 0.06)
streak = Image.new("L", (S, S), 0)
sd = ImageDraw.Draw(streak)
for _ in range(900):
    y = random.randint(0, S); x = random.randint(-200, S); l = random.randint(80, 420)
    sd.line([(x, y), (x + l, y)], fill=random.randint(10, 40))
img.paste((255, 255, 255), (0, 0), streak.filter(ImageFilter.GaussianBlur(0.6)).point(lambda v: v // 3))

# --- beveled steel frame + inner panel
frame = vgrad(S, S, (205, 210, 214), (88, 92, 97))
img.paste(frame, (0, 0), mask_rr(S, S, (34, 34, S - 34, S - 34), 120))
img.paste(vgrad(S, S, (50, 54, 58), (26, 28, 31)), (0, 0), mask_rr(S, S, (58, 58, S - 58, S - 58), 100))
panel = vgrad(S, S, (44, 47, 51), (30, 32, 35))
panel = Image.blend(panel, noise, 0.05)
img.paste(panel, (0, 0), mask_rr(S, S, (66, 66, S - 66, S - 66), 94))
d = ImageDraw.Draw(img)

def screw(cx, cy, r=26):
    d.ellipse((cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4), fill=(18, 19, 21))
    for i in range(r, 0, -1):
        c = int(70 + 120 * (1 - i / r))
        d.ellipse((cx - i, cy - i - (r - i) * 0.15, cx + i, cy + i - (r - i) * 0.15), fill=(c, c + 3, c + 6))
    d.line((cx - r * 0.62, cy - r * 0.62, cx + r * 0.62, cy + r * 0.62), fill=(35, 37, 40), width=7)
    d.line((cx - r * 0.62, cy + r * 0.62, cx + r * 0.62, cy - r * 0.62), fill=(35, 37, 40), width=7)
for cx, cy in [(118, 118), (S - 118, 118), (118, S - 118), (S - 118, S - 118), (118, S // 2 + 70), (S - 118, S // 2 + 70)]:
    screw(cx, cy)

# --- parts-bin organizer (top area): 3 x 2 drawers with colored labels
shadow = Image.new("L", (S, S), 0)
ImageDraw.Draw(shadow).rounded_rectangle((232, 168, 742, 520), 30, fill=170)
img.paste((0, 0, 0), (12, 18), shadow.filter(ImageFilter.GaussianBlur(14)))
d = ImageDraw.Draw(img)
d.rounded_rectangle((220, 150, 730, 500), 30, fill=(214, 218, 222))
d.rounded_rectangle((232, 162, 718, 488), 24, fill=(176, 182, 188))
labels = [(242, 196, 64), (214, 64, 56), (66, 120, 196), (72, 156, 84), (242, 196, 64), (66, 120, 196)]
dw, dh, gx, gy = 146, 140, 18, 18
for i in range(6):
    col, row = i % 3, i // 3
    x0 = 250 + col * (dw + gx); y0 = 180 + row * (dh + gy)
    d.rounded_rectangle((x0, y0, x0 + dw, y0 + dh), 14, fill=(236, 239, 242), outline=(140, 146, 152), width=3)
    d.rounded_rectangle((x0 + 22, y0 + 22, x0 + dw - 22, y0 + 50), 6, fill=labels[i])
    d.rounded_rectangle((x0 + 40, y0 + dh - 44, x0 + dw - 40, y0 + dh - 24), 10, fill=(120, 126, 132))

# --- orange PEX 90 elbow in front (like the pen on the timesheet icon)
def elbow(draw, ox, oy, scale, color, hi, dark):
    w = int(62 * scale); r = int(120 * scale)
    box = (ox - r, oy - r, ox + r, oy + r)
    draw.arc(box, 180, 270, fill=dark, width=w + 14)
    draw.arc(box, 180, 270, fill=color, width=w)
    draw.arc((box[0] + w * 0.25, box[1] + w * 0.25, box[2] - w * 0.25, box[3] - w * 0.25), 195, 255, fill=hi, width=max(6, w // 5))
    # fitting ends (crimp rings)
    for (x0, y0, x1, y1) in [(ox - r - w // 2 - 10, oy - 4, ox - r + w // 2 + 10, oy + 46), (ox - 4, oy - r - w // 2 - 10, ox + 46, oy - r + w // 2 + 10)]:
        draw.rounded_rectangle((x0, y0, x1, y1), 8, fill=(196, 200, 204), outline=dark, width=4)
ov = Image.new("RGBA", (S, S), (0, 0, 0, 0))
od = ImageDraw.Draw(ov)
elbow(od, 820, 470, 1.25, (232, 128, 36), (255, 196, 120), (120, 58, 12))
sh = ov.split()[3].filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.6))
img.paste((0, 0, 0), (10, 14), sh)
img.paste(ov, (0, 0), ov)
d = ImageDraw.Draw(img)

# --- "ASRP" big metallic lettering
def text_center(txt, font, cy):
    b = d.textbbox((0, 0), txt, font=font)
    return (S - (b[2] - b[0])) // 2 - b[0], cy - (b[3] - b[1]) // 2 - b[1]
big = ImageFont.truetype(FONT, 214)
x, y = text_center("ASRP", big, 650)
tm = Image.new("L", (S, S), 0); ImageDraw.Draw(tm).text((x, y), "ASRP", font=big, fill=255)
img.paste((0, 0, 0), (0, 0), tm.filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.GaussianBlur(3)))
img.paste((12, 13, 15), (6, 10), tm.filter(ImageFilter.MaxFilter(9)))
img.paste(vgrad(S, S, (255, 255, 255), (178, 184, 190)), (0, 0), tm)

# --- bottom plaque: "Inventory"
d = ImageDraw.Draw(img)
d.rounded_rectangle((150, 790, S - 150, 920), 26, fill=(150, 156, 162))
d.rounded_rectangle((160, 800, S - 160, 910), 20, fill=(20, 22, 25))
small = ImageFont.truetype(FONT, 92)
x, y = text_center("Inventory", small, 858)
d.text((x + 3, y + 4), "Inventory", font=small, fill=(0, 0, 0))
d.text((x, y), "Inventory", font=small, fill=(245, 246, 247))

img = img.convert("RGB")
img.resize((512, 512), Image.LANCZOS).save(ROOT / "icon.png", optimize=True)
img.resize((192, 192), Image.LANCZOS).save(ROOT / "icon-192.png", optimize=True)
img.resize((180, 180), Image.LANCZOS).save(ROOT / "apple-touch-icon.png", optimize=True)
print("wrote icon.png, icon-192.png, apple-touch-icon.png")
