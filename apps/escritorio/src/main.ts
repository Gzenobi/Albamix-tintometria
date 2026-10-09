import {
  avisarCantidadesChicas, calcularPrecio, crearCatalogo, dosificarEnCapacidad, dosificarEnEnvase,
  type Catalogo, type Componente, type Dosificacion, type Formula,
} from '@albamix/core';
import {
  aplicarListaPrecios, BaseLocal, importarOriginales, leerListaPrecios, MotorSqlJs,
  type FiltroBusqueda, type ListaPrecios, type ResultadoAplicacion,
} from '@albamix/datos';
import { CONFIG_INICIAL, guardar, leer, type Configuracion } from './almacen.js';

// ---------- utilidades ----------
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const nf = (n: number, d = 2) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const fechaAr = (f?: string | null) => (f ? f.split('-').reverse().join('/') : '');
const ubicarWasm = (archivo: string) => `./${archivo}`;

async function ocupado<T>(f: () => Promise<T>): Promise<T> {
  $('ocupado').hidden = false;
  await new Promise((r) => setTimeout(r, 30));
  try { return await f(); } finally { $('ocupado').hidden = true; }
}

// ---------- estado ----------
let motor: MotorSqlJs;
let base: BaseLocal;
let catalogo: Catalogo = crearCatalogo([]);
let config: Configuracion = { ...CONFIG_INICIAL };

async function persistir() { await guardar('base', motor.exportar()); }
function recargarCatalogo() { catalogo = crearCatalogo(base.componentes()); }

// ---------- navegación ----------
function ver(v: 'inicio' | 'buscar' | 'dosificar' | 'datos') {
  for (const s of ['inicio', 'buscar', 'dosificar', 'datos']) $('v-' + s).hidden = s !== v;
  document.querySelectorAll<HTMLButtonElement>('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'datos') pintarDatos();
}
$('nav').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-v]');
  if (!b) return;
  if (base.cantidadFormulas() === 0 && b.dataset.v !== 'datos') return ver('inicio');
  ver(b.dataset.v as 'buscar');
});

// ---------- búsqueda ----------
const filtro: FiltroBusqueda = { orden: 'codigo' };
function seg(id: string, attr: string, alCambiar: (v: string) => void) {
  $(id).addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    $(id).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    alCambiar(b.getAttribute(attr) ?? '');
  });
}
seg('sis', 'data-s', (v) => { filtro.sistema = (v || undefined) as FiltroBusqueda['sistema']; buscar(); });
seg('ori', 'data-o', (v) => { filtro.origen = (v || undefined) as FiltroBusqueda['origen']; buscar(); });
seg('sentido', 'data-d', (v) => { filtro.descendente = v === '1'; buscar(); });

function poblarProductos() {
  const bases = base.componentes().filter((c) => c.tipo === 'B').sort((a, b) => a.nombre.localeCompare(b.nombre));
  $('fb').innerHTML = '<option value="">Todos los productos</option>' + bases.map((c) => `<option value="${c.codigo}">${esc(c.nombre)}</option>`).join('');
}

function buscar() {
  const num = (id: string) => { const v = $<HTMLInputElement>(id).value; return v ? Number(v) : undefined; };
  const str = (id: string) => $<HTMLInputElement>(id).value || undefined;
  const f: FiltroBusqueda = {
    ...filtro, texto: $<HTMLInputElement>('q').value, base: num('fb'),
    codigoDesde: num('cd'), codigoHasta: num('ch'), fechaDesde: str('fd'), fechaHasta: str('fh'),
    orden: $<HTMLSelectElement>('orden').value as FiltroBusqueda['orden'],
  };
  const { total, filas } = base.buscar(f);
  const hayFiltro = !!(f.texto || f.base || f.codigoDesde || f.codigoHasta || f.fechaDesde || f.fechaHasta || f.sistema || f.origen);
  $('cuenta').textContent = hayFiltro ? `${total.toLocaleString('es-AR')} fórmulas${total > filas.length ? `, se muestran ${filas.length}` : ''}` : `${total.toLocaleString('es-AR')} fórmulas`;
  $('res').innerHTML = filas.map((r) => `<tr tabindex="0" data-id="${r.id}"><td class="cod num">${r.codigo}</td>
      <td>${esc(r.nombre)}${r.origen === 'personal' ? ' <span class="personal">personal</span>' : ''}</td>
      <td>${esc(r.baseNombre ?? String(r.base))}</td><td class="fecha num">${fechaAr(r.fecha)}</td></tr>`).join('')
    || `<tr><td colspan="4" class="vacio">Ningún color coincide con esos filtros. Probá con el código o con una parte del nombre.</td></tr>`;
}
for (const id of ['q', 'cd', 'ch', 'fd', 'fh']) $(id).addEventListener('input', buscar);
for (const id of ['fb', 'orden']) $(id).addEventListener('change', buscar);
$('b-mas').addEventListener('click', () => { const m = $('mas-filtros'); m.hidden = !m.hidden; $('b-mas').textContent = m.hidden ? 'Más filtros' : 'Menos filtros'; });
$('b-limpiar').addEventListener('click', () => {
  for (const id of ['q', 'cd', 'ch', 'fd', 'fh']) $<HTMLInputElement>(id).value = '';
  $<HTMLSelectElement>('fb').value = ''; $<HTMLSelectElement>('orden').value = 'codigo';
  buscar();
});
const elegir = (tr: HTMLElement | null) => { const id = tr?.dataset.id; if (id) abrirDosificar(Number(id)); };
$('res').addEventListener('click', (e) => elegir((e.target as HTMLElement).closest('tr')));
$('res').addEventListener('keydown', (e) => { if (e.key === 'Enter') elegir((e.target as HTMLElement).closest('tr')); });

// ---------- dosificación ----------
interface PasoPlan { i: number; g: number; extra: boolean; acum: number }
let formula: Formula | undefined;
let dos: Dosificacion | undefined;
let modo: 'balanza' | 'corob' = 'balanza';
let F = 1, puesto: number[] = [], plan: PasoPlan[] = [], paso = 0, pases: string[] = [];

function abrirDosificar(id: number) {
  formula = base.formula(id);
  if (!formula) return;
  const b = catalogo.get(formula.renglones[0]!.comp);
  $('dos-empty').hidden = true; $('dos').hidden = false; ver('dosificar');
  $('d-cod').textContent = String(formula.codigo); $('d-nom').textContent = formula.nombre;
  $('d-base').textContent = b ? `${b.nombre} (${b.codigo})` : String(formula.renglones[0]!.comp);
  $('d-sis').textContent = formula.sistema === 'CONCENTRADOS' ? 'colorantes Concentrados' : 'colorantes GVA';
  $('d-obs').textContent = formula.obs ?? '';
  const envases = (b?.envases ?? []).map((e, i) => `<option value="${i}">${nf(e.capacidad, e.capacidad % 1 ? 1 : 0)} L</option>`);
  const propias = (formula.capacidades ?? []).map((k) => `<option value="cap:${k.capacidad}">${nf(k.capacidad, 2)} ${k.unidad === 'K' ? 'kg' : 'L'} (de la fórmula)</option>`);
  $('d-env').innerHTML = [...envases, ...propias, '<option value="libre">Otra cantidad</option>'].join('');
  calcular();
}

function calcular() {
  if (!formula) return;
  const sel = $<HTMLSelectElement>('d-env').value;
  $('d-libre-wrap').hidden = sel !== 'libre';
  try {
    dos = sel === 'libre' ? dosificarEnCapacidad(formula, catalogo, Math.max(0.01, Number($<HTMLInputElement>('d-libre').value) || 0.01))
      : sel.startsWith('cap:') ? dosificarEnCapacidad(formula, catalogo, Number(sel.slice(4)))
      : dosificarEnEnvase(formula, catalogo, Number(sel));
  } catch (e) {
    $('ahora').innerHTML = `<div class="que">No se puede dosificar: ${esc((e as Error).message)}</div>`;
    return;
  }
  reiniciar();
}

function reiniciar() { F = 1; pases = []; puesto = dos!.renglones.map(() => 0); paso = 0; armarPlan(); $('pasado').hidden = true; pintarTodo(); }
function armarPlan() {
  const lectura = puesto.reduce((s, g) => s + g, 0);
  const correcciones: Omit<PasoPlan, 'acum'>[] = [], resto: Omit<PasoPlan, 'acum'>[] = [];
  dos!.renglones.forEach((r, i) => {
    const falta = r.gramos * F - puesto[i]!;
    if (falta <= 0.05) return;
    (puesto[i]! > 0 ? correcciones : resto).push({ i, g: falta, extra: puesto[i]! > 0 });
  });
  let acum = lectura;
  plan = [...correcciones, ...resto].map((p) => ({ ...p, acum: (acum += p.g) }));
}
function pintarTodo() { pintarPesada(); pintarPrecio(); }

function precioPendiente(d: Dosificacion) {
  return d.renglones.some((r) => !r.componente.envases[0] || r.componente.envases[0].precio <= 0.1);
}
function pintarPrecio() {
  const d = dos!, cap = d.capacidad * F;
  if (precioPendiente(d)) {
    $('d-precio').innerHTML = `<div class="precio pendiente">Precio pendiente<small>Rinde ${nf(cap, 3)} L</small></div>
      <div class="aviso falta">Faltan precios de algunos componentes. Cargá la lista de precios en <b>Datos</b>. Los gramos sí son correctos.</div>`;
    return;
  }
  const p = calcularPrecio(d, { rentabilidadGlobal: config.rentabilidadGlobal / 100 });
  const costoBase = p.costoBase * F, costoCol = p.costoColorantes * F, costo = costoBase + costoCol;
  const precio = Math.round(costo * (1 + p.rentabilidad) * 100) / 100;
  let html = `<div class="precio num">$ ${nf(precio)}<small>sin IVA, rinde ${nf(cap, 3)} L</small></div>
    <div class="kv num"><span>${F > 1 ? 'Base (lata + agregado)' : d.envaseBase >= 0 ? 'Lata de base' : 'Base'}</span><span>$ ${nf(costoBase)}</span></div>
    <div class="kv num"><span>Colorantes</span><span>$ ${nf(costoCol)}</span></div>
    <div class="kv num"><span>Costo</span><span>$ ${nf(costo)}</span></div>
    <div class="kv num"><span>Rentabilidad</span><span>${nf(p.rentabilidad * 100, 1)} %</span></div>`;
  if (F > 1) html += `<div class="aviso num">La tanda creció ${nf((F - 1) * 100, 1)} %: el precio se ajustó en la misma proporción.</div>`;
  $('d-precio').innerHTML = html;
}

function avisoChicas(): string {
  if (F > 1) return '';
  const a = avisarCantidadesChicas(dos!, config.umbralGramos);
  if (!a.avisos.length) return '';
  const nombres = a.avisos.map((x) => `${esc(x.nombre)} (${nf(x.gramos, 1)} g)`).join(' y ');
  const b = dos!.renglones[0]!.componente;
  const sel = $<HTMLSelectElement>('d-env').value;
  const sug = a.envaseSugerido !== undefined && String(a.envaseSugerido) !== sel
    ? ` <button class="link" data-envase="${a.envaseSugerido}">Usar la lata de ${nf(b.envases[a.envaseSugerido]!.capacidad, b.envases[a.envaseSugerido]!.capacidad % 1 ? 1 : 0)} L</button>`
    : ` Para pesarlo bien hace falta preparar al menos ${nf(a.capacidadMinima ?? 0, 1)} L o usar una balanza de precisión.`;
  return `<div class="chica"><b>Cantidad muy chica:</b> ${nombres} lleva menos de ${nf(config.umbralGramos, 1)} g, poco confiable en una balanza común.${sug}</div>`;
}
$('aviso-chico').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-envase]');
  if (b) { $<HTMLSelectElement>('d-env').value = b.dataset.envase!; calcular(); }
});

function pintarPesada() {
  const d = dos!, filas = d.renglones, balanza = modo === 'balanza', cap = d.capacidad * F;
  $('acciones-paso').hidden = !balanza;
  $('aviso-chico').innerHTML = balanza ? avisoChicas() : '';
  const nombre = (i: number) => esc(filas[i]!.componente.nombre);
  if (balanza) {
    const n = plan.length;
    const chica = (i: number) => (filas[i]!.gramos * F < config.umbralGramos ? `<span class="tag-chica">menos de ${nf(config.umbralGramos, 0)} g</span>` : '');
    $('d-head').innerHTML = '<tr><th>Paso</th><th>Componente</th><th class="r">Agregar</th><th class="r"><span class="lg">La balanza marca</span><span class="sm">Balanza</span></th></tr>';
    $('pasos').innerHTML = plan.map((p, j) => `<tr class="${j < paso ? 'hecho' : j === paso ? 'actual' : ''}">
      <td class="num">${j + 1}</td><td class="comp">${p.extra ? '<span class="tag-extra">completar</span>' : ''}${nombre(p.i)}${p.i === 0 ? '<span class="base-tag">base</span>' : ''}${chica(p.i)}</td>
      <td class="r num">${p.extra ? '+ ' : ''}${nf(p.g, 1)} g</td><td class="r num">${nf(p.acum, 1)} g</td></tr>`).join('');
    const total = filas.reduce((s, r) => s + r.gramos * F, 0);
    $('d-foot').innerHTML = `<tr><td></td><td>Total${F > 1 ? ' (tanda agrandada)' : ''}</td><td></td><td class="r num">${nf(total, 1)} g</td></tr>`;
    const a = $('ahora');
    if (paso < n) {
      const p = plan[paso]!;
      a.className = 'ahora' + (p.extra ? ' extra' : '');
      const nota = p.extra && p.i === 0 ? ', de otra lata de la misma base' : (paso === 0 && F === 1 ? ', tarar la balanza con la lata vacía' : '');
      a.innerHTML = `<div class="paso">Paso ${paso + 1} de ${n}${nota}</div>
        <div class="que">${p.extra ? 'Completar: ' : ''}${nombre(p.i)}</div>
        <div class="agrega">Agregá <b class="num">${nf(p.g, 1)} g</b>${p.extra ? ' más' : ''}</div>
        <div class="lectura"><div class="lbl">La balanza tiene que marcar</div><div class="g num">${nf(p.acum, 1)}<small>g</small></div></div>`;
    } else {
      a.className = 'ahora listo';
      a.innerHTML = `<div class="paso">Pesada completa</div><div class="que">Mezclar y verificar el color</div>
        <div class="agrega">Rinde <b class="num">${nf(cap, 3)} L</b></div>
        <div class="lectura"><div class="lbl">Peso final</div><div class="g num">${nf(total, 1)}<small>g</small></div></div>`;
    }
    $<HTMLButtonElement>('b-sig').disabled = paso >= n;
    $<HTMLButtonElement>('b-ant').disabled = paso === 0;
    const actual = plan[paso];
    $<HTMLButtonElement>('b-pase').disabled = !actual || (actual.i === 0 && !actual.extra && d.envaseBase >= 0);
    $('correccion').hidden = F === 1;
    if (F > 1) $('correccion').innerHTML = `${pases.join('. ')}. Para conservar el color, la tanda se agrandó ${nf((F - 1) * 100, 1)} % y ahora rinde <b>${nf(cap, 3)} L</b>.`;
  } else {
    $('correccion').hidden = true;
    $('d-head').innerHTML = '<tr><th>Orden</th><th>Componente</th><th class="r">Dispensar</th><th class="r">Por cada litro</th></tr>';
    $('pasos').innerHTML = filas.map((r, i) => `<tr><td class="num">${i + 1}</td><td class="comp">${nombre(i)}${i === 0 ? '<span class="base-tag">base</span>' : ''}</td>
      <td class="r num">${nf(r.ml, 1)} ml</td><td class="r num">${nf(r.cant, 2)} ml</td></tr>`).join('');
    $('d-foot').innerHTML = `<tr><td></td><td>Total</td><td class="r num">${nf(d.capacidad * 1000, 0)} ml</td><td></td></tr>`;
    const a = $('ahora'); a.className = 'ahora listo';
    a.innerHTML = `<div class="paso">Dispensadora COROB D600</div><div class="que">La base va a mano, los colorantes los dispensa la máquina</div>
      <div class="agrega">El envío directo a la COROB llega en una etapa siguiente.</div>
      <div class="lectura"><div class="lbl">Volumen final</div><div class="g num">${nf(d.capacidad, 3)}<small>L</small></div></div>`;
  }
}

function mover(delta: number) {
  if (modo !== 'balanza' || !dos) return;
  if (delta > 0 && paso < plan.length) { const p = plan[paso]!; puesto[p.i] = puesto[p.i]! + p.g; paso++; }
  else if (delta < 0 && paso > 0) { paso--; const p = plan[paso]!; puesto[p.i] = puesto[p.i]! - p.g; }
  $('pasado').hidden = true; pintarPesada();
}
function abrirPase() {
  const p = plan[paso]; if (!p) return;
  $('pasado').hidden = false;
  $('pase-q').textContent = `¿Cuánto marca la balanza ahora? Tenía que marcar ${nf(p.acum, 1)} g.`;
  $('pase-err').textContent = ''; $<HTMLInputElement>('pase-g').value = ''; $('pase-g').focus();
}
function aplicarPase() {
  const p = plan[paso]; if (!p || !dos) return;
  const texto = $<HTMLInputElement>('pase-g').value;
  const lectura = parseFloat(texto.replace(/\./g, '').replace(',', '.'));
  if (!(lectura > p.acum)) { $('pase-err').textContent = `Con ${texto || 0} g no te pasaste: marcá "Listo, siguiente" o seguí agregando.`; return; }
  const antes = p.acum - p.g;
  puesto[p.i] = puesto[p.i]! + (lectura - antes);
  F = Math.max(F, puesto[p.i]! / dos.renglones[p.i]!.gramos);
  pases.push(`${dos.renglones[p.i]!.componente.nombre} quedó en ${nf(puesto[p.i]!, 1)} g`);
  paso = 0; armarPlan(); $('pasado').hidden = true; pintarTodo();
}
$('b-sig').addEventListener('click', () => mover(1));
$('b-ant').addEventListener('click', () => mover(-1));
$('b-rei').addEventListener('click', () => reiniciar());
$('b-pase').addEventListener('click', abrirPase);
$('pase-ok').addEventListener('click', aplicarPase);
$('pase-no').addEventListener('click', () => { $('pasado').hidden = true; });
$('pase-g').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarPase(); } if (e.key === 'Escape') $('pasado').hidden = true; });
document.addEventListener('keydown', (e) => {
  if ($('v-dosificar').hidden || !dos) return;
  if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mover(1); }
  if (e.key === 'Backspace') { e.preventDefault(); mover(-1); }
});
$('d-env').addEventListener('change', calcular);
$('d-libre').addEventListener('input', calcular);
seg('modo', 'data-m', (m) => { modo = m as typeof modo; if (dos) pintarPesada(); });

$('b-imprimir').addEventListener('click', () => {
  if (!dos || !formula) return;
  let acum = 0;
  const precio = $('d-precio').querySelector('.precio')?.childNodes[0]?.textContent?.trim() ?? '';
  $('print-sheet').innerHTML = `<img src="./albamix-logo.png" style="height:40px" alt="Albamix"><h1>${formula.codigo} ${esc(formula.nombre)}</h1>
    <div>Producto: <b>${esc(dos.renglones[0]!.componente.nombre)}</b>. Rinde <b>${nf(dos.capacidad * F, 3)} L</b>. ${new Date().toLocaleDateString('es-AR')}</div>
    ${formula.obs ? `<div>${esc(formula.obs)}</div>` : ''}${F > 1 ? `<div>Tanda agrandada ${nf((F - 1) * 100, 1)} % por corrección en balanza.</div>` : ''}
    <table style="margin-top:8px"><thead><tr><th>Paso</th><th>Componente</th><th class="r">Gramos</th><th class="r">Balanza</th><th class="r">ml</th></tr></thead><tbody>
    ${dos.renglones.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.componente.nombre)}</td><td class="r">${nf(r.gramos * F, 1)}</td><td class="r">${nf((acum += r.gramos * F), 1)}</td><td class="r">${nf(r.ml * F, 1)}</td></tr>`).join('')}
    </tbody></table><p><b>${precio.startsWith('$') ? `Precio sin IVA: ${esc(precio)}` : 'Precio pendiente'}</b></p>`;
  window.print();
});

// ---------- datos ----------
function pintarDatos() {
  const m = base.meta();
  const reporte = m.reporte ? JSON.parse(m.reporte) as { formulasAlbamix: number; formulasPersonales: number } : undefined;
  const comps = base.componentes();
  const filas: [string, string][] = [
    ['Fórmulas', base.cantidadFormulas().toLocaleString('es-AR') + (reporte ? ` (${reporte.formulasAlbamix.toLocaleString('es-AR')} Albamix, ${reporte.formulasPersonales} personales)` : '')],
    ['Productos', String(comps.length)],
    ['Lista de precios', m.lista_precios_numero ? `${m.lista_precios_numero}, vigente desde ${fechaAr(m.lista_precios_vigencia)}` : 'No cargada'],
    ['Importado', m.creado ? new Date(m.creado).toLocaleString('es-AR') : '—'],
  ];
  $('estado-datos').innerHTML = filas.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  $<HTMLInputElement>('cfg-rent').value = String(config.rentabilidadGlobal);
  $<HTMLInputElement>('cfg-umbral').value = String(config.umbralGramos);
  const sub = m.lista_precios_numero ? `Lista de precios ${m.lista_precios_numero}` : 'Sin lista de precios cargada';
  $('sub-lista').textContent = sub;
}

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-accion]');
  if (!b) return;
  const acc = b.dataset.accion;
  if (acc === 'importar-mdb') $<HTMLInputElement>('f-mdb').click();
  if (acc === 'cargar-excel') $<HTMLInputElement>('f-excel').click();
  if (acc === 'restaurar') $<HTMLInputElement>('f-copia').click();
});

$('f-mdb').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const archivos = [...(input.files ?? [])];
  input.value = '';
  const enInicio = !$('v-inicio').hidden;
  const salida = $(enInicio ? 'res-inicio' : 'res-mdb');
  const buscarArchivo = (clave: string) => archivos.find((f) => f.name.toLowerCase().includes(clave));
  const precios = buscarArchivo('precios');
  if (!precios) { salida.innerHTML = '<p class="error">Falta <b>precios.mdb</b>: es el maestro de productos y es obligatorio.</p>'; return; }
  try {
    await ocupado(async () => {
      const leerArchivo = async (f?: File) => (f ? new Uint8Array(await f.arrayBuffer()) : undefined);
      const imp = importarOriginales({
        precios: (await leerArchivo(precios))!, albamix: await leerArchivo(buscarArchivo('albamix')),
        personal: await leerArchivo(buscarArchivo('personal')), bonifica: await leerArchivo(buscarArchivo('bonifica')),
      });
      base.cargar(imp, { fuente: `Importación desde el Albamix viejo (${archivos.map((f) => f.name).join(', ')})` });
      await persistir();
      recargarCatalogo(); poblarProductos();
      const r = imp.reporte;
      salida.innerHTML = `<p class="ok">Importación completa: ${r.formulasAlbamix.toLocaleString('es-AR')} fórmulas Albamix, ${r.formulasPersonales} personales y ${r.componentes} productos.</p>
        <ul>${r.descartadasSinRenglones.length ? `<li>${r.descartadasSinRenglones.length} fórmulas vacías no se importaron.</li>` : ''}
        ${r.nombresNormalizados ? `<li>${r.nombresNormalizados} nombres corregidos (espacios de más).</li>` : ''}
        ${r.componentesFaltantes.length ? `<li class="error">Componentes que no están en precios.mdb: ${r.componentesFaltantes.join(', ')}.</li>` : ''}
        ${Object.keys(r.problemasValidacion).length ? `<li class="error">Fórmulas con problemas: ${esc(JSON.stringify(r.problemasValidacion))}.</li>` : ''}</ul>`;
    });
    pintarDatos();
    if (enInicio) { ver('buscar'); buscar(); } else buscar();
  } catch (err) {
    salida.innerHTML = `<p class="error">No se pudo importar: ${esc((err as Error).message)}</p>`;
  }
});

let listaPendiente: { lista: ListaPrecios; resultado: ResultadoAplicacion } | undefined;
$('f-excel').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const archivo = input.files?.[0];
  input.value = '';
  if (!archivo) return;
  const salida = $('res-excel');
  await ocupado(async () => {
    const lista = await leerListaPrecios(new Uint8Array(await archivo.arrayBuffer()));
    const resultado = aplicarListaPrecios(base.componentes(), lista);
    listaPendiente = { lista, resultado };
    const cambios = resultado.actualizados.slice(0, 50).map((c) =>
      `<li>${c.codigo} ${esc(c.nombre)}: $ ${c.antes.map((x) => nf(x)).join(' / ')} → $ ${c.despues.map((x) => nf(x)).join(' / ')}${c.variacion != null ? ` (${c.variacion > 0 ? '+' : ''}${nf(c.variacion, 1)} %)` : ''}</li>`).join('');
    salida.innerHTML = `<p><b>Lista ${esc(lista.numero ?? '(sin número)')}</b>, vigente desde ${fechaAr(lista.vigencia)}: ${lista.productos.length} productos válidos.</p>
      ${lista.errores.length ? `<p class="error">${lista.errores.length} problema(s) para corregir en la planilla antes de aplicarla:</p>
        <ul>${lista.errores.map((x) => `<li class="error">${x.fila ? `Fila ${x.fila}` : 'Lista'}${x.columna ? `, ${esc(x.columna)}` : ''}: ${esc(x.mensaje)}</li>`).join('')}</ul>` : ''}
      <p>Cambios de precio: ${resultado.actualizados.length}. Productos nuevos: ${resultado.nuevos.length}. Sin cambios: ${resultado.sinCambios}.</p>
      ${cambios ? `<ul>${cambios}</ul>` : ''}
      <div class="acciones" style="margin-top:10px"><button class="btn" id="b-aplicar-lista" ${lista.errores.length ? 'disabled' : ''}>Aplicar lista de precios</button></div>`;
  });
});
$('res-excel').addEventListener('click', async (e) => {
  if (!(e.target as HTMLElement).closest('#b-aplicar-lista') || !listaPendiente) return;
  const { lista, resultado } = listaPendiente;
  try {
    base.actualizarPrecios(resultado.componentes, { numero: lista.numero!, vigencia: lista.vigencia!, ...(lista.notas ? { notas: lista.notas } : {}) });
    await persistir();
    recargarCatalogo(); poblarProductos();
    listaPendiente = undefined;
    $('res-excel').innerHTML = `<p class="ok">Lista ${esc(lista.numero!)} aplicada: ${resultado.actualizados.length} precios actualizados.</p>`;
    pintarDatos();
  } catch (err) {
    $('res-excel').insertAdjacentHTML('beforeend', `<p class="error">${esc((err as Error).message)}</p>`);
  }
});

$('cfg-guardar').addEventListener('click', async () => {
  const rent = Number($<HTMLInputElement>('cfg-rent').value), umbral = Number($<HTMLInputElement>('cfg-umbral').value);
  if (!(rent >= 0) || !(umbral > 0)) { $('res-cfg').innerHTML = '<p class="error">Revisá los valores: la rentabilidad va de 0 en adelante y el peso mínimo tiene que ser mayor que cero.</p>'; return; }
  config = { rentabilidadGlobal: rent, umbralGramos: umbral };
  await guardar('config', config);
  $('res-cfg').innerHTML = '<p class="ok">Guardado.</p>';
});

$('b-exportar').addEventListener('click', () => {
  const blob = new Blob([motor.exportar() as BlobPart], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `albamix-copia-${new Date().toISOString().slice(0, 10)}.sqlite`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $('res-copia').innerHTML = `<p class="ok">Copia guardada como ${a.download} en la carpeta de descargas.</p>`;
});
$('f-copia').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const archivo = input.files?.[0];
  input.value = '';
  if (!archivo) return;
  try {
    const nuevo = await MotorSqlJs.abrir(new Uint8Array(await archivo.arrayBuffer()), ubicarWasm);
    const nuevaBase = new BaseLocal(nuevo);
    const n = nuevaBase.cantidadFormulas();
    motor.close(); motor = nuevo; base = nuevaBase;
    await persistir(); recargarCatalogo(); poblarProductos(); pintarDatos(); buscar();
    $('res-copia').innerHTML = `<p class="ok">Copia restaurada: ${n.toLocaleString('es-AR')} fórmulas.</p>`;
  } catch {
    $('res-copia').innerHTML = '<p class="error">El archivo no es una copia de seguridad válida de Albamix.</p>';
  }
});

// ---------- arranque ----------
async function iniciar() {
  config = { ...CONFIG_INICIAL, ...((await leer<Configuracion>('config')) ?? {}) };
  const bytes = await leer<Uint8Array>('base');
  motor = await MotorSqlJs.abrir(bytes, ubicarWasm);
  base = new BaseLocal(motor);
  recargarCatalogo();
  pintarDatos();
  if (base.cantidadFormulas() === 0) { ver('inicio'); return; }
  poblarProductos();
  ver('buscar');
  buscar();
  $('q').focus();
}
iniciar().catch((e) => {
  document.body.insertAdjacentHTML('afterbegin', `<p style="padding:16px;color:#7a1f42">No se pudo iniciar la app: ${esc(String(e))}</p>`);
});

// Para uso en pruebas automáticas.
declare global { interface Window { __albamix?: { componentes: () => Componente[] } } }
window.__albamix = { componentes: () => base.componentes() };
