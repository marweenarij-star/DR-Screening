<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nouvel Examen - Dépistage Rétinopathie</title>
    <link rel="stylesheet" href="/diabetic-retinopathy/php-app/public/css/app.css">
</head>
<body>
    <div class="app-layout">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="4"/>
                    </svg>
                    <h1>DR Screening</h1>
                </div>
            </div>
            
            <nav class="sidebar-nav">
                <a href="/diabetic-retinopathy/php-app/public/center/patients" class="nav-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                    </svg>
                    <span>Patients</span>
                </a>
                
                <a href="/diabetic-retinopathy/php-app/public/center/doctors" class="nav-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>Médecins</span>
                </a>
                
                <a href="/diabetic-retinopathy/php-app/public/center/new-exam" class="nav-item active">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="16"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                    <span>Nouvel Examen</span>
                </a>
            </nav>
            
            <div class="sidebar-footer">
                <div class="user-info">
                    <div class="user-avatar">A</div>
                    <div class="user-details">
                        <div class="user-name">Administrateur</div>
                        <div class="user-role">Centre médical</div>
                    </div>
                </div>
                <a href="#" class="nav-item mt-sm" data-logout>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span>Déconnexion</span>
                </a>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            <header class="page-header">
                <div class="page-header-content">
                    <h1 class="page-title">Nouvel Examen de Fond d'Œil</h1>
                </div>
            </header>
            
            <div class="page-body">
                <form id="examForm">
                    <div class="card mb-lg">
                        <div class="card-header">
                            <h3 class="card-title">1. Sélection du Patient et Médecin</h3>
                        </div>
                        <div class="card-body">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label required">Patient</label>
                                    <select name="patient_id" id="patientSelect" class="form-control" required>
                                        <option value="">Chargement...</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label required">Médecin assigné</label>
                                    <select name="doctor_id" id="doctorSelect" class="form-control" required>
                                        <option value="">Chargement...</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Œil examiné</label>
                                    <select name="eye" class="form-control">
                                        <option value="unknown">Non spécifié</option>
                                        <option value="left">Œil gauche</option>
                                        <option value="right">Œil droit</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Notes</label>
                                    <input type="text" name="notes" class="form-control" placeholder="Notes optionnelles...">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-lg">
                        <div class="card-header">
                            <h3 class="card-title">2. Image du Fond d'Œil</h3>
                        </div>
                        <div class="card-body">
                            <div class="file-upload" id="imageUpload">
                                <svg class="file-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <p class="file-upload-text">
                                    <strong>Cliquez ou glissez-déposez</strong> une image de fond d'œil
                                </p>
                                <p class="file-upload-hint">
                                    Formats acceptés: JPG, PNG • Taille max: 10 MB
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body">
                            <button type="submit" class="btn btn-primary btn-lg w-full" id="submitBtn">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                <span id="btnText">Analyser et Enregistrer</span>
                                <span id="btnLoading" class="hidden">Analyse en cours...</span>
                            </button>
                        </div>
                    </div>
                </form>

                <!-- Result Card (hidden initially) -->
                <div id="resultCard" class="card mt-lg hidden">
                    <div class="card-header">
                        <h3 class="card-title">Résultat de l'Analyse</h3>
                    </div>
                    <div class="card-body" id="resultContent">
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script src="/diabetic-retinopathy/php-app/public/js/app.js"></script>
    <script>
        // Check auth
        if (!Auth.isAuthenticated()) {
            window.location.href = '/diabetic-retinopathy/php-app/public/login';
        }

        let fileUploader;

        // Load patients and doctors
        async function loadFormData() {
            try {
                // Load patients
                const patientsResponse = await API.get('/center/patients?per_page=100');
                const patientSelect = document.getElementById('patientSelect');
                patientSelect.innerHTML = '<option value="">-- Sélectionner un patient --</option>' +
                    patientsResponse.data.patients.map(p => 
                        `<option value="${p.id}">${p.full_name} (${p.medical_record_number || 'N/A'})</option>`
                    ).join('');

                // Load doctors
                const doctorsResponse = await API.get('/center/doctors');
                const doctorSelect = document.getElementById('doctorSelect');
                const activeDoctors = doctorsResponse.data.doctors.filter(d => d.is_active);
                doctorSelect.innerHTML = '<option value="">-- Sélectionner un médecin --</option>' +
                    activeDoctors.map(d => 
                        `<option value="${d.id}">Dr. ${d.name}${d.speciality ? ' - ' + d.speciality : ''}</option>`
                    ).join('');

            } catch (error) {
                Toast.error('Erreur lors du chargement des données: ' + error.message);
            }
        }

        // Initialize file uploader
        document.addEventListener('DOMContentLoaded', () => {
            fileUploader = new FileUploader('#imageUpload', {
                maxSize: 10 * 1024 * 1024,
                allowedTypes: ['image/jpeg', 'image/png', 'image/jpg']
            });

            loadFormData();
        });

        // Form submission
        document.getElementById('examForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            // Validate
            const patientId = document.getElementById('patientSelect').value;
            const doctorId = document.getElementById('doctorSelect').value;
            const file = fileUploader.getFile();

            if (!patientId) {
                Toast.error('Veuillez sélectionner un patient');
                return;
            }
            if (!doctorId) {
                Toast.error('Veuillez sélectionner un médecin');
                return;
            }
            if (!file) {
                Toast.error('Veuillez sélectionner une image');
                return;
            }

            // Show loading
            const submitBtn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btnText');
            const btnLoading = document.getElementById('btnLoading');
            
            submitBtn.disabled = true;
            btnText.classList.add('hidden');
            btnLoading.classList.remove('hidden');

            try {
                // Prepare form data
                const formData = new FormData();
                formData.append('patient_id', patientId);
                formData.append('doctor_id', doctorId);
                formData.append('eye', document.querySelector('[name="eye"]').value);
                formData.append('notes', document.querySelector('[name="notes"]').value);
                formData.append('image', file);

                // Submit
                const response = await API.post('/exams', formData);

                // Show success
                Toast.success('Examen créé avec succès!');
                
                // Show result
                showResult(response.data);

                // Reset form
                document.getElementById('examForm').reset();
                fileUploader.reset();
                loadFormData();

            } catch (error) {
                Toast.error(error.message || 'Erreur lors de la création de l\'examen');
            } finally {
                submitBtn.disabled = false;
                btnText.classList.remove('hidden');
                btnLoading.classList.add('hidden');
            }
        });

        function showResult(data) {
            const resultCard = document.getElementById('resultCard');
            const resultContent = document.getElementById('resultContent');
            
            const exam = data.exam;
            const patient = data.patient;
            const alert = data.alert;

            const gradeLabels = {
                0: 'Pas de Rétinopathie Diabétique',
                1: 'RD Non Proliférante Légère',
                2: 'RD Non Proliférante Modérée',
                3: 'RD Non Proliférante Sévère',
                4: 'RD Proliférante'
            };

            const gradeClasses = {
                0: 'badge-success',
                1: 'badge-info',
                2: 'badge-warning',
                3: 'badge-danger',
                4: 'badge-critical'
            };

            resultContent.innerHTML = `
                <div class="${exam.grade >= 3 ? 'alert alert-danger' : 'alert alert-success'} mb-lg">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${exam.grade >= 3 
                            ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
                            : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}
                    </svg>
                    <div>
                        <strong>${exam.grade >= 3 ? 'Cas Urgent - Attention Requise' : 'Analyse Terminée'}</strong>
                        <p class="mb-0">
                            ${exam.grade >= 3 
                                ? 'Un cas sévère a été détecté. Le médecin a été notifié par email et alerte.' 
                                : 'L\'examen a été enregistré et le médecin peut maintenant le consulter.'}
                        </p>
                    </div>
                </div>

                <div class="patient-card mb-lg">
                    <div class="patient-field">
                        <span class="patient-field-label">Patient</span>
                        <span class="patient-field-value">${patient.full_name}</span>
                    </div>
                    <div class="patient-field">
                        <span class="patient-field-label">N° Dossier</span>
                        <span class="patient-field-value">${patient.medical_record_number || '-'}</span>
                    </div>
                    <div class="patient-field">
                        <span class="patient-field-label">Grade</span>
                        <span class="badge ${gradeClasses[exam.grade]}">${gradeLabels[exam.grade]}</span>
                    </div>
                    <div class="patient-field">
                        <span class="patient-field-label">Confiance IA</span>
                        <span class="patient-field-value">${parseFloat(exam.confidence).toFixed(1)}%</span>
                    </div>
                </div>

                <div class="image-grid">
                    <div class="image-card">
                        <div class="image-card-header">Image Originale</div>
                        <div class="image-card-body">
                            <img src="/diabetic-retinopathy/php-app/public/${exam.image_path}" alt="Image originale">
                        </div>
                    </div>
                    ${exam.overlay_path ? `
                    <div class="image-card">
                        <div class="image-card-header">Analyse Grad-CAM</div>
                        <div class="image-card-body">
                            <img src="/diabetic-retinopathy/php-app/public/${exam.overlay_path}" alt="Overlay Grad-CAM">
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;

            resultCard.classList.remove('hidden');
            resultCard.scrollIntoView({ behavior: 'smooth' });
        }
    </script>
</body>
</html>
