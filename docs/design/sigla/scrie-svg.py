import json, math, sys
d = json.load(open(sys.argv[1]))
ROOT = sys.argv[2]
cx, cy, r = d['circle']
C = d['colors']
bird = f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{C["red"]}"/><path fill="{C["navy"]}" d="{d["bird"]}"/><path fill="{C["bg"]}" d="{d["line"]}"/>'
text = f'<path fill="{C["navy"]}" fill-rule="evenodd" d="{d["text"]}"/>'

bx0, by0, bx1, by1 = d['bird_bbox']
x0, y0 = min(bx0, cx - r), min(by0, cy - r)
x1, y1 = max(bx1, cx + r), max(by1, cy + r)
mx, my = (x0 + x1) / 2, (y0 + y1) / 2
side = max(x1 - x0, y1 - y0) + 12
icon_vb = f'{mx - side / 2:.1f} {my - side / 2:.1f} {side:.1f} {side:.1f}'
far = max([math.hypot(x - mx, y - my) for x, y in d['bird_pts']] + [math.hypot(cx - mx, cy - my) + r])
ms = far / 0.4  # zona sigură a iconițelor „maskable”: cercul de rază 40%
mask_vb = (mx - ms / 2, my - ms / 2, ms, ms)
tx0, ty0, tx1, ty1 = d['text_bbox']
fx0, fy0, fx1, fy1 = min(x0, tx0) - 16, y0 - 16, max(x1, tx1) + 16, ty1 + 16

def svg(vb, inner, size=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{size}><title>Pigeonrama</title>{inner}</svg>\n'

files = {
    'docs/design/sigla/pigeonrama.svg': svg('0 0 1024 1024', f'<rect width="1024" height="1024" fill="{C["bg"]}"/>{bird}{text}', ' width="1024" height="1024"'),
    'docs/design/sigla/pigeonrama-transparent.svg': svg(f'{fx0:.1f} {fy0:.1f} {fx1 - fx0:.1f} {fy1 - fy0:.1f}', bird + text, f' width="{round(fx1 - fx0)}" height="{round(fy1 - fy0)}"'),
    'web/public/icon.svg': svg(icon_vb, bird),
    'web/public/wordmark.svg': svg(f'{tx0 - 3:.1f} {ty0 - 3:.1f} {tx1 - tx0 + 6:.1f} {ty1 - ty0 + 6:.1f}', text),
    'web/public/icon-maskable.svg': svg('%.1f %.1f %.1f %.1f' % mask_vb, '<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (*mask_vb, C['bg']) + bird),
}
for p, s in files.items():
    open(f'{ROOT}/{p}', 'w', encoding='utf-8').write(s)
    print(p, len(s), 'bytes')
print('icon', icon_vb, 'maskable', mask_vb)
