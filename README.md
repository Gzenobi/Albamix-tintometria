# Albamix – Tintometría

Plataforma para costear colores de la línea ALBAMIX.

Reescritura del **Albamix – Sistema Industrial** (Visual Basic 3 + Access 1.x) como app **offline para Windows 10+**, para distribuidores AkzoNobel en Argentina.

- Especificación completa (ingeniería inversa, reglas, plan): [`docs/ESPECIFICACION_ALBAMIX.md`](docs/ESPECIFICACION_ALBAMIX.md)
- Herramientas para leer las `.mdb` originales (Jet 1.x con cabecera dañada): [`herramientas/`](herramientas/)

## Estructura

| Paquete | Qué es |
|---|---|
| `packages/core` | Núcleo de dominio sin UI: validación de fórmulas, dosificación (ml / gramos), precio, "me pasé" y aviso de cantidades chicas |
| `packages/datos` | Lector de las `.mdb` originales (Access 1.x con cabecera dañada), importador, base local SQLite (motor intercambiable: sql.js en la app, node:sqlite en Node), búsqueda y lista de precios por Excel |
| `apps/escritorio` | App de Windows (Tauri): pantallas de búsqueda, dosificación paso a paso y datos. Corre también en un navegador |

## Desarrollo

```bash
npm install
npm test          # tests del núcleo, incluye casos de oro contra listas de precios reales
npm run typecheck

# Generar el paquete de datos a partir de las .mdb originales
npm run importar -w @albamix/datos -- --precios precios.mdb --albamix albamix.mdb \
    --personal personal.mdb --bonifica bonifica.mdb --salida albamix-datos.sqlite
```

El test de importación completa corre solo si se indica dónde está `albamix.mdb` (no se versiona):
`ALBAMIX_MDB=/ruta/albamix.mdb npm test`

## App de escritorio

```bash
npm run dev -w @albamix/escritorio     # pantallas en el navegador (http://localhost:1420)
npm run build -w @albamix/escritorio   # empaquetado web en apps/escritorio/dist
```

El instalador de Windows lo arma GitHub Actions (`.github/workflows/windows.yml`) en cada push:
se descarga desde la pestaña **Actions** del repositorio. Guía para instalar y probar: [`docs/INSTALACION.md`](docs/INSTALACION.md).

## Estado

Etapas 1 (núcleo) y 2 (importación y base local) completas. Etapa 3 (app de Windows): versión de prueba. Ver el plan en la sección H de la especificación.
