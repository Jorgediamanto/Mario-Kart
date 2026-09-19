# -*- coding: utf-8 -*-
"""
Modela los objetos que se ven en la pista y los exporta a public/modelos/.

    blender --background --python tools/blender/objetos.py

Sale un .glb por objeto: `platano.glb` y `caparazon.glb`. Mismas reglas que el kart: el material
`Detalle` lo tiñe la tele (en el caparazón, para distinguir el rojo de cualquier otro color que
venga), el resto se queda como está. Tamaños pensados para el juego: el plátano mide unas 20
unidades de largo y el caparazón unas 22 de ancho.
"""
import bpy
import math
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SALIDA = os.path.join(RAIZ, 'public', 'modelos')


def limpiar():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for bloque in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for x in list(bloque):
            bloque.remove(x)


def material(nombre, color, metal=0.0, rugosidad=0.55):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rugosidad
    return m


def suavizar(o):
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_auto_smooth(angle=math.radians(50))


def unir(nombre, objetos):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objetos:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objetos[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = nombre
    return o


def exportar(nombre):
    bpy.ops.export_scene.gltf(filepath=os.path.join(SALIDA, nombre), export_format='GLB',
                              export_apply=True, export_yup=True)
    print('EXPORTADO', nombre)


def platano():
    """Un plátano curvo con las dos puntas oscuras: se ve lo que es de un vistazo.

    El arco se monta a mano con bolas a lo largo de una curva (más gordo en el centro, fino en las
    puntas). Con el modificador de doblar salía un churro, así que mejor así: se ve exactamente lo
    que se pone."""
    limpiar()
    piel = material('Piel', (1.0, 0.88, 0.12), rugosidad=0.4)
    punta = material('Oscuro', (0.33, 0.20, 0.05))
    partes = []
    RADIO_ARCO, ABRE = 13.0, math.radians(125)
    trozos = 9
    for i in range(trozos):
        t = i / (trozos - 1)
        a = -ABRE / 2 + ABRE * t
        x = math.sin(a) * RADIO_ARCO
        z = math.cos(a) * RADIO_ARCO - RADIO_ARCO + 4.0
        gordo = 3.6 * (0.42 + 0.58 * math.sin(math.pi * (0.12 + 0.76 * t)))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=gordo, segments=12, ring_count=7, location=(x, 0, z))
        b = bpy.context.object
        b.scale = (1.0, 0.92, 1.08)
        bpy.ops.object.transform_apply(scale=True)
        b.data.materials.append(piel if 0 < i < trozos - 1 else punta)
        suavizar(b)
        partes.append(b)
    o = unir('Platano', partes)
    o.location = (0, 0, 0)
    exportar('platano.glb')


def caparazon():
    """Caparazón de concha: cúpula de color (la tiñe la tele), panza blanca y borde marcado."""
    limpiar()
    concha = material('Detalle', (1.0, 0.16, 0.16), rugosidad=0.35)
    panza = material('Claro', (0.98, 0.97, 0.92), rugosidad=0.5)
    raya = material('Oscuro', (0.15, 0.10, 0.18))
    partes = []
    bpy.ops.mesh.primitive_uv_sphere_add(radius=10, segments=20, ring_count=12, location=(0, 0, 0))
    arriba = bpy.context.object
    arriba.scale = (1.0, 1.0, 0.78)
    bpy.ops.object.transform_apply(scale=True)
    arriba.data.materials.append(concha)
    suavizar(arriba)
    partes.append(arriba)
    # panza: una esfera un poco menor y más baja, que asoma por debajo
    bpy.ops.mesh.primitive_uv_sphere_add(radius=8.6, segments=18, ring_count=10, location=(0, 0, -2.6))
    abajo = bpy.context.object
    abajo.scale = (1.0, 1.0, 0.66)
    bpy.ops.object.transform_apply(scale=True)
    abajo.data.materials.append(panza)
    suavizar(abajo)
    partes.append(abajo)
    # el borde que separa las dos mitades
    bpy.ops.mesh.primitive_torus_add(major_radius=9.6, minor_radius=1.3, major_segments=22, minor_segments=8, location=(0, 0, -1.2))
    borde = bpy.context.object
    borde.data.materials.append(raya)
    suavizar(borde)
    partes.append(borde)
    # tres puntas en la cúpula, que es lo que lo hace gracioso
    for ang in (0, 120, 240):
        a = math.radians(ang)
        bpy.ops.mesh.primitive_cone_add(radius1=2.4, depth=5, vertices=10, location=(math.cos(a) * 4.6, math.sin(a) * 4.6, 6.4))
        c = bpy.context.object
        c.data.materials.append(panza)
        suavizar(c)
        partes.append(c)
    o = unir('Caparazon', partes)
    o.location = (0, 0, 0)
    exportar('caparazon.glb')


platano()
caparazon()
