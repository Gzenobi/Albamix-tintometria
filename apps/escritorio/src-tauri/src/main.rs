// En Windows, sin ventana de consola detrás de la app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // La app es 100 % local: las pantallas, la base de datos (SQLite en WebAssembly) y los
    // cálculos corren dentro de la ventana. No abre puertos ni usa internet.
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Albamix");
}
