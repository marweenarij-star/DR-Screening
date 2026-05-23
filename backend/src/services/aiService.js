/**
 * AI Service Client
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const REPO_ROOT = path.resolve(__dirname, '../../..');
const AI_SERVICE_DIR = path.join(REPO_ROOT, 'ai-service');
const AI_SERVICE_MAIN = path.join(AI_SERVICE_DIR, 'main.py');
const DEFAULT_PYTHON = path.join(REPO_ROOT, '.venv', 'Scripts', 'python.exe');

let startupPromise = null;

function getPythonExecutable() {
    const configuredPython = process.env.AI_SERVICE_PYTHON || process.env.PYTHON;
    if (configuredPython && configuredPython.trim()) {
        return configuredPython.trim();
    }

    if (fs.existsSync(DEFAULT_PYTHON)) {
        return DEFAULT_PYTHON;
    }

    return 'python';
}

function isConnectivityError(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();
    return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH'].includes(code)
        || message.includes('connect')
        || message.includes('socket hang up')
        || message.includes('timeout');
}

async function checkHealth() {
    try {
        const response = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
        return response.data;
    } catch (error) {
        return { status: 'error', message: error.message };
    }
}

async function waitForHealthyService(timeoutMs = 180000, intervalMs = 2000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const health = await checkHealth();
        if (health && (health.status === 'healthy' || health.model_loaded)) {
            return health;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`AI service did not become healthy within ${timeoutMs}ms`);
}

async function ensureAiServiceRunning() {
    const health = await checkHealth();
    if (health && (health.status === 'healthy' || health.model_loaded)) {
        return health;
    }

    if (!startupPromise) {
        startupPromise = (async () => {
            if (!fs.existsSync(AI_SERVICE_MAIN)) {
                throw new Error(`AI service entry point not found: ${AI_SERVICE_MAIN}`);
            }

            const pythonExecutable = getPythonExecutable();
            const child = spawn(pythonExecutable, [AI_SERVICE_MAIN], {
                cwd: AI_SERVICE_DIR,
                detached: true,
                stdio: 'ignore',
                windowsHide: true
            });

            child.unref();
            return waitForHealthyService();
        })();
    }

    try {
        return await startupPromise;
    } finally {
        startupPromise = null;
    }
}

async function postPrediction(form, urlPath) {
    return axios.post(`${AI_SERVICE_URL}${urlPath}`, form, {
        headers: form.getHeaders(),
        timeout: 60000
    });
}

async function predict(imagePath) {
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(imagePath));

        let response;
        try {
            response = await postPrediction(form, '/predict');
        } catch (error) {
            if (!isConnectivityError(error)) {
                throw error;
            }

            console.warn(`AI service unreachable at ${AI_SERVICE_URL}. Starting local service and retrying...`);
            await ensureAiServiceRunning();

            const retryForm = new FormData();
            retryForm.append('file', fs.createReadStream(imagePath));
            response = await postPrediction(retryForm, '/predict');
        }
        
        return response.data;
    } catch (error) {
        console.error('AI Service error:', error.message);
        throw new Error(`AI service unavailable: ${error.message}`);
    }
}

async function getGradCAM(imagePath, targetClass = null) {
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(imagePath));
        
        let url = `${AI_SERVICE_URL}/gradcam`;
        if (targetClass !== null) {
            // Support both AI variants:
            // - main.py expects `grade`
            // - main_resnet.py expects `target_class`
            const encodedClass = encodeURIComponent(targetClass);
            url += `?grade=${encodedClass}&target_class=${encodedClass}`;
        }
        
        const response = await axios.post(url, form, {
            headers: form.getHeaders(),
            responseType: 'arraybuffer',
            timeout: 60000
        });
        
        return Buffer.from(response.data);
    } catch (error) {
        console.error('Grad-CAM error:', error.message);
        return null;
    }
}

async function healthCheck() {
    try {
        return await checkHealth();
    } catch (error) {
        return { status: 'error', message: error.message };
    }
}

module.exports = {
    predict,
    getGradCAM,
    healthCheck
};
