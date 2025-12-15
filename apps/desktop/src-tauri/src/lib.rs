mod commands;
mod db;
mod error;
mod export;
mod models;
mod search;
mod sync;

use commands::{
    // Notes
    create_note, delete_note, get_note, get_trashed_notes, list_notes, restore_note, update_note,
    // Notebooks
    create_notebook, delete_notebook, get_child_notebooks, get_notebook, get_root_notebooks,
    list_notebooks, update_notebook,
    // Tags
    create_tag, delete_tag, find_or_create_tag, get_tag, get_tag_by_name, list_tags, merge_tags,
    update_tag,
    // Reminders
    complete_reminder, create_reminder, delete_note_reminders, delete_reminder, get_due_reminders,
    get_overdue_reminders, get_reminder, get_reminders_by_note, get_today_reminders,
    get_upcoming_reminders, list_reminders, mark_reminder_notified, update_reminder,
};

use export::{export_data, get_export_preview, import_data};

use search::{rebuild_search_index, search};

use sync::{
    apply_remote_changes, check_server_connection, get_local_sync_state, get_pending_changes,
    mark_changes_pushed, prepare_sync, sync_with_server,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            db::init_database(&app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Notes
            list_notes,
            get_note,
            create_note,
            update_note,
            delete_note,
            restore_note,
            get_trashed_notes,
            // Notebooks
            list_notebooks,
            get_notebook,
            create_notebook,
            update_notebook,
            delete_notebook,
            get_root_notebooks,
            get_child_notebooks,
            // Tags
            list_tags,
            get_tag,
            get_tag_by_name,
            create_tag,
            find_or_create_tag,
            update_tag,
            delete_tag,
            merge_tags,
            // Sync
            get_local_sync_state,
            get_pending_changes,
            apply_remote_changes,
            mark_changes_pushed,
            prepare_sync,
            sync_with_server,
            check_server_connection,
            // Search
            search,
            rebuild_search_index,
            // Export/Import
            export_data,
            import_data,
            get_export_preview,
            // Reminders
            list_reminders,
            get_reminder,
            get_reminders_by_note,
            get_upcoming_reminders,
            get_overdue_reminders,
            get_today_reminders,
            get_due_reminders,
            create_reminder,
            update_reminder,
            complete_reminder,
            mark_reminder_notified,
            delete_reminder,
            delete_note_reminders,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
