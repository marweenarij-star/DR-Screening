<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alertes - DR Screening</title>
    <link rel="stylesheet" href="/diabetic-retinopathy/php-app/public/css/app.css">
    <style>
        .alert-card {
            background: var(--white);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-sm);
            margin-bottom: var(--spacing-md);
            transition: all 0.2s;
            border-left: 4px solid transparent;
        }

        .alert-card.unread {
            border-left-color: var(--warning);
            background: #fffef5;
        }

        .alert-card.grade-3 {
            border-left-color: var(--danger);
        }

        .alert-card.grade-4 {
            border-left-color: #b71c1c;
            background: #fff5f5;
        }

        .alert-card.resolved {
            opacity: 0.7;
            border-left-color: var(--success);
        }

        .alert-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: var(--spacing-md) var(--spacing-lg);
            border-bottom: 1px solid var(--gray-100);
        }

        .alert-title {
            display: flex;
            align-items: center;
            gap: var(--spacing-md);
        }

        .alert-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--warning-light);
            color: var(--warning);
        }

        .alert-card.grade-3 .alert-icon,
        .alert-card.grade-4 .alert-icon {
            background: #ffebee;
            color: var(--danger);
        }

        .alert-icon svg {
            width: 20px;
            height: 20px;
        }

        .alert-meta h4 {
            margin: 0;
            font-size: 1rem;
        }

        .alert-meta p {
            margin: 0;
            color: var(--gray-500);
            font-size: 0.875rem;
        }

        .alert-body {
            padding: var(--spacing-lg);
        }

        .alert-message {
            font-size: 0.95rem;
            color: var(--gray-700);
            margin-bottom: var(--spacing-md);
        }

        .alert-patient {
            display: flex;
            align-items: center;
            gap: var(--spacing-lg);
            padding: var(--spacing-md);
            background: var(--gray-50);
            border-radius: var(--radius-md);
        }

        .patient-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--primary);
            color: var(--white);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 1.25rem;
        }

        .patient-info h5 {
            margin: 0;
            font-size: 1rem;
        }

        .patient-info p {
            margin: 0;
            color: var(--gray-500);
            font-size: 0.875rem;
        }

        .alert-actions {
            display: flex;
            gap: var(--spacing-sm);
            margin-top: var(--spacing-md);
        }

        .resolution-note {
            margin-top: var(--spacing-md);
            padding: var(--spacing-md);
            background: #e8f5e9;
            border-radius: var(--radius-md);
            font-size: 0.875rem;
        }

        .resolution-note strong {
            display: block;
            margin-bottom: var(--spacing-xs);
            color: var(--success);
        }

        .filter-tabs {
            display: flex;
            gap: var(--spacing-sm);
            margin-bottom: var(--spacing-lg);
        }

        .filter-tab {
            padding: var(--spacing-sm) var(--spacing-md);
            border: none;
            background: var(--gray-100);
            border-radius: var(--radius-full);
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--gray-600);
            transition: all 0.2s;
        }

        .filter-tab:hover {
            background: var(--gray-200);
        }

        .filter-tab.active {
            background: var(--primary);
            color: var(--white);
        }

        .filter-tab .count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 20px;
            height: 20px;
            padding: 0 6px;
            background: rgba(0,0,0,0.1);
            border-radius: var(--radius-full);
            font-size: 0.75rem;
            margin-left: var(--spacing-xs);
        }

        .filter-tab.active .count {
            background: rgba(255,255,255,0.2);
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
                
                <a href="/diabetic-retinopathy/php-app/public/doctor/alerts" class="nav-item active">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <span>Alertes</span>
                    <span class="nav-badge" id="alertBadge" style="display: none;">0</span>
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
                    <h1 class="page-title">Alertes</h1>
                </div>
            </header>
            
            <div class="page-body">
                <!-- Filter Tabs -->
                <div class="filter-tabs">
                    <button class="filter-tab active" data-filter="all">
                        Toutes <span class="count" id="countAll">0</span>
                    </button>
                    <button class="filter-tab" data-filter="unread">
                        Non lues <span class="count" id="countUnread">0</span>
                    </button>
                    <button class="filter-tab" data-filter="read">
                        Lues <span class="count" id="countRead">0</span>
                    </button>
                    <button class="filter-tab" data-filter="resolved">
                        Résolues <span class="count" id="countResolved">0</span>
                    </button>
                </div>

                <!-- Alerts Container -->
                <div id="alertsContainer">
                    <div class="loading-container">
                        <div class="spinner"></div>
                    </div>
                </div>

                <div id="paginationContainer"></div>
            </div>
        </main>
    </div>

    <!-- Resolve Modal -->
    <div class="modal" id="resolveModal">
        <div class="modal-overlay"></div>
        <div class="modal-container">
            <div class="modal-header">
                <h2 class="modal-title">Résoudre l'Alerte</h2>
                <button class="modal-close" onclick="closeResolveModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Note de Résolution</label>
                    <textarea id="resolutionNote" class="form-control" rows="4" 
                              placeholder="Décrivez les actions prises..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeResolveModal()">Annuler</button>
                <button class="btn btn-success" onclick="confirmResolve()">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Confirmer
                </button>
            </div>
        </div>
    </div>

    <script src="/diabetic-retinopathy/php-app/public/js/app.js"></script>
    <script>
        if (!Auth.isAuthenticated()) {
            window.location.href = '/diabetic-retinopathy/php-app/public/doctor/login';
        }

        let currentFilter = 'all';
        let currentPage = 1;
        let alertToResolve = null;
        let alertCounts = { all: 0, unread: 0, read: 0, resolved: 0 };

        async function loadAlerts(page = 1, filter = 'all') {
            const container = document.getElementById('alertsContainer');
            container.innerHTML = '<div class="loading-container"><div class="spinner"></div></div>';

            try {
                const query = Utils.buildQuery({ page, status: filter !== 'all' ? filter : '' });
                const response = await API.get(`/doctor/alerts?${query}`);
                const alerts = response.data.alerts;

                // Update counts
                if (response.data.counts) {
                    alertCounts = response.data.counts;
                    document.getElementById('countAll').textContent = alertCounts.all || 0;
                    document.getElementById('countUnread').textContent = alertCounts.unread || 0;
                    document.getElementById('countRead').textContent = alertCounts.read || 0;
                    document.getElementById('countResolved').textContent = alertCounts.resolved || 0;

                    // Update sidebar badge
                    const badge = document.getElementById('alertBadge');
                    if (alertCounts.unread > 0) {
                        badge.textContent = alertCounts.unread;
                        badge.style.display = 'inline';
                    } else {
                        badge.style.display = 'none';
                    }
                }

                if (alerts.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <div class="empty-state-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                                </svg>
                            </div>
                            <div class="empty-state-title">Aucune alerte</div>
                            <div class="empty-state-text">
                                ${filter === 'unread' ? 'Toutes les alertes ont été traitées.' : 
                                  filter === 'resolved' ? 'Aucune alerte résolue.' : 
                                  'Aucune alerte pour le moment.'}
                            </div>
                        </div>
                    `;
                } else {
                    container.innerHTML = alerts.map(alert => renderAlertCard(alert)).join('');
                }

                // Pagination
                currentPage = response.data.pagination.current_page;
                renderPagination(response.data.pagination);

            } catch (error) {
                container.innerHTML = `<div class="text-center text-danger p-lg">${error.message}</div>`;
            }
        }

        function renderAlertCard(alert) {
            const isUnread = !alert.read_at && !alert.resolved_at;
            const isResolved = !!alert.resolved_at;
            const grade = alert.exam?.grade || 0;
            const initials = alert.patient ? 
                (alert.patient.first_name[0] + alert.patient.last_name[0]).toUpperCase() : 'XX';

            return `
                <div class="alert-card ${isUnread ? 'unread' : ''} ${isResolved ? 'resolved' : ''} grade-${grade}">
                    <div class="alert-header">
                        <div class="alert-title">
                            <div class="alert-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                    <line x1="12" y1="9" x2="12" y2="13"/>
                                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                            </div>
                            <div class="alert-meta">
                                <h4>${alert.type === 'urgent' ? '⚠️ Alerte Urgente' : 'Alerte'}</h4>
                                <p>${Utils.formatDateTime(alert.created_at)}</p>
                            </div>
                        </div>
                        <span class="badge ${grade >= 4 ? 'badge-critical' : grade >= 3 ? 'badge-danger' : 'badge-warning'}">
                            Grade ${grade}
                        </span>
                    </div>
                    <div class="alert-body">
                        <p class="alert-message">${Utils.escapeHtml(alert.message)}</p>
                        
                        ${alert.patient ? `
                            <div class="alert-patient">
                                <div class="patient-avatar">${initials}</div>
                                <div class="patient-info">
                                    <h5>${Utils.escapeHtml(alert.patient.first_name)} ${Utils.escapeHtml(alert.patient.last_name)}</h5>
                                    <p>N° ${Utils.escapeHtml(alert.patient.medical_record_number || '-')}</p>
                                </div>
                                ${alert.exam_id ? `
                                    <a href="/diabetic-retinopathy/php-app/public/doctor/exams/${alert.exam_id}" 
                                       class="btn btn-sm btn-primary" style="margin-left: auto;">
                                        Voir l'examen
                                    </a>
                                ` : ''}
                            </div>
                        ` : ''}

                        ${isResolved ? `
                            <div class="resolution-note">
                                <strong>✓ Résolu le ${Utils.formatDateTime(alert.resolved_at)}</strong>
                                ${alert.resolution_note ? Utils.escapeHtml(alert.resolution_note) : ''}
                            </div>
                        ` : `
                            <div class="alert-actions">
                                ${isUnread ? `
                                    <button class="btn btn-sm btn-secondary" onclick="markAsRead(${alert.id})">
                                        Marquer comme lu
                                    </button>
                                ` : ''}
                                <button class="btn btn-sm btn-success" onclick="openResolveModal(${alert.id})">
                                    Résoudre
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }

        function renderPagination(pagination) {
            const container = document.getElementById('paginationContainer');
            if (pagination.total_pages <= 1) {
                container.innerHTML = '';
                return;
            }

            let html = '<div class="pagination">';
            html += `<button class="pagination-btn" ${pagination.current_page === 1 ? 'disabled' : ''} 
                      onclick="loadAlerts(${pagination.current_page - 1}, '${currentFilter}')">
                        ← Précédent
                     </button>`;
            html += `<span class="pagination-info">Page ${pagination.current_page} sur ${pagination.total_pages}</span>`;
            html += `<button class="pagination-btn" ${pagination.current_page === pagination.total_pages ? 'disabled' : ''} 
                      onclick="loadAlerts(${pagination.current_page + 1}, '${currentFilter}')">
                        Suivant →
                     </button>`;
            html += '</div>';
            container.innerHTML = html;
        }

        async function markAsRead(alertId) {
            try {
                await API.put(`/doctor/alerts/${alertId}/read`);
                Toast.success('Alerte marquée comme lue');
                loadAlerts(currentPage, currentFilter);
            } catch (error) {
                Toast.error(error.message);
            }
        }

        function openResolveModal(alertId) {
            alertToResolve = alertId;
            document.getElementById('resolutionNote').value = '';
            document.getElementById('resolveModal').classList.add('active');
        }

        function closeResolveModal() {
            alertToResolve = null;
            document.getElementById('resolveModal').classList.remove('active');
        }

        async function confirmResolve() {
            if (!alertToResolve) return;

            const note = document.getElementById('resolutionNote').value.trim();
            
            try {
                await API.put(`/doctor/alerts/${alertToResolve}/resolve`, {
                    resolution_note: note
                });
                Toast.success('Alerte résolue avec succès');
                closeResolveModal();
                loadAlerts(currentPage, currentFilter);
            } catch (error) {
                Toast.error(error.message);
            }
        }

        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                currentFilter = this.dataset.filter;
                loadAlerts(1, currentFilter);
            });
        });

        // Initial load
        loadAlerts();
    </script>
</body>
</html>
