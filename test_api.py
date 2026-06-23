import requests
import json

response = requests.get('http://127.0.0.1:8000/api/documents')
print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")
