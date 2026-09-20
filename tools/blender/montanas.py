# -*- coding: utf-8 -*-
"""
Modela las montañas del fondo y las exporta a public/modelos/montanas.glb.

    blender --background --python tools/blender/montanas.py

Sale un solo .glb con **un objeto por tipo de montaña** (`Pico`, `PicoDoble`, `Meseta`, `Aguja`,
`Macizo`, `Colina`), todos con el origen en la base y centrados en (0, 0): la tele los planta por
el mapa con una malla instanciada, así que sesenta montañas cuestan un dibujado, no sesenta.

Reglas de siempre: los materiales se llaman por su papel, no por su color. Aquí hay dos, `Roca` y
`Nieve`, y la tele los tiñe según el bioma por el que caiga la montaña (la jungla las quiere
verdes, la mina marrones, el hielo blancas…). Cada montaña se hace con anillos de vértices a los
que se les mete ruido: caras planas y pocas, que es lo que pide el estilo de dibujo animado — y lo
que aguanta que se dibujen ocho veces, una por panel.

Tamaños: la base mide unas 600 unidades de ancho y la altura va entre 380 y 900. En el juego se
escalan entre 0,8 y 2,6, así que la más grande pasa de 2.000 unidades: desde la carretera se ven
como una cordillera de verdad.
"""
import bpy
import math
import os
import random

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SALIDA = os.path.join(RAIZ, 'public', 'modelos')


def limpiar():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for bloque in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for x in list(bloque):
            bloque.remove(x)


def material(nombre, color, rugosidad=0.85):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rugosidad
    m.diffuse_color = (*color, 1.0)
    return m


def montana(nombre, semilla, alto, radio, lados=9, anillos=5, nieve=0.72,
            punta=0.10, ruido=0.22, ladeo=0.0, cumbres=((0.0, 0.0, 1.0),)):
    """Una montaña de anillos: `cumbres` son (dx, dy, altura relativa) de cada pico.

    Con una cumbre sale un pico normal; con dos, una montaña de dos picos. `punta` es lo afilada
    que queda arriba, `ruido` lo rota que sale la silueta y `ladeo` la inclina (para las agujas).
    """
    rnd = random.Random(semilla)
    verts, caras, indices = [], [], []
    for (cx, cy, ch) in cumbres:
        base = len(verts)
        cima = alto * ch
        for a in range(anillos + 1):
            t = a / anillos
            # el perfil: ancho abajo y afilado arriba (t**1.6 abre la falda y estrecha la punta)
            r = radio * (1.0 - t) ** (0.6 + punta * 4) if a < anillos else 0.0
            z = cima * (t ** 1.15)
            if a == anillos:
                verts.append((cx + rnd.uniform(-1, 1) * radio * 0.05 + ladeo * cima,
                              cy + rnd.uniform(-1, 1) * radio * 0.05, z))
                break
            for v in range(lados):
                ang = 2 * math.pi * v / lados + t * 0.35
                rr = r * (1.0 + rnd.uniform(-ruido, ruido) * (0.35 + t))
                zz = z + rnd.uniform(-1, 1) * alto * 0.035 * (0.2 + t)
                verts.append((cx + math.cos(ang) * rr + ladeo * zz,
                              cy + math.sin(ang) * rr, max(0.0, zz)))
        cumbre_idx = len(verts) - 1
        for a in range(anillos):
            for v in range(lados):
                v2 = (v + 1) % lados
                alta = (a + 1) / anillos >= nieve
                if a == anillos - 1:
                    caras.append((base + a * lados + v, base + a * lados + v2, cumbre_idx))
                else:
                    caras.append((base + a * lados + v, base + a * lados + v2,
                                  base + (a + 1) * lados + v2, base + (a + 1) * lados + v))
                indices.append(1 if alta else 0)
        # la tapa de abajo, para que no se vea hueca desde un salto
        caras.append(tuple(base + v for v in range(lados - 1, -1, -1)))
        indices.append(0)

    me = bpy.data.meshes.new(nombre)
    me.from_pydata(verts, [], caras)
    me.update()
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(bpy.data.materials['Roca'])
    ob.data.materials.append(bpy.data.materials['Nieve'])
    for cara, idx in zip(me.polygons, indices):
        cara.material_index = idx
        cara.use_smooth = False
    return ob


def exportar(nombre):
    bpy.ops.export_scene.gltf(filepath=os.path.join(SALIDA, nombre), export_format='GLB',
                              export_apply=True, export_yup=True)
    print('EXPORTADO', nombre)


limpiar()
material('Roca', (0.38, 0.33, 0.30))
material('Nieve', (0.95, 0.96, 1.0), rugosidad=0.6)

# el pico de postal: alto, afilado y con nieve en lo alto
montana('Pico', 11, alto=760, radio=300, nieve=0.70, punta=0.12)
# dos cumbres pegadas, una más baja: rompe la fila cuando hay muchas seguidas
montana('PicoDoble', 12, alto=620, radio=250, nieve=0.76, punta=0.10,
        cumbres=((-120, 40, 1.0), (150, -60, 0.72)))
# la meseta: plana arriba, como las del oeste; sin nieve
montana('Meseta', 13, alto=380, radio=320, anillos=4, nieve=1.5, punta=0.02, ruido=0.14)
# la aguja: fina, altísima y torcida, para el bioma del hielo y el del cielo
montana('Aguja', 14, alto=900, radio=170, lados=7, nieve=0.55, punta=0.22, ladeo=0.10)
# el macizo: ancho y tumbado, el que hace de pared al fondo
montana('Macizo', 15, alto=480, radio=420, lados=11, anillos=6, nieve=0.88, punta=0.05, ruido=0.28,
        cumbres=((-180, -60, 0.9), (60, 120, 1.0), (240, -40, 0.66)))
# la colina: un montoncillo redondo para meter entre las grandes
montana('Colina', 16, alto=240, radio=260, lados=9, anillos=4, nieve=1.5, punta=0.02, ruido=0.18)
exportar('montanas.glb')
