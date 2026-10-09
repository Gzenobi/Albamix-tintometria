# Instalar la versión de prueba de Albamix Tintometría

Hay dos formas de usarla en Windows 10 u 11. Ninguna pide permisos de administrador.

| Archivo | Qué es | Cuándo usarlo |
|---|---|---|
| `Albamix Tintometria_0.1.0_x64-setup.exe` | **Instalador** por usuario | Uso normal: crea acceso directo en el menú Inicio |
| `Albamix-Tintometria-portable.exe` | **Versión portable** | Si la PC no deja instalar programas: se ejecuta directamente, sin instalar |

## 1. Descargar

1. Entrá a <https://github.com/Gzenobi/albamix-tintometria/actions>.
2. Abrí la última ejecución de **"Pruebas y versión de Windows"** que tenga el tilde verde.
3. Abajo de todo, en **Artifacts**, descargá **albamix-windows-N** (un `.zip`).
4. Descomprimí el `.zip`: adentro están los dos archivos de la tabla.

## 2. Instalar o ejecutar

**Instalador:** doble clic en `Albamix Tintometria_0.1.0_x64-setup.exe` y seguí los pasos.

**Portable:** copiá `Albamix-Tintometria-portable.exe` a una carpeta (por ejemplo, Documentos) y hacé doble clic.

### Si aparece "Windows protegió su PC"

La versión de prueba no tiene firma digital, así que Windows avisa la primera vez:

1. Hacé clic en **Más información**.
2. Hacé clic en **Ejecutar de todos modos**.

Si en la PC de AkzoNobel no aparece el botón **Ejecutar de todos modos**, o el antivirus borra el archivo, es una restricción de IT. En ese caso, anotá el mensaje exacto (o sacá una captura) para buscar la alternativa: versión portable, versión web desde Edge o aprobación de IT.

### Si dice que falta "WebView2"

Windows 11 y Windows 10 actualizado ya lo traen. Si falta, el instalador intenta descargarlo (necesita internet esa única vez). La versión portable no lo puede instalar: en ese caso usá el instalador.

## 3. Primer uso

1. La app abre en la pantalla **"Cargá las fórmulas para empezar"**.
2. Tocá **Importar desde el Albamix viejo** y elegí, de la carpeta `bases` del Albamix viejo:
   `precios.mdb` (obligatorio), `albamix.mdb`, `personal.mdb` y `bonifica.mdb`. Se pueden seleccionar todos juntos con Ctrl.
3. En unos segundos aparecen las fórmulas. Quedan guardadas en esa PC.
4. Para tener precios: pestaña **Datos** → **Cargar planilla de precios** → elegí la planilla Excel → revisá los cambios → **Aplicar lista de precios**.
5. En **Datos** también se configura la rentabilidad general y el peso mínimo de la balanza.

## 4. Dónde quedan los datos

En la carpeta del usuario de Windows (perfil de la app, dentro de `AppData\Local`). No se escribe en ninguna otra carpeta ni se usa internet.

Para no perder nada: **Datos** → **Guardar copia** genera un archivo `albamix-copia-AAAA-MM-DD.sqlite` en Descargas. Con **Restaurar copia** se vuelve a cargar, en la misma PC o en otra.

## 5. Qué probar y qué anotar

En cada PC (la alternativa y la de AkzoNobel):

- [ ] ¿Se pudo descargar el `.zip`? ¿El antivirus lo dejó?
- [ ] ¿Se instaló (o abrió la portable)? ¿Qué mensaje mostró Windows?
- [ ] ¿Se importaron las bases del Albamix viejo?
- [ ] Buscar un color, dosificarlo, usar **Me pasé** e **Imprimir orden** (¿aparece la impresora?).
- [ ] Cargar la planilla de precios y ver el precio.
- [ ] **Guardar copia**: ¿se descargó el archivo?
- [ ] Cerrar la app, volver a abrirla: ¿siguen los datos?

## Desinstalar

Configuración de Windows → Aplicaciones → **Albamix Tintometria** → Desinstalar. La versión portable se borra eliminando el archivo.
