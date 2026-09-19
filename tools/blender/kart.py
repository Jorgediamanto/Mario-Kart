# -*- coding: utf-8 -*-
"""
Modela el kart de Kart Party y lo exporta a public/modelos/kart.glb.

Se ejecuta con Blender sin abrir ventana:
    blender --background --python tools/blender/kart.py

Reglas del modelo (las respeta screen.js al cargarlo):
  - mira hacia +X, el suelo es z = 0, y mide unas 44 unidades de largo (las del juego);
  - los materiales se llaman por su papel, no por su color: `Carroceria` y `Detalle` se tiñen
    en el juego con el color y el acento de cada personaje; el resto se deja como está;
  - las cuatro ruedas son objetos sueltos llamados `RuedaDD`, `RuedaDI`, `RuedaTD`, `RuedaTI`
    (delantera/trasera, derecha/izquierda) para poder girarlas y hacerlas rodar.
Estilo: cabezón y regordete, con todo redondeado (bisel) — más dibujo animado que coche real.
"""
import bpy
import math

LARGO, ANCHO = 44.0, 28.0

def limpiar():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for bloque in (bpy.data.meshes, bpy.data.materials):
        for x in list(bloque):
            bloque.remove(x)

def material(nombre, color, metal=0.0, rugosidad=0.6):
    m = bpy.data.materials.get(nombre)
    if m:
        return m
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rugosidad
    return m

def bisel(obj, ancho=1.2, segmentos=2):
    mod = obj.modifiers.new('bisel', 'BEVEL')
    mod.width = ancho
    mod.segments = segmentos
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)
    return obj

def caja(nombre, tam, pos, mat, biselado=1.2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object
    o.name = nombre
    o.scale = (tam[0] / 2, tam[1] / 2, tam[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    if biselado:
        bisel(o, biselado)
    bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
    return o

def cilindro(nombre, radio, alto, pos, mat, eje='Y', vertices=14, biselado=0.5):
    bpy.ops.mesh.primitive_cylinder_add(radius=radio, depth=alto, location=pos, vertices=vertices)
    o = bpy.context.object
    o.name = nombre
    if eje == 'Y':
        o.rotation_euler[0] = math.radians(90)
    elif eje == 'X':
        o.rotation_euler[1] = math.radians(90)
    bpy.ops.object.transform_apply(rotation=True)
    o.data.materials.append(mat)
    if biselado:
        bisel(o, biselado, 1)
    bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
    return o

def esfera(nombre, radio, pos, mat, escala=(1, 1, 1), segs=12):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radio, location=pos, segments=segs, ring_count=segs // 2)
    o = bpy.context.object
    o.name = nombre
    o.scale = escala
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o

def unir(nombre, objetos):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objetos:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objetos[0]
    bpy.ops.object.convert(target='MESH')      # aplica los biseles
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = nombre
    return o

def main():
    limpiar()
    carroceria = material('Carroceria', (0.22, 1.0, 0.53))     # lo tiñe el juego
    detalle = material('Detalle', (1.0, 0.18, 0.58))           # lo tiñe el juego
    goma = material('Goma', (0.06, 0.06, 0.09), rugosidad=0.9)
    metal = material('Metal', (0.62, 0.64, 0.72), metal=0.8, rugosidad=0.35)
    oscuro = material('Oscuro', (0.10, 0.10, 0.16), rugosidad=0.7)

    partes = []
    # Las piezas se solapan a propósito (se funden en una sola forma) y los biseles son suaves: con
    # biseles grandes cada caja encoge, se separa de la de al lado y el kart parece un puzle suelto.
    # ---- bañera: ancha, bajita y redondeada ----
    partes.append(caja('banera', (34, 24, 14), (-2, 0, 9.5), carroceria, 2.0))
    # morro: sale de la bañera y baja hacia delante
    partes.append(caja('morro', (18, 20, 9), (14, 0, 7), carroceria, 2.0))
    partes.append(caja('punta', (7, 15, 7), (21, 0, 6.5), detalle, 1.6))
    # pontones laterales: por fuera de la bañera, lo que hace que parezca un kart
    for lado in (-1, 1):
        partes.append(caja('ponton', (26, 5.5, 8), (-2, lado * 11.0, 8), carroceria, 1.8))
    # motor detrás, con el alerón encima
    partes.append(caja('motor', (11, 18, 13), (-15, 0, 13), oscuro, 1.8))
    partes.append(caja('soporteAleron', (4, 14, 8), (-17, 0, 19), oscuro, 1.0))
    partes.append(caja('aleron', (9, 26, 3), (-18, 0, 23), detalle, 1.2))
    # asiento: base y respaldo, para que el piloto no flote
    partes.append(caja('asiento', (11, 14, 4), (-5, 0, 15), oscuro, 1.2))
    partes.append(caja('respaldo', (4, 14, 11), (-10, 0, 20), oscuro, 1.4))
    # torso del piloto (la cabeza es el emoji que pone la tele encima, a la altura 31)
    partes.append(esfera('torso', 5.0, (-5, 0, 21), carroceria, (0.9, 1.0, 0.95)))
    # parachoques delante y detrás
    partes.append(cilindro('parachoquesD', 2.8, 18, (23, 0, 4.5), detalle, 'Y', 12))
    partes.append(cilindro('parachoquesT', 2.6, 20, (-20, 0, 5.5), detalle, 'Y', 12))
    # escapes y volante
    for lado in (-1, 1):
        partes.append(cilindro('escape', 1.6, 7, (-21, lado * 6, 11), metal, 'X', 10, 0.25))
    partes.append(cilindro('volante', 4.0, 1.6, (4, 0, 18), oscuro, 'X', 14, 0.25))
    # faros: dos rendijas, no bolas
    for lado in (-1, 1):
        partes.append(caja('faro', (2.5, 5, 2.6), (21.5, lado * 5.5, 9.5), metal, 0.5))

    cuerpo = unir('Cuerpo', partes)
    cuerpo.location = (0, 0, 0)

    # ---- ruedas: gordas y con llanta de color ----
    def rueda(nombre, x, lado, radio, ancho_rueda):
        y = lado * (12.5 + ancho_rueda / 2 + 0.5)
        neumatico = cilindro('neu', radio, ancho_rueda, (x, y, radio), goma, 'Y', 16, 1.4)
        llanta = cilindro('llanta', radio * 0.52, ancho_rueda + 1.2, (x, y, radio), detalle, 'Y', 12, 0.5)
        tapa = cilindro('tapa', radio * 0.22, ancho_rueda + 2.0, (x, y, radio), detalle, 'Y', 10, 0.2)
        o = unir(nombre, [neumatico, llanta, tapa])
        # el origen, en el centro de la rueda: el juego la hace rodar y girar desde ahí
        bpy.context.scene.cursor.location = (x, y, radio)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        bpy.context.scene.cursor.location = (0, 0, 0)
        return o

    rueda('RuedaDD', 13.0, -1, 6.5, 6.0)
    rueda('RuedaDI', 13.0, 1, 6.5, 6.0)
    rueda('RuedaTD', -12.0, -1, 8.0, 8.0)
    rueda('RuedaTI', -12.0, 1, 8.0, 8.0)

    salida = bpy.path.abspath('//public/modelos/kart.glb')
    import os
    raiz = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    salida = os.path.join(raiz, 'public', 'modelos', 'kart.glb')
    bpy.ops.export_scene.gltf(filepath=salida, export_format='GLB', export_apply=True, export_yup=True)
    tris = sum(len(o.data.loop_triangles) for o in bpy.data.objects if o.type == 'MESH' and o.data.loop_triangles is not None)
    print('EXPORTADO', salida)

main()
