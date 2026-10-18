"""
FEISAR FX350 (Wipeout HD) — fan-made procedural recreation for Blender.

Builds the craft from code and exports assets/models/feisar_fx350.glb.

Run (Flatpak Blender):
  flatpak run --filesystem=$PWD org.blender.Blender -b --python tools/build_feisar.py

Coordinates below use the web convention: x = right, y = up, z = forward (nose at +z).
They are converted to Blender's Z-up space on creation; the glTF exporter converts back.
"""
import math
import os
import sys

import bmesh
import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "models", "feisar_fx350.glb")


def B(p):
    x, y, z = p
    return (x, -z, y)


# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materials
MATS = {}


def material(name, color, metal=0.0, rough=0.35, coat=0.0, emit=None, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.06
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 4.0
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    MATS[name] = m
    return m


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


material("fsr_white", srgb("#f3f6fa"), rough=0.32, coat=1.0)
material("fsr_sky", srgb("#3aa6dc"), rough=0.3, coat=1.0)
material("fsr_teal", srgb("#1d7fb4"), rough=0.32, coat=1.0)
material("fsr_yellow", srgb("#e8b62a"), rough=0.3, coat=1.0)
material("fsr_dark", srgb("#2a3039"), metal=0.6, rough=0.42, coat=0.3)
material("fsr_carbon", srgb("#14181f"), metal=0.3, rough=0.5)
material("fsr_metal", srgb("#aab4c2"), metal=1.0, rough=0.28)
material("fsr_glass", srgb("#0d2a47"), metal=0.2, rough=0.03, coat=1.0, alpha=0.82)
material("fsr_engine", srgb("#9be9ff"), emit=srgb("#6fdcff"))
material("fsr_field", srgb("#6fdcff"), emit=srgb("#3fc6ff"))


# ---------------------------------------------------------------- helpers
def new_object(name, bm, mats, smooth_angle=0.6, bevel=0.0):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for mn in mats:
        me.materials.append(MATS[mn])
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    if bevel > 0:
        mod = ob.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(30)
        mod.harden_normals = True
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=smooth_angle)
    except Exception:
        bpy.ops.object.shade_flat()
    ob.select_set(False)
    return ob


def loft(name, rings, strip_mats, mat_names, cap_front=None, cap_back=None, bevel=0.012, seg_mat=None):
    """rings: list of lists of 3D points (same count, ordered around). strip_mats[j] = material index for strip j.
    seg_mat(i, j) may override per segment/strip."""
    bm = bmesh.new()
    V = [[bm.verts.new(B(p)) for p in r] for r in rings]
    n = len(rings[0])
    for i in range(len(rings) - 1):
        for j in range(n):
            k = (j + 1) % n
            f = bm.faces.new((V[i][j], V[i][k], V[i + 1][k], V[i + 1][j]))
            f.material_index = seg_mat(i, j) if seg_mat else strip_mats[j]
    if cap_front is not None:
        f = bm.faces.new(V[0][::-1]); f.material_index = cap_front
    if cap_back is not None:
        f = bm.faces.new(V[-1]); f.material_index = cap_back
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_object(name, bm, mat_names, bevel=bevel)


def slab(name, pts, thick, mat_top, mat_side, normal_hint=(0, 1, 0), mats=None, bevel=0.01):
    """Planar polygon extruded by `thick` along its normal (oriented towards normal_hint)."""
    import mathutils as mu
    P = [mu.Vector(B(p)) for p in pts]
    nrm = (P[1] - P[0]).cross(P[2] - P[0]).normalized()
    hint = mu.Vector(B(normal_hint))
    if nrm.dot(hint) < 0:
        nrm = -nrm
    half = nrm * thick / 2
    bm = bmesh.new()
    top = [bm.verts.new(p + half) for p in P]
    bot = [bm.verts.new(p - half) for p in P]
    f = bm.faces.new(top); f.material_index = 0
    f = bm.faces.new(bot[::-1]); f.material_index = 0
    n = len(P)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((top[i], bot[i], bot[j], top[j])); f.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return new_object(name, bm, mats or [mat_top, mat_side], bevel=bevel)


def box(name, c, s, mat, rot=(0, 0, 0), bevel=0.012):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= s[0]
        v.co.y *= s[2]
        v.co.z *= s[1]
    ob = new_object(name, bm, [mat], bevel=bevel)
    ob.location = B(c)
    ob.rotation_euler = (rot[0], -rot[2], rot[1])
    return ob


def cyl(name, c, r, length, mat, axis="z", verts=24, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=verts, radius1=r, radius2=r, depth=length)
    ob = new_object(name, bm, [mat], smooth_angle=1.2)
    ob.location = B(c)
    if axis == "z":
        ob.rotation_euler = (math.radians(90), 0, 0)
    return ob


# ---------------------------------------------------------------- main hull
# stations: z, bottom half-width, top half-width, bottom y, top y
ST = [
    (4.95, 0.32, 0.24, -0.24, 0.02),
    (4.60, 0.42, 0.33, -0.29, 0.16),
    (3.70, 0.50, 0.40, -0.32, 0.24),
    (1.70, 0.58, 0.46, -0.35, 0.34),
    (0.00, 0.62, 0.48, -0.36, 0.42),
    (-1.00, 0.64, 0.48, -0.36, 0.45),
    (-2.40, 0.64, 0.46, -0.35, 0.47),
    (-3.05, 0.58, 0.42, -0.30, 0.43),
]


def hull_ring(z, wb, wt, yb, yt):
    lip, ch = 0.05, 0.07
    mid = yb + 0.16 + (yt - 0.14 - yb - 0.16) * 0.42
    wm = wb + lip + (wt + ch - wb - lip) * 0.42
    return [
        (-wb, yb, z), (wb, yb, z),
        (wb + lip, yb + 0.16, z), (wm, mid, z), (wt + ch, yt - 0.14, z), (wt, yt, z),
        (-wt, yt, z), (-(wt + ch), yt - 0.14, z), (-wm, mid, z), (-(wb + lip), yb + 0.16, z),
    ]


HULL_MATS = ["fsr_dark", "fsr_yellow", "fsr_sky", "fsr_white", "fsr_carbon", "fsr_teal"]
#            strip:  0 bottom, 1 lip R, 2 lower side R, 3 upper side R, 4 chamfer R, 5 top, 6 chamfer L, 7 upper L, 8 lower L, 9 lip L
STRIP = [0, 0, 1, 2, 2, 3, 2, 2, 1, 0]


def hull_seg(i, j):
    if j == 5:  # top strip: white on the nose, sky blue on the rear deck
        return 3 if i < 4 else 2
    if j in (4, 6) and i < 2:
        return 3
    if j in (3, 7) and i >= 5:
        return 5
    return STRIP[j]


loft("hull", [hull_ring(*s) for s in ST], STRIP, HULL_MATS, cap_front=2, cap_back=4, seg_mat=hull_seg)

# ---------------------------------------------------------------- lower side grilles (skirts)
for s in (1, -1):
    rings = []
    for z, wb, wt, yb, yt in ST[1:6]:
        rings.append([(s * (wb + 0.03), yb + 0.10, z), (s * (wb + 0.11), yb - 0.02, z), (s * (wb + 0.10), yb - 0.05, z), (s * (wb + 0.01), yb + 0.07, z)])
    rings[0] = [(s * 0.44, -0.24, 4.3)] * 4  # taper to a point at the front
    loft(f"skirt_{'R' if s > 0 else 'L'}", rings, [0, 0, 0, 0], ["fsr_metal"], cap_back=0, bevel=0.0)

# ---------------------------------------------------------------- cockpit canopy
canopy_base_f, canopy_base_r = 0.15, -1.55
cb = [(0.33, 0.42, canopy_base_f), (0.42, 0.46, canopy_base_r), (-0.42, 0.46, canopy_base_r), (-0.33, 0.42, canopy_base_f)]
ct = [(0.19, 0.86, -0.55), (0.27, 0.93, -1.36), (-0.27, 0.93, -1.36), (-0.19, 0.86, -0.55)]
bm = bmesh.new()
vb = [bm.verts.new(B(p)) for p in cb]
vt = [bm.verts.new(B(p)) for p in ct]
faces = [
    (vb[3], vb[0], vt[0], vt[3]),  # windscreen
    (vb[0], vb[1], vt[1], vt[0]),  # right
    (vb[2], vb[3], vt[3], vt[2]),  # left
    (vt[0], vt[1], vt[2], vt[3]),  # roof
    (vb[1], vb[2], vt[2], vt[1]),  # rear
]
for f in faces:
    bm.faces.new(f)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if not (e.verts[0] in vb and e.verts[1] in vb)], cuts=1, use_grid_fill=True)
bm2 = bm.copy()
new_object("canopy_glass", bm, ["fsr_glass"], smooth_angle=0.2)
frame = new_object("canopy_frame", bm2, ["fsr_carbon"], smooth_angle=0.2)
wf = frame.modifiers.new("frame", "WIREFRAME")
wf.thickness = 0.035
wf.use_even_offset = True
wf.use_replace = True

# seat collar behind the canopy
slab("canopy_collar", [(0.40, 0.45, -1.50), (0.44, 0.50, -1.75), (-0.44, 0.50, -1.75), (-0.40, 0.45, -1.50)], 0.05, "fsr_white", "fsr_dark")

# ---------------------------------------------------------------- rear cowl + intake
loft(
    "cowl",
    [
        [(0.42, 0.46, -1.55), (0.36, 0.66, -1.55), (-0.36, 0.66, -1.55), (-0.42, 0.46, -1.55)],
        [(0.47, 0.47, -1.85), (0.38, 0.76, -1.85), (-0.38, 0.76, -1.85), (-0.47, 0.47, -1.85)],
        [(0.47, 0.46, -2.85), (0.36, 0.74, -2.85), (-0.36, 0.74, -2.85), (-0.47, 0.46, -2.85)],
        [(0.42, 0.43, -3.05), (0.32, 0.64, -3.05), (-0.32, 0.64, -3.05), (-0.42, 0.43, -3.05)],
    ],
    [0, 1, 0, 2], ["fsr_sky", "fsr_yellow", "fsr_white"], cap_front=2, cap_back=2,
)
box("intake", (0, 0.86, -2.25), (0.46, 0.16, 0.95), "fsr_dark")
for s in (1, -1):
    cyl(f"intake_tube_{'R' if s > 0 else 'L'}", (s * 0.15, 0.97, -2.25), 0.065, 0.9, "fsr_metal")
box("intake_lip", (0, 0.84, -1.76), (0.5, 0.08, 0.06), "fsr_yellow")

# ---------------------------------------------------------------- side wing panels (yellow) + engine pods
for s in (1, -1):
    tag = "R" if s > 0 else "L"
    panel = [(s * 0.50, 0.42, -0.70), (s * 0.52, 0.47, -3.0), (s * 0.80, -0.44, -3.28), (s * 0.72, -0.44, -1.95)]
    slab(f"wing_{tag}", panel, 0.07, "fsr_yellow", "fsr_teal", normal_hint=(s, 1, 0))
    stripe = [(s * 0.68, -0.30, -1.88), (s * 0.77, -0.32, -3.26), (s * 0.81, -0.45, -3.29), (s * 0.72, -0.45, -1.96)]
    slab(f"wing_stripe_{tag}", stripe, 0.08, "fsr_sky", "fsr_teal", normal_hint=(s, 1, 0))
    # engine pod sitting on the panel
    box(f"pod_{tag}", (s * 0.76, 0.02, -2.6), (0.22, 0.3, 1.1), "fsr_carbon", rot=(0, 0, -s * 0.3))
    box(f"pod_cap_{tag}", (s * 0.76, 0.02, -2.02), (0.23, 0.31, 0.08), "fsr_white", rot=(0, 0, -s * 0.3))
    cyl(f"pod_nozzle_{tag}", (s * 0.76, 0.02, -3.17), 0.09, 0.05, "fsr_engine")

# ---------------------------------------------------------------- main thruster
box("thruster_frame", (0, 0.06, -3.12), (0.74, 0.42, 0.16), "fsr_carbon")
box("thruster_core", (0, 0.06, -3.2), (0.58, 0.28, 0.02), "fsr_engine", bevel=0.0)
for s in (1, -1):
    box(f"thruster_vane_{'R' if s > 0 else 'L'}", (s * 0.2, 0.06, -3.21), (0.03, 0.3, 0.04), "fsr_dark", bevel=0.0)

# ---------------------------------------------------------------- AG emitters (underside glow strips)
for s in (1, -1):
    box(f"ag_strip_{'R' if s > 0 else 'L'}", (s * 0.3, -0.355, 0.8), (0.05, 0.012, 4.6), "fsr_field", bevel=0.0)

# ---------------------------------------------------------------- details
cyl("antenna", (0.12, 1.0, -1.45), 0.012, 0.0, "fsr_metal", axis="y")
ant = bpy.data.objects["antenna"]
ant.scale = (1, 1, 1)
bpy.data.objects.remove(ant)
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.014, radius2=0.006, depth=0.38)
a = new_object("antenna", bm, ["fsr_metal"], smooth_angle=1.2)
a.location = B((0.14, 0.98, -1.42))
a.rotation_euler = (0, math.radians(-12), 0)
# nose vents
for k in range(4):
    box(f"vent_{k}", (0.0, 0.1 + k * 0.0, 2.9 - k * 0.28), (0.5, 0.02, 0.07), "fsr_dark", rot=(math.radians(-6), 0, 0), bevel=0.0)

# ---------------------------------------------------------------- surface detail
def hull_at(z):
    """Interpolated station values at z."""
    for (z0, *a0), (z1, *a1) in zip(ST, ST[1:]):
        if z1 <= z <= z0:
            t = (z0 - z) / (z0 - z1)
            return [u + (v - u) * t for u, v in zip(a0, a1)]
    return ST[-1][1:]


# panel lines across the top deck
for k, z in enumerate((3.9, 2.6, 1.2)):
    wb, wt, yb, yt = hull_at(z)
    box(f"panel_line_{k}", (0, yt + 0.002, z), (wt * 2 - 0.02, 0.012, 0.025), "fsr_dark", bevel=0.0)
# black side intake slots ahead of the cockpit
for s in (1, -1):
    wb, wt, yb, yt = hull_at(0.4)
    box(f"side_slot_{'R' if s > 0 else 'L'}", (s * (wt + 0.05), yt - 0.09, 0.4), (0.03, 0.07, 1.1), "fsr_carbon", rot=(0, 0, -s * 0.9), bevel=0.0)
# canopy rails
for s in (1, -1):
    box(f"canopy_rail_{'R' if s > 0 else 'L'}", (s * 0.36, 0.43, -0.72), (0.04, 0.05, 1.7), "fsr_dark", rot=(math.atan2(0.05, 1.65), 0, 0), bevel=0.0)

# ---------------------------------------------------------------- export
os.makedirs(os.path.dirname(OUT), exist_ok=True)
for ob in scene.objects:
    ob.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    use_selection=False,
)
print("EXPORTED", OUT, os.path.getsize(OUT))
