"""
FEISAR — classic-style anti-gravity craft for Blender (v5, hard-surface).

Inspired by the classic FEISAR silhouette (long faceted wedge nose with a deck groove,
angular canopy, rear engine block, yellow side pods, swept low wings and canted upper fins).
Modelled from scratch in code; reference: vamsdal's "FEISAR" on Sketchfab (viewed only).
tools/build_feisar_hd.py keeps the Wipeout HD FX350 recreation (v4).

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
material("fsr_cheek", "#ffffff", rough=0.3, coat=1.0)
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



# ================================================================ extra materials for the classic craft
material("fsr_fin", "#ffffff", rough=0.3, coat=1.0)
material("fsr_hazard", "#ffffff", rough=0.35, coat=0.6)


def slab(name, pts, thick, mats, normal_hint=(0, 1, 0), bevel=0.008, uv=None, origin=None, group=None):
    """Planar polygon extruded along its normal. mats = [faces, sides]. uv: per-point UVs for the big faces."""
    P = [B(p) for p in pts]
    nrm = (P[1] - P[0]).cross(P[2] - P[0]).normalized()
    if nrm.dot(B(normal_hint)) < 0:
        nrm = -nrm
    o = B(origin) if origin else V3((0, 0, 0))
    half = nrm * thick / 2
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    top = [bm.verts.new(p + half - o) for p in P]
    bot = [bm.verts.new(p - half - o) for p in P]
    ft = bm.faces.new(top); ft.material_index = 0
    fb = bm.faces.new(bot[::-1]); fb.material_index = 0
    if uv:
        for loop, t in zip(ft.loops, uv):
            loop[uvl].uv = (t[0], 1 - t[1])
        for loop, t in zip(fb.loops, uv[::-1]):
            loop[uvl].uv = (t[0], 1 - t[1])
    n = len(P)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((top[i], bot[i], bot[j], top[j])); f.material_index = 1 if len(mats) > 1 else 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = finish(name, bm, mats, bevel=bevel, group=group, smooth_angle=0.3)
    ob.location = o
    return ob


# ================================================================ hull (faceted wedge)
L = 8.2
ZN = 4.95


def zu(u):
    return ZN - u * L


# u, bottom half-width, deck half-width, bottom y, deck y, groove depth
KEY = [
    (0.000, 0.05, 0.03, -0.06, 0.02, 0.0),
    (0.025, 0.17, 0.10, -0.26, 0.09, 0.02),
    (0.060, 0.22, 0.14, -0.35, 0.14, 0.05),
    (0.200, 0.30, 0.19, -0.36, 0.27, 0.06),
    (0.350, 0.36, 0.23, -0.36, 0.41, 0.06),
    (0.450, 0.41, 0.26, -0.36, 0.50, 0.04),
    (0.500, 0.44, 0.28, -0.36, 0.54, 0.0),
    (0.650, 0.48, 0.31, -0.36, 0.60, 0.0),
    (0.800, 0.50, 0.32, -0.36, 0.62, 0.0),
    (0.920, 0.49, 0.31, -0.35, 0.60, 0.0),
    (1.000, 0.45, 0.29, -0.31, 0.54, 0.0),
]
ST = []
for a, b in zip(KEY, KEY[1:]):
    n = max(2, int((b[0] - a[0]) / 0.04))
    for k in range(n):
        t = k / n
        ST.append(tuple(lerp(x, y, t) for x, y in zip(a, b)))
ST.append(KEY[-1])

# 14-point faceted profile; canonical V boundaries shared with js/livery.js
STRIP_W = [0.20, 0.05, 0.10, 0.06, 0.04, 0.05, 0.02, 0.03, 0.02, 0.05, 0.04, 0.06, 0.10, 0.05]
_tot = sum(STRIP_W)
VB = [0.0]
for w in STRIP_W:
    VB.append(VB[-1] + w / _tot)
print("VB", [round(v, 4) for v in VB])


def ring(u, wb, wt, yb, yt, gd):
    z = zu(u)
    h = yt - yb
    c1 = min(0.05, wb * 0.15)
    g = min(0.07, wt * 0.35)
    gd = min(gd, h * 0.2)
    return [
        (-wb, yb, z), (wb, yb, z),
        (wb + c1, yb + h * 0.22, z), (wb + c1, yb + h * 0.62, z),
        (wt + (wb + c1 - wt) * 0.35, yt - h * 0.08, z), (wt, yt, z),
        (g, yt, z), (g * 0.6, yt - gd, z), (-g * 0.6, yt - gd, z), (-g, yt, z),
        (-wt, yt, z), (-(wt + (wb + c1 - wt) * 0.35), yt - h * 0.08, z),
        (-(wb + c1), yb + h * 0.62, z), (-(wb + c1), yb + h * 0.22, z),
    ]


def hull_at(u):
    for a, b in zip(KEY, KEY[1:]):
        if a[0] <= u <= b[0]:
            t = (u - a[0]) / (b[0] - a[0])
            return [lerp(x, y, t) for x, y in zip(a[1:], b[1:])]
    return list(KEY[-1][1:])


loft("hull", [ring(*s) for s in ST], lambda i, j: 0, ["fsr_livery", "fsr_teal", "fsr_carbon"],
     cap_front=1, cap_back=2, uv_of=lambda i, j: (ST[i][0], 1.0 - VB[j]), group="hull", smooth=0.2, bevel=0.012)


def side_frame(u, s, t=0.5):
    wb, wt, yb, yt, gd = hull_at(u)
    h = yt - yb
    c1 = min(0.05, wb * 0.15)
    return (s * (wb + c1), yb + h * (0.22 + 0.4 * t), zu(u)), V3((s, 0, 0))


# side detail: long intake slot, vents, ladder
for s in (1, -1):
    tag = "R" if s > 0 else "L"
    pa, n = side_frame(0.12, s, 0.75)
    pb, _ = side_frame(0.36, s, 0.75)
    c = lerp3(pa, pb, 0.5)
    box(f"slot_{tag}", (c[0] + s * 0.002, c[1], c[2]), (0.02, 0.07, abs(pa[2] - pb[2])), "fsr_carbon", bevel=0.0, group="hull")
    for k in range(6):
        p, _ = side_frame(0.56 + k * 0.012, s, 0.35)
        box(f"side_vent_{tag}_{k}", (p[0] + s * 0.004, p[1], p[2]), (0.02, 0.16, 0.04), "fsr_carbon", bevel=0.0, group="hull")
    for k in range(4):
        p, _ = side_frame(0.475, s, 0.15 + k * 0.2)
        box(f"rung_{tag}_{k}", (p[0] + s * 0.012, p[1], p[2]), (0.018, 0.016, 0.1), "fsr_metal", bevel=0.0, group="hull")
box("nose_sensor", (0, -0.03, zu(0.004)), (0.06, 0.03, 0.01), "fsr_screen", bevel=0.0, group="hull")
# groove inserts: dark channel along the nose deck with a slim light strip
for k, (u0, u1) in enumerate(((0.06, 0.2), (0.2, 0.35), (0.35, 0.44))):
    wb, wt, yb, yt, gd = hull_at((u0 + u1) / 2)
    box(f"groove_strip_{k}", (0, yt - gd + 0.006, zu((u0 + u1) / 2)), (0.03, 0.006, (u1 - u0) * L * 0.9), "fsr_field", bevel=0.0, group="hull")

# ================================================================ canopy
CAN = [  # u, base half-width, base y, top half-width, top y
    (0.47, 0.27, 0.515, 0.25, 0.53),
    (0.52, 0.28, 0.555, 0.17, 0.82),
    (0.58, 0.29, 0.575, 0.18, 0.92),
    (0.66, 0.30, 0.6, 0.19, 0.93),
    (0.715, 0.305, 0.61, 0.2, 0.86),
]


def can_ring(u, wbs, yb, wts, yt):
    z = zu(u)
    return [(wbs, yb, z), (wts + (wbs - wts) * 0.45, yb + (yt - yb) * 0.75, z), (wts, yt, z), (-wts, yt, z), (-(wts + (wbs - wts) * 0.45), yb + (yt - yb) * 0.75, z), (-wbs, yb, z)]


loft("canopy_glass", [can_ring(*c) for c in CAN], lambda i, j: 0, ["fsr_glass"], group="canopy_glass", smooth=0.2, closed=False)
fr = []
for c in CAN:
    fr.append(can_ring(*c))
for k, r in enumerate(fr[1:], 1):
    tube(f"hoop_{k}", [(p[0] * 1.03, p[1] + 0.01, p[2]) for p in r], 0.012, "fsr_carbon", group="canopy_frame")
for j in range(6):
    tube(f"rail_{j}", [(r[j][0] * 1.03, r[j][1] + 0.01, r[j][2]) for r in fr], 0.012 if j not in (0, 5) else 0.02, "fsr_carbon", group="canopy_frame")

# interior
box("dash", (0, 0.58, zu(0.51)), (0.36, 0.07, 0.22), "fsr_carbon", rot=(math.radians(15), 0, 0), group="cockpit")
for x in (-0.09, 0.09):
    box(f"screen_{x}", (x, 0.62, zu(0.516)), (0.12, 0.06, 0.008), "fsr_screen", rot=(math.radians(-55), 0, 0), bevel=0.0, group="cockpit")
box("seat", (0, 0.72, zu(0.645)), (0.3, 0.32, 0.06), "fsr_carbon", rot=(math.radians(-18), 0, 0), group="cockpit")
sphere("pilot_torso", (0, 0.68, zu(0.625)), 0.13, (1.25, 1.1, 0.85), "fsr_suit", group="cockpit")
sphere("pilot_helmet", (0, 0.82, zu(0.615)), 0.1, (1.0, 1.12, 1.05), "fsr_helmet", group="cockpit")
sphere("pilot_visor", (0, 0.825, zu(0.604)), 0.07, (1.25, 0.5, 0.55), "fsr_visor", group="cockpit")

# ================================================================ rear engine block
g = "engine"
zr = zu(1.0)
loft("engine_block", [
    [(0.24, 0.6, zu(0.72)), (0.2, 0.8, zu(0.72)), (-0.2, 0.8, zu(0.72)), (-0.24, 0.6, zu(0.72))],
    [(0.26, 0.6, zu(0.76)), (0.22, 0.86, zu(0.76)), (-0.22, 0.86, zu(0.76)), (-0.26, 0.6, zu(0.76))],
    [(0.26, 0.58, zu(0.96)), (0.22, 0.84, zu(0.96)), (-0.22, 0.84, zu(0.96)), (-0.26, 0.58, zu(0.96))],
    [(0.24, 0.52, zu(1.0)), (0.2, 0.74, zu(1.0)), (-0.2, 0.74, zu(1.0)), (-0.24, 0.52, zu(1.0))],
], lambda i, j: 0, ["fsr_carbon"], cap_front=0, cap_back=0, group=g, bevel=0.01, smooth=0.3)
# warning plate (hazard texture) on the slanted rear-top of the block
slab("warning_plate", [(0.15, 0.865, zu(0.80)), (0.15, 0.85, zu(0.93)), (-0.15, 0.85, zu(0.93)), (-0.15, 0.865, zu(0.80))], 0.012,
     ["fsr_hazard", "fsr_dark"], uv=[(0.5, 0), (0.5, 1), (0, 1), (0, 0)], group=g)
for k in range(5):
    box(f"block_rib_{k}", (0, 0.87, zu(0.735) - k * 0.03), (0.4, 0.012, 0.012), "fsr_gunmetal", bevel=0.0, group=g)
for sx in (1, -1):
    cylinder(f"block_pipe_{sx}", (sx * 0.25, 0.74, zu(0.86)), 0.04, (zu(0.74) - zu(0.98)), "fsr_metal", group=g)

# yellow grilles behind the canopy
for sx in (1, -1):
    tag = "R" if sx > 0 else "L"
    box(f"grille_frame_{tag}", (sx * 0.33, 0.64, zu(0.745)), (0.16, 0.06, 0.36), "fsr_yellow", group=f"grille_{tag}", bevel=0.008)
    for k in range(8):
        box(f"grille_slat_{tag}_{k}", (sx * 0.33, 0.675, zu(0.73) - k * 0.035 + 0.06), (0.13, 0.02, 0.012), "fsr_dark", bevel=0.0, group=f"grille_{tag}")

# ================================================================ side pods
for sx in (1, -1):
    tag = "R" if sx > 0 else "L"
    g = f"pod_{tag}"
    rings = []
    for u, xo, xi, yt_, yb_ in ((0.6, 0.5, 0.48, 0.1, 0.0), (0.66, 0.66, 0.48, 0.42, -0.12), (0.9, 0.68, 0.48, 0.44, -0.14), (0.99, 0.64, 0.46, 0.38, -0.1)):
        z = zu(u)
        rings.append([(sx * xi, yt_, z), (sx * (xo - 0.05), yt_, z), (sx * xo, yt_ - 0.08, z), (sx * xo, yb_ + 0.06, z), (sx * (xo - 0.06), yb_, z), (sx * xi, yb_, z)])
    loft(f"pod_shell_{tag}", rings, lambda i, j: 0, ["fsr_yellow"], cap_front=0, cap_back=0, group=g, bevel=0.01, smooth=0.3)
    # emblem plate + intake
    p = (sx * 0.682, 0.16, zu(0.8))
    slab(f"pod_plate_{tag}", [(sx * 0.683, 0.32, zu(0.72)), (sx * 0.683, 0.32, zu(0.88)), (sx * 0.683, 0.0, zu(0.88)), (sx * 0.683, 0.0, zu(0.72))], 0.01,
         ["fsr_fin", "fsr_dark"], normal_hint=(sx, 0, 0), uv=[(0.5, 0.0), (1.0, 0.0), (1.0, 0.5), (0.5, 0.5)], group=g)
    box(f"pod_intake_{tag}", (sx * 0.57, 0.15, zu(0.655)), (0.16, 0.3, 0.04), "fsr_carbon", group=g, bevel=0.006)
    box(f"pod_nozzle_{tag}", (sx * 0.57, 0.15, zu(1.0) - 0.03), (0.17, 0.28, 0.08), "fsr_gunmetal", group=g, bevel=0.006)
    box(f"pod_glow_{tag}", (sx * 0.57, 0.15, zu(1.0) - 0.075), (0.13, 0.22, 0.01), "fsr_engine", group=g, bevel=0.0)

# ================================================================ main exhaust
g = "exhausts"
box("exhaust_frame", (0, 0.12, zr - 0.04), (0.5, 0.44, 0.1), "fsr_carbon", group=g, bevel=0.01)
box("exhaust_bezel", (0, 0.12, zr - 0.07), (0.46, 0.4, 0.04), "fsr_metal", group=g, bevel=0.008)
for k in range(4):
    box(f"exhaust_heat_rib_{k}", (0, 0.36 + k * 0.035, zr - 0.02), (0.44, 0.012, 0.06), "fsr_gunmetal", group=g, bevel=0.0)
for sx in (1, -1):
    for sy in (1, -1):
        cylinder(f"rcs_{sx}_{sy}", (sx * 0.2, 0.12 + sy * 0.16, zr - 0.09), 0.02, 0.05, "fsr_metal", r2=0.03, verts=12, group=g)
    box(f"rear_vent_{sx}", (sx * 0.32, 0.3, zr - 0.01), (0.08, 0.3, 0.02), "fsr_dark", group=g, bevel=0.0)
    for k in range(5):
        box(f"rear_vent_slat_{sx}_{k}", (sx * 0.32, 0.18 + k * 0.06, zr - 0.025), (0.08, 0.012, 0.012), "fsr_metal", group=g, bevel=0.0)
box("exhaust_core", (0, 0.12, zr - 0.095), (0.42, 0.36, 0.01), "fsr_engine", group=g, bevel=0.0)
for k, x in enumerate((-0.14, 0, 0.14)):
    box(f"exhaust_vane_{k}", (x, 0.12, zr - 0.1), (0.018, 0.36, 0.03), "fsr_dark", group=g, bevel=0.0)
for sx in (1, -1):
    box(f"tail_light_{sx}", (sx * 0.2, 0.66, zr - 0.01), (0.08, 0.02, 0.01), "fsr_light_red", group=g, bevel=0.0)

# ================================================================ wings (swept, low on the pods)
def wing_pts(sx):
    return [(sx * 0.66, -0.02, zu(0.64)), (sx * 1.42, -0.1, zu(0.88)), (sx * 1.45, -0.1, zu(0.99)), (sx * 1.2, -0.09, zu(1.04)), (sx * 0.66, -0.02, zu(0.99))]


for sx in (1, -1):
    tag = "R" if sx > 0 else "L"
    pts = wing_pts(sx)
    uv = [(0.0, 0.0), (1.0, 0.0), (1.0, 0.3), (0.82, 0.55), (0.0, 0.55)]
    slab(f"wing_{tag}", pts, 0.07, ["fsr_wing", "fsr_dark"], normal_hint=(0, 1, 0), uv=uv, group=f"wing_{tag}", bevel=0.012)
    sphere(f"nav_{tag}", (sx * 1.46, -0.1, zu(0.94)), 0.03, (1, 1, 1), "fsr_light_green" if sx > 0 else "fsr_light_red", group=f"wing_{tag}")
    # airbrake flap at the inner trailing edge, hinged along its front edge
    hinge = (sx * 0.95, -0.04, zu(0.955))
    slab(f"airbrake_{tag}", [(sx * 0.72, -0.03, zu(0.955)), (sx * 1.15, -0.06, zu(0.955)), (sx * 1.15, -0.06, zu(1.025)), (sx * 0.72, -0.03, zu(1.025))], 0.04,
         ["fsr_yellow", "fsr_dark"], origin=hinge, group=f"airbrake_{tag}", bevel=0.006)

# upper stabiliser fins (canted outward, hazard tips)
for sx in (1, -1):
    tag = "R" if sx > 0 else "L"
    pts = [(sx * 0.28, 0.84, zu(0.82)), (sx * 0.44, 1.12, zu(0.95)), (sx * 0.46, 1.12, zu(1.02)), (sx * 0.28, 0.8, zu(1.0))]
    slab(f"fin_{tag}", pts, 0.05, ["fsr_fin", "fsr_dark"], normal_hint=(sx, -0.3, 0), uv=[(0.0, 0.55), (0.5, 0.55), (0.5, 1.0), (0.0, 1.0)], group=f"fin_{tag}")

# ================================================================ underside: AG keel channel + strakes
box("keel_channel", (0, -0.37, zu(0.3)), (0.36, 0.02, 0.4 * L), "fsr_carbon", group="keel", bevel=0.004)
loft("keel_pod", [
    [(0.0, -0.38, zu(0.1)), (0.0, -0.38, zu(0.1)), (0.0, -0.38, zu(0.1)), (0.0, -0.38, zu(0.1))],
    [(0.1, -0.38, zu(0.16)), (0.1, -0.46, zu(0.16)), (-0.1, -0.46, zu(0.16)), (-0.1, -0.38, zu(0.16))],
    [(0.12, -0.38, zu(0.45)), (0.12, -0.48, zu(0.45)), (-0.12, -0.48, zu(0.45)), (-0.12, -0.38, zu(0.45))],
    [(0.0, -0.38, zu(0.52)), (0.0, -0.38, zu(0.52)), (0.0, -0.38, zu(0.52)), (0.0, -0.38, zu(0.52))],
], lambda i, j: 0, ["fsr_yellow"], group="keel", bevel=0.006, smooth=0.6)
box("keel_glow", (0, -0.485, zu(0.3)), (0.12, 0.008, 1.8), "fsr_field", group="keel", bevel=0.0)
for k, x in enumerate((-0.3, -0.12, 0.12, 0.3)):
    box(f"strake_{k}", (x, -0.39, zu(0.8)), (0.05, 0.06, 1.5), "fsr_gunmetal", group="under", bevel=0.008)
for s in (1, -1):
    tag = "R" if s > 0 else "L"
    for k, u in enumerate((0.58, 0.72, 0.86)):
        box(f"ag_pad_{tag}{k}", (s * 0.4, -0.375, zu(u)), (0.12, 0.01, 0.5), "fsr_field", bevel=0.0, group=f"ag_{tag}")


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


KEEP_UV = {"hull", "wing_R", "wing_L", "fin_R", "fin_L", "engine", "pod_R", "pod_L"}
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

# chunkier proportions (classic FEISAR): wider, taller, slightly shorter
SCALE = (1.42, 1.62, 0.88)  # web x, y, z
for ob in scene.objects:
    ob.select_set(True)
bpy.context.view_layer.objects.active = scene.objects[0]
bpy.ops.transform.resize(value=(SCALE[0], SCALE[2], SCALE[1]), center_override=(0, 0, 0))
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
for o in scene.objects:
    o.select_set(False)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True, use_selection=False)
print("EXPORTED", OUT, os.path.getsize(OUT), "objects:", len(scene.objects))
