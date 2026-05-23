/**
 * SMS Service using Twilio
 */

const GRADE_LABELS = {
    0: 'Pas de RD',
    1: 'RD Légère',
    2: 'RD Modérée',
    3: 'RD Sévère',
    4: 'RD Proliférante'
};

// Initialize Twilio client only if credentials are provided
let twilioClient = null;

function getTwilioClient() {
    if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        try {
            const twilio = require('twilio');
            twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            console.log('Twilio client initialized successfully');
        } catch (error) {
            console.log('Twilio not installed or configured:', error.message);
        }
    }
    return twilioClient;
}

async function sendSMS(to, message) {
    // Check if SMS is configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        console.log('SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env');
        return false;
    }

    // Validate phone number
    if (!to) {
        console.log('SMS skipped: No phone number provided');
        return false;
    }

    try {
        const client = getTwilioClient();
        if (!client) {
            console.log('Twilio client not available');
            return false;
        }

        // Format phone number (add country code if missing)
        let formattedPhone = to.replace(/\s/g, '');
        if (!formattedPhone.startsWith('+')) {
            // Assume Tunisia (+216) if no country code
            formattedPhone = '+216' + formattedPhone.replace(/^0/, '');
        }

        console.log(`Sending SMS from ${process.env.TWILIO_PHONE_NUMBER} to ${formattedPhone}...`);
        
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formattedPhone
        });

        console.log('SMS sent successfully! SID:', result.sid);
        return true;
    } catch (error) {
        console.error('SMS error:', error.message);
        return false;
    }
}

async function sendUrgentSMS(doctorPhone, doctorName, patientName, grade, confidence, examId) {
    const message = `ALERTE URGENTE - DR Screening

Dr. ${doctorName}, cas urgent:

Patient: ${patientName}
Diagnostic: ${GRADE_LABELS[grade]}
Grade: ${grade}/4
Confiance: ${confidence.toFixed(1)}%

Examen #${examId}`;

    return sendSMS(doctorPhone, message);
}

module.exports = {
    sendSMS,
    sendUrgentSMS
};
