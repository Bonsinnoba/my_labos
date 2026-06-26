import os

def find_files():
    search_dirs = [
        'C:\\Users\\balik\\Downloads',
        'C:\\Users\\balik\\Desktop',
        'C:\\Users\\balik\\Documents'
    ]
    for d in search_dirs:
        if os.path.exists(d):
            print(f"Searching in {d}:")
            for f in os.listdir(d):
                if any(x in f for x in ['Recording', 'Gemini', '20260624', '20260623']):
                    print(f"  {f} ({os.path.getsize(os.path.join(d, f))} bytes)")

if __name__ == '__main__':
    find_files()
