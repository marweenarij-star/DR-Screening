<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestion des Patients - Dépistage Rétinopathie</title>
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
                <a href="/diabetic-retinopathy/php-app/public/center/patients" class="nav-item active">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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
                    <h1 class="page-title">Gestion des Patients</h1>
                    <button class="btn btn-primary" onclick="showPatientModal()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Nouveau Patient
                    </button>
                </div>
            </header>
            
            <div class="page-body">
                <!-- Search -->
                <div class="search-filters">
                    <div class="search-box">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" class="form-control" id="searchInput" placeholder="Rechercher un patient...">
                    </div>
                </div>

                <!-- Patients Table -->
                <div class="card">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>N° Dossier</th>
                                    <th>Nom complet</th>
                                    <th>Âge</th>
                                    <th>Sexe</th>
                                    <th>Années diabète</th>
                                    <th>Téléphone</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="patientsTable">
                                <tr>
                                    <td colspan="7" class="loading">
                                        <div class="spinner"></div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div id="paginationContainer" class="card-footer"></div>
                </div>
            </div>
        </main>
    </div>

    <!-- Patient Modal Template -->
    <div id="patientModalTemplate" style="display: none;">
        <form id="patientForm">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label required">Nom complet</label>
                    <input type="text" name="full_name" class="form-control" data-validate="required" required>
                </div>
                <div class="form-group">
                    <label class="form-label">N° Dossier médical</label>
                    <input type="text" name="medical_record_number" class="form-control" placeholder="Auto-généré si vide">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Date de naissance</label>
                    <input type="date" name="date_of_birth" class="form-control">
                </div>
                <div class="form-group">
                    <label class="form-label">Sexe</label>
                    <select name="gender" class="form-control">
                        <option value="">-- Sélectionner --</option>
                        <option value="M">Masculin</option>
                        <option value="F">Féminin</option>
                        <option value="other">Autre</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Années de diabète</label>
                    <input type="number" name="diabetic_years" class="form-control" min="0" max="100">
                </div>
                <div class="form-group">
                    <label class="form-label">Type de diabète</label>
                    <select name="diabetes_type" class="form-control">
                        <option value="">-- Sélectionner --</option>
                        <option value="type1">Type 1</option>
                        <option value="type2">Type 2</option>
                        <option value="gestational">Gestationnel</option>
                        <option value="other">Autre</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Téléphone</label>
                    <input type="tel" name="phone" class="form-control">
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" name="email" class="form-control">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Adresse</label>
                <input type="text" name="address" class="form-control">
            </div>
            <div class="form-group">
                <label class="form-label">Notes médicales</label>
                <textarea name="notes" class="form-control" rows="3"></textarea>
            </div>
        </form>
    </div>

    <script src="/diabetic-retinopathy/php-app/public/js/app.js"></script>
    <script>
        // Check auth
        if (!Auth.isAuthenticated()) {
            window.location.href = '/diabetic-retinopathy/php-app/public/login';
        }

        let currentPage = 1;
        let editingPatientId = null;

        // Load patients
        async function loadPatients(page = 1, search = '') {
            const tableBody = document.getElementById('patientsTable');
            tableBody.innerHTML = '<tr><td colspan="7" class="loading"><div class="spinner"></div></td></tr>';

            try {
                const query = Utils.buildQuery({ page, search, per_page: 20 });
                const response = await API.get(`/center/patients?${query}`);
                
                if (response.data.patients.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="7" class="empty-state">
                                <div class="empty-state-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                        <circle cx="9" cy="7" r="4"/>
                                    </svg>
                                </div>
                                <div class="empty-state-title">Aucun patient trouvé</div>
                                <p>Commencez par ajouter un nouveau patient</p>
                            </td>
                        </tr>
                    `;
                } else {
                    tableBody.innerHTML = response.data.patients.map(patient => `
                        <tr>
                            <td><strong>${Utils.escapeHtml(patient.medical_record_number || '-')}</strong></td>
                            <td>${Utils.escapeHtml(patient.full_name)}</td>
                            <td>${patient.age || '-'}</td>
                            <td>${patient.gender === 'M' ? 'Masculin' : patient.gender === 'F' ? 'Féminin' : '-'}</td>
                            <td>${patient.diabetic_years ? patient.diabetic_years + ' ans' : '-'}</td>
                            <td>${Utils.escapeHtml(patient.phone || '-')}</td>
                            <td class="table-actions">
                                <button class="btn btn-sm btn-outline" onclick="editPatient(${patient.id})" title="Modifier">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                </button>
                                <button class="btn btn-sm btn-danger" onclick="deletePatient(${patient.id}, '${Utils.escapeHtml(patient.full_name)}')" title="Supprimer">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }

                // Update pagination
                const pagination = response.data.pagination;
                currentPage = pagination.current_page;
                renderPagination(pagination);

            } catch (error) {
                tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${error.message}</td></tr>`;
            }
        }

        function renderPagination(pagination) {
            const container = document.getElementById('paginationContainer');
            if (pagination.total_pages <= 1) {
                container.innerHTML = '';
                return;
            }

            let html = '<div class="pagination">';
            
            html += `<button class="pagination-btn" ${pagination.current_page === 1 ? 'disabled' : ''} 
                      onclick="loadPatients(${pagination.current_page - 1}, document.getElementById('searchInput').value)">
                        ← Précédent
                     </button>`;

            html += `<span class="pagination-info">Page ${pagination.current_page} sur ${pagination.total_pages}</span>`;

            html += `<button class="pagination-btn" ${pagination.current_page === pagination.total_pages ? 'disabled' : ''} 
                      onclick="loadPatients(${pagination.current_page + 1}, document.getElementById('searchInput').value)">
                        Suivant →
                     </button>`;

            html += '</div>';
            container.innerHTML = html;
        }

        // Show patient modal
        function showPatientModal(patient = null) {
            editingPatientId = patient ? patient.id : null;
            const formContent = document.getElementById('patientModalTemplate').innerHTML;
            
            const modal = Modal.show({
                title: patient ? 'Modifier le patient' : 'Nouveau patient',
                content: formContent,
                footer: `
                    <button class="btn btn-secondary" data-close>Annuler</button>
                    <button class="btn btn-primary" onclick="savePatient()">
                        ${patient ? 'Enregistrer' : 'Créer'}
                    </button>
                `,
                size: 'lg'
            });

            // Fill form if editing
            if (patient) {
                const form = modal.querySelector('#patientForm');
                Object.keys(patient).forEach(key => {
                    const input = form.querySelector(`[name="${key}"]`);
                    if (input) {
                        input.value = patient[key] || '';
                    }
                });
            }
        }

        // Edit patient
        async function editPatient(id) {
            try {
                const response = await API.get(`/center/patients/${id}`);
                showPatientModal(response.data);
            } catch (error) {
                Toast.error(error.message);
            }
        }

        // Save patient
        async function savePatient() {
            const form = document.getElementById('patientForm');
            const { isValid, errors } = Validator.validate(form);
            
            if (!isValid) {
                Validator.showErrors(form, errors);
                return;
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                if (editingPatientId) {
                    await API.put(`/center/patients/${editingPatientId}`, data);
                    Toast.success('Patient mis à jour avec succès');
                } else {
                    await API.post('/center/patients', data);
                    Toast.success('Patient créé avec succès');
                }

                // Close modal and reload
                document.querySelector('.modal-overlay').remove();
                loadPatients(currentPage);

            } catch (error) {
                Toast.error(error.message);
            }
        }

        // Delete patient
        async function deletePatient(id, name) {
            const confirmed = await Modal.confirm(`Êtes-vous sûr de vouloir supprimer le patient "${name}" ?`);
            
            if (confirmed) {
                try {
                    await API.delete(`/center/patients/${id}`);
                    Toast.success('Patient supprimé');
                    loadPatients(currentPage);
                } catch (error) {
                    Toast.error(error.message);
                }
            }
        }

        // Search debounce
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', Utils.debounce((e) => {
            loadPatients(1, e.target.value);
        }, 300));

        // Initial load
        loadPatients();
    </script>
</body>
</html>
