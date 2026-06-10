def check_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    checks = [
        'id="gain-modal-overlay"',
        'id="purchase-modal-overlay"',
        'id="maintenance-modal-overlay"',
        'modal-form-grid',
        'modal-wide',
    ]
    print(f"File has {len(lines)} lines.\n")
    for needle in checks:
        hits = [(i+1, l.strip()) for i, l in enumerate(lines) if needle in l]
        print(f"'{needle}' — {len(hits)} occurrence(s):")
        for ln, text in hits:
            print(f"   L{ln}: {text[:90]}")

if __name__ == '__main__':
    check_file('lab_app/web/templates/index.html')
