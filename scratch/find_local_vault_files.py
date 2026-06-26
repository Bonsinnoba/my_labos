import os

def find_enc_gz():
    search_root = 'c:\\Users\\balik\\Iven'
    print(f"Searching for .enc and .gz files in {search_root}:")
    count = 0
    for root, dirs, files in os.walk(search_root):
        # Skip node_modules and .git
        if 'node_modules' in root or '.git' in root or '__pycache__' in root:
            continue
        for f in files:
            if f.endswith('.enc') or f.endswith('.gz') or '.png' in f or '.mp4' in f:
                file_path = os.path.join(root, f)
                print(f"  {file_path} ({os.path.getsize(file_path)} bytes)")
                count += 1
                if count > 50:
                    print("... too many files, stopping list")
                    return

if __name__ == '__main__':
    find_enc_gz()
