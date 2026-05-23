/**
 * DR Screening - Main Application JavaScript
 */

const API_BASE = '/api';

// Token management
const TokenManager = {
    getToken: () => localStorage.getItem('access_token'),
    setToken: (token) => localStorage.setItem('access_token', token),
    removeToken: () => localStorage.removeItem('access_token'),
    
    getUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },
    setUser: (user) => localStorage.setItem('user', JSON.stringify(user)),
    removeUser: () => localStorage.removeItem('user'),
    
    clear: () => {
        TokenManager.removeToken();
        TokenManager.removeUser();
    }
};

// API Client
const api = {
    async request(url, options = {}) {
        const token = TokenManager.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Handle FormData
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }
        
        try {
            const response = await fetch(`${API_BASE}${url}`, {
                ...options,
                headers
            });
            
            if (response.status === 401) {
                TokenManager.clear();
                window.location.href = '/login';
                return null;
            }
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erreur de connexion');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    get: (url) => api.request(url, { method: 'GET' }),
    post: (url, data) => api.request(url, { 
        method: 'POST', 
        body: data instanceof FormData ? data : JSON.stringify(data)
    }),
    // Robust FormData POST helper that preserves Authorization header and avoids JSON coercion
    postForm: async (url, formData) => {
        const token = TokenManager.getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const controller = new AbortController();
        const timeoutMs = 30000; // 30s
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(`${API_BASE}${url}`, {
                method: 'POST',
                headers,
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.status === 401) {
                TokenManager.clear();
                window.location.href = '/login';
                return null;
            }

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Erreur de connexion');
            return data;
        } catch (err) {
            clearTimeout(timeoutId);
            if (err && err.name === 'AbortError') {
                Toast.show('L\'envoi a expiré (trop long). Vérifiez la connexion et réessayez.', 'danger');
                throw new Error('Upload timeout');
            }
            console.error('postForm error:', err);
            throw err;
        }
    },
    put: (url, data) => api.request(url, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (url) => api.request(url, { method: 'DELETE' })
};

// Debounce utility to prevent rapid-fire alert reloads
const debounce = (func, delay = 500) => {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

// WebSocket Manager
const WebSocketManager = {
    ws: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    loadAlertsDebounced: null,
    
    connect() {
        const token = TokenManager.getToken();
        if (!token) return;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8080`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.ws.send(JSON.stringify({ type: 'auth', token }));
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (e) {
                console.error('WebSocket message error:', e);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), 3000);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    },
    
    handleMessage(data) {
        switch (data.type) {
            case 'new_exam':
                Toast.show(`Nouvel examen reçu${data.exam && data.exam.grade ? ' - Grade ' + data.exam.grade : ''}`, 'info');
                this.updateBadges();
                // Show 'Ouvrir' buttons for center admins and navigate automatically when appropriate
                const examId = data.exam && (data.exam.id || data.exam.exam_id || data.exam._id);
                if (examId) {
                    try {
                        const user = TokenManager.getUser();
                        if (user && user.role === 'center_admin') {
                            showCenterOpenButtons(examId);
                            const path = window.location.pathname || '';
                            if (path.startsWith('/center/new-exam') || path.startsWith('/center/history') || path.startsWith('/center/dashboard')) {
                                window.location.href = `/center/exams/${examId}`;
                            }
                        } else if (user && user.role === 'doctor') {
                            const path = window.location.pathname || '';
                            if (path.startsWith('/doctor/dashboard') || path.startsWith('/doctor/exams')) {
                                window.location.href = `/doctor/exams/${examId}`;
                            }
                        }
                    } catch (e) {
                        console.error('new_exam handling error', e);
                    }
                }
                if (window.loadExams) {
                    if (!this.loadExamsDebounced) {
                        this.loadExamsDebounced = debounce(window.loadExams, 500);
                    }
                    this.loadExamsDebounced();
                }
                break;
                
            case 'new_alert':
                Toast.show(data.alert.message, 'danger');
                this.updateBadges();
                if (window.loadAlerts) {
                    if (!this.loadAlertsDebounced) {
                        this.loadAlertsDebounced = debounce(window.loadAlerts, 500);
                    }
                    this.loadAlertsDebounced();
                }
                break;
                
            case 'auth_success':
                console.log('WebSocket authenticated');
                break;
        }
    },
    
    updateBadges() {
        // Update alert badge if on doctor pages
        const badge = document.getElementById('alert-badge');
        if (badge) {
            api.get('/doctor/alerts/count').then(response => {
                if (response && response.success) {
                    badge.textContent = response.data.unread;
                    badge.style.display = response.data.unread > 0 ? 'inline' : 'none';
                }
            });
        }
    },
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
};

// Toast Notifications
const Toast = {
    container: null,
    
    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },
    
    show(message, type = 'info', duration = 5000) {
        this.init();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${this.getIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        toast.querySelector('.toast-close').onclick = () => {
            toast.classList.add('toast-hiding');
            setTimeout(() => toast.remove(), 300);
        };
        
        this.container.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('toast-hiding');
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    },
    
    getIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'danger': return 'exclamation-triangle';
            case 'warning': return 'exclamation-circle';
            default: return 'info-circle';
        }
    }
};

// Modal Manager
const Modal = {
    show(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    },
    
    hide(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    },
    
    init() {
        // Close modal on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                    document.body.style.overflow = '';
                }
            });
        });
        
        // Close button
        document.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = btn.closest('.modal');
                if (modal) {
                    modal.classList.remove('show');
                    document.body.style.overflow = '';
                }
            });
        });
    }
};

// Form Utilities
const Form = {
    serialize(form) {
        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        return data;
    },
    
    setErrors(form, errors) {
        // Clear previous errors
        form.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
        });
        form.querySelectorAll('.invalid-feedback').forEach(el => {
            el.textContent = '';
        });
        
        // Set new errors
        if (typeof errors === 'string') {
            Toast.show(errors, 'danger');
            return;
        }
        
        Object.entries(errors).forEach(([field, message]) => {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('is-invalid');
                const feedback = input.nextElementSibling;
                if (feedback && feedback.classList.contains('invalid-feedback')) {
                    feedback.textContent = message;
                }
            }
        });
    },
    
    clear(form) {
        form.reset();
        form.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
        });
    }
};

// Auth Manager
const Auth = {
    async login(email, password) {
        const response = await api.post('/auth/login', { email, password });
        if (response && response.success) {
            TokenManager.setToken(response.data.access_token);
            TokenManager.setUser(response.data.user);
            return response.data;
        }
        return null;
    },
    
    async logout() {
        try {
            await api.post('/auth/logout');
        } catch (e) {
            // Ignore
        }
        TokenManager.clear();
        WebSocketManager.disconnect();
        window.location.href = '/login';
    },
    
    isAuthenticated() {
        return !!TokenManager.getToken();
    },
    
    getUser() {
        return TokenManager.getUser();
    },
    
    checkAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login';
            return false;
        }
        return true;
    },
    
    checkRole(requiredRole) {
        const user = this.getUser();
        if (!user || user.role !== requiredRole) {
            window.location.href = '/login';
            return false;
        }
        return true;
    }
};

// Date formatting
const DateFormat = {
    format(dateStr, options = {}) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            ...options
        });
    },
    
    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    relative(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'À l\'instant';
        if (minutes < 60) return `Il y a ${minutes} min`;
        if (hours < 24) return `Il y a ${hours}h`;
        if (days < 7) return `Il y a ${days}j`;
        return this.format(dateStr);
    }
};

// Pagination Component
class Pagination {
    constructor(container, callback) {
        this.container = container;
        this.callback = callback;
        this.currentPage = 1;
        this.totalPages = 1;
    }
    
    update(data) {
        this.currentPage = data.current_page;
        this.totalPages = data.total_pages;
        this.render();
    }
    
    render() {
        if (this.totalPages <= 1) {
            this.container.innerHTML = '';
            return;
        }
        
        let html = '<nav class="pagination-nav"><ul class="pagination">';
        
        // Previous
        html += `<li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${this.currentPage - 1}">&laquo;</a>
        </li>`;
        
        // Pages
        for (let i = 1; i <= this.totalPages; i++) {
            if (i === 1 || i === this.totalPages || 
                (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                html += `<li class="page-item ${i === this.currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }
        
        // Next
        html += `<li class="page-item ${this.currentPage === this.totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${this.currentPage + 1}">&raquo;</a>
        </li>`;
        
        html += '</ul></nav>';
        this.container.innerHTML = html;
        
        // Event listeners
        this.container.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(link.dataset.page);
                if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
                    this.callback(page);
                }
            });
        });
    }
}

// Grade helpers
const GradeLabels = {
    0: 'Pas de RD',
    1: 'RD Légère',
    2: 'RD Modérée',
    3: 'RD Sévère',
    4: 'RD Proliférante'
};

const GradeClasses = {
    0: 'badge-success',
    1: 'badge-info',
    2: 'badge-warning',
    3: 'badge-danger',
    4: 'badge-critical'
};

function getGradeBadge(grade) {
    return `<span class="badge ${GradeClasses[grade]}">${GradeLabels[grade]}</span>`;
}

function applyThemeClass() {
    const body = document.body;
    if (!body) return;

    body.classList.remove('app-theme-super', 'app-theme-center', 'app-theme-doctor');

    const path = window.location.pathname || '';
    if (path.startsWith('/super/')) {
        body.classList.add('app-theme-super');
        return;
    }
    if (path.startsWith('/center/')) {
        body.classList.add('app-theme-center');
        return;
    }
    if (path.startsWith('/doctor/')) {
        body.classList.add('app-theme-doctor');
        return;
    }

    const user = Auth.getUser();
    if (!user) return;
    if (user.role === 'super_admin') body.classList.add('app-theme-super');
    else if (user.role === 'center_admin') body.classList.add('app-theme-center');
    else if (user.role === 'doctor') body.classList.add('app-theme-doctor');
}

function setupSidebarToggle() {
    // Keep report page clean: no floating menu button on exam report view.
    if (window.location.pathname.startsWith('/doctor/exams/')) return;

    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main-content');
    if (!sidebar || !main) return;

    if (document.querySelector('.sidebar-toggle')) return;

    const toggle = document.createElement('button');
    toggle.className = 'sidebar-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Ouvrir le menu');
    toggle.innerHTML = '<i class="fas fa-bars"></i>';

    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';

    const closeSidebar = () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
        document.body.classList.remove('sidebar-open');
    };

    const openSidebar = () => {
        sidebar.classList.add('open');
        overlay.classList.add('show');
        document.body.classList.add('sidebar-open');
    };

    toggle.addEventListener('click', () => {
        const isOpen = sidebar.classList.contains('open');
        if (isOpen) closeSidebar();
        else openSidebar();
    });

    overlay.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });

    document.body.appendChild(toggle);
    document.body.appendChild(overlay);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    applyThemeClass();
    Modal.init();
    setupSidebarToggle();
    
    // Setup logout buttons
    document.querySelectorAll('[data-logout]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });
    });
    
    // Setup user info display
    const user = Auth.getUser();
    if (user) {
        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = user.full_name || `${user.first_name} ${user.last_name}`;
        });
        document.querySelectorAll('.user-role').forEach(el => {
            if (user.role === 'super_admin') {
                el.textContent = 'Super Admin';
            } else if (user.role === 'center_admin') {
                el.textContent = 'Administrateur';
            } else {
                el.textContent = 'Médecin';
            }
        });
        
        // Connect WebSocket for authenticated users (doctors and center admins)
        if (user.role === 'doctor' || user.role === 'center_admin') {
            WebSocketManager.connect();
        }
    }
});

// Helper: show 'Ouvrir' buttons next to center nav links
function showCenterOpenButtons(examId) {
    try {
        ['new-exam', 'history'].forEach(slug => {
            const link = document.querySelector(`a.nav-link[href="/center/${slug}"]`);
            if (!link) return;
            let btn = link.parentElement.querySelector('.nav-open-btn');
            if (!btn) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'nav-open-btn btn btn-sm btn-outline';
                btn.style.marginRight = '0.5rem';
                btn.style.fontSize = '0.75rem';
                btn.textContent = 'Ouvrir';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    window.location.href = `/center/exams/${examId}`;
                };
                link.parentElement.insertBefore(btn, link);
            } else {
                btn.style.display = 'inline-block';
                btn.onclick = () => { window.location.href = `/center/exams/${examId}`; };
            }
            btn.classList.add('pulse');
            setTimeout(() => btn.classList.remove('pulse'), 2500);
        });
    } catch (e) {
        console.error('showCenterOpenButtons error', e);
    }
}

// Export for use in other scripts
window.API = api;
window.Auth = Auth;
window.Toast = Toast;
window.Modal = Modal;
window.Form = Form;
window.DateFormat = DateFormat;
window.Pagination = Pagination;
window.getGradeBadge = getGradeBadge;
window.GradeLabels = GradeLabels;
window.GradeClasses = GradeClasses;
