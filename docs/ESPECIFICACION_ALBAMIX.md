# Albamix – Sistema Industrial: especificación por ingeniería inversa

Versión 1 · 2026-10-07 · Fuente: análisis estático de `albamixC.exe` + extracción de `albamix.mdb`, `bonifica.mdb`, `Capacidades.mdb`, `ALBAMIX.ldb`, `BONIFICA.ldb`.

Convención de marcas en todo el documento:

- **[H]** = hecho observado (se cita la evidencia).
- **[S]** = suposición / inferencia (se indica qué la confirmaría).
- **[?]** = hueco abierto.

---

## Decisiones del usuario (2026-10-07)

| # | Tema | Decisión |
|---|---|---|
| 1 | Alcance | **App completamente independiente** (no es un módulo de Chromascan) |
| 2 | Usuarios | **Distribuidores que hacen tinting / operadores de tintometría** |
| 3 | Clave | Se adopta la hipótesis H-a: protege precios, bonificación y rentabilidad |
| 4 | Precio 1 / Precio 2 | Son los precios de **los 2 formatos de envase** (p. ej. 4 L y 20 L) |
| 5 | Fórmula de precio | Sin definir. **Se arranca con la hipótesis F.3 y se valida al final** |
| 6 | Cantidad de base | **Depende de la base**. El usuario va a subir la tabla de bases en .mdb |
| 7 | Fórmulas personales | Son las que **carga a mano** el distribuidor |
| 8 | Volumen | Miles de fórmulas (hoy hay 6.439 oficiales) |
| 9 | Dónde corre | **Sin internet en el punto de venta** (offline-first). Se evalúa además una versión online (Render o similar) |

### Decisiones, ronda 2 (2026-10-07)

| Tema | Decisión |
|---|---|
| MVP | Buscar color → dosificar → gramos/ml → precio → imprimir. Edición en etapas siguientes |
| Colorantes | Sistema **GVA actual** por defecto + **selector** para el sistema viejo de **Concentrados** |
| Fórmulas y precios | Los publica **AkzoNobel** y el **distribuidor** suma fórmulas personales |
| Rentabilidad propia del distribuidor | Sí, protegida **con clave** |
| IVA | Precios **sin IVA** |
| Listas por distribuidor / zona | No |
| Dosificación física | **Balanza en gramos a mano** + opción **dispensadora automática volumétrica COROB D600** |
| Impresión | Impresora **configurable** por el usuario |
| PCs | Una o varias por distribuidor, **sin compartir datos** |
| Sistema operativo | **Windows 10 o superior** |
| Actualizaciones | **Mail con link de descarga / pendrive** ⇒ paquete de actualización importable por archivo |
| Escala | ~10–12 distribuidores, **solo Argentina** (solo español) |
| Marca | **AkzoNobel / Albamix** |
| Historial por cliente | **Sí** (función nueva: clientes + historial de dosificaciones) |
| Repositorio | **Repo nuevo**, autorizado |

---

## 0. Evidencia analizada y registro hechos vs. suposiciones

### 0.1 Evidencia

| Pieza | Qué es | Cómo se leyó |
|---|---|---|
| `albamixC.exe` (459 KB, sha256 `26fef50f…e554`) | Ejecutable NE 16 bits, **Visual Basic 3** (VBRUN300), controles `SPREAD20.VBX` (grilla) y `THREED.VBX` | Strings, SQL embebido, recursos .FRM, constantes p-code. **No se ejecutó.** |
| `albamix.mdb` (3,5 MB) | Base **Jet 1.x** (Access 1.x), páginas de 2 KB, **cabecera (página 0) sobrescrita** | Ninguna herramienta lo abre (mdbtools/Access fallan). Se escribió un lector propio: `herramientas/jet1.py`. |
| `bonifica.mdb` (64 KB) | Ídem Jet 1.x con cabecera sobrescrita | Ídem |
| `Capacidades.mdb` (388 KB) | Access 2007+ (ACE12), con tabla `Conversion Errors` ⇒ convertido desde un formato viejo | mdbtools |
| `ALBAMIX.ldb`, `BONIFICA.ldb`, `PERSONAL.ldb` | Archivos de bloqueo Jet | Lectura directa |
| `precios.mdb` (96 KB) | Jet 1.x con cabecera sobrescrita. Tabla `Componentes` | `jet1.py` |
| `personal.mdb` (128 KB) | Jet 1.x con cabecera sobrescrita. `FormulasC/R/Cap` + tabla `clave2` | `jet1.py` |

Datos extraídos → `docs/albamix/datos/*.csv`.

### 0.2 Hechos clave [H]

1. Es una app **de escritorio, monopuesto en lógica, pero usada en red compartida**: los `.ldb` registran 4 equipos distintos abriendo las mismas bases como usuario Jet `Admin`: `NBCSOTO`, `BSRWBRG017F32Q`, `BSRL300004`, `ARBIWA097`. ⇒ las `.mdb` vivían en una carpeta de red y varias PCs las abrían a la vez.
2. Cinco bases en `..\bases\`: `albamix.mdb`, `personal.mdb`, `precios.mdb`, `bonifica.mdb`, `rentabil.mdb` (strings del exe).
3. **6.439 fórmulas**, **31.251 renglones**, **1.001 códigos de color**, 30 bases, 15 colorantes, fechas 2011-02-14 → 2012-10-19.
4. **Las 6.436 fórmulas con renglones suman exactamente 1000 c.c.** y en todas la base es la línea 1 (regla del exe verificada contra datos).
5. `FormulasCap` está **vacía** en `albamix.mdb`; las capacidades de envase viven en `Capacidades.mdb`.
6. Las 55 bonificaciones en `bonifica.mdb` valen **0**.
7. `precios.mdb` tiene **54 componentes**: 37 bases (B), 14 colorantes (C) y 3 accesorios (A). Incluye peso específico y 2 envases por producto. **Todos los precios valen 0,1**: es una copia con precios borrados o de ejemplo. Los precios reales vendrían de los Excel que faltan [S].
8. Todos los componentes usados en fórmulas existen en `precios.mdb`. **En el 100% de las fórmulas la línea 1 es tipo B, y ninguna otra línea es tipo B.**
9. `personal.mdb` tiene 2 fórmulas manuales ("Rojo Giorgi" código 3611, y "prueba" código 100000), **con capacidades cargadas** (3,41 / 17,05 L y 35 / 20 L). La tabla `clave2` tiene la clave **vacía**.

### 0.3 Principales suposiciones [S] (detalle en cada sección)

| # | Suposición | Confirmaría / refutaría |
|---|---|---|
| S1 | Las páginas 0 de los .mdb se sobrescribieron **a propósito** (protección anti-apertura en Access); la app las restauraría al abrir, o abre con un driver que no valida la cabecera | Ver si en el exe hay rutina de escritura binaria a los .mdb; probar abrir con VB3 real |
| S2 | La **clave** protege edición de precios/bonificación/rentabilidad | Usar la app; ver qué pide clave |
| S3 | Fórmula de costo = Σ(cant/1000 × costo por litro del componente), luego bonificación y rentabilidad (ver F.3) | `precios.mdb` + `rentabil.mdb` + 1 captura de Dosificar con precio |
| S4 | El exe analizado es de **otra versión** que los datos (exige base 800/850/900/980; los datos usan 880 como estándar) | Fecha/versión del exe vs. fecha de los datos; probar cargar una fórmula con 880 |

---

## A) Mapa funcional de módulos

### A.1 Módulos y submódulos

| Módulo | Pantalla / módulo VB [H] | Propósito |
|---|---|---|
| **Inicio** | `FRMSPLAS` (splash), `FrmMenuInicial` | Arranque, apertura de bases, menú principal "Albamix - Sistema Industrial" |
| **Productos (componentes)** | `frmProductos` (lista), `frmProducto` (alta/edición) | ABM de bases, colorantes y accesorios con precios por envase, peso específico, bonificación y rentabilidad |
| **Fórmulas** | `frmSelFormulas` (elegir Albamix / Personales), `frmFormulas` (lista), `frmFormula` (edición), `frmBusFormulas` (búsqueda) | ABM y búsqueda de fórmulas de color |
| **Dosificación y costo** | `frmDosificar`, `modcosto.calculaCostos` | Escalar una fórmula a una capacidad, calcular gramos/ml y precio |
| **Bonificación y rentabilidad** | `frmBonifRent` | Márgenes globales y por tipo (bases, colorantes, accesorios) |
| **Seguridad** | `frmClave` (cambio), `frmIngClave` (ingreso) | Clave única de 20 caracteres en tabla `clave` |
| **Acceso a datos** | `modjet` (funciones `dbXxx`) | Capa de persistencia sobre Jet/Access |
| **Utilidades** | `modgral` | Separador decimal regional (`sepDec`), exportar a Excel (OLE `Excel.Application` + portapapeles), exportar a CSV, impresión |

### A.2 Dependencias

```
FrmMenuInicial ─┬─> frmProductos ──> frmProducto ──> (frmIngClave)? ──> modjet[Componentes, bonifica, rentabil]
                ├─> frmSelFormulas ──> frmFormulas ─┬─> frmFormula ──> modjet[FormulasC/R/Cap, Componentes]
                │                                   ├─> frmBusFormulas
                │                                   └─> frmDosificar ──> modcosto ──> Componentes + Parametros
                ├─> frmBonifRent ──> modjet[Parametros]
                └─> frmClave ──> modjet[clave]
Todas ──> modgral (Excel/CSV/impresión)
```

- Fórmulas **dependen** de Productos: cada renglón referencia un `comp` que debe existir (`"No se encontró en la base de datos el componente de la fila"`).
- Productos **no se pueden borrar** si los usa una fórmula (`dbProductoEnUso`).
- Dosificación depende de Fórmulas + Productos (precio, peso específico) + Parámetros (rentabilidades).

---

## B) Roles, permisos y casos de uso

### B.1 Roles

No hay usuarios ni login [H] (no existe tabla de usuarios; Jet abre como `Admin`). Hay una **clave única** [H].

Confirmado por el usuario: lo usan **distribuidores / operadores de tintometría**, y la clave protege precios y márgenes.

| Rol | Acciones | Pantallas |
|---|---|---|
| **Operador de tintometría** (sin clave) | Buscar, ver, dosificar, imprimir y exportar fórmulas; ver productos; ABM de **fórmulas personales** [S] | FrmMenuInicial, frmFormulas, frmBusFormulas, frmDosificar |
| **Supervisor** (con clave) [S] | Además: editar precios, bonificación y rentabilidad (`CmdBloqueo`, `fraBonifRent` en frmProducto); cambiar la clave | frmProducto, frmBonifRent, frmClave |
| **Fábrica / Albamix** [S] | Distribuye `albamix.mdb` con las fórmulas oficiales | (fuera de la app) |

**Hipótesis alternativas sobre la clave:**
- H-a: protege solo precios y márgenes (lo más probable: el botón se llama `CmdBloqueo` y está junto a `fraBonifRent`).
- H-b: protege la edición de las fórmulas Albamix oficiales.
- H-c: protege la app entera al iniciar.

Lo que decide entre ellas: abrir la app y ver dónde pide la clave.

### B.2 Casos de uso críticos

**CU-1 Dosificar un color (núcleo del negocio)**
1. El operador elige "Fórmulas Albamix" o "Fórmulas Personales".
2. Busca (F2) por rango de código, por "contiene nombre" o por rango de fechas.
3. Elige la fila y presiona **Dosificar (F12)**.
4. Elige la capacidad a dosificar (`cmbCapacidades`).
5. Ve los gramos y ml por componente, los totales y el precio.
6. Imprime (F9) o exporta a Excel.
- Variante: la búsqueda sin filtros advierte "La búsqueda de todas las fórmulas puede demorar un tiempo considerable. ¿Prosigue?".
- Variante: si no hay resultados, muestra "No se encontraron fórmulas con esas condiciones".

**CU-2 Alta de fórmula**: ver flujo C.2.

**CU-3 Mantener precios de productos**: ver flujo C.3.

**CU-4 Configurar rentabilidades**: frmBonifRent, con 4 porcentajes validados.

**CU-5 Exportar listados** (productos, fórmulas, dosificación) a Excel o CSV.

---

## C) Flujos de proceso

### C.1 Dosificar fórmula
- **Disparador**: F12 en la lista de fórmulas.
- **Pasos**:
  1. `dbCargarFormula(id)` [H] lee la cabecera, los renglones (`ORDER BY linea`) y las capacidades (`FormulasCap ORDER BY capa`).
  2. Por cada renglón, `dbCargarProducto(comp)`. Si falta: "No se encontró el componente: X".
  3. El usuario elige la capacidad. Unidad Litros o Kilos [H].
  4. Para cada componente calcula ml = cant × capacidad(L) [S] y gramos = ml × peso específico [S].
  5. `calculaCostos` calcula el precio (F.3).
  6. Muestra la grilla `sprComponentes` (Capacidad, Tipo, Código, Nombre, Gramos, Litros, Gramos, miliLitros) y `sprTotales` [H].
- **Estados**: solo de pantalla (sin persistencia).
- **Resultado**: impreso con "Calidad: / Color: / Obs: / Capacidad: / Precio : $ / Componentes:" [H].
- **Errores**: "Error en el recálculo de costos", "No fue posible exportar a Excel" [H].

### C.2 Alta / edición de fórmula (`frmFormula.validarDatos`) [H salvo indicación]
1. Ingresar código de color: entero mayor que 0.
2. Si el código es nuevo: "Está ingresando al sistema un código de color nuevo! ¿Continúa?".
3. Ingresar nombre (obligatorio). Si no coincide con los nombres existentes para ese código: "El nombre de color no se corresponde con el código! Nombres existentes para ese código: … ¿Continúa con el nuevo nombre?" ⇒ **advertencia, no bloqueo**. Los datos lo confirman: 123 códigos tienen más de un nombre.
4. Componentes (máx. N [?]):
   - Cada código debe existir en Componentes.
   - Sin repetidos.
   - **El primero debe ser una base.**
   - Cantidades válidas y mayores que 0.
   - **Suma = 1000 c.c.** (si no: "Actualmente totalizan: X c.c.").
   - Cantidad de la base según la base: 800/850/900/980 (ver F.1 R6).
5. Capacidades (máx. M [?]): capacidad válida, unidad Kilos o Litros.
6. Al menos 1 componente y 1 capacidad. **Contradicción** [H]: `FormulasCap` está vacía en los datos ⇒ en esta versión la validación de capacidades no aplicaba a las fórmulas Albamix [S].
7. Si ya existe una fórmula con el **mismo color y la misma base**: "Ya existe una fórmula para el mismo color y la misma base! ¿Crear una nueva?" ⇒ advertencia. Los datos lo confirman: 61 pares código+base duplicados.
8. `dbGuardarFormula`: nuevo `id = max(id)+1` (`dbUltimoIdFormula`) e inserción en FormulasC, FormulasR y FormulasCap. En edición, borra los renglones y los reinserta (`delete from FormulasR where id =` …).
- **Errores**: "No fue posible guardar la fórmula".

### C.3 Alta / edición de producto (`frmProducto.validarDatos`) [H]
- Obligatorios: código, nombre, peso específico válido.
- Por capacidad N: precio y cantidad válidos.
- Tipo: Base, Colorante o Accesorio. Unidad: Litros o Kilos.
- Si ya existe: "Producto existente! ¿Sobreescribir?".
- Borrado: bloqueado si está en uso ("El producto se encuentra en uso. Imposible borrar").
- `id = max(id)+1`.

### C.4 Rentabilidades (`frmBonifRent`) [H]
- 4 campos: global, bases, colorantes, accesorios. Cada uno se valida ("Rentabilidad de bases inválida", etc.).
- Se guardan en `Parametros WHERE id=1`.

### C.5 Clave [H]
- Al inicio: si no existe la tabla `clave`, la crea (`create table clave (clave text(20))`) con clave vacía.
- Cambio: pide la anterior ("Clave anterior incorrecta"), la nueva dos veces ("Las claves no coinciden") y hace `update clave set clave = '…'`.
- Se guarda en texto plano o con una ofuscación simple [S].

---

## D) Modelo de datos (deducido)

### D.1 Tablas observadas en los .mdb [H]

**FormulasC** (cabecera; `albamix.mdb` y `personal.mdb` [S])

| Campo | Tipo Jet | Notas |
|---|---|---|
| ID | Long | PK. Generado como max+1. Rango 5257–12669 |
| CODIGO | Long | Código de color, 1000–99999. **No es único** (una fórmula por base) |
| NOMBRE | Text(60) | Ej. `IRAM 05-1-020 AMARILLO`, `RAL 9005`, `AZUL MARINO 043 PETINARI` |
| OBS | Text(255) | Instrucciones. Ej. `AGREGAR 8% DE POLVO MATEANTE 45-970-06`, `NUEVA BASE AMARILLA` |
| FECHA | Date | Fecha de alta. Columna agregada después de crear la tabla (se guarda como columna variable) |

**FormulasR** (renglones)

| Campo | Tipo | Notas |
|---|---|---|
| ID | Long | FK → FormulasC.ID |
| LINEA | Integer | 1..7. La línea 1 es la base |
| COMP | Long | FK → Componentes.comp (código de 7 dígitos) |
| CANT | Double | c.c. por cada 1000 c.c. de producto. 1–2 decimales |

PK lógica: (ID, LINEA).

**FormulasCap**: ID Long, CAPA Double, UNIDAD Text(1) (`K`/`L` [S]). **0 filas.**

**Componentes** en `bonifica.mdb`: COMP Long, BONIF Double (55 filas, todas en 0).

**Capacidades** (`Capacidades.mdb`, 112 filas, 73 productos): `producto` Double, `cap` Double, `Capacidad` Double, `Descripción` Text(255).
- `cap` es un **código de envase** [S] con litros asociados. Ejemplos: 540→4 L, 612→16 L, 544→3,2 L, 543→3 L, 607→15 L, 610→20 L, 537→3,7 L, 616→18,5 L, 860/510→1 L.

### D.2 Componentes (`precios.mdb`) [H]

| Campo | Tipo | Notas / ejemplo |
|---|---|---|
| COMP | Long | PK lógica. `4600301` |
| NOMBRE | Text(60) | `GVA 146 LIMON`, `Laca Nitrocelulósica Transparente` |
| TIPO | Text(1) | **B** = Base, **C** = Colorante, **A** = Accesorio |
| UNIDAD | Text(1) | **L** = Litros, **K** = Kilos (accesorios en polvo o pasta, autonivelante) |
| PE | Double | Peso específico (kg/L). 0,05 (mateante) a 1,8 |
| PRECIO1 / CAPA1 | Double | Precio y capacidad del **envase chico**. Bases: 3 / 3,2 / 3,7 L. Colorantes: 1 L |
| PRECIO2 / CAPA2 | Double | Precio y capacidad del **envase grande**: 15 / 16 / 18,5 / 20 L. 0 = no existe |

- Bonificación y rentabilidad por producto **no están en esta tabla**: viven en `bonifica.mdb` y en `rentabil.mdb`, que falta.
- La grilla del exe muestra además "Costo 3" [H]: puede ser un costo calculado [S].

**FormulasCap en `personal.mdb`** [H]: las fórmulas personales sí guardan capacidades propias. Ejemplo: ID 1 → 3,41 L y 17,05 L (relación 1:5).

**Parametros** (`rentabil.mdb` [S]): `id (=1), global, bases, colorantes, accesorios`.

**clave**: `clave Text(20)`.

### D.3 Relaciones
```
Componentes(comp) 1 ──< FormulasR(comp)
FormulasC(id)     1 ──< FormulasR(id)
FormulasC(id)     1 ──< FormulasCap(id)
Componentes(comp) 1 ──< Capacidades(producto)         [S: une por código]
Componentes(comp) 1 ── 1 bonifica.Componentes(comp)   [S]
```
No hay integridad referencial declarada [S]; la valida la app.

### D.4 Codificación de productos (patrón [H], significado [S])

| Prefijo | Familia | Ejemplos |
|---|---|---|
| 4510xxx | Esmalte sintético industrial | 4510000 Transp., 4510001 Blanco |
| 4516/4519xxx | Secado (extra) rápido | |
| 4517xxx | Laca coil / acrílico DTM | |
| 4525xxx | Epoxi | |
| 4540xxx | Horneable | |
| 4570xxx | Poliuretano | |
| 4581xxx | Caucho clorado | |
| 4585xxx | Fondos | |
| 4597xxx | Aditivos / accesorios | 4597006 Mateante en polvo (citado en OBS como `45-970-06`) |
| 4600xxx | **Colorantes GVA** | 4600000 GVA 147 Blanco, 4600301 GVA 146 Limón |
| 311xxxx | Fondos acrílicos tintables | |

Sufijo dentro de la familia: `…000` transparente, `…001` blanco, `…004`/`…104` base amarilla [S, según las descripciones].

### D.5 Integridad (reglas de negocio aplicadas por la app)
- Únicos: FormulasC.ID, Componentes.comp, (FormulasR.ID, LINEA).
- Obligatorios: CODIGO > 0, NOMBRE, ≥ 1 renglón, peso específico del producto.
- **No hay estados ni transiciones**: las fórmulas no tienen ciclo de vida (ni borrador ni aprobada). Solo la fecha de alta.

### D.6 Calidad de datos detectada (para la migración)
- 3 fórmulas basura sin renglones ni nombre (IDs 5257–5259, código 9547).
- 123 códigos con nombres distintos: variantes de espaciado (`IRAM 05-1-020  AMARILLO` con doble espacio) y **variantes por cliente** (`AZUL MARINO 043 OMBU / SALTO / PETINARI / PLUSCARGA`, `ALUX 043 AZUL MARINO`).
- 61 duplicados código+base.
- 4 bases sin descripción en `Capacidades.mdb` (4514130, 4518000, 4570108, 4570109) **sí están en `precios.mdb`** (p. ej. 4514130 = Laca Nitrocelulósica Transparente). Fuente maestra de nombres: `precios.mdb`.
- Fechas vacías: 3.

---

## E) API / integraciones / eventos

### E.1 La app original no tiene API [H]
La comunicación es por **archivos compartidos** (Jet sobre carpeta de red). Abajo están las "operaciones" observadas de `modjet` y su endpoint propuesto para la reescritura.

| Operación original [H] | SQL observado | Endpoint propuesto |
|---|---|---|
| `dbCargarFormulas(filtros)` | `SELECT … FROM FormulasC FC, FormulasR FR WHERE FC.id=FR.id AND codigo>=? AND codigo<=? AND instr(nombre,?) AND fecha>=? AND fecha<? ORDER BY codigo,id,linea` (+ `COUNT` previo) | `GET /api/formulas?codigoDesde&codigoHasta&nombre&fechaDesde&fechaHasta&origen=albamix\|personal&page` |
| `dbCargarFormula(id)` | cabecera + renglones + capacidades | `GET /api/formulas/:id` |
| `dbGuardarFormula` | insert/update en 3 tablas | `POST /api/formulas`, `PUT /api/formulas/:id` (sí: 201/200; 422 con lista de errores de validación) |
| `dbBorrarFormula` | `delete from FormulasR/C/Cap where id=` | `DELETE /api/formulas/:id` |
| `dbExisteFormulaSimilar(codigo, base)` | `SELECT fecha … WHERE codigo=? AND linea=1 AND comp=?` | `GET /api/formulas/similares?codigo&base` (o warning en la respuesta del POST) |
| `dbCargarNombresColor(codigo)` | `SELECT DISTINCT nombre FROM FormulasC WHERE codigo=?` | `GET /api/colores/:codigo/nombres` |
| `dbCargarProductos(filtros)` | `SELECT * FROM Componentes WHERE comp BETWEEN … AND tipo … AND instr(nombre…) ORDER BY comp` | `GET /api/componentes?tipo&q&desde&hasta` |
| `dbGuardarProducto` / `dbBorrarProducto` / `dbProductoEnUso` | | `POST/PUT/DELETE /api/componentes/:comp` (409 si está en uso) |
| `dbCargarRentabilidades` / `dbGuardarRentabilidadesGlobales` | `Parametros WHERE id=1` | `GET/PUT /api/parametros/rentabilidad` |
| `dbCargarBonifProducto` / `dbCargarRentProducto` | | incluidos en `GET /api/componentes/:comp` |
| `calculaCostos` | (cálculo en memoria) | `POST /api/formulas/:id/dosificar { capacidad, unidad }` → `{ renglones:[{comp, ml, g, costo}], totales, precio }` |
| `dbVerificaClave` / `dbGuardarClave` | `select clave from clave` | Reemplazar por auth con roles (`POST /api/auth/login`) |

### E.2 Integraciones externas [H]
- **Microsoft Excel por OLE Automation** (`Excel.Application → Workbooks.Add → Worksheets → Paste`): copia la grilla al portapapeles y la pega en una planilla nueva.
- **CSV**: pide nombre de archivo sin extensión (`export`).
- **Impresión** con el motor de Spread (encabezados `/fn"Arial" /fz"14"`, "Página: /p", "Impreso el … por …").
- No hay pagos, email ni ERP. No hay colas ni webhooks.

### E.3 Distribución de datos [S]
`albamix.mdb` lo entrega fábrica y se reemplaza entero al actualizar. `personal.mdb` es local de cada punto. La página 0 alterada sugiere un intento de evitar que se edite con Access (S1).

---

## F) Reglas de negocio

### F.1 Reglas de fórmula
| # | Regla | Tipo | Evidencia / ejemplo |
|---|---|---|---|
| R1 | Los componentes suman **1000 c.c.** | Bloqueante | exe + 6.436/6.436 fórmulas cumplen |
| R2 | La **base es la línea 1** | Bloqueante | exe + datos |
| R3 | Componente sin repetir y existente en el maestro | Bloqueante | exe |
| R4 | Código de color entero > 0 | Bloqueante | exe; datos 1000–99999 |
| R5 | Una fórmula por (código de color, base); si se repite, se advierte | Advertencia | exe; 61 excepciones en datos |
| R6 | La cantidad de base depende de la base | Bloqueante en el exe | ver abajo |
| R7 | El nombre debería coincidir con el código | Advertencia | exe; 123 excepciones |
| R8 | No se borra un producto en uso | Bloqueante | exe |
| R9 | Observaciones como instrucciones de agregado de accesorios fuera de la fórmula | Implícita | `AGREGAR 8% DE POLVO MATEANTE 45-970-06` (194 fórmulas con OBS) |

**R6, detalle.** El exe exige 800, 850, 900 o 980 c.c. según la base, con constantes 3.2 / 3.4 / 3.6 / 18.5 en la misma rutina. Los **datos** muestran otro patrón:

| Tipo de base (por descripción) | Cantidad de base observada | Ejemplos |
|---|---|---|
| Transparente | **880** (≈99%) | 4519000 (706 de 707), 4570100, 4510000 |
| Blanco | **850** mayoritario | 4519001 (12 de 25), 4525001 (13 de 17) |
| Base amarilla / Full White | **980** (a veces 950–977) | 4570104, 4570111, 4517504, 3110204 |

**Cruce con `precios.mdb` [H]**: la cantidad de base va con el **envase de la base (CAPA1/CAPA2)**:

| Envase de la base | Cantidad de base en las fórmulas |
|---|---|
| 3,7 / 18,5 L (bases amarilla, naranja, azul, verde, roja, Full White) | **980** (113 fórmulas), 950 (17) |
| 3 / 15 L | **880** (2.241), 800 (24), 850 (14) |
| 3,2 / 16 L | **880** (3.928), 850 (31) |

Esto explica las constantes 3.2 / 3.4 / 3.6 / 18.5 del exe: la validación compara el envase de la base. Que el exe pida 800 donde los datos tienen 880 apunta a una diferencia de versión (H1 + H2 combinadas). El usuario va a subir la tabla de bases para cerrarlo.

Hipótesis:
- **H1**: la versión del exe es anterior a los datos, y la regla cambió cuando apareció el sistema de 880.
- **H2**: la regla depende de la capacidad de envase de la base (por ejemplo 3,2 L en lata de 4 L ⇒ 800) y 880 corresponde a bases no contempladas por la validación.
- **H3**: la regla depende de un atributo de `Componentes` (tipo de base) que no vemos sin `precios.mdb`.

Lo que decide entre ellas: `precios.mdb` + la fecha del exe + intentar grabar una fórmula con 880 en la app.

### F.2 Validaciones de formulario [H]
- Producto: código, nombre, peso específico; precio y cantidad por capacidad.
- Búsqueda: fechas día/mes/año válidas ("La fecha inicial no es correcta").
- Rentabilidades: numéricas.
- Separador decimal según la configuración regional (`sepDec`).

### F.3 Cálculos

**Dosificación** [S, por encabezados de grilla]:
- `ml_i = CANT_i × Capacidad(L)` (porque CANT está expresado por cada 1000 c.c.).
  - Ejemplo, fórmula 5301 (código 1552) en 4 L: base 4514130 = 880 × 4 = **3.520 ml**; GVA 146 Limón = 59,78 × 4 = **239,1 ml**.
- `g_i = ml_i × PesoEsp_i`.
- Ejemplo completo con los PE reales de `precios.mdb`, fórmula 5301 en 4 L:

  | Componente | ml | g |
  |---|---|---|
  | 4514130 Laca Nitrocelulósica Transp. (PE 0,90) | 3.520 | 3.168,0 |
  | 4600000 GVA147 Blanco (PE 1,68) | 105,2 | 176,8 |
  | 4600004 GVA 124 Azul Orgánico (PE 1,09) | 1,8 | 1,9 |
  | 4600101 GVA 145 Amarillo Mediano (PE 1,09) | 133,9 | 145,9 |
  | 4600301 GVA 146 Limón (PE 1,10) | 239,1 | 263,0 |
- Si la unidad es **Kilos**: se convierte la capacidad con el peso específico de la mezcla, `PE_mezcla = Σ(CANT_i × PE_i)/1000` [S].

**Costo y precio — DEDUCIDO Y VERIFICADO contra las listas de precios reales** [H]

Evidencia usada:
- `PESO_ESP`: productos con precios reales.
- `EXPORT*.CSV`: listas de precios por producto, color y capacidad, calculadas por la app.
- 26 fórmulas del sistema viejo (colorantes "Concentrado" 4500xxx) **recuperadas de filas borradas** de `albamix.mdb` y `personal.mdb` con `herramientas/carve.py`.

**1. Capacidad final = envase de base completo ÷ fracción de base**

`Capacidad = CAPA_envase_base / (CANT_base / 1000)`

Se tinta **la lata de base entera** y el volumen final crece con los colorantes. Las capacidades de todas las listas cierran exactas:

| Envase de base | Fracción de base | Capacidad final |
|---|---|---|
| 3,2 / 16 L | 850 | **3,765 / 18,824** |
| 3,0 / 15 L | 800 | **3,75 / 18,75** |
| 3,4 / 17 L | 900 | **3,778 / 18,889** |
| 3,7 / 18,5 L | 980 | **3,776 / 18,878** |
| 5 / 20 L | 850 | **5,882 / 23,529** |

**2. Costo**

`Costo = PRECIO_envase_base + Σ_colorantes (CANT_i/1000 × Capacidad × PRECIO1_i / CAPA1_i)`

- La base entra con el **precio del envase completo**: PRECIO1 para el chico, PRECIO2 para el grande.
- Los colorantes entran por **precio por litro** (lata de 1 L).

**3. Precio**

`Precio = Costo × k`

`k` es **el mismo para los dos envases** de una fórmula (coincidencia de 6 decimales) y **depende de la base**:

| Base | k observado |
|---|---|
| 4581000 Caucho Clorado | ≈ 1,318 |
| 4570100 PU Acrílico | ≈ 1,392–1,397 |
| 4525000 Epoxi | ≈ 1,304 |

⇒ hay un **recargo o rentabilidad por producto base** aplicado a toda la fórmula [S: su origen exacto (rentabil.mdb, IVA, actualización de lista) está por confirmar].

**Ejemplo verificado (RAL 1012, base 4581000 en 3,2 L):**
- Fórmula recuperada: 850 c.c. de base + Concentrado Azul 8,45, Verde 7,77, Amarillo Orgánico 15,43, Amarillo Óxido 17,02, Blanco 26,32 y Neutro 75,01.
- Capacidad = 3,2 / 0,85 = **3,765 L**.
- Costo = 63,20 (lata de base) + 27,947 (colorantes) = **91,15**.
- Lista `EXPORT.CSV`: **$120,17** ⇒ k = 1,3184.
- En 16 L: costo = 304,41 + 139,735 = 444,15; lista: **$585,57** ⇒ k = 1,3184 (idéntico).

**Las 4 listas son de fechas distintas**: `FORMULAR` y `EXPORTAC` son más baratas y anteriores; `EXPORT` y `EXPORT20` son casi iguales. Se trata como **historial de listas de precios**.

**Pendiente** (decisión 5, para el final): confirmar de dónde sale `k`. Lo resuelve `rentabil.mdb` o la pantalla Bonificación y rentabilidad. Mientras tanto, la reescritura modela `k = (1 + rentabilidad_base)` configurable por producto base, con bonificación por componente en 0.

**Implicancia para el sistema nuevo (GVA)**: en `albamix.mdb` las bases van al 880/980 ⇒ capacidad final 3,2/0,88 = 3,636 L, 16/0,88 = 18,18 L, 3,7/0,98 = 3,776 L. La regla del exe (800/850/900/980 por envase) corresponde al **sistema viejo de Concentrados**. Para el sistema GVA la fracción de base sale de la tabla de bases.

---

## G) Requisitos para la reescritura

### G.1 Funcionales
- **FR-01** Catálogo de componentes: código de 7 dígitos, nombre, tipo (Base/Colorante/Accesorio), unidad, peso específico, N envases (capacidad + precio), bonificación y rentabilidad.
- **FR-02** Catálogo de envases/capacidades por producto (de `Capacidades`).
- **FR-03** Fórmulas con origen **Albamix (oficial, solo lectura)** o **Personal (editable)**.
- **FR-04** Búsqueda por rango de código, "nombre contiene" y rango de fecha, paginada (reemplaza el aviso de "puede demorar").
- **FR-05** Alta y edición de fórmula con las validaciones R1–R7. R5 y R7 como advertencias confirmables.
- **FR-06** Dosificar: elegir capacidad y unidad; ver ml, g, totales y precio.
- **FR-07** Cálculo de costo y precio con bonificación y rentabilidad (global, por tipo, por producto).
- **FR-08** Exportar a Excel (.xlsx nativo, sin automatizar Excel) y CSV; imprimir o PDF la dosificación (Calidad, Color, Obs, Capacidad, Precio, Componentes).
- **FR-09** No se puede borrar un componente en uso.
- **FR-10** Importador de las `.mdb` Jet 1.x (`jet1.py`) y de `Capacidades.mdb`.
- **FR-11** Roles: operador / supervisor (precios y márgenes) / admin. Reemplaza la clave única.
- **FR-12** Atajos de teclado equivalentes (F2 buscar, F5 agregar, F8 editar, F12 dosificar), porque los usuarios ya están acostumbrados.

### G.2 No funcionales
- **NFR-01 Rendimiento**: búsqueda sobre unas 6.500 fórmulas (o 10 veces más) en menos de 300 ms; dosificación en menos de 100 ms.
- **NFR-02 Concurrencia**: el original lo usaban varias PCs a la vez sobre Jet compartido (riesgo de corrupción). La reescritura necesita una base transaccional (Postgres) e IDs generados por la base, no `max+1`.
- **NFR-03 Seguridad**: auth con hash de clave (hoy está en texto plano o ofuscada); los precios solo se editan con rol autorizado.
- **NFR-04 Auditoría**: historial de cambios de precios y fórmulas (quién, cuándo, valor anterior). Hoy no existe.
- **NFR-05 Trazabilidad**: guardar la versión de precios usada en cada dosificación o presupuesto.
- **NFR-06 Precisión**: usar decimales exactos (no float) para cantidades y precios; redondeos definidos (CANT con 2 decimales).
- **NFR-07 Localización**: es-AR, coma decimal, formato dd/mm/yyyy, moneda $.
- **NFR-08 Disponibilidad — offline-first (decisión del usuario)**: el punto de venta funciona **sin internet**, con la base local en cada PC del distribuidor. Opciones de arquitectura:
  - (a) app de escritorio (Tauri o Electron) + SQLite local;
  - (b) PWA con IndexedDB y service worker.

  La versión online (Render o similar) queda **a evaluar**. Su uso sería central: publicar las fórmulas oficiales y la lista de precios, y que cada punto de venta las sincronice cuando tenga conexión. Las fórmulas personales quedan locales, con respaldo opcional.
- **NFR-09 Actualización de datos oficiales**: paquete versionado (fórmulas Albamix + precios) importable por archivo o por sincronización. Reemplaza el "copiar el albamix.mdb".

### G.3 Riesgos y puntos oscuros
1. La **fórmula de precio no está confirmada** (falta `precios.mdb` y `rentabil.mdb`). Es el riesgo más alto.
2. Regla R6: el exe y los datos no coinciden (S4).
3. Falta `personal.mdb`: no se sabe si tiene el mismo esquema ni cuántas fórmulas propias hay.
4. Unidad "Kilos": la conversión exacta no está confirmada.
5. Límites máximos de componentes y capacidades por fórmula: no se ven en strings (están en el p-code).
6. Nombres por cliente (PETINARI, OMBU…): ¿son clientes reales, con derecho a fórmulas propias? Puede requerir una entidad Cliente.
7. ~~4 bases sin descripción~~ (resuelto con `precios.mdb`). Precios reales ausentes: todo en 0,1.
8. La página 0 sobrescrita puede ocultar algún campo de la cabecera (idioma/orden) relevante para ordenar.

---

## H) Plan de replicación

### H.1 Orden sugerido
| Fase | Alcance | Criterio de listo |
|---|---|---|
| **0. Datos** | Migrar con `jet1.py` → CSV → seed: Componentes (con Capacidades), FormulasC/R, bonificaciones | Conteos 6.439 / 31.251 / 73 productos; 100% suma 1000 |
| **1. MVP consulta** | Búsqueda + detalle + dosificación en ml/g (sin precio) | Fórmula 5301 en 4 L da base 3.520 ml |
| **2. Costeo** | Precios por envase, bonificación, rentabilidad, precio final | Coincide con 3 capturas reales de la app vieja (±$0,01) |
| **3. Edición** | ABM de fórmulas personales y productos con R1–R9 | Tests de validación en verde |
| **4. Salidas** | Excel, CSV, PDF de dosificación | Mismo layout que el impreso original |
| **5. Seguridad y auditoría** | Roles, historial, versionado de precios | |
| **6. Online (a evaluar)** | Hub en Render: publicar paquetes de fórmulas y precios, sincronización | Un punto de venta offline se actualiza al reconectar |
| **7. Validar el precio** | Ajustar F.3 contra casos reales de la app vieja | Coincide con 3 capturas (±$0,01) |

**Decisión: app independiente, offline-first.**

Stack sugerido:
- **Tauri + React + SQLite**: un instalador liviano para Windows, sin servidor en el punto de venta.
- El mismo núcleo de dominio (validador, dosificación, costeo) en TypeScript compartido, para reutilizarlo en una futura versión web.
- La versión online (Render) se evalúa en la Fase 6 como "hub" de distribución de fórmulas oficiales y precios.
- Se pueden copiar ideas del modelo de Chromascan, pero sin dependencia de código.

La fórmula de precio arranca con la hipótesis F.3 (a) y se valida al final con casos reales (decisión 5).

### H.2 Pruebas a automatizar
- **Unitarias**: validador de fórmula, un caso por regla.
  - Suma 999,99 → error.
  - Base en línea 2 → error.
  - Componente repetido → error.
  - Código 0 → error.
  - Código + base existente → advertencia.
- **Unitarias**: dosificación y costo con casos de oro tomados de la app vieja.
- **Integración**: importador Jet 1.x contra los `.mdb` reales (conteos e invariantes del punto 0.2).
- **Integración**: borrar un componente en uso → 409.
- **E2E (Playwright)**: buscar "AMARILLO", abrir 1552, dosificar en 4 L, verificar ml y exportar a Excel.

### H.3 Datos semilla y escenarios
- **Seed real**: los CSV en `docs/albamix/datos/`.
- **Escenarios**:
  - (a) Fórmula de 5 líneas estándar: ID 5301, código 1552, base 4514130 con 880 + GVA 147/124/145/146.
  - (b) Base amarilla con 980: ID 12341, OBS "NUEVA BASE AMARILLA".
  - (c) Fórmula con OBS de accesorio (mateante 8%).
  - (d) Código con varios nombres por cliente: 5511.
  - (e) Duplicado código + base.
  - (f) Fórmula basura sin renglones: 5257, que hay que excluir en la migración.
  - (g) Producto en uso sin poder borrarse: 4600000 (5.871 usos).

---

## Huecos de información y próxima evidencia más útil

1. **`rentabil.mdb`**, o una captura de "Bonificación y rentabilidad": explica el factor `k` por base.
2. **El .mdb de bases**, para cerrar la fracción de base del sistema GVA (880/850/980).
3. **Una lista de precios exportada del sistema GVA actual** (fórmulas 4600xxx). Las 4 listas recibidas son del sistema viejo de Concentrados.
4. Precios actuales del sistema GVA: `precios.mdb` está en 0,1 y `PESO_ESP` es del sistema viejo.
5. ~~`precios.mdb`~~, ~~`personal.mdb`~~ y ~~Excel/CSV de precios~~: recibidos y analizados.
5. Fecha y versión del exe (Propiedades del archivo) para resolver S4.
6. Opcional: decompilar el p-code con VB Decompiler en Windows. Da las fórmulas exactas y los límites máximos.

## Preguntas que siguen abiertas
- (Pregunta 9, sin responder) ¿Qué es imprescindible en la primera versión? Propuesta: búsqueda + dosificación + precio.
- ¿Las variantes de nombre por cliente (PETINARI, OMBU, SALTO…) son clientes reales?
- En el punto de venta, ¿una PC o varias que comparten la misma base?
- Pendiente de recibir: el **.mdb de bases** (regla R6), además de `precios.mdb` y `rentabil.mdb` si existen.

---

## Paridad con la app original (decisión 2026-10-08)

La app nueva replica **todas** las funciones del Albamix original salvo la exportación a CSV, que se descarta por decisión del usuario.
Se suman al plan las funciones que faltaban:

| Función original | Etapa |
|---|---|
| Búsqueda por **rango de códigos** (desde/hasta) | MVP |
| Búsqueda por **rango de fechas** (desde/hasta) | MVP |
| **Ordenar** la lista de fórmulas / productos (asc. y desc.) | MVP |
| Esquema de rentabilidad **global + por tipo** (bases, colorantes, accesorios) **+ por producto** | Etapa 4 |
| Imprimir y exportar a Excel las listas de productos y fórmulas | Etapa 5 |
| ~~Exportar a CSV~~ | Descartado |

No se replica: compartir las bases entre varias PCs por carpeta de red (las PCs no comparten datos).

## Funcionalidades nuevas (decisión 2026-10-08)

| Funcionalidad | Qué hace | Etapa | Estado |
|---|---|---|---|
| **"Me pasé" en la balanza** | Si se vierte de más un componente, agranda toda la tanda en la misma proporción: de lo ya vertido pide solo la diferencia, de lo que falta la cantidad escalada, y avisa si hace falta base de otra lata | MVP | ✅ En el núcleo (`corregirExceso`) |
| **Aviso de cantidades muy chicas** | Marca componentes por debajo de 2 g (configurable) y sugiere la capacidad mínima o el envase de base con el que se pesan con seguridad | MVP | ✅ En el núcleo (`avisarCantidadesChicas`) |
| **Etiqueta para la lata con QR** | Color, producto, fecha, cliente, número de dosificación y QR que reabre la misma fórmula | Etapa 4 | Pendiente |
| **Repetir pedido del cliente** | Repite una dosificación del historial con la misma versión de fórmula, avisando si la oficial cambió | Etapa 4 | Pendiente |
| **Consumo de colorantes** | Descuenta lo usado en cada dosificación, reporte mensual y aviso de reposición | Después del piloto | Pendiente |

**Para evaluar más adelante:** presupuesto en PDF, recientes y favoritos, muestra de color orientativa para RAL,
corrección de tono guardada como fórmula personal derivada, novedades al actualizar fórmulas oficiales,
copia de seguridad automática.

## Etapa 2: importación y base local (2026-10-08)

- **Lector Jet 1.x genérico** (`packages/datos/src/jet1.ts`): lee las `.mdb` del original sin usar la cabecera dañada,
  arrancando por el catálogo del sistema. Descubre solas las tablas y columnas, así sirve para migrar el `personal.mdb`
  de cada distribuidor.
- **Importador** (`importar.ts`): productos (`precios.mdb` + `bonifica.mdb`), fórmulas oficiales (`albamix.mdb`) y
  personales (`personal.mdb`) al modelo del núcleo, con detección del sistema de colorantes y reporte de calidad.
- **Base local SQLite** (`base.ts`): es el "paquete de datos" que se distribuye. Incluye la búsqueda del MVP:
  código o nombre, rango de códigos, rango de fechas, producto, origen y orden ascendente/descendente.
- **Resultado con los datos reales**: 54 productos, 6.436 fórmulas oficiales + 2 personales, 31.259 renglones;
  3 fórmulas descartadas por no tener renglones; 894 nombres corregidos solo en espacios; 86 fórmulas repetidas
  para el mismo código y base (se conservan, como el original); **0 errores de validación** y 0 componentes faltantes.
- Pendiente: `Capacidades.mdb` (formato Access 2007) no se importa todavía; sus envases ya vienen en `precios.mdb`.

## Actualización de precios por Excel (2026-10-09)

- **Planilla**: mismo formato que el `PESO_ESP` del original (Tipo, Código, Nombre, Peso Esp., Precio 1, Capa. 1,
  Precio 2, Capa. 2, Unidad, Bonif., Rentab.) + encabezado con **Vigente desde**, **Número de lista** y **Notas**,
  validaciones de datos y dos columnas de control de **$ por litro**. Se genera con
  `herramientas/plantilla_precios.py` (precargada con el catálogo y los precios conocidos; los faltantes quedan en amarillo).
- **Lectura** (`packages/datos/src/excel.ts`): ubica columnas por nombre, acepta coma decimal, informa cada problema con
  fila y columna, y no incluye los productos con errores. Funciona aunque la planilla se haya guardado con otro programa.
- **Aplicación**: resume cambios de precio (con % de variación), productos nuevos, sin cambios y no incluidos
  (se conservan). Reemplaza productos y precios sin tocar las fórmulas, y **rechaza una lista que no sea posterior
  a la vigente**.
- CLI: `npm run precios -w @albamix/datos -- --excel lista.xlsx --base albamix-datos.sqlite [--aplicar]`.
- Dato a revisar detectado por el control: el Fondo Anticorrosivo Acrílico Tintable (3110203) figura en PESO_ESP a
  $ 7,78 la lata de 16 L ($ 0,49/L), muy por debajo del resto.

## Etapa 3: app de Windows, versión de prueba (2026-10-09)

- **Tauri 2** (`apps/escritorio`): ventana de Windows con las pantallas web. Instalador NSIS **por usuario** (sin
  administrador) y **versión portable** (`.exe` sin instalar). WebView2: lo trae Windows 11/10 actualizado; si falta,
  el instalador lo descarga.
- **Sin datos incluidos**: en el primer uso se importan las `.mdb` del Albamix viejo desde la propia app.
- **Base local**: SQLite en WebAssembly (sql.js) guardado en IndexedDB, dentro del perfil del usuario. Copia de seguridad
  y restauración por archivo `.sqlite`. El mismo código corre en un navegador (plan B si IT bloquea el instalador).
- **Pantallas**: Buscar (texto, sistema, origen Albamix/Personales, producto, rango de códigos y fechas, orden),
  Dosificar (pesada paso a paso, "Me pasé", aviso de cantidades chicas, modo COROB, precio, imprimir) y Datos
  (importar, lista de precios Excel, rentabilidad general, peso mínimo de balanza, copia de seguridad).
- **Precio**: si algún componente no tiene precio cargado (precios.mdb trae $0,10), se muestra "Precio pendiente".
- **Prueba de punta a punta** (navegador real sobre la app empaquetada): importación de las 6.438 fórmulas en 0,6 s,
  búsqueda, dosificación con corrección, carga y aplicación de la planilla de precios, copia de seguridad y persistencia
  al reabrir.
- **Diseño**: el de la vista previa (opción D). El rediseño estético queda para una etapa posterior.
- Pendiente: separar la base en "oficial" y "distribuidor"; paquete de actualización firmado; integración COROB.
