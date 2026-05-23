/**
 * JWT Authentication Middleware
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const ACTIVATION_SECRET = process.env.ACTIVATION_SECRET || 'activation-secret';

function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRY || '8h'
    });
}

function generateActivationToken(payload) {
    return jwt.sign(payload, ACTIVATION_SECRET, {
        expiresIn: '24h' // Activation link valid for 24 hours
    });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

function verifyActivationToken(token) {
    try {
        return jwt.verify(token, ACTIVATION_SECRET);
    } catch (err) {
        return null;
    }
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Token manquant'
        });
    }
    
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    
    if (!payload) {
        return res.status(401).json({
            success: false,
            error: 'Token invalide ou expiré'
        });
    }
    
    req.user = payload;
    next();
}

function roleMiddleware(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Non authentifié'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Accès non autorisé'
            });
        }
        
        next();
    };
}

module.exports = {
    generateToken,
    generateActivationToken,
    verifyToken,
    verifyActivationToken,
    authMiddleware,
    roleMiddleware,
    JWT_SECRET,
    ACTIVATION_SECRET
};
