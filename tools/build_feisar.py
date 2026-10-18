"""
FEISAR FX350 (Wipeout HD) — fan-made recreation for Blender (v4).

Traced from the official "WipEout HD Fury – Feisar Ship Elevations" sheets (PlayStation Blog
Europe, 2009): side silhouette sampled from the HD side elevation, planform and wing layout
from the HD top elevation.

Layout (web axes: x right, y up, z forward, nose at +z, length 8.2):
  * a slender forebody (nose wedge -> cockpit),
  * two large swept delta wings rooted high on the rear hull, drooping back and out to
    rounded tips,
  * an exposed turbine stack in the channel between the wing roots, twin round exhausts.

Exports assets/models/feisar_fx350.glb with named assemblies (hull, wing_R, turbines, ...).
Materials "fsr_livery" (hull) and "fsr_wing" carry UVs for the livery painted by js/livery.js.

Run:  tools/blender-bwrap.sh -b --python tools/build_feisar.py
  or: flatpak run --filesystem=$PWD org.blender.Blender -b --python tools/build_feisar.py
"""
import math
import os

import bmesh
import bpy
import mathutils as mu

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "models", "feisar_fx350.glb")
TAU = math.tau
V3 = mu.Vector


def B(p):
    x, y, z = p
    return V3((x, -z, y))


def lerp(a, b, t):
    return a + (b - a) * t


def lerp3(a, b, t):
    return tuple(lerp(u, v, t) for u, v in zip(a, b))


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ================================================================ materials
MATS = {}


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def material(name, color, metal=0.0, rough=0.35, coat=0.0, emit=None, alpha=1.0, strength=6.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*srgb(color), 1.0)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.05
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*srgb(emit), 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    MATS[name] = m


material("fsr_livery", "#ffffff", rough=0.3, coat=1.0)
material("fsr_wing", "#ffffff", rough=0.3, coat=1.0)
material("fsr_white", "#e9edf2", rough=0.3, coat=1.0)
material("fsr_teal", "#2a9fcb", rough=0.3, coat=1.0)
material("fsr_yellow", "#f0c21b", rough=0.3, coat=1.0)
material("fsr_dark", "#2b313a", metal=0.6, rough=0.42, coat=0.3)
material("fsr_carbon", "#16191f", metal=0.2, rough=0.45, coat=0.8)
material("fsr_metal", "#c3cad3", metal=1.0, rough=0.22)
material("fsr_gunmetal", "#4d5560", metal=1.0, rough=0.34)
material("fsr_steel", "#8d96a1", metal=1.0, rough=0.3)
material("fsr_rubber", "#0c0e12", rough=0.8)
material("fsr_glass", "#1d5f8f", metal=0.3, rough=0.02, coat=1.0, alpha=0.5)
material("fsr_helmet", "#f2c230", rough=0.2, coat=1.0)
material("fsr_visor", "#0a0f1a", metal=0.8, rough=0.05, coat=1.0)
material("fsr_suit", "#1d4fa8", rough=0.6)
material("fsr_screen", "#7fe3ff", emit="#3fc6ff", strength=3.0)
material("fsr_engine", "#bff3ff", emit="#6fdcff")
material("fsr_field", "#8feaff", emit="#3fc6ff")
material("fsr_light_red", "#ff3b3b", emit="#ff2020", strength=8.0)
material("fsr_light_green", "#38ff88", emit="#20ff70", strength=8.0)
material("fsr_light_white", "#ffffff", emit="#ffffff", strength=8.0)

# ================================================================ primitives
PARTS = {}


def add(group, ob):
    PARTS.setdefault(group, []).append(ob)
    return ob


def finish(name, bm, mats, smooth_angle=0.6, bevel=0.0, segments=3, group=None, weighted=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for mn in mats:
        me.materials.append(MATS[mn])
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    for o in scene.objects:
        o.select_set(False)
    ob.select_set(True)
    if bevel > 0:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(30)
        mod.harden_normals = True
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=smooth_angle)
    except Exception:
        bpy.ops.object.shade_flat()
    if weighted:
        wn = ob.modifiers.new("wn", "WEIGHTED_NORMAL")
        wn.keep_sharp = True
    ob.select_set(False)
    if group:
        add(group, ob)
    return ob


def loft(name, rings, mat_of, mats, cap_front=None, cap_back=None, bevel=0.0, uv_of=None, group=None, closed=True, smooth=0.6):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    V = [[bm.verts.new(B(p)) for p in r] for r in rings]
    n = len(rings[0])
    for i in range(len(rings) - 1):
        for j in range(n if closed else n - 1):
            k = (j + 1) % n
            f = bm.faces.new((V[i][j], V[i][k], V[i + 1][k], V[i + 1][j]))
            f.material_index = mat_of(i, j)
            if uv_of:
                for loop, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                    loop[uvl].uv = uv_of(ii, jj)
    if cap_front is not None:
        f = bm.faces.new(V[0][::-1]); f.material_index = cap_front
    if cap_back is not None:
        f = bm.faces.new(V[-1]); f.material_index = cap_back
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, mats, bevel=bevel, group=group, smooth_angle=smooth)


def box(name, c, s, mat, rot=(0, 0, 0), bevel=0.01, group=None, segments=2, basis=None):
    """c: centre, s: (x, y, z) size. rot: (pitch about x, yaw about y, roll about z), web axes.
    basis: optional (ax, ay, az) web-space unit vectors replacing rot."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= s[0]; v.co.y *= s[2]; v.co.z *= s[1]
    ob = finish(name, bm, [mat], bevel=bevel, group=group, segments=segments)
    if basis:
        # orthonormalise around the normal (ay), keep the frame right-handed and close to the given axes
        ax, ay, az = (V3(v).normalized() for v in basis)
        ax = (ax - ay * ay.dot(ax)).normalized()
        az2 = ax.cross(ay)
        if az2.dot(az) < 0:
            ax = -ax
            az2 = ax.cross(ay)
        ax, ay, az = B(ax).normalized(), B(ay).normalized(), B(az2).normalized()
        # local Blender axes: X = web x, Y = -web z, Z = web y
        m = mu.Matrix((ax, -az, ay)).transposed()
        ob.matrix_world = mu.Matrix.Translation(B(c)) @ m.to_4x4()
    else:
        ob.location = B(c)
        ob.rotation_mode = "YXZ"
        ob.rotation_euler = (rot[0], -rot[2], rot[1])
    return ob


def cylinder(name, c, r, length, mat, r2=None, verts=32, axis="z", group=None, cap=True, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=length)
    ob = finish(name, bm, [mat], smooth_angle=0.9, group=group, bevel=bevel)
    ob.location = B(c)
    if axis == "z":
        ob.rotation_euler = (math.radians(-90), 0, 0)
    elif axis == "x":
        ob.rotation_euler = (0, math.radians(90), 0)
    return ob


def torus(name, c, R, r, mat, group=None):
    bm = bmesh.new()
    seg, ring = 48, 12
    rows = []
    for i in range(seg):
        a = i / seg * TAU
        rows.append([bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
                     for b in [j / ring * TAU for j in range(ring)]])
    for i in range(seg):
        for j in range(ring):
            bm.faces.new((rows[i][j], rows[(i + 1) % seg][j], rows[(i + 1) % seg][(j + 1) % ring], rows[i][(j + 1) % ring]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = finish(name, bm, [mat], smooth_angle=3.0, group=group, weighted=False)
    ob.location = B(c)
    ob.rotation_euler = (math.radians(90), 0, 0)
    return ob


def sphere(name, c, r, scale, mat, group=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r)
    for v in bm.verts:
        v.co.x *= scale[0]; v.co.y *= scale[2]; v.co.z *= scale[1]
    ob = finish(name, bm, [mat], smooth_angle=3.14, group=group, weighted=False)
    ob.location = B(c)
    return ob


def tube(name, pts, r, mat, group=None):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts):
        p.co = (*B(q), 1)
    ob = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(ob)
    ob.data.materials.append(MATS[mat])
    if group:
        add(group, ob)
    return ob


# ================================================================ forebody hull
L = 8.2
ZN = 4.95


def zu(u):
    return ZN - u * L


# u, bottom half-width, top half-width, bottom y, top y  (heights traced from the HD side elevation)
KEY = [
    (0.000, 0.06, 0.04, 0.00, 0.07),
    (0.012, 0.16, 0.10, -0.13, 0.17),
    (0.030, 0.26, 0.17, -0.27, 0.26),
    (0.060, 0.34, 0.22, -0.35, 0.33),
    (0.120, 0.40, 0.26, -0.37, 0.39),
    (0.200, 0.45, 0.29, -0.37, 0.47),
    (0.300, 0.50, 0.32, -0.37, 0.59),
    (0.400, 0.54, 0.34, -0.37, 0.69),
    (0.500, 0.57, 0.35, -0.37, 0.76),
    (0.600, 0.59, 0.36, -0.38, 0.84),
    (0.700, 0.60, 0.34, -0.38, 0.88),
    (0.800, 0.58, 0.32, -0.38, 0.86),
    (0.880, 0.52, 0.30, -0.36, 0.72),
    (0.905, 0.48, 0.28, -0.33, 0.62),
]


def cr(a, b, c, d, t):
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)


ST = []
for i in range(len(KEY) - 1):
    steps = 4 if i < 3 else 3
    for k in range(steps):
        t = k / steps
        a, b, c, d = KEY[max(i - 1, 0)], KEY[i], KEY[i + 1], KEY[min(i + 2, len(KEY) - 1)]
        ST.append(tuple(cr(a[m], b[m], c[m], d[m], t) for m in range(5)))
ST.append(KEY[-1])
U_END = KEY[-1][0]
# profile (12 points, counter-clockwise from bottom-left); canonical V boundaries shared with js/livery.js
# strips: bottom, lipR, lowerR, upperR, shoulderR, deckR, crown, deckL, shoulderL, upperL, lowerL, lipL
VB = [0.0, 0.30, 0.34, 0.42, 0.50, 0.56, 0.61, 0.69, 0.74, 0.80, 0.88, 0.96, 1.0]


def ring(u, wb, wt, yb, yt):
    z = zu(u)
    h = yt - yb
    lip = min(0.05, wb * 0.15)
    return [
        (-wb, yb, z), (wb, yb, z),
        (wb + lip, yb + h * 0.14, z),                     # lower lip
        (wb + lip * 0.6, yb + h * 0.42, z),               # side belt line
        (wt + (wb - wt) * 0.55, yb + h * 0.74, z),        # shoulder
        (wt, yt - h * 0.02, z),                           # deck edge
        (wt * 0.45, yt, z),                               # deck crown
        (-wt * 0.45, yt, z),
        (-wt, yt - h * 0.02, z),
        (-(wt + (wb - wt) * 0.55), yb + h * 0.74, z),
        (-(wb + lip * 0.6), yb + h * 0.42, z),
        (-(wb + lip), yb + h * 0.14, z),
    ]


def hull_at(u):
    for a, b in zip(KEY, KEY[1:]):
        if a[0] <= u <= b[0]:
            t = (u - a[0]) / (b[0] - a[0])
            return [lerp(x, y, t) for x, y in zip(a[1:], b[1:])]
    return list(KEY[-1][1:])


loft("hull", [ring(*s) for s in ST], lambda i, j: 0, ["fsr_livery", "fsr_teal", "fsr_carbon"],
     cap_front=1, cap_back=2, uv_of=lambda i, j: (ST[i][0] / U_END, 1.0 - VB[j]), group="hull", smooth=0.36, bevel=0.012)


def side_point(u, s, t=0.5):
    """Point on the upper side panel (between belt line and shoulder) at fraction t, plus outward normal."""
    wb, wt, yb, yt = hull_at(u)
    h = yt - yb
    lip = min(0.05, wb * 0.15)
    p0 = V3((wb + lip * 0.6, yb + h * 0.42))
    p1 = V3((wt + (wb - wt) * 0.55, yb + h * 0.74))
    c = p0.lerp(p1, t)
    d = (p1 - p0).normalized()
    n = V3((d.y, -d.x))
    if n.x < 0:
        n = -n
    return (s * c.x, c.y, zu(u)), (s * n.x, n.y, 0.0)


# long dark side slot and lower panel recess (as in the elevation)
for s in (1, -1):
    tag = "R" if s > 0 else "L"
    for (ua, ub, t, hgt, mat) in ((0.19, 0.33, 0.62, 0.07, "fsr_carbon"),):
        pa, na = side_point(ua, s, t)
        pb, nb = side_point(ub, s, t)
        c = lerp3(pa, pb, 0.5)
        n = V3(na).normalized()
        ax = n
        az = V3(pa) - V3(pb)
        az.normalize()
        ay = az.cross(ax).normalized()
        box(f"slot_{tag}_{ua}", (c[0] - n.x * 0.004, c[1], c[2]), (0.02, hgt, (V3(pa) - V3(pb)).length), mat, basis=(ax, ay, az), bevel=0.0, group="hull")
    # boarding ladder panel (dark recess with rungs, below the canopy)
    pa, na = side_point(0.50, s, 0.3)
    n = V3(na).normalized()
    up = V3((0, 1, 0))
    box(f"ladder_{tag}", (pa[0] + n.x * 0.002, pa[1] + 0.05, pa[2]), (0.012, 0.32, 0.12), "fsr_carbon", basis=(n, up, V3((0, 0, 1))), bevel=0.0, group="hull")
    for k in range(5):
        box(f"rung_{tag}_{k}", (pa[0] + n.x * 0.012, pa[1] - 0.08 + k * 0.065, pa[2]), (0.014, 0.014, 0.1), "fsr_metal", basis=(n, up, V3((0, 0, 1))), bevel=0.0, group="hull")
    # nose chin intake
box("nose_intake", (0, 0.02, zu(0.035)), (0.22, 0.05, 0.12), "fsr_carbon", rot=(math.radians(-35), 0, 0), bevel=0.0, group="hull")

# ================================================================ canopy + head fairing
def canopy_ring(u, w_base, y_base, w_top, y_top):
    z = zu(u)
    return [(w_base, y_base, z), (w_top, y_top, z), (-w_top, y_top, z), (-w_base, y_base, z)]


CAN = [  # u, base half-width, base y, top half-width, top y
    (0.405, 0.32, 0.685, 0.30, 0.70),
    (0.44, 0.33, 0.715, 0.25, 0.87),
    (0.49, 0.34, 0.75, 0.23, 0.97),
    (0.55, 0.35, 0.795, 0.23, 1.02),
    (0.605, 0.355, 0.845, 0.24, 1.04),
]
loft("canopy_glass", [canopy_ring(*c) for c in CAN], lambda i, j: 0, ["fsr_glass"], group="canopy_glass", smooth=0.35)
for k, c in enumerate(CAN[1:], 1):
    z = zu(c[0])
    tube(f"canopy_hoop_{k}", [(c[1] + 0.01, c[2], z), (c[3] + 0.01, c[4] + 0.01, z), (-c[3] - 0.01, c[4] + 0.01, z), (-c[1] - 0.01, c[2], z)], 0.011, "fsr_carbon", group="canopy_frame")
for sx in (1, -1):
    tube(f"canopy_rail_top_{sx}", [(sx * (c[3] + 0.012), c[4] + 0.012, zu(c[0])) for c in CAN], 0.016, "fsr_carbon", group="canopy_frame")
    tube(f"canopy_rail_base_{sx}", [(sx * (c[1] + 0.015), c[2] + 0.01, zu(c[0])) for c in CAN], 0.022, "fsr_dark", group="canopy_frame")
tube("canopy_spine", [(0, c[4] + 0.014, zu(c[0])) for c in CAN[1:]], 0.012, "fsr_carbon", group="canopy_frame")

# head fairing behind the canopy (white hump with the antenna)
loft("fairing", [
    [(0.33, 0.84, zu(0.60)), (0.22, 1.04, zu(0.60)), (-0.22, 1.04, zu(0.60)), (-0.33, 0.84, zu(0.60))],
    [(0.30, 0.87, zu(0.64)), (0.2, 1.08, zu(0.64)), (-0.2, 1.08, zu(0.64)), (-0.30, 0.87, zu(0.64))],
    [(0.27, 0.88, zu(0.70)), (0.16, 1.02, zu(0.70)), (-0.16, 1.02, zu(0.70)), (-0.27, 0.88, zu(0.70))],
    [(0.24, 0.87, zu(0.74)), (0.1, 0.93, zu(0.74)), (-0.1, 0.93, zu(0.74)), (-0.24, 0.87, zu(0.74))],
], lambda i, j: 1 if j == 1 else 0, ["fsr_white", "fsr_teal"], cap_front=0, cap_back=0, group="fairing", bevel=0.01)
cylinder("antenna", (0.06, 1.24, zu(0.67)), 0.012, 0.32, "fsr_metal", r2=0.004, verts=8, axis="y", group="antenna")
sphere("antenna_tip", (0.06, 1.4, zu(0.67)), 0.016, (1, 1, 1), "fsr_light_red", group="antenna")
sphere("sensor", (0, 1.07, zu(0.625)), 0.05, (1, 0.6, 1.2), "fsr_visor", group="fairing")

# interior
box("dash", (0, 0.76, zu(0.445)), (0.42, 0.08, 0.26), "fsr_carbon", rot=(math.radians(18), 0, 0), group="cockpit")
for x in (-0.1, 0.1):
    box(f"screen_{x}", (x, 0.8, zu(0.452)), (0.14, 0.07, 0.008), "fsr_screen", rot=(math.radians(-55), 0, 0), bevel=0.0, group="cockpit")
box("seat", (0, 0.86, zu(0.565)), (0.34, 0.34, 0.06), "fsr_carbon", rot=(math.radians(-16), 0, 0), group="cockpit")
sphere("pilot_torso", (0, 0.82, zu(0.545)), 0.14, (1.25, 1.1, 0.85), "fsr_suit", group="cockpit")
sphere("pilot_helmet", (0, 0.97, zu(0.535)), 0.11, (1.0, 1.12, 1.05), "fsr_helmet", group="cockpit")
sphere("pilot_visor", (0, 0.975, zu(0.523)), 0.078, (1.25, 0.5, 0.55), "fsr_visor", group="cockpit")
for sx in (1, -1):
    tube(f"arm_{sx}", [(sx * 0.15, 0.86, zu(0.54)), (sx * 0.16, 0.8, zu(0.5)), (sx * 0.09, 0.79, zu(0.465))], 0.032, "fsr_suit", group="cockpit")

# ================================================================ delta wings
# span parameter s: 0 at the root (on top of the rear hull) -> 1 at the rounded tip
NS, NQ = 26, 20


def wing_frame(s):
    """Leading / trailing edge points of the right wing at span fraction s (traced from the side elevation:
    root along the top of the rear hull, tip edge low along u .58-.93, rearmost point ~60 % span)."""
    x = 0.28 + 2.0 * s
    y = 0.97 - 1.62 * s - 0.1 * math.sin(math.pi * s)
    le_u = 0.56 + 0.12 * s
    te_u = 0.80 + 0.20 * (s / 0.6) ** 0.7 if s <= 0.6 else 1.0 - 0.07 * ((s - 0.6) / 0.4) ** 2
    le = V3((x, y + 0.03, zu(le_u)))
    te = V3((x - 0.08 * s, y - 0.05 * s, zu(te_u)))
    if s > 0.74:  # rounded tip
        f = math.sqrt(max(0.0, 1 - ((s - 0.74) / 0.26) ** 2))
        mid = le.lerp(te, 0.55)
        k = 0.4 + 0.6 * f
        le = mid + (le - mid) * k
        te = mid + (te - mid) * k
    return le, te


def wing_surface(s, q, side, sgn=1):
    """Point on the right wing (sgn flips to the left one). side=+1 top, -1 bottom."""
    le, te = wing_frame(s)
    le2, te2 = wing_frame(min(1, s + 0.02))
    chord = te - le
    span = (le2.lerp(te2, 0.5) - le.lerp(te, 0.5))
    if span.length < 1e-6:
        span = V3((1, -0.4, 0))
    n = span.cross(chord).normalized()
    if n.y < 0:
        n = -n
    t = 0.34 * (1 - s) ** 1.2 + 0.12
    th = t * 1.25 * math.sqrt(max(q, 0)) * (1 - q) ** 0.7
    p = le + chord * q + n * (side * th * (0.55 if side > 0 else 0.45))
    return V3((p.x * sgn, p.y, p.z)), V3((n.x * sgn, n.y, n.z))


Q = [0.5 - 0.5 * math.cos(math.pi * i / (NQ - 1)) for i in range(NQ)]
SS = [i / (NS - 1) for i in range(NS)]
for sgn in (1, -1):
    tag = "R" if sgn > 0 else "L"
    rings = []
    for s in SS:
        top = [wing_surface(s, q, 1, sgn)[0] for q in Q]
        bot = [wing_surface(s, q, -1, sgn)[0] for q in Q[::-1][1:-1]]
        rings.append([tuple(p) for p in top + bot])
    nq = len(rings[0])

    def uv(i, j, nq=nq):
        jj = j % nq
        qq = Q[jj] if jj < NQ else Q[::-1][1:-1][jj - NQ]
        top = jj < NQ
        return ((qq * 0.5) if top else (1 - qq * 0.5), 1.0 - SS[i])

    loft(f"wing_{tag}", rings, lambda i, j: 0, ["fsr_wing", "fsr_teal"], cap_front=1, cap_back=1, uv_of=uv, group=f"wing_{tag}", smooth=0.9)

    # leading-edge armour strip
    tube(f"wing_le_{tag}", [tuple(wing_surface(s0, 0.004, 1, sgn)[0]) for s0 in [0.04 + k * 0.045 for k in range(20)]], 0.022, "fsr_gunmetal", group=f"wing_{tag}")
    # root fillet: closes the gap between the wing underside and the hull flank
    fil = []
    for q in (0.02, 0.2, 0.4, 0.6, 0.8, 0.98):
        p_root, _ = wing_surface(0.0, q, -1, sgn)
        z = p_root.z
        u = (ZN - z) / L
        wb, wt, yb, yt = hull_at(min(u, U_END))
        fil.append([tuple(p_root), (sgn * (wt + (wb - wt) * 0.55), yb + (yt - yb) * 0.74, z), (sgn * (wb + 0.02), yb + (yt - yb) * 0.42, z)])
    loft(f"wing_fillet_{tag}", fil, lambda i, j: 0, ["fsr_teal"], closed=False, group=f"wing_{tag}", smooth=0.8)

    # cooling grille: recessed dark panel with slats on the inner wing (top view)
    for s0 in (0.1,):
        p_a, n_a = wing_surface(s0, 0.28, 1, sgn)
        p_b, _ = wing_surface(s0 + 0.24, 0.28, 1, sgn)
        p_c, _ = wing_surface(s0, 0.72, 1, sgn)
        ax = (p_c - p_a).normalized()
        az = (p_b - p_a).normalized()
        ay = n_a
        centre = (p_a + p_b + p_c + (p_b + p_c - p_a)) / 4 + n_a * 0.005
        w = (p_c - p_a).length
        h = (p_b - p_a).length
        box(f"grille_well_{tag}", tuple(centre), (w, 0.012, h), "fsr_carbon", basis=(ax, ay, az), bevel=0.0, group=f"grille_{tag}")
        for k in range(15):
            t = (k + 0.5) / 15
            pc = p_a + (p_c - p_a) * t + (p_b - p_a) * 0.5 + n_a * 0.016
            box(f"grille_slat_{tag}_{k}", tuple(pc), (0.012, 0.03, h * 0.92), "fsr_gunmetal", basis=(ax, ay, az), bevel=0.0, group=f"grille_{tag}")
        # surround frame
        for d, (cx, cz, sx, sz) in enumerate(((0, -0.5, 1.04, 0.04), (0, 0.5, 1.04, 0.04), (-0.5, 0, 0.04, 1.0), (0.5, 0, 0.04, 1.0))):
            q = centre + ax * (cx * w) + az * (cz * h) + n_a * 0.012
            box(f"grille_rim_{tag}_{d}", tuple(q), (max(sx * w, 0.03), 0.02, max(sz * h, 0.03)), "fsr_gunmetal", basis=(ax, ay, az), bevel=0.004, group=f"grille_{tag}")

    # trailing-edge thrusters (dark blocks with glowing nozzles, seen in the top elevation)
    for k, s0 in enumerate((0.3, 0.42)):
        p, n = wing_surface(s0, 0.93, -1, sgn)
        le, te = wing_frame(s0)
        fwd = (le - te).normalized()
        fwd = V3((fwd.x * sgn, fwd.y, fwd.z))
        side = n.cross(fwd).normalized()
        c = p - n * 0.05
        box(f"thruster_{tag}{k}", tuple(c), (0.16, 0.12, 0.34), "fsr_carbon", basis=(side, n, fwd), group=f"thrusters_{tag}", bevel=0.012)
        e = c - fwd * 0.175
        box(f"thruster_glow_{tag}{k}", tuple(e), (0.11, 0.07, 0.01), "fsr_engine", basis=(side, n, fwd), group=f"thrusters_{tag}", bevel=0.0)

    # airbrake flap at the trailing edge, hinged along its leading edge
    sa, sb, qh = 0.56, 0.8, 0.8
    ha, n1 = wing_surface(sa, qh, 1, sgn)
    hb, n2 = wing_surface(sb, qh, 1, sgn)
    ta, _ = wing_surface(sa, 0.99, 1, sgn)
    tb, _ = wing_surface(sb, 0.99, 1, sgn)
    hinge = (ha + hb) / 2
    ax = (hb - ha).normalized()
    ay = ((n1 + n2) / 2).normalized()
    az = ax.cross(ay).normalized()
    if az.dot(ta - ha) > 0:
        az = -az
    basis = mu.Matrix((B(ax).normalized(), -B(az).normalized(), B(ay).normalized())).transposed()
    inv = basis.inverted()
    bm = bmesh.new()
    pts = [ha, hb, tb, ta]
    top = [bm.verts.new(inv @ (B(p + ay * 0.012) - B(hinge))) for p in pts]
    bot = [bm.verts.new(inv @ (B(p - ay * 0.012) - B(hinge))) for p in pts]
    bm.faces.new(top); bm.faces.new(bot[::-1])
    for i in range(4):
        j = (i + 1) % 4
        f = bm.faces.new((top[i], bot[i], bot[j], top[j])); f.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    flap = finish(f"airbrake_{tag}", bm, ["fsr_yellow", "fsr_dark"], group=f"airbrake_{tag}", bevel=0.006)
    flap.matrix_world = mu.Matrix.Translation(B(hinge)) @ basis.to_4x4()

    # wingtip skid + nav light
    p, n = wing_surface(0.97, 0.55, -1, sgn)
    box(f"tip_skid_{tag}", tuple(p - n * 0.02), (0.06, 0.04, 0.5), "fsr_gunmetal", group=f"wing_{tag}")
    p, n = wing_surface(0.995, 0.5, 1, sgn)
    sphere(f"nav_{tag}", tuple(p + V3((sgn * 0.03, 0, 0))), 0.03, (1, 1, 1), "fsr_light_green" if sgn > 0 else "fsr_light_red", group=f"wing_{tag}")

# ================================================================ turbine stack in the central channel
g = "turbines"
box("channel_floor", (0, 0.84, zu(0.81)), (0.5, 0.05, zu(0.73) - zu(0.9)), "fsr_carbon", group=g)
for sx in (1, -1):
    z0, z1 = zu(0.735), zu(0.86)
    cylinder(f"turbine_{sx}", (sx * 0.13, 0.92, (z0 + z1) / 2), 0.1, z0 - z1, "fsr_steel", group=g, bevel=0.004)
    for k in range(7):
        torus(f"turbine_rib_{sx}_{k}", (sx * 0.13, 0.92, z0 - 0.08 - k * (z0 - z1 - 0.16) / 6), 0.103, 0.012, "fsr_gunmetal", group=g)
    cylinder(f"turbine_cap_{sx}", (sx * 0.13, 0.92, z0 + 0.02), 0.07, 0.04, "fsr_metal", r2=0.06, group=g)
box("turbine_spine", (0, 0.99, zu(0.8)), (0.05, 0.04, zu(0.735) - zu(0.86)), "fsr_dark", group=g)
# rear grille block
box("rear_grille", (0, 0.86, zu(0.9)), (0.44, 0.26, 0.08), "fsr_dark", group=g)
for k in range(6):
    box(f"rear_grille_slat_{k}", (0, 0.76 + k * 0.04, zu(0.9) - 0.045), (0.46, 0.012, 0.03), "fsr_metal", bevel=0.0, group=g)
for sx in (1, -1):
    tube(f"feed_pipe_{sx}", [(sx * 0.13, 0.84, zu(0.86)), (sx * 0.2, 0.55, zu(0.905)), (sx * 0.24, 0.3, zu(0.91))], 0.035, "fsr_metal", group=g)

# ================================================================ twin exhausts
g = "engines"
zr = zu(U_END)
box("engine_mount", (0, 0.08, zr - 0.05), (0.86, 0.46, 0.12), "fsr_carbon", group=g)
for sx in (1, -1):
    c = (sx * 0.24, 0.08, zr - 0.2)
    cylinder(f"exhaust_{sx}", c, 0.19, 0.34, "fsr_steel", r2=0.17, group=g, bevel=0.004, cap=False)
    torus(f"exhaust_lip_{sx}", (c[0], c[1], zr - 0.37), 0.172, 0.018, "fsr_metal", group=g)
    torus(f"exhaust_band_{sx}", (c[0], c[1], zr - 0.1), 0.193, 0.016, "fsr_yellow", group=g)
    cylinder(f"exhaust_cone_{sx}", (c[0], c[1], zr - 0.28), 0.1, 0.16, "fsr_gunmetal", r2=0.03, group=g)
    cylinder(f"exhaust_core_{sx}", (c[0], c[1], zr - 0.2), 0.165, 0.01, "fsr_engine", group=g)
    for k in range(12):
        a = k / 12 * TAU
        box(f"exhaust_blade_{sx}_{k}", (c[0] + math.cos(a) * 0.12, c[1] + math.sin(a) * 0.12, zr - 0.21), (0.09, 0.008, 0.02), "fsr_gunmetal", rot=(0, 0.3, a), bevel=0.0, group=g)
for sx in (1, -1):
    box(f"tail_light_{sx}", (sx * 0.4, 0.28, zr - 0.12), (0.08, 0.02, 0.01), "fsr_light_white", bevel=0.0, group=g)

# ================================================================ AG emitters
for s in (1, -1):
    tag = "R" if s > 0 else "L"
    for k, u in enumerate((0.15, 0.3, 0.45, 0.6, 0.75)):
        wb, wt, yb, yt = hull_at(u)
        box(f"ag_frame_{tag}{k}", (s * (wb * 0.55), yb - 0.012, zu(u)), (wb * 0.6, 0.02, 0.7), "fsr_carbon", bevel=0.004, group=f"ag_{tag}")
        box(f"ag_pad_{tag}{k}", (s * (wb * 0.55), yb - 0.024, zu(u)), (wb * 0.45, 0.008, 0.6), "fsr_field", bevel=0.0, group=f"ag_{tag}")

# ================================================================ assemble
def uv_project(ob):
    bpy.context.view_layer.objects.active = ob
    for o in scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


KEEP_UV = {"hull", "wing_R", "wing_L"}
for name, objs in PARTS.items():
    for o in scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target="MESH")
    for o in scene.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    if name not in KEEP_UV and not name.startswith("airbrake"):
        uv_project(ob)
    if not name.startswith("airbrake"):
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
for o in scene.objects:
    o.select_set(False)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True, use_selection=False)
print("EXPORTED", OUT, os.path.getsize(OUT), "objects:", len(scene.objects))
