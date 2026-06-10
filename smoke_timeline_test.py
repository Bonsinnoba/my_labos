import json
import urllib.request

BASE = 'http://127.0.0.1:8000'

def post(path, data):
    url = BASE + path
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req) as r:
        return json.load(r)

def get(path):
    url = BASE + path
    with urllib.request.urlopen(url) as r:
        return json.load(r)

print('Creating project...')
proj = post('/api/projects', {'name': 'Smoke Project 2', 'description': 'smoke test'})
print('Project response:', proj)
proj_id = proj.get('id') or (proj.get('data') and proj['data'].get('id'))
if not proj_id:
    print('Failed to get project id from response')

print('Creating experiment...')
exp = post('/api/logs', {'log_title': 'Smoke Experiment 2', 'log_text': 'desc', 'project_id': proj_id})
print('Experiment response:', exp)
exp_id = exp.get('data', {}).get('id')

print('Creating stage...')
st = post('/api/experiment_stages', {'experiment_id': exp_id, 'stage_name': 'Hypothesis', 'owner': 'tester'})
print('Stage response:', st)

print('Creating usage...')
usage = post('/api/usage', {'experiment_id': exp_id, 'project_id': proj_id, 'entity_type': 'component', 'entity_id': 1, 'quantity_used': 1, 'unit': 'pcs', 'post_use_status': 'usable', 'notes': 'smoke usage', 'auto_update_inventory': False})
print('Usage response:', usage)

print('Fetching stages for experiment...')
stages = get(f'/api/experiment_stages?experiment_id={exp_id}')
print('Stages:', stages)

print('Fetching usage for experiment...')
usage_list = get(f'/api/usage?experiment_id={exp_id}')
print('Usage list:', usage_list)
