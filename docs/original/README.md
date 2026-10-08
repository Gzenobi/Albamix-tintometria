# Albamix original (VB3): flujo y pantallas

- `flujo.png` / `flujo.svg`: diagrama de flujo de la aplicación original, deducido del ejecutable y de las bases
  (fuente editable: `flujo.dot`, se regenera con `dot -Tsvg flujo.dot -o flujo.svg`).
- `gen_pantallas.py`: genera **pantallas simuladas** estilo Windows 3.x con los textos reales del `.exe`
  (títulos, botones con teclas F, columnas, mensajes) y datos reales. Necesita `datos.json` y `golden.json`
  (no versionados porque contienen fórmulas y precios). La disposición de los controles es reconstruida:
  **no son capturas reales**, y cada imagen lo indica.
