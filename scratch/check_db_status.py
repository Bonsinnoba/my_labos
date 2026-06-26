import sqlite3

def check_db():
    conn = sqlite3.connect('local_cache.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        print('Tables in local_cache.db:', tables)
        for t in tables:
            cur.execute(f"SELECT COUNT(*) FROM {t}")
            cnt = cur.fetchone()[0]
            print(f"Table '{t}' has {cnt} rows")
            
            # If documents, list them
            if t == 'documents':
                cur.execute("SELECT id, title, file_name, file_type, file_size FROM documents")
                for r in cur.fetchall():
                    print(f"  Doc: id={r[0]}, title={r[1]}, file={r[2]}, type={r[3]}, size={r[4]}")
            if t == 'notebook_entries':
                cur.execute("SELECT id, title, updated_at FROM notebook_entries")
                for r in cur.fetchall():
                    print(f"  Note: id={r[0]}, title={r[1]}, updated_at={r[2]}")
    except Exception as e:
        print("Error checking local_cache.db:", e)
    finally:
        conn.close()

    # Also check lab_app/local_cache.db if it exists
    import os
    if os.path.exists('lab_app/local_cache.db'):
        print("\nChecking lab_app/local_cache.db:")
        conn2 = sqlite3.connect('lab_app/local_cache.db')
        conn2.row_factory = sqlite3.Row
        cur2 = conn2.cursor()
        try:
            cur2.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables2 = [r[0] for r in cur2.fetchall()]
            print('Tables in lab_app/local_cache.db:', tables2)
            for t in tables2:
                cur2.execute(f"SELECT COUNT(*) FROM {t}")
                cnt = cur2.fetchone()[0]
                print(f"Table '{t}' has {cnt} rows")
                if t == 'documents':
                    cur2.execute("SELECT id, title, file_name, file_type, file_size FROM documents")
                    for r in cur2.fetchall():
                        print(f"  Doc: id={r[0]}, title={r[1]}, file={r[2]}, type={r[3]}, size={r[4]}")
                if t == 'notebook_entries':
                    cur2.execute("SELECT id, title, updated_at FROM notebook_entries")
                    for r in cur2.fetchall():
                        print(f"  Note: id={r[0]}, title={r[1]}, updated_at={r[2]}")
        except Exception as e:
            print("Error checking lab_app/local_cache.db:", e)
        finally:
            conn2.close()

if __name__ == '__main__':
    check_db()
