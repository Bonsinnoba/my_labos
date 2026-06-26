import os

def find_specific_files():
    search_dirs = [
        'c:\\Users\\balik\\Iven\\my_lab',
        'c:\\Users\\balik\\Iven\\instapods-hub'
    ]
    for d in search_dirs:
        if os.path.exists(d):
            print(f"Searching in {d}:")
            for root, dirs, files in os.walk(d):
                # Skip build, cache, temp, git, node_modules, env
                if any(x in root for x in ['node_modules', '.git', '__pycache__', '.venv', 'venv']):
                    continue
                for f in files:
                    if any(x in f for x in ['Recording', 'Gemini', '20260624', '20260623']):
                        print(f"  {os.path.join(root, f)} ({os.path.getsize(os.path.join(root, f))} bytes)")

if __name__ == '__main__':
    find_specific_files()
