const express = require('express');
const path = require('path');
const cors = require('cors');
const os = require('os');
const { exec } = require('child_process');

process.on('uncaughtException', (err) => {
    console.error('⚠️ Excepción no capturada (mantenida viva):', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Promesa no capturada (mantenida viva):', reason);
});

const db = require('./database');
const telegram = require('./telegramService');
const licensing = require('./licensing');
const multer = require('multer');
const fs = require('fs');
let ngrok = null;
try {
    ngrok = require('@ngrok/ngrok');
} catch (e) {
    console.log('ℹ️ Módulo nativo @ngrok/ngrok no disponible en esta arquitectura (omitido con seguridad).');
}

// Sincronizar launcher_config.json con la preferencia guardada en SQLite
try {
    const launcherConfigPath = path.join(__dirname, '..', 'datos_negocio', 'launcher_config.json');
    const row = db.prepare("SELECT value FROM config WHERE key = 'kiosk_printing'").get();
    const isKiosk = row ? (row.value === 'true') : false;
    fs.writeFileSync(launcherConfigPath, JSON.stringify({ kiosk_printing: isKiosk }, null, 2), 'utf8');
} catch (e) {
    console.error('Error inicializando launcher_config.json en arranque:', e);
}

let activeNgrokListener = null; // Track active tunnel

function formatNgrokErrorMessage(rawMsg) {
    if (!rawMsg) return 'Error desconocido al iniciar el túnel de Ngrok.';
    if (rawMsg.includes('ERR_NGROK_108') || rawMsg.includes('3 simultaneous ngrok agent sessions') || rawMsg.includes('limited to 3')) {
        return 'Tu cuenta de Ngrok alcanzó el límite de 3 sesiones simultáneas activas en su plan gratuito.\n\n👉 Para resolverlo:\n1. Ingresa a https://dashboard.ngrok.com/agents\n2. Cierra las sesiones antiguas que hayan quedado abiertas pulsando "Stop".\n(O espera unos minutos a que los servidores de Ngrok liberen las sesiones automáticamente).';
    }
    if (rawMsg.includes('ERR_NGROK_334') || rawMsg.includes('endpoint is already bound')) {
        return 'El subdominio o endpoint personalizado ya está siendo usado por otra sesión activa. Espera 1 minuto a que se libere en la nube.';
    }
    if (rawMsg.includes('ERR_NGROK_105') || rawMsg.includes('authtoken')) {
        return 'El AuthToken de Ngrok ingresado es inválido o no existe. Por favor verifica tu token en tu panel de Ngrok.';
    }
    return rawMsg;
}

async function startNgrokTunnel(forceRestart = false) {
    if (!ngrok) {
        return { success: false, message: 'Ngrok no disponible en este dispositivo/arquitectura.' };
    }
    try {
        const ngrokEnabled = db.prepare("SELECT value FROM config WHERE key = 'ngrok_enabled'").get()?.value === 'true';
        if (!ngrokEnabled) {
            if (activeNgrokListener) {
                try { await activeNgrokListener.close(); } catch(e) {}
                try { await ngrok.kill(); } catch(e) {}
                activeNgrokListener = null;
            }
            return { success: false, message: 'Ngrok desactivado en configuración.' };
        }

        // Si el túnel ya está activo y no es un reinicio forzado, devolver la URL actual
        if (activeNgrokListener && !forceRestart) {
            try {
                const currentUrl = activeNgrokListener.url();
                if (currentUrl) {
                    return { success: true, url: currentUrl, alreadyActive: true };
                }
            } catch (e) {}
        }

        // Desconectar túnel previo si existe
        if (activeNgrokListener) {
            try { await activeNgrokListener.close(); } catch(e) {}
            try { await ngrok.disconnect(); } catch(e) {}
            try { await ngrok.kill(); } catch(e) {}
            activeNgrokListener = null;
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('Iniciando túnel Ngrok...');
        const authtoken = db.prepare("SELECT value FROM config WHERE key = 'ngrok_auth_token'").get()?.value;
        const ngrokConfig = { addr: PORT };
        if (authtoken && authtoken.trim() !== '') {
            ngrokConfig.authtoken = authtoken.trim();
        }
        const ngrokDomain = db.prepare("SELECT value FROM config WHERE key = 'ngrok_domain'").get()?.value;
        if (ngrokDomain && ngrokDomain.trim() !== '') {
            ngrokConfig.domain = ngrokDomain.trim();
        }
        let attempts = 0;
        while (attempts < 3) {
            try {
                activeNgrokListener = await ngrok.forward(ngrokConfig);
                break;
            } catch (fwdErr) {
                attempts++;
                if (fwdErr.message && fwdErr.message.includes('ERR_NGROK_334') && attempts < 3) {
                    console.log(`⚠️ Endpoint ya activo en Ngrok. Esperando liberación de la nube (intento ${attempts}/3)...`);
                    try { await ngrok.kill(); } catch(e) {}
                    await new Promise(r => setTimeout(r, attempts * 2500));
                } else {
                    throw fwdErr;
                }
            }
        }
        const url = activeNgrokListener.url();
        console.log(`\n======================================================`);
        console.log(`🌐 TÚNEL NGROK ACTIVO`);
        console.log(`▶ ${url}`);
        console.log(`======================================================\n`);

        try {
            db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('ngrok_last_url', ?)").run(url);
        } catch (e) {}

        // Notify via Telegram
        const tgToken = db.prepare("SELECT value FROM config WHERE key = 'telegram_bot_token'").get()?.value;
        const tgChat = db.prepare("SELECT value FROM config WHERE key = 'telegram_chat_id'").get()?.value;
        if (tgToken && tgToken.trim() !== '' && tgChat && tgChat.trim() !== '') {
            telegram.sendTelegramMessage(
                `🌐 <b>Conexión Remota y Carta Digital en Línea</b>\n\n` +
                `🔐 <b>Punto de Venta Remoto (Dueño / Admin):</b>\n` +
                `👉 <code>${url}</code>\n` +
                `<i>(Protegido con tu PIN de Administrador para controlar ventas y caja a distancia)</i>\n\n` +
                `📋 <b>Carta Digital Pública (Clientes & Mesas):</b>\n` +
                `👉 <code>${url}/carta</code>\n` +
                `<i>(Acceso libre sin contraseñas para clientes y escaneo de código QR)</i>`,
                'HTML'
            );
        }
        return { success: true, url };
    } catch (err) {
        const friendlyMsg = formatNgrokErrorMessage(err.message);
        console.error('Error al iniciar Ngrok:', friendlyMsg);
        return { success: false, message: friendlyMsg };
    }
}

// Configuración de multer para subir imágenes en la carpeta aislada datos_negocio
const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, '..');
const dataDir = path.resolve(baseDir, 'datos_negocio');
const uploadsDir = path.join(dataDir, 'imagenes');
const receiptsDir = path.join(dataDir, 'facturas_gastos');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
}

// Obtener fecha actual en huso horario local de Colombia (UTC-5) para reportes y cierres comerciales
function getLocalTodayStr() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function addDaysToDateString(dateStr, days) {
    if (!dateStr) return getLocalTodayStr();
    const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
    const date = new Date(y, m - 1, d + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDaysDiff(dateStr1, dateStr2) {
    if (!dateStr1 || !dateStr2) return 0;
    const [y1, m1, d1] = dateStr1.slice(0, 10).split('-').map(Number);
    const [y2, m2, d2] = dateStr2.slice(0, 10).split('-').map(Number);
    const date1 = new Date(y1, m1 - 1, d1);
    const date2 = new Date(y2, m2 - 1, d2);
    const diffTime = date1.getTime() - date2.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function parseTimeTo24h(timeStr) {
    if (!timeStr) return null;
    const clean = String(timeStr).trim();
    const match = clean.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = match[2].padStart(2, '0');
    if (/pm/i.test(clean) && h < 12) h += 12;
    if (/am/i.test(clean) && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
}

function getLocalCurrentTimeStr() {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date());
}

function formatTime12h(timeStr) {
    if (!timeStr) return '';
    const parts = String(timeStr).split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const mStr = m < 10 ? `0${m}` : m;
    return `${h12}:${mStr} ${period}`;
}

// Auto-migración de imágenes antiguas: si existían en backend/uploads, copiarlas a datos_negocio/imagenes
const oldUploadsDir = path.join(__dirname, 'uploads');
if (fs.existsSync(oldUploadsDir)) {
    try {
        const oldFiles = fs.readdirSync(oldUploadsDir);
        for (const file of oldFiles) {
            const oldPath = path.join(oldUploadsDir, file);
            const newPath = path.join(uploadsDir, file);
            if (!fs.existsSync(newPath) && fs.statSync(oldPath).isFile()) {
                fs.copyFileSync(oldPath, newPath);
            }
        }
    } catch (e) {
        console.error('⚠️ Error al auto-migrar imágenes antiguas:', e);
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
// Storage dedicado para comprobantes/facturas de gastos (nombres seguros para URL)
const receiptStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, receiptsDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname) || '.jpg';
        const dateStr = new Date().toISOString().slice(0,19).replace(/[T:]/g, '-');
        const desc = ((req.body && req.body.description) || 'factura').substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
        const amt = (req.body && req.body.amount) || '0';
        cb(null, 'Factura_' + desc + '_' + dateStr + '_' + amt + ext);
    }
});
const receiptUpload = multer({ storage: receiptStorage, limits: { fileSize: 15 * 1024 * 1024 } });


const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use('/api/uploads', express.static(uploadsDir)); // Servir imágenes estáticas desde datos_negocio/imagenes
app.use('/api/facturas', express.static(receiptsDir)); // Servir facturas y comprobantes desde datos_negocio/facturas_gastos

const PORT = 3005;

// ============================================================
// SISTEMA EN TIEMPO REAL (SERVER-SENT EVENTS - SSE)
// ============================================================
const sseClients = new Set();

function broadcastEvent(eventData) {
    if (!eventData || typeof eventData !== 'object') return;
    const payload = `data: ${JSON.stringify({ ...eventData, timestamp: Date.now() })}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(payload);
        } catch (e) {
            sseClients.delete(client);
        }
    }
}

// Conectar con telegramService para emisión bidireccional en vivo
if (telegram && typeof telegram.setEventBroadcaster === 'function') {
    telegram.setEventBroadcaster(broadcastEvent);
}

// Endpoint del Canal SSE en tiempo real
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Evita buffer en proxies y Ngrok
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    // Mensaje inicial de handshake confirmado
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
        sseClients.delete(res);
    });
});

// Heartbeat cada 25 segundos para mantener vivas las conexiones en Ngrok y Wi-Fi
setInterval(() => {
    for (const client of sseClients) {
        try {
            client.write(':keepalive\n\n');
        } catch (e) {
            sseClients.delete(client);
        }
    }
}, 25000);

// --- ENDPOINTS DE LICENCIAMIENTO (Abiertos, antes del middleware de bloqueo) ---
app.get('/api/licensing/status', async (req, res) => {
    try {
        const status = await licensing.verifyLicenseStatus();
        res.json(status);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/licensing/activate', async (req, res) => {
    const { token } = req.body;
    try {
        if (!token || !token.includes(':')) {
            return res.status(400).json({ error: 'Formato de clave de activación no válido.' });
        }

        const payload = licensing.decryptLicense(token);
        if (!payload) {
            return res.status(400).json({ error: 'La clave de activación es incorrecta o está corrupta.' });
        }

        const systemUUID = await licensing.getSystemUUID();
        if (payload.uuid !== systemUUID) {
            return res.status(400).json({ error: 'Esta clave fue generada para otra computadora.' });
        }

        const isProductValid = payload.product === 'software-global' || payload.product === 'universal-pos' || payload.product === 'tienda-pos' || payload.product === 'moto-parking-casino' || payload.product === 'jv-spa-parking' || payload.product === 'restaurante' || payload.product === 'restaurante-maestro' || payload.product === 'restaurante-rafaml' || payload.product === 'software-ganaderia' || payload.product === 'heladeria' || payload.product === 'pescaderia-lopez' || payload.product === 'suroeste-cafe';
        if (!isProductValid) {
            return res.status(400).json({ error: 'Esta clave no es válida para esta suite.' });
        }

        // Registrar clave en base de datos
        db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('license_key', ?)").run(token);
        
        // Devolver nuevo estado
        const newStatus = await licensing.verifyLicenseStatus();
        res.json({ success: true, status: newStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/system/shutdown', (req, res) => {
    res.json({ success: true, message: 'Cerrando servidor POS de forma segura.' });
    setTimeout(() => {
        process.exit(0);
    }, 3000);
});

// --- MIDDLEWARE DE CONTROL DE MEMBRESÍAS (PAUSA EL SOFTWARE SI EXPIRA) ---
app.use(async (req, res, next) => {
    // Permitir todas las peticiones GET para que el tendero consulte sus reportes,
    // y no bloquear los flujos de licenciamiento o la parada segura del sistema
    if (req.method === 'GET' || req.path.startsWith('/api/licensing') || req.path === '/api/system/shutdown') {
        return next();
    }

    try {
        const status = await licensing.verifyLicenseStatus();
        if (!status.isValid) {
            return res.status(402).json({ 
                error: 'Membresía Suspendidía', 
                reason: status.reason,
                uuid: status.uuid 
            });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: 'Error al verificar membresía contable.' });
    }
});


// --- CONFIG ENDPOINTS ---
app.post('/api/auth/verify-admin-pin', (req, res) => {
    try {
        const { pin } = req.body;
        const row = db.prepare("SELECT value FROM config WHERE key = 'admin_password'").get();
        const correctPin = (row?.value && row.value.trim() !== '') ? row.value.trim() : '1234';
        
        if (pin && String(pin).trim() === correctPin) {
            return res.json({ success: true, valid: true });
        } else {
            return res.status(401).json({ success: false, valid: false, message: 'Contraseña incorrecta.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper de seguridad: Verifica si la solicitud proviene de un Administrador autenticado
function verifyAdmin(req) {
    const headerPwd = req.headers['x-admin-password'];
    const bodyPwd = req.body && req.body.admin_password;
    const pwd = headerPwd || bodyPwd;
    if (!pwd) return false;
    try {
        const row = db.prepare("SELECT value FROM config WHERE key = 'admin_password'").get();
        const storedPwd = row ? row.value : '1234';
        return pwd.toString().trim() === storedPwd.toString().trim();
    } catch (e) {
        return false;
    }
}

// Endpoint de verificación de credenciales de Administrador
app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body;
    try {
        const row = db.prepare("SELECT value FROM config WHERE key = 'admin_password'").get();
        const storedPwd = row ? row.value : '1234';
        if (password && password.toString().trim() === storedPwd.toString().trim()) {
            return res.json({ success: true, message: 'Autenticación exitosa como Administrador.' });
        } else {
            return res.status(401).json({ success: false, error: 'Contraseña de Administrador incorrecta.' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/config', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM config').all();
        const config = {};
        rows.forEach(row => config[row.key] = row.value);

        // Si no se envía credencial válida de Administrador, filtrar datos sensibles
        if (!verifyAdmin(req)) {
            delete config.admin_password;
            delete config.gemini_api_key;
            delete config.telegram_bot_token;
            delete config.telegram_chat_id;
            delete config.ngrok_auth_token;
        }

        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/config', (req, res) => {
    if (!verifyAdmin(req)) {
        return res.status(401).json({ error: 'Acceso no autorizado. Se requiere contraseña de Administrador.' });
    }
    const updates = req.body;
    const updateStmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    
    try {
        let fifoEnabled = false;
        db.exec('BEGIN TRANSACTION');
        for (const [key, value] of Object.entries(updates)) {
            updateStmt.run(key, value.toString());
            if (key === 'enable_fifo' && value.toString() === 'true') fifoEnabled = true;
        }
        
        if (fifoEnabled) {
            const products = db.prepare('SELECT id, stock, cost_price as cost FROM products WHERE stock > 0').all();
            const checkBatch = db.prepare('SELECT count(*) as cnt FROM inventory_batches WHERE product_id = ?');
            const insertBatch = db.prepare('INSERT INTO inventory_batches (product_id, quantity, cost) VALUES (?, ?, ?)');
            
            for (const p of products) {
                if (checkBatch.get(p.id).cnt === 0) {
                    insertBatch.run(p.id, p.stock, p.cost);
                }
            }
        }
        
        db.exec('COMMIT');

        // Si se actualizan credenciales de Telegram, reiniciar el servicio de polling
        if (updates.telegram_bot_token !== undefined || updates.telegram_chat_id !== undefined) {
            try {
                telegram.stopTelegramPolling();
                telegram.startTelegramPolling();
            } catch (e) {}
        }

        // Persistencia para el lanzador maestro (Modo Kiosco vs Vista Previa de Windows)
        if (updates.kiosk_printing !== undefined) {
            try {
                const launcherConfigPath = path.join(__dirname, '..', 'datos_negocio', 'launcher_config.json');
                const isKiosk = updates.kiosk_printing === 'true' || updates.kiosk_printing === true;
                fs.writeFileSync(launcherConfigPath, JSON.stringify({ kiosk_printing: isKiosk }, null, 2), 'utf8');
            } catch (e) {
                console.error('Error guardando launcher_config.json:', e);
            }
        }

        res.json({ success: true });
    } catch (err) {
        db.exec('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Reiniciar ventana del Punto de Venta con los parámetros actualizados de Windows
app.post('/api/system/restart-pos-window', (req, res) => {
    try {
        const launcherConfigPath = path.join(__dirname, '..', 'datos_negocio', 'launcher_config.json');
        let isKiosk = false;
        if (fs.existsSync(launcherConfigPath)) {
            try {
                const cfg = JSON.parse(fs.readFileSync(launcherConfigPath, 'utf8'));
                isKiosk = cfg.kiosk_printing === true;
            } catch (e) {}
        }

        const kioskFlag = isKiosk ? ' --kiosk-printing' : '';
        const psScript = `
            Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*TiendaPOS\\pos_profile*" } | Stop-Process -Force -ErrorAction SilentlyContinue;
            Start-Sleep -Milliseconds 600;
            $c1 = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            $c2 = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
            $c3 = "$env:LocalAppData\\Google\\Chrome\\Application\\chrome.exe";
            $e1 = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
            $e2 = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
            $profile = "$env:LocalAppData\\TiendaPOS\\pos_profile";
            $url = 'http://localhost:3005';
            $browser = if (Test-Path $c1) { $c1 } elseif (Test-Path $c2) { $c2 } elseif (Test-Path $c3) { $c3 } elseif (Test-Path $e1) { $e1 } elseif (Test-Path $e2) { $e2 } else { $null };
            if ($browser) {
                Start-Process -FilePath $browser -ArgumentList "--app=$url --user-data-dir=\`"$profile\`"${kioskFlag}";
            }
        `;
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/\r?\n/g, ' ')}"`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Disparo directo de pulso ESC/POS para abrir cajón monedero (RJ11) sin gastar papel
app.post('/api/system/open-drawer', (req, res) => {
    try {
        const psScriptPath = path.join(__dirname, 'open_drawer.ps1');
        const selectedPrinter = db.prepare("SELECT value FROM config WHERE key = 'printer_name'").get()?.value || '';
        const escapedPrinter = selectedPrinter ? ` -targetPrinter "${selectedPrinter.replace(/"/g, '`"')}"` : '';

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"${escapedPrinter}`, (err, stdout) => {
            if (err) {
                console.warn('Aviso pulso cajón monedero:', err.message);
                return res.json({ success: false, message: err.message });
            }
            const outStr = (stdout || '').trim();
            console.log('Resultado pulso cajón monedero:', outStr);
            res.json({ success: true, detail: outStr });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- NGROK ON-DEMAND ENDPOINT ---
app.post('/api/ngrok/start', async (req, res) => {
    const { forceRestart } = req.body || {};
    const result = await startNgrokTunnel(!!forceRestart);
    if (result && result.success) {
        res.json({ success: true, url: result.url, alreadyActive: !!result.alreadyActive });
    } else {
        const enabled = db.prepare("SELECT value FROM config WHERE key = 'ngrok_enabled'").get()?.value;
        if (enabled !== 'true') {
            res.json({ success: false, message: 'Ngrok está deshabilitado en la configuración.' });
        } else {
            res.status(500).json({ success: false, message: (result && result.message) ? result.message : 'No se pudo iniciar el tunel Ngrok.' });
        }
    }
});

// --- INFORMACION DE RED Y ENLACE DE CARTA DIGITAL ---
app.get('/api/network-info', (req, res) => {
    try {
        const interfaces = os.networkInterfaces();
        let localIp = '127.0.0.1';
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    localIp = iface.address;
                    break;
                }
            }
        }

        const ngrokUrl = (activeNgrokListener && typeof activeNgrokListener.url === 'function')
            ? activeNgrokListener.url()
            : null;

        res.json({
            local_ip: localIp,
            local_port: PORT,
            local_url: `http://${localIp}:${PORT}`,
            ngrok_url: ngrokUrl,
            menu_path: '/carta',
            menu_url: ngrokUrl ? `${ngrokUrl}/carta` : `http://${localIp}:${PORT}/carta`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- GESTION DE IMPRESORAS Y TICKETS DE VENTA ---

function getWindowsPrinters() {
    return new Promise((resolve) => {
        if (process.platform !== 'win32') {
            return resolve([]);
        }
        const cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Printer | Select-Object Name, PortName, DriverName, Default, WorkOffline, PrinterStatus | ConvertTo-Json -Compress"';
        exec(cmd, { timeout: 8000 }, (error, stdout) => {
            if (error || !stdout) {
                return resolve([]);
            }
            try {
                const parsed = JSON.parse(stdout.trim());
                const arr = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
                const result = arr.map(p => {
                    const name = p.Name || '';
                    const port = p.PortName || '';
                    const driver = p.DriverName || '';
                    const isDefault = Boolean(p.Default);

                    const isVirtual = /pdf|onenote|xps|fax|document writer|microsoft print|cuteftp/i.test(name + ' ' + driver + ' ' + port) ||
                                      port.startsWith('PORTPROMPT') || port.startsWith('nul:') || port.startsWith('FILE:');
                    
                    const isOffline = p.WorkOffline === true || p.PrinterStatus === 2 || p.PrinterStatus === 1 || p.PrinterStatus === 7;
                    const isOnline = !isVirtual && !isOffline;

                    let statusText = 'En línea y lista';
                    if (isVirtual) {
                        statusText = 'Impresora Virtual';
                    } else if (isOffline) {
                        statusText = 'Desconectada (Sin cable USB o apagada)';
                    }

                    return {
                        name,
                        port,
                        driver,
                        isDefault,
                        isVirtual,
                        isOnline,
                        statusText
                    };
                });
                resolve(result);
            } catch (e) {
                resolve([]);
            }
        });
    });
}

function setDefaultWindowsPrinter(printerName) {
    return new Promise((resolve, reject) => {
        if (process.platform !== 'win32') {
            return resolve(false);
        }
        const safeName = printerName.replace(/'/g, "''");
        const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "(New-Object -ComObject WScript.Network).SetDefaultPrinter('${safeName}')"`;
        exec(cmd, { timeout: 8000 }, (error) => {
            if (error) return reject(error);
            resolve(true);
        });
    });
}

app.get('/api/printers', async (req, res) => {
    try {
        const printers = await getWindowsPrinters();
        res.json({ success: true, printers });
    } catch (err) {
        res.status(500).json({ error: err.message, printers: [] });
    }
});

app.post('/api/printers/set-default', async (req, res) => {
    if (!verifyAdmin(req)) {
        return res.status(401).json({ error: 'Acceso no autorizado. Se requiere PIN de Administrador.' });
    }
    const { name } = req.body || {};
    if (!name) {
        return res.status(400).json({ error: 'Nombre de impresora requerido.' });
    }
    try {
        await setDefaultWindowsPrinter(name);
        db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('selected_printer', ?)").run(name);
        res.json({ success: true, message: `Impresora "${name}" configurada como predeterminada en Windows.` });
    } catch (err) {
        res.status(500).json({ error: `Error al configurar impresora en Windows: ${err.message}` });
    }
});

// --- CARTA DIGITAL PUBLICA (PROTECCION DE COSTOS Y TIEMPO REAL) ---
app.get('/api/menu', (req, res) => {
    try {
        const menuEnabled = db.prepare("SELECT value FROM config WHERE key = 'enable_digital_menu'").get()?.value !== 'false';
        if (!menuEnabled) {
            return res.status(403).json({ enabled: false, message: 'La carta digital está actualmente deshabilitada.' });
        }

        const hideSoldOut = db.prepare("SELECT value FROM config WHERE key = 'digital_menu_hide_soldout'").get()?.value === 'true';
        let query = 'SELECT id, name, price, category, stock, image_path, location, unit_type, description, business_line FROM products';
        if (hideSoldOut) {
            query += ' WHERE stock > 0';
        }
        query += ' ORDER BY category ASC, sort_order ASC, name ASC';

        const products = db.prepare(query).all();
        const configRows = db.prepare("SELECT key, value FROM config WHERE key IN ('business_name', 'business_logo_url', 'business_phone', 'digital_menu_wifi', 'digital_menu_phone', 'digital_menu_message', 'business_address', 'enable_digital_menu')").all();
        const menuConfig = {};
        for (const row of configRows) {
            menuConfig[row.key] = row.value;
        }

        res.json({
            enabled: true,
            config: menuConfig,
            products
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/telegram/send-pdf', async (req, res) => {
    try {
        const { base64Data, dateString } = req.body;
        if (!base64Data) return res.status(400).json({ error: 'Missing PDF data' });
        
        const filename = `Reporte_Caja_${dateString.replace(/[/\:]/g, '-')}.pdf`;
        const success = await telegram.sendTelegramDocument(base64Data, filename, '📊 Aquí tienes el Reporte Diario en formato PDF.');
        
        if (success) {
            res.json({ success: true, message: 'PDF enviado con éxito.' });
        } else {
            res.status(500).json({ error: 'No se pudo enviar el PDF. Verifica tu Token y Chat ID.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/telegram/send-carta-qr', async (req, res) => {
    try {
        const { qr_data_url, target_url, mode } = req.body;
        if (!qr_data_url) return res.status(400).json({ error: 'No se recibió la imagen del código QR' });
        
        const base64Data = qr_data_url.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        const businessName = db.prepare("SELECT value FROM config WHERE key = 'business_name'").get()?.value || 'Mi Negocio';
        const modeLabel = mode === 'ngrok' ? '🌐 Internet (Acceso Global)' : '📱 Red Wi-Fi Local';
        
        const caption = 
            `📲 <b>CÓDIGO QR - CARTA DIGITAL Y MENÚ</b>\n\n` +
            `🏪 <b>Establecimiento:</b> ${businessName}\n` +
            `📡 <b>Tipo de Conexión:</b> ${modeLabel}\n` +
            `🔗 <b>Enlace directo:</b> <a href="${target_url}">${target_url}</a>\n\n` +
            `💡 <i>Puedes guardar o reenviar esta imagen a WhatsApp, imprimirla en acrílicos para las mesas o compartirla en redes sociales para que tus clientes consulten los productos, precios y disponibilidad en tiempo real.</i>`;

        const success = await telegram.sendTelegramPhotoBuffer(buffer, caption, null, 'qr_carta_digital.png');
        
        if (success) {
            res.json({ success: true, message: 'Código QR y enlace enviados exitosamente a Telegram.' });
        } else {
            res.status(500).json({ error: 'No se pudo enviar la foto a Telegram. Verifica la conexión y configuración de tu bot.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/test-telegram', async (req, res) => {
    try {
        const success = await telegram.sendTelegramMessage("🤖 <b>¡Hola!</b>\nEsta es una prueba de conexión desde tu <i>Punto de Venta</i>.\nSi recibiste este mensaje, tus notificaciones están configuradas correctamente.", "HTML");
        if (success) {
            res.json({ success: true, message: 'Mensaje de prueba enviado con éxito.' });
        } else {
            res.status(500).json({ error: 'No se pudo enviar el mensaje. Verifica tu Token y Chat ID.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/test-gemini', async (req, res) => {
    try {
        let apiKey = req.body && req.body.gemini_api_key ? req.body.gemini_api_key.trim() : null;
        if (!apiKey) {
            const row = db.prepare("SELECT value FROM config WHERE key = 'gemini_api_key'").get();
            apiKey = row && row.value ? row.value.trim() : null;
        }

        if (!apiKey) {
            return res.status(400).json({ error: 'No se ha ingresado ninguna Clave de Activación del Motor de IA.' });
        }

        const https = require('https');
        const postData = JSON.stringify({
            contents: [{ parts: [{ text: "ping" }] }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: `/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 10000
        };

        const apiReq = https.request(options, (apiRes) => {
            let data = '';
            apiRes.on('data', (chunk) => data += chunk);
            apiRes.on('end', () => {
                if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                    res.json({ success: true, message: '¡Conexión exitosa! El Motor de Inteligencia Artificial está activo y operativo.' });
                } else {
                    let errMsg = 'Clave inválida o servicio no disponible.';
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error && parsed.error.message) {
                            errMsg = parsed.error.message;
                        }
                    } catch (e) {}
                    res.status(400).json({ error: errMsg });
                }
            });
        });

        apiReq.on('error', (e) => {
            res.status(500).json({ error: 'Error de conexión con el motor de IA: ' + e.message });
        });

        apiReq.on('timeout', () => {
            apiReq.destroy();
            res.status(504).json({ error: 'Tiempo de espera agotado al verificar el motor de IA.' });
        });

        apiReq.write(postData);
        apiReq.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/factory-reset', (req, res) => {
    const { admin_password } = req.body;
    try {
        const configRow = db.prepare("SELECT value FROM config WHERE key = 'admin_password'").get();
        const storedPwd = configRow ? configRow.value : '1234';
        
        if (admin_password !== storedPwd) {
            return res.status(401).json({ error: 'Contraseña de administrador incorrecta' });
        }

        db.exec('BEGIN TRANSACTION');
        
        // Wipe all transactional and entity tables (Child tables first!)
        db.exec('DELETE FROM sale_items');
        db.exec('DELETE FROM inventory_batches');
        db.exec('DELETE FROM account_items');
        db.exec('DELETE FROM active_accounts');
        db.exec('DELETE FROM expenses');
        db.exec('DELETE FROM reminders');
        db.exec('DELETE FROM sales');
        db.exec('DELETE FROM shifts');
        db.exec('DELETE FROM products');
        db.exec('DELETE FROM customers');
        db.exec('DELETE FROM users');
        
        // Reset sqlite sequences to restart autoincrement from 1
        db.exec("DELETE FROM sqlite_sequence WHERE name IN ('sales', 'sale_items', 'expenses', 'shifts', 'products', 'customers', 'reminders', 'inventory_batches', 'active_accounts', 'account_items', 'users')");
        
        db.exec('COMMIT');
        res.json({ success: true });
    } catch (err) {
        db.exec('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const logoUrl = `http://localhost:${PORT}/api/uploads/${req.file.filename}`;
    try {
        db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('business_logo_url', logoUrl);
        res.json({ success: true, logoUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PRODUCTS ENDPOINTS ---
app.get('/api/products', (req, res) => {
    try {
        const products = db.prepare('SELECT * FROM products ORDER BY sort_order ASC, name ASC').all();
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', (req, res) => {
    if (!verifyAdmin(req)) {
        return res.status(401).json({ error: 'Acceso no autorizado. Se requiere contraseña de Administrador para crear productos.' });
    }
    const { name, price, cost_price, category, barcode, stock, min_stock, sort_order, image_path, location, unit_type, description, business_line } = req.body;
    try {
        const info = db.prepare(`
            INSERT INTO products (name, price, cost_price, category, barcode, stock, min_stock, sort_order, image_path, location, unit_type, description, business_line) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            name, 
            price, 
            cost_price || 0, 
            category || '', 
            barcode || null, 
            parseFloat(stock) || 0, 
            parseFloat(min_stock) || 5, 
            sort_order || 0,
            image_path || null,
            location || null,
            unit_type || 'unit',
            description || null,
            business_line || null
        );
        broadcastEvent({ type: 'PRODUCT_CREATED', data: { id: info.lastInsertRowid, name, price, stock }, message: `Nuevo producto "${name}" agregado al catálogo` });
        res.json({ id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/products/:id', (req, res) => {
    if (!verifyAdmin(req)) {
        return res.status(401).json({ error: 'Acceso no autorizado. Se requiere contraseña de Administrador para editar productos.' });
    }
    const { id } = req.params;
    const { name, price, cost_price, category, barcode, stock, min_stock, sort_order, image_path, location, unit_type, description, business_line } = req.body;
    try {
        db.prepare(`
            UPDATE products 
            SET name = ?, price = ?, cost_price = ?, category = ?, barcode = ?, stock = ?, min_stock = ?, sort_order = ?, image_path = ?, location = ?, unit_type = ?, description = ?, business_line = ?
            WHERE id = ?
        `).run(
            name, 
            price, 
            cost_price || 0, 
            category || '', 
            barcode || null, 
            parseFloat(stock) || 0, 
            parseFloat(min_stock) || 5, 
            sort_order || 0, 
            image_path || null,
            location || null,
            unit_type || 'unit',
            description || null,
            business_line || null,
            id
        );
        broadcastEvent({ type: 'PRODUCT_UPDATED', data: { id, name, price, stock }, message: `Producto "${name}" actualizado` });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/inventory/batches', (req, res) => {
    const { product_id, quantity, cost } = req.body;
    try {
        db.exec('BEGIN TRANSACTION');
        const insertBatch = db.prepare('INSERT INTO inventory_batches (product_id, quantity, cost) VALUES (?, ?, ?)');
        const info = insertBatch.run(product_id, quantity, cost);
        
        // Actualizar el stock total del producto
        const currentProduct = db.prepare('SELECT stock FROM products WHERE id = ?').get(product_id);
        if (currentProduct) {
            const newStock = parseFloat(currentProduct.stock) + parseFloat(quantity);
            db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, product_id);
        }
        
        db.exec('COMMIT');
        res.json({ success: true, batch_id: info.lastInsertRowid });
    } catch (err) {
        db.exec('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products/adjust-stock/:id', (req, res) => {
    const { id } = req.params;
    const { quantity } = req.body;
    try {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(quantity, id);
        const updated = db.prepare('SELECT stock FROM products WHERE id = ?').get(id);
        broadcastEvent({ type: 'PRODUCT_UPDATED', data: { id, stock: updated.stock }, message: 'Stock de producto ajustado' });
        res.json({ success: true, newStock: updated.stock });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', (req, res) => {
    if (!verifyAdmin(req)) {
        return res.status(401).json({ error: 'Acceso no autorizado. Se requiere contraseña de Administrador para eliminar productos.' });
    }
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM products WHERE id = ?').run(id);
        broadcastEvent({ type: 'PRODUCT_DELETED', data: { id }, message: 'Producto eliminado del catálogo' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SHIFTS ENDPOINTS ---
app.get('/api/shifts', (req, res) => {
    try {
        const shifts = db.prepare('SELECT * FROM shifts ORDER BY start_time DESC LIMIT 100').all();
        
        const getCashSales = db.prepare("SELECT SUM(cash_amount) as total FROM sales WHERE shift_id = ? AND status != 'cancelled' AND (parent_sale_id IS NULL AND (customer_name IS NULL OR customer_name NOT LIKE 'Abono:%'))");
        const getDebtPayments = db.prepare("SELECT SUM(cash_amount) as total FROM sales WHERE (payment_shift_id = ? OR (shift_id = ? AND (parent_sale_id IS NOT NULL OR customer_name LIKE 'Abono:%'))) AND status != 'cancelled' AND payment_method = 'Efectivo'");
        const getTransferSales = db.prepare("SELECT SUM(transfer_amount) as total FROM sales WHERE (shift_id = ? OR payment_shift_id = ?) AND status != 'cancelled'");
        const getDebtSales = db.prepare("SELECT SUM(total) as total FROM sales WHERE shift_id = ? AND payment_status = 'pending' AND status != 'cancelled'");
        const getExpenses = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ?");
        const getCashExpenses = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ? AND (payment_method = 'Efectivo' OR payment_method IS NULL)");
        const getTransferExpenses = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ? AND payment_method = 'Transferencia'");
        const getOwnerExpenses = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ? AND payment_method = 'Bolsillo Dueño'");
        const getTotalItems = db.prepare(`
            SELECT COALESCE(SUM(si.quantity), 0) as total_items, COUNT(DISTINCT si.product_id) as total_products
            FROM sale_items si 
            JOIN sales s ON si.sale_id = s.id 
            WHERE s.shift_id = ? AND s.status != 'cancelled'
        `);

        shifts.forEach(s => {
            const directCash = getCashSales.get(s.id)?.total || 0;
            const debtPayments = getDebtPayments.get(s.id, s.id)?.total || 0;
            const transfer = getTransferSales.get(s.id, s.id)?.total || 0;
            const debtSales = getDebtSales.get(s.id)?.total || 0;
            const expenses = getExpenses.get(s.id)?.total || 0;
            const itemStats = getTotalItems.get(s.id);
            
            const cashTotal = directCash + debtPayments;
            s.direct_cash = directCash;
            s.debt_payments = debtPayments;
            s.cash_sales = cashTotal;
            s.transfer_sales = transfer;
            s.debt_sales = debtSales;
            s.expenses = expenses;
            s.cash_expenses = getCashExpenses.get(s.id)?.total || 0;
            s.transfer_expenses = getTransferExpenses.get(s.id)?.total || 0;
            s.owner_expenses = getOwnerExpenses.get(s.id)?.total || 0;
            s.total_collected = cashTotal + transfer; // Dinero real recaudado (Efectivo + Transferencia)
            s.total_turn_sales = directCash + transfer + debtSales; // Total facturado en el turno
            s.total_items_sold = itemStats?.total_items || 0;
            s.distinct_products_sold = itemStats?.total_products || 0;
        });

        res.json(shifts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/shifts/:id/products', (req, res) => {
    try {
        const { id } = req.params;
        const products = db.prepare(`
            SELECT 
                si.product_id,
                si.product_name,
                SUM(si.quantity) as total_quantity,
                SUM(si.price * si.quantity) as total_amount
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.shift_id = ? AND s.status != 'cancelled'
            GROUP BY si.product_id, si.product_name
            ORDER BY total_quantity DESC, total_amount DESC
        `).all(id);
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/shifts/current', (req, res) => {
    try {
        const currentShift = db.prepare('SELECT * FROM shifts WHERE status = ? ORDER BY start_time DESC LIMIT 1').get('open');
        res.json({ currentShift: currentShift || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/shifts/current/stats', (req, res) => {
    try {
        const currentShift = db.prepare('SELECT * FROM shifts WHERE status = ? ORDER BY start_time DESC LIMIT 1').get('open');
        if (!currentShift) return res.status(404).json({ error: 'No active shift' });
        
        const getCashSales = db.prepare("SELECT SUM(cash_amount) as total FROM sales WHERE shift_id = ? AND status != 'cancelled' AND (parent_sale_id IS NULL AND (customer_name IS NULL OR customer_name NOT LIKE 'Abono:%'))");
        const getDebtPayments = db.prepare("SELECT SUM(cash_amount) as total FROM sales WHERE (payment_shift_id = ? OR (shift_id = ? AND (parent_sale_id IS NOT NULL OR customer_name LIKE 'Abono:%'))) AND status != 'cancelled' AND payment_method = 'Efectivo'");
        const getTransferSales = db.prepare("SELECT SUM(transfer_amount) as total FROM sales WHERE (shift_id = ? OR payment_shift_id = ?) AND status != 'cancelled'");
        const getDebtSales = db.prepare("SELECT SUM(total) as total FROM sales WHERE shift_id = ? AND payment_status = 'pending' AND status != 'cancelled'");
        const getExpenses = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ?");
        const getCashExpensesCurrent = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ? AND (payment_method = 'Efectivo' OR payment_method IS NULL)");
        const getTransferExpensesCurrent = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ? AND payment_method = 'Transferencia'");
        const getOwnerExpensesCurrent = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ? AND payment_method = 'Bolsillo Dueño'");

        const directCash = getCashSales.get(currentShift.id)?.total || 0;
        const debtPayments = getDebtPayments.get(currentShift.id, currentShift.id)?.total || 0;
        const transfer = getTransferSales.get(currentShift.id, currentShift.id)?.total || 0;
        const debtSales = getDebtSales.get(currentShift.id)?.total || 0;
        const expenses = getExpenses.get(currentShift.id)?.total || 0;
        const cashExpenses = getCashExpensesCurrent.get(currentShift.id)?.total || 0;
        const transferExpenses = getTransferExpensesCurrent.get(currentShift.id)?.total || 0;
        const ownerExpenses = getOwnerExpensesCurrent.get(currentShift.id)?.total || 0;
        
        const getCashRefunds = db.prepare("SELECT SUM(refund_amount) as total FROM sale_refunds WHERE shift_id = ? AND payment_method = 'Efectivo'");
        const getTransferRefunds = db.prepare("SELECT SUM(refund_amount) as total FROM sale_refunds WHERE shift_id = ? AND payment_method != 'Efectivo'");
        const cashRefunds = getCashRefunds.get(currentShift.id)?.total || 0;
        const transferRefunds = getTransferRefunds.get(currentShift.id)?.total || 0;
        const totalRefunds = cashRefunds + transferRefunds;

        const cashTotal = Math.max(0, directCash + debtPayments - cashRefunds);
        const netTransfer = Math.max(0, transfer - transferRefunds);
        // Solo los gastos en efectivo de caja restan de la gaveta de billetes físicos
        const expectedCash = Math.max(0, currentShift.initial_cash + (directCash + debtPayments) - cashExpenses - cashRefunds);

        const getTransferDetails = db.prepare(`
            SELECT id, created_at, total, transfer_amount, customer_name, payment_method
            FROM sales 
            WHERE (shift_id = ? OR payment_shift_id = ?) 
              AND transfer_amount > 0 
              AND status != 'cancelled'
            ORDER BY id ASC
        `);
        const transferDetails = getTransferDetails.all(currentShift.id, currentShift.id) || [];
        const transferCount = transferDetails.length;

        const cashCount = db.prepare("SELECT COUNT(*) as count FROM sales WHERE shift_id = ? AND cash_amount > 0 AND status != 'cancelled'").get(currentShift.id)?.count || 0;
        const debtCount = db.prepare("SELECT COUNT(*) as count FROM sales WHERE shift_id = ? AND payment_status = 'pending' AND status != 'cancelled'").get(currentShift.id)?.count || 0;
        const currentItemStats = db.prepare(`
            SELECT COALESCE(SUM(si.quantity), 0) as total_items, COUNT(DISTINCT si.product_id) as total_products
            FROM sale_items si 
            JOIN sales s ON si.sale_id = s.id 
            WHERE s.shift_id = ? AND s.status != 'cancelled'
        `).get(currentShift.id);

        res.json({
            initial_cash: currentShift.initial_cash,
            direct_cash: directCash,
            debt_payments: debtPayments,
            cash_sales: cashTotal,
            transfer_sales: netTransfer,
            gross_transfer_sales: transfer,
            transfer_count: transferCount,
            cash_count: cashCount,
            debt_count: debtCount,
            total_items_sold: currentItemStats?.total_items || 0,
            distinct_products_sold: currentItemStats?.total_products || 0,
            transfer_details: transferDetails,
            debt_sales: debtSales,
            expenses: expenses,
            cash_expenses: cashExpenses,
            transfer_expenses: transferExpenses,
            owner_expenses: ownerExpenses,
            cash_refunds: cashRefunds,
            transfer_refunds: transferRefunds,
            total_refunds: totalRefunds,
            total_collected: cashTotal + netTransfer,
            total_turn_sales: directCash + transfer + debtSales,
            expected_cash: expectedCash
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shifts/open', (req, res) => {
    const { user_name, initial_cash } = req.body;
    try {
        const existing = db.prepare('SELECT id FROM shifts WHERE status = ? LIMIT 1').get('open');
        if (existing) {
            return res.status(400).json({ error: 'Ya hay un turno abierto. Ciérrelo antes de abrir otro.' });
        }
        
        const capitalizedName = user_name.trim().charAt(0).toUpperCase() + user_name.trim().slice(1).toLowerCase();
        
        const info = db.prepare('INSERT INTO shifts (user_name, initial_cash, status) VALUES (?, ?, ?)')
            .run(capitalizedName, initial_cash || 0, 'open');
            
        telegram.sendTelegramMessage(`🟢 <b>Apertura de Turno</b>\nEl usuario <b>${capitalizedName}</b> ha abierto la caja con base de $${(initial_cash || 0).toLocaleString('es-CO')}.`, 'HTML', 'telegram_notify_shift_open');
        broadcastEvent({ type: 'SHIFT_OPENED', data: { shiftId: info.lastInsertRowid, user_name: capitalizedName }, message: `Turno abierto por ${capitalizedName}` });
        res.json({ success: true, shiftId: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/shifts/:id/close', (req, res) => {
    const { id } = req.params;
    const { final_cash, notes } = req.body;
    try {
        const shiftRow = db.prepare("SELECT * FROM shifts WHERE id = ?").get(id);
        if (!shiftRow) return res.status(404).json({ error: 'Turno no encontrado' });

        const getCashSales = db.prepare("SELECT SUM(cash_amount) as total FROM sales WHERE shift_id = ? AND status != 'cancelled' AND (parent_sale_id IS NULL AND (customer_name IS NULL OR customer_name NOT LIKE 'Abono:%'))");
        const getDebtPayments = db.prepare("SELECT SUM(cash_amount) as total FROM sales WHERE (payment_shift_id = ? OR (shift_id = ? AND (parent_sale_id IS NOT NULL OR customer_name LIKE 'Abono:%'))) AND status != 'cancelled' AND payment_method = 'Efectivo'");
        const getTransferSales = db.prepare("SELECT SUM(transfer_amount) as total FROM sales WHERE (shift_id = ? OR payment_shift_id = ?) AND status != 'cancelled'");
        const getDebtSales = db.prepare("SELECT SUM(total) as total FROM sales WHERE shift_id = ? AND payment_status = 'pending' AND status != 'cancelled'");
        const getExpenses = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ?");
        const getCashExpensesClose = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ? AND (payment_method = 'Efectivo' OR payment_method IS NULL)");
        const getTransferExpensesClose = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ? AND payment_method = 'Transferencia'");
        const getOwnerExpensesClose = db.prepare("SELECT SUM(amount) as total FROM expenses WHERE shift_id = ? AND payment_method = 'Bolsillo Dueño'");

        const directCash = getCashSales.get(id)?.total || 0;
        const debtPayments = getDebtPayments.get(id, id)?.total || 0;
        const transfer = getTransferSales.get(id, id)?.total || 0;
        const debtSales = getDebtSales.get(id)?.total || 0;
        const expenses = getExpenses.get(id)?.total || 0;
        const cashExpenses = getCashExpensesClose.get(id)?.total || 0;
        const transferExpenses = getTransferExpensesClose.get(id)?.total || 0;
        const ownerExpenses = getOwnerExpensesClose.get(id)?.total || 0;

        const getCashRefunds = db.prepare("SELECT SUM(refund_amount) as total FROM sale_refunds WHERE shift_id = ? AND payment_method = 'Efectivo'");
        const cashRefunds = getCashRefunds.get(id)?.total || 0;

        const cashTotal = Math.max(0, directCash + debtPayments - cashRefunds);
        // Solo los gastos en efectivo de caja restan de la gaveta de billetes físicos
        const expectedCash = Math.max(0, (shiftRow.initial_cash || 0) + (directCash + debtPayments) - cashExpenses - cashRefunds);
        const discrepancy = final_cash - expectedCash;
        const totalCollected = cashTotal + transfer;
        const totalTurnSales = directCash + transfer + debtSales;

        db.prepare('UPDATE shifts SET final_cash = ?, expected_cash = ?, discrepancy = ?, notes = ?, status = ?, end_time = CURRENT_TIMESTAMP WHERE id = ?')
            .run(final_cash, expectedCash, discrepancy, notes || '', 'closed', id);

        // Notificación Ejecutiva de Telegram
        let discStatus = '';
        if (discrepancy === 0) {
            discStatus = '✅ <b>Estado de Caja:</b> CUADRADO EXACTO ($0)';
        } else if (discrepancy < 0) {
            discStatus = `🔴 <b>Descuadre Faltante:</b> -$${Math.abs(discrepancy).toLocaleString('es-CO')}`;
        } else {
            discStatus = `🔵 <b>Descuadre Sobrante:</b> +$${discrepancy.toLocaleString('es-CO')}`;
        }

        const msg = `🔔 <b>REPORTE DE CIERRE DE TURNO #${id}</b>\n` +
                    `👤 <b>Cajero(a):</b> ${shiftRow.user_name}\n` +
                    `🕒 <b>Apertura:</b> ${new Date(shiftRow.start_time + 'Z').toLocaleString('es-CO', { timeZone: 'America/Bogota' })}\n` +
                    `🏁 <b>Cierre:</b> ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}\n\n` +
                    `══════════════════════\n` +
                    `💵 <b>ARQUEO DE CAJA FÍSICA (EFECTIVO)</b>\n` +
                    `• Base Inicial: <b>$${(shiftRow.initial_cash || 0).toLocaleString('es-CO')}</b>\n` +
                    `• Ventas Directas (Efec): <b>+$${directCash.toLocaleString('es-CO')}</b>\n` +
                    `• Abonos Cartera Cobrados: <b>+$${debtPayments.toLocaleString('es-CO')}</b>\n` +
                    `• Gastos Pagados de Caja: <b>-${cashExpenses.toLocaleString('es-CO')}</b>\n` +
(transferExpenses > 0 ? `• Gastos por Transferencia: <b>${transferExpenses.toLocaleString('es-CO')}</b> (No descuenta de gaveta)\n` : '') +
(ownerExpenses > 0 ? `• Gastos Bolsillo Dueño: <b>${ownerExpenses.toLocaleString('es-CO')}</b> (Fondos personales)\n` : '') +
                    (cashRefunds > 0 ? `• Devoluciones de Efectivo: <b>-${cashRefunds.toLocaleString('es-CO')}</b>\n` : '') +
                    `──────────────────────\n` +
                    `🎯 <b>Efectivo Esperado en Cajón:</b> <b>$${expectedCash.toLocaleString('es-CO')}</b>\n` +
                    `📥 <b>Efectivo Declarado por Cajero:</b> <b>$${Number(final_cash).toLocaleString('es-CO')}</b>\n` +
                    `${discStatus}\n\n` +
                    `══════════════════════\n` +
                    `📊 <b>RESUMEN TOTAL DEL TURNO</b>\n` +
                    `• Ventas Efectivo: <b>$${directCash.toLocaleString('es-CO')}</b>\n` +
                    `• Ventas Transferencia: <b>$${transfer.toLocaleString('es-CO')}</b>\n` +
                    `• Créditos Otorgados (Fiados): <b>$${debtSales.toLocaleString('es-CO')}</b>\n` +
                    `• Cartera Recaudada (Abonos): <b>$${debtPayments.toLocaleString('es-CO')}</b>\n` +
                    `──────────────────────\n` +
                    `💰 <b>TOTAL DINERO RECAUDADO:</b> <b>$${totalCollected.toLocaleString('es-CO')}</b>\n` +
                    `🚀 <b>TOTAL FACTURADO EN TURNO:</b> <b>$${totalTurnSales.toLocaleString('es-CO')}</b>` +
                    (notes ? `\n\n📝 <b>Notas:</b> ${notes}` : '');

        telegram.sendTelegramMessage(msg, 'HTML', 'telegram_notify_shift_close');
        broadcastEvent({ type: 'SHIFT_CLOSED', data: { id }, message: `Turno #${id} cerrado con éxito` });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/shifts/:id', (req, res) => {
    const { id } = req.params;
    try {
        const shift = db.prepare('SELECT status FROM shifts WHERE id = ?').get(id);
        if (shift && shift.status === 'open') {
            return res.status(400).json({ error: 'No se puede eliminar un turno que se encuentra actualmente abierto y en operación.' });
        }
        db.prepare('DELETE FROM shifts WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SALES ENDPOINTS ---
app.get('/api/refunds', (req, res) => {
    try {
        const refunds = db.prepare(`
            SELECT sr.*, s.total as original_sale_total, s.created_at as sale_created_at 
            FROM sale_refunds sr 
            JOIN sales s ON sr.sale_id = s.id 
            ORDER BY sr.created_at DESC
        `).all();
        for (const ref of refunds) {
            ref.items = db.prepare('SELECT * FROM sale_refund_items WHERE refund_id = ?').all(ref.id);
        }
        res.json(refunds);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/sales', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = 'SELECT * FROM sales ';
        let params = [];
        
        if (startDate && endDate) {
            query += "WHERE (date(created_at, '-5 hours') BETWEEN ? AND ?) OR (date(paid_at, '-5 hours') BETWEEN ? AND ?) OR (payment_status = 'pending' AND payment_method = 'Fiado' AND status = 'completed') ORDER BY created_at DESC";
            params = [startDate, endDate, startDate, endDate];
        } else {
            query += "ORDER BY created_at DESC LIMIT 300";
        }
        
        const sales = db.prepare(query).all(...params);
        sales.forEach(sale => {
            sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
            if ((sale.refunded_amount || 0) > 0 || sale.status === 'refunded') {
                sale.refunds = db.prepare('SELECT * FROM sale_refunds WHERE sale_id = ? ORDER BY created_at DESC').all(sale.id);
                for (const ref of sale.refunds) {
                    ref.items = db.prepare('SELECT * FROM sale_refund_items WHERE refund_id = ?').all(ref.id);
                }
            } else {
                sale.refunds = [];
            }
        });
        res.json(sales);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- AUTOMATIC BACKUPS ---
function createBackup() {
    try {
        const backupDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }
        const todayStr = getLocalTodayStr();
        const backupPath = path.join(backupDir, `database_backup_${todayStr}.sqlite`);
        
        // Solo respaldar si no existe un respaldo válido del día de hoy
        if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) {
            let liveDbPath = path.join(dataDir, 'database.sqlite');
            if (!fs.existsSync(liveDbPath)) {
                liveDbPath = path.join(__dirname, 'database.sqlite');
            }
            if (fs.existsSync(liveDbPath)) {
                fs.copyFileSync(liveDbPath, backupPath);
                console.log(`[Backup] Respaldo automático creado: ${backupPath}`);
            }
        }
    } catch (err) {
        console.error('[Backup Error] No se pudo crear el respaldo:', err.message);
    }
}
// Ejecutar al iniciar
createBackup();

app.post('/api/sales', (req, res) => {
    const { payment_method, payment_status, customer_name, items, cash_amount, transfer_amount } = req.body;
    
    try {
        let saleId;
        db.exec('BEGIN TRANSACTION');
        
        const checkStockStmt = db.prepare('SELECT stock, name, price, cost_price FROM products WHERE id = ?');
        const fifoEnabled = db.prepare("SELECT value FROM config WHERE key = 'enable_fifo'").get()?.value === 'true';
        const strictInventory = db.prepare("SELECT value FROM config WHERE key = 'strict_inventory'").get()?.value !== 'false';
        const getBatchesStmt = db.prepare('SELECT id, quantity, cost FROM inventory_batches WHERE product_id = ? AND quantity > 0 ORDER BY created_at ASC, id ASC');
        const updateBatchStmt = db.prepare('UPDATE inventory_batches SET quantity = ? WHERE id = ?');
        
        let calculatedTotal = 0;
        let calculatedCostTotal = 0;
        const deductions = [];

        // Validar stock y recalcular totales en el backend (Anti-Fraude y Precisión)
        for (const item of items) {
            if (item.id) {
                const product = checkStockStmt.get(item.id);
                if (product) {
                    if (product.stock < item.quantity && strictInventory) {
                        throw new Error(`Inventario insuficiente para ${product.name}. Stock actual: ${product.stock}`);
                    }
                    calculatedTotal += (item.price * item.quantity);
                    
                    if (fifoEnabled) {
                        let remainingQty = item.quantity;
                        const batches = getBatchesStmt.all(item.id);
                        let itemCostTotal = 0;
                        for (const batch of batches) {
                            if (remainingQty <= 0) break;
                            const qtyToTake = Math.min(batch.quantity, remainingQty);
                            itemCostTotal += (qtyToTake * batch.cost);
                            remainingQty -= qtyToTake;
                            deductions.push({ type: 'batch', id: batch.id, newQty: batch.quantity - qtyToTake });
                        }
                        if (remainingQty > 0) {
                            itemCostTotal += (remainingQty * product.cost_price);
                        }
                        calculatedCostTotal += itemCostTotal;
                        deductions.push({ type: 'stock', id: item.id, qtyToDeduct: item.quantity });
                        item.calculated_cost_price = itemCostTotal / item.quantity;
                    } else {
                        calculatedCostTotal += (product.cost_price * item.quantity);
                        deductions.push({ type: 'stock', id: item.id, qtyToDeduct: item.quantity });
                        item.calculated_cost_price = product.cost_price;
                    }
                } else {
                    throw new Error(`Producto no encontrado en base de datos.`);
                }
            } else {
                 calculatedTotal += (item.price * item.quantity);
                 calculatedCostTotal += ((item.cost_price || 0) * item.quantity);
                 item.calculated_cost_price = item.cost_price || 0;
            }
        }

        // Redondear el total final
        calculatedTotal = Math.round(calculatedTotal);
        calculatedCostTotal = Math.round(calculatedCostTotal);
        
        let saleInfo;
        const createdAt = req.body.created_at ? new Date(req.body.created_at).toISOString().replace('T', ' ').substring(0, 19) : null;
        
        if (createdAt) {
            saleInfo = db.prepare(`
                INSERT INTO sales (total, cost_total, payment_method, payment_status, customer_name, shift_id, created_at, cash_amount, transfer_amount) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                calculatedTotal, 
                calculatedCostTotal, 
                payment_method, 
                payment_status || 'paid', 
                customer_name || null,
                req.body.shift_id || null,
                createdAt,
                cash_amount || null,
                transfer_amount || null
            );
        } else {
            saleInfo = db.prepare(`
                INSERT INTO sales (total, cost_total, payment_method, payment_status, customer_name, shift_id, cash_amount, transfer_amount) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                calculatedTotal, 
                calculatedCostTotal, 
                payment_method, 
                payment_status || 'paid', 
                customer_name || null,
                req.body.shift_id || null,
                cash_amount || null,
                transfer_amount || null
            );
        }
        
        saleId = saleInfo.lastInsertRowid;
        
        if (payment_method === 'Fiado') {
            telegram.sendTelegramMessage(`📝 <b>Nuevo Fiado Registrado</b>\nCliente: <b>${customer_name || 'Desconocido'}</b>\nTotal deuda: <b>$${calculatedTotal.toLocaleString('es-CO')}</b>`, 'HTML', 'telegram_notify_new_debt');
        }
        const itemStmt = db.prepare(`
            INSERT INTO sale_items (sale_id, product_id, product_name, price, cost_price, quantity, original_price, business_line) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const decrementStockStmt = strictInventory
            ? db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?')
            : db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
        
        for (const item of items) {
            const blRow = db.prepare('SELECT business_line FROM products WHERE id = ?').get(item.id);
            item.business_line = blRow?.business_line || null;

            itemStmt.run(saleId, item.id || null, item.name, item.price, item.calculated_cost_price, item.quantity, item.original_price || null, item.business_line || null);
        }
        
        for (const ded of deductions) {
            if (ded.type === 'stock') {
                decrementStockStmt.run(ded.qtyToDeduct, ded.id);
            } else if (ded.type === 'batch') {
                updateBatchStmt.run(ded.newQty, ded.id);
            }
        }

        // Notificaciones de Stock Bajo (Únicamente si el inventario estricto está habilitado en Ajustes)
        if (strictInventory) {
            for (const item of items) {
                if (item.id) {
                    const pInfo = db.prepare('SELECT stock, min_stock, name FROM products WHERE id = ?').get(item.id);
                    if (pInfo && pInfo.stock <= (pInfo.min_stock || 5)) {
                        const stockDesc = pInfo.stock <= 0 ? 'está <b>AGOTADO (0 unidades)</b>' : `tiene solo <b>${pInfo.stock} unidades restantes</b>`;
                        telegram.sendTelegramMessage(`⚠️ <b>Alerta de Stock Bajo</b>\nEl producto <b>${pInfo.name}</b> ${stockDesc}.`, 'HTML', 'telegram_notify_low_stock');
                    }
                }
            }
        }
        
        db.exec('COMMIT');
        res.json({ success: true, saleId });
    } catch (err) {
        db.exec('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

function parseSafeAmount(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return Math.round(val);
    const cleaned = String(val).replace(/[^\d]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
}

app.post('/api/sales/:id/pay', (req, res) => {
    const { id } = req.params;
    const { payment_method, shift_id, partial_amount, cash_amount, transfer_amount } = req.body;
    
    try {
        db.exec('BEGIN TRANSACTION');
        const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND payment_status = ?').get(id, 'pending');
        if (!sale) throw new Error("Deuda no encontrada o ya pagada");

        const saleTotal = Math.round(Number(sale.total) || 0);
        let payAmount = (partial_amount !== undefined && partial_amount !== null && partial_amount !== '')
            ? parseSafeAmount(partial_amount)
            : saleTotal;

        if (isNaN(payAmount) || payAmount <= 0 || payAmount > saleTotal) {
            payAmount = saleTotal;
        }
        payAmount = Math.round(payAmount);
        
        // Resolver turno activo si no se especificó
        let targetShiftId = shift_id;
        if (!targetShiftId) {
            const currentShift = db.prepare("SELECT id FROM shifts WHERE status = 'open' ORDER BY start_time DESC LIMIT 1").get();
            if (currentShift) targetShiftId = currentShift.id;
        }

        // Calcular montos exactos de efectivo y transferencia si no se enviaron explícitamente
        const finalCash = (cash_amount !== undefined && cash_amount !== null && cash_amount !== '')
            ? parseSafeAmount(cash_amount)
            : (payment_method === 'Efectivo' ? payAmount : null);
            
        const finalTransfer = (transfer_amount !== undefined && transfer_amount !== null && transfer_amount !== '')
            ? parseSafeAmount(transfer_amount)
            : (payment_method === 'Transferencia' ? payAmount : null);
        
        if (payAmount < saleTotal) {
            // Abono parcial: registrar venta hija completada con el abono
            db.prepare(`
                INSERT INTO sales (total, cost_total, payment_method, payment_status, status, customer_name, shift_id, cash_amount, transfer_amount, paid_at, parent_sale_id) 
                VALUES (?, 0, ?, 'paid', 'completed', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            `).run(payAmount, payment_method, `Abono: ${sale.customer_name}`, targetShiftId || null, finalCash, finalTransfer, id);
            
            // Reducir saldo restante de la deuda
            const remaining = Math.round(saleTotal - payAmount);
            db.prepare('UPDATE sales SET total = ? WHERE id = ?').run(remaining, id);

            telegram.sendTelegramMessage(
                `💵 <b>Abono a Deuda Recibido</b>\n` +
                `👤 <b>Cliente:</b> ${sale.customer_name || 'Desconocido'}\n` +
                `💰 <b>Monto Abonado:</b> $${payAmount.toLocaleString('es-CO')} (${payment_method})\n` +
                `📉 <b>Saldo Restante Pendiente:</b> $${remaining.toLocaleString('es-CO')}`,
                'HTML',
                'telegram_notify_debt_payment'
            );
        } else {
            // Liquidación total
            db.prepare(`
                UPDATE sales 
                SET payment_status = 'paid', payment_method = ?, payment_shift_id = ?, cash_amount = ?, transfer_amount = ?, paid_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(payment_method, targetShiftId || null, finalCash, finalTransfer, id);

            telegram.sendTelegramMessage(
                `✅ <b>Deuda Liquidada / Pagada</b>\n` +
                `👤 <b>Cliente:</b> ${sale.customer_name || 'Desconocido'}\n` +
                `💰 <b>Monto Pagado:</b> $${payAmount.toLocaleString('es-CO')} (${payment_method})\n` +
                `🎉 <b>Estado:</b> Cuenta saldada al 100%`,
                'HTML',
                'telegram_notify_debt_payment'
            );
        }
        db.exec('COMMIT');
        res.json({ success: true, shift_id: targetShiftId });
    } catch (err) {
        db.exec('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// Revertir pago de crédito (Devolver a PENDIENTE o eliminar abono parcial)
app.post('/api/sales/:id/revert-payment', (req, res) => {
    const { id } = req.params;
    try {
        db.exec('BEGIN TRANSACTION');
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
        if (!sale) throw new Error("Registro de cobro no encontrado.");

        if (sale.payment_status !== 'paid') {
            throw new Error("Esta venta no está marcada como pagada.");
        }

        // Caso 1: Es un abono parcial (tiene parent_sale_id o customer_name 'Abono: ...')
        if (sale.parent_sale_id || (sale.customer_name && sale.customer_name.startsWith('Abono:'))) {
            let parentId = sale.parent_sale_id;
            if (!parentId) {
                const customerClean = sale.customer_name.replace('Abono: ', '').trim();
                const parent = db.prepare("SELECT id FROM sales WHERE customer_name = ? AND payment_status = 'pending' ORDER BY id DESC LIMIT 1").get(customerClean);
                if (parent) parentId = parent.id;
            }

            if (parentId) {
                // Reintegrar el dinero abonado al total de la deuda original
                db.prepare('UPDATE sales SET total = ROUND(total + ?) WHERE id = ?').run(Math.round(sale.total), parentId);
            }
            // Eliminar el registro del abono
            db.prepare('DELETE FROM sales WHERE id = ?').run(id);
            db.exec('COMMIT');
            return res.json({ success: true, message: 'Abono parcial revertido. El saldo fue reintegrado a la cuenta pendiente.' });
        }

        // Caso 2: Es una liquidación total de crédito
        db.prepare(`
            UPDATE sales 
            SET payment_status = 'pending', 
                payment_method = 'Fiado', 
                payment_shift_id = NULL,
                paid_at = NULL,
                cash_amount = NULL,
                transfer_amount = NULL
            WHERE id = ?
        `).run(id);

        db.exec('COMMIT');
        res.json({ success: true, message: 'Cobro revertido exitosamente. La cuenta vuelve a estar PENDIENTE en la cartera de créditos.' });
    } catch (err) {
        db.exec('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/sales/:id', (req, res) => {
    const { id } = req.params;
    const { customer_name, total } = req.body;
    try {
        const safeTotal = parseSafeAmount(total);
        db.prepare('UPDATE sales SET customer_name = ?, total = ? WHERE id = ? AND payment_status = ?').run(customer_name, safeTotal, id, 'pending');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Corrección de Medio de Pago y Datos de Venta (Exclusivo Administrador)
app.put('/api/sales/:id/correction', (req, res) => {
    if (!verifyAdmin(req)) {
        return res.status(403).json({ error: 'Acceso no autorizado. Se requieren credenciales de Administrador.' });
    }
    const { id } = req.params;
    const { 
        payment_method, 
        mixed_cash, 
        mixed_transfer, 
        customer_name, 
        notes, 
        admin_name 
    } = req.body;

    if (!payment_method) {
        return res.status(400).json({ error: 'Debe especificar el método de pago.' });
    }

    try {
        db.exec('BEGIN TRANSACTION');
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
        if (!sale) {
            db.exec('ROLLBACK');
            return res.status(404).json({ error: 'Venta no encontrada.' });
        }
        if (sale.status === 'cancelled') {
            db.exec('ROLLBACK');
            return res.status(400).json({ error: 'No se puede modificar una venta anulada.' });
        }

        const oldPaymentMethod = sale.payment_method;
        const oldCustomer = sale.customer_name || 'Sin especificar';
        const saleTotal = Number(sale.total) || 0;

        let finalCash = 0;
        let finalTransfer = 0;
        let finalPaymentStatus = 'paid';
        let finalCustomerName = customer_name !== undefined ? (customer_name?.trim() || null) : sale.customer_name;

        if (payment_method === 'Efectivo') {
            finalCash = saleTotal;
            finalTransfer = 0;
            finalPaymentStatus = 'paid';
        } else if (payment_method === 'Transferencia') {
            finalCash = 0;
            finalTransfer = saleTotal;
            finalPaymentStatus = 'paid';
        } else if (payment_method === 'Mixto') {
            const mCash = Number(mixed_cash) || 0;
            const mTrans = Number(mixed_transfer) || 0;
            if (Math.round(mCash + mTrans) !== Math.round(saleTotal)) {
                db.exec('ROLLBACK');
                return res.status(400).json({ 
                    error: `La suma de Efectivo ($${mCash.toLocaleString('es-CO')}) y Transferencia ($${mTrans.toLocaleString('es-CO')}) debe ser exactamente igual a $${saleTotal.toLocaleString('es-CO')}.` 
                });
            }
            finalCash = mCash;
            finalTransfer = mTrans;
            finalPaymentStatus = 'paid';
        } else if (payment_method === 'Fiado') {
            if (!finalCustomerName) {
                db.exec('ROLLBACK');
                return res.status(400).json({ error: 'Debe ingresar el nombre del cliente/deudor para registrar la venta como Fiado.' });
            }
            finalCash = 0;
            finalTransfer = 0;
            finalPaymentStatus = 'pending';
        } else {
            db.exec('ROLLBACK');
            return res.status(400).json({ error: 'Método de pago no válido.' });
        }

        // Formatear nota de auditoría
        const timestamp = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const auditTag = `[Corrección Admin ${timestamp} por ${admin_name || 'Admin'}]: Método cambiado de ${oldPaymentMethod} a ${payment_method}${notes ? ` (Motivo: ${notes})` : ''}`;
        const updatedNotes = sale.notes ? `${sale.notes}\n${auditTag}` : auditTag;

        db.prepare(`
            UPDATE sales SET
                payment_method = ?,
                payment_status = ?,
                cash_amount = ?,
                transfer_amount = ?,
                customer_name = ?,
                notes = ?
            WHERE id = ?
        `).run(payment_method, finalPaymentStatus, finalCash, finalTransfer, finalCustomerName, updatedNotes, id);

        db.exec('COMMIT');

        const updatedSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);

        // Notificación por Telegram para el Administrador
        try {
            if (telegram && typeof telegram.sendTelegramMessage === 'function') {
                const tgMsg = `✏️ <b>Corrección de Venta #TKT-${id}</b>\n` +
                              `<b>Total:</b> $${saleTotal.toLocaleString('es-CO')}\n` +
                              `<b>Método anterior:</b> ${oldPaymentMethod}\n` +
                              `<b>Nuevo método:</b> <b>${payment_method}</b>${payment_method === 'Mixto' ? ` (💵 $${finalCash.toLocaleString('es-CO')} + 📱 $${finalTransfer.toLocaleString('es-CO')})` : ''}\n` +
                              (finalCustomerName ? `<b>Cliente/Ref:</b> ${finalCustomerName}\n` : '') +
                              (notes ? `<b>Motivo:</b> <i>${notes}</i>\n` : '') +
                              `<b>Autorizado por:</b> ${admin_name || 'Administrador'}`;
                telegram.sendTelegramMessage(tgMsg, 'HTML');
            }
        } catch (tgErr) {
            console.error('Error enviando notificación telegram de corrección:', tgErr);
        }

        res.json({ success: true, message: 'Venta actualizada correctamente.', sale: updatedSale });
    } catch (err) {
        try { db.exec('ROLLBACK'); } catch(e){}
        console.error('Error en corrección de venta:', err);
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/sales/:id/date', (req, res) => {
    const { id } = req.params;
    const { created_at } = req.body;
    try {
        if (!created_at) throw new Error("Fecha no proporcionada.");
        const formattedDate = new Date(created_at).toISOString().replace('T', ' ').substring(0, 19);
        db.prepare('UPDATE sales SET created_at = ?, shift_id = NULL WHERE id = ?').run(formattedDate, id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sales/:id/cancel', (req, res) => {
    const { id } = req.params;
    
    try {
        db.exec('BEGIN TRANSACTION');
        
        const sale = db.prepare('SELECT status FROM sales WHERE id = ?').get(id);
        if (!sale) {
            throw new Error('Venta no encontrada.');
        }
        if (sale.status === 'cancelled') {
            throw new Error('La venta ya se encuentra anulada.');
        }

        const items = db.prepare('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?').all(id);
        const incrementStockStmt = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
        for (const item of items) {
            if (item.product_id) {
                incrementStockStmt.run(item.quantity, item.product_id);
            }
        }
        
        db.prepare("UPDATE sales SET status = 'cancelled' WHERE id = ?").run(id);
        
        telegram.sendTelegramMessage(`🚨 <b>Alerta Crítica: Venta Anulada</b>\nSe ha anulado la venta #${id}.\nLos productos han sido devueltos al inventario.`, 'HTML', 'telegram_notify_sale_cancel');
        
        db.exec('COMMIT');
        res.json({ success: true });
    } catch (err) {
        db.exec('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// --- REFUND / DEVOLUCIÓN INTELIGENTE ---
app.post('/api/sales/:id/refund', async (req, res) => {
    const { id } = req.params;
    const { 
        itemsToRefund,   // [{ sale_item_id, product_id, product_name, quantity, unit_price }]
        isFullRefund,
        returnToStock,
        reason,
        paymentMethod,
        userName
    } = req.body || {};

    if (!itemsToRefund || itemsToRefund.length === 0) {
        return res.status(400).json({ error: 'Debe indicar al menos un artículo a devolver.' });
    }

    try {
        db.exec('BEGIN TRANSACTION');

        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
        if (!sale) throw new Error('Venta no encontrada.');
        if (sale.status === 'cancelled') throw new Error('Esta venta ya fue anulada y no puede procesarse una devolución.');

        const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);

        // Validate refund quantities don't exceed remaining
        for (const ri of itemsToRefund) {
            const original = saleItems.find(si => si.id === ri.sale_item_id);
            if (!original) throw new Error(`Artículo no encontrado en la venta: ${ri.product_name}`);
            const alreadyRefunded = original.refunded_quantity || 0;
            const available = original.quantity - alreadyRefunded;
            if (ri.quantity > available) {
                throw new Error(`Cantidad a devolver (${ri.quantity}) supera la cantidad disponible (${available}) para "${ri.product_name}".`);
            }
        }

        // Calculate refund total
        const refundAmount = itemsToRefund.reduce((sum, ri) => sum + (ri.unit_price * ri.quantity), 0);

        // Update refunded_quantity on sale_items
        const updateRefQty = db.prepare('UPDATE sale_items SET refunded_quantity = refunded_quantity + ? WHERE id = ?');
        for (const ri of itemsToRefund) {
            updateRefQty.run(ri.quantity, ri.sale_item_id);
        }

        // Restock inventory if requested
        if (returnToStock) {
            const restockStmt = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
            for (const ri of itemsToRefund) {
                if (ri.product_id) {
                    restockStmt.run(ri.quantity, ri.product_id);
                }
            }
        }

        // Update sale refunded_amount and status
        const newRefundedTotal = (sale.refunded_amount || 0) + refundAmount;
        const isNowFullyRefunded = newRefundedTotal >= sale.total;
        db.prepare('UPDATE sales SET refunded_amount = ?, status = ? WHERE id = ?')
            .run(newRefundedTotal, isNowFullyRefunded ? 'refunded' : sale.status, id);

        // Get active shift for audit
        const activeShift = db.prepare("SELECT id FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();

        // Record in sale_refunds
        const refundRecord = db.prepare(
            'INSERT INTO sale_refunds (sale_id, refund_amount, refund_type, payment_method, reason, returned_to_stock, user_name, shift_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, refundAmount, isFullRefund ? 'total' : 'partial', paymentMethod || sale.payment_method, reason || 'Sin motivo especificado', returnToStock ? 1 : 0, userName || 'Cajero', activeShift?.id || null);

        const refundId = refundRecord.lastInsertRowid;

        // Record refund items
        const refundItemStmt = db.prepare(
            'INSERT INTO sale_refund_items (refund_id, sale_item_id, product_id, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        for (const ri of itemsToRefund) {
            refundItemStmt.run(refundId, ri.sale_item_id, ri.product_id || null, ri.product_name, ri.quantity, ri.unit_price, ri.unit_price * ri.quantity);
        }

        db.exec('COMMIT');

        // Build detailed Telegram notification
        const itemsList = itemsToRefund.map(ri => 
            `  • <b>${ri.quantity}x ${ri.product_name}</b> — $${(ri.unit_price * ri.quantity).toLocaleString('es-CO')}`
        ).join('\n');

        const telegramMsg = 
            `↩️ <b>DEVOLUCIÓN REGISTRADA EN CAJA</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `🧾 <b>Ticket Afectado:</b> #TKT-${id}\n` +
            `🆔 <b>Comprobante Dev.:</b> #DEV-${refundId}\n` +
            `📋 <b>Tipo:</b> ${isFullRefund ? 'Devolución Total ✅' : 'Devolución Parcial 🔀'}\n` +
            `👤 <b>Cajero:</b> ${userName || 'No especificado'}\n` +
            `🔄 <b>Motivo:</b> ${reason || 'Sin motivo especificado'}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `📦 <b>Artículos Devueltos:</b>\n${itemsList}\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `💵 <b>Dinero Reembolsado:</b> <b>$${refundAmount.toLocaleString('es-CO')}</b>\n` +
            `💳 <b>Método Reembolso:</b> ${paymentMethod || sale.payment_method}\n` +
            `📦 <b>Productos al Inventario:</b> ${returnToStock ? '✅ Sí, reingresaron al stock' : '❌ No (producto dañado/vencido)'}\n` +
            `⏰ <b>Fecha/Hora:</b> ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`;

        telegram.sendTelegramMessage(telegramMsg, 'HTML');

        res.json({ success: true, refundId, refundAmount, newRefundedTotal, isNowFullyRefunded });
    } catch (err) {
        try { db.exec('ROLLBACK'); } catch(e) {}
        res.status(500).json({ error: err.message });
    }
});

// GET refunds for a sale
app.get('/api/sales/:id/refunds', (req, res) => {
    try {
        const { id } = req.params;
        const refunds = db.prepare('SELECT * FROM sale_refunds WHERE sale_id = ? ORDER BY created_at DESC').all(id);
        for (const r of refunds) {
            r.items = db.prepare('SELECT * FROM sale_refund_items WHERE refund_id = ?').all(r.id);
        }
        res.json(refunds);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/sales/:id', (req, res) => {
    if (!verifyAdmin(req)) {
        return res.status(401).json({ error: 'Acceso no autorizado. Se requiere contraseña de Administrador para eliminar ventas del historial.' });
    }
    const { id } = req.params;
    try {
        const sale = db.prepare('SELECT total FROM sales WHERE id = ?').get(id);
        const items = db.prepare('SELECT product_name, quantity, price FROM sale_items WHERE sale_id = ?').all(id);
        
        let itemsText = '';
        if (items && items.length > 0) {
            itemsText = '\n<b>Productos:</b>\n' + items.map(i => `- ${i.quantity}x ${i.product_name}`).join('\n');
        }
        let totalText = sale ? sale.total : 0;

        db.exec('BEGIN TRANSACTION');
        db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
        db.prepare('DELETE FROM sales WHERE id = ?').run(id);
        
        telegram.sendTelegramMessage(`🗑️ <b>Registro de Venta Eliminado</b>\nSe ha borrado definitivamente la venta #${id} del sistema.\n<b>Valor Total:</b> ${parseFloat(totalText).toLocaleString()}${itemsText}\n\n<i>Nota: Esto no retorna el stock al inventario.</i>`, 'HTML', 'telegram_notify_sale_delete');
        db.exec('COMMIT');
        res.json({ success: true });
    } catch (err) {
        db.exec('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

// --- CLIENT ACCOUNTS (FIADOS EN PROCESO) ENDPOINTS ---
app.get('/api/accounts', (req, res) => {
    try {
        const accounts = db.prepare('SELECT * FROM active_accounts ORDER BY customer_name ASC').all();
        accounts.forEach(acc => {
            acc.items = db.prepare('SELECT * FROM account_items WHERE account_id = ?').all(acc.id);
        });
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/accounts', (req, res) => {
    const { customer_name } = req.body;
    try {
        const info = db.prepare('INSERT INTO active_accounts (customer_name) VALUES (?)').run(customer_name);
        const newAcc = db.prepare('SELECT * FROM active_accounts WHERE id = ?').get(info.lastInsertRowid);
        res.json({ ...(newAcc || { id: info.lastInsertRowid, customer_name, created_at: new Date().toISOString() }), items: [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/accounts/:id/items', (req, res) => {
    const { id } = req.params;
    const { items } = req.body;

    try {
        db.exec('BEGIN TRANSACTION');
        db.prepare('DELETE FROM account_items WHERE account_id = ?').run(id);
        const stmt = db.prepare(`
            INSERT INTO account_items (account_id, product_id, product_name, price, cost_price, quantity, original_price, added_at, round_num, is_confirmed) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
            stmt.run(id, item.product_id || item.id || null, item.name || item.product_name, item.price, item.cost_price || 0, item.quantity, item.original_price || null, item.added_at || null, item.round_num || 1, item.is_confirmed !== undefined ? (item.is_confirmed ? 1 : 0) : 1);
        }
        db.exec('COMMIT');
        res.json({ success: true });
    } catch (err) {
        db.exec('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/accounts/:id', (req, res) => {
    const { id } = req.params;
    try {
        db.exec('BEGIN TRANSACTION');
        db.prepare('DELETE FROM account_items WHERE account_id = ?').run(id);
        db.prepare('DELETE FROM active_accounts WHERE id = ?').run(id);
        db.exec('COMMIT');
        res.json({ success: true });
    } catch (err) {
        db.exec('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/accounts/:id', (req, res) => {
    const { id } = req.params;
    const { customer_name } = req.body;
    try {
        db.prepare('UPDATE active_accounts SET customer_name = ? WHERE id = ?').run(customer_name, id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- IMAGE UPLOAD ENDPOINT ---
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se envió ninguna imagen.' });
    }
    // Devolvemos la ruta relativa para guardarla en la BD
    res.json({ image_path: '/api/uploads/' + req.file.filename });
});


// --- EXPENSES ENDPOINTS ---
app.get('/api/expenses', (req, res) => {
    try {
        const todayStr = getLocalTodayStr();
        const startDate = req.query.startDate || todayStr;
        const endDate = req.query.endDate || todayStr;
        
        const expenses = db.prepare("SELECT * FROM expenses WHERE date(created_at, '-5 hours') BETWEEN ? AND ? ORDER BY created_at DESC").all(startDate, endDate);
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload de comprobante/factura de gasto con nombre seguro para URL
app.post('/api/expenses/upload-receipt', receiptUpload.single('receipt'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se envio ningun archivo.' });
    }
    const imageUrl = '/api/facturas/' + req.file.filename;
    res.json({ success: true, image_url: imageUrl, filename: req.file.filename });
});

app.post('/api/expenses', (req, res) => {
    const { description, amount, shift_id, receipt_image, payment_method } = req.body;
    const method = payment_method || 'Efectivo';
    try {
        const info = db.prepare('INSERT INTO expenses (description, amount, shift_id, receipt_image, payment_method) VALUES (?, ?, ?, ?, ?)').run(description, amount, shift_id || null, receipt_image || null, method);
        const receiptNotice = receipt_image ? '\n🧾 Comprobante: <b>Adjunto</b>' : '';
        
        let methodEmoji = '💵 Efectivo de Caja';
        if (method === 'Transferencia') methodEmoji = '📱 Transferencia Bancaria';
        else if (method === 'Bolsillo Dueño') methodEmoji = '👤 Bolsillo del Dueño (Fondos Propios)';
        
        telegram.sendTelegramMessage(
            `💸 <b>Gasto Registrado</b>\n` +
            `📝 Descripción: <b>${description}</b>\n` +
            `💰 Monto: <b>${parseFloat(amount).toLocaleString('es-CO')}</b>\n` +
            `💳 Origen de Fondos: <b>${methodEmoji}</b>${receiptNotice}`,
            'HTML',
            'telegram_notify_expense'
        );
        broadcastEvent({ 
            type: 'EXPENSE_CREATED', 
            data: { id: info.lastInsertRowid, description, amount, shift_id, receipt_image, payment_method: method }, 
            message: `Nuevo gasto de ${parseFloat(amount).toLocaleString('es-CO')} (${description} - ${methodEmoji}) registrado` 
        });
        res.json({ id: info.lastInsertRowid, success: true, payment_method: method });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/expenses/:id', (req, res) => {
    if (!verifyAdmin(req)) {
        return res.status(401).json({ error: 'Acceso no autorizado. Se requiere contraseña de Administrador para eliminar gastos.' });
    }
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
        broadcastEvent({ type: 'EXPENSE_DELETED', data: { id }, message: 'Un gasto ha sido eliminado' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- REPORTS ENDPOINTS (CON RANGOS DE FECHAS DINÁMICOS) ---

app.get('/api/reports/product/:id', (req, res) => {
    try {
        const productId = req.params.id;
        // Total stats
        const stats = db.prepare(`
            SELECT 
                SUM(si.quantity) as total_units,
                SUM(si.price * si.quantity) as total_revenue,
                SUM((si.price - si.cost_price) * si.quantity) as total_profit
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE si.product_id = ? AND s.status = 'completed'
        `).get(productId);

        // Trend last 7 days (en hora local Colombia)
        const trend = db.prepare(`
            SELECT date(s.created_at, '-5 hours') as date, SUM(si.quantity) as units
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE si.product_id = ? AND s.status = 'completed' AND date(s.created_at, '-5 hours') >= date('now', '-5 hours', '-7 days')
            GROUP BY date(s.created_at, '-5 hours')
            ORDER BY date(s.created_at, '-5 hours') ASC
        `).all(productId);

        res.json({ success: true, stats, trend });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/advanced', (req, res) => {
    try {
        const todayStr = getLocalTodayStr();
        const startDate = req.query.startDate || todayStr;
        const endDate = req.query.endDate || todayStr;

        const dailySales = db.prepare(`
            SELECT date(created_at, '-5 hours') as date, SUM(total) as income
            FROM sales
            WHERE status = 'completed' AND date(created_at, '-5 hours') BETWEEN ? AND ?
            GROUP BY date(created_at, '-5 hours')
            ORDER BY date(created_at, '-5 hours') ASC
        `).all(startDate, endDate);

        const dailyExpenses = db.prepare(`
            SELECT date(created_at, '-5 hours') as date, SUM(amount) as expenses
            FROM expenses
            WHERE date(created_at, '-5 hours') BETWEEN ? AND ?
            GROUP BY date(created_at, '-5 hours')
            ORDER BY date(created_at, '-5 hours') ASC
        `).all(startDate, endDate);

        const dateMap = {};
        dailySales.forEach(s => {
            dateMap[s.date] = { date: s.date, income: s.income || 0, expenses: 0 };
        });
        dailyExpenses.forEach(e => {
            if (!dateMap[e.date]) {
                dateMap[e.date] = { date: e.date, income: 0, expenses: 0 };
            }
            dateMap[e.date].expenses = e.expenses || 0;
        });
        const daily_evolution = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

        const top_products = db.prepare(`
            SELECT product_name as name, SUM(quantity) as quantity, SUM(price * quantity) as total_sold
            FROM sale_items
            JOIN sales ON sale_items.sale_id = sales.id
            WHERE sales.status = 'completed' AND date(sales.created_at, '-5 hours') BETWEEN ? AND ?
            GROUP BY product_name
            ORDER BY total_sold DESC
            LIMIT 5
        `).all(startDate, endDate);

        
        const categories = db.prepare(`
            SELECT p.category as name, SUM(si.quantity) as quantity, SUM(si.price * si.quantity) as total_sold
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON si.product_id = p.id
            WHERE s.status = 'completed' AND date(s.created_at, '-5 hours') BETWEEN ? AND ?
            GROUP BY p.category
            ORDER BY total_sold DESC
        `).all(startDate, endDate);

        // Agrupar 'Otros' para donut
        const all_products = db.prepare(`
            SELECT product_name as name, SUM(price * quantity) as total_sold
            FROM sale_items
            JOIN sales ON sale_items.sale_id = sales.id
            WHERE sales.status = 'completed' AND date(sales.created_at, '-5 hours') BETWEEN ? AND ?
            GROUP BY product_name
            ORDER BY total_sold DESC
        `).all(startDate, endDate);
        
        let donut_products = [];
        let others_total = 0;
        all_products.forEach((p, index) => {
            if (index < 7) {
                donut_products.push({ name: p.name, value: p.total_sold });
            } else {
                others_total += p.total_sold;
            }
        });
        if (others_total > 0) {
            donut_products.push({ name: 'Otros', value: others_total });
        }

        const payment_methods = db.prepare(`
            SELECT 
                SUM(cash_amount) as Efectivo, 
                SUM(transfer_amount) as Transferencia,
                SUM(CASE WHEN payment_status = 'pending' THEN total ELSE 0 END) as Fiado
            FROM sales 
            WHERE status = 'completed' AND date(created_at, '-5 hours') BETWEEN ? AND ?
        `).get(startDate, endDate);
        
        const distribution = [
            { name: 'Efectivo', value: payment_methods.Efectivo || 0 },
            { name: 'Transferencia', value: payment_methods.Transferencia || 0 },
            { name: 'Fiado', value: payment_methods.Fiado || 0 }
        ].filter(d => d.value > 0);

        const business_lines_raw = db.prepare(`
            SELECT p.business_line, p.name, SUM(si.quantity) as quantity, SUM(si.price * si.quantity) as total_sold
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            LEFT JOIN products p ON si.product_id = p.id
            WHERE s.status = 'completed' AND date(s.created_at, '-5 hours') BETWEEN ? AND ?
            GROUP BY p.business_line, p.name
            ORDER BY p.business_line, total_sold DESC
        `).all(startDate, endDate);

        const business_lines_top5 = {};
        business_lines_raw.forEach(row => {
            const line = row.business_line || 'Sin asignar';
            if (!business_lines_top5[line]) business_lines_top5[line] = [];
            if (business_lines_top5[line].length < 5) {
                business_lines_top5[line].push(row);
            }
        });

        res.json({
            daily_evolution,
            top_products,
            categories,
            donut_products,
            distribution,
            business_lines_top5
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/reports/daily', (req, res) => {
    try {
        const todayStr = getLocalTodayStr();
        const startDate = req.query.startDate || todayStr;
        const endDate = req.query.endDate || todayStr;
        
        const cashRow = db.prepare(`
            SELECT SUM(total) as total, SUM(cost_total) as cost 
            FROM sales 
            WHERE status = 'completed' AND payment_status = 'paid' AND payment_method = 'Efectivo' AND date(created_at, '-5 hours') BETWEEN ? AND ?
        `).get(startDate, endDate);

        const transferRow = db.prepare(`
            SELECT SUM(total) as total, SUM(cost_total) as cost 
            FROM sales 
            WHERE status = 'completed' AND payment_status = 'paid' AND payment_method = 'Transferencia' AND date(created_at, '-5 hours') BETWEEN ? AND ?
        `).get(startDate, endDate);

        const debtRow = db.prepare(`
            SELECT SUM(total) as total, SUM(cost_total) as cost 
            FROM sales 
            WHERE status = 'completed' AND payment_status = 'pending' AND date(created_at, '-5 hours') BETWEEN ? AND ?
        `).get(startDate, endDate);

        const countRow = db.prepare(`
            SELECT count(*) as count 
            FROM sales 
            WHERE status = 'completed' AND date(created_at, '-5 hours') BETWEEN ? AND ?
        `).get(startDate, endDate);

        const lowStock = db.prepare('SELECT id, name, stock, min_stock, category FROM products WHERE stock <= min_stock ORDER BY stock ASC').all();

        const expenseRow = db.prepare(`
            SELECT SUM(amount) as total 
            FROM expenses 
            WHERE date(created_at, '-5 hours') BETWEEN ? AND ?
        `).get(startDate, endDate);
        const totalExpenses = expenseRow.total || 0;

        const refundsRow = db.prepare(`
            SELECT 
                SUM(CASE WHEN payment_method = 'Efectivo' THEN refund_amount ELSE 0 END) as cash_refunds,
                SUM(CASE WHEN payment_method != 'Efectivo' THEN refund_amount ELSE 0 END) as transfer_refunds,
                SUM(refund_amount) as total_refunds
            FROM sale_refunds 
            WHERE date(created_at, '-5 hours') BETWEEN ? AND ?
        `).get(startDate, endDate);
        const cashRefunds = refundsRow?.cash_refunds || 0;
        const transferRefunds = refundsRow?.transfer_refunds || 0;
        const totalRefunds = refundsRow?.total_refunds || 0;

        const grossCashTotal = cashRow.total || 0;
        const grossTransferTotal = transferRow.total || 0;
        const cashTotal = Math.max(0, grossCashTotal - cashRefunds);
        const transferTotal = Math.max(0, grossTransferTotal - transferRefunds);
        const paidSalesTotal = cashTotal + transferTotal; 

        const cashCost = cashRow.cost || 0;
        const transferCost = transferRow.cost || 0;
        const paidCostTotal = cashCost + transferCost; 
        const netUtility = paidSalesTotal - paidCostTotal - totalExpenses; 
        const reinvestmentTotal = paidCostTotal; 

        const debtTotal = debtRow.total || 0; 
        const debtCost = debtRow.cost || 0; 

        const collectedDebtsCashRow = db.prepare(`
            SELECT SUM(cash_amount) as total 
            FROM sales 
            WHERE status = 'completed' AND payment_status = 'paid' 
              AND (parent_sale_id IS NOT NULL OR customer_name LIKE 'Abono:%' OR payment_shift_id IS NOT NULL)
              AND date(paid_at, '-5 hours') BETWEEN ? AND ? AND payment_method = 'Efectivo'
        `).get(startDate, endDate);

        const collectedDebtsTransferRow = db.prepare(`
            SELECT SUM(transfer_amount) as total 
            FROM sales 
            WHERE status = 'completed' AND payment_status = 'paid' 
              AND (parent_sale_id IS NOT NULL OR customer_name LIKE 'Abono:%' OR payment_shift_id IS NOT NULL)
              AND date(paid_at, '-5 hours') BETWEEN ? AND ? AND payment_method = 'Transferencia'
        `).get(startDate, endDate);

        const collectedDebtsCash = collectedDebtsCashRow?.total || 0;
        const collectedDebtsTransfer = collectedDebtsTransferRow?.total || 0;
        const totalCollectedDebts = collectedDebtsCash + collectedDebtsTransfer;
        const totalCashInflow = cashTotal + collectedDebtsCash;

        const report = {
            total_cash: cashTotal,
            total_transfer: transferTotal,
            total_sales: paidSalesTotal,
            gross_sales: grossCashTotal + grossTransferTotal,
            total_refunds: totalRefunds,
            cash_refunds: cashRefunds,
            transfer_refunds: transferRefunds,
            total_cost: paidCostTotal,
            total_expenses: totalExpenses,
            net_utility: netUtility,             
            total_debts: debtTotal,             
            total_reinvestment: reinvestmentTotal, 
            transaction_count: countRow.count || 0,
            low_stock: lowStock,
            collected_debts_cash: collectedDebtsCash,
            collected_debts_transfer: collectedDebtsTransfer,
            total_collected_debts: totalCollectedDebts,
            total_cash_inflow: Math.max(0, totalCashInflow - cashRefunds)
        };

        // Business Lines breakdown (if enabled)
        const blEnabled = db.prepare("SELECT value FROM config WHERE key = 'enable_business_lines'").get()?.value === 'true';
        if (blEnabled) {
            const line1Name = db.prepare("SELECT value FROM config WHERE key = 'business_line_1_name'").get()?.value || 'Línea 1';
            const line2Name = db.prepare("SELECT value FROM config WHERE key = 'business_line_2_name'").get()?.value || 'Línea 2';

            const getLineStats = (lineName) => {
                const paid = db.prepare(`
                    SELECT SUM(si.price * si.quantity) as total, COUNT(DISTINCT s.id) as count
                    FROM sale_items si
                    JOIN sales s ON si.sale_id = s.id
                    WHERE s.status = 'completed' AND s.payment_status = 'paid'
                    AND si.business_line = ?
                    AND date(s.created_at, '-5 hours') BETWEEN ? AND ?
                `).get(lineName, startDate, endDate);
                const debts = db.prepare(`
                    SELECT SUM(si.price * si.quantity) as total
                    FROM sale_items si
                    JOIN sales s ON si.sale_id = s.id
                    WHERE s.status = 'completed' AND s.payment_status = 'pending'
                    AND si.business_line = ?
                    AND date(s.created_at, '-5 hours') BETWEEN ? AND ?
                `).get(lineName, startDate, endDate);
                return {
                    name: lineName,
                    total_sales: Math.round(paid.total || 0),
                    transaction_count: paid.count || 0,
                    total_debts: Math.round(debts.total || 0)
                };
            };

            report.breakdown_by_line = [
                getLineStats(line1Name),
                getLineStats(line2Name)
            ];
            report.line_1_name = line1Name;
            report.line_2_name = line2Name;
        }

        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API USUARIOS ---
app.get('/api/users', (req, res) => {
    try {
        const users = db.prepare('SELECT id, username, role, created_at FROM users').all();
        res.json(users);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', (req, res) => {
    const { username, pin, role } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO users (username, pin, role) VALUES (?, ?, ?)');
        const info = stmt.run(username, pin, role || 'cashier');
        res.json({ id: info.lastInsertRowid });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:id', (req, res) => {
    const { username, pin, role } = req.body;
    try {
        if (pin) {
            db.prepare('UPDATE users SET username = ?, pin = ?, role = ? WHERE id = ?').run(username, pin, role, req.params.id);
        } else {
            db.prepare('UPDATE users SET username = ?, role = ? WHERE id = ?').run(username, role, req.params.id);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', (req, res) => {
    const { pin } = req.body;
    try {
        const user = db.prepare('SELECT id, username, role FROM users WHERE pin = ?').get(pin);
        if (user) {
            res.json(user);
        } else {
            res.status(401).json({ error: 'PIN incorrecto' });
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- API CLIENTES (CRM) ---
app.get('/api/customers', (req, res) => {
    try {
        const customers = db.prepare('SELECT * FROM customers').all();
        res.json(customers);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/customers', (req, res) => {
    const { name, phone, email, address } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)');
        const info = stmt.run(name, phone || null, email || null, address || null);
        res.json({ id: info.lastInsertRowid });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/customers/:id', (req, res) => {
    const { name, phone, email, address } = req.body;
    try {
        db.prepare('UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?')
          .run(name, phone || null, email || null, address || null, req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/customers/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- API RECORDATORIOS Y MANTENIMIENTOS PROFESIONALES ---
app.get('/api/reminders', (req, res) => {
    try {
        const reminders = db.prepare('SELECT * FROM reminders ORDER BY due_date ASC, id DESC').all();
        res.json(reminders);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reminders/summary', (req, res) => {
    try {
        const today = getLocalTodayStr();
        const overdue = db.prepare("SELECT COUNT(*) as c FROM reminders WHERE status = 'pending' AND due_date < ?").get(today)?.c || 0;
        const dueToday = db.prepare("SELECT COUNT(*) as c FROM reminders WHERE status = 'pending' AND due_date = ?").get(today)?.c || 0;
        const upcoming7Days = db.prepare("SELECT COUNT(*) as c FROM reminders WHERE status = 'pending' AND due_date > ? AND due_date <= date(?, '+7 days')").get(today, today)?.c || 0;
        const totalPending = db.prepare("SELECT COUNT(*) as c FROM reminders WHERE status = 'pending'").get()?.c || 0;
        res.json({ overdue, dueToday, upcoming7Days, totalPending, badgeCount: overdue + dueToday });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reminders', (req, res) => {
    const { title, description, customer_name, customer_phone, due_date, due_time, advance_notice_days, recurrence_days } = req.body;
    try {
        const advDays = (advance_notice_days !== undefined && advance_notice_days !== null && !isNaN(parseInt(advance_notice_days, 10))) 
            ? parseInt(advance_notice_days, 10) 
            : 1;
        const recDays = (recurrence_days !== undefined && recurrence_days !== null && !isNaN(parseInt(recurrence_days, 10))) 
            ? parseInt(recurrence_days, 10) 
            : 0;
        const stmt = db.prepare(`
            INSERT INTO reminders (title, description, customer_name, customer_phone, due_date, due_time, advance_notice_days, recurrence_days, status, time_alert_sent) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
        `);
        const info = stmt.run(
            title, 
            description || null, 
            customer_name || null, 
            customer_phone || null, 
            due_date, 
            due_time || null,
            advDays, 
            recDays
        );

        broadcastEvent({ 
            type: 'REMINDER_CREATED', 
            id: info.lastInsertRowid,
            title,
            customer_name,
            due_date,
            due_time: due_time || null
        });

        // Notificar confirmación de agendamiento en Telegram si está habilitado
        const tgNotify = db.prepare("SELECT value FROM config WHERE key = 'telegram_notify_reminders'").get()?.value !== 'false';
        if (tgNotify && telegram && typeof telegram.sendTelegramMessage === 'function') {
            const advTxt = advDays === 0 ? 'El mismo día' : `${advDays} día(s) antes`;
            let msg = `🔔 <b>Nuevo Recordatorio Agendado</b>\n\n` +
                `📋 <b>Tarea / Mantenimiento:</b> ${title}\n` +
                `👤 <b>Cliente:</b> ${customer_name || 'General'}`;
            if (customer_phone) msg += ` (📞 ${customer_phone})`;
            msg += `\n📅 <b>Fecha Programada:</b> ${due_date}`;
            if (due_time) msg += ` ⏰ <b>${formatTime12h(due_time)}</b>`;
            msg += `\n⏰ <b>Aviso Previo:</b> ${advTxt}\n`;
            if (recDays > 0) msg += `🔄 <b>Recurrencia:</b> Cada ${recDays} días\n`;
            if (description) msg += `📝 <b>Detalles:</b> ${description}\n`;
            msg += `\n<i>Para gestionar desde Telegram:</i> <code>/recordatorios</code>`;
            telegram.sendTelegramMessage(msg, 'HTML');
        }

        setTimeout(checkRemindersAndNotify, 300);

        res.json({ id: info.lastInsertRowid, success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/reminders/:id', (req, res) => {
    const { title, description, customer_name, customer_phone, due_date, due_time, advance_notice_days, recurrence_days } = req.body;
    try {
        const advDays = (advance_notice_days !== undefined && advance_notice_days !== null && !isNaN(parseInt(advance_notice_days, 10))) 
            ? parseInt(advance_notice_days, 10) 
            : 1;
        const recDays = (recurrence_days !== undefined && recurrence_days !== null && !isNaN(parseInt(recurrence_days, 10))) 
            ? parseInt(recurrence_days, 10) 
            : 0;
        db.prepare(`
            UPDATE reminders 
            SET title = ?, description = ?, customer_name = ?, customer_phone = ?, due_date = ?, due_time = ?, advance_notice_days = ?, recurrence_days = ?, time_alert_sent = 0
            WHERE id = ?
        `).run(
            title, 
            description || null, 
            customer_name || null, 
            customer_phone || null, 
            due_date, 
            due_time || null,
            advDays, 
            recDays, 
            req.params.id
        );

        broadcastEvent({ type: 'REMINDER_UPDATED', id: req.params.id });
        setTimeout(checkRemindersAndNotify, 300);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/reminders/:id/status', (req, res) => {
    const { status } = req.body;
    try {
        const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id);
        if (!reminder) return res.status(404).json({ error: 'Recordatorio no encontrado' });

        db.prepare('UPDATE reminders SET status = ? WHERE id = ?').run(status, req.params.id);

        let nextReminderId = null;
        let nextDueDate = null;

        // Si se completa y tiene recurrencia cíclica (> 0 días), auto-agendar el siguiente ciclo
        if (status === 'completed' && reminder.recurrence_days > 0) {
            nextDueDate = addDaysToDateString(reminder.due_date, reminder.recurrence_days);

            const newInfo = db.prepare(`
                INSERT INTO reminders (title, description, customer_name, customer_phone, due_date, due_time, advance_notice_days, recurrence_days, status, time_alert_sent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
            `).run(
                reminder.title,
                reminder.description,
                reminder.customer_name,
                reminder.customer_phone,
                nextDueDate,
                reminder.due_time || null,
                reminder.advance_notice_days,
                reminder.recurrence_days
            );
            nextReminderId = newInfo.lastInsertRowid;

            // Notificar ciclo renovado en Telegram
            const tgNotify = db.prepare("SELECT value FROM config WHERE key = 'telegram_notify_reminders'").get()?.value !== 'false';
            if (tgNotify && telegram && typeof telegram.sendTelegramMessage === 'function') {
                const timeInfo = reminder.due_time ? ` a las ${formatTime12h(reminder.due_time)}` : '';
                telegram.sendTelegramMessage(
                    `✅ <b>Mantenimiento Completado y Renovado</b>\n\n` +
                    `📋 <b>Servicio:</b> ${reminder.title}\n` +
                    `👤 <b>Cliente:</b> ${reminder.customer_name || 'General'}\n` +
                    `🔄 <b>Periodicidad:</b> Cada ${reminder.recurrence_days} días\n` +
                    `📅 <b>Próxima Cita Auto-Agendada:</b> <b>${nextDueDate}</b>${timeInfo} (ID #${nextReminderId})`,
                    'HTML'
                );
            }
        }

        broadcastEvent({ 
            type: 'REMINDER_STATUS_CHANGED', 
            id: req.params.id, 
            status, 
            nextReminderId, 
            nextDueDate 
        });

        res.json({ success: true, nextReminderId, nextDueDate });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/reminders/:id', (req, res) => {
    if (!verifyAdmin(req)) {
        return res.status(401).json({ error: 'Acceso no autorizado. Se requiere contraseña de Administrador para eliminar recordatorios.' });
    }
    try {
        const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id);
        if (!reminder) return res.status(404).json({ error: 'Recordatorio no encontrado' });

        db.prepare('DELETE FROM reminders WHERE id = ?').run(req.params.id);
        broadcastEvent({ type: 'REMINDER_DELETED', id: req.params.id });

        // Notificación de Auditoría en Telegram al eliminar
        const tgNotify = db.prepare("SELECT value FROM config WHERE key = 'telegram_notify_reminders'").get()?.value !== 'false';
        if (tgNotify && telegram && typeof telegram.sendTelegramMessage === 'function') {
            const timeInfo = reminder.due_time ? ` a las ${formatTime12h(reminder.due_time)}` : '';
            telegram.sendTelegramMessage(
                `🗑️ <b>Recordatorio / Mantenimiento Eliminado</b>\n\n` +
                `🆔 <b>ID:</b> #${reminder.id}\n` +
                `📋 <b>Tarea:</b> ${reminder.title}\n` +
                `👤 <b>Cliente:</b> ${reminder.customer_name || 'General'}\n` +
                `📅 <b>Fecha que estaba agendada:</b> ${reminder.due_date}${timeInfo}\n` +
                `🔒 <i>Acción de auditoría: Registro suprimido del sistema por Administrador.</i>`,
                'HTML'
            );
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Monitoreo puntual y preventivo en segundo plano de Recordatorios (Alertas automáticas)
async function checkRemindersAndNotify() {
    try {
        const enabled = db.prepare("SELECT value FROM config WHERE key = 'enable_reminders'").get()?.value !== 'false';
        if (!enabled) return;

        const tgNotify = db.prepare("SELECT value FROM config WHERE key = 'telegram_notify_reminders'").get()?.value !== 'false';
        const todayStr = getLocalTodayStr();
        const currentTimeStr = getLocalCurrentTimeStr(); // "12:05"

        const pending = db.prepare("SELECT * FROM reminders WHERE status = 'pending'").all();
        for (const r of pending) {
            const advanceDays = (r.advance_notice_days !== undefined && r.advance_notice_days !== null) ? Number(r.advance_notice_days) : 1;
            const diffDays = getDaysDiff(r.due_date, todayStr);

            // 1. ALERTA PUNTUAL POR HORA EXACTA (Cuando es para hoy y llega la hora programada)
            if (diffDays === 0 && r.due_time) {
                const targetTime24 = parseTimeTo24h(r.due_time);
                if (targetTime24 && currentTimeStr >= targetTime24 && !r.time_alert_sent) {
                    db.prepare("UPDATE reminders SET time_alert_sent = 1, last_notified_at = CURRENT_TIMESTAMP WHERE id = ?").run(r.id);

                    const timeDisplay = formatTime12h(r.due_time);

                    // A) Alerta SSE en tiempo real a la pantalla del POS con alarma auditiva
                    broadcastEvent({
                        type: 'REMINDER_DUE_ALARM',
                        id: r.id,
                        title: r.title,
                        customer_name: r.customer_name,
                        customer_phone: r.customer_phone,
                        due_time: r.due_time,
                        due_date: r.due_date,
                        message: `⏰ ¡Llegó la hora de tu recordatorio #${r.id}! "${r.title}" (${timeDisplay})`
                    });

                    // B) Notificación Instantánea en Telegram
                    if (tgNotify && telegram && typeof telegram.sendTelegramMessage === 'function') {
                        let phoneLine = r.customer_phone ? `📞 <b>Contacto / WhatsApp:</b> ${r.customer_phone}\n` : '';
                        let descLine = r.description ? `📝 <b>Detalles:</b> ${r.description}\n` : '';
                        telegram.sendTelegramMessage(
                            `⏰🔔 <b>¡LLEGÓ LA HORA DE TU RECORDATORIO!</b>\n\n` +
                            `📋 <b>Tarea / Servicio:</b> ${r.title}\n` +
                            `👤 <b>Cliente:</b> ${r.customer_name || 'General'}\n` +
                            phoneLine +
                            `📅 <b>Fecha:</b> Hoy (${r.due_date})\n` +
                            `⏰ <b>Hora Programada:</b> <b>${timeDisplay}</b>\n` +
                            descLine +
                            `\n👉 <i>Para completar desde Telegram:</i> <code>/completar_recordatorio ${r.id}</code>\n` +
                            `👉 <i>Para eliminar desde Telegram:</i> <code>/eliminar_recordatorio ${r.id}</code>`,
                            'HTML'
                        );
                    }
                    continue;
                }
            }

            // 2. AVISO PREVENTIVO O RECORDATORIO POR FECHA (Diario)
            const isOverdue = diffDays < 0;
            const isToday = diffDays === 0;
            const isUpcoming = diffDays > 0 && diffDays <= advanceDays;

            if (isOverdue || isToday || isUpcoming) {
                const lastNotified = r.last_notified_at ? r.last_notified_at.slice(0, 10) : null;
                // Si aún no se ha emitido aviso general en la fecha de hoy
                if (lastNotified !== todayStr && !r.time_alert_sent) {
                    db.prepare("UPDATE reminders SET last_notified_at = CURRENT_TIMESTAMP WHERE id = ?").run(r.id);

                    if (tgNotify && telegram && typeof telegram.sendTelegramMessage === 'function') {
                        let header = '';
                        if (isOverdue) header = `🚨 <b>RECORDATORIO VENCIDO</b> (Hace ${Math.abs(diffDays)} días)`;
                        else if (isToday) header = `🔔 <b>RECORDATORIO PARA HOY</b>`;
                        else header = `⏰ <b>AVISO PREVIO DE RECORDATORIO</b> (Faltan ${diffDays} días)`;

                        let timeDetail = r.due_time ? ` ⏰ <b>${formatTime12h(r.due_time)}</b>` : '';

                        let msg = `${header}\n\n` +
                            `📋 <b>Tarea / Servicio:</b> ${r.title}\n` +
                            `👤 <b>Cliente:</b> ${r.customer_name || 'General'}\n`;
                        if (r.customer_phone) msg += `📞 <b>Contacto / WhatsApp:</b> ${r.customer_phone}\n`;
                        msg += `📅 <b>Fecha Programada:</b> ${r.due_date}${timeDetail}\n`;
                        if (r.recurrence_days > 0) msg += `🔄 <b>Frecuencia:</b> Cada ${r.recurrence_days} días\n`;
                        if (r.description) msg += `📝 <b>Detalles:</b> ${r.description}\n`;
                        msg += `\n<i>Para completar desde Telegram:</i> <code>/completar_recordatorio ${r.id}</code>\n` +
                               `<i>Para eliminar desde Telegram:</i> <code>/eliminar_recordatorio ${r.id}</code>`;

                        telegram.sendTelegramMessage(msg, 'HTML');
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error al verificar recordatorios en segundo plano:', err.message);
    }
}

// Iniciar verificación a los 3 segundos del arranque y chequear cada 15 segundos para alarmas puntuales
setTimeout(checkRemindersAndNotify, 3000);
setInterval(checkRemindersAndNotify, 15000);



// --- SERVIR FRONTEND ESTATICO (SOPORTE PARA MODO ESCRITORIO EMPAQUETADO) ---

let distPath = path.resolve(__dirname, '../frontend/dist');
if (!fs.existsSync(path.join(distPath, 'index.html')) || !fs.existsSync(path.join(distPath, 'assets'))) {
    distPath = path.resolve(__dirname, '../frontend_dist');
}
if (!fs.existsSync(path.join(distPath, 'index.html'))) {
    distPath = path.resolve(__dirname, '../frontend/dist');
}
console.log(`[Frontend Static] Sirviendo interfaz desde: ${distPath}`);
app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

app.get('*', (req, res, next) => {
    // Si la ruta comienza con /api, dejar pasar al enrutador de API
    if (req.path.startsWith('/api')) {
        return next();
    }
    // Servir index.html de la SPA React sin caché agresivo
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    
    // Ngrok Tunnel
    const ngrokEnabled = db.prepare("SELECT value FROM config WHERE key = 'ngrok_enabled'").get()?.value === 'true';
    if (ngrokEnabled) {
        console.log("Starting Ngrok tunnel automatically...");
        startNgrokTunnel().catch(console.error);
    }
    
    // Iniciar escucha del Bot Interactivo de Telegram
    try {
        telegram.startTelegramPolling();
    } catch (e) {
        console.error('Error al iniciar bot de Telegram:', e.message);
    }
});
