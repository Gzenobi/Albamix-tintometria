# Albamix – Tintometría

Plataforma para costear colores de la línea ALBAMIX.

Reescritura del **Albamix – Sistema Industrial** (Visual Basic 3 + Access 1.x) como app **offline para Windows 10+**, para distribuidores AkzoNobel en Argentina.

- Especificación completa (ingeniería inversa, reglas, plan): [`docs/ESPECIFICACION_ALBAMIX.md`](docs/ESPECIFICACION_ALBAMIX.md)
- Herramientas para leer las `.mdb` originales (Jet 1.x con cabecera dañada): [`herramientas/`](herramientas/)

## Estructura

| Paquete | Qué es |
|---|---|
| `packages/core` | Núcleo de dominio sin UI: validación de fórmulas, dosificación (ml / gramos), precio, "me pasé" y aviso de cantidades chicas |
| `packages/datos` | Lector de las `.mdb` originales (Access 1.x con cabecera dañada), importador y base local SQLite con la búsqueda del MVP |

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

## Estado

Etapa 1 (núcleo de cálculo) completa. Etapa 2 (importación y base local) completa. Ver el plan en la sección H de la especificación.
