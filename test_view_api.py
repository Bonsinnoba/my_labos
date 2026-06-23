import requests

for doc_id in [45, 43, 46, 44, 47, 48, 50]:
    response = requests.get(f'http://127.0.0.1:8000/api/documents/{doc_id}/view')
    print(f"ID {doc_id}: Status {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.text}")
