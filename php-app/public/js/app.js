/**
 * Diabetic Retinopathy Screening System
 * Main JavaScript Application
 */

// ===== Configuration =====
const CONFIG = {
    API_BASE: '/diabetic-retinopathy/php-app/public/api',
    WS_URL: 'ws://localhost:8080',
    TOKEN_KEY: 'dr_auth_token',
    USER_KEY: 'dr_user_data'
};

// ===== API Client =====
const API = {
    /**
     * Make API request
     */
    async request(endpoint, options = {}) {
        const url = CONFIG.API_BASE + endpoint;
        const token = Auth.getToken();
        
        const headers = {
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Don't set Content-Type for FormData (browser will set with boundary)
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new APIError(data.error || 'Erreur serveur', response.status, data);
            }

            return data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError('Erreur de connexion au serveur', 0);
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, data) {
        const body = data instanceof FormData ? data : JSON.stringify(data);
        return this.request(endpoint, { method: 'POST', body });
    },

    put(endpoint, data) {
        return this.request(endpoint, { 
            method: 'PUT', 
            body: JSON.stringify(data) 
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

class APIError extends Error {
    constructor(message, status, data = null) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

// ===== Authentication =====
const Auth = {
    getToken() {
        return localStorage.getItem(CONFIG.TOKEN_KEY);
    },

    setToken(token) {
        localStorage.setItem(CONFIG.TOKEN_KEY, token);
    },

    getUser() {
        const data = localStorage.getItem(CONFIG.USER_KEY);
        return data ? JSON.parse(data) : null;
    },

    setUser(user) {
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    async login(email, password) {
        const response = await API.post('/auth/login', { email, password });
        
        if (response.success && response.data) {
            this.setToken(response.data.access_token);
            this.setUser(response.data.user);
            return response.data.user;
        }
        
        throw new Error(response.error || 'Échec de la connexion');
    },

    logout() {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
        
        const user = this.getUser();
        if (user?.role === 'doctor') {
            window.location.href = '/diabetic-retinopathy/php-app/public/doctor/login';
        } else {
            window.location.href = '/diabetic-retinopathy/php-app/public/login';
        }
    },

    async verify() {
        try {
            const response = await API.get('/auth/verify');
            return response.success && response.data?.valid;
        } catch {
            return false;
        }
    },

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/diabetic-retinopathy/php-app/public/login';
            return false;
        }
        return true;
    }
};

// ===== Toast Notifications =====
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
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        toast.innerHTML = `
            <span class="toast-icon" style="color: var(--${type === 'error' ? 'danger' : type})">
                ${icons[type] || icons.info}
            </span>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        this.container.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    },

    success(message) { return this.show(message, 'success'); },
    error(message) { return this.show(message, 'error'); },
    warning(message) { return this.show(message, 'warning'); },
    info(message) { return this.show(message, 'info'); }
};

// ===== Modal =====
const Modal = {
    show(options) {
        const { title, content, footer, size = '' } = options;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal ${size}">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="modal-close" data-close>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="modal-body">${content}</div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;

        document.body.appendChild(overlay);
        
        // Close handlers
        overlay.querySelector('[data-close]').onclick = () => this.close(overlay);
        overlay.onclick = (e) => {
            if (e.target === overlay) this.close(overlay);
        };

        // Show with animation
        requestAnimationFrame(() => overlay.classList.add('active'));

        return overlay;
    },

    close(overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    },

    confirm(message) {
        return new Promise((resolve) => {
            const modal = this.show({
                title: 'Confirmation',
                content: `<p>${message}</p>`,
                footer: `
                    <button class="btn btn-secondary" data-close>Annuler</button>
                    <button class="btn btn-danger" data-confirm>Confirmer</button>
                `
            });

            modal.querySelector('[data-confirm]').onclick = () => {
                this.close(modal);
                resolve(true);
            };
            modal.querySelector('[data-close]').onclick = () => {
                this.close(modal);
                resolve(false);
            };
        });
    }
};

// ===== WebSocket Client =====
class WebSocketClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.handlers = {};
    }

    connect() {
        const token = Auth.getToken();
        if (!token) return;

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                // Send auth token
                this.send('auth', { token });
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.error('WS message parse error:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.tryReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (e) {
            console.error('WebSocket connection failed:', e);
        }
    }

    tryReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`Reconnecting in ${delay}ms...`);
            setTimeout(() => this.connect(), delay);
        }
    }

    send(event, data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ event, data }));
        }
    }

    on(event, handler) {
        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }
        this.handlers[event].push(handler);
    }

    handleMessage(message) {
        const { event, data } = message;
        
        if (this.handlers[event]) {
            this.handlers[event].forEach(handler => handler(data));
        }

        // Handle specific events
        if (event === 'new_exam') {
            this.onNewExam(data);
        } else if (event === 'new_alert') {
            this.onNewAlert(data);
        }
    }

    onNewExam(data) {
        Toast.info(`Nouvel examen reçu: ${data.patient_name}`);
        
        // Dispatch custom event for page updates
        window.dispatchEvent(new CustomEvent('newExam', { detail: data }));
    }

    onNewAlert(data) {
        Toast.warning(`⚠️ Alerte urgente: ${data.message}`);
        
        // Update alert badge
        const badge = document.querySelector('.nav-badge');
        if (badge) {
            const count = parseInt(badge.textContent || '0') + 1;
            badge.textContent = count;
        }
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('newAlert', { detail: data }));
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// ===== Utilities =====
const Utils = {
    /**
     * Format date
     */
    formatDate(dateString, options = {}) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            ...options
        });
    },

    /**
     * Format datetime
     */
    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Get URL parameters
     */
    getUrlParams() {
        return Object.fromEntries(new URLSearchParams(window.location.search));
    },

    /**
     * Build query string
     */
    buildQuery(params) {
        return Object.entries(params)
            .filter(([_, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Get grade label
     */
    getGradeLabel(grade) {
        const labels = {
            0: 'Pas de RD',
            1: 'RD légère',
            2: 'RD modérée',
            3: 'RD sévère',
            4: 'RD proliférante'
        };
        return labels[grade] || `Grade ${grade}`;
    },

    /**
     * Get grade badge class
     */
    getGradeBadgeClass(grade) {
        const classes = {
            0: 'badge-success',
            1: 'badge-info',
            2: 'badge-warning',
            3: 'badge-danger',
            4: 'badge-critical'
        };
        return classes[grade] || 'badge-secondary';
    }
};

// ===== Form Validation =====
const Validator = {
    rules: {
        required: (value) => value?.trim() !== '',
        email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        minLength: (value, min) => value?.length >= min,
        maxLength: (value, max) => value?.length <= max,
        numeric: (value) => !isNaN(value),
        phone: (value) => /^[+]?[\d\s-]{8,}$/.test(value)
    },

    messages: {
        required: 'Ce champ est requis',
        email: 'Adresse email invalide',
        minLength: (min) => `Minimum ${min} caractères`,
        maxLength: (max) => `Maximum ${max} caractères`,
        numeric: 'Valeur numérique requise',
        phone: 'Numéro de téléphone invalide'
    },

    validate(formElement) {
        const inputs = formElement.querySelectorAll('[data-validate]');
        const errors = {};
        let isValid = true;

        inputs.forEach(input => {
            const rules = input.dataset.validate.split('|');
            const value = input.value;
            const name = input.name;

            for (const rule of rules) {
                const [ruleName, param] = rule.split(':');
                
                if (!this.rules[ruleName]) continue;

                const valid = param 
                    ? this.rules[ruleName](value, param)
                    : this.rules[ruleName](value);

                if (!valid) {
                    isValid = false;
                    errors[name] = typeof this.messages[ruleName] === 'function'
                        ? this.messages[ruleName](param)
                        : this.messages[ruleName];
                    
                    input.classList.add('error');
                    break;
                } else {
                    input.classList.remove('error');
                }
            }
        });

        return { isValid, errors };
    },

    showErrors(formElement, errors) {
        // Clear existing errors
        formElement.querySelectorAll('.form-error').forEach(el => el.remove());

        // Show new errors
        Object.entries(errors).forEach(([name, message]) => {
            const input = formElement.querySelector(`[name="${name}"]`);
            if (input) {
                const errorEl = document.createElement('div');
                errorEl.className = 'form-error';
                errorEl.textContent = message;
                input.parentElement.appendChild(errorEl);
            }
        });
    }
};

// ===== File Upload Handler =====
class FileUploader {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        this.options = {
            maxSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: ['image/jpeg', 'image/png'],
            onSelect: null,
            ...options
        };
        this.file = null;
        this.init();
    }

    init() {
        if (!this.container) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = this.options.allowedTypes.join(',');
        input.style.display = 'none';
        this.container.appendChild(input);
        this.input = input;

        // Click to upload
        this.container.onclick = () => input.click();

        // File selected
        input.onchange = (e) => this.handleFile(e.target.files[0]);

        // Drag and drop
        this.container.ondragover = (e) => {
            e.preventDefault();
            this.container.classList.add('dragover');
        };

        this.container.ondragleave = () => {
            this.container.classList.remove('dragover');
        };

        this.container.ondrop = (e) => {
            e.preventDefault();
            this.container.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        };
    }

    handleFile(file) {
        if (!file) return;

        // Validate type
        if (!this.options.allowedTypes.includes(file.type)) {
            Toast.error('Type de fichier non autorisé. Utilisez JPG ou PNG.');
            return;
        }

        // Validate size
        if (file.size > this.options.maxSize) {
            const maxMb = this.options.maxSize / 1024 / 1024;
            Toast.error(`Le fichier dépasse ${maxMb} MB`);
            return;
        }

        this.file = file;
        this.container.classList.add('has-file');

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            let preview = this.container.querySelector('.file-preview');
            if (!preview) {
                preview = document.createElement('div');
                preview.className = 'file-preview';
                this.container.appendChild(preview);
            }
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <p class="text-sm mt-sm">${file.name}</p>
            `;
        };
        reader.readAsDataURL(file);

        if (this.options.onSelect) {
            this.options.onSelect(file);
        }
    }

    getFile() {
        return this.file;
    }

    reset() {
        this.file = null;
        this.input.value = '';
        this.container.classList.remove('has-file');
        const preview = this.container.querySelector('.file-preview');
        if (preview) preview.remove();
    }
}

// ===== Pagination Component =====
class Pagination {
    constructor(options = {}) {
        this.currentPage = 1;
        this.totalPages = 1;
        this.onChange = options.onChange || (() => {});
    }

    update(data) {
        this.currentPage = data.current_page;
        this.totalPages = data.total_pages;
    }

    render() {
        if (this.totalPages <= 1) return '';

        let html = '<div class="pagination">';
        
        // Previous
        html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} 
                  onclick="this.closest('.pagination').dispatchEvent(new CustomEvent('page', {detail: ${this.currentPage - 1}}))">
                    ← Précédent
                 </button>`;

        // Page numbers
        const start = Math.max(1, this.currentPage - 2);
        const end = Math.min(this.totalPages, this.currentPage + 2);

        if (start > 1) {
            html += `<button class="pagination-btn" onclick="this.closest('.pagination').dispatchEvent(new CustomEvent('page', {detail: 1}))">1</button>`;
            if (start > 2) html += '<span class="pagination-info">...</span>';
        }

        for (let i = start; i <= end; i++) {
            html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                      onclick="this.closest('.pagination').dispatchEvent(new CustomEvent('page', {detail: ${i}}))">
                        ${i}
                     </button>`;
        }

        if (end < this.totalPages) {
            if (end < this.totalPages - 1) html += '<span class="pagination-info">...</span>';
            html += `<button class="pagination-btn" onclick="this.closest('.pagination').dispatchEvent(new CustomEvent('page', {detail: ${this.totalPages}}))">${this.totalPages}</button>`;
        }

        // Next
        html += `<button class="pagination-btn" ${this.currentPage === this.totalPages ? 'disabled' : ''} 
                  onclick="this.closest('.pagination').dispatchEvent(new CustomEvent('page', {detail: ${this.currentPage + 1}}))">
                    Suivant →
                 </button>`;

        html += '</div>';
        return html;
    }
}

// ===== Initialize on DOM Ready =====
document.addEventListener('DOMContentLoaded', () => {
    // Update user info in sidebar
    const user = Auth.getUser();
    if (user) {
        const userNameEl = document.querySelector('.user-name');
        const userRoleEl = document.querySelector('.user-role');
        const userAvatarEl = document.querySelector('.user-avatar');
        
        if (userNameEl) userNameEl.textContent = user.name;
        if (userRoleEl) userRoleEl.textContent = user.role === 'doctor' ? 'Médecin' : 'Administrateur';
        if (userAvatarEl) userAvatarEl.textContent = user.name.charAt(0).toUpperCase();
    }

    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.onclick = () => sidebar.classList.toggle('open');
    }

    // Logout button
    const logoutBtn = document.querySelector('[data-logout]');
    if (logoutBtn) {
        logoutBtn.onclick = (e) => {
            e.preventDefault();
            Auth.logout();
        };
    }
});

// Export for global use
window.API = API;
window.Auth = Auth;
window.Toast = Toast;
window.Modal = Modal;
window.Utils = Utils;
window.Validator = Validator;
window.FileUploader = FileUploader;
window.Pagination = Pagination;
window.WebSocketClient = WebSocketClient;
