const { exec } = require('child_process');
const crypto = require('node:crypto');
const db = require('./database');

const SECRET_MAESTRO = 'MI_CLAVE_MAESTRA_DE_LICENCIAS_PORTABLES_2026';
const SALT = 'salt_tienda_pos_2026';
const PRODUCT_ID = 'software-global';

// 1. Obtener la Huella Digital Única de Hardware (UUID de Placa Base Windows)
function getSystemUUID() {
    return new Promise((resolve) => {
        // Intentar obtener UUID mediante WMIC primero
        exec('wmic csproduct get uuid', (err, stdout) => {
            if (!err && stdout) {
                const lines = stdout.split('\n');
                if (lines.length > 1) {
                    const uuid = lines[1].trim();
                    if (uuid && uuid !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF') {
                        return resolve(uuid);
                    }
                }
            }

            // Fallback a PowerShell si WMIC está inhabilitado/deprecado
            exec('powershell -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"', (err2, stdout2) => {
                if (!err2 && stdout2) {
                    const uuid = stdout2.trim();
                    if (uuid) {
                        return resolve(uuid);
                    }
                }

                // Si todo falla (entorno virtual o sin WMI), usar una huella genérica persistente
                resolve('OFFLINE-HW-FINGERPRINT-DEFAULT-92A3');
            });
        });
    });
}

// 2. Desencriptar Token de Licencia usando Criptografía Simétrica
function decryptLicense(token) {
    try {
        const parts = token.split(':');
        if (parts.length !== 2) return null;

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];

        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(SECRET_MAESTRO, SALT, 32);

        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    } catch (err) {
        return null; // Clave corrupta, modificada o inválida
    }
}

// 3. Chequeo de Fraude del Reloj de Windows (Anti-Clock Tampering)
function checkClockTampering() {
    try {
        // Consultar la fecha de la última venta registrada en el historial
        const row = db.prepare(`
            SELECT created_at 
            FROM sales 
            WHERE status = 'completed' 
            ORDER BY created_at DESC 
            LIMIT 1
        `).get();

        if (!row || !row.created_at) {
            return { isTampered: false, lastSeenDate: null }; // No hay registros históricos, no aplica chequeo
        }

        // Convertir la fecha de la última venta a tipo Date
        const lastSaleDate = new Date(row.created_at + 'Z');
        const systemDate = new Date();

        // Si la hora del sistema operativo es menor a la de la última venta
        // significa que el usuario alteró el reloj del PC o la pila falló
        // Damos un margen de tolerancia de 10 minutos
        const isTampered = systemDate < (lastSaleDate - 10 * 60 * 1000);
        return { isTampered, lastSeenDate: lastSaleDate };
    } catch (e) {
        console.error('Error al validar reloj del sistema:', e);
        return { isTampered: false, lastSeenDate: null };
    }
}

// 4. Verificación Completa de Estado de Activación
async function verifyLicenseStatus() {
    const systemUUID = await getSystemUUID();

    // Bypass de autorización para equipo de desarrollo/dueño (Huella Maestra)
    if (systemUUID === '35444335-3334-4242-4D4B-4B4233344435') {
        return {
            isValid: true,
            reason: 'activa',
            uuid: systemUUID,
            daysLeft: 99999,
            expires: 'VITALICIA',
            type: 'lifetime'
        };
    }

    // Obtener la licencia activa guardada en los ajustes de configuración de la DB
    const row = db.prepare("SELECT value FROM config WHERE key = 'license_key'").get();
    
    if (!row || !row.value) {
        return {
            isValid: false,
            reason: 'sin_licencia',
            uuid: systemUUID,
            daysLeft: 0,
            expires: null,
            type: 'subscription'
        };
    }

    const payload = decryptLicense(row.value);
    if (!payload) {
        return {
            isValid: false,
            reason: 'clave_invalida',
            uuid: systemUUID,
            daysLeft: 0,
            expires: null,
            type: 'subscription'
        };
    }

    // A. Validar que la huella digital del token coincida con el hardware local
    if (payload.uuid !== systemUUID) {
        return {
            isValid: false,
            reason: 'hardware_no_coincide',
            uuid: systemUUID,
            daysLeft: 0,
            expires: payload.expires,
            type: payload.expires === 'lifetime' ? 'lifetime' : 'subscription'
        };
    }

    // B. Validar que el token corresponda al producto actual (evita cruce de softwares)
    const isProductValid = payload.product === 'software-global' || payload.product === PRODUCT_ID || payload.product === 'universal-pos' || payload.product === 'tienda-pos' || payload.product === 'moto-parking-casino' || payload.product === 'jv-spa-parking' || payload.product === 'restaurante' || payload.product === 'restaurante-maestro' || payload.product === 'restaurante-rafaml' || payload.product === 'software-ganaderia' || payload.product === 'heladeria' || payload.product === 'pescaderia-lopez' || payload.product === 'suroeste-cafe';
    if (!isProductValid) {
        return {
            isValid: false,
            reason: 'producto_no_coincide',
            uuid: systemUUID,
            daysLeft: 0,
            expires: payload.expires,
            type: payload.expires === 'lifetime' ? 'lifetime' : 'subscription'
        };
    }

    // C. Validar fraude del reloj (Tampering)
    const tamperCheck = checkClockTampering();
    const isTampered = tamperCheck.isTampered;
    const referenceDate = (isTampered && tamperCheck.lastSeenDate) ? tamperCheck.lastSeenDate : new Date();

    // D. Validar vigencia temporal usando la fecha de referencia
    if (payload.expires === 'lifetime') {
        return {
            isValid: true,
            reason: 'activa',
            uuid: systemUUID,
            daysLeft: 99999,
            expires: 'VITALICIA',
            type: 'lifetime'
        };
    } else {
        const todayStr = referenceDate.toISOString().split('T')[0];
        const today = new Date(todayStr);
        const expDate = new Date(payload.expires);

        const diffTime = expDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return {
                isValid: false, // Bloquear interfaz si la suscripción está expirada
                reason: 'licencia_expirada',
                uuid: systemUUID,
                daysLeft: diffDays,
                expires: payload.expires,
                type: 'subscription'
            };
        }

        return {
            isValid: true,
            reason: 'activa',
            uuid: systemUUID,
            daysLeft: diffDays,
            expires: payload.expires,
            type: 'subscription'
        };
    }
}

module.exports = {
    getSystemUUID,
    decryptLicense,
    verifyLicenseStatus
};
