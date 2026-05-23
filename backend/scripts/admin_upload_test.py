import requests
import time
import os

BASE = 'http://localhost:3000'
ADMIN_EMAIL = 'admin@centre-ophtalmo.fr'
ADMIN_PW = 'admin123'
TEST_DCM = os.path.join(os.path.dirname(__file__), '..', 'public', 'test_images', 'test_image.dcm')

s = requests.Session()
# Login
r = s.post(f'{BASE}/api/auth/login', json={'email': ADMIN_EMAIL, 'password': ADMIN_PW})
print('Login status:', r.status_code)
print(r.text)
if r.status_code != 200:
    raise SystemExit('Login failed')

auth = r.json().get('data', {})
token = auth.get('access_token')
if not token:
    raise SystemExit('No token')

# Get patients
r = s.get(f'{BASE}/api/patients', headers={'Authorization': f'Bearer {token}'})
print('Patients:', r.status_code)
print(r.text[:500])
if r.status_code != 200:
    raise SystemExit('Failed patients')
patients = r.json().get('data', {}).get('patients', [])
if not patients:
    raise SystemExit('No patients found')
patient_id = patients[0]['id']

# Get doctors
r = s.get(f'{BASE}/api/doctors', headers={'Authorization': f'Bearer {token}'})
print('Doctors:', r.status_code)
print(r.text[:500])
if r.status_code != 200:
    raise SystemExit('Failed doctors')
doctors = r.json().get('data', {}).get('doctors', [])
if not doctors:
    raise SystemExit('No doctors found')
doctor_id = doctors[0]['id']

# Upload DICOM
with open(TEST_DCM, 'rb') as f:
    files = {'image': ('test_image.dcm', f, 'application/dicom')}
    data = {'patient_id': str(patient_id), 'doctor_id': str(doctor_id), 'eye_type': 'OD', 'notes': 'Test upload DICOM via script'}
    r = s.post(f'{BASE}/api/exams/submit', headers={'Authorization': f'Bearer {token}'}, files=files, data=data)

print('Submit status:', r.status_code)
print(r.text[:1000])
if r.status_code not in (200,201):
    raise SystemExit('Submit failed')
resp = r.json()
exam_id = resp.get('data', {}).get('id')
if not exam_id:
    raise SystemExit('No exam id returned')

print('Created exam id:', exam_id)

# Poll exam until analyzed or timeout
timeout = 60
start = time.time()
while time.time() - start < timeout:
    r = s.get(f'{BASE}/api/exams/{exam_id}', headers={'Authorization': f'Bearer {token}'})
    if r.status_code == 200:
        j = r.json().get('data')
        grade = j.get('grade')
        print('Exam data:', j)
        if grade is not None and grade >= 0:
            print('Analysis complete')
            break
    else:
        print('Failed fetching exam', r.status_code, r.text)
    time.sleep(2)
else:
    print('Timeout waiting for analysis')

# Print preview/original/heatmap URLs
r = s.get(f'{BASE}/api/exams/{exam_id}', headers={'Authorization': f'Bearer {token}'})
print('Final exam fetch status:', r.status_code)
print(r.text)


