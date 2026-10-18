"""
FEISAR FX350 (Wipeout HD) — fan-made procedural recreation for Blender (v3, high detail).

Builds the craft from code and exports assets/models/feisar_fx350.glb.
- The hull and side panels carry UVs for a livery texture the website paints at runtime
  (materials "fsr_livery" and "fsr_panel").
- Mechanical parts get smart-projected UVs for a carbon / brushed-metal texture.
- Sub-parts are joined into named assemblies (hull, cockpit, pod_R, thruster, ...) so the
  site can explode them; airbrakes keep their hinge as origin.

Run (Flatpak Blender):
  flatpak run --filesystem=$PWD org.blender.Blender -b --python tools/build_feisar.py

Coordinates below use the web convention: x = right, y = up, z = forward (nose at +z).
They are converted to Blender's Z-up space on creation; the glTF exporter converts back.
"""
import math
import os

import bmesh
import bpy
import mathutils as mu

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "models", "feisar_fx350.glb")
TAU = math.tau


def B(p):
    x, y, z = p
    return mu.Vector((x, -z, y))


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


material("fsr_livery", "#ffffff", rough=0.26, coat=1.0)
material("fsr_panel", "#ffffff", rough=0.26, coat=1.0)
material("fsr_white", "#eef2f7", rough=0.28, coat=1.0)
material("fsr_sky", "#3aa6dc", rough=0.28, coat=1.0)
material("fsr_teal", "#1d7fb4", rough=0.3, coat=1.0)
material("fsr_yellow", "#e8b62a", rough=0.28, coat=1.0)
material("fsr_dark", "#2a3039", metal=0.6, rough=0.4, coat=0.3)
material("fsr_carbon", "#16191f", metal=0.2, rough=0.45, coat=0.8)
material("fsr_metal", "#b8c1cc", metal=1.0, rough=0.25)
material("fsr_gunmetal", "#4a525e", metal=1.0, rough=0.35)
material("fsr_rubber", "#0c0e12", rough=0.8)
material("fsr_glass", "#0d2a47", metal=0.2, rough=0.02, coat=1.0, alpha=0.6)
material("fsr_grille", "#9aa6b5", metal=0.9, rough=0.3)
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
PARTS = {}  # assembly name -> [objects]


def add(group, ob):
    PARTS.setdefault(group, []).append(ob)
    return ob


def new_object(name, bm, mats, smooth_angle=0.55, bevel=0.0, segments=3, group=None):
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
        mod.angle_limit = math.radians(28)
        mod.harden_normals = True
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=smooth_angle)
    except Exception:
        bpy.ops.object.shade_flat()
    ob.select_set(False)
    if group:
        add(group, ob)
    return ob


def loft(name, rings, mat_of, mats, cap_front=None, cap_back=None, bevel=0.012, uv_of=None, group=None, closed=True):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap") if uv_of else None
    V = [[bm.verts.new(B(p)) for p in r] for r in rings]
    n = len(rings[0])
    for i in range(len(rings) - 1):
        for j in range(n if closed else n - 1):
            k = (j + 1) % n
            f = bm.faces.new((V[i][j], V[i][k], V[i + 1][k], V[i + 1][j]))
            f.material_index = mat_of(i, j)
            if uvl:
                for loop, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                    loop[uvl].uv = uv_of(ii, jj)
    if cap_front is not None:
        f = bm.faces.new(V[0][::-1]); f.material_index = cap_front
    if cap_back is not None:
        f = bm.faces.new(V[-1]); f.material_index = cap_back
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_object(name, bm, mats, bevel=bevel, group=group)


def slab(name, pts, thick, mats, normal_hint=(0, 1, 0), bevel=0.01, uv_rect=None, origin=None, group=None):
    P = [B(p) for p in pts]
    nrm = (P[1] - P[0]).cross(P[2] - P[0]).normalized()
    if nrm.dot(B(normal_hint)) < 0:
        nrm = -nrm
    o = B(origin) if origin else mu.Vector((0, 0, 0))
    half = nrm * thick / 2
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    top = [bm.verts.new(p + half - o) for p in P]
    bot = [bm.verts.new(p - half - o) for p in P]
    ft = bm.faces.new(top); ft.material_index = 0
    fb = bm.faces.new(bot[::-1]); fb.material_index = 0
    if uv_rect:
        for loop, uv in zip(ft.loops, uv_rect):
            loop[uvl].uv = uv
        for loop, uv in zip(fb.loops, uv_rect[::-1]):
            loop[uvl].uv = uv
    n = len(P)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((top[i], bot[i], bot[j], top[j])); f.material_index = 1 if len(mats) > 1 else 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_object(name, bm, mats, bevel=bevel, group=group)
    ob.location = o
    return ob


def box(name, c, s, mat, rot=(0, 0, 0), bevel=0.01, group=None, segments=2):
    """c: centre, s: (width x, height y, length z), rot: (pitch about x, yaw about y, roll about z) in web axes."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= s[0]; v.co.y *= s[2]; v.co.z *= s[1]
    ob = new_object(name, bm, [mat], bevel=bevel, group=group, segments=segments)
    ob.location = B(c)
    ob.rotation_mode = "YXZ"
    ob.rotation_euler = (rot[0], -rot[2], rot[1])
    return ob


def cylinder(name, c, r, length, mat, r2=None, verts=32, axis="z", group=None, cap=True, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=length)
    ob = new_object(name, bm, [mat], smooth_angle=0.9, group=group, bevel=bevel)
    ob.location = B(c)
    # default cone axis is Blender Z (= web y)
    if axis == "z":
        ob.rotation_euler = (math.radians(-90), 0, 0)
    elif axis == "x":
        ob.rotation_euler = (0, math.radians(90), 0)
    return ob


def torus(name, c, R, r, mat, group=None, axis="z"):
    bm = bmesh.new()
    seg, ring = 48, 12
    verts = []
    for i in range(seg):
        a = i / seg * TAU
        row = []
        for j in range(ring):
            b = j / ring * TAU
            x = (R + r * math.cos(b)) * math.cos(a)
            y = (R + r * math.cos(b)) * math.sin(a)
            z = r * math.sin(b)
            row.append(bm.verts.new((x, y, z)))
        verts.append(row)
    for i in range(seg):
        for j in range(ring):
            bm.faces.new((verts[i][j], verts[(i + 1) % seg][j], verts[(i + 1) % seg][(j + 1) % ring], verts[i][(j + 1) % ring]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_object(name, bm, [mat], smooth_angle=3.0, group=group)
    ob.location = B(c)
    if axis == "z":
        ob.rotation_euler = (math.radians(90), 0, 0)
    return ob


def sphere(name, c, r, scale, mat, group=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r)
    for v in bm.verts:
        v.co.x *= scale[0]; v.co.y *= scale[2]; v.co.z *= scale[1]
    ob = new_object(name, bm, [mat], smooth_angle=3.14, group=group)
    ob.location = B(c)
    return ob


def tube(name, pts, r, mat, group=None, res=8):
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


# ================================================================ hull
KEY = [
    (5.00, 0.30, 0.22, -0.22, 0.00),
    (4.70, 0.40, 0.31, -0.28, 0.13),
    (4.20, 0.46, 0.36, -0.31, 0.19),
    (3.40, 0.51, 0.41, -0.33, 0.25),
    (2.40, 0.56, 0.44, -0.345, 0.30),
    (1.20, 0.60, 0.47, -0.355, 0.37),
    (0.00, 0.62, 0.48, -0.36, 0.42),
    (-1.00, 0.64, 0.48, -0.36, 0.45),
    (-2.00, 0.645, 0.47, -0.355, 0.47),
    (-2.70, 0.63, 0.45, -0.34, 0.46),
    (-3.08, 0.58, 0.42, -0.30, 0.43),
]


def cr(a, b, c, d, t):
    return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)


ST = []
for i in range(len(KEY) - 1):
    for k in range(3):
        t = k / 3
        a, b, c, d = KEY[max(i - 1, 0)], KEY[i], KEY[i + 1], KEY[min(i + 2, len(KEY) - 1)]
        ST.append(tuple(cr(a[m], b[m], c[m], d[m], t) for m in range(5)))
ST.append(KEY[-1])
Z0, Z1 = ST[0][0], ST[-1][0]
VB = [0.0, 0.30, 0.34, 0.41, 0.50, 0.54, 0.76, 0.80, 0.89, 0.96, 1.0]  # shared with js/livery.js


def hull_ring(z, wb, wt, yb, yt):
    lip, ch = 0.05, 0.07
    mid = yb + 0.16 + (yt - 0.14 - yb - 0.16) * 0.42
    wm = wb + lip + (wt + ch - wb - lip) * 0.42
    return [
        (-wb, yb, z), (wb, yb, z),
        (wb + lip, yb + 0.16, z), (wm, mid, z), (wt + ch, yt - 0.14, z), (wt, yt, z),
        (-wt, yt, z), (-(wt + ch), yt - 0.14, z), (-wm, mid, z), (-(wb + lip), yb + 0.16, z),
    ]


def hull_at(z):
    for (z0, *a0), (z1, *a1) in zip(KEY, KEY[1:]):
        if z1 <= z <= z0:
            t = (z0 - z) / (z0 - z1)
            return [u + (v - u) * t for u, v in zip(a0, a1)]
    return KEY[-1][1:]


def side_frame(z, s):
    """Point and outward normal (web coords) on the upper side strip of the hull at z."""
    wb, wt, yb, yt = hull_at(z)
    lip, ch = 0.05, 0.07
    mid = yb + 0.16 + (yt - 0.14 - yb - 0.16) * 0.42
    wm = wb + lip + (wt + ch - wb - lip) * 0.42
    p0, p1 = mu.Vector((wm, mid)), mu.Vector((wt + ch, yt - 0.14))
    c = (p0 + p1) / 2
    d = (p1 - p0).normalized()
    n = mu.Vector((d.y, -d.x))
    if n.x < 0:
        n = -n
    return (s * c.x, c.y, z), (s * n.x, n.y), math.atan2(n.y, n.x)


loft("hull", [hull_ring(*s) for s in ST], lambda i, j: 0, ["fsr_livery", "fsr_sky", "fsr_carbon"],
     cap_front=1, cap_back=2, uv_of=lambda i, j: ((Z0 - ST[i][0]) / (Z0 - Z1), 1.0 - VB[j]), group="hull")

# raised spine along the deck
rings = []
for z in [4.4 - k * 0.2 for k in range(22)]:
    wb, wt, yb, yt = hull_at(z)
    rings.append([(0.09, yt, z), (0.065, yt + 0.035, z), (-0.065, yt + 0.035, z), (-0.09, yt, z)])
loft("spine", rings, lambda i, j: 1 if j == 1 else 0, ["fsr_white", "fsr_sky"], cap_front=0, cap_back=0, bevel=0.006, group="hull")

# chin splitter + nose sensor
slab("chin", [(0.30, -0.24, 5.08), (0.48, -0.34, 3.6), (-0.48, -0.34, 3.6), (-0.30, -0.24, 5.08)], 0.03, ["fsr_carbon"], group="hull")
box("nose_sensor", (0, -0.1, 4.995), (0.22, 0.035, 0.02), "fsr_screen", bevel=0.0, group="hull")
for s in (1, -1):
    wb, wt, yb, yt = hull_at(4.1)
    box(f"nose_intake_{s}", (s * (wb + 0.045), yb + 0.11, 4.0), (0.03, 0.05, 0.55), "fsr_carbon", rot=(0, 0, -s * 0.3), bevel=0.0, group="hull")

# keel + underside plates
box("keel", (0, -0.37, 0.5), (0.18, 0.03, 6.6), "fsr_carbon", group="under")
for k, z in enumerate((3.4, 1.9, 0.4, -1.1, -2.4)):
    wb, wt, yb, yt = hull_at(z)
    box(f"under_plate_{k}", (0, yb - 0.008, z), (wb * 1.5, 0.012, 1.1), "fsr_gunmetal", bevel=0.004, group="under")

# side vents (front quarter) with slats
for s in (1, -1):
    for vz in (3.05, 2.35):
        p, n, ang = side_frame(vz, s)
        roll = ang if s > 0 else math.pi - ang
        box(f"vent_well_{s}_{vz}", p, (0.02, 0.085, 0.5), "fsr_carbon", rot=(0, 0, roll), bevel=0.0, group=f"vents_{'R' if s > 0 else 'L'}")
        for k in range(7):
            q = (p[0] + n[0] * 0.012, p[1] + n[1] * 0.012, vz - 0.21 + k * 0.07)
            box(f"vent_slat_{s}_{vz}_{k}", q, (0.014, 0.07, 0.022), "fsr_gunmetal", rot=(0, 0, roll), bevel=0.0, group=f"vents_{'R' if s > 0 else 'L'}")

# skirts: rail + angled slats
for s in (1, -1):
    tag = "R" if s > 0 else "L"
    rail = []
    for z in [4.0 - k * 0.25 for k in range(21)]:
        wb, wt, yb, yt = hull_at(z)
        rail.append((s * (wb + 0.03), yb + 0.09, z))
    tube(f"skirt_rail_{tag}", rail, 0.016, "fsr_gunmetal", group=f"skirt_{tag}")
    rail2 = []
    for z in [3.8 - k * 0.25 for k in range(19)]:
        wb, wt, yb, yt = hull_at(z)
        rail2.append((s * (wb + 0.13), yb - 0.045, z))
    tube(f"skirt_rail2_{tag}", rail2, 0.012, "fsr_gunmetal", group=f"skirt_{tag}")
    z = 3.7
    while z > -1.0:
        wb, wt, yb, yt = hull_at(z)
        slab(f"skirt_slat_{tag}_{z:.2f}", [(s * (wb + 0.03), yb + 0.09, z + 0.03), (s * (wb + 0.13), yb - 0.045, z + 0.03),
                                         (s * (wb + 0.13), yb - 0.045, z - 0.03), (s * (wb + 0.03), yb + 0.09, z - 0.03)],
             0.01, ["fsr_grille"], normal_hint=(0, 0, 1), bevel=0.0, group=f"skirt_{tag}")
        z -= 0.13

# ================================================================ cockpit
cf, crr = 0.15, -1.55
cb = [(0.33, 0.42, cf), (0.42, 0.46, crr), (-0.42, 0.46, crr), (-0.33, 0.42, cf)]
ct = [(0.19, 0.86, -0.55), (0.27, 0.93, -1.36), (-0.27, 0.93, -1.36), (-0.19, 0.86, -0.55)]
bm = bmesh.new()
vb = [bm.verts.new(B(p)) for p in cb]
vt = [bm.verts.new(B(p)) for p in ct]
for f in [(vb[3], vb[0], vt[0], vt[3]), (vb[0], vb[1], vt[1], vt[0]), (vb[2], vb[3], vt[3], vt[2]), (vt[0], vt[1], vt[2], vt[3]), (vb[1], vb[2], vt[2], vt[1])]:
    bm.faces.new(f)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if not (e.verts[0] in vb and e.verts[1] in vb)], cuts=1, use_grid_fill=True)
bm2 = bm.copy()
new_object("canopy_glass", bm, ["fsr_glass"], smooth_angle=0.2, group="canopy_glass")
frame = new_object("canopy_frame_wf", bm2, ["fsr_carbon"], smooth_angle=0.2, group="canopy_frame")
wf = frame.modifiers.new("frame", "WIREFRAME")
wf.thickness = 0.032
wf.use_even_offset = True
wf.use_replace = True
for s in (1, -1):
    box(f"canopy_hinge_{s}", (s * 0.39, 0.47, -1.45), (0.05, 0.05, 0.18), "fsr_metal", group="canopy_frame")
    box(f"canopy_rail_{s}", (s * 0.36, 0.43, -0.72), (0.04, 0.05, 1.7), "fsr_dark", rot=(math.atan2(0.05, 1.65), 0, 0), bevel=0.0, group="hull")
    p, n, ang = side_frame(0.4, s)
    box(f"side_slot_{s}", p, (0.025, 0.06, 1.1), "fsr_carbon", rot=(0, 0, ang if s > 0 else math.pi - ang), bevel=0.0, group="hull")

# interior: dashboard, screens, seat, pilot
box("dash", (0, 0.5, -0.2), (0.5, 0.1, 0.32), "fsr_carbon", rot=(math.radians(18), 0, 0), group="cockpit")
for x in (-0.12, 0.12):
    box(f"screen_{x}", (x, 0.56, -0.28), (0.16, 0.08, 0.008), "fsr_screen", rot=(math.radians(-55), 0, 0), bevel=0.0, group="cockpit")
box("yoke", (0, 0.55, -0.48), (0.22, 0.03, 0.03), "fsr_gunmetal", group="cockpit")
box("seat_base", (0, 0.5, -1.05), (0.38, 0.06, 0.4), "fsr_carbon", group="cockpit")
box("seat_back", (0, 0.66, -1.27), (0.38, 0.36, 0.06), "fsr_carbon", rot=(math.radians(-14), 0, 0), group="cockpit")
box("headrest", (0, 0.86, -1.32), (0.2, 0.1, 0.06), "fsr_rubber", rot=(math.radians(-14), 0, 0), group="cockpit")
sphere("pilot_torso", (0, 0.62, -1.08), 0.15, (1.25, 1.1, 0.85), "fsr_suit", group="cockpit")
sphere("pilot_helmet", (0, 0.8, -1.02), 0.12, (1.0, 1.12, 1.05), "fsr_helmet", group="cockpit")
sphere("pilot_visor", (0, 0.805, -0.925), 0.085, (1.25, 0.5, 0.55), "fsr_visor", group="cockpit")
for s in (1, -1):
    tube(f"pilot_arm_{s}", [(s * 0.16, 0.66, -1.05), (s * 0.17, 0.58, -0.8), (s * 0.1, 0.56, -0.5)], 0.035, "fsr_suit", group="cockpit")
slab("collar", [(0.40, 0.45, -1.50), (0.44, 0.50, -1.75), (-0.44, 0.50, -1.75), (-0.40, 0.45, -1.50)], 0.05, ["fsr_white", "fsr_dark"], group="cowl")

# ================================================================ cowl, intake, airbrakes
loft("cowl_shell", [
    [(0.42, 0.46, -1.55), (0.36, 0.66, -1.55), (-0.36, 0.66, -1.55), (-0.42, 0.46, -1.55)],
    [(0.47, 0.47, -1.85), (0.38, 0.76, -1.85), (-0.38, 0.76, -1.85), (-0.47, 0.47, -1.85)],
    [(0.47, 0.46, -2.85), (0.36, 0.74, -2.85), (-0.36, 0.74, -2.85), (-0.47, 0.46, -2.85)],
    [(0.42, 0.43, -3.08), (0.32, 0.64, -3.08), (-0.32, 0.64, -3.08), (-0.42, 0.43, -3.08)],
], lambda i, j: (1 if j == 1 else 2 if j == 3 else 0), ["fsr_sky", "fsr_yellow", "fsr_white"], cap_front=2, cap_back=2, group="cowl")
sphere("sensor_dome", (0, 0.66, -1.6), 0.07, (1, 0.6, 1), "fsr_visor", group="cowl")
for s in (1, -1):
    cylinder(f"antenna_{s}", (s * 0.2, 0.98, -2.95), 0.012, 0.42, "fsr_metal", r2=0.004, verts=8, axis="y", group="antenna")
    sphere(f"antenna_tip_{s}", (s * 0.2, 1.19, -2.95), 0.018, (1, 1, 1), "fsr_light_red" if s < 0 else "fsr_light_green", group="antenna")

# intake housing with tubes, grille and louvres
box("intake_box", (0, 0.86, -2.25), (0.46, 0.16, 0.95), "fsr_dark", group="intake")
box("intake_lip", (0, 0.84, -1.76), (0.5, 0.08, 0.06), "fsr_yellow", group="intake")
for k in range(7):
    box(f"intake_grille_{k}", (-0.18 + k * 0.06, 0.86, -1.775), (0.012, 0.1, 0.03), "fsr_grille", bevel=0.0, group="intake")
for s in (1, -1):
    cylinder(f"intake_tube_{s}", (s * 0.15, 0.97, -2.25), 0.065, 0.9, "fsr_metal", group="intake", bevel=0.004)
    for z in (-1.84, -2.66):
        torus(f"intake_band_{s}_{z}", (s * 0.15, 0.97, z), 0.068, 0.012, "fsr_gunmetal", group="intake")
    cylinder(f"intake_cap_{s}", (s * 0.15, 0.97, -1.79), 0.05, 0.02, "fsr_carbon", group="intake")
for k in range(5):
    box(f"louvre_{k}", (0, 0.945, -1.9 - k * 0.16), (0.2, 0.012, 0.05), "fsr_carbon", bevel=0.0, group="intake")

for s in (1, -1):
    tag = "R" if s > 0 else "L"
    hinge = (s * 0.45, 0.60, -2.05)
    slab(f"airbrake_{tag}", [(s * 0.44, 0.50, -2.05), (s * 0.45, 0.70, -2.05), (s * 0.45, 0.69, -2.85), (s * 0.44, 0.48, -2.85)], 0.04,
         ["fsr_white", "fsr_teal"], normal_hint=(s, 0, 0), origin=hinge, group=f"airbrake_{tag}")

# ================================================================ side panels, pods, lights
for s in (1, -1):
    tag = "R" if s > 0 else "L"
    panel = [(s * 0.50, 0.42, -0.70), (s * 0.52, 0.47, -3.0), (s * 0.80, -0.44, -3.28), (s * 0.72, -0.44, -1.95)]
    uv = [(0.0, 1.0), (1.0, 1.0), (1.0, 0.0), (0.45, 0.0)] if s > 0 else [(1.0, 1.0), (0.0, 1.0), (0.0, 0.0), (0.55, 0.0)]
    slab(f"panel_{tag}", panel, 0.07, ["fsr_panel", "fsr_teal"], normal_hint=(s, 1, 0), uv_rect=uv, group=f"panel_{tag}")
    tube(f"panel_edge_{tag}", [(s * 0.725, -0.47, -1.95), (s * 0.805, -0.47, -3.28)], 0.02, "fsr_gunmetal", group=f"panel_{tag}")
    tube(f"panel_lead_{tag}", [(s * 0.50, 0.44, -0.70), (s * 0.725, -0.46, -1.95)], 0.016, "fsr_gunmetal", group=f"panel_{tag}")
    for k in range(10):
        t = (k + 0.5) / 10
        pz = -0.75 - t * 2.2
        cylinder(f"bolt_{tag}_{k}", (s * (0.515 + 0.04), 0.43 - 0.02, pz), 0.012, 0.012, "fsr_metal", verts=10, axis="x", group=f"panel_{tag}")
    box(f"nav_{tag}", (s * 0.81, -0.44, -3.27), (0.04, 0.04, 0.06), "fsr_light_green" if s > 0 else "fsr_light_red", bevel=0.0, group=f"panel_{tag}")

    # engine block (rectangular, sitting on the side panel like the FX350)
    g = f"pod_{tag}"
    roll = math.atan2(0.91, 0.28) * s  # panel slope
    rl = (math.pi / 2 - math.atan2(0.91, 0.28)) * s
    pc = (s * 0.78, 0.08, -2.6)
    box(f"pod_body_{tag}", pc, (0.24, 0.3, 1.0), "fsr_carbon", rot=(0, 0, -rl), group=g, bevel=0.02)
    slab(f"pod_wedge_{tag}", [(s * 0.68, 0.24, -2.1), (s * 0.9, 0.2, -2.1), (s * 0.88, -0.06, -2.1), (s * 0.66, -0.02, -2.1)], 0.02, ["fsr_white"], normal_hint=(0, 0, 1), group=g)
    box(f"pod_intake_{tag}", (s * 0.78, 0.09, -2.08), (0.16, 0.2, 0.06), "fsr_gunmetal", rot=(0, 0, -rl), group=g, bevel=0.005)
    for k in range(5):
        box(f"pod_vent_{tag}_{k}", (s * (0.78 + 0.02), 0.08 + 0.14, -2.35 - k * 0.1), (0.14, 0.012, 0.04), "fsr_gunmetal", rot=(0, 0, -rl), bevel=0.0, group=g)
    box(f"pod_stripe_{tag}", (s * 0.78, 0.08, -2.75), (0.25, 0.31, 0.06), "fsr_yellow", rot=(0, 0, -rl), group=g, bevel=0.004)
    box(f"pod_nozzle_{tag}", (s * 0.78, 0.08, -3.12), (0.2, 0.24, 0.06), "fsr_metal", rot=(0, 0, -rl), group=g, bevel=0.008)
    box(f"pod_core_{tag}", (s * 0.78, 0.08, -3.155), (0.15, 0.18, 0.01), "fsr_engine", rot=(0, 0, -rl), group=g, bevel=0.0)
    for k in range(3):
        box(f"pod_vane_{tag}_{k}", (s * 0.78 + (k - 1) * 0.045 * math.cos(rl), 0.08 + (k - 1) * 0.045 * math.sin(-rl) * s, -3.16), (0.012, 0.18, 0.02), "fsr_dark", rot=(0, 0, -rl), bevel=0.0, group=g)

# ================================================================ main thruster
g = "thruster"
box("thr_frame", (0, 0.06, -3.12), (0.74, 0.42, 0.16), "fsr_carbon", group=g)
box("thr_step1", (0, 0.06, -3.2), (0.66, 0.34, 0.04), "fsr_gunmetal", group=g)
box("thr_step2", (0, 0.06, -3.23), (0.6, 0.29, 0.03), "fsr_metal", group=g)
box("thr_core", (0, 0.06, -3.235), (0.56, 0.25, 0.01), "fsr_engine", bevel=0.0, group=g)
for k, x in enumerate((-0.21, -0.07, 0.07, 0.21)):
    box(f"thr_vane_{k}", (x, 0.06, -3.25), (0.02, 0.27, 0.05), "fsr_dark", bevel=0.0, group=g)
box("thr_hood", (0, 0.29, -3.15), (0.8, 0.05, 0.24), "fsr_yellow", group=g)
box("thr_skid", (0, -0.17, -3.15), (0.7, 0.04, 0.2), "fsr_gunmetal", group=g)
for sx in (1, -1):
    for sy in (1, -1):
        c = (sx * 0.33, 0.06 + sy * 0.17, -3.22)
        cylinder(f"rcs_{sx}_{sy}", c, 0.025, 0.06, "fsr_metal", r2=0.035, verts=12, group=g)
    box(f"tail_light_{sx}", (sx * 0.36, 0.3, -3.27), (0.07, 0.02, 0.01), "fsr_light_white", bevel=0.0, group=g)

# ================================================================ AG emitters
for s in (1, -1):
    tag = "R" if s > 0 else "L"
    for k, z in enumerate((3.0, 1.6, 0.2, -1.2, -2.4)):
        wb, wt, yb, yt = hull_at(z)
        box(f"ag_frame_{tag}{k}", (s * (wb - 0.2), yb - 0.012, z), (0.2, 0.02, 0.78), "fsr_carbon", bevel=0.004, group=f"ag_{tag}")
        box(f"ag_pad_{tag}{k}", (s * (wb - 0.2), yb - 0.024, z), (0.15, 0.008, 0.68), "fsr_field", bevel=0.0, group=f"ag_{tag}")

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


LIVERY_GROUPS = {"hull", "panel_R", "panel_L"}
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
    if name not in LIVERY_GROUPS and not name.startswith("airbrake"):
        uv_project(ob)
    if not name.startswith("airbrake"):
        # origin at geometry centre helps the exploded view
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
for o in scene.objects:
    o.select_set(False)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True, use_selection=False)
print("EXPORTED", OUT, os.path.getsize(OUT), "objects:", len(scene.objects))
