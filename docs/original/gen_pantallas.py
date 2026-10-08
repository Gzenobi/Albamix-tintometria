"""Genera pantallas simuladas del Albamix VB3 original (estilo Windows 3.x) con textos reales del .exe y datos reales."""
import json, sys, html, os

O = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(O, 'datos.json')))
G = json.load(open(os.path.join(O, 'golden.json')))

def ar(n, d=2):
    s = f"{n:,.{d}f}"
    return s.replace(',', 'X').replace('.', ',').replace('X', '.')

e = html.escape
CSS = """
body { margin: 0; padding: 24px; background: #008080; font-family: 'MS Sans Serif', 'Microsoft Sans Serif', Tahoma, Arial, sans-serif; font-size: 12px; }
.shot { display: inline-block; margin: 0 24px 28px 0; vertical-align: top; }
.cap { color: #fff; font: 12px Arial; margin: 0 0 6px; max-width: 760px; }
.sim { display: inline-block; background: #FFF5D1; color: #6b4a00; font: bold 11px Arial; padding: 1px 6px; border-radius: 3px; margin-right: 6px; }
.win { background: #C0C0C0; border: 2px solid; border-color: #DFDFDF #000 #000 #DFDFDF; box-shadow: inset -1px -1px #808080, inset 1px 1px #fff; display: inline-block; }
.tb { background: #000080; color: #fff; font-weight: bold; padding: 3px 4px; display: flex; align-items: center; gap: 6px; font-size: 12px; }
.tb .ctl { width: 16px; height: 14px; background: #C0C0C0; border: 1px solid; border-color: #fff #000 #000 #fff; color:#000; font-size: 9px; text-align:center; line-height: 12px; }
.tb .t { flex: 1; text-align: center; }
.body { padding: 10px; }
.btn { display: inline-block; background: #C0C0C0; border: 2px solid; border-color: #fff #000 #000 #fff; box-shadow: inset -1px -1px #808080; padding: 4px 10px; margin: 2px; font-family: 'Arial Narrow', Arial, sans-serif; font-size: 12px; min-width: 70px; text-align: center; }
.btn.def { outline: 1px solid #000; }
.btn.big { display: block; width: 260px; padding: 9px; margin: 6px auto; font-family: inherit; font-size: 13px; }
.fld { box-sizing: border-box; background: #fff; border: 2px solid; border-color: #808080 #fff #fff #808080; box-shadow: inset 1px 1px #000; padding: 2px 4px; display: inline-block; min-width: 60px; height: 16px; vertical-align: middle; }
.frame { border: 1px solid #808080; box-shadow: 1px 1px #fff, inset 1px 1px #fff; padding: 12px 8px 8px; margin: 10px 0 6px; position: relative; }
.frame > .lg { position: absolute; top: -8px; left: 8px; background: #C0C0C0; padding: 0 3px; }
.grid { background: #fff; border: 2px solid; border-color: #808080 #fff #fff #808080; box-shadow: inset 1px 1px #000; overflow: hidden; }
.grid table { border-collapse: collapse; font-size: 11px; }
.grid th { background: #C0C0C0; font-weight: normal; border: 1px solid; border-color: #fff #808080 #808080 #fff; padding: 2px 5px; white-space: nowrap; }
.grid td { border-right: 1px solid #C0C0C0; border-bottom: 1px solid #C0C0C0; padding: 2px 5px; white-space: nowrap; height: 14px; }
.grid td.n { text-align: right; }
.grid th.rh, .grid td.rh { background: #C0C0C0; border: 1px solid; border-color: #fff #808080 #808080 #fff; text-align: center; width: 22px; padding: 2px 2px; }
.grid tr.sel td { background: #000080; color: #fff; }
.row { display: flex; gap: 8px; align-items: center; margin: 4px 0; }
.lbl { min-width: 70px; }
.btnbar { margin-top: 8px; display: flex; flex-wrap: wrap; justify-content: center; }
.modal { position: relative; }
.msg { display: flex; gap: 14px; align-items: center; padding: 14px 18px 8px; }
.icon { width: 32px; height: 32px; border-radius: 50%; background: #fff; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font: bold 20px 'Times New Roman'; }
.icon.stop { background: #f00; color: #fff; }
.icon.q { color: #000080; }
.icon.i { color: #000080; font-style: italic; }
.splash { width: 520px; height: 260px; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; border: 2px solid #000; }
.splash .t1 { font: bold 40px Arial Black, Arial; letter-spacing: 2px; }
.splash .t2 { font: 14px Arial; }
.chk { display: inline-block; width: 11px; height: 11px; background: #fff; border: 1px solid #000; text-align: center; line-height: 11px; font-size: 10px; margin-right: 4px; }
"""

def win(title, body, w=None, close=True):
    st = f' style="width:{w}px"' if w else ''
    return f'<div class="win"{st}><div class="tb"><span class="ctl">▬</span><span class="t">{e(title)}</span>' + \
        ('<span class="ctl">▼</span><span class="ctl">▲</span>' if close else '') + f'</div><div class="body">{body}</div></div>'

def grid(headers, rows, sel=None, rowhdr=True, nums=(), height=None):
    h = ''.join(f'<th>{e(x)}</th>' for x in headers)
    out = [f'<tr>{"<th class=rh></th>" if rowhdr else ""}{h}</tr>']
    for i, r in enumerate(rows):
        cells = ''.join(f'<td class="{"n" if j in nums else ""}">{e(str(c))}</td>' for j, c in enumerate(r))
        out.append(f'<tr class="{"sel" if i == sel else ""}">{"<td class=rh>%d</td>" % (i + 1) if rowhdr else ""}{cells}</tr>')
    st = f' style="height:{height}px"' if height else ''
    return f'<div class="grid"{st}><table>{"".join(out)}</table></div>'

def btns(*names, default=None):
    return '<div class="btnbar">' + ''.join(f'<span class="btn{" def" if n == default else ""}">{e(n)}</span>' for n in names) + '</div>'

def msgbox(title, text, icon='i', buttons=('Aceptar',)):
    ic = {'i': ('i', 'i'), 'q': ('q', '?'), 'stop': ('stop', '✕'), 'w': ('q', '!')}[icon]
    body = f'<div class="msg"><div class="icon {ic[0]}">{ic[1]}</div><div>{text}</div></div>' + btns(*buttons, default=buttons[0])
    return win(title, body, close=False)

shots = []
def shot(id_, caption, content):
    shots.append((id_, f'<div class="shot" id="{id_}"><p class="cap"><span class="sim">Pantalla simulada</span>{caption}</p>{content}</div>'))

# 1. Splash
shot('p01-inicio', '1. Pantalla de inicio (FrmSplash). Mientras se ve, abre las 5 bases de ..\\bases\\.',
     win('Albamix - Sistema Industrial', '<div class="splash"><div class="t1">ALBAMIX</div><div class="t2">Sistema Industrial</div><div class="t2" style="color:#555">Abriendo bases de datos…</div></div>', close=False))

# 2. Menú
menu = ''.join(f'<span class="btn big">{e(x)}</span>' for x in ['Productos', 'Fórmulas', 'Dosificar fórmula', 'Bonificaciones y Rentabilidad', 'Salir'])
shot('p02-menu', '2. Menú inicial (FrmMenuInicial). Botones reales del ejecutable; la distribución exacta es reconstruida.',
     win('Albamix - Sistema Industrial', f'<div style="width:330px;padding:8px 0">{menu}</div>'))

# 3. Productos
prows = []
for p in D['prod'][:20]:
    prows.append([p['Tipo'], p['Código'], p['Nombre'], ar(float(p['Peso Esp.'])), ar(float(p['Precio 1'])), ar(float(p['Capa. 1'])),
                  ar(float(p['Precio 2'])), ar(float(p['Capa. 2'])), p['Unidad'], p['Bonif.'], p['Rentab.']])
shot('p03-productos', '3. Lista de productos (frmProductos). Columnas y datos reales: son los mismos del archivo PESO_ESP que exporta esta grilla.',
     win('Productos', grid(['Tipo', 'Código', 'Nombre', 'Peso Esp.', 'Precio 1', 'Capa. 1', 'Precio 2', 'Capa. 2', 'Unidad', 'Bonif.', 'Rentab.'],
                           prows, sel=0, nums=(3, 4, 5, 6, 7, 9, 10)) +
         btns('Ordenar(F3)', 'Ordenar(F4)', 'Agregar (F5)', 'Borrar (F7)', 'Modificar (F8)', 'Imprimir (F9)', 'Excel (F10)', 'Salir (ESC)')))

# 4. Producto (edición)
p = next(x for x in D['prod'] if x['Código'] == '4510000')
cap_rows = [[ar(float(p['Capa. 1'])), 'Litros', ar(float(p['Precio 1']))], [ar(float(p['Capa. 2'])), 'Litros', ar(float(p['Precio 2']))]]
prod_body = f'''
<div class="row"><span class="lbl">Código:</span><span class="fld" style="width:90px">{p['Código']}</span></div>
<div class="row"><span class="lbl">Nombre:</span><span class="fld" style="width:300px">{e(p['Nombre'])}</span></div>
<div class="row"><span class="lbl">Tipo:</span><span class="fld" style="width:120px">Base ▾</span><span class="lbl" style="margin-left:20px">Peso esp.:</span><span class="fld">{ar(float(p['Peso Esp.']))}</span></div>
<div class="frame"><span class="lg">Capacidades</span>{grid(['Capacidad', 'Unidad', 'Precio'], cap_rows, nums=(0, 2))}</div>
<div class="frame"><span class="lg">Bonificación y rentabilidad</span>
  <div class="row"><span class="lbl">Bonificación:</span><span class="fld">0</span><span class="lbl" style="margin-left:16px">Rentabilidad:</span><span class="fld">0</span><span class="btn" style="min-width:40px">🔒</span></div></div>
{btns('Aceptar', 'Cancelar', default='Aceptar')}'''
shot('p04-producto', '4. Alta / edición de producto (frmProducto). El candado (CmdBloqueo) pide la clave para tocar bonificación y rentabilidad.',
     win('Producto', prod_body, w=460))

# 5. Seleccionar fórmulas
shot('p05-selfo', '5. Seleccionar fórmulas (frmSelFormulas): elige qué base de fórmulas abrir.',
     win('Seleccionar fórmulas', '<div style="width:300px">' + ''.join(f'<span class="btn big">{x}</span>' for x in ['Fórmulas Albamix', 'Fórmulas Personales']) + '</div>'))

# 6. Búsqueda
bus = '''
<div class="frame"><span class="lg">Por código</span><div class="row"><span>Desde:</span><span class="fld">1000</span><span style="margin-left:14px">Hasta:</span><span class="fld">1003</span></div></div>
<div class="frame"><span class="lg">Por nombre</span><div class="row"><span>Contiene:</span><span class="fld" style="width:180px"></span></div></div>
<div class="frame"><span class="lg"><span class="chk"></span>Por fecha</span>
 <div class="row"><span style="width:50px">Desde:</span>Día<span class="fld" style="min-width:24px"></span>Mes<span class="fld" style="min-width:24px"></span>Año<span class="fld" style="min-width:36px"></span></div>
 <div class="row"><span style="width:50px">Hasta:</span>Día<span class="fld" style="min-width:24px"></span>Mes<span class="fld" style="min-width:24px"></span>Año<span class="fld" style="min-width:36px"></span></div></div>''' + btns('Buscar', 'Cancelar', default='Buscar')
shot('p06-busqueda', '6. Búsqueda de fórmulas (frmBusFormulas). Ejemplo: códigos 1000 a 1003.', win('Búsqueda de fórmulas', bus, w=340))

# 7. Lista de fórmulas
frows = []
for c, n, f, ls in D['form']:
    r = [c, n, '/'.join(reversed(f.split('-')))]
    for comp, cant in ls[:5]:
        r += [comp, ar(float(cant))]
    r += [''] * (13 - len(r))
    frows.append(r)
heads = ['Código', 'Nombre', 'Fecha'] + sum([[f'Comp. {i}', f'Cant. {i}'] for i in range(1, 6)], [])
shot('p07-formulas', '7. Lista de fórmulas Albamix (frmFormulas). Datos reales de albamix.mdb: un mismo código de color tiene una fórmula por cada base.',
     win('Fórmulas Albamix', grid(heads, frows, sel=0, nums=(4, 6, 8, 10, 12)) +
         btns('Buscar (F2)', 'Ordenar (F3)', 'Ordenar (F4)', 'Agregar (F5)', 'Borrar (F7)', 'Editar (F8)', 'Imprimir (F9)', 'Excel (F10)', 'Dosificar(F12)', 'Salir (ESC)')))

# 8. Edición de fórmula
caso = G['casos'][0]
cat = {c['codigo']: c for c in G['componentes']}
tipo = {'B': 'Base', 'C': 'Colorante', 'A': 'Accesorio'}
crow = []
for rg in caso['renglones']:
    k = cat[rg['comp']]; pl = k['envases'][0]['precio'] / k['envases'][0]['capacidad']
    crow.append([tipo[k['tipo']], rg['comp'], k['nombre'], ar(rg['cant'] / 1000 * k['pesoEspecifico'] * 1000 / 1000, 3), ar(rg['cant']), ar(pl)])
form_body = f'''
<div class="row"><span>Color:</span><span class="fld" style="width:60px">{caso['codigo']}</span><span class="fld" style="width:240px">{e(caso['nombre'])}</span></div>
<div class="frame"><span class="lg">Componentes</span>{grid(['Tipo', 'Código', 'Nombre', 'Kilos', 'miliLitros', 'pesos/litro'], crow, nums=(3, 4, 5))}
 {btns('Insertar (F6)', 'Agregar (F5)', 'Editar (F8)', 'Borrar (F7)')}</div>
<div style="display:flex;gap:10px">
 <div class="frame" style="flex:1"><span class="lg">Capacidades</span>{grid(['Capacidad', 'Unidad'], [['3,765', 'Litros'], ['18,824', 'Litros']], nums=(0,))}{btns('Insertar (F6)', 'Agregar (F5)', 'Borrar (F7)')}</div>
 <div class="frame" style="flex:1"><span class="lg">Observaciones</span><span class="fld" style="width:100%;height:60px;display:block"></span></div></div>
{btns('Aceptar', 'Cancelar', default='Aceptar')}'''
shot('p08-formula', '8. Alta / edición de fórmula (frmFormula). RAL 1012 del sistema Concentrados (fórmula recuperada de albamix.mdb). La base va primero y todo suma 1000 c.c.',
     win('Fórmula', form_body, w=640))

# 9. Validación (mensajes reales)
shot('p09-validacion', '9. Mensajes reales de validación al aceptar una fórmula (frmFormula.validarDatos).',
     '<div style="display:flex;gap:16px;flex-wrap:wrap">' +
     msgbox('Albamix', 'Las cantidades de componentes deben totalizar 1000 c.c.<br>Actualmente totalizan : 999,99 c.c.', 'stop') +
     msgbox('Albamix', 'Ya existe una fórmula para el mismo color y la misma base !<br>Crear una nueva ?', 'q', ('Sí', 'No')) +
     msgbox('Albamix', 'El nombre de color no se corresponde con el código !<br>Nombres existentes para ese código:<br>RAL 1012<br>Continúa con el nuevo nombre?', 'w', ('Sí', 'No')) + '</div>')

# 10. Dosificación
cap = 3.2 / 0.85
drows, tg, tm = [], 0, 0
cost = cat[caso['renglones'][0]['comp']]['envases'][0]['precio']
for rg in caso['renglones']:
    k = cat[rg['comp']]; ml = rg['cant'] * cap; g = ml * k['pesoEspecifico']; tg += g; tm += ml
    if k['tipo'] != 'B': cost += ml / 1000 * k['envases'][0]['precio'] / k['envases'][0]['capacidad']
    drows.append([tipo[k['tipo']], rg['comp'], k['nombre'], ar(g, 1), ar(ml, 1)])
precio = round(cost * 1.31842, 2)
dos_body = f'''
<div class="row"><span style="width:60px">Calidad:</span><span class="fld" style="width:320px">{e(cat[caso['renglones'][0]['comp']]['nombre'])}</span></div>
<div class="row"><span style="width:60px">Color:</span><span class="fld" style="width:60px">{caso['codigo']}</span><span class="fld" style="width:254px">{e(caso['nombre'])}</span></div>
<div class="row"><span style="width:60px">Obs.:</span><span class="fld" style="width:320px"></span></div>
<div class="row" style="margin-top:8px"><span>Capacidad a dosificar:</span><span class="fld" style="width:120px">3,765 Litros ▾</span></div>
<div class="frame"><span class="lg">Componentes:</span>{grid(['Tipo', 'Código', 'Nombre', 'Gramos', 'miliLitros'], drows, nums=(3, 4))}</div>
<div class="frame"><span class="lg">Totales</span>{grid(['Total', 'Gramos', 'miliLitros'], [['Total', ar(tg, 1), ar(tm, 1)]], rowhdr=False, nums=(1, 2))}
 <div class="row" style="margin-top:6px;font-weight:bold">Precio :&nbsp;&nbsp;&nbsp;$&nbsp;&nbsp;{ar(precio)}</div></div>
{btns('Imprimir (F9)', 'Salir (ESC)')}'''
shot('p10-dosificar', f'10. Dosificación de fórmula (frmDosificar). RAL 1012 en lata de 3,2 L (rinde 3,765 L). Precio {ar(precio)}: igual a la lista real EXPORT.CSV.',
     win('Dosificación de fórmula', dos_body, w=520))

# 11. Clave + Bonif/Rent
clave = '<div class="row" style="padding:6px 4px"><span>Ingrese la clave:</span><span class="fld" style="width:140px">********</span></div>' + btns('Aceptar', 'Cancelar', 'Cambiar Clave', default='Aceptar')
bon = ''.join(f'<div class="row"><span class="lbl" style="min-width:90px">{x}</span><span class="fld" style="width:70px;text-align:right">{v}</span> %</div>'
              for x, v in [('Global:', '0'), ('Bases:', '0'), ('Colorantes:', '0'), ('Accesorios:', '0')])
bon = f'<div class="frame"><span class="lg">Rentabilidad</span>{bon}</div>' + btns('Aceptar', 'Cancelar', default='Aceptar')
shot('p11-clave-rentab', '11. Clave de seguridad (FrmIngCl) y Bonificaciones y Rentabilidad (frmBonifRent). Los valores reales de rentabilidad no los tenemos (falta rentabil.mdb).',
     '<div style="display:flex;gap:16px;align-items:flex-start">' + win('Clave de Seguridad', clave, close=False) + win('Bonificaciones y Rentabilidad', bon, w=260) + '</div>')

# 12. Salir
shot('p12-salir', '12. Al salir del programa.', msgbox('Albamix', 'Salir del programa ?', 'q', ('Sí', 'No')))

page = f'<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><title>Albamix original: pantallas simuladas</title><style>{CSS}</style></head><body>' + \
       '<p class="cap" style="font-size:14px;max-width:none"><b>Pantallas simuladas</b> del Albamix original (VB3). Textos, botones y columnas tomados del ejecutable; datos reales de las bases y listas. La disposición de los controles es una reconstrucción: no son capturas reales.</p>' + \
       ''.join(s for _, s in shots) + '</body></html>'
open(os.path.join(O, 'pantallas.html'), 'w').write(page)
json.dump([i for i, _ in shots], open(os.path.join(O, 'ids.json'), 'w'))
print('ok', len(shots), 'precio', precio)
