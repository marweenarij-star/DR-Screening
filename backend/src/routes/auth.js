/**
 * Authentication Routes
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateToken, verifyActivationToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

const PASSWORD_POLICY = {
    minLength: 12,
    requireLower: true,
    requireUpper: true,
    requireDigit: true,
    requireSpecial: true,
    forbidSpaces: true
};

function evaluatePasswordPolicy(rawPassword) {
    const password = String(rawPassword || '');
    const checks = {
        minLength: password.length >= PASSWORD_POLICY.minLength,
        lower: !PASSWORD_POLICY.requireLower || /[a-z]/.test(password),
        upper: !PASSWORD_POLICY.requireUpper || /[A-Z]/.test(password),
        digit: !PASSWORD_POLICY.requireDigit || /\d/.test(password),
        special: !PASSWORD_POLICY.requireSpecial || /[^A-Za-z0-9]/.test(password),
        noSpaces: !PASSWORD_POLICY.forbidSpaces || !/\s/.test(password)
    };

    const unmet = [];
    if (!checks.minLength) unmet.push(`au moins ${PASSWORD_POLICY.minLength} caracteres`);
    if (!checks.lower) unmet.push('au moins une lettre minuscule');
    if (!checks.upper) unmet.push('au moins une lettre majuscule');
    if (!checks.digit) unmet.push('au moins un chiffre');
    if (!checks.special) unmet.push('au moins un caractere special');
    if (!checks.noSpaces) unmet.push('aucun espace');

    return {
        valid: unmet.length === 0,
        unmet,
        checks
    };
}

function strongPasswordErrorMessage() {
    return `Le mot de passe doit contenir au moins ${PASSWORD_POLICY.minLength} caracteres, avec majuscule, minuscule, chiffre, caractere special et sans espaces`;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email et mot de passe requis'
            });
        }
        
        // Find user
        const user = await db.queryOne(
            `SELECT u.*, c.status as center_status
             FROM users u
             LEFT JOIN centers c ON c.id = u.center_id
             WHERE u.email = ?`,
            [email]
        );
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Adresse email incorrecte ou inexistante'
            });
        }
        
        // Check if account is pending activation
        if (user.account_status === 'pending') {
        const updatedUser = await db.queryOne('SELECT id, email, role, center_id FROM users WHERE id = ?', [user.id]);

        if (updatedUser.role === 'center_admin' && updatedUser.center_id) {
            await db.update('centers', { status: 'active' }, 'id = ?', [updatedUser.center_id]);
        }
            return res.status(403).json({
                success: false,
                error: 'Compte en attente d\'activation. Veuillez vérifier votre email pour activer votre compte.'
            });
        }
        
        // Check if account is inactive
        if (user.account_status === 'inactive') {
            return res.status(403).json({
                success: false,
                error: 'Compte suspendu. Contactez l\'administrateur du centre.'
            });
        }

        // Verify password — only reached once we know the email exists, so the
        // message can be specific to the password.
        if (!user.password_hash) {
            return res.status(403).json({
                success: false,
                error: 'Compte non activé. Veuillez définir votre mot de passe via le lien d\'activation reçu par email.'
            });
        }
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'Mot de passe incorrect'
            });
        }

        if (user.is_active === 0) {
            return res.status(403).json({
                success: false,
                error: 'Compte suspendu. Contactez le support.'
            });
        }

        if (
            user.role !== 'super_admin' &&
            user.center_status &&
            user.center_status !== 'active'
        ) {
            return res.status(403).json({
                success: false,
                error: 'Centre non actif. Accès temporairement indisponible.'
            });
        }
        
        // Generate token
        const token = generateToken({
            user_id: user.id,
            email: user.email,
            role: user.role,
            center_id: user.center_id
        });
        
        // Calculate expiry
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 8);
        
        // Split name into first and last
        const nameParts = (user.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        res.json({
            success: true,
            data: {
                access_token: token,
                token,
                expires_at: expiresAt.toISOString(),
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    first_name: firstName,
                    last_name: lastName,
                    role: user.role,
                    center_id: user.center_id,
                    must_change_password: !!user.must_change_password
                }
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// GET /api/auth/verify
router.get('/verify', authMiddleware, async (req, res) => {
    try {
        const user = await db.queryOne(
            'SELECT id, email, name, role, center_id FROM users WHERE id = ?',
            [req.user.user_id]
        );
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        const nameParts = (user.name || '').split(' ');
        
        res.json({
            success: true,
            data: {
                valid: true,
                id: user.id,
                email: user.email,
                first_name: nameParts[0] || '',
                last_name: nameParts.slice(1).join(' ') || '',
                role: user.role,
                center_id: user.center_id
            }
        });
        
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (req, res) => {
    res.json({
        success: true,
        message: 'Déconnexion réussie'
    });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!new_password) {
            return res.status(400).json({ success: false, error: 'Nouveau mot de passe requis' });
        }

        const passwordEval = evaluatePasswordPolicy(new_password);
        if (!passwordEval.valid) {
            return res.status(400).json({ success: false, error: strongPasswordErrorMessage() });
        }

        const user = await db.queryOne('SELECT id, password_hash, must_change_password FROM users WHERE id = ?', [req.user.user_id]);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
        }

        const isFirstLoginForcedChange = !!user.must_change_password;
        if (!isFirstLoginForcedChange) {
            if (!current_password) {
                return res.status(400).json({ success: false, error: 'Mot de passe actuel requis' });
            }

            const validPassword = await bcrypt.compare(current_password, user.password_hash);
            if (!validPassword) {
                return res.status(401).json({ success: false, error: 'Mot de passe actuel incorrect' });
            }
        }

        const passwordHash = await bcrypt.hash(new_password, 10);
        await db.update('users', {
            password_hash: passwordHash,
            must_change_password: 0
        }, 'id = ?', [req.user.user_id]);

        res.json({ success: true, message: 'Mot de passe mis à jour avec succès' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// POST /api/auth/activate - Activate account by setting password with activation token
router.post('/activate', async (req, res) => {
    try {
        const { activation_token, password, password_confirm } = req.body;
        
        if (!activation_token || !password || !password_confirm) {
            return res.status(400).json({
                success: false,
                error: 'Token d\'activation, mot de passe et confirmation sont requis'
            });
        }
        
        if (password !== password_confirm) {
            return res.status(400).json({
                success: false,
                error: 'Les mots de passe ne correspondent pas'
            });
        }
        
        const passwordEval = evaluatePasswordPolicy(password);
        if (!passwordEval.valid) {
            return res.status(400).json({
                success: false,
                error: strongPasswordErrorMessage()
            });
        }
        
        // Verify activation token
        const tokenPayload = verifyActivationToken(activation_token);
        if (!tokenPayload) {
            return res.status(401).json({
                success: false,
                error: 'Lien d\'activation invalide ou expiré'
            });
        }
        
        // Find user by email and activation token
        const user = await db.queryOne(
            'SELECT id, email, account_status FROM users WHERE email = ? AND activation_token = ?',
            [tokenPayload.user_email, activation_token]
        );
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé ou lien d\'activation invalide'
            });
        }
        
        if (!['inactive', 'pending'].includes(user.account_status)) {
            return res.status(400).json({
                success: false,
                error: 'Ce compte a déjà été activé'
            });
        }
        
        // Hash password and update user
        const passwordHash = await bcrypt.hash(password, 10);
        await db.update('users', {
            password_hash: passwordHash,
            account_status: 'active',
            is_active: 1,
            activation_token: null,
            token_expires_at: null
        }, 'id = ?', [user.id]);
        const updatedUser = await db.queryOne('SELECT id, email, role, center_id FROM users WHERE id = ?', [user.id]);

        if (updatedUser && updatedUser.role === 'center_admin' && updatedUser.center_id) {
            await db.update('centers', { status: 'active' }, 'id = ?', [updatedUser.center_id]);
        }

        // Generate login token
        
        const loginToken = generateToken({
            user_id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            center_id: updatedUser.center_id
        });
        
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 8);
        
        res.json({
            success: true,
            message: 'Compte activé avec succès',
            data: {
                access_token: loginToken,
                token: loginToken,
                expires_at: expiresAt.toISOString()
            }
        });
        
    } catch (error) {
        console.error('Activation error:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// GET /api/auth/activation-status/:token - Check if activation token is valid
router.get('/activation-status/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        // Verify token signature
        const tokenPayload = verifyActivationToken(token);
        if (!tokenPayload) {
            return res.status(401).json({
                success: false,
                valid: false,
                error: 'Lien d\'activation invalide ou expiré'
            });
        }
        
        // Find user
        const user = await db.queryOne(
            'SELECT id, email, name, account_status FROM users WHERE email = ? AND activation_token = ?',
            [tokenPayload.user_email, token]
        );
        
        if (!user) {
            return res.status(404).json({
                success: false,
                valid: false,
                error: 'Utilisateur non trouvé'
            });
        }
        
        if (user.account_status === 'active') {
            return res.status(400).json({
                success: false,
                valid: false,
                error: 'Ce compte a déjà été activé'
            });
        }
        
        res.json({
            success: true,
            valid: true,
            data: {
                email: user.email,
                name: user.name
            }
        });
        
    } catch (error) {
        console.error('Activation status error:', error);
        res.status(500).json({ success: false, valid: false, error: 'Erreur serveur' });
    }
});

module.exports = router;
