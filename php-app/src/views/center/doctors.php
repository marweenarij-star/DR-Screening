<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestion des Médecins - Dépistage Rétinopathie</title>
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
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span>Patients</span>
                </a>
                
                <a href="/diabetic-retinopathy/php-app/public/center/doctors" class="nav-item active">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>Médecins</span>
                </a>
                
                <a href="/diabetic-retinopathy/php-app/public/center/new-exam" class="nav-item">
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
                    <h1 class="page-title">Gestion des Médecins</h1>
                    <button class="btn btn-primary" onclick="showDoctorModal()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Nouveau Médecin
                    </button>
                </div>
            </header>
            
            <div class="page-body">
                <!-- Stats -->
                <div class="stats-grid" id="doctorStats">
                    <div class="stat-card">
                        <div class="stat-icon primary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                            </svg>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="totalDoctors">-</div>
                            <div class="stat-label">Médecins actifs</div>
                        </div>
                    </div>
                </div>

                <!-- Doctors Table -->
                <div class="card">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Nom</th>
                                    <th>Email</th>
                                    <th>Spécialité</th>
                                    <th>Total Examens</th>
                                    <th>Cas sévères</th>
                                    <th>Statut</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="doctorsTable">
                                <tr>
                                    <td colspan="7" class="loading">
                                        <div class="spinner"></div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
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

        let editingDoctorId = null;
        let isSavingDoctor = false;

        function setDoctorSaveState(isSaving, label) {
            const saveButton = document.getElementById('save-btn');
            if (!saveButton) return;

            saveButton.disabled = isSaving;
            saveButton.innerHTML = isSaving
                ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg> ${label}`
                : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> ${saveButton.dataset.defaultLabel || 'Créer'}`;
        }

        // Load doctors
        async function loadDoctors() {
            const tableBody = document.getElementById('doctorsTable');
            tableBody.innerHTML = '<tr><td colspan="7" class="loading"><div class="spinner"></div></td></tr>';

            try {
                const response = await API.get('/center/doctors');
                const doctors = response.data.doctors;
                
                // Update stats
                document.getElementById('totalDoctors').textContent = doctors.filter(d => d.is_active).length;

                if (doctors.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="empty-state">
                                <div class="empty-state-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                        <circle cx="12" cy="7" r="4"/>
                                    </svg>
                                </div>
                                <div class="empty-state-title">Aucun médecin</div>
                                <p>Commencez par créer un compte médecin</p>
                            </td>
                        </tr>
                    `;
                } else {
                    tableBody.innerHTML = doctors.map(doctor => `
                        <tr>
                            <td><strong>${Utils.escapeHtml(doctor.name)}</strong></td>
                            <td>${Utils.escapeHtml(doctor.email)}</td>
                            <td>${Utils.escapeHtml(doctor.speciality || '-')}</td>
                            <td>${doctor.total_exams}</td>
                            <td>
                                ${doctor.severe_cases > 0 
                                    ? `<span class="badge badge-danger">${doctor.severe_cases}</span>` 
                                    : '0'}
                            </td>
                            <td>
                                <span class="badge ${doctor.is_active ? 'badge-success' : 'badge-secondary'}">
                                    ${doctor.is_active ? 'Actif' : 'Inactif'}
                                </span>
                            </td>
                            <td class="table-actions">
                                <button class="btn btn-sm btn-outline" onclick="editDoctor(${doctor.id})" title="Modifier">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }

            } catch (error) {
                tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${error.message}</td></tr>`;
            }
        }

        // Show doctor modal
        function showDoctorModal(doctor = null) {
            editingDoctorId = doctor ? doctor.id : null;
            
            const modal = Modal.show({
                title: doctor ? 'Modifier le médecin' : 'Nouveau médecin',
                content: `
                    <form id="doctorForm">
                        <div class="form-group">
                            <label class="form-label required">Nom complet</label>
                            <input type="text" name="name" class="form-control" value="${doctor?.name || ''}" data-validate="required" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Email</label>
                            <input type="email" name="email" class="form-control" value="${doctor?.email || ''}" 
                                   data-validate="required|email" required ${doctor ? 'readonly' : ''}>
                            ${doctor ? '<div class="form-hint">L\'email ne peut pas être modifié</div>' : ''}
                        </div>
                        ${!doctor ? `
                        <div class="form-group">
                            <label class="form-label required">Mot de passe</label>
                            <input type="password" name="password" class="form-control" 
                                   data-validate="required|minLength:8" required>
                            <div class="form-hint">Minimum 8 caractères</div>
                        </div>
                        ` : `
                        <div class="form-group">
                            <label class="form-label">Nouveau mot de passe (optionnel)</label>
                            <input type="password" name="password" class="form-control">
                            <div class="form-hint">Laissez vide pour ne pas modifier</div>
                        </div>
                        `}
                        <div class="form-group">
                            <label class="form-label">Spécialité</label>
                            <input type="text" name="speciality" class="form-control" 
                                   value="${doctor?.speciality || ''}" placeholder="Ex: Ophtalmologie - Rétine">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Téléphone</label>
                            <input type="tel" name="phone" class="form-control" value="${doctor?.phone || ''}">
                        </div>
                        ${doctor ? `
                        <div class="form-group">
                            <label class="form-label">Statut</label>
                            <select name="is_active" class="form-control">
                                <option value="1" ${doctor.is_active ? 'selected' : ''}>Actif</option>
                                <option value="0" ${!doctor.is_active ? 'selected' : ''}>Inactif</option>
                            </select>
                        </div>
                        ` : ''}
                    </form>
                `,
                footer: `
                    <button class="btn btn-secondary" data-close>Annuler</button>
                    <button class="btn btn-primary" onclick="saveDoctor()">
                        ${doctor ? 'Enregistrer' : 'Créer'}
                    </button>
                `
            });
        }

        // Edit doctor
        async function editDoctor(id) {
            try {
                const response = await API.get(`/center/doctors/${id}`);
                showDoctorModal(response.data);
            } catch (error) {
                Toast.error(error.message);
            }
        }

        // Save doctor
        async function saveDoctor() {
            if (isSavingDoctor) return;

            const form = document.getElementById('doctorForm');
            const { isValid, errors } = Validator.validate(form);
            
            if (!isValid) {
                Validator.showErrors(form, errors);
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Remove empty password for edit
            if (editingDoctorId && !data.password) {
                delete data.password;
            }

            const saveButton = document.getElementById('save-btn');
            if (saveButton && !saveButton.dataset.defaultLabel) {
                saveButton.dataset.defaultLabel = saveButton.textContent.trim();
            }

            isSavingDoctor = true;
            setDoctorSaveState(true, editingDoctorId ? 'Enregistrement...' : 'Création...');

            try {
                if (editingDoctorId) {
                    const response = await API.put(`/center/doctors/${editingDoctorId}`, data);
                    if (!response || response.success === false) {
                        throw new Error(response?.error || 'Erreur lors de la mise à jour du médecin');
                    }
                    Toast.success('Médecin mis à jour avec succès');
                } else {
                    const response = await API.post('/center/doctors', data);
                    if (!response || response.success === false) {
                        throw new Error(response?.error || 'Erreur lors de la création du médecin');
                    }
                    Toast.success('Médecin créé avec succès');
                }

                document.querySelector('.modal-overlay').remove();
                loadDoctors();

            } catch (error) {
                Toast.error(error.message);
            } finally {
                isSavingDoctor = false;
                setDoctorSaveState(false);
            }
        }

        // Initial load
        loadDoctors();
    </script>
</body>
</html>
