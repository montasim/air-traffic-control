"""Small reproducible prototype atlas. Blender is an offline authoring dependency only."""
import bpy
import json
import math
import os
import sys

root = sys.argv[sys.argv.index('--') + 1]
map_id = sys.argv[sys.argv.index('--') + 2] if len(sys.argv) > sys.argv.index('--') + 2 else 'saltmarsh-gateway'
out = os.path.join(root, 'public', 'assets', 'three', map_id)
source = os.path.join(root, 'art', 'blender', map_id)
os.makedirs(out, exist_ok=True)
os.makedirs(source, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = 0.85
    return mat

themes = {
 'saltmarsh-gateway': ((.29,.48,.16),(.10,.29,.08),(.68,.61,.43)),
 'river-bend': ((.32,.43,.22),(.16,.30,.12),(.70,.66,.48)),
 'desert-parallel': ((.60,.45,.24),(.28,.32,.13),(.72,.55,.32)),
 'twin-banks': ((.35,.43,.22),(.17,.30,.12),(.63,.63,.47)),
 'falcon-air-base': ((.26,.34,.18),(.12,.23,.09),(.32,.39,.29)),
 'executive-point': ((.36,.49,.24),(.18,.34,.12),(.78,.72,.59)),
 'metro-international': ((.31,.39,.26),(.15,.29,.12),(.62,.68,.70)),
 'freight-junction': ((.44,.39,.26),(.23,.29,.13),(.64,.40,.23)),
 'island-rescue': ((.38,.53,.24),(.12,.36,.15),(.86,.65,.30)),
 'frost-crossing': ((.68,.79,.77),(.40,.58,.51),(.67,.74,.76)),
 'carrier-coast': ((.35,.48,.25),(.16,.32,.13),(.49,.57,.61)),
 'blue-water': ((.18,.36,.42),(.21,.36,.29),(.48,.56,.62)),
}
ground_color, leaf_color, roof_color = themes[map_id]
grass = material('terrain', ground_color)
asphalt = material('mineral asphalt', (0.19, 0.22, 0.23))
roof = material('warm roof', roof_color)
wall = material('concrete', (0.47, 0.46, 0.39))
leaf = material('tree crown', leaf_color)
white = material('ivory', (0.91, 0.91, 0.83))
glass = material('cockpit', (0.06, 0.17, 0.22))
colors = [material('liner teal', (0.17, 0.65, 0.65)), material('commuter amber', (0.85, 0.47, 0.12)), material('rotor coral', (0.83, 0.24, 0.17))]

def cube(name, x, y, z, sx, sy, sz, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (sx, sy, sz)
    obj.data.materials.append(mat)
    return obj

def sphere(name, x, y, z, sx, sy, sz, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, location=(x, y, z))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (sx, sy, sz)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons: poly.use_smooth = True
    return obj

names = ['grass', 'asphalt', 'building', 'tree', 'cloud', 'liner', 'commuter', 'rotor']
for i, name in enumerate(names):
    x = -6 + (i % 4) * 4
    y = 6 - (i // 4) * 4
    if name in ['grass', 'asphalt']:
        cube(name, x, y, 0, 4, 4, .02, grass if name == 'grass' else asphalt)
    elif name == 'building':
        cube('walls', x, y, .3, 2.9, 2.1, .6, wall)
        cube('roof', x, y, .65, 3.1, 2.3, .12, roof)
        for j in range(5): cube('roof rib', x - 1.2 + j * .6, y, .73, .07, 2.2, .04, white)
        cube('roof plant', x + .75, y + .4, .9, .55, .6, .3, wall)
    elif name in ['tree', 'cloud']:
        for j in range(7):
            a = j * 2.4
            r = .55 if name == 'tree' else .7
            sphere(name, x + math.cos(a) * r, y + math.sin(a) * r * .7, .5 + j * .035,
                   .65, .65 if name == 'tree' else .5, .65, leaf if name == 'tree' else white)
    else:
        kind = names.index(name) - 5
        sphere(name + ' fuselage', x, y, .3, 1.45 if kind < 2 else .9, .24 if kind < 2 else .4, .24, white)
        cube('wing', x - .1, y, .3, .47, 2.8 if kind == 0 else 2.3, .08, colors[kind])
        cube('tail', x - 1.05, y, .37, .36, .95, .07, colors[kind])
        sphere('cockpit', x + .95 if kind < 2 else x + .4, y, .48, .21, .19, .05, glass)
        if kind == 2:
            sphere('rotor hub', x, y, .75, .12, .12, .08, glass)

bpy.ops.object.light_add(type='AREA', location=(-6, 8, 12))
light = bpy.context.object
light.name = 'soft daylight'
light.data.energy = 1800
light.data.shape = 'DISK'
light.data.size = 10
bpy.ops.object.camera_add(location=(0, 0, 30))
camera = bpy.context.object
camera.name = 'orthographic atlas camera'
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 16
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.world.color = (.35, .35, .35)
scene.view_settings.view_transform = 'Standard'
scene.render.filepath = os.path.join(out, 'atlas.png')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(source, map_id + '-kit.blend'))
bpy.ops.render.render(write_still=True)
with open(os.path.join(out, 'manifest.json'), 'w', encoding='utf8') as f:
    json.dump({'schema': 1, 'mapId': map_id, 'stage': 'runtime', 'blender': bpy.app.version_string,
               'atlas': 'atlas.png', 'width': 512, 'height': 512,
               'rgbaBytes': 512 * 512 * 4, 'mipmaps': False,
               'cells': {name: {'x': (i % 4) * 128, 'y': (i // 4) * 128, 'width': 128, 'height': 128,
                                 'pivot': [0.5, 0.5]} for i, name in enumerate(names)}}, f, indent=2)
print(map_id + ' atlas rendered: 1,048,576 decoded bytes; no mipmaps.')
