import sqlite3

def check_note_2():
    conn = sqlite3.connect('local_cache.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM notebook_entries WHERE id = 18") # or second row
        row = cur.fetchone()
        if not row:
            cur.execute("SELECT * FROM notebook_entries")
            rows = cur.fetchall()
            if len(rows) > 1:
                row = rows[1]
        if row:
            print("Row details:")
            for col in row.keys():
                val = row[col]
                if col == 'content':
                    print(f"  content (truncated): {repr(val[:200])}...")
                else:
                    print(f"  {col}: {repr(val)}")
        else:
            print("No second row found.")
    except Exception as e:
        print("Error:", e)
    finally:
        conn.close()

if __name__ == '__main__':
    check_note_2()
