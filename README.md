# Albamix – Tintometría

Plataforma para costear colores de la línea ALBAMIX.

Reescritura del **Albamix – Sistema Industrial** (Visual Basic 3 + Access 1.x) como app **offline para Windows 10+**, para distribuidores AkzoNobel en Argentina.

- Especificación completa (ingeniería inversa, reglas, plan): [`docs/ESPECIFICACION_ALBAMIX.md`](docs/ESPECIFICACION_ALBAMIX.md)
- Herramientas para leer las `.mdb` originales (Jet 1.x con cabecera dañada): [`herramientas/`](herramientas/)

## Estructura

| Paquete | Qué es |
|---|---|
| `packages/core` | Núcleo de dominio sin UI: validación de fórmulas, dosificación (ml / gramos) y precio |

## Desarrollo

```bash
npm install
npm test          # tests del núcleo, incluye casos de oro contra listas de precios reales
npm run typecheck
```

## Estado

Etapa 1 (núcleo de cálculo) — en curso. Ver el plan en la sección H de la especificación.
