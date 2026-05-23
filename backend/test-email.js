/**
 * Test Email Sending
 * Run: node test-email.js
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
    console.log('🔍 Testing Email Configuration...\n');
    console.log('SMTP Settings:');
    console.log('- Host:', process.env.SMTP_HOST);
    console.log('- Port:', process.env.SMTP_PORT);
    console.log('- Secure:', process.env.SMTP_SECURE);
    console.log('- User:', process.env.SMTP_USER);
    console.log('- Password length:', process.env.SMTP_PASS?.length, 'chars');
    console.log('- From:', process.env.SMTP_FROM);
    
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('\n❌ Error: SMTP_USER or SMTP_PASS not configured in .env');
        process.exit(1);
    }
    
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        console.log('\n📧 Sending test email...');
        
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'DR Screening'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER,  // Send to self
            subject: '✅ Test Email - DR Screening',
            html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px; }
        .content { background: #f5f5f5; padding: 20px; margin-top: 10px; }
        .success { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Email Configuration Test Successful!</h1>
        </div>
        <div class="content">
            <p>This is a test email to verify that the SMTP configuration is working correctly.</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p>If you received this email, the email system is configured correctly.</p>
        </div>
    </div>
</body>
</html>
            `
        });
        
        console.log('\n✅ Email sent successfully!');
        console.log('Response ID:', info.response);
        console.log('\nCheck your inbox (especially spam folder) for the test email.');
        console.log('Email address:', process.env.SMTP_USER);
        
    } catch (error) {
        console.error('\n❌ Error sending email:');
        console.error('Message:', error.message);
        console.error('Code:', error.code);
        console.error('\nTroubleshooting:');
        console.error('1. Verify SMTP credentials in .env');
        console.error('2. Check Gmail app password (not regular password)');
        console.error('3. Ensure 2-Step Verification is enabled on Gmail');
        console.error('4. Try enabling "Less secure app access"');
        process.exit(1);
    }
}

testEmail();
