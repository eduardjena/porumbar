"""Urmărește sigla Pigeonrama din model.png și scrie SVG-urile (cerc potrivit exact, restul contururi netezite)."""
import sys, json, math
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

MODEL = sys.argv[1]
OUT = sys.argv[2]  # folderul repo-ului

a = np.asarray(Image.open(MODEL).convert('RGB')).astype(float)
H, W = a.shape[:2]
R, G, Bc = a[..., 0], a[..., 1], a[..., 2]

def med(mask):
    return [int(round(np.median(c[mask]))) for c in (R, G, Bc)]

navy = (R < 110) & (G < 110)
red = (R > 150) & (G < 110)
light = (G > 150)
TEXT_Y = 745  # deasupra: porumbelul; dedesubt: textul

yy, xx = np.mgrid[0:H, 0:W]
col = {
    'bg': med(light & ((yy < 100) | (yy > 900))),
    'red': med(red & ndi.binary_erosion(red, iterations=4)),
    'navy': med(navy & ndi.binary_erosion(navy, iterations=4) & (yy < TEXT_Y)),
}

# --- cercul: punctele de pe granița roșu / fundal, potrivire în sensul celor mai mici pătrate (Kasa)
bgd = ndi.binary_dilation(light & (R > 200), iterations=1)
edge = red & bgd
ey, ex = np.nonzero(edge)
A = np.c_[2 * ex, 2 * ey, np.ones_like(ex)]
b = ex ** 2 + ey ** 2
cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]
r = math.sqrt(c + cx ** 2 + cy ** 2)
# granița antialias e la jumătatea pixelului: centrul pixelului +0.5
cx, cy = cx + 0.5, cy + 0.5
res = np.sqrt((ex + .5 - cx) ** 2 + (ey + .5 - cy) ** 2) - r
print('cerc', round(cx, 2), round(cy, 2), round(r, 2), 'abatere', round(float(np.abs(res).mean()), 2))

# --- dunga albă: componentele luminoase care nu ating marginea, în zona porumbelului
lab, n = ndi.label(light)
border = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
cres = np.zeros_like(light)
for k in range(1, n + 1):
    if k in border:
        continue
    m = lab == k
    ys, xs = np.nonzero(m)
    if ys.max() < TEXT_Y and m.sum() > 200:
        cres |= m
        print('dunga', m.sum(), 'px', xs.min(), xs.max(), ys.min(), ys.max())

def marching(F, level):
    """Contururi închise la nivelul dat (F mai mare = înăuntru). Întoarce liste de puncte (x, y) în coordonate de pixel."""
    F = np.pad(F, 1, constant_values=F.min() - 1)
    h, w = F.shape
    inside = F > level
    segs = {}
    def pt(e):
        kind, i, j = e
        if kind == 'h':
            f0, f1 = F[i, j], F[i, j + 1]
            t = (level - f0) / (f1 - f0)
            return (j + t, i)
        f0, f1 = F[i, j], F[i + 1, j]
        t = (level - f0) / (f1 - f0)
        return (j, i + t)
    c00 = inside[:-1, :-1]; c01 = inside[:-1, 1:]; c11 = inside[1:, 1:]; c10 = inside[1:, :-1]
    idx = c00 * 8 + c01 * 4 + c11 * 2 + c10 * 1
    cand = np.argwhere((idx != 0) & (idx != 15))
    adj = {}
    def link(e1, e2):
        adj.setdefault(e1, []).append(e2)
        adj.setdefault(e2, []).append(e1)
    for i, j in cand:
        k = idx[i, j]
        top = ('h', i, j); bot = ('h', i + 1, j); left = ('v', i, j); right = ('v', i, j + 1)
        table = {
            1: [(left, bot)], 2: [(bot, right)], 3: [(left, right)], 4: [(top, right)],
            6: [(top, bot)], 7: [(left, top)], 8: [(left, top)], 9: [(top, bot)],
            11: [(top, right)], 12: [(left, right)], 13: [(bot, right)], 14: [(left, bot)],
        }
        if k in (5, 10):
            centre = (F[i, j] + F[i, j + 1] + F[i + 1, j] + F[i + 1, j + 1]) / 4 > level
            if k == 5:  # 0101: c01 și c10 înăuntru
                pairs = [(top, left), (bot, right)] if not centre else [(top, right), (left, bot)]
            else:  # 1010: c00 și c11 înăuntru
                pairs = [(top, right), (left, bot)] if not centre else [(top, left), (bot, right)]
        else:
            pairs = table[k]
        for p in pairs:
            link(*p)
    loops = []
    seen = set()
    for start in adj:
        if start in seen:
            continue
        loop = [start]; seen.add(start); prev = None; cur = start
        while True:
            nxt = [e for e in adj[cur] if e != prev]
            if not nxt:
                break
            nx = nxt[0]
            if nx == start:
                break
            if nx in seen:
                break
            loop.append(nx); seen.add(nx); prev, cur = cur, nx
        if len(loop) > 8:
            # înapoi la coordonatele imaginii (padding 1) și la granița pixelului (+0.5 centrul)
            loops.append([(x - 1 + .5, y - 1 + .5) for x, y in map(pt, loop)])
    return loops

def smooth(pts, s):
    P = np.array(pts)
    if s <= 0:
        return P
    return np.c_[ndi.gaussian_filter1d(P[:, 0], s, mode='wrap'), ndi.gaussian_filter1d(P[:, 1], s, mode='wrap')]

def rdp(P, eps):
    # închis: împărțit în două la cel mai îndepărtat punct de primul
    def rec(Q):
        if len(Q) < 3:
            return Q
        a_, b_ = Q[0], Q[-1]
        d = b_ - a_
        L = math.hypot(*d)
        if L == 0:
            dist = np.hypot(*(Q - a_).T)
        else:
            dist = np.abs(d[0] * (Q[:, 1] - a_[1]) - d[1] * (Q[:, 0] - a_[0])) / L
        k = int(np.argmax(dist))
        if dist[k] > eps:
            return np.vstack([rec(Q[:k + 1])[:-1], rec(Q[k:])])
        return np.vstack([a_, b_])
    far = int(np.argmax(np.hypot(*(P - P[0]).T)))
    A_ = rec(np.vstack([P[:far + 1]]))
    B_ = rec(np.vstack([P[far:], P[:1]]))
    return np.vstack([A_[:-1], B_[:-1]])

def to_path(P, corner_deg=50):
    """Catmull-Rom închis → curbe Bézier cubice; în colțuri (frângere mare) mânerele sunt zero, ca să rămână ascuțite."""
    n = len(P)
    f = lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')
    corner = []
    for i in range(n):
        u = P[i] - P[i - 1]; v = P[(i + 1) % n] - P[i]
        lu, lv = math.hypot(*u), math.hypot(*v)
        ang = math.degrees(math.acos(max(-1, min(1, float(np.dot(u, v)) / (lu * lv))))) if lu and lv else 0
        corner.append(ang > corner_deg)
    d = [f'M{f(P[0][0])} {f(P[0][1])}']
    for i in range(n):
        p0, p1, p2, p3 = P[i - 1], P[i], P[(i + 1) % n], P[(i + 2) % n]
        L = math.hypot(*(p2 - p1))
        t1 = (p2 - p0); t2 = (p3 - p1)
        c1 = p1 if corner[i] else p1 + t1 / max(1e-9, math.hypot(*t1)) * L / 3
        c2 = p2 if corner[(i + 1) % n] else p2 - t2 / max(1e-9, math.hypot(*t2)) * L / 3
        d.append(f'C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}')
    return ''.join(d) + 'Z'

def area(P):
    x, y = P[:, 0], P[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))

def trace(F, level, region, s=1.2, eps=0.45, min_area=30):
    F = np.where(region, F, F.min())
    out = []
    for loop in marching(ndi.gaussian_filter(F, 0.6), level):
        P = smooth(loop, s)
        if area(P) < min_area:
            continue
        out.append(rdp(P, eps))
    return out

dark = 255 - R  # mai mare = mai închis (albastru)
pig_region = (yy < TEXT_Y)
# porumbelul plin = albastru ∪ dunga (dunga se desenează deasupra, crem)
Fp = np.where(ndi.binary_dilation(cres, iterations=2) & ~navy, 255 - col['navy'][0], dark)
mid_bg = 255 - (col['navy'][0] + col['bg'][0]) / 2
mid_red = 255 - (col['navy'][0] + col['red'][0]) / 2
lvl = (mid_bg + mid_red) / 2
pig = trace(Fp, lvl, pig_region, s=0.8, eps=0.4)
pig.sort(key=area, reverse=True)
print('porumbel', [len(p) for p in pig][:5], [int(area(p)) for p in pig][:5])
pig = pig[:1]

Fc = G
cres_region = ndi.binary_dilation(cres, iterations=3)
crs = trace(Fc, (np.median(G[cres]) + col['navy'][1]) / 2, cres_region, s=1.0, eps=0.35, min_area=50)
print('dunga contururi', [len(p) for p in crs])

txt = trace(dark, 255 - (col['navy'][0] + col['bg'][0]) / 2, yy >= TEXT_Y, s=0.8, eps=0.3, min_area=15)
print('text contururi', len(txt), sum(len(p) for p in txt))

hexc = lambda c: '#%02X%02X%02X' % tuple(c)
crem = med(cres & ndi.binary_erosion(cres, iterations=1)) if cres.sum() else col['bg']
data = dict(circle=[round(cx, 1), round(cy, 1), round(r, 1)], colors={k: hexc(v) for k, v in col.items()} | {'line': hexc(crem)},
            bird=''.join(to_path(p) for p in pig), line=''.join(to_path(p) for p in crs), text=''.join(to_path(p) for p in txt),
            bird_bbox=[float(pig[0][:, 0].min()), float(pig[0][:, 1].min()), float(pig[0][:, 0].max()), float(pig[0][:, 1].max())],
            text_bbox=[float(min(p[:, 0].min() for p in txt)), float(min(p[:, 1].min() for p in txt)), float(max(p[:, 0].max() for p in txt)), float(max(p[:, 1].max() for p in txt))],
            bird_pts=pig[0].tolist())
json.dump(data, open(OUT, 'w'))
print(data['colors'], data['bird_bbox'], data['text_bbox'])
