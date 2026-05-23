/**
 * Email Service using Nodemailer
 */

const nodemailer = require('nodemailer');

// Create transporter dynamically to ensure env vars are loaded
function getTransporter() {
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: port,
        secure: secure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false
        }
    });
}

const GRADE_LABELS = {
    0: 'Pas de Rétinopathie Diabétique',
    1: 'Rétinopathie Diabétique Légère',
    2: 'Rétinopathie Diabétique Modérée',
    3: 'Rétinopathie Diabétique Sévère',
    4: 'Rétinopathie Diabétique Proliférante'
};

async function sendEmail(to, subject, html) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('Email not configured, skipping:', subject);
        return false;
    }
    
    console.log('SMTP Config:', process.env.SMTP_USER, 'Pass length:', process.env.SMTP_PASS?.length);
    
    try {
        const transporter = getTransporter();
        await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'DR Screening'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to,
            subject,
            html
        });
        console.log('Email sent to:', to);
        return true;
    } catch (error) {
        console.error('Email error:', error.message);
        return false;
    }
}

function formatDoctorDisplayName(name = '') {
    const trimmed = String(name).trim();
    if (!trimmed) return 'Dr.';

    const normalized = trimmed.replace(/^dr\.?\s+/i, '').trim();
    return normalized ? `Dr. ${normalized}` : 'Dr.';
}

function formatActivationDoctorName(name = '') {
    const trimmed = String(name).trim();
    if (!trimmed) return 'Dr.';

    const normalized = trimmed.replace(/^dr\.?\s+/i, '').trim();
    return normalized ? `Dr. ${normalized}` : 'Dr.';
}

async function sendUrgentAlert(doctorEmail, patientName, grade, confidence, examId, doctorName = '') {
    const subject = `⚠️ ALERTE URGENTE - ${GRADE_LABELS[grade]} détectée`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e53935; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
        .alert-box { background: white; border-left: 4px solid #e53935; padding: 15px; margin: 15px 0; }
        .btn { display: inline-block; background: #00897b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Alerte Urgente</h1>
        </div>
        <div class="content">
            <p>Cher ${formatDoctorDisplayName(doctorName)},</p>
            
            <div class="alert-box">
                <h3>Cas Nécessitant Attention Immédiate</h3>
                <p><strong>Patient:</strong> ${patientName}</p>
                <p><strong>Diagnostic IA:</strong> ${GRADE_LABELS[grade]}</p>
                <p><strong>Grade:</strong> ${grade}/4</p>
                <p><strong>Confiance:</strong> ${confidence.toFixed(1)}%</p>
            </div>
            
            <p>Un examen rétinien a révélé une rétinopathie diabétique ${grade >= 4 ? 'proliférante' : 'sévère'}. 
            Une évaluation et une prise en charge rapides sont recommandées.</p>
            
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/doctor/exams/${examId}" class="btn">
                Voir l'Examen
            </a>
            
            <div class="footer">
                <p>Ce message a été généré automatiquement par le système DR Screening.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    return sendEmail(doctorEmail, subject, html);
}

async function sendActivationEmail(doctorEmail, doctorName, activationLink) {
    const subject = `Activez votre compte - DR Screening System`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #00897b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; border-left: 4px solid #00897b; padding: 15px; margin: 15px 0; }
        .btn { display: inline-block; background: #00897b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 15px; font-weight: bold; }
        .btn:hover { background: #006b5c; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; margin: 15px 0; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Activation de Compte</h1>
        </div>
        <div class="content">
            <p>Bonjour ${formatActivationDoctorName(doctorName)},</p>
            
            <div class="info-box">
                <h3>Bienvenue sur le Système de Dépistage de la Rétinopathie Diabétique</h3>
                <p>Votre compte a été créé avec succès. Pour commencer à utiliser la plateforme, vous devez activer votre compte en créant votre mot de passe.</p>
            </div>
            
            <p><strong>Étapes pour activer votre compte :</strong></p>
            <ol>
                <li>Cliquez sur le bouton ci-dessous pour accéder au formulaire d'activation</li>
                <li>Créez votre mot de passe sécurisé (au moins 6 caractères)</li>
                <li>Confirmez le mot de passe</li>
                <li>Vous pourrez alors vous connecter à la plateforme</li>
            </ol>
            
            <a href="${activationLink}" class="btn">Activer Mon Compte</a>
            
            <div class="warning">
                <strong>⚠️ Important :</strong> Ce lien d'activation expire dans 24 heures. Si vous ne l'utilisez pas avant son expiration, veuillez demander au gestionnaire du centre de générer un nouveau lien.
            </div>
            
            <p><strong>Si le bouton ne fonctionne pas :</strong> Vous pouvez copier et coller l'adresse suivante dans votre navigateur :</p>
            <p style="word-break: break-all; background: white; padding: 10px; border-radius: 4px; font-size: 12px;">
                ${activationLink}
            </p>
            
            <div class="footer">
                <p>Ce message a été généré automatiquement par le système DR Screening.</p>
                <p>Si vous n'avez pas demandé l'activation de ce compte, veuillez ignorer cet email.</p>
                <p><strong>Support :</strong> Contactez l'administrateur de votre centre pour toute assistance.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    return sendEmail(doctorEmail, subject, html);
}

async function sendCenterAdminActivationEmail(centerEmail, adminEmail, adminName, activationLink) {
    const subject = `Création de compte administrateur - DR Screening`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #00897b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; border-left: 4px solid #00897b; padding: 15px; margin: 15px 0; }
        .credentials-box { background: #f0f8ff; border: 2px solid #00897b; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .credential-item { margin: 10px 0; font-family: monospace; background: white; padding: 10px; border-radius: 3px; }
        .label { font-weight: bold; color: #00897b; }
        .btn { display: inline-block; background: #00897b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 15px; font-weight: bold; }
        .btn:hover { background: #006b5c; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; margin: 15px 0; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Création de Compte Administrateur</h1>
        </div>
        <div class="content">
            <p>Bienvenue,</p>
            
            <div class="info-box">
                <h3>Un compte administrateur a été créé pour votre centre</h3>
                <p>Un administrateur peut maintenant activer son compte et accéder à la plateforme DR Screening en utilisant les identifiants ci-dessous.</p>
            </div>
            
            <div class="credentials-box">
                <h3 style="margin-top: 0; color: #00897b;">Identifiants d'accès de l'administrateur</h3>
                <div class="credential-item">
                    <span class="label">Email :</span><br>
                    ${adminEmail}
                </div>
            </div>
            
            <p><strong>Étapes d'activation :</strong></p>
            <ol>
                <li>Transmettez le lien d'activation ci-dessous à l'administrateur</li>
                <li>L'administrateur clique sur le lien et définit son propre mot de passe</li>
                <li>L'administrateur peut alors se connecter avec son email et son mot de passe</li>
            </ol>
            
            <a href="${activationLink}" class="btn">Lien d'Activation</a>
            
            <p><strong>Lien d'activation complet :</strong></p>
            <p style="word-break: break-all; background: white; padding: 10px; border-radius: 4px; font-size: 12px;">
                ${activationLink}
            </p>
            
            <div class="warning">
                <strong>⚠️ Important :</strong> Ce lien d'activation expire dans 24 heures. Après cette période, un nouveau lien d'activation devra être généré.
            </div>
            
            <div class="footer">
                <p>Ce message a été généré automatiquement par le système DR Screening.</p>
                <p><strong>Support :</strong> En cas de problème, contactez l'équipe support de la plateforme.</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    return sendEmail(centerEmail, subject, html);
}

module.exports = {
    sendEmail,
    sendUrgentAlert,
    sendActivationEmail,
    sendCenterAdminActivationEmail
};
