# -*- coding: utf-8 -*-
"""
Modela las cabezas de los siete personajes y las exporta a public/modelos/cabezas.glb.

    blender --background --python tools/blender/personajes.py

Sale un objeto por personaje, con el nombre que usa `CHARS` en public/sim.mjs: `Loco`, `Chuma`,
`Toro`, `Diamanto`, `Leini`, `Carlota` y `Scarlet`. Todas miran hacia **+X** (como el kart), están
centradas en el origen y miden unas 20 unidades de ancho, para que la tele solo tenga que ponerlas
encima del asiento.

Los materiales llevan su color puesto aquí: la tele los convierte a «toon» respetando ese color,
salvo `Carroceria` y `Detalle`, que son los que se tiñen con el color de cada jugador.
"""
import bpy
import math
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SALIDA = os.path.join(RAIZ, 'public', 'modelos')
R = 9.0     # radio de la cabeza


def limpiar():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for bloque in (bpy.data.meshes, bpy.data.materials):
        for x in list(bloque):
            bloque.remove(x)


MATS = {}


def material(nombre, color, rugosidad=0.6):
    if nombre in MATS:
        return MATS[nombre]
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1.0)
    b.inputs['Roughness'].default_value = rugosidad
    MATS[nombre] = m
    return m


def suave(o, angulo=50):
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.shade_auto_smooth(angle=math.radians(angulo))
    return o


def esfera(radio, pos, mat, escala=(1, 1, 1), segs=16, plano=False):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radio, location=pos, segments=segs, ring_count=max(6, segs // 2))
    o = bpy.context.object
    o.scale = escala
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    if not plano:
        suave(o)
    return o


def ico(radio, pos, mat, escala=(1, 1, 1), sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=radio, location=pos, subdivisions=sub)
    o = bpy.context.object
    o.scale = escala
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    return o


def cil(radio, alto, pos, mat, eje='Z', vertices=12, rot=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=radio, depth=alto, location=pos, vertices=vertices)
    o = bpy.context.object
    if eje == 'X':
        o.rotation_euler[1] = math.radians(90)
    elif eje == 'Y':
        o.rotation_euler[0] = math.radians(90)
    if rot:
        o.rotation_euler[1] += rot
    bpy.ops.object.transform_apply(rotation=True)
    o.data.materials.append(mat)
    return suave(o)


def cono(radio, alto, pos, mat, rotY=0.0, rotX=0.0, vertices=10):
    bpy.ops.mesh.primitive_cone_add(radius1=radio, depth=alto, location=pos, vertices=vertices)
    o = bpy.context.object
    o.rotation_euler[1] = rotY
    o.rotation_euler[0] = rotX
    bpy.ops.object.transform_apply(rotation=True)
    o.data.materials.append(mat)
    return suave(o)


def caja(tam, pos, mat, biselado=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.scale = (tam[0] / 2, tam[1] / 2, tam[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    if biselado:
        mod = o.modifiers.new('bisel', 'BEVEL')
        mod.width = biselado
        mod.segments = 2
        mod.limit_method = 'ANGLE'
    return suave(o)


def unir(nombre, partes):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in partes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = partes[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = nombre
    return o


def cara(piel, ojos='#141420', ancho=1.0, boca=True):
    """La base común: cabezón redondo, dos ojos y una sonrisa. Mira hacia +X."""
    negro = material('Ojo', (0.07, 0.07, 0.10))
    blanco = material('Blanco', (0.97, 0.97, 0.99))
    partes = [esfera(R, (0, 0, 0), piel, (0.95, ancho, 1.0))]
    for lado in (-1, 1):
        partes.append(esfera(2.3, (R * 0.72, lado * 3.4, 2.0), blanco, (0.6, 1.0, 1.0)))
        partes.append(esfera(1.35, (R * 0.86, lado * 3.6, 2.0), negro, (0.6, 1.0, 1.0)))
    if boca:
        partes.append(caja((1.6, 6.2, 1.4), (R * 0.80, 0, -3.4), negro, 0.5))
    return partes


def exportar():
    bpy.ops.export_scene.gltf(filepath=os.path.join(SALIDA, 'cabezas.glb'), export_format='GLB',
                              export_apply=True, export_yup=True)
    print('EXPORTADO cabezas.glb')


def main():
    limpiar()
    pielClara = material('PielClara', (0.98, 0.80, 0.66))
    pielMorena = material('PielMorena', (0.55, 0.35, 0.22))
    rubio = material('Rubio', (0.98, 0.83, 0.32))
    castano = material('Castano', (0.35, 0.20, 0.10))
    negro = material('Ojo', (0.07, 0.07, 0.10))
    blanco = material('Blanco', (0.97, 0.97, 0.99))
    rojo = material('Rojo', (0.85, 0.15, 0.15))
    naranja = material('Brasa', (1.0, 0.45, 0.05))
    pardo = material('PeloToro', (0.28, 0.16, 0.10))
    hueso = material('Hueso', (0.92, 0.90, 0.82))
    oro = material('Oro', (0.95, 0.75, 0.20), 0.3)
    hielo = material('Hielo', (0.60, 0.92, 1.0), 0.15)
    verde = material('Verde', (0.22, 1.0, 0.53))

    todos = []

    # ---- El Loco: cabeza rapada y un cigarro del que sale humo (el humo lo pone la tele) ----
    p = cara(pielClara)
    for lado in (-1, 1):   # cejas de loco, muy marcadas
        p.append(caja((1.2, 4.4, 1.3), (R * 0.78, lado * 3.4, 4.6), negro, 0.4))
    p.append(esfera(R * 0.98, (-0.6, 0, 0.6), material('Rapado', (0.35, 0.30, 0.28)), (0.92, 0.98, 0.9)))  # sombra del pelo rapado
    p.append(cil(0.85, 7.0, (R * 0.95, -2.2, -3.6), blanco, 'X'))                 # el cigarro
    p.append(cil(0.9, 1.1, (R * 0.95 + 3.6, -2.2, -3.6), naranja, 'X'))           # la brasa
    todos.append(unir('Loco', p))

    # ---- Chuma: turbante y barba corta ----
    p = cara(pielMorena)
    p.append(esfera(R * 0.88, (-0.4, 0, R * 0.70), verde, (1.04, 1.04, 0.60)))     # turbante (base)
    p.append(cil(R * 0.84, 3.0, (-0.2, 0, R * 0.50), verde, 'Z', 18))              # vuelta del turbante
    p.append(esfera(1.9, (R * 0.55, 0, R * 1.05), oro))                            # broche
    p.append(esfera(R * 0.8, (R * 0.30, 0, -R * 0.55), negro, (0.85, 0.8, 0.5)))   # barba corta
    todos.append(unir('Chuma', p))

    # ---- Toro: morro, cuernos, orejas y anilla en la nariz ----
    p = [esfera(R, (0, 0, 0), pardo, (0.95, 1.0, 0.95))]
    for lado in (-1, 1):
        p.append(esfera(2.2, (R * 0.62, lado * 3.6, 2.6), blanco, (0.6, 1.0, 1.0)))
        p.append(esfera(1.3, (R * 0.76, lado * 3.8, 2.6), negro, (0.6, 1.0, 1.0)))
        # cuerno: un cono tumbado hacia fuera y arriba
        p.append(cono(2.1, 8.0, (R * 0.12, lado * (R * 0.82), R * 0.72), hueso, rotX=lado * math.radians(55)))
        p.append(esfera(2.6, (-R * 0.2, lado * (R * 0.92), 0.6), pardo, (0.7, 0.5, 1.0)))   # oreja
    p.append(esfera(5.2, (R * 0.72, 0, -2.6), hueso, (0.8, 1.0, 0.8)))            # morro
    for lado in (-1, 1):
        p.append(esfera(1.0, (R * 1.02, lado * 1.8, -2.2), negro, (0.5, 1.0, 1.0)))  # fosas nasales
    anilla = cil(2.0, 0.8, (R * 1.05, 0, -5.2), oro, 'X', 14)
    p.append(anilla)
    todos.append(unir('Toro', p))

    # ---- Diamanto: una cabeza de diamante, con facetas y todo ----
    p = [ico(R * 1.05, (0, 0, 0), hielo, (0.95, 0.95, 1.05), 1)]
    p.append(cono(R * 0.95, R * 1.1, (0, 0, -R * 0.85), hielo, vertices=8))       # la punta de abajo
    for lado in (-1, 1):
        p.append(esfera(1.5, (R * 0.80, lado * 3.2, 1.8), negro, (0.5, 1.0, 1.0)))
    p.append(esfera(2.2, (R * 0.5, 0, R * 0.95), blanco, (1.0, 1.0, 0.5)))        # brillo en lo alto
    todos.append(unir('Diamanto', p))

    # ---- Leini: melena rubia larga ----
    p = cara(pielClara)
    p.append(esfera(R * 0.99, (-2.2, 0, 1.4), rubio, (0.92, 1.06, 1.0)))          # pelo por detrás y arriba
    for lado in (-1, 1):                                                          # dos mechones largos
        p.append(caja((5.0, 3.4, 15.0), (-R * 0.30, lado * (R * 0.80), -R * 0.75), rubio, 1.4))
    p.append(caja((5.0, 13.0, 4.2), (R * 0.52, 0, R * 0.74), rubio, 1.4))         # flequillo
    todos.append(unir('Leini', p))

    # ---- Carlota: la pequeñaja, rubia con dos coletas ----
    p = cara(pielClara, ancho=1.02)
    p.append(esfera(R * 0.98, (-2.0, 0, 1.8), rubio, (0.92, 1.04, 0.98)))
    p.append(caja((5.0, 12.0, 4.0), (R * 0.52, 0, R * 0.72), rubio, 1.4))         # flequillo
    for lado in (-1, 1):
        p.append(esfera(3.6, (-R * 0.1, lado * (R * 1.02), R * 0.35), rubio))     # coletas
        p.append(cil(1.4, 1.6, (-R * 0.1, lado * (R * 0.86), R * 0.35), rojo, 'Y', 10))  # gomas
    todos.append(unir('Carlota', p))

    # ---- Scarlet: melena castaña ----
    p = cara(pielClara)
    p.append(esfera(R * 0.99, (-2.2, 0, 1.4), castano, (0.92, 1.06, 1.0)))
    for lado in (-1, 1):
        p.append(caja((4.4, 3.2, 11.0), (-R * 0.28, lado * (R * 0.80), -R * 0.42), castano, 1.3))
    p.append(caja((5.0, 13.0, 4.2), (R * 0.52, 0, R * 0.74), castano, 1.4))
    todos.append(unir('Scarlet', p))

    for o in todos:
        o.location = (0, 0, 0)
    exportar()


main()
