export const BACKUP_COMPLETED_KEY = "admin_database_backup_completed"
export const BACKUP_DISMISSED_KEY = "admin_database_backup_reminder_dismissed"

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function markDatabaseBackupCompleted() {
  if (typeof window === "undefined") return
  localStorage.setItem(BACKUP_COMPLETED_KEY, localDateKey())
  window.dispatchEvent(new Event("database-backup-completed"))
}
