# Diseño de la interfaz

`vista-previa.template.html` es la vista previa navegable (HTML único, sin conexión). Es una plantilla: los marcadores
`__DATA__`, `__RENT__`, `__ALBAMIX__` y `__AKZO__` se completan con las fórmulas, la rentabilidad por base y los logos
al generar la vista previa. El archivo generado no se versiona porque contiene todas las fórmulas.

## Principios

- **Quién lo usa**: el operador de tintometría en el mostrador, de pie frente a la balanza, con las manos ocupadas.
- **El elemento central es la pesada paso a paso**: el paso actual se muestra en grande ("Agregá 33,7 g" y
  "La balanza tiene que marcar 3.873,7 g"). Enter o Espacio avanza; los pasos hechos quedan tachados. La numeración
  de pasos es correcta porque el orden de vertido es una secuencia real.
- **El ámbar Albamix se usa en un solo lugar**: el paso que se está pesando (recuadro y fila). Navy AkzoNobel para
  todo lo demás. Ver `assets/marca/README.md`.
- **Paneles planos con borde fino**, jerarquía por tamaño de letra; nada de tarjetas iguales con sombra.
- **Arial** (regla de marca), con números tabulares en todas las cifras.
- **Textos en el idioma del mostrador**, en primera persona del operador ("Agregá", "Listo, siguiente").
  Sin separadores "·" ni etiquetas en mayúsculas.
- **Datos faltantes en tono tranquilo**: "Precio pendiente" en gris, con la causa explicada, no en letra grande.
- Funciona en pantallas chicas: la columna "La balanza marca" pasa a "Balanza" y la ayuda de teclado se oculta.
