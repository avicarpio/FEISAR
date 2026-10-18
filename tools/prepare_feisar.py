"""
Prepare "WipeOut - Feisar" by Nobby76 (CC BY 4.0,
https://sketchfab.com/3d-models/wipeout-feisar-74e42e2192384cccbada8486b1f0703b) for the site.

- removes the display pedestal (!Base) and the boost-jet effect (!Boost_Jet)
- splits the body into loose parts (used by the exploded view)
- scales the craft to 8.2 units long, nose towards +z (web axes), centred like the site expects
- exports assets/models/feisar_fx350.glb with the original textures

Run:  tools/blender-bwrap.sh -b --python tools/prepare_feisar.py -- <path/to/scene.gltf> [<hi-res texture dir from tools/feisar_textures.py>]
"""
import os
import sys

import bpy
import mathutils as mu

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "models", "feisar_fx350.glb")
ARGS = sys.argv[sys.argv.index("--") + 1:]
SRC = ARGS[0]
HITEX = ARGS[1] if len(ARGS) > 1 else None

LENGTH = 8.2
NOSE_Z = 4.95      # web z of the nose tip
BOTTOM_Y = -0.42   # web y of the hull bottom

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene

# drop pedestal + jet effect
for ob in list(scene.objects):
    if ob.name.startswith("!Base") or ob.name.startswith("!Boost") or ob.name.startswith("Jet_Blast"):
        bpy.data.objects.remove(ob, do_unlink=True)

meshes = [o for o in scene.objects if o.type == "MESH"]
print("MESHES", [o.name for o in meshes])

# bake parent transforms into the meshes and unparent
for o in scene.objects:
    o.select_set(False)
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for ob in list(scene.objects):
    if ob.type != "MESH":
        bpy.data.objects.remove(ob, do_unlink=True)

# bounds (Blender space: Z up). Find the long axis = ship length.
def bounds(objs):
    mn = mu.Vector((1e9, 1e9, 1e9)); mx = -mn
    for o in objs:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            mn = mu.Vector(map(min, mn, w)); mx = mu.Vector(map(max, mx, w))
    return mn, mx


mn, mx = bounds(meshes)
size = mx - mn
print("BOUNDS", tuple(round(c, 4) for c in mn), tuple(round(c, 4) for c in mx), "size", tuple(round(c, 4) for c in size))

# the glow/boost parts sit at the rear: use the cockpit to find which end is the nose
cockpit = next((o for o in meshes if "Cockpit" in o.name), meshes[0])
cmn, cmx = bounds([cockpit])
long_axis = max(range(3), key=lambda i: size[i])
centre_long = (mn[long_axis] + mx[long_axis]) / 2
cockpit_long = (cmn[long_axis] + cmx[long_axis]) / 2
print("LONG AXIS", long_axis, "cockpit at", round(cockpit_long, 4), "centre", round(centre_long, 4))

# web nose direction is +z  ->  Blender -Y. Build a rotation that maps the long axis to Blender -Y
# (cockpit sits behind the centre on the FEISAR, so the nose is the far end from the cockpit)
axis_vec = mu.Vector((0, 0, 0)); axis_vec[long_axis] = 1.0
nose_sign = -1.0 if cockpit_long > centre_long else 1.0
nose_dir = axis_vec * nose_sign
rot = nose_dir.rotation_difference(mu.Vector((0, -1, 0)))
s = LENGTH / size[long_axis]
M = mu.Matrix.Diagonal((s, s, s, 1.0)) @ rot.to_matrix().to_4x4()
for o in meshes:
    o.data.transform(M)
    o.data.update()

mn, mx = bounds(meshes)
# web: nose z = NOSE_Z (Blender y = -NOSE_Z), bottom y = BOTTOM_Y (Blender z), centred in x
shift = mu.Vector((-(mn.x + mx.x) / 2, -NOSE_Z - mn.y, BOTTOM_Y - mn.z))
for o in meshes:
    o.data.transform(mu.Matrix.Translation(shift))
    o.data.update()
mn, mx = bounds(meshes)
print("FINAL", tuple(round(c, 3) for c in mn), tuple(round(c, 3) for c in mx))

# split the body into loose parts and name them by position
body = next((o for o in meshes if "Body" in o.name), None)
if body:
    for o in scene.objects:
        o.select_set(False)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
# group the loose body panels into named assemblies by position (web axes) for the exploded view
def region(o):
    mn, mx = bounds([o])
    c = (mn + mx) / 2
    x, y, z = c.x, c.z, -c.y
    w = mx.x - mn.x
    if w > 2.0:
        return "hull"
    if z > 2.6:
        return "nose"
    if abs(x) < 0.45 and y > 0.74 and -0.4 < z < 1.6:
        return "canopy_frame"
    if z < -2.35:
        return "rear"
    if x > 0.38:
        return "side_R"
    if x < -0.38:
        return "side_L"
    return "hull"


groups = {}
for o in [o for o in scene.objects if o.type == "MESH" and "Body" in o.name]:
    groups.setdefault(region(o), []).append(o)
for name, objs in groups.items():
    for p in scene.objects:
        p.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
for o in scene.objects:
    if "Cockpit" in o.name:
        o.name = "cockpit"
    elif "Glass" in o.name:
        o.name = "canopy_glass"
    elif "Glow" in o.name:
        o.name = "glow"

parts = [o for o in scene.objects if o.type == "MESH"]
for o in parts:
    for p in scene.objects:
        p.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    pmn, pmx = bounds([o])
    print("PART", o.name, "verts", len(o.data.vertices), "centre(web)",
          tuple(round(c, 2) for c in (o.location.x, o.location.z, -o.location.y)),
          "size(web)", tuple(round(c, 2) for c in (pmx.x - pmn.x, pmx.z - pmn.z, pmx.y - pmn.y)))

# swap in the high-resolution textures
if HITEX:
    for img in list(bpy.data.images):
        base = img.name.rsplit(".", 1)[0]
        for ext in (".jpg", ".png"):
            cand = os.path.join(HITEX, base + ext)
            if os.path.exists(cand):
                new = bpy.data.images.load(cand)
                new.colorspace_settings.name = img.colorspace_settings.name
                img.user_remap(new)
                print("HITEX", img.name, "<-", cand, tuple(new.size))
                break

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_apply=True, use_selection=False)
print("EXPORTED", OUT, os.path.getsize(OUT))
