<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Détail Examen - DR Screening</title>
    <link rel="stylesheet" href="/diabetic-retinopathy/php-app/public/css/app.css">
    <style>
        .exam-detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--spacing-lg);
        }

        @media (max-width: 1024px) {
            .exam-detail-grid {
                grid-template-columns: 1fr;
            }
        }

        .image-viewer {
            background: var(--gray-900);
            border-radius: var(--radius-lg);
            overflow: hidden;
        }

        .image-tabs {
            display: flex;
            background: var(--gray-800);
        }

        .image-tab {
            flex: 1;
            padding: var(--spacing-sm) var(--spacing-md);
            text-align: center;
            color: var(--gray-400);
            cursor: pointer;
            border: none;
            background: none;
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.2s;
        }

        .image-tab:hover {
            color: var(--white);
            background: var(--gray-700);
        }

        .image-tab.active {
            color: var(--white);
            background: var(--primary);
        }

        .image-container {
            position: relative;
            min-height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--spacing-md);
        }

        .image-container img {
            max-width: 100%;
            max-height: 500px;
            object-fit: contain;
            border-radius: var(--radius-md);
        }

        .image-placeholder {
            text-align: center;
            color: var(--gray-500);
        }

        .image-placeholder svg {
            width: 64px;
            height: 64px;
            margin-bottom: var(--spacing-md);
        }

        .grade-display {
            display: flex;
            align-items: center;
            gap: var(--spacing-lg);
            padding: var(--spacing-lg);
            background: var(--gray-50);
            border-radius: var(--radius-lg);
            margin-bottom: var(--spacing-lg);
        }

        .grade-circle {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--white);
            font-weight: 600;
        }

        .grade-circle.grade-0 { background: linear-gradient(135deg, #43a047, #66bb6a); }
        .grade-circle.grade-1 { background: linear-gradient(135deg, #1e88e5, #42a5f5); }
        .grade-circle.grade-2 { background: linear-gradient(135deg, #fb8c00, #ffa726); }
        .grade-circle.grade-3 { background: linear-gradient(135deg, #e53935, #ef5350); }
        .grade-circle.grade-4 { background: linear-gradient(135deg, #b71c1c, #c62828); }

        .grade-number {
            font-size: 2rem;
            line-height: 1;
        }

        .grade-text {
            font-size: 0.75rem;
            text-transform: uppercase;
        }

        .grade-info h3 {
            margin: 0 0 var(--spacing-xs) 0;
            font-size: 1.25rem;
        }

        .grade-info p {
            margin: 0;
            color: var(--gray-600);
        }

        .confidence-bar {
            width: 200px;
            height: 8px;
            background: var(--gray-200);
            border-radius: var(--radius-full);
            overflow: hidden;
            margin-top: var(--spacing-sm);
        }

        .confidence-fill {
            height: 100%;
            background: var(--primary);
            transition: width 0.5s ease;
        }

        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--spacing-md);
        }

        .info-item {
            padding: var(--spacing-md);
            background: var(--gray-50);
            border-radius: var(--radius-md);
        }

        .info-item label {
            display: block;
            font-size: 0.75rem;
            color: var(--gray-500);
            text-transform: uppercase;
            margin-bottom: var(--spacing-xs);
        }

        .info-item span {
            font-weight: 500;
            color: var(--gray-900);
        }

        .action-buttons {
            display: flex;
            gap: var(--spacing-md);
            margin-top: var(--spacing-lg);
        }

        .alert-banner {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
            padding: var(--spacing-md);
            background: #fff3e0;
            border: 1px solid #ffcc02;
            border-radius: var(--radius-lg);
            margin-bottom: var(--spacing-lg);
        }

        .alert-banner.critical {
            background: #ffebee;
            border-color: #e53935;
        }

        .alert-banner svg {
            width: 24px;
            height: 24px;
            flex-shrink: 0;
        }

        .alert-banner.critical svg {
            color: #e53935;
        }

        .notes-section {
            margin-top: var(--spacing-lg);
        }

        .notes-section textarea {
            min-height: 120px;
        }
    </style>
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
                <a href="/diabetic-retinopathy/php-app/public/doctor/dashboard" class="nav-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="7" height="7"/>
                        <rect x="14" y="3" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    <span>Tableau de bord</span>
                </a>
                
                <a href="/diabetic-retinopathy/php-app/public/doctor/alerts" class="nav-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <span>Alertes</span>
                </a>
            </nav>
            
            <div class="sidebar-footer">
                <a href="#" class="nav-item" data-logout>
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
                    <a href="/diabetic-retinopathy/php-app/public/doctor/dashboard" class="btn btn-secondary btn-sm">
                        ← Retour
                    </a>
                    <h1 class="page-title">Détail de l'Examen</h1>
                </div>
            </header>
            
            <div class="page-body" id="examContent">
                <div style="text-align: center; padding: 50px;">
                    <div class="spinner"></div>
                    <p class="text-muted mt-md">Chargement...</p>
                </div>
            </div>
        </main>
    </div>

    <script src="/diabetic-retinopathy/php-app/public/js/app.js"></script>
    <script>
        if (!Auth.isAuthenticated()) {
            window.location.href = '/diabetic-retinopathy/php-app/public/doctor/login';
        }

        const examId = window.location.pathname.split('/').pop();
        let examData = null;

        const GRADE_LABELS = {
            0: 'Pas de Rétinopathie',
            1: 'RD Légère',
            2: 'RD Modérée',
            3: 'RD Sévère',
            4: 'RD Proliférante'
        };

        const GRADE_DESCRIPTIONS = {
            0: 'Aucun signe de rétinopathie diabétique détecté.',
            1: 'Quelques micro-anévrismes présents. Contrôle annuel recommandé.',
            2: 'Micro-anévrismes plus nombreux, hémorragies légères. Suivi semestriel recommandé.',
            3: 'Hémorragies multiples, anomalies veineuses. Référence urgente à un spécialiste.',
            4: 'Néovascularisation détectée. Traitement immédiat requis.'
        };

        async function loadExam() {
            try {
                const response = await API.get(`/doctor/exams/${examId}`);
                examData = response.data;
                renderExam(examData);
            } catch (error) {
                document.getElementById('examContent').innerHTML = `
                    <div class="card">
                        <div class="card-body text-center">
                            <p class="text-danger">Erreur: ${error.message}</p>
                            <a href="/diabetic-retinopathy/php-app/public/doctor/dashboard" class="btn btn-primary mt-md">
                                Retour au tableau de bord
                            </a>
                        </div>
                    </div>
                `;
            }
        }

        function renderExam(exam) {
            const isUrgent = exam.grade >= 3;
            const gradeLabel = GRADE_LABELS[exam.grade] || `Grade ${exam.grade}`;
            const gradeDesc = GRADE_DESCRIPTIONS[exam.grade] || '';

            let html = '';

            // Urgent banner
            if (isUrgent) {
                html += `
                    <div class="alert-banner ${exam.grade === 4 ? 'critical' : ''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <div>
                            <strong>⚠️ Cas Urgent</strong>
                            <p style="margin: 0;">Ce patient présente une rétinopathie diabétique ${exam.grade === 4 ? 'proliférante' : 'sévère'}. Une prise en charge rapide est recommandée.</p>
                        </div>
                    </div>
                `;
            }

            html += '<div class="exam-detail-grid">';

            // Left column - Image viewer
            html += `
                <div>
                    <div class="image-viewer">
                        <div class="image-tabs">
                            <button class="image-tab active" data-image="original">Image Originale</button>
                            <button class="image-tab" data-image="heatmap" ${!exam.gradcam_path ? 'disabled' : ''}>Carte de Chaleur</button>
                            <button class="image-tab" data-image="overlay" ${!exam.gradcam_overlay_path ? 'disabled' : ''}>Superposition</button>
                        </div>
                        <div class="image-container" id="imageContainer">
                            <img src="${exam.image_url}" alt="Image rétinienne" id="examImage">
                        </div>
                    </div>
                    
                    <div class="action-buttons">
                        <a href="${exam.image_url}" download class="btn btn-secondary" target="_blank">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Image Originale
                        </a>
                        ${exam.gradcam_path ? `
                            <a href="${exam.heatmap_url}" download class="btn btn-secondary" target="_blank">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Grad-CAM
                            </a>
                        ` : ''}
                    </div>
                </div>
            `;

            // Right column - Info
            html += `
                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Résultat de l'Analyse</h3>
                        </div>
                        <div class="card-body">
                            <div class="grade-display">
                                <div class="grade-circle grade-${exam.grade}">
                                    <span class="grade-number">${exam.grade}</span>
                                    <span class="grade-text">Grade</span>
                                </div>
                                <div class="grade-info">
                                    <h3>${gradeLabel}</h3>
                                    <p>${gradeDesc}</p>
                                    <div class="confidence-bar">
                                        <div class="confidence-fill" style="width: ${exam.confidence}%"></div>
                                    </div>
                                    <small class="text-muted">Confiance: ${parseFloat(exam.confidence).toFixed(1)}%</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mt-lg">
                        <div class="card-header">
                            <h3 class="card-title">Informations Patient</h3>
                        </div>
                        <div class="card-body">
                            <div class="info-grid">
                                <div class="info-item">
                                    <label>Nom complet</label>
                                    <span>${Utils.escapeHtml(exam.patient?.first_name || '')} ${Utils.escapeHtml(exam.patient?.last_name || '')}</span>
                                </div>
                                <div class="info-item">
                                    <label>N° Dossier</label>
                                    <span>${Utils.escapeHtml(exam.patient?.medical_record_number || '-')}</span>
                                </div>
                                <div class="info-item">
                                    <label>Date de naissance</label>
                                    <span>${exam.patient?.birth_date ? Utils.formatDate(exam.patient.birth_date) : '-'}</span>
                                </div>
                                <div class="info-item">
                                    <label>Sexe</label>
                                    <span>${exam.patient?.gender === 'M' ? 'Masculin' : exam.patient?.gender === 'F' ? 'Féminin' : '-'}</span>
                                </div>
                                <div class="info-item">
                                    <label>Téléphone</label>
                                    <span>${Utils.escapeHtml(exam.patient?.phone || '-')}</span>
                                </div>
                                <div class="info-item">
                                    <label>Email</label>
                                    <span>${Utils.escapeHtml(exam.patient?.email || '-')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mt-lg">
                        <div class="card-header">
                            <h3 class="card-title">Informations Examen</h3>
                        </div>
                        <div class="card-body">
                            <div class="info-grid">
                                <div class="info-item">
                                    <label>Date de l'examen</label>
                                    <span>${Utils.formatDateTime(exam.created_at)}</span>
                                </div>
                                <div class="info-item">
                                    <label>Type d'œil</label>
                                    <span>${exam.eye_type === 'left' ? 'Œil Gauche' : exam.eye_type === 'right' ? 'Œil Droit' : '-'}</span>
                                </div>
                                ${exam.notes ? `
                                    <div class="info-item" style="grid-column: span 2;">
                                        <label>Notes</label>
                                        <span>${Utils.escapeHtml(exam.notes)}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            html += '</div>';

            document.getElementById('examContent').innerHTML = html;

            // Bind image tab events
            document.querySelectorAll('.image-tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    if (this.disabled) return;
                    
                    document.querySelectorAll('.image-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    
                    const imageType = this.dataset.image;
                    const img = document.getElementById('examImage');
                    
                    switch(imageType) {
                        case 'original':
                            img.src = examData.image_url;
                            break;
                        case 'heatmap':
                            img.src = examData.heatmap_url;
                            break;
                        case 'overlay':
                            img.src = examData.overlay_url;
                            break;
                    }
                });
            });
        }

        loadExam();
    </script>
</body>
</html>
