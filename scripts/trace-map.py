"""
Trace the coastlines of the known world from the official world map.

Source: the world map from the 2011 anime, as hosted on the Hunterpedia wiki
(File:World_Map.png, 1908x1080). The manga's own map in chapter 38 was used
to check shapes, and to confirm the strait between Kakin and Ochima. The
image is not stored in this repository; download it yourself and pass the
path:

    pip install opencv-python-headless numpy
    python3 scripts/trace-map.py World_Map.png src/data/coast.ts [preview.png]

How it works:
  1. Black ink (the wiki's labels, pointer lines, dots, borders) is painted
     out with inpainting.
  2. The parchment is vignetted, so a smooth surface is fitted to the sea and
     land is measured as "darker than the sea around it".
  3. Coastlines are inked as thin dark strokes. A black-hat filter finds
     them; long straight runs are the map's grid and are removed.
  4. A watershed splits land from sea with the inked coasts as walls, so a
     stain in the parchment cannot join a continent.
  5. A handful of fixes a person made by looking: two pale islands in the
     south are digitised by hand, grid crossings are erased, the strait is
     carved, and holes without an inked shore (pale highlands) are filled.
  6. Contours are simplified and written out in map tiles (15 px per tile).
"""
import json
import sys

import cv2
import numpy as np

PX = 15.0  # source pixels per map tile

# Hand-digitised islands, in source pixels (too pale to threshold).
MANUAL_ISLANDS = [
    [(422, 912), (428, 898), (450, 896), (458, 905), (452, 917), (430, 918)],
    [(372, 993), (390, 996), (410, 994), (430, 992), (450, 995), (470, 993), (490, 990), (505, 998), (520, 1000),
     (526, 1008), (510, 1012), (495, 1015), (482, 1012), (470, 1020), (455, 1026), (435, 1025), (418, 1018),
     (398, 1013), (380, 1012), (372, 1003)],
]
# Grid crossings that survive the filters.
ARTEFACTS = [(1020, 389), (916, 430)]
# The strait between Kakin and Ochima.
STRAIT = [(1180, 548), (1230, 549), (1280, 557), (1330, 567), (1395, 580), (1450, 595), (1500, 606), (1540, 613),
          (1580, 623), (1620, 633), (1660, 643), (1700, 652), (1745, 660), (1800, 668)]
# A stained patch of parchment around the islands west of Greed Island: use a stricter threshold there.
STRICT_BOX = (770, 690, 1010, 905, -26)


def ellipse(n):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (n, n))


def land_mask(im):
    H, W = im.shape[:2]
    L0 = cv2.cvtColor(im, cv2.COLOR_BGR2LAB)[:, :, 0]
    ink = cv2.dilate((L0 < 52).astype(np.uint8) * 255, np.ones((5, 5), np.uint8))
    clean = cv2.inpaint(im, ink, 7, cv2.INPAINT_TELEA)
    L = cv2.cvtColor(clean, cv2.COLOR_BGR2LAB)[:, :, 0].astype(np.float32)
    Ls = cv2.GaussianBlur(L, (0, 0), 2.0)

    # Vignette: fit a polynomial surface to the sea, iteratively.
    yy, xx = np.mgrid[0:H, 0:W]
    u = (xx / W - 0.5) * 2
    v = (yy / H - 0.5) * 2
    terms = [np.ones_like(u), u, v, u * u, u * v, v * v, u ** 3, u * u * v, u * v * v, v ** 3, u ** 4, v ** 4,
             u * u * v * v, u ** 3 * v, u * v ** 3]
    A = np.stack([t.ravel() for t in terms], 1)
    sea = Ls > np.percentile(Ls, 55)
    for _ in range(8):
        idx = np.flatnonzero(sea.ravel())[::13]
        coef, *_ = np.linalg.lstsq(A[idx], Ls.ravel()[idx], rcond=None)
        diff = Ls - (A @ coef).reshape(H, W)
        sea = diff > -10

    # Coast ink without the grid.
    bh = cv2.morphologyEx(L, cv2.MORPH_BLACKHAT, ellipse(11))
    coast = (bh > 9).astype(np.uint8)
    gh = cv2.morphologyEx(coast, cv2.MORPH_OPEN, np.ones((1, 45), np.uint8))
    gv = cv2.morphologyEx(coast, cv2.MORPH_OPEN, np.ones((45, 1), np.uint8))
    coast = coast & (1 - cv2.dilate(gh | gv, np.ones((3, 3), np.uint8)))
    n, lbl, st, _ = cv2.connectedComponentsWithStats(coast, 8)
    keep = np.zeros(n, bool)
    keep[1:] = st[1:, cv2.CC_STAT_AREA] >= 25
    coast = keep[lbl].astype(np.uint8)
    far = cv2.distanceTransform((1 - coast).astype(np.uint8), cv2.DIST_L2, 3)

    # Watershed markers.
    sure_land = cv2.erode((diff < -16).astype(np.uint8), ellipse(5))
    sure_land = cv2.morphologyEx(sure_land, cv2.MORPH_OPEN, ellipse(5))
    cc = cv2.morphologyEx(coast, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lbl, st, _ = cv2.connectedComponentsWithStats((1 - cc).astype(np.uint8), 4)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if x == 0 or y == 0 or x + w == W or y + h == H or a < 15 or a > 30000:
            continue
        m = lbl == i
        if diff[m].mean() < -4:
            sure_land[cv2.erode(m.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0] = 1
    sure_sea = cv2.erode(((diff > -11) & (far > 5)).astype(np.uint8), np.ones((3, 3), np.uint8))
    sure_sea[0:3, :] = 1
    sure_sea[-3:, :] = 1
    sure_sea[:, 0:3] = 1
    sure_sea[:, -3:] = 1
    sure_sea[sure_land > 0] = 0
    markers = np.zeros((H, W), np.int32)
    markers[sure_sea > 0] = 1
    markers[sure_land > 0] = 2
    elev = cv2.GaussianBlur(cv2.dilate(coast, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 1.5)
    cv2.watershed(cv2.merge([np.clip(elev * 255, 0, 255).astype(np.uint8)] * 3), markers)
    land = (markers == 2).astype(np.uint8)
    land = cv2.morphologyEx(land, cv2.MORPH_CLOSE, ellipse(5))
    land = cv2.morphologyEx(land, cv2.MORPH_OPEN, ellipse(3))
    land = fill_holes(land, lambda a, m: a < 1500)

    # The stained box.
    x0, y0, x1, y1, t = STRICT_BOX
    sub = cv2.morphologyEx((diff[y0:y1, x0:x1] < t).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    land[y0:y1, x0:x1] = sub

    # Faint specks are grid crossings; real islets are inked dark.
    n, lbl, st, _ = cv2.connectedComponentsWithStats(land, 8)
    keep = np.ones(n, bool)
    keep[0] = False
    for i in range(1, n):
        a = st[i, cv2.CC_STAT_AREA]
        if a < 40 or (a < 1500 and diff[lbl == i].mean() > -22):
            keep[i] = False
    land = keep[lbl].astype(np.uint8)

    for poly in MANUAL_ISLANDS:
        cv2.fillPoly(land, [np.array(poly, np.int32)], 1)
    for gx, gy in ARTEFACTS:
        _, l0 = cv2.connectedComponents(land, connectivity=8)
        win = l0[gy - 25:gy + 26, gx - 25:gx + 26]
        ks = np.unique(win[win > 0])
        for k in ks:
            land[l0 == k] = 0
    cv2.polylines(land, [np.array(STRAIT, np.int32)], False, 0, 9)

    # Holes with no inked shore are pale highlands, not water.
    def highland(a, m):
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        p = np.vstack([c.reshape(-1, 2) for c in cs])
        return a < 300 or (far[p[:, 1], p[:, 0]] < 6).mean() < 0.5
    land = fill_holes(land, highland)
    return cv2.morphologyEx(land, cv2.MORPH_CLOSE, ellipse(3))


def fill_holes(land, test):
    H, W = land.shape
    n, lbl, st, _ = cv2.connectedComponentsWithStats((1 - land).astype(np.uint8), 4)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if x == 0 or y == 0 or x + w == W or y + h == H:
            continue
        m = (lbl == i).astype(np.uint8)
        if test(a, m):
            land[m > 0] = 1
    return land


def polygons(land):
    cs, hier = cv2.findContours(land, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    for i, c in enumerate(cs):
        a = cv2.contourArea(c)
        if a < 30:
            continue
        s = cv2.approxPolyDP(c, 1.1, True).reshape(-1, 2)
        out.append({'hole': bool(hier[0][i][3] >= 0), 'area': float(a),
                    'pts': [round(float(v) / PX, 1) for xy in s for v in xy]})
    out.sort(key=lambda o: (o['hole'], -o['area']))
    return out


def main():
    src, dst = sys.argv[1], sys.argv[2]
    im = cv2.imread(src)
    if im is None:
        sys.exit(f'cannot read {src}')
    H, W = im.shape[:2]
    land = land_mask(im)
    polys = polygons(land)
    lands = [p['pts'] for p in polys if not p['hole']]
    holes = [p['pts'] for p in polys if p['hole']]
    with open(dst, 'w') as f:
        f.write('/**\n * Coastlines of the known world, traced from the official world map by\n')
        f.write(' * scripts/trace-map.py. Flat [x0, y0, x1, y1, ...] rings in map tiles.\n')
        f.write(' * Generated: do not edit by hand.\n */\n')
        f.write(f'export const TRACE_W = {round(W / PX, 2)}\nexport const TRACE_H = {round(H / PX, 2)}\n')
        f.write('export const COAST_LAND: number[][] = [\n')
        for p in lands:
            f.write('  ' + json.dumps(p, separators=(',', ':')) + ',\n')
        f.write(']\n\n/** Lakes and straits inside the land. */\nexport const COAST_WATER: number[][] = [\n')
        for p in holes:
            f.write('  ' + json.dumps(p, separators=(',', ':')) + ',\n')
        f.write(']\n')
    print(f'{len(lands)} land rings, {len(holes)} water rings, {sum(len(p) for p in lands + holes) // 2} points')
    if len(sys.argv) > 3:
        img = np.full((H, W, 3), (200, 225, 240), np.uint8)
        for p in polys:
            pts = (np.array(p['pts']).reshape(-1, 2) * PX).astype(np.int32)
            cv2.fillPoly(img, [pts], (200, 225, 240) if p['hole'] else (90, 140, 120))
            cv2.polylines(img, [pts], True, (40, 60, 50), 1)
        cv2.imwrite(sys.argv[3], cv2.resize(img, (W * 2 // 3, H * 2 // 3)))


if __name__ == '__main__':
    main()
