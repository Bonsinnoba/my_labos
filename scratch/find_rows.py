with open('scratch/notes_debug.txt', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if line.startswith('Row ') or 'title:' in line:
            print(f"Line {i+1}: {line[:100].strip()}")
