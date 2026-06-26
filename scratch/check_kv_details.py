import sqlite3

def check_kv():
    conn = sqlite3.connect('local_cache.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM knowledge_vault")
        rows = cur.fetchall()
        for i, r in enumerate(rows):
            print(f"Row {i+1}:")
            for col in r.keys():
                print(f"  {col}: {r[col]}")
    except Exception as e:
        print("Error:", e)
    finally:
        conn.close()

if __name__ == '__main__':
    check_kv()
