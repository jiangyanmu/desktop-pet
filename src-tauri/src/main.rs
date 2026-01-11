#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::PhysicalPosition;

#[tauri::command]
fn get_screen_size(window: tauri::Window) -> Result<(f64, f64), String> {
    match window.current_monitor() {
        Ok(Some(monitor)) => {
            let size = monitor.size();
            Ok((size.width as f64, size.height as f64))
        }
        Ok(None) => Err("No monitor found".into()),
        Err(e) => Err(format!("Failed to get monitor: {:?}", e)),
    }
}

#[tauri::command]
fn move_window(window: tauri::Window, x: f64, y: f64) -> Result<(), String> {
    window
        .set_position(PhysicalPosition {
            x: x.round() as i32,
            y: y.round() as i32,
        })
        .map_err(|e| format!("Failed to move window: {:?}", e))
}

#[tauri::command]
fn drag_window(window: tauri::Window) -> Result<(), String> {
    // 正確使用 start_dragging()
    window
        .start_dragging()
        .map_err(|e| format!("Failed to start dragging window: {:?}", e))
}

#[tauri::command]
fn get_window_position(window: tauri::Window) -> Result<(f64, f64), String> {
    match window.outer_position() {
        Ok(pos) => Ok((pos.x as f64, pos.y as f64)),
        Err(err) => Err(format!("Failed to get window position: {:?}", err)),
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .invoke_handler(tauri::generate_handler![
            get_screen_size,
            move_window,
            drag_window,
            get_window_position,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
