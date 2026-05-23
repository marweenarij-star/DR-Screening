<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tableau de Bord - Médecin</title>
    <link rel="stylesheet" href="/diabetic-retinopathy/php-app/public/css/app.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
                <a href="/diabetic-retinopathy/php-app/public/doctor/dashboard" class="nav-item active">
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
                    <span class="nav-badge" id="alertBadge" style="display: none;">0</span>
                </a>
            </nav>
            
            <div class="sidebar-footer">
                <div class="user-info">
                    <div class="user-avatar">M</div>
                    <div class="user-details">
                        <div class="user-name">Médecin</div>
                        <div class="user-role">Ophtalmologue</div>
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
                    <h1 class="page-title">Tableau de Bord</h1>
                    <div id="wsStatus" class="badge badge-secondary">Hors ligne</div>
                </div>
            </header>
            
            <div class="page-body">
                <!-- Stats Cards -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon primary">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <circle cx="12" cy="12" r="4"/>
                            </svg>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="statTotalExams">-</div>
                            <div class="stat-label">Total Examens</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon danger">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="statSevereCases">-</div>
                            <div class="stat-label">Cas Sévères (Grade ≥ 3)</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon warning">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                            </svg>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="statUnreadAlerts">-</div>
                            <div class="stat-label">Alertes Non Lues</div>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon success">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                        </div>
                        <div class="stat-content">
                            <div class="stat-value" id="statExamsToday">-</div>
                            <div class="stat-label">Examens Aujourd'hui</div>
                        </div>
                    </div>
                </div>

                <!-- Charts Row -->
                <div class="form-row mb-lg">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Distribution par Grade</h3>
                        </div>
                        <div class="card-body">
                            <canvas id="gradeChart" height="250"></canvas>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Examens - 7 derniers jours</h3>
                        </div>
                        <div class="card-body">
                            <canvas id="trendChart" height="250"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Exams List -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Examens Récents</h3>
                    </div>
                    
                    <!-- Filters -->
                    <div class="card-body" style="border-bottom: 1px solid var(--gray-200);">
                        <div class="search-filters">
                            <div class="search-box">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="11" cy="11" r="8"/>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                </svg>
                                <input type="text" class="form-control" id="searchInput" placeholder="Rechercher un patient...">
                            </div>
                            <div class="filter-group">
                                <select id="gradeFilter" class="form-control">
                                    <option value="">Tous les grades</option>
                                    <option value="0">Grade 0 - Pas de RD</option>
                                    <option value="1">Grade 1 - RD légère</option>
                                    <option value="2">Grade 2 - RD modérée</option>
                                    <option value="3">Grade 3 - RD sévère</option>
                                    <option value="4">Grade 4 - RD proliférante</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>N° Dossier</th>
                                    <th>Grade</th>
                                    <th>Confiance</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="examsTable">
                                <tr>
                                    <td colspan="6" class="loading">
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

    <script src="/diabetic-retinopathy/php-app/public/js/app.js"></script>
    <script>
        // Check auth
        if (!Auth.isAuthenticated()) {
            window.location.href = '/diabetic-retinopathy/php-app/public/doctor/login';
        }

        let currentPage = 1;
        let gradeChart, trendChart;
        let wsClient;

        // Initialize WebSocket
        function initWebSocket() {
            const wsUrl = '<?= $wsUrl ?? "ws://localhost:8080" ?>';
            wsClient = new WebSocketClient(wsUrl);
            
            wsClient.on('authenticated', () => {
                document.getElementById('wsStatus').textContent = 'En ligne';
                document.getElementById('wsStatus').className = 'badge badge-success';
            });

            wsClient.on('new_exam', (data) => {
                Toast.info(`Nouvel examen: ${data.patient_name}`);
                loadExams(currentPage);
                loadStats();
            });

            wsClient.on('new_alert', (data) => {
                Toast.warning(`⚠️ ${data.message}`);
                loadStats();
            });

            wsClient.connect();
        }

        // Load stats
        async function loadStats() {
            try {
                const response = await API.get('/doctor/stats');
                const stats = response.data;

                document.getElementById('statTotalExams').textContent = stats.total_exams;
                document.getElementById('statSevereCases').textContent = stats.severe_cases;
                document.getElementById('statUnreadAlerts').textContent = stats.unread_alerts;
                document.getElementById('statExamsToday').textContent = stats.exams_today;

                // Update alert badge
                const badge = document.getElementById('alertBadge');
                if (stats.unread_alerts > 0) {
                    badge.textContent = stats.unread_alerts;
                    badge.style.display = 'inline';
                } else {
                    badge.style.display = 'none';
                }

                // Update charts
                updateGradeChart(stats.grade_distribution);
                updateTrendChart(stats.weekly_trend);

            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }

        // Load exams
        async function loadExams(page = 1, search = '', grade = '') {
            const tableBody = document.getElementById('examsTable');
            tableBody.innerHTML = '<tr><td colspan="6" class="loading"><div class="spinner"></div></td></tr>';

            try {
                const query = Utils.buildQuery({ page, search, grade, per_page: 20 });
                const response = await API.get(`/doctor/exams?${query}`);
                const exams = response.data.exams;

                if (exams.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="6" class="empty-state">
                                <div class="empty-state-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <line x1="12" y1="8" x2="12" y2="12"/>
                                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                </div>
                                <div class="empty-state-title">Aucun examen trouvé</div>
                            </td>
                        </tr>
                    `;
                } else {
                    tableBody.innerHTML = exams.map(exam => `
                        <tr class="${exam.is_urgent ? 'urgent' : ''}">
                            <td>
                                <strong>${Utils.escapeHtml(exam.patient_name)}</strong>
                                ${exam.patient_age ? `<br><span class="text-muted text-sm">${exam.patient_age} ans</span>` : ''}
                            </td>
                            <td>${Utils.escapeHtml(exam.medical_record_number || '-')}</td>
                            <td>
                                <span class="badge ${exam.grade_class}">
                                    ${exam.grade_label}
                                </span>
                            </td>
                            <td>${parseFloat(exam.confidence).toFixed(1)}%</td>
                            <td>${Utils.formatDateTime(exam.created_at)}</td>
                            <td>
                                <a href="/diabetic-retinopathy/php-app/public/doctor/exams/${exam.id}" 
                                   class="btn btn-sm btn-primary">
                                    Voir
                                </a>
                            </td>
                        </tr>
                    `).join('');
                }

                // Update pagination
                currentPage = response.data.pagination.current_page;
                renderPagination(response.data.pagination);

            } catch (error) {
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${error.message}</td></tr>`;
            }
        }

        function renderPagination(pagination) {
            const container = document.getElementById('paginationContainer');
            if (pagination.total_pages <= 1) {
                container.innerHTML = '';
                return;
            }

            const search = document.getElementById('searchInput').value;
            const grade = document.getElementById('gradeFilter').value;

            let html = '<div class="pagination">';
            
            html += `<button class="pagination-btn" ${pagination.current_page === 1 ? 'disabled' : ''} 
                      onclick="loadExams(${pagination.current_page - 1}, '${search}', '${grade}')">
                        ← Précédent
                     </button>`;

            html += `<span class="pagination-info">Page ${pagination.current_page} sur ${pagination.total_pages}</span>`;

            html += `<button class="pagination-btn" ${pagination.current_page === pagination.total_pages ? 'disabled' : ''} 
                      onclick="loadExams(${pagination.current_page + 1}, '${search}', '${grade}')">
                        Suivant →
                     </button>`;

            html += '</div>';
            container.innerHTML = html;
        }

        // Charts
        function updateGradeChart(distribution) {
            const ctx = document.getElementById('gradeChart').getContext('2d');
            
            if (gradeChart) {
                gradeChart.destroy();
            }

            const colors = ['#43a047', '#1e88e5', '#fb8c00', '#e53935', '#b71c1c'];
            
            gradeChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: distribution.map(d => d.label),
                    datasets: [{
                        data: distribution.map(d => d.count),
                        backgroundColor: colors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        function updateTrendChart(trend) {
            const ctx = document.getElementById('trendChart').getContext('2d');
            
            if (trendChart) {
                trendChart.destroy();
            }

            // Fill missing days
            const days = [];
            const counts = [];
            const today = new Date();
            
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                days.push(date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }));
                
                const dayData = trend.find(t => t.date === dateStr);
                counts.push(dayData ? dayData.count : 0);
            }

            trendChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: days,
                    datasets: [{
                        label: 'Examens',
                        data: counts,
                        backgroundColor: '#00897b',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }

        // Event listeners
        document.getElementById('searchInput').addEventListener('input', Utils.debounce((e) => {
            loadExams(1, e.target.value, document.getElementById('gradeFilter').value);
        }, 300));

        document.getElementById('gradeFilter').addEventListener('change', (e) => {
            loadExams(1, document.getElementById('searchInput').value, e.target.value);
        });

        // Real-time updates
        window.addEventListener('newExam', () => {
            loadExams(currentPage);
            loadStats();
        });

        window.addEventListener('newAlert', () => {
            loadStats();
        });

        // Initial load
        loadStats();
        loadExams();
        initWebSocket();
    </script>
</body>
</html>
