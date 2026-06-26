import sqlite3

def check_notes():
    conn = sqlite3.connect('local_cache.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM notebook_entries")
        rows = cur.fetchall()
        with open('scratch/notes_debug.txt', 'w', encoding='utf-8') as f:
            for i, r in enumerate(rows):
                f.write(f"Row {i+1}:\n")
                for col in r.keys():
                    f.write(f"  {col}: {repr(r[col])}\n")
        print("Wrote output to scratch/notes_debug.txt successfully.")
    except Exception as e:
        print("Error:", e)
    finally:
        conn.close()

if __name__ == '__main__':
    check_notes()
