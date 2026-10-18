"""
Hand-authored vector artwork for tools/feisar_livery.py (FEISAR body atlas, 512-unit coordinates).

Everything is authored in the coordinates of the RIGHT-hand islands as they appear in the atlas; the
left-hand islands get the same artwork mirrored by Frame.pt(), with the type kept readable.
Orientation of the type per island comes from the UV Jacobians (atlas +x / +y -> model directions):
  pods, front side panels, right nose side, top deck:  +x = towards the tail (sides) / along the deck,
                                                       +y = up on the model        -> glyphs scale(1,-1)
  left nose side:                                      +x = towards the tail, +y = down -> glyphs scale(-1,1)
"""
import itertools

MICRO = itertools.cycle([
    "FEISAR AG-SYSTEMS / FX350 HULL ASSEMBLY",
    "FEDERAL EUROPEAN INDUSTRIAL SCIENCE AND RESEARCH",
    "AG FIELD EMITTER CLASS 4 - DO NOT WALK",
    "BRUSSELS / TOULOUSE / BREMEN / TORINO",
    "INSPECT LIFT VANE SEALS EVERY 40 LAPS",
    "CERTIFIED F3600 - EU TYPE APPROVAL 2097",
    "THRUST CORE COOLANT LINE - HIGH PRESSURE",
    "COMPOSITE PANEL 21-4445 REV.C",
])


class Frame:
    def __init__(self, mirror=None, glyph="scale(1,-1)"):
        self.mirror = mirror      # None | ("x", c) | ("y", c): reflect authored coords about x=c / y=c
        self.glyph = glyph        # glyph orientation

    def pt(self, x, y):
        if self.mirror and self.mirror[0] == "x":
            return 2 * self.mirror[1] - x, y
        if self.mirror and self.mirror[0] == "y":
            return x, 2 * self.mirror[1] - y
        return x, y

    def upright(self, x, y, inner):
        """inner artwork authored around (0, 0), placed at (x, y) and turned upright on the model"""
        X, Y = self.pt(x, y)
        return f'<g transform="translate({X:.2f} {Y:.2f}) {self.glyph}">{inner}</g>'

    def g(self, inner):
        if not self.mirror:
            return inner
        if self.mirror[0] == "x":
            return f'<g transform="matrix(-1 0 0 1 {2 * self.mirror[1]} 0)">{inner}</g>'
        return f'<g transform="matrix(1 0 0 -1 0 {2 * self.mirror[1]})">{inner}</g>'

    def text(self, x, y, s, size, fill, font="Saira", weight=500, anchor="middle", spacing=0):
        X, Y = self.pt(x, y)
        if self.mirror:           # mirrored layout: the type grows the other way from its anchor
            anchor = {"start": "end", "end": "start"}.get(anchor, anchor)
        # type is authored with its baseline at (x, y); glyph flip keeps it readable on the model
        return (f'<text transform="translate({X:.2f} {Y:.2f}) {self.glyph}" font-family="{font}" font-size="{size}" '
                f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" letter-spacing="{spacing}" '
                f'dominant-baseline="central">{s}</text>')

    def micro(self, x, y, w, rows, fill, size=1.55, title=True):
        """block of small print: (x, y) = top-left as seen on the model, in authored atlas coords"""
        out = []
        for i in range(rows):
            yy = y - i * size * 1.35          # authored frames: down on the model = -y
            s = next(MICRO)
            sz = size * (1.25 if (title and i == 0) else 1)
            out.append(self.text(x, yy, s.upper() if i == 0 else s.lower().capitalize(), sz, fill,
                                 weight=700 if (title and i == 0) else 500, anchor="start",
                                 spacing=0.05))
            out[-1] = out[-1].replace("<text ", f'<text textLength="{w}" lengthAdjust="spacingAndGlyphs" ', 1)
        return "".join(out)


def poly(pts, fill, extra=""):
    return f'<polygon points="{" ".join(f"{x},{y}" for x, y in pts)}" fill="{fill}" {extra}/>'


def hatch(x0, y0, x1, y1, fill, step=2.6, slant=1.0, cid=[0]):
    cid[0] += 1
    c = f"hc{cid[0]}"
    h = y1 - y0
    bars = "".join(poly([(x, y0), (x + step / 2, y0), (x + step / 2 + h * slant, y1), (x + h * slant, y1)], fill)
                   for x in [x0 - h * 2 + i * step for i in range(int((x1 - x0 + h * 3) / step) + 2)])
    return (f'<clipPath id="{c}"><rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}"/></clipPath>'
            f'<g clip-path="url(#{c})">{bars}</g>')


def hazard(x0, y0, x1, y1, C, step=2.4, cid=[0]):
    cid[0] += 1
    return (f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="#ffffff"/>'
            + hatch(x0, y0, x1, y1, C["red"], step=step, slant=-0.8))


def grille(x0, y0, x1, y1, C, n=12):
    out = [f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="none" stroke="{C["pale"]}" stroke-width=".55" opacity=".9"/>']
    w = (x1 - x0 - 3) / n
    for i in range(n):
        out.append(f'<rect x="{x0 + 1.5 + i * w + w * .25:.2f}" y="{y0 + 1.5}" width="{w * .5:.2f}" height="{y1 - y0 - 3}" fill="{C["pale"]}" opacity=".75"/>')
    return "".join(out)


def star(cx, cy, r, fill):
    """FEISAR six-arm 'snowflake' mark"""
    arms = "".join(f'<rect x="{-r * .2}" y="{-r}" width="{r * .4}" height="{r * 2}" rx="{r * .08}" transform="rotate({a})"/>'
                   for a in (0, 60, 120))
    return f'<g transform="translate({cx} {cy})" fill="{fill}">{arms}<circle r="{r * .38}"/></g>'


def ring(cx, cy, r, fill):
    """FEISAR 'C' ring mark"""
    def arc(R, t, a0, a1):
        import math
        p = lambda a, rr: (cx + rr * math.cos(math.radians(a)), cy + rr * math.sin(math.radians(a)))
        (x0, y0), (x1, y1) = p(a0, R), p(a1, R)
        (x2, y2), (x3, y3) = p(a1, R - t), p(a0, R - t)
        big = 1 if (a1 - a0) % 360 > 180 else 0
        return (f'<path d="M{x0:.2f},{y0:.2f} A{R},{R} 0 {big} 1 {x1:.2f},{y1:.2f} L{x2:.2f},{y2:.2f} '
                f'A{R - t},{R - t} 0 {big} 0 {x3:.2f},{y3:.2f}Z" fill="{fill}"/>')
    return arc(r, r * .28, 40, 320) + arc(r * .6, r * .24, 70, 330)


def arrow(x0, y, x1, h, fill):
    """block arrow pointing towards x1 (works both ways)"""
    d = 1 if x1 > x0 else -1
    hx = x1 - d * h * 1.1
    return poly([(x0, y - h * .22), (hx, y - h * .22), (hx, y - h * .6), (x1, y), (hx, y + h * .6),
                 (hx, y + h * .22), (x0, y + h * .22)], fill)


def roundel(cx, cy, r, C, cid=[0]):
    cid[0] += 1
    c = f"rc{cid[0]}"
    return (f'<clipPath id="{c}"><circle cx="{cx}" cy="{cy}" r="{r * .9}"/></clipPath>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{C["white"]}"/>'
            f'<g clip-path="url(#{c})">'
            f'<rect x="{cx - r}" y="{cy - r}" width="{2 * r}" height="{2 * r}" fill="{C["teal"]}"/>'
            f'<path d="M{cx - r},{cy - r * .05} C{cx - r * .35},{cy - r * .25} {cx - r * .1},{cy - r * .75} {cx + r},{cy - r * .55} '
            f'L{cx + r},{cy - r} L{cx - r},{cy - r}Z" fill="{C["yellow"]}"/>'
            f'<path d="M{cx - r},{cy + r * .05} C{cx - r * .3},{cy - r * .1} {cx - r * .05},{cy - r * .55} {cx + r},{cy - r * .35} '
            f'L{cx + r},{cy - r * .05} C{cx + r * .1},{cy - r * .2} {cx - r * .3},{cy + r * .3} {cx - r},{cy + r * .45}Z" fill="{C["white"]}"/>'
            f'<path d="M{cx - r},{cy + r * .55} C{cx - r * .2},{cy + r * .3} {cx + r * .2},{cy + r * .05} {cx + r},{cy + r * .05} '
            f'L{cx + r},{cy + r * .25} C{cx + r * .2},{cy + r * .25} {cx - r * .2},{cy + r * .5} {cx - r},{cy + r * .78}Z" fill="{C["sky"]}"/>'
            f'</g><circle cx="{cx}" cy="{cy}" r="{r * .9}" fill="none" stroke="{C["ink"]}" stroke-width=".35"/>')


def panel_lines(segs, C, op=.55, w=.45):
    # class "pl": also cut as a groove into the normal map (see feisar_livery.py)
    return "".join(f'<line class="pl" x1="{a}" y1="{b}" x2="{c}" y2="{d}" stroke="{C["pale"]}" stroke-width="{w}" opacity="{op}"/>'
                   for a, b, c, d in segs)


# ---------------------------------------------------------------------------------------------- islands
def pod(C, fr):
    # fields (authored for the right pod; front of the craft = small x)
    s = []
    s.append(poly([(0, 300), (96, 262), (104, 262), (112, 290), (124, 330), (134, 370), (142, 400), (150, 430), (0, 430)], C["yellow"]))
    s.append(poly([(0, 364), (112, 430), (0, 430)], C["pale"]))
    s.append(poly([(92, 262), (118, 262), (130, 300), (145, 350), (158, 395), (168, 430), (148, 430), (138, 395),
                   (126, 350), (112, 300)], C["white"]))
    s.append(poly([(0, 262), (70, 262), (70, 290), (0, 290)], C["yellow"]))           # front flap
    # panel lines
    s.append(panel_lines([(150, 326, 240, 326), (205, 326, 172, 392), (18, 341, 104, 341), (20, 396, 140, 396),
                          (56, 342, 56, 418), (182, 268, 182, 326), (226, 300, 226, 366)], C))
    s.append(panel_lines([(18, 342, 104, 342), (20, 397, 140, 397), (57, 343, 57, 418)], {**C, "pale": C["ink"]}, op=.25, w=.35))
    # sky trim around the teal rear section
    s.append(f'<path d="M168,268 L230,268 L244,300 L236,330 L224,364 L170,378" fill="none" stroke="{C["sky"]}" stroke-width="1.6" stroke-linejoin="round"/>')
    # hatch + grille + bracket + bars in the teal part
    s.append(hatch(154, 277, 193, 287, C["white"], step=3.0, slant=-.9))
    s.append(grille(150, 292, 188, 322, C, n=11))
    br = f'<path d="M201,290 L215,290 L215,296 L207,296 L207,318 L215,318 L215,324 L201,324Z"/>'
    s.append(f'<clipPath id="pbr{id(fr)}">{br}</clipPath><g clip-path="url(#pbr{id(fr)})">{hazard(199, 288, 217, 326, C, step=3)}</g>')
    for yy in (301, 307, 313):
        s.append(f'<rect x="{218}" y="{yy - 1}" width="11" height="2" fill="{C["ink"]}"/>')
    s.append(f'<rect x="207" y="346" width="11" height="2.2" fill="{C["ink"]}"/>')
    s.append(f'<rect x="206" y="375" width="5" height="13" rx="2.5" fill="#fff"/>')
    s.append(f'<clipPath id="pcap{id(fr)}"><rect x="206" y="375" width="5" height="13" rx="2.5"/></clipPath>'
             f'<g clip-path="url(#pcap{id(fr)})">{hatch(206, 375, 211, 388, C["red"], step=2.4, slant=-.8)}</g>')
    # yellow section: hatch band, central plate, arrow
    s.append(hatch(72, 326, 126, 338, C["white"], step=3.0, slant=-.9))
    s.append(f'<rect x="61" y="348" width="76" height="40" fill="none" stroke="{C["ink"]}" stroke-width=".45" opacity=".55"/>')
    s.append(f'<rect x="73" y="352" width="62" height="32" fill="#e3ad08"/>')
    s.append(f'<rect x="64" y="350" width="7" height="36" fill="#9c7a12"/>')
    hexg = (f'<polygon points="92,362 98,362 101,368 98,374 92,374 89,368" fill="none" stroke="#fff" stroke-width="1.6"/>'
            f'<polygon points="93.5,365 96.5,365 98,368 96.5,371 93.5,371 92,368" fill="#fff"/>'
            + "".join(f'<path d="M{x},362 L{x + 4},368 L{x},374" fill="none" stroke="#fff" stroke-width="1.6"/>' for x in (104, 109, 114))
            + f'<path d="M86,362 L82,368 L86,374" fill="none" stroke="#fff" stroke-width="1.6"/>')
    s.append(hexg)
    s.append(hazard(122, 356, 132, 380, C, step=2.6))
    s.append(f'<rect x="122" y="353" width="10" height="3" fill="{C["ink"]}"/><rect x="122" y="380" width="10" height="3" fill="{C["ink"]}"/>')
    for yy in (359, 377):
        s.append(f'<rect x="76" y="{yy - 1}" width="8" height="2" fill="{C["ink"]}"/>')
    s.append("".join(f'<rect x="{80 + i * 5}" y="385.5" width="3" height="1" fill="#fff"/>' for i in range(10)))
    s.append(arrow(70, 406, 97, 6, "#ffffff"))
    out = fr.g("".join(s))
    # type (kept readable) -- top-left anchors as seen on the model
    out += fr.micro(74, 318, 30, 5, C["ink"], size=1.45)
    out += fr.micro(20, 366, 28, 4, C["ink"], size=1.4)
    out += fr.micro(20, 352, 28, 3, C["ink"], size=1.4)
    out += fr.micro(108, 412, 30, 4, C["ink"], size=1.35)
    out += fr.micro(148, 352, 30, 5, C["ink"], size=1.35)
    out += fr.text(160, 332, "FX350", 4.6, "#ffffff", font="Michroma", anchor="start", spacing=.4)
    out += fr.text(25, 333, "LIFT VANE / DO NOT STEP", 1.9, C["ink"], weight=700, anchor="start", spacing=.15)
    out += fr.text(98, 343, "ANTI-GRAVITY SYSTEMS", 1.7, "#ffffff", weight=700, anchor="end", spacing=.2)
    out += fr.upright(127, 303, roundel(0, 0, 24, C))
    return out


def side(C, fr, main=False):
    s = []
    s.append(f'<rect x="20" y="420" width="210" height="90" fill="{C["pale"]}"/>')
    s.append(poly([(20, 434), (20, 510), (96, 510)], C["teal"]))
    s.append(poly([(20, 420), (72, 420), (136, 488), (122, 510), (96, 510), (20, 434)], C["white"]))
    s.append(poly([(156, 420), (230, 420), (230, 474)], C["yellow"]))
    s.append(poly([(122, 510), (136, 488), (230, 468), (230, 510)], C["teal"]))
    s.append(panel_lines([(70, 440, 70, 500), (150, 430, 150, 486), (36, 440, 36, 500)], {**C, "pale": C["sky"]}, op=.8))
    s.append(f'<rect x="60" y="440" width="36" height="22" fill="none" stroke="{C["sky"]}" stroke-width=".5"/>')
    s.append(f'<circle cx="190" cy="444" r="8" fill="none" stroke="{C["ink"]}" stroke-width=".5" opacity=".45"/>')
    for yy in (449, 455):
        s.append(f'<rect x="34" y="{yy - 1}" width="9" height="2" fill="{C["ink"]}"/>')
    for i in range(3):
        s.append(f'<rect x="{84 + i * 6}" y="466" width="4" height="1.6" fill="{C["teal"]}"/>')
    s.append(star(141, 454, 9, "#ffffff"))
    s.append(arrow(48, 489, 76, 6, "#ffffff"))
    if main:
        s.append(f'<rect x="124" y="469" width="27" height="10" fill="{C["pale"]}"/>')   # cockpit-sill sample point
    out = fr.g("".join(s))
    out += fr.text(92, 451, "21/4445", 4.8, C["ink"], font="Michroma", spacing=.1)
    out += fr.micro(74, 459, 30, 3, C["ink"], size=1.3)
    out += fr.micro(164, 459, 32, 4, C["ink"], size=1.3)
    out += fr.text(96, 478, "FX", 9, C["red"], font="Michroma", weight=700, spacing=-.2)
    return out


def nose_side(C, fr):
    s = []
    s.append(f'<rect x="50" y="110" width="200" height="70" fill="{C["teal"]}"/>')
    s.append(poly([(56, 163), (84, 132), (240, 124), (240, 131), (88, 137), (60, 165)], C["white"]))
    s.append(poly([(56, 166), (240, 172), (240, 168), (60, 163)], C["sky"]))
    s.append(f'<rect x="86" y="138.5" width="140" height="21" fill="none" stroke="{C["sky"]}" stroke-width=".7"/>')
    s.append(f'<rect x="88" y="140.5" width="13" height="17" fill="none" stroke="{C["sky"]}" stroke-width=".5"/>')
    s.append(star(*(94.5, 149), 6, "#ffffff"))
    s.append(panel_lines([(132, 126, 132, 138), (175, 124, 175, 138), (132, 160, 132, 169), (175, 160, 175, 170)], C, op=.7))
    out = fr.g("".join(s))
    out += fr.text(106, 151, "feisar.", 16, "#ffffff", font="Michroma", anchor="start", spacing=1.0)
    out += fr.text(107, 141.2, "FEDERAL EUROPEAN INDUSTRIAL SCIENCE AND RESEARCH", 2.1, C["pale"], weight=600, anchor="start", spacing=.35)
    out += fr.text(224, 163, "RACE FOR E-UNITY", 2.4, "#ffffff", weight=700, anchor="end", spacing=.5)
    return out


def top(C, fr):
    s = []
    # nose top strip
    s.append(f'<rect x="64" y="5" width="192" height="40" fill="{C["teal"]}"/>')
    s.append(f'<rect x="70" y="16" width="80" height="18" fill="{C["sky"]}" opacity=".55"/>')
    s.append(f'<rect x="153" y="16" width="94" height="18" fill="none" stroke="{C["sky"]}" stroke-width=".6"/>')
    s.append(star(161, 25, 5.5, "#ffffff"))
    s.append(f'<g transform="rotate(-40 178 25)">{arrow(169, 25, 188, 8, "#ffffff")}</g>')
    bars = [2.5, 1, 1, 4, 1, 2, 1, 1, 5, 1, 2, 1, 1, 2.5, 1, 1]
    x = 193
    for i, w in enumerate(bars):
        if i % 2 == 0:
            s.append(f'<rect x="{x}" y="18" width="{w}" height="14" fill="#ffffff"/>')
        x += w + .8
    # deck behind the canopy
    s.append(f'<rect x="60" y="76" width="196" height="38" fill="{C["teal"]}"/>')
    s.append(f'<rect x="64" y="80" width="80" height="30" fill="{C["pale"]}"/>')
    s.append(f'<rect x="143" y="79" width="53" height="32" fill="{C["yellow"]}"/>')
    s.append(f'<rect x="196" y="79" width="9" height="32" fill="{C["white"]}"/>')
    s.append(panel_lines([(160, 79, 160, 111), (178, 79, 178, 111)], {**C, "pale": C["ink"]}, op=.25))
    s.append(arrow(110, 95, 141, 7, "#ffffff"))
    s.append(arrow(176, 102, 191, 4.5, "#ffffff"))
    s.append(hazard(244, 76, 252, 114, C, step=2.6))
    # deck 2 (between the nose and the canopy)
    s.append(f'<rect x="150" y="42" width="106" height="34" fill="{C["teal"]}"/>')
    s.append(f'<rect x="158" y="50" width="18" height="18" rx="1.5" fill="{C["ink"]}" opacity=".65"/>')
    s.append(hazard(180, 49, 183, 70, C, step=2))
    s.append(grille(189, 51, 222, 68, C, n=10))
    s.append(ring(236, 60, 10, "#ffffff"))
    # rear flap (yellow X plates)
    for (x0, y0) in ((2, 172), (2, 214)):
        s.append(f'<rect x="{x0}" y="{y0}" width="66" height="40" fill="{C["yellow"]}"/>')
        s.append(f'<path d="M{x0 + 10},{y0 + 6} L{x0 + 56},{y0 + 34} M{x0 + 56},{y0 + 6} L{x0 + 10},{y0 + 34}" stroke="#d29f00" stroke-width="7"/>')
    out = "".join(s)
    out += fr.upright(213, 94, roundel(0, 0, 12.5, C))
    out += fr.micro(70, 96, 32, 4, C["ink"], size=1.5)
    out += fr.text(100, 25, "FX350 / EU-AG 2097", 3.2, "#ffffff", font="Michroma", spacing=.2)
    return out


def decals(C):
    out = [f'<rect x="0" y="0" width="256" height="512" fill="{C["teal"]}"/>',
           f'<rect x="256" y="256" width="256" height="256" fill="{C["teal"]}"/>']
    out.append(top(C, Frame()))
    out.append(nose_side(C, Frame()))
    out.append(nose_side(C, Frame(mirror=("y", 185), glyph="scale(-1,1)")))
    out.append(pod(C, Frame()))
    out.append(pod(C, Frame(mirror=("x", 256.5))))
    out.append(side(C, Frame(), main=True))
    out.append(side(C, Frame(mirror=("x", 256.5))))
    return "\n".join(out)
