import sqlite3

conn = sqlite3.connect('C:\\Users\\balik\\Iven\\my_lab\\local_cache.db')
cursor = conn.cursor()

# Clear all DELETE entries from asset_sync_log
cursor.execute("DELETE FROM asset_sync_log WHERE action_type = 'DELETE'")
affected = cursor.rowcount
conn.commit()
conn.close()

print(f"Cleared {affected} deletion log entries from asset_sync_log")
