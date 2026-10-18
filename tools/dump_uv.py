"""Dump the UV layout of the prepared FEISAR body (per face: uv polygon, 3D centre and normal in web axes).

Run: tools/blender-bwrap.sh -b --python tools/dump_uv.py -- <glb> <out.json>
"""
import json
import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
faces = []
for ob in bpy.context.scene.objects:
    if ob.type != "MESH":
        continue
    me = ob.data
    uvl = me.uv_layers.active
    mat_names = [m.name if m else "" for m in me.materials]
    for p in me.polygons:
        mw = ob.matrix_world
        c = mw @ p.center
        n = (mw.to_3x3() @ p.normal).normalized()
        uv = [tuple(uvl.data[li].uv) for li in p.loop_indices]
        faces.append({
            "part": ob.name, "mat": mat_names[p.material_index] if mat_names else "",
            "uv": [(round(u, 5), round(1 - v, 5)) for u, v in uv],          # image space (y down)
            "c": [round(c.x, 3), round(c.z, 3), round(-c.y, 3)],              # web x, y, z
            "n": [round(n.x, 3), round(n.z, 3), round(-n.y, 3)],
            "area": round(p.area, 5),
            "p": [[round(w.x, 4), round(w.z, 4), round(-w.y, 4)] for w in (mw @ me.vertices[me.loops[li].vertex_index].co for li in p.loop_indices)],
        })
json.dump(faces, open(OUT, "w"))
print("FACES", len(faces))
