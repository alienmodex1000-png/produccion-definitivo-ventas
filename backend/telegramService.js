const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('./database');

// Integración en tiempo real (SSE) con la pantalla del POS
let eventBroadcaster = null;
function setEventBroadcaster(fn) {
  eventBroadcaster = fn;
}

function notifyRealtime(type, data = {}, message = '') {
  if (typeof eventBroadcaster === 'function') {
    try {
      eventBroadcaster({ type, data, message, timestamp: Date.now(), source: 'telegram' });
    } catch (e) {
      console.error('Error emitiendo evento SSE desde Telegram:', e);
    }
  }
}

// Identificar carpetas de datos aisladas
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

function getLocalTodayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function getBusinessName() {
  try {
    const row = db.prepare("SELECT value FROM config WHERE key = 'business_name'").get();
    if (row && row.value && row.value.trim() !== '') {
      return row.value.trim();
    }
  } catch (e) {}
  return 'Mi Tienda';
}

function getTelegramConfig() {
  let tokenRow = null;
  let chatRow = null;
  try {
    tokenRow = db.prepare("SELECT value FROM config WHERE key = 'telegram_bot_token'").get();
    chatRow = db.prepare("SELECT value FROM config WHERE key = 'telegram_chat_id'").get();
  } catch (e) {
    console.error("Error reading telegram config from DB:", e);
  }
  return {
    token: tokenRow ? tokenRow.value : null,
    chatId: chatRow ? chatRow.value : null
  };
}

/**
 * Llamada genérica a la API de Telegram con HTTPS nativo y timeout de protección
 */
function telegramApiRequest(method, payload = {}, timeoutMs = 25000) {
  const config = getTelegramConfig();
  if (!config.token || config.token.trim() === '') {
    return Promise.resolve({ ok: false, description: 'Token no configurado' });
  }

  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };

    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${config.token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Connection': 'close'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          safeResolve(JSON.parse(data));
        } catch (e) {
          safeResolve({ ok: false, description: 'Error parseando respuesta JSON' });
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      try { req.destroy(); } catch (e) {}
      safeResolve({ ok: false, description: 'Socket timeout' });
    });

    req.on('error', (err) => {
      safeResolve({ ok: false, description: err.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Enviar mensaje con parse_mode HTML por defecto a un chatId específico
 */
function sendMessageToChat(chatId, text, extra = {}) {
  return telegramApiRequest('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    ...extra
  });
}

/**
 * Añadir encabezado corporativo dinámico con el nombre del negocio si no está presente
 */
function formatMessageWithBusinessHeader(text) {
  if (!text) return text;
  const rawName = getBusinessName();
  const cleanStore = (rawName && rawName.trim() !== '') ? rawName.trim().toUpperCase() : 'MI NEGOCIO';
  
  // Si el texto ya contiene el nombre del negocio o un banner similar, no duplicar
  if (text.toUpperCase().includes(cleanStore) || text.includes('🏪')) {
    return text;
  }
  
  return `🏪 <b>${cleanStore}</b>\n━━━━━━━━━━━━━━━━━━━━\n${text}`;
}

/**
 * Envío de notificaciones salientes existentes del sistema
 */
function sendTelegramMessage(text, parseMode = 'HTML', toggleKey = null) {
  const config = getTelegramConfig();
  if (!config.token || !config.chatId || config.token.trim() === '' || config.chatId.trim() === '') {
    return Promise.resolve(false);
  }

  if (toggleKey) {
    try {
      const toggleRow = db.prepare("SELECT value FROM config WHERE key = ?").get(toggleKey);
      if (toggleRow && toggleRow.value === 'false') {
        return Promise.resolve(false);
      }
    } catch (e) {}
  }

  const formattedText = formatMessageWithBusinessHeader(text);

  return sendMessageToChat(config.chatId, formattedText, { parse_mode: parseMode })
    .then(res => !!res.ok)
    .catch(() => false);
}

/**
 * Enviar foto directamente al chat de Telegram con multipart/form-data nativo
 */
async function sendTelegramPhoto(filePath, caption = '', targetChatId = null) {
  const config = getTelegramConfig();
  const destChatId = targetChatId || config.chatId;
  if (!config.token || !destChatId || !fs.existsSync(filePath)) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      const buffer = fs.readFileSync(filePath);
      const filename = path.basename(filePath);
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

      let postData = '';
      postData += `--${boundary}\r\n`;
      postData += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${destChatId}\r\n`;
      if (caption) {
        const formattedCaption = formatMessageWithBusinessHeader(caption);
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="caption"\r\n\r\n${formattedCaption}\r\n`;
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`;
      }
      postData += `--${boundary}\r\n`;
      postData += `Content-Disposition: form-data; name="photo"; filename="${filename}"\r\n`;
      postData += `Content-Type: image/jpeg\r\n\r\n`;

      const postDataEnd = `\r\n--${boundary}--\r\n`;

      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${config.token}/sendPhoto`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(postData) + buffer.length + Buffer.byteLength(postDataEnd)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(!!parsed.ok);
          } catch(e) { resolve(false); }
        });
      });
      req.on('error', () => resolve(false));
      req.write(postData);
      req.write(buffer);
      req.write(postDataEnd);
      req.end();
    } catch(err) {
      resolve(false);
    }
  });
}

/**
 * Enviar foto directamente desde un Buffer binario a Telegram
 */
function sendTelegramPhotoBuffer(buffer, caption = '', customChatId = null, filename = 'qr_carta_digital.png') {
  const config = getTelegramConfig();
  const destChatId = customChatId || config.chatId;

  if (!config.token || !destChatId || !buffer) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

      let postData = '';
      postData += `--${boundary}\r\n`;
      postData += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${destChatId}\r\n`;
      if (caption) {
        const formattedCaption = formatMessageWithBusinessHeader(caption);
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="caption"\r\n\r\n${formattedCaption}\r\n`;
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="parse_mode"\r\n\r\nHTML\r\n`;
      }
      postData += `--${boundary}\r\n`;
      postData += `Content-Disposition: form-data; name="photo"; filename="${filename}"\r\n`;
      postData += `Content-Type: image/png\r\n\r\n`;

      const postDataEnd = `\r\n--${boundary}--\r\n`;

      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${config.token}/sendPhoto`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(postData) + buffer.length + Buffer.byteLength(postDataEnd)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(!!parsed.ok);
          } catch(e) { resolve(false); }
        });
      });
      req.on('error', () => resolve(false));
      req.write(postData);
      req.write(buffer);
      req.write(postDataEnd);
      req.end();
    } catch(err) {
      resolve(false);
    }
  });
}

/**
 * Descargar foto de factura o comprobante directo a receiptsDir
 */
function downloadReceiptPhoto(fileId) {
  const config = getTelegramConfig();
  return new Promise(async (resolve) => {
    try {
      const fileRes = await telegramApiRequest('getFile', { file_id: fileId });
      if (!fileRes.ok || !fileRes.result || !fileRes.result.file_path) {
        return resolve(null);
      }
      const remotePath = fileRes.result.file_path;
      const ext = path.extname(remotePath) || '.jpg';
      const tempFilename = `temp_receipt_${Date.now()}_${Math.round(Math.random() * 1E6)}${ext}`;
      const tempFilePath = path.join(receiptsDir, tempFilename);

      const downloadUrl = `https://api.telegram.org/file/bot${config.token}/${remotePath}`;
      const fileStream = fs.createWriteStream(tempFilePath);

      https.get(downloadUrl, (res) => {
        if (res.statusCode !== 200) {
          return resolve(null);
        }
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(tempFilePath);
        });
      }).on('error', () => resolve(null));
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Generador de nombre estandarizado y cronológico de factura para archivo físico
 * Formato: Gasto_NID_YYYY-MM-DD_HH-mm_Concepto_Monto.jpg (sin # para compatibilidad URL)
 */
function formatReceiptFilename(expenseId, description, amount) {
  const now = new Date();
  const formatterDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });
  const dateStr = formatterDate.format(now); // YYYY-MM-DD
  
  const formatterTime = new Intl.DateTimeFormat('es-CO', { 
    timeZone: 'America/Bogota', 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
  const timeStr = formatterTime.format(now).replace(':', '-'); // HH-mm

  let slug = (description || 'Gasto')
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 25)
    .replace(/^_+|_+$/g, '');

  if (!slug) slug = 'Comprobante';
  const cleanAmount = Math.round(Number(amount) || 0);

  return `Gasto_N${expenseId}_${dateStr}_${timeStr}_${slug}_${cleanAmount}.jpg`;
}

/**
 * Módulo inteligente de Visión con IA (Gemini con fallback multi-modelo)
 */
async function analyzeReceiptWithGemini(filePath) {
  let apiKey = null;
  try {
    const enabledRow = db.prepare("SELECT value FROM config WHERE key = 'enable_gemini_receipts'").get();
    if (enabledRow && enabledRow.value === 'false') {
      console.log('[Telegram Bot] IA de lectura de facturas desactivada en Ajustes.');
      return null;
    }
    const row = db.prepare("SELECT value FROM config WHERE key = 'gemini_api_key'").get();
    apiKey = row ? row.value : null;
  } catch (e) {
    console.error('[Telegram Bot] Error leyendo config para IA:', e.message);
  }

  if (!apiKey || apiKey.trim() === '') {
    console.log('[Telegram Bot] Clave de IA no configurada en Ajustes.');
    return null;
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64Image = fileBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    const promptText = 
      "Eres un experto en contabilidad y auditoría de facturas, tickets y recibos de caja en Colombia. " +
      "Analiza cuidadosamente esta imagen de recibo o factura de gasto colombiana. " +
      "Extrae toda la información clave y responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin bloques de código ```json, sin texto adicional) con esta estructura exacta:\n" +
      "{\n" +
      '  "merchant": "Nombre del proveedor o tienda",\n' +
      '  "nit": "NIT o identificación si es visible, o null",\n' +
      '  "invoice_number": "Número de factura o tirilla si es visible, o null",\n' +
      '  "concept": "Resumen claro de lo comprado o consumido (ej: Cerveza Aguila 6 un)",\n' +
      '  "items_summary": "Lista breve de items principales detectados",\n' +
      '  "payment_method": "Efectivo, Tarjeta, Transferencia, o null",\n' +
      '  "total": 0,\n' +
      '  "date": "YYYY-MM-DD"\n' +
      "}\n" +
      "El campo 'total' DEBE ser el valor total neto final pagado en pesos colombianos como número entero (ejemplo: 13500). " +
      "Si el total no es legible con certeza, coloca 0.";

    const postPayload = JSON.stringify({
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 350
      }
    });

    async function queryModel(modelName) {
      return new Promise((resolve) => {
        const options = {
          hostname: 'generativelanguage.googleapis.com',
          port: 443,
          path: `/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postPayload)
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              if (res.statusCode !== 200) {
                console.log(`[Telegram Bot] Modelo ${modelName} HTTP status ${res.statusCode}: ${data.substring(0, 120)}`);
                return resolve(null);
              }
              const parsed = JSON.parse(data);
              const textResponse = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
              if (!jsonMatch) {
                console.log(`[Telegram Bot] Modelo ${modelName}: respuesta sin bloque JSON.`);
                return resolve(null);
              }
              const result = JSON.parse(jsonMatch[0]);
              let totalNum = typeof result.total === 'number' ? result.total : parseInt(String(result.total || '0').replace(/[^0-9]/g, ''), 10);
              if (!isNaN(totalNum) && totalNum > 0) {
                result.total = totalNum;
                console.log(`[Telegram Bot] ✅ Modelo ${modelName} analizó comprobante con éxito:`, JSON.stringify(result));
                return resolve(result);
              } else {
                console.log(`[Telegram Bot] Modelo ${modelName}: total no numérico o cero (${result.total})`);
                return resolve(null);
              }
            } catch (err) {
              console.error(`[Telegram Bot] Error parseando respuesta de ${modelName}:`, err.message);
              resolve(null);
            }
          });
        });

        req.on('error', (err) => {
          console.error(`[Telegram Bot] Error de red en ${modelName}:`, err.message);
          resolve(null);
        });
        req.setTimeout(18000, () => {
          req.destroy();
          console.warn(`[Telegram Bot] Timeout en ${modelName}`);
          resolve(null);
        });
        req.write(postPayload);
        req.end();
      });
    }

    console.log('[Telegram Bot] Iniciando análisis inteligente de comprobante con IA...');
    let result = await queryModel('gemini-3.5-flash-lite');
    if (!result) result = await queryModel('gemini-3.6-flash');
    if (!result) result = await queryModel('gemini-3.7-flash');
    if (!result) result = await queryModel('gemini-3.5-flash');
    return result;
  } catch (err) {
    console.error('[Telegram Bot] Excepción en analyzeReceiptWithGemini:', err.message);
    return null;
  }
}

async function sendTelegramDocument(base64Data, filename, caption = '', mimeType = 'application/pdf', targetChatId = null) {
  const config = getTelegramConfig();
  const destChatId = targetChatId || config.chatId;
  if (!config.token || !destChatId || config.token.trim() === '' || String(destChatId).trim() === '') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      const buffer = Buffer.from(base64Data.replace(/^data:[a-zA-Z0-9\/\-\.]+;(filename=[^;]+;)?base64,/, ""), 'base64');
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      
      let postData = '';
      postData += `--${boundary}\r\n`;
      postData += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${destChatId}\r\n`;
      if (caption) {
        postData += `--${boundary}\r\n`;
        postData += `Content-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`;
      }
      postData += `--${boundary}\r\n`;
      postData += `Content-Disposition: form-data; name="document"; filename="${filename}"\r\n`;
      postData += `Content-Type: ${mimeType}\r\n\r\n`;

      const postDataEnd = `\r\n--${boundary}--\r\n`;

      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${config.token}/sendDocument`,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': Buffer.byteLength(postData) + buffer.length + Buffer.byteLength(postDataEnd)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(!!parsed.ok);
          } catch(e) { resolve(false); }
        });
      });
      req.on('error', () => resolve(false));
      
      req.write(postData);
      req.write(buffer);
      req.write(postDataEnd);
      req.end();
    } catch(err) {
      resolve(false);
    }
  });
}

/**
 * Descargar un archivo de Telegram (foto) y guardarlo en uploadsDir
 */
function downloadTelegramFile(fileId) {
  const config = getTelegramConfig();
  return new Promise(async (resolve, reject) => {
    try {
      const fileRes = await telegramApiRequest('getFile', { file_id: fileId });
      if (!fileRes.ok || !fileRes.result || !fileRes.result.file_path) {
        return resolve(null);
      }
      const remotePath = fileRes.result.file_path;
      const ext = path.extname(remotePath) || '.jpg';
      const localFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
      const localFilePath = path.join(uploadsDir, localFilename);

      const downloadUrl = `https://api.telegram.org/file/bot${config.token}/${remotePath}`;
      const fileStream = fs.createWriteStream(localFilePath);

      https.get(downloadUrl, (res) => {
        if (res.statusCode !== 200) {
          return resolve(null);
        }
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(`/api/uploads/${localFilename}`);
        });
      }).on('error', () => resolve(null));
    } catch (e) {
      resolve(null);
    }
  });
}

// ============================================================================
// GESTIÓN DE SESIONES Y ESTADOS INTERACTIVOS (/crear producto)
// ============================================================================
const userSessions = new Map(); // chatId -> { step, data, timer }

function clearSession(chatId) {
  if (userSessions.has(chatId)) {
    clearTimeout(userSessions.get(chatId).timer);
    userSessions.delete(chatId);
  }
}

function setSession(chatId, step, data = {}) {
  clearSession(chatId);
  const timer = setTimeout(() => {
    if (userSessions.has(chatId)) {
      sendMessageToChat(chatId, '⏱️ <i>El tiempo de espera de la operación ha expirado. Escribe <code>/menu</code> para ver los comandos disponibles.</i>');
      userSessions.delete(chatId);
    }
  }, 5 * 60 * 1000); // 5 minutos de inactividad
  userSessions.set(chatId, { step, data, timer });
}

// Normalización de texto sin acentos y en minúsculas para búsquedas inteligentes
function normalizeText(text) {
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Conversión inteligente de moneda / montos (soporta 700.000, 1.500.000, 15000, $700,000 COP)
function parseColombianMoney(val) {
  if (val === null || val === undefined) return 0;
  let s = String(val).trim();
  s = s.replace(/[^0-9.,]/g, '');
  if (!s) return 0;

  // Si tiene puntos y comas mezclados (ej: 1.500.000,00 o 1,500,000.50)
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/\./g, '').replace(',', '.');
    }
    return parseFloat(s) || 0;
  }

  // Si solo tiene puntos (ej: 700.000 o 1.250.000)
  if (s.includes('.')) {
    const parts = s.split('.');
    const isThousands = parts.slice(1).every(p => p.length === 3);
    if (isThousands || parts.length > 2) {
      s = s.replace(/\./g, '');
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    const isThousands = parts.slice(1).every(p => p.length === 3);
    if (isThousands || parts.length > 2) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  }

  return parseFloat(s) || 0;
}

// ============================================================================
// CONTROLADORES DE COMANDOS
// ============================================================================

// 1. Menú de Ayuda
async function handleMenuCommand(chatId) {
  const storeName = getBusinessName();
  const text = 
    `🏪 <b>PANEL DE CONTROL TELEGRAM - ${storeName.toUpperCase()}</b>\n\n` +
    `Bienvenido al asistente inteligente de tu tienda. Puedes pulsar los comandos en azul o escribir en lenguaje normal:\n\n` +
    `📊 <b>VENTAS Y BALANCE EN VIVO</b>\n` +
    `• <code>/caja</code> : Ventas, cobros, gastos y efectivo en caja\n` +
    `• <code>/mes</code> : Reporte mensual de ventas, gastos y ganancia neta\n` +
    `• <code>/fiados</code> : Cartera y cuentas pendientes por cobrar\n` +
    `• <code>/abono [cliente] [monto]</code> : Registrar abono a deuda\n` +
    `• <code>/top</code> : Top 5 de productos más vendidos hoy\n` +
    `• <code>/agotados</code> : Referencias con stock en 0 o bajo\n\n` +
    `📦 <b>INVENTARIO Y STOCK</b>\n` +
    `• <code>/inventario</code> : Valorización total y descargar en Excel\n` +
    `• <code>/abastecer [prod] [cant]</code> : Entrada de mercancía (+)\n` +
    `• <code>/quitar [prod] [cant]</code> : Salida o merma de existencias (-)\n` +
    `• <code>/ajustar_stock [prod] [total]</code> : Fijar conteo físico real\n\n` +
    `🏷️ <b>GESTIÓN DE PRODUCTOS</b>\n` +
    `• <code>/precio [prod]</code> : Consultar precio y existencias\n` +
    `• <code>/crear</code> : Crear nuevo producto paso a paso (con foto)\n` +
    `• <code>/editar [prod]</code> : Ficha completa y opciones de modificación\n` +
    `• <code>/cambiar_precio [prod] [precio]</code> : Ajustar precio de venta\n` +
    `• <code>/cambiar_foto [prod]</code> : Asignar o renovar foto del producto\n` +
    `• <code>/eliminar [prod]</code> : Eliminar producto del inventario\n\n` +
    `💸 <b>CAJA CHICA Y GASTOS</b>\n` +
    `• <code>/gasto [monto] [motivo]</code> : Registrar salida de dinero\n` +
    `• <code>/factura</code> : Subir foto de recibo o factura de gasto\n` +
    `• <code>/buscar_gasto [palabra]</code> : Consultar gastos históricos\n` +
    `• <code>/ver_factura [id]</code> : Recibir la foto de un comprobante\n\n` +
    `🔔 <b>RECORDATORIOS Y MANTENIMIENTOS</b>\n` +
    `• <code>/recordatorios</code> : Ver alertas, citas y mantenimientos\n` +
    `• <code>/crear_recordatorio [fecha] [hora?] [cliente] - [tarea]</code> : Agendar cita\n` +
    `• <code>/completar_recordatorio [id]</code> : Marcar como realizado\n` +
    `• <code>/eliminar_recordatorio [id]</code> : Eliminar recordatorio\n\n` +
    `🌐 <b>CONEXIÓN REMOTA Y CARTA DIGITAL</b>\n` +
    `• <code>/link</code> : Enlaces de acceso al POS y Carta Digital QR\n\n` +
    `💡 <i>Ejemplos rápidos:</i>\n` +
    `<code>/abastecer corona 24</code> | <code>/cambiar_precio poker 4000</code>\n` +
    `<code>/recordatorios</code> | <code>/link</code> | <code>/gasto 15000 hielo</code>`;

  await sendMessageToChat(chatId, text);
}

// 1.1 Enlaces de Conexión Remota y Carta Digital
async function handleLinksCommand(chatId) {
  const storeName = (getBusinessName() || 'Mi Negocio').toUpperCase();
  const lastUrl = db.prepare("SELECT value FROM config WHERE key = 'ngrok_last_url'").get()?.value;
  if (!lastUrl) {
    return await sendMessageToChat(chatId,
      `🏪 <b>${storeName}</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ <b>El túnel remoto Ngrok no está activo en este momento.</b>\n\n` +
      `Para activarlo, ve al computador del negocio en <b>Ajustes ➔ Conexión Remota Ngrok</b> y actívalo.`
    );
  }
  return await sendMessageToChat(chatId,
    `🏪 <b>${storeName}</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 <b>Conexión Remota y Carta Digital en Línea</b>\n\n` +
    `🔐 <b>Punto de Venta Remoto (Dueño / Admin):</b>\n` +
    `👉 <code>${lastUrl}</code>\n` +
    `<i>(Protegido con tu PIN de Administrador para controlar ventas y caja a distancia)</i>\n\n` +
    `📋 <b>Carta Digital Pública (Clientes & Mesas):</b>\n` +
    `👉 <code>${lastUrl}/carta</code>\n` +
    `<i>(Acceso libre sin contraseñas para clientes y escaneo de código QR)</i>`
  );
}

// 2. Reporte de Caja en Vivo
async function handleCajaCommand(chatId) {
  const storeName = getBusinessName();
  const todayStr = getLocalTodayStr();

  try {
    const activeShift = db.prepare("SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
    
    let queryShiftClause = "";
    let params = [];
    if (activeShift) {
      queryShiftClause = "s.shift_id = ?";
      params = [activeShift.id];
    } else {
      queryShiftClause = "date(s.created_at, '-5 hours') = ?";
      params = [todayStr];
    }

    const cashSales = db.prepare(`SELECT SUM(total) as t FROM sales s WHERE s.status = 'completed' AND s.payment_status = 'paid' AND s.payment_method = 'Efectivo' AND ${queryShiftClause}`).get(...params)?.t || 0;
    const transfSales = db.prepare(`SELECT SUM(total) as t FROM sales s WHERE s.status = 'completed' AND s.payment_status = 'paid' AND s.payment_method = 'Transferencia' AND ${queryShiftClause}`).get(...params)?.t || 0;
    const debtSales = db.prepare(`SELECT SUM(total) as t FROM sales s WHERE s.status = 'completed' AND s.payment_status = 'pending' AND ${queryShiftClause}`).get(...params)?.t || 0;

    let expenses = 0;
    if (activeShift) {
      expenses = db.prepare("SELECT SUM(amount) as t FROM expenses WHERE shift_id = ?").get(activeShift.id)?.t || 0;
    } else {
      expenses = db.prepare("SELECT SUM(amount) as t FROM expenses WHERE date(created_at, '-5 hours') = ?").get(todayStr)?.t || 0;
    }

    let debtPayments = 0;
    let debtPaymentsCash = 0;
    let debtPaymentsTransf = 0;
    if (activeShift) {
      const abonosCash = db.prepare("SELECT SUM(cash_amount) as t FROM sales WHERE status = 'completed' AND payment_status = 'paid' AND payment_shift_id = ? AND payment_method = 'Efectivo'").get(activeShift.id)?.t || 0;
      const abonosTransf = db.prepare("SELECT SUM(transfer_amount) as t FROM sales WHERE status = 'completed' AND payment_status = 'paid' AND payment_shift_id = ? AND payment_method = 'Transferencia'").get(activeShift.id)?.t || 0;
      debtPaymentsCash = abonosCash;
      debtPaymentsTransf = abonosTransf;
      debtPayments = debtPaymentsCash + debtPaymentsTransf;
    } else {
      const abonos = db.prepare("SELECT SUM(total) as t FROM sales WHERE status = 'completed' AND payment_status = 'paid' AND date(paid_at, '-5 hours') = ? AND (parent_sale_id IS NOT NULL OR customer_name LIKE 'Abono:%')").get(todayStr)?.t || 0;
      debtPayments = abonos;
    }

    const baseCash = activeShift ? (activeShift.initial_cash || 0) : 0;
    const totalCashInBox = baseCash + cashSales + debtPaymentsCash - expenses;
    const totalTurnSales = cashSales + transfSales + debtSales;

    const cajeroNombre = activeShift ? activeShift.user_name : 'Sin turno abierto';
    const turnoEstado = activeShift ? `🟢 <b>Turno #${activeShift.id} Activo</b>` : '⚪ <i>No hay turno de caja abierto</i>';

    const text = 
      `📊 <b>ESTADO DE CAJA - ${storeName.toUpperCase()}</b>\n` +
      `📅 Fecha: <code>${todayStr}</code>\n` +
      `👤 Encargado: <b>${cajeroNombre}</b>\n` +
      `${turnoEstado}\n` +
      `───────────────────────────────\n` +
      (activeShift ? `💵 <b>Base Inicial en Caja:</b> $${baseCash.toLocaleString('es-CO')}\n` : '') +
      `🛒 <b>Ventas Efectivo:</b> $${cashSales.toLocaleString('es-CO')}\n` +
      `📱 <b>Ventas Transferencia:</b> $${transfSales.toLocaleString('es-CO')}\n` +
      `💳 <b>Cartera Recaudada (Abonos):</b> $${debtPayments.toLocaleString('es-CO')}\n` +
      `📝 <b>Créditos / Fiados:</b> $${debtSales.toLocaleString('es-CO')}\n` +
      `💸 <b>Gastos de Caja:</b> -$${expenses.toLocaleString('es-CO')}\n` +
      `───────────────────────────────\n` +
      `💰 <b>TOTAL EFECTIVO EN CAJÓN:</b> <b>$${Math.max(0, totalCashInBox).toLocaleString('es-CO')}</b>\n` +
      `🚀 <b>TOTAL FACTURADO:</b> <b>$${totalTurnSales.toLocaleString('es-CO')}</b>`;

    await sendMessageToChat(chatId, text);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error consultando caja: ${err.message}`);
  }
}

// 2.2 Cartera y Cuentas Pendientes (Fiados)
async function handleFiadosCommand(chatId) {
  try {
    const debts = db.prepare(`
      SELECT id, customer_name, total, date(created_at, '-5 hours') as debt_date
      FROM sales
      WHERE payment_status = 'pending' AND status != 'cancelled'
      ORDER BY total DESC, id DESC
    `).all();

    if (!debts || debts.length === 0) {
      return await sendMessageToChat(chatId, 
        `📋 <b>CARTERA Y CUENTAS POR COBRAR</b>\n\n` +
        `🎉 <b>¡Excelente! No tienes cuentas pendientes de cobro ni fiados activos.</b>`
      );
    }

    const totalCartera = debts.reduce((sum, d) => sum + (d.total || 0), 0);
    const storeName = getBusinessName();

    let msg = `📋 <b>CARTERA Y CRÉDITOS PENDIENTES - ${storeName.toUpperCase()}</b>\n`;
    msg += `👥 <b>Clientes con deuda:</b> ${debts.length} cuentas\n`;
    msg += `💰 <b>Total por Cobrar:</b> <b>$${Math.round(totalCartera).toLocaleString('es-CO')}</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    debts.slice(0, 10).forEach(d => {
      msg += `• <b>${d.customer_name || 'Cliente sin nombre'}</b> (ID #${d.id})\n` +
             `   └ Saldo pendiente: <b>$${Math.round(d.total).toLocaleString('es-CO')}</b>\n` +
             `   └ Desde: <code>${d.debt_date || 'N/A'}</code>\n` +
             `   👉 <i>Abonar:</i> <code>/abono ${d.customer_name || d.id} [monto]</code>\n\n`;
    });

    if (debts.length > 10) {
      msg += `<i>... y ${debts.length - 10} cuentas pendientes más.</i>\n\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n` +
           `💡 <i>Para registrar un cobro o abono escribe:</i>\n` +
           `<code>/abono [cliente] [monto]</code>\n` +
           `<i>Ejemplo:</i> <code>/abono Carlos 50.000</code>`;

    await sendMessageToChat(chatId, msg);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error consultando cartera: ${err.message}`);
  }
}

// 2.3 Registrar Abono o Pago de Cartera desde Telegram
async function handleAbonoCommand(chatId, args) {
  const query = (args || '').trim();
  if (!query) {
    setSession(chatId, 'WAITING_ABONO_INPUT', {});
    return await sendMessageToChat(chatId, 
      `💵 <b>REGISTRAR ABONO / PAGO DE DEUDA</b>\n\n` +
      `Ingresa el <b>nombre del cliente</b> (o ID de deuda) y el <b>monto</b> a abonar.\n\n` +
      `• <i>Ejemplo 1 (Efectivo):</i> <code>Carlos 50000</code> o <code>Carlos 50.000</code>\n` +
      `• <i>Ejemplo 2 (Transferencia / Nequi):</i> <code>Pedro 80.000 transf</code>\n\n` +
      `<i>(O escribe <code>cancelar</code>)</i>`
    );
  }

  // Parsear texto
  const tokens = query.split(/\s+/);
  if (tokens.length < 2) {
    return await sendMessageToChat(chatId, 
      `⚠️ Indica el cliente y el valor a abonar.\n<i>Ejemplo:</i> <code>/abono Carlos 50.000</code>`
    );
  }

  // Detectar medio de pago si se especificó al final
  let method = 'Efectivo';
  const lastLower = tokens[tokens.length - 1].toLowerCase();
  if (['transf', 'transferencia', 'nequi', 'daviplata', 'banco', 'tarjeta'].includes(lastLower)) {
    method = 'Transferencia';
    tokens.pop();
  }

  // El monto suele ser el último token restante
  const rawAmount = tokens[tokens.length - 1];
  const amount = parseColombianMoney(rawAmount);

  if (isNaN(amount) || amount <= 0) {
    return await sendMessageToChat(chatId, 
      `⚠️ El monto del abono debe ser un número válido mayor a cero (ej: <code>50.000</code> o <code>50000</code>).`
    );
  }

  const clientQuery = tokens.slice(0, -1).join(' ').trim();
  const normalizedClient = normalizeText(clientQuery);

  try {
    const pendingSales = db.prepare(`
      SELECT * FROM sales 
      WHERE payment_status = 'pending' AND status != 'cancelled'
    `).all();

    let matches = pendingSales.filter(s => {
      if (String(s.id) === clientQuery) return true;
      return normalizeText(s.customer_name).includes(normalizedClient);
    });

    if (matches.length === 0) {
      return await sendMessageToChat(chatId, 
        `🔍 No se encontró ninguna cuenta pendiente para <b>"${clientQuery}"</b>.\n` +
        `Usa <code>/fiados</code> para ver los clientes con deuda activa.`
      );
    }

    if (matches.length > 1) {
      const exact = matches.find(s => normalizeText(s.customer_name) === normalizedClient);
      if (!exact) {
        let list = matches.slice(0, 5).map(s => `• <code>/abono ${s.id} ${amount}</code> (${s.customer_name}: $${Math.round(s.total).toLocaleString('es-CO')})`).join('\n');
        return await sendMessageToChat(chatId, 
          `⚠️ Se encontraron varias cuentas para "${clientQuery}". Usa el ID específico:\n\n${list}`
        );
      }
      matches[0] = exact;
    }

    const sale = matches[0];
    const payAmount = Math.min(amount, sale.total);
    const activeShift = db.prepare("SELECT id, user_name FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
    const targetShiftId = activeShift ? activeShift.id : null;

    const cashAmount = method === 'Efectivo' ? payAmount : null;
    const transferAmount = method === 'Transferencia' ? payAmount : null;

    db.exec('BEGIN TRANSACTION');

    if (payAmount < sale.total) {
      // Abono parcial
      db.prepare(`
        INSERT INTO sales (total, cost_total, payment_method, payment_status, status, customer_name, shift_id, cash_amount, transfer_amount, paid_at, parent_sale_id)
        VALUES (?, 0, ?, 'paid', 'completed', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).run(payAmount, method, `Abono: ${sale.customer_name}`, targetShiftId, cashAmount, transferAmount, sale.id);

      db.prepare('UPDATE sales SET total = total - ? WHERE id = ?').run(payAmount, sale.id);
      db.exec('COMMIT');

      const remaining = sale.total - payAmount;
      notifyRealtime('SALE_PAID', { id: sale.id, amount: payAmount, remaining }, `💵 Abono de $${payAmount.toLocaleString('es-CO')} recibido para ${sale.customer_name}`);

      const text = 
        `💵✅ <b>ABONO REGISTRADO CON ÉXITO</b>\n\n` +
        `• <b>Cliente:</b> <b>${sale.customer_name}</b> (Deuda #${sale.id})\n` +
        `• <b>Monto Abonado:</b> <b>$${payAmount.toLocaleString('es-CO')}</b>\n` +
        `• <b>Medio de Pago:</b> ${method}\n` +
        (activeShift ? `• <b>Turno Asignado:</b> Turno #${activeShift.id} (${activeShift.user_name})\n` : `• <i>Sin turno de caja abierto</i>\n`) +
        `• <b>Saldo Restante:</b> <b>$${remaining.toLocaleString('es-CO')}</b>\n\n` +
        `🚀 Actualizado al instante en el punto de venta.`;

      await sendMessageToChat(chatId, text);
    } else {
      // Liquidación total
      db.prepare(`
        UPDATE sales
        SET payment_status = 'paid', payment_method = ?, payment_shift_id = ?, cash_amount = ?, transfer_amount = ?, paid_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(method, targetShiftId, cashAmount, transferAmount, sale.id);
      db.exec('COMMIT');

      notifyRealtime('SALE_PAID', { id: sale.id, amount: payAmount, remaining: 0 }, `🎉 Deuda #${sale.id} de ${sale.customer_name} pagada en su totalidad`);

      const text = 
        `🎉✅ <b>DEUDA SALDADA AL 100%</b>\n\n` +
        `• <b>Cliente:</b> <b>${sale.customer_name}</b>\n` +
        `• <b>Monto Liquidado:</b> <b>$${payAmount.toLocaleString('es-CO')}</b>\n` +
        `• <b>Medio de Pago:</b> ${method}\n` +
        (activeShift ? `• <b>Turno Asignado:</b> Turno #${activeShift.id} (${activeShift.user_name})\n` : `• <i>Sin turno de caja abierto</i>\n`) +
        `• <b>Estado:</b> 🟢 Paz y Salvo (Totalmente pagada)\n\n` +
        `🚀 Sincronizado en la caja de inmediato.`;

      await sendMessageToChat(chatId, text);
    }
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) {}
    await sendMessageToChat(chatId, `❌ Error al registrar abono: ${err.message}`);
  }
}

// 2.4 Reporte Mensual Consolidado (Ventas, Costos, Gastos, Utilidad Neta)
async function handleReporteMesCommand(chatId) {
  try {
    const storeName = getBusinessName();
    const currentMonth = db.prepare("SELECT strftime('%Y-%m', date('now', '-5 hours')) as m").get()?.m || '';

    // Ventas del mes (completadas)
    const salesRow = db.prepare(`
      SELECT 
        COUNT(id) as total_tx,
        COALESCE(SUM(total), 0) as total_ventas,
        COALESCE(SUM(cost_total), 0) as total_costos,
        COALESCE(SUM(cash_amount), 0) as total_efectivo,
        COALESCE(SUM(transfer_amount), 0) as total_transf
      FROM sales
      WHERE status = 'completed' AND payment_status = 'paid' AND strftime('%Y-%m', date(created_at, '-5 hours')) = ?
    `).get(currentMonth);

    // Gastos del mes
    const expensesRow = db.prepare(`
      SELECT 
        COUNT(id) as total_gastos_count,
        COALESCE(SUM(amount), 0) as total_gastos
      FROM expenses
      WHERE strftime('%Y-%m', date(created_at, '-5 hours')) = ?
    `).get(currentMonth);

    const totalVentas = salesRow?.total_ventas || 0;
    const totalCostos = salesRow?.total_costos || 0;
    const totalGastos = expensesRow?.total_gastos || 0;
    const gananciaBruta = totalVentas - totalCostos;
    const gananciaNeta = gananciaBruta - totalGastos;
    const margenNeto = totalVentas > 0 ? ((gananciaNeta / totalVentas) * 100).toFixed(1) : '0';

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const monthNum = parseInt(currentMonth.split('-')[1], 10) - 1;
    const monthLabel = `${monthNames[monthNum] || 'Mes Actual'} ${currentMonth.split('-')[0]}`;

    const text = 
      `📈 <b>REPORTE MENSUAL EJECUTIVO - ${storeName.toUpperCase()}</b>\n` +
      `📅 Periodo: <b>${monthLabel}</b> (Acumulado al mes)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🛒 <b>Facturación Bruta:</b> <b>$${Math.round(totalVentas).toLocaleString('es-CO')}</b>\n` +
      `   ├ 💵 En Efectivo: $${Math.round(salesRow?.total_efectivo || 0).toLocaleString('es-CO')}\n` +
      `   └ 📱 Transferencias: $${Math.round(salesRow?.total_transf || 0).toLocaleString('es-CO')}\n` +
      `📦 <b>Costo de Mercancía:</b> -$${Math.round(totalCostos).toLocaleString('es-CO')}\n` +
      `───────────────────────\n` +
      `📊 <b>Utilidad Bruta:</b> <b>$${Math.round(gananciaBruta).toLocaleString('es-CO')}</b>\n` +
      `💸 <b>Gastos Operativos:</b> -$${Math.round(totalGastos).toLocaleString('es-CO')} (${expensesRow?.total_gastos_count || 0} registros)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💎 <b>UTILIDAD NETA REAL:</b> <b>$${Math.round(gananciaNeta).toLocaleString('es-CO')}</b>\n` +
      `🎯 <b>Margen Neto Real:</b> <b>${margenNeto}%</b>\n` +
      `🔢 <b>Transacciones Realizadas:</b> ${salesRow?.total_tx || 0} ventas\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ <i>Cálculo contable automatizado en base a datos reales.</i>`;

    await sendMessageToChat(chatId, text);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error generando reporte mensual: ${err.message}`);
  }
}

// 3. Top Productos Más Vendidos
async function handleTopCommand(chatId) {
  const todayStr = getLocalTodayStr();
  try {
    const top = db.prepare(`
      SELECT p.name, SUM(si.quantity) as qty, SUM(si.price * si.quantity) as total
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'completed' AND date(s.created_at, '-5 hours') = ?
      GROUP BY p.id
      ORDER BY qty DESC
      LIMIT 5
    `).all(todayStr);

    if (!top || top.length === 0) {
      return await sendMessageToChat(chatId, `ℹ️ Aún no hay ventas registradas el día de hoy (<code>${todayStr}</code>).`);
    }

    let msg = `🔥 <b>TOP 5 MÁS VENDIDOS DE HOY (${todayStr}):</b>\n\n`;
    top.forEach((p, idx) => {
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      msg += `${medals[idx] || '•'} <b>${p.name}</b>\n`;
      msg += `   └ Cantidad: <b>${p.qty} unds</b> | Total: <b>$${Math.round(p.total).toLocaleString('es-CO')}</b>\n`;
    });

    await sendMessageToChat(chatId, msg);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al consultar top productos: ${err.message}`);
  }
}

// 4. Productos Agotados o Stock Bajo
async function handleAgotadosCommand(chatId) {
  try {
    const products = db.prepare("SELECT name, stock, min_stock FROM products WHERE stock <= min_stock ORDER BY stock ASC, name ASC").all();

    if (!products || products.length === 0) {
      return await sendMessageToChat(chatId, '✅ <b>¡Todo en orden!</b> No tienes productos agotados ni en stock crítico en este momento.');
    }

    const agotados = products.filter(p => p.stock <= 0);
    const stockBajo = products.filter(p => p.stock > 0);

    let msg = `⚠️ <b>CONTROL DE EXISTENCIAS CRÍTICAS</b>\n`;
    msg += `───────────────────────────────\n`;

    if (agotados.length > 0) {
      msg += `🔴 <b>PRODUCTOS AGOTADOS (${agotados.length}):</b>\n`;
      agotados.slice(0, 15).forEach(p => {
        msg += `• <b>${p.name}</b>: <code>0 unds</code> (Mín: ${p.min_stock})\n`;
      });
      if (agotados.length > 15) {
        msg += `<i>... y ${agotados.length - 15} agotados más.</i>\n`;
      }
      msg += `\n`;
    }

    if (stockBajo.length > 0) {
      msg += `🟠 <b>STOCK BAJO / POR AGOTARSE (${stockBajo.length}):</b>\n`;
      stockBajo.slice(0, 15).forEach(p => {
        msg += `• <b>${p.name}</b>: <b>${p.stock} unds</b> (Mín: ${p.min_stock})\n`;
      });
      if (stockBajo.length > 15) {
        msg += `<i>... y ${stockBajo.length - 15} más con stock bajo.</i>\n`;
      }
      msg += `\n`;
    }

    msg += `───────────────────────────────\n`;
    msg += `💡 <i>Para reabastecer cualquiera, solo escribe:</i>\n<code>/abastecer [producto] [cantidad]</code>`;

    await sendMessageToChat(chatId, msg);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error consultando agotados: ${err.message}`);
  }
}

// 5. Registrar Gasto
async function handleGastoCommand(chatId, args) {
  if (!args || args.trim() === '') {
    setSession(chatId, 'WAITING_GASTO_AMOUNT', {});
    return await sendMessageToChat(chatId, 
      `💸 <b>REGISTRAR SALIDA DE DINERO (GASTO)</b>\n\n` +
      `¿Cuánto dinero salió de caja?\n` +
      `Ingresa el valor numérico (ej: <code>15000</code> o <code>25.000</code>):\n\n` +
      `<i>(O escribe <code>cancelar</code> para anular)</i>`
    );
  }

  const match = args.match(/^(\$?\s*[\d\.,]+)\s+(.+)$/);
  if (!match) {
    return await sendMessageToChat(chatId, '⚠️ <b>Formato incorrecto.</b> Debes indicar primero el monto y luego la descripción.\n\n<i>Ejemplo:</i> <code>/gasto 25.000 Bolsas y hielo</code>');
  }

  const amount = parseColombianMoney(match[1]);
  const description = match[2].trim();

  if (isNaN(amount) || amount <= 0) {
    return await sendMessageToChat(chatId, '⚠️ El monto del gasto debe ser un número mayor a cero (ej: <code>15000</code> o <code>15.000</code>).');
  }

  try {
    const activeShift = db.prepare("SELECT id, user_name FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
    const shiftId = activeShift ? activeShift.id : null;

    db.prepare("INSERT INTO expenses (description, amount, shift_id, payment_method) VALUES (?, ?, ?, 'Efectivo')").run(description, amount, shiftId);
    notifyRealtime('EXPENSE_CREATED', {
      description,
      amount,
      shift_id: shiftId
    }, `📲 Gasto de ${Number(amount).toLocaleString('es-CO')} (${description}) registrado desde Telegram`);

    const shiftNotice = activeShift 
      ? `Asignado al <b>Turno #${activeShift.id} (${activeShift.user_name})</b>.` 
      : `<i>Registrado sin turno abierto asignado.</i>`;

    const text = 
      `💸 <b>GASTO REGISTRADO CON ÉXITO</b>\n\n` +
      `• <b>Monto:</b> ${amount.toLocaleString('es-CO')}\n` +
      `• <b>Concepto:</b> ${description}\n` +
      `• ${shiftNotice}\n\n` +
      `✅ Descontado del balance de caja automáticamente.`;

    await sendMessageToChat(chatId, text);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al registrar gasto: ${err.message}`);
  }
}

async function handleGastoAmountStep(chatId, text) {
  const amount = parseColombianMoney(text);
  if (isNaN(amount) || amount <= 0) {
    return await sendMessageToChat(chatId, '⚠️ Por favor ingresa un monto numérico válido mayor a cero (ej: <code>15000</code> o <code>25.000</code>):');
  }

  setSession(chatId, 'WAITING_GASTO_CONCEPT', { amount });
  await sendMessageToChat(chatId, 
    `💸 Monto registrado: <b>${amount.toLocaleString('es-CO')}</b>\n\n` +
    `Ahora escribe el <b>motivo o concepto</b> del gasto (ej: <i>Bolsas y hielo, Domicilio, etc.</i>):\n` +
    `<i>(O escribe <code>cancelar</code>)</i>`
  );
}

async function handleGastoConceptStep(chatId, text) {
  const session = userSessions.get(chatId);
  const amount = session?.data?.amount || 0;
  const description = (text || '').trim();

  if (!description || description.length < 2) {
    return await sendMessageToChat(chatId, '⚠️ Por favor escribe una breve descripción del gasto:');
  }

  clearSession(chatId);

  try {
    const activeShift = db.prepare("SELECT id, user_name FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
    const shiftId = activeShift ? activeShift.id : null;

    db.prepare("INSERT INTO expenses (description, amount, shift_id, payment_method) VALUES (?, ?, ?, 'Efectivo')").run(description, amount, shiftId);
    notifyRealtime('EXPENSE_CREATED', {
      description,
      amount,
      shift_id: shiftId
    }, `📲 Gasto de ${Number(amount).toLocaleString('es-CO')} (${description}) registrado desde Telegram`);

    const shiftNotice = activeShift 
      ? `Asignado al <b>Turno #${activeShift.id} (${activeShift.user_name})</b>.` 
      : `<i>Registrado sin turno abierto asignado.</i>`;

    const responseText = 
      `💸 <b>GASTO REGISTRADO CON ÉXITO</b>\n\n` +
      `• <b>Monto:</b> ${amount.toLocaleString('es-CO')}\n` +
      `• <b>Concepto:</b> ${description}\n` +
      `• ${shiftNotice}\n\n` +
      `✅ Descontado del balance de caja automáticamente.`;

    await sendMessageToChat(chatId, responseText);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al registrar gasto: ${err.message}`);
  }
}

// 5.1 Registro y Procesamiento de Facturas / Comprobantes con Foto
async function handleFacturaCommand(chatId) {
  setSession(chatId, 'WAITING_RECEIPT_PHOTO', {});
  await sendMessageToChat(chatId, 
    `🧾 <b>REGISTRO DE FACTURA / COMPROBANTE DE GASTO</b>\n\n` +
    `Envía ahora una <b>foto nítida</b> del recibo, ticket o cuenta de cobro tomada con tu cámara o desde tu galería:\n\n` +
    `<i>(O escribe <code>cancelar</code> para anular)</i>`
  );
}

async function handleReceiptPhotoStep(chatId, message) {
  if (!message.photo || message.photo.length === 0) {
    return await sendMessageToChat(chatId, '📸 Por favor envía una <b>foto</b> de la factura o comprobante (o escribe <code>cancelar</code>):');
  }

  const bestPhoto = message.photo[message.photo.length - 1];
  await sendMessageToChat(chatId, '⏳ <i>Descargando y analizando comprobante con IA...</i>');
  const tempPath = await downloadReceiptPhoto(bestPhoto.file_id);

  if (!tempPath) {
    clearSession(chatId);
    return await sendMessageToChat(chatId, '❌ No se pudo descargar la foto de Telegram. Inténtalo de nuevo o escribe cancelar.');
  }

  // Intentar lectura inteligente con Visión IA (si está configurada)
  const aiResult = await analyzeReceiptWithGemini(tempPath);

  if (aiResult && aiResult.total > 0) {
    const detectedConcept = aiResult.concept || aiResult.merchant || 'Gasto operativo';
    setSession(chatId, 'WAITING_RECEIPT_CONFIRM', {
      tempPath,
      amount: aiResult.total,
      description: detectedConcept,
      merchant: aiResult.merchant || 'Comercio / Proveedor',
      nit: aiResult.nit || null,
      invoice_number: aiResult.invoice_number || null,
      payment_method: aiResult.payment_method || null,
      date: aiResult.date || getLocalTodayStr()
    });

    let extraDetails = '';
    if (aiResult.nit) extraDetails += `🆔 <b>NIT / ID:</b> ${aiResult.nit}\n`;
    if (aiResult.invoice_number) extraDetails += `📄 <b>Factura N°:</b> ${aiResult.invoice_number}\n`;
    if (aiResult.date) extraDetails += `📅 <b>Fecha comprobante:</b> ${aiResult.date}\n`;
    if (aiResult.items_summary) extraDetails += `🛒 <b>Detalle items:</b> ${aiResult.items_summary}\n`;
    if (aiResult.payment_method) extraDetails += `💳 <b>Método detectado:</b> ${aiResult.payment_method}\n`;

    const previewMsg = 
      `🧾 <b>FACTURA AUDITADA CON ÉXITO</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 <b>Comercio:</b> <b>${aiResult.merchant || 'Detectado en comprobante'}</b>\n` +
      extraDetails +
      `📝 <b>Concepto a registrar:</b> ${detectedConcept}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 <b>TOTAL DETECTADO:</b> <b>${aiResult.total.toLocaleString('es-CO')}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<i>¿Confirmas asentar este gasto en caja y archivar el comprobante?</i>`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: `✅ Registrar ${aiResult.total.toLocaleString('es-CO')} en Caja`, callback_data: 'rcpt_confirm' }
        ],
        [
          { text: '✏️ Modificar Monto', callback_data: 'rcpt_edit_amt' },
          { text: '📝 Modificar Concepto', callback_data: 'rcpt_edit_concept' }
        ],
        [
          { text: '❌ Descartar Comprobante', callback_data: 'rcpt_cancel' }
        ]
      ]
    };

    return await telegramApiRequest('sendMessage', {
      chat_id: chatId,
      text: previewMsg,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    });
  }

  // Fallback Indestructible si la IA no está disponible o el total no es legible
  setSession(chatId, 'WAITING_RECEIPT_MANUAL_AMOUNT', { tempPath });
  await sendMessageToChat(chatId, 
    `🧾 <b>FOTO DE FACTURA RECIBIDA</b>\n\n` +
    `La imagen ha sido descargada y guardada en el sistema.\n` +
    `👉 ¿De cuánto fue el <b>monto total</b> de este gasto? (ej: <code>13500</code> o <code>13.500</code>):\n\n` +
    `<i>(O escribe <code>cancelar</code>)</i>`
  );
}

async function handleReceiptManualAmountStep(chatId, text) {
  const amount = parseColombianMoney(text);
  if (isNaN(amount) || amount <= 0) {
    return await sendMessageToChat(chatId, '⚠️ Por favor ingresa un monto numérico válido mayor a cero (ej: <code>13500</code> o <code>13.500</code>):');
  }

  const session = userSessions.get(chatId);
  session.data.amount = amount;
  setSession(chatId, 'WAITING_RECEIPT_MANUAL_CONCEPT', session.data);

  await sendMessageToChat(chatId, 
    `💸 Monto: <b>${amount.toLocaleString('es-CO')}</b>\n\n` +
    `¿Cuál es el <b>motivo o concepto</b> del gasto? (ej: <i>Bolsas y hielo, Domicilio, Factura luz</i>):\n` +
    `<i>(O escribe <code>cancelar</code>)</i>`
  );
}

async function handleReceiptManualConceptStep(chatId, text) {
  const description = (text || '').trim();
  if (!description || description.length < 2) {
    return await sendMessageToChat(chatId, '⚠️ Por favor escribe una breve descripción del gasto:');
  }

  const session = userSessions.get(chatId);
  const { tempPath, amount } = session.data;

  await finalizeReceiptExpense(chatId, { tempPath, amount, description });
}

async function finalizeReceiptExpense(chatId, sessionData) {
  try {
    const { tempPath, amount, description, merchant, nit, invoice_number, payment_method, date } = sessionData;
    const activeShift = db.prepare("SELECT id, user_name, initial_cash FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
    const shiftId = activeShift ? activeShift.id : null;

    let cleanDesc = description || 'Gasto operativo';
    if (merchant && merchant !== 'Comercio / Proveedor' && !cleanDesc.toLowerCase().includes(merchant.toLowerCase())) {
      cleanDesc = `${cleanDesc} (${merchant})`;
    }

    let recognizedMethod = 'Efectivo';
    if (payment_method && (payment_method.toLowerCase().includes('transf') || payment_method.toLowerCase().includes('nequi') || payment_method.toLowerCase().includes('tarj') || payment_method.toLowerCase().includes('banc'))) {
      recognizedMethod = 'Transferencia';
    } else if (payment_method && (payment_method.toLowerCase().includes('dueño') || payment_method.toLowerCase().includes('propio') || payment_method.toLowerCase().includes('personal'))) {
      recognizedMethod = 'Bolsillo Dueño';
    }

    const info = db.prepare('INSERT INTO expenses (description, amount, shift_id, receipt_image, payment_method) VALUES (?, ?, ?, ?, ?)').run(
      cleanDesc,
      amount,
      shiftId,
      null,
      recognizedMethod
    );

    const expenseId = info.lastInsertRowid;
    const finalFilename = formatReceiptFilename(expenseId, merchant || cleanDesc, amount);
    const finalFilePath = path.join(receiptsDir, finalFilename);

    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.renameSync(tempPath, finalFilePath);
      } catch (err) {
        fs.copyFileSync(tempPath, finalFilePath);
        fs.unlinkSync(tempPath);
      }
    }

    const publicUrl = `/api/facturas/${finalFilename}`;
    db.prepare('UPDATE expenses SET receipt_image = ? WHERE id = ?').run(publicUrl, expenseId);
    notifyRealtime('EXPENSE_CREATED', {
      id: expenseId,
      description: cleanDesc,
      amount: amount,
      receipt_image: publicUrl
    }, `📲 Gasto de ${Number(amount).toLocaleString('es-CO')} (${merchant || cleanDesc}) confirmado desde Telegram`);

    // Calcular balance de caja en vivo
    let cashInBoxStr = '';
    try {
      let baseCash = 0;
      let cashSales = 0;
      let expensesTotal = 0;

      if (activeShift) {
        baseCash = activeShift.initial_cash || 0;
        const salesRow = db.prepare("SELECT COALESCE(SUM(cash_amount), 0) as total FROM sales WHERE (shift_id = ? OR payment_shift_id = ?) AND status != 'cancelled'").get(shiftId, shiftId);
        cashSales = salesRow ? salesRow.total : 0;
        const expRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE shift_id = ? AND (payment_method = 'Efectivo' OR payment_method IS NULL)").get(shiftId);
        expensesTotal = expRow ? expRow.total : 0;
      } else {
        const todayStr = getLocalTodayStr();
        const salesRow = db.prepare("SELECT COALESCE(SUM(cash_amount), 0) as total FROM sales WHERE date(created_at, '-5 hours') = ? AND status != 'cancelled'").get(todayStr);
        cashSales = salesRow ? salesRow.total : 0;
        const expRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date(created_at, '-5 hours') = ? AND (payment_method = 'Efectivo' OR payment_method IS NULL)").get(todayStr);
        expensesTotal = expRow ? expRow.total : 0;
      }

      const totalCashInBox = Math.max(0, baseCash + cashSales - expensesTotal);
      cashInBoxStr = `\n💰 <b>Efectivo Disponible en Caja:</b> <b>$${totalCashInBox.toLocaleString('es-CO')}</b>`;
    } catch (e) {}

    const shiftNotice = activeShift 
      ? `👤 <b>Turno Activo:</b> Turno #${activeShift.id} (${activeShift.user_name})` 
      : `👤 <b>Turno:</b> <i>Sin turno de caja abierto</i>`;

    let metaInfo = '';
    if (merchant) metaInfo += `🏢 <b>Proveedor:</b> ${merchant}${nit ? ` (NIT: ${nit})` : ''}\n`;
    if (invoice_number) metaInfo += `📄 <b>Factura N°:</b> ${invoice_number}\n`;

    const text = 
      `💸 <b>GASTO ASENTADO EN CAJA CON ÉXITO</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔢 <b>N° Operación:</b> Gasto #${expenseId}\n` +
      metaInfo +
      `📝 <b>Concepto:</b> ${cleanDesc}\n` +
      `💵 <b>Monto Descontado:</b> <b>${amount.toLocaleString('es-CO')}</b>\n` +
      `${shiftNotice}\n` +
      `📁 <b>Comprobante:</b> <code>${finalFilename}</code>\n` +
      `───────────────────────` +
      `${cashInBoxStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ <i>Comprobante archivado en la auditoría contable.</i>\n\n` +
      `💡 <i>Para ver la foto del comprobante en cualquier momento escribe:</i>\n<code>/ver_factura ${expenseId}</code>`;

    clearSession(chatId);
    await sendMessageToChat(chatId, text);
    console.log(`[Telegram Bot] ✅ Gasto #${expenseId} registrado con comprobante ${finalFilename}. Monto: ${amount}`);
  } catch (err) {
    console.error('[Telegram Bot] Error registrando gasto de comprobante:', err.message);
    await sendMessageToChat(chatId, `❌ Error al registrar comprobante: ${err.message}`);
  }
}

// 5.2 Búsqueda de Gastos Históricos
async function handleBuscarGastoCommand(chatId, query) {
  const cleanQuery = (query || '').trim();
  try {
    let expenses = [];
    if (cleanQuery) {
      const normalizedQuery = `%${cleanQuery}%`;
      expenses = db.prepare(`
        SELECT id, description, amount, created_at, receipt_image 
        FROM expenses 
        WHERE description LIKE ? OR date(created_at, '-5 hours') LIKE ?
        ORDER BY id DESC LIMIT 8
      `).all(normalizedQuery, normalizedQuery);
    } else {
      expenses = db.prepare(`
        SELECT id, description, amount, created_at, receipt_image 
        FROM expenses 
        ORDER BY id DESC LIMIT 8
      `).all();
    }

    if (expenses.length === 0) {
      return await sendMessageToChat(chatId, `🔍 No se encontraron registros de gastos para <b>"${cleanQuery}"</b>.`);
    }

    let text = cleanQuery 
      ? `🔎 <b>GASTOS ENCONTRADOS PARA "${cleanQuery}":</b>\n\n` 
      : `🔎 <b>ÚLTIMOS GASTOS REGISTRADOS:</b>\n\n`;

    expenses.forEach(e => {
      const hasReceipt = e.receipt_image ? '🧾 Foto disponible' : '⚪ Sin foto';
      const dateOnly = e.created_at ? e.created_at.split(' ')[0] : '';
      text += `• <b>Gasto #${e.id}</b> | ${dateOnly} | <b>${Number(e.amount).toLocaleString('es-CO')}</b>\n`;
      text += `   └ Concepto: <i>${e.description}</i>\n`;
      text += `   └ Comprobante: ${hasReceipt}`;
      if (e.receipt_image) {
        text += ` (Ver: <code>/ver_factura ${e.id}</code>)`;
      }
      text += `\n\n`;
    });

    text += `💡 <i>Toca cualquier comando <code>/ver_factura [ID]</code> para recibir la foto del comprobante aquí mismo.</i>`;
    await sendMessageToChat(chatId, text);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error consultando gastos: ${err.message}`);
  }
}

// 5.3 Enviar Comprobante / Foto de Factura a Telegram
async function handleVerFacturaCommand(chatId, args) {
  const expenseId = parseInt((args || '').trim().replace(/[^0-9]/g, ''), 10);
  if (isNaN(expenseId) || expenseId <= 0) {
    return await sendMessageToChat(chatId, 'ℹ️ <b>Uso de Consulta de Factura:</b>\n<code>/ver_factura [ID del gasto]</code>\n\n<i>Ejemplo:</i> <code>/ver_factura 42</code>');
  }

  try {
    const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(expenseId);
    if (!expense) {
      return await sendMessageToChat(chatId, `🔍 No se encontró ningún gasto con el ID #${expenseId}.`);
    }

    if (!expense.receipt_image) {
      return await sendMessageToChat(chatId, `ℹ️ El <b>Gasto #${expenseId} (${expense.description})</b> fue registrado sin foto de factura.`);
    }

    const filename = path.basename(expense.receipt_image);
    let filePath = path.join(receiptsDir, filename);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(uploadsDir, filename);
    }

    if (!fs.existsSync(filePath)) {
      return await sendMessageToChat(chatId, `⚠️ No se encontró el archivo físico en el servidor (Archivo: <code>${filename}</code>).`);
    }

    await sendMessageToChat(chatId, '⏳ <i>Enviando foto del comprobante...</i>');
    const caption = 
      `🧾 <b>COMPROBANTE DE GASTO #${expense.id}</b>\n\n` +
      `• <b>Concepto:</b> ${expense.description}\n` +
      `• <b>Monto:</b> ${Number(expense.amount).toLocaleString('es-CO')}\n` +
      `• <b>Fecha:</b> ${expense.created_at}\n` +
      `• <b>Archivo:</b> <code>${filename}</code>`;

    const sent = await sendTelegramPhoto(filePath, caption, chatId);
    if (!sent) {
      await sendMessageToChat(chatId, '❌ Hubo un inconveniente al enviar la foto por Telegram.');
    }
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al consultar comprobante: ${err.message}`);
  }
}

// 6. Abastecer / Entrada de Stock (+)
async function handleAbastecerCommand(chatId, args) {
  if (!args || args.trim() === '') {
    setSession(chatId, 'WAITING_ABASTECER_INPUT', {});
    return await sendMessageToChat(chatId, 
      `📦 <b>ABASTECER INVENTARIO (+)</b>\n\n` +
      `Ingresa el <b>nombre del producto</b> y la <b>cantidad</b> a sumar.\n\n` +
      `<i>Ejemplo:</i> <code>corona 24</code> o <code>pilsen 12</code>\n` +
      `<i>(O escribe <code>cancelar</code>)</i>`
    );
  }

  const parts = args.trim().split(/\s+/);
  if (parts.length < 2) {
    return await sendMessageToChat(chatId, '⚠️ Indica el nombre del producto y la cantidad a sumar.\n<i>Ejemplo:</i> <code>/abastecer pilsen 24</code>');
  }

  const lastToken = parts[parts.length - 1];
  const qty = parseFloat(lastToken.replace(/^\+/, ''));

  // Si el usuario puso una cantidad negativa (ej: /stock corona -6), redirigir a salida
  if (qty < 0) {
    return await handleQuitarStockCommand(chatId, args);
  }

  if (isNaN(qty) || qty <= 0) {
    return await sendMessageToChat(chatId, '⚠️ La cantidad a sumar debe ser un número válido al final del comando.\n<i>Ejemplo:</i> <code>/abastecer corona 24</code>');
  }

  const querySearch = parts.slice(0, -1).join(' ');
  const normalizedQuery = normalizeText(querySearch);

  try {
    const allProducts = db.prepare("SELECT id, name, stock FROM products").all();
    const matches = allProducts.filter(p => normalizeText(p.name).includes(normalizedQuery));

    if (matches.length === 0) {
      return await sendMessageToChat(chatId, `🔍 No se encontró ningún producto similar a <b>"${querySearch}"</b>.`);
    }

    if (matches.length > 1) {
      const exact = matches.find(p => normalizeText(p.name) === normalizedQuery);
      if (!exact) {
        let list = matches.slice(0, 5).map(p => `• <code>/abastecer ${p.name} ${qty}</code> (Actual: ${p.stock} unds)`).join('\n');
        return await sendMessageToChat(chatId, `⚠️ Se encontraron varios productos similares a "${querySearch}". Sé más específico:\n\n${list}`);
      }
      matches[0] = exact;
    }

    const product = matches[0];
    const oldStock = product.stock || 0;
    const newStock = oldStock + qty;
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, product.id);
    notifyRealtime('PRODUCT_UPDATED', {
      id: product.id,
      name: product.name,
      stock: newStock
    }, `📦 Stock de "${product.name}" actualizado desde Telegram: ${newStock} u.`);

    const text = 
      `📦 <b>MERCANCÍA INGRESADA CON ÉXITO</b>\n\n` +
      `• Producto: <b>${product.name}</b>\n` +
      `• Entrada: <b>+${qty} unidades</b>\n` +
      `• Stock anterior: ${oldStock} unds\n` +
      `• <b>Nuevo Stock Total:</b> <b>${newStock} unidades</b>\n\n` +
      `✅ Ya disponible en caja.`;

    await sendMessageToChat(chatId, text);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al abastecer stock: ${err.message}`);
  }
}

// 6.1 Quitar / Restar Stock por Merma o Salida (-)
async function handleQuitarStockCommand(chatId, args) {
  if (!args || args.trim() === '') {
    setSession(chatId, 'WAITING_QUITAR_INPUT', {});
    return await sendMessageToChat(chatId, 
      `📦 <b>SALIDA / MERMA DE STOCK (-)</b>\n\n` +
      `Ingresa el <b>nombre del producto</b> y la <b>cantidad</b> a restar.\n\n` +
      `<i>Ejemplo:</i> <code>corona 6</code> o <code>pilsen 2</code>\n` +
      `<i>(O escribe <code>cancelar</code>)</i>`
    );
  }

  const parts = args.trim().split(/\s+/);
  if (parts.length < 2) {
    return await sendMessageToChat(chatId, '⚠️ Indica el nombre del producto y la cantidad a restar.\n<i>Ejemplo:</i> <code>/quitar pilsen 2</code>');
  }

  const lastToken = parts[parts.length - 1];
  const qty = Math.abs(parseFloat(lastToken));

  if (isNaN(qty) || qty <= 0) {
    return await sendMessageToChat(chatId, '⚠️ La cantidad a restar debe ser un número válido al final del comando.\n<i>Ejemplo:</i> <code>/quitar corona 4</code>');
  }

  const querySearch = parts.slice(0, -1).join(' ');
  const normalizedQuery = normalizeText(querySearch);

  try {
    const allProducts = db.prepare("SELECT id, name, stock FROM products").all();
    const matches = allProducts.filter(p => normalizeText(p.name).includes(normalizedQuery));

    if (matches.length === 0) {
      return await sendMessageToChat(chatId, `🔍 No se encontró ningún producto similar a <b>"${querySearch}"</b>.`);
    }

    if (matches.length > 1) {
      const exact = matches.find(p => normalizeText(p.name) === normalizedQuery);
      if (!exact) {
        let list = matches.slice(0, 5).map(p => `• <code>/quitar ${p.name} ${qty}</code> (Actual: ${p.stock} unds)`).join('\n');
        return await sendMessageToChat(chatId, `⚠️ Se encontraron varios productos similares a "${querySearch}". Sé más específico:\n\n${list}`);
      }
      matches[0] = exact;
    }

    const product = matches[0];
    const oldStock = product.stock || 0;
    const newStock = Math.max(0, oldStock - qty);
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, product.id);
    notifyRealtime('PRODUCT_UPDATED', {
      id: product.id,
      name: product.name,
      stock: newStock
    }, `🔻 Stock de "${product.name}" reducido desde Telegram: ${newStock} u.`);

    const text = 
      `🔻 <b>SALIDA DE STOCK REGISTRADA</b>\n\n` +
      `• Producto: <b>${product.name}</b>\n` +
      `• Salida / Merma: <b>-${qty} unidades</b>\n` +
      `• Stock anterior: ${oldStock} unds\n` +
      `• <b>Nuevo Stock Total:</b> <b>${newStock} unidades</b>\n\n` +
      `⚠️ Descontado del punto de venta.`;

    await sendMessageToChat(chatId, text);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al reducir stock: ${err.message}`);
  }
}

// 6.2 Ajustar / Fijar Stock Físico Exacto
async function handleAjustarStockCommand(chatId, args) {
  if (!args || args.trim() === '') {
    setSession(chatId, 'WAITING_AJUSTAR_INPUT', {});
    return await sendMessageToChat(chatId, 
      `📦 <b>AJUSTE DE STOCK FÍSICO REAL</b>\n\n` +
      `Ingresa el <b>nombre del producto</b> y el <b>total de unidades físicas exactas</b>.\n\n` +
      `<i>Ejemplo:</i> <code>corona 30</code>\n` +
      `<i>(O escribe <code>cancelar</code>)</i>`
    );
  }

  const parts = args.trim().split(/\s+/);
  if (parts.length < 2) {
    return await sendMessageToChat(chatId, '⚠️ Indica el nombre del producto y la cantidad física exacta.\n<i>Ejemplo:</i> <code>/ajustar_stock pilsen 40</code>');
  }

  const lastToken = parts[parts.length - 1];
  const exactStock = parseFloat(lastToken);

  if (isNaN(exactStock) || exactStock < 0) {
    return await sendMessageToChat(chatId, '⚠️ El stock debe ser un número válido mayor o igual a cero.\n<i>Ejemplo:</i> <code>/ajustar_stock corona 25</code>');
  }

  const querySearch = parts.slice(0, -1).join(' ');
  const normalizedQuery = normalizeText(querySearch);

  try {
    const allProducts = db.prepare("SELECT id, name, stock FROM products").all();
    const matches = allProducts.filter(p => normalizeText(p.name).includes(normalizedQuery));

    if (matches.length === 0) {
      return await sendMessageToChat(chatId, `🔍 No se encontró ningún producto similar a <b>"${querySearch}"</b>.`);
    }

    if (matches.length > 1) {
      const exact = matches.find(p => normalizeText(p.name) === normalizedQuery);
      if (!exact) {
        let list = matches.slice(0, 5).map(p => `• <code>/ajustar_stock ${p.name} ${exactStock}</code> (Actual: ${p.stock} unds)`).join('\n');
        return await sendMessageToChat(chatId, `⚠️ Se encontraron varios productos similares a "${querySearch}". Sé más específico:\n\n${list}`);
      }
      matches[0] = exact;
    }

    const product = matches[0];
    const oldStock = product.stock || 0;
    const newStock = Math.max(0, exactStock);
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, product.id);

    const diff = newStock - oldStock;
    const diffText = diff >= 0 ? `+${diff}` : `${diff}`;

    const text = 
      `🎯 <b>STOCK FÍSICO AJUSTADO</b>\n\n` +
      `• Producto: <b>${product.name}</b>\n` +
      `• Stock anterior: ${oldStock} unds\n` +
      `• Diferencia de conteo: <b>${diffText} unidades</b>\n` +
      `• <b>Nuevo Stock Total:</b> <b>${newStock} unidades</b>\n\n` +
      `✅ Inventario sincronizado en caja.`;

    await sendMessageToChat(chatId, text);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al ajustar stock: ${err.message}`);
  }
}

// 7. Consultar Precio y Stock
async function handlePrecioCommand(chatId, query) {
  if (!query || query.trim() === '') {
    setSession(chatId, 'WAITING_PRECIO_INPUT', {});
    return await sendMessageToChat(chatId, 
      `🔍 <b>CONSULTA DE PRECIO Y STOCK</b>\n\n` +
      `¿Qué producto deseas consultar? Escribe su nombre o parte de él:\n` +
      `<i>Ejemplo:</i> <code>corona</code> o <code>aguila</code>\n` +
      `<i>(O escribe <code>cancelar</code>)</i>`
    );
  }

  const normalizedQuery = normalizeText(query);
  try {
    const allProducts = db.prepare("SELECT id, name, price, cost_price, stock, min_stock, category FROM products").all();
    const matches = allProducts.filter(p => normalizeText(p.name).includes(normalizedQuery));

    if (matches.length === 0) {
      return await sendMessageToChat(chatId, `🔍 No se encontró ningún producto que coincida con <b>"${query}"</b>.`);
    }

    let msg = `🔎 <b>RESULTADOS PARA "${query}":</b>\n\n`;
    matches.slice(0, 8).forEach(p => {
      const stockStatus = p.stock <= 0 ? '🔴 AGOTADO' : p.stock <= (p.min_stock || 5) ? `🟠 ${p.stock} u. (Bajo)` : `🟢 ${p.stock} u.`;
      msg += `• <b>${p.name}</b>\n`;
      msg += `   └ Precio Venta: <b>${p.price.toLocaleString('es-CO')}</b>\n`;
      msg += `   └ Stock: ${stockStatus} | Cat: ${p.category || 'General'}\n\n`;
    });

    await sendMessageToChat(chatId, msg);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error consultando precios: ${err.message}`);
  }
}

// 8. Cambiar Precio de Venta
async function handleCambiarPrecioCommand(chatId, args) {
  if (!args || args.trim() === '') {
    setSession(chatId, 'WAITING_CAMBIAR_PRECIO_INPUT', {});
    return await sendMessageToChat(chatId, 
      `🏷️ <b>CAMBIAR PRECIO DE VENTA</b>\n\n` +
      `Ingresa el <b>nombre del producto</b> y el <b>nuevo precio</b> de venta al público.\n\n` +
      `<i>Ejemplo:</i> <code>aguila 5500</code> o <code>corona 7000</code>\n` +
      `<i>(O escribe <code>cancelar</code>)</i>`
    );
  }

  const parts = args.trim().split(/\s+/);
  if (parts.length < 2) {
    return await sendMessageToChat(chatId, '⚠️ Indica el producto y el nuevo precio de venta.\n<i>Ejemplo:</i> <code>/cambiar_precio corona 7000</code>');
  }

  const newPrice = parseColombianMoney(parts[parts.length - 1]);
  if (isNaN(newPrice) || newPrice < 0) {
    return await sendMessageToChat(chatId, '⚠️ El precio debe ser un número válido mayor o igual a cero (ej: <code>7000</code> o <code>700.000</code>).');
  }

  const querySearch = parts.slice(0, -1).join(' ');
  const normalizedQuery = normalizeText(querySearch);

  try {
    const allProducts = db.prepare("SELECT id, name, price FROM products").all();
    const matches = allProducts.filter(p => normalizeText(p.name).includes(normalizedQuery));

    if (matches.length === 0) {
      return await sendMessageToChat(chatId, `🔍 No se encontró ningún producto similar a <b>"${querySearch}"</b>.`);
    }
    if (matches.length > 1) {
      const exact = matches.find(p => normalizeText(p.name) === normalizedQuery);
      if (!exact) {
        let list = matches.slice(0, 5).map(p => `• <code>/cambiar_precio ${p.name} ${newPrice}</code> (Actual: $${p.price.toLocaleString('es-CO')})`).join('\n');
        return await sendMessageToChat(chatId, `⚠️ Se encontraron varias coincidencias para "${querySearch}". Sé más específico:\n\n${list}`);
      }
      matches[0] = exact;
    }

    const product = matches[0];
    const oldPrice = product.price;
    db.prepare('UPDATE products SET price = ? WHERE id = ?').run(newPrice, product.id);
    notifyRealtime('PRODUCT_UPDATED', {
      id: product.id,
      name: product.name,
      price: newPrice
    }, `🏷️ Precio de "${product.name}" actualizado desde Telegram a ${newPrice.toLocaleString('es-CO')}`);

    const text = 
      `🏷️ <b>PRECIO ACTUALIZADO EXITOSAMENTE</b>\n\n` +
      `• Producto: <b>${product.name}</b>\n` +
      `• Precio Anterior: ${oldPrice.toLocaleString('es-CO')}\n` +
      `• <b>Nuevo Precio al Público:</b> <b>${newPrice.toLocaleString('es-CO')}</b>\n\n` +
      `✅ Actualizado al instante en la caja.`;

    await sendMessageToChat(chatId, text);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al cambiar precio: ${err.message}`);
  }
}

// 8.1 Actualizar Foto de un Producto
async function handleCambiarFotoCommand(chatId, args) {
  const query = (args || '').trim();
  if (!query) {
    setSession(chatId, 'WAITING_PHOTO_PRODUCT_NAME', {});
    return await sendMessageToChat(chatId, 
      `📸 <b>CAMBIAR FOTO DE PRODUCTO</b>\n\n` +
      `Escribe el nombre del producto al que deseas actualizarle la foto:\n` +
      `<i>(O escribe <code>cancelar</code>)</i>`
    );
  }

  const normalizedQuery = normalizeText(query);
  try {
    const allProducts = db.prepare("SELECT id, name, price, stock, image_path FROM products").all();
    const matches = allProducts.filter(p => normalizeText(p.name).includes(normalizedQuery));

    if (matches.length === 0) {
      return await sendMessageToChat(chatId, `🔍 No se encontró ningún producto similar a <b>"${query}"</b>.`);
    }

    let product = matches[0];
    if (matches.length > 1) {
      const exact = matches.find(p => normalizeText(p.name) === normalizedQuery);
      if (!exact) {
        let list = matches.slice(0, 5).map(p => `• <code>/cambiar_foto ${p.name}</code>`).join('\n');
        return await sendMessageToChat(chatId, `⚠️ Se encontraron varios productos para "${query}". Sé más específico:\n\n${list}`);
      }
      product = exact;
    }

    setSession(chatId, 'WAITING_NEW_PHOTO', {
      productId: product.id,
      productName: product.name
    });

    const photoStatus = product.image_path ? '🖼️ <i>(Actualmente tiene una foto asignada)</i>' : '⚪ <i>(Actualmente no tiene foto)</i>';
    await sendMessageToChat(chatId, 
      `📸 <b>ACTUALIZAR FOTO: ${product.name}</b>\n` +
      `${photoStatus}\n\n` +
      `👉 <b>Envía ahora la nueva foto</b> tomada con tu cámara o de la galería de tu celular.\n\n` +
      `<i>(O escribe <code>cancelar</code> para anular)</i>`
    );
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al buscar producto: ${err.message}`);
  }
}

async function handlePhotoUploadStep(chatId, message) {
  const session = userSessions.get(chatId);
  const text = message.text ? message.text.trim() : '';
  const normalized = normalizeText(text);

  if (normalized === 'cancelar' || normalized === '/cancelar') {
    clearSession(chatId);
    return await sendMessageToChat(chatId, '👍 <i>Actualización de foto cancelada.</i>');
  }

  if (message.photo && message.photo.length > 0) {
    const bestPhoto = message.photo[message.photo.length - 1];
    await sendMessageToChat(chatId, '⏳ <i>Descargando y guardando imagen del producto...</i>');
    const imagePath = await downloadTelegramFile(bestPhoto.file_id);
    
    if (!imagePath) {
      return await sendMessageToChat(chatId, '❌ No se pudo descargar la imagen de Telegram. Inténtalo de nuevo o escribe cancelar:');
    }

    const { productId, productName } = session.data;
    try {
      db.prepare('UPDATE products SET image_path = ? WHERE id = ?').run(imagePath, productId);
      clearSession(chatId);
      return await sendMessageToChat(chatId, 
        `📸✅ <b>¡FOTO ACTUALIZADA CON ÉXITO!</b>\n\n` +
        `Se asignó la nueva foto a <b>${productName}</b>.\n` +
        `Ya se refleja en el punto de venta y catálogo.`
      );
    } catch (err) {
      clearSession(chatId);
      return await sendMessageToChat(chatId, `❌ Error actualizando la imagen en la base de datos: ${err.message}`);
    }
  } else {
    return await sendMessageToChat(chatId, '📸 Por favor envía una <b>foto</b> directamente a este chat (o escribe <code>cancelar</code>):');
  }
}

// 8.2 Eliminar un Producto
async function handleDeleteProductCommand(chatId, args) {
  const query = (args || '').trim();
  if (!query) {
    setSession(chatId, 'AWAITING_DELETE_PRODUCT_NAME', {});
    return await sendMessageToChat(chatId, 
      `🗑️ <b>ELIMINAR PRODUCTO</b>\n\n` +
      `Escribe el nombre del producto que deseas eliminar del catálogo:\n` +
      `<i>(O escribe <code>cancelar</code>)</i>`
    );
  }

  const normalizedQuery = normalizeText(query);
  try {
    const allProducts = db.prepare("SELECT id, name, price, stock, category FROM products").all();
    const matches = allProducts.filter(p => normalizeText(p.name).includes(normalizedQuery));

    if (matches.length === 0) {
      return await sendMessageToChat(chatId, `🔍 No se encontró ningún producto que coincida con <b>"${query}"</b>.`);
    }

    let product = matches[0];
    if (matches.length > 1) {
      const exact = matches.find(p => normalizeText(p.name) === normalizedQuery);
      if (!exact) {
        let list = matches.slice(0, 6).map(p => `• <code>/eliminar ${p.name}</code> (Stock: ${p.stock} u.)`).join('\n');
        return await sendMessageToChat(chatId, 
          `⚠️ Se encontraron varios productos para "${query}". Especifica cuál deseas eliminar:\n\n${list}`
        );
      }
      product = exact;
    }

    return await promptDeleteConfirmation(chatId, product);
  } catch (err) {
    return await sendMessageToChat(chatId, `❌ Error al buscar producto: ${err.message}`);
  }
}

async function promptDeleteConfirmation(chatId, product) {
  setSession(chatId, 'AWAITING_DELETE_CONFIRM', {
    productId: product.id,
    productName: product.name
  });

  const text = 
    `⚠️ <b>¿CONFIRMAR ELIMINACIÓN DEFINITIVA?</b>\n\n` +
    `Estás a punto de borrar permanentemente del catálogo:\n` +
    `📌 <b>${product.name}</b> (ID #${product.id})\n` +
    `🏷️ Categoría: ${product.category || 'General'}\n` +
    `💵 Precio: ${product.price.toLocaleString('es-CO')}\n` +
    `📦 Stock registrado: <b>${product.stock} unidades</b>\n\n` +
    `🚨 <i>Esta acción eliminará el producto del inventario y del punto de venta.</i>\n\n` +
    `👉 Responde <b>SI</b> para confirmar o <b>NO</b> para cancelar.`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🗑️ Sí, eliminar producto', callback_data: `del_prod_${product.id}` },
        { text: '❌ No, cancelar', callback_data: 'del_cancel' }
      ]
    ]
  };

  await telegramApiRequest('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup
  });
}

async function handleDeleteConfirmStep(chatId, message) {
  const rawText = message.text || '';
  const normalized = normalizeText(rawText);
  const session = userSessions.get(chatId);

  if (['si', 's', 'confirmar', 'eliminar', 'yes', 'borrar', 'ok'].includes(normalized)) {
    const { productId, productName } = session.data;
    clearSession(chatId);
    try {
      db.prepare('DELETE FROM products WHERE id = ?').run(productId);
      return await sendMessageToChat(chatId, 
        `🗑️✅ <b>PRODUCTO ELIMINADO CON ÉXITO</b>\n\n` +
        `Se eliminó <b>"${productName}"</b> (ID #${productId}) permanentemente del inventario.\n` +
        `Ya no aparecerá en el punto de venta.`
      );
    } catch (e) {
      return await sendMessageToChat(chatId, `❌ Error eliminando producto de la base de datos: ${e.message}`);
    }
  }

  if (['no', 'n', 'cancelar', 'cancel', 'nop'].includes(normalized)) {
    clearSession(chatId);
    return await sendMessageToChat(chatId, '👍 <i>Operación cancelada. El producto no fue modificado ni eliminado.</i>');
  }

  clearSession(chatId);
  return await processIncomingMessage(message);
}

// 8.3 Ficha Detallada y Opciones de Edición de Producto
async function handleEditarCommand(chatId, args) {
  const query = (args || '').trim();
  if (!query) {
    setSession(chatId, 'WAITING_EDIT_PRODUCT_NAME', {});
    return await sendMessageToChat(chatId, 
      `✏️ <b>EDITAR / FICHA DE PRODUCTO</b>\n\n` +
      `Escribe el nombre del producto que deseas consultar o modificar:\n` +
      `<i>(O escribe <code>cancelar</code>)</i>`
    );
  }

  const normalizedQuery = normalizeText(query);
  try {
    const allProducts = db.prepare("SELECT * FROM products").all();
    const matches = allProducts.filter(p => normalizeText(p.name).includes(normalizedQuery));

    if (matches.length === 0) {
      return await sendMessageToChat(chatId, `🔍 No se encontró ningún producto similar a <b>"${query}"</b>.`);
    }

    let product = matches[0];
    if (matches.length > 1) {
      const exact = matches.find(p => normalizeText(p.name) === normalizedQuery);
      if (!exact) {
        let list = matches.slice(0, 5).map(p => `• <code>/editar ${p.name}</code> (Stock: ${p.stock} u.)`).join('\n');
        return await sendMessageToChat(chatId, `⚠️ Se encontraron varios productos para "${query}". Sé más específico:\n\n${list}`);
      }
      product = exact;
    }

    const price = product.price || 0;
    const cost = product.cost_price || 0;
    const profitUnit = price - cost;
    const marginVal = price > 0 && cost > 0 ? (((profitUnit) / price) * 100).toFixed(1) + '%' : 'N/A';

    const card = 
      `📋 <b>FICHA DE PRODUCTO: ${product.name}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• <b>ID:</b> #${product.id}\n` +
      `• <b>Nombre:</b> ${product.name}\n` +
      `• <b>Categoría:</b> ${product.category || 'General'}\n` +
      `• <b>Precio Venta:</b> ${price.toLocaleString('es-CO')}\n` +
      `• <b>Costo Compra:</b> ${cost.toLocaleString('es-CO')}\n` +
      `• <b>Ganancia Unitaria:</b> +${profitUnit.toLocaleString('es-CO')} (${marginVal})\n` +
      `• <b>Stock Actual:</b> <b>${product.stock || 0} unds</b> (Mínimo: ${product.min_stock || 5})\n` +
      `• <b>Foto:</b> ${product.image_path ? '✅ Sí tiene foto asignada' : '❌ Sin foto'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🛠️ <b>¿Qué deseas modificar? (Toca el comando):</b>\n` +
      `• <code>/cambiar_precio ${product.name} [nuevo_precio]</code>\n` +
      `• <code>/abastecer ${product.name} [cantidad]</code> (Sumar stock)\n` +
      `• <code>/quitar ${product.name} [cantidad]</code> (Restar stock/merma)\n` +
      `• <code>/ajustar_stock ${product.name} [conteo_exacto]</code>\n` +
      `• <code>/cambiar_foto ${product.name}</code> (Nueva foto)\n` +
      `• <code>/eliminar ${product.name}</code> (Borrar producto)`;

    await sendMessageToChat(chatId, card);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error consultando información del producto: ${err.message}`);
  }
}

// ============================================================================
// GESTIÓN DE RECORDATORIOS Y MANTENIMIENTOS DESDE TELEGRAM
// ============================================================================

async function handleRecordatoriosCommand(chatId) {
  try {
    const todayStr = getLocalTodayStr();
    const reminders = db.prepare("SELECT * FROM reminders WHERE status = 'pending' ORDER BY due_date ASC, due_time ASC, id ASC").all();

    if (!reminders || reminders.length === 0) {
      return await sendMessageToChat(chatId, 
        `🔔 <b>RECORDATORIOS Y MANTENIMIENTOS</b>\n\n` +
        `✅ <b>¡No tienes recordatorios pendientes!</b>\n\n` +
        `Para agendar uno nuevo, usa:\n` +
        `<code>/crear_recordatorio AAAA-MM-DD [HH:MM] Cliente - Tarea</code>\n` +
        `<i>Ejemplo:</i> <code>/crear_recordatorio ${todayStr} 15:30 Carlos - Cambio de aceite</code>`
      );
    }

    let overdue = [];
    let todayList = [];
    let upcoming = [];

    reminders.forEach(r => {
      if (r.due_date < todayStr) overdue.push(r);
      else if (r.due_date === todayStr) todayList.push(r);
      else upcoming.push(r);
    });

    let msg = `🔔 <b>RECORDATORIOS Y MANTENIMIENTOS (${reminders.length} PENDIENTES)</b>\n`;
    msg += `📅 Fecha del sistema: <code>${todayStr}</code>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    const formatReminderLine = (r) => {
      const timeStr = r.due_time ? ` ⏰ <b>${r.due_time}</b>` : '';
      const phoneStr = r.customer_phone ? ` (📞 ${r.customer_phone})` : '';
      const recStr = r.recurrence_days > 0 ? ` [🔄 Cada ${r.recurrence_days}d]` : '';
      return `• <b>#${r.id}</b> | <b>${r.title}</b>\n` +
             `   👤 ${r.customer_name || 'General'}${phoneStr}\n` +
             `   📅 ${r.due_date}${timeStr}${recStr}\n` +
             `   👉 Completar: <code>/completar_recordatorio ${r.id}</code>\n` +
             `   👉 Eliminar: <code>/eliminar_recordatorio ${r.id}</code>\n`;
    };

    if (overdue.length > 0) {
      msg += `🚨 <b>VENCIDOS (${overdue.length}):</b>\n`;
      overdue.slice(0, 6).forEach(r => { msg += formatReminderLine(r) + '\n'; });
    }

    if (todayList.length > 0) {
      msg += `⏰ <b>PARA HOY (${todayList.length}):</b>\n`;
      todayList.slice(0, 8).forEach(r => { msg += formatReminderLine(r) + '\n'; });
    }

    if (upcoming.length > 0) {
      msg += `🗓️ <b>PRÓXIMOS (${upcoming.length}):</b>\n`;
      upcoming.slice(0, 6).forEach(r => { msg += formatReminderLine(r) + '\n'; });
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💡 <i>Toca cualquier comando en azul para completar o borrar un recordatorio al instante.</i>`;

    await sendMessageToChat(chatId, msg);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error consultando recordatorios: ${err.message}`);
  }
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

function parseReminderDate(rawQuery) {
  const query = (rawQuery || '').trim();
  const todayStr = getLocalTodayStr(); // YYYY-MM-DD
  
  // 1. Palabras clave naturales
  if (/\b(pasado mañana|pasado manana)\b/i.test(query)) {
    return { date: addDaysToDateString(todayStr, 2), cleanQuery: query.replace(/\b(pasado mañana|pasado manana)\b/i, '').trim() };
  }

  if (/\b(mañana|manana|tomorrow)\b/i.test(query)) {
    return { date: addDaysToDateString(todayStr, 1), cleanQuery: query.replace(/\b(mañana|manana|tomorrow)\b/i, '').trim() };
  }

  if (/\b(hoy|today)\b/i.test(query)) {
    return { date: todayStr, cleanQuery: query.replace(/\b(hoy|today)\b/i, '').trim() };
  }

  // 2. Formato YYYY-MM-DD (ej: 2026-10-01)
  const isoMatch = query.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return { date: `${y}-${m}-${d}`, cleanQuery: query.replace(isoMatch[0], '').trim() };
  }

  // 3. Formato latino DD/MM/YYYY o DD-MM-YYYY (ej: 01/10/2026 o 1/10/2026 o 01-10-2026)
  const latMatch = query.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (latMatch) {
    const d = latMatch[1].padStart(2, '0');
    const m = latMatch[2].padStart(2, '0');
    const y = latMatch[3];
    return { date: `${y}-${m}-${d}`, cleanQuery: query.replace(latMatch[0], '').trim() };
  }

  // 4. Formato corto DD/MM (ej: 01/10 o 1/10) asumiendo año actual
  const shortMatch = query.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/);
  if (shortMatch) {
    const currentYear = todayStr.split('-')[0];
    const d = shortMatch[1].padStart(2, '0');
    const m = shortMatch[2].padStart(2, '0');
    return { date: `${currentYear}-${m}-${d}`, cleanQuery: query.replace(shortMatch[0], '').trim() };
  }

  return { date: null, cleanQuery: query };
}

async function handleCrearRecordatorioCommand(chatId, args) {
  const query = (args || '').trim();
  if (!query) {
    setSession(chatId, 'WAITING_CREAR_RECORDATORIO_INPUT', {});
    return await sendMessageToChat(chatId,
      `🔔 <b>AGENDAR NUEVO RECORDATORIO / MANTENIMIENTO</b>\n\n` +
      `Ingresa los datos en cualquiera de estos formatos amigables:\n` +
      `• <code>hoy 14:30 Carlos - Cambio de aceite</code>\n` +
      `• <code>mañana Taller Moto - Revisión preventiva</code>\n` +
      `• <code>${getLocalTodayStr()} 16:00 Pedro - Alineación</code>\n\n` +
      `<i>(O escribe <code>cancelar</code>)</i>`
    );
  }

  const { date: dueDate, cleanQuery } = parseReminderDate(query);
  if (!dueDate) {
    return await sendMessageToChat(chatId,
      `⚠️ <b>No pude identificar la fecha.</b>\n\n` +
      `Puedes usar palabras como <code>hoy</code>, <code>mañana</code>, o fechas como <code>DD/MM/AAAA</code> (ej: <code>01/10/2026</code>) o <code>AAAA-MM-DD</code> (ej: <code>${getLocalTodayStr()}</code>).\n\n` +
      `<i>Ejemplo:</i> <code>/crear_recordatorio hoy 14:30 Carlos - Mantenimiento</code>`
    );
  }

  let rest = cleanQuery;

  // Regex para hora opcional HH:MM
  let dueTime = null;
  const timeMatch = rest.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (timeMatch) {
    dueTime = timeMatch[0].length === 4 ? `0${timeMatch[0]}` : timeMatch[0];
    rest = rest.replace(timeMatch[0], '').trim();
  }

  let customerName = 'General';
  let title = rest;

  if (rest.includes('-')) {
    const parts = rest.split('-');
    customerName = parts[0].trim() || 'General';
    title = parts.slice(1).join('-').trim() || 'Mantenimiento';
  }

  if (!title) {
    title = 'Mantenimiento / Servicio';
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO reminders (title, description, customer_name, customer_phone, due_date, due_time, advance_notice_days, recurrence_days, status)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0, 'pending')
    `);
    const info = stmt.run(title, 'Agendado desde Telegram', customerName, null, dueDate, dueTime);

    notifyRealtime('REMINDER_CREATED', {
      id: info.lastInsertRowid,
      title,
      customer_name: customerName,
      due_date: dueDate,
      due_time: dueTime
    }, `🔔 Nuevo recordatorio #${info.lastInsertRowid} agendado desde Telegram`);

    const timeTxt = dueTime ? ` a las <b>${dueTime}</b>` : '';
    const text = 
      `🔔✅ <b>RECORDATORIO AGENDADO CON ÉXITO</b>\n\n` +
      `• <b>ID:</b> #${info.lastInsertRowid}\n` +
      `• <b>Tarea:</b> ${title}\n` +
      `• <b>Cliente:</b> ${customerName}\n` +
      `• <b>Fecha:</b> <b>${dueDate}</b>${timeTxt}\n` +
      `• <b>Aviso:</b> 1 día antes\n\n` +
      `🚀 Visible de inmediato en el panel de caja y POS.`;

    await sendMessageToChat(chatId, text);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al crear recordatorio: ${err.message}`);
  }
}

async function handleCompletarRecordatorioCommand(chatId, args) {
  const reminderId = parseInt((args || '').trim().replace(/[^0-9]/g, ''), 10);
  if (isNaN(reminderId) || reminderId <= 0) {
    return await sendMessageToChat(chatId, 
      `ℹ️ <b>Uso de Completar Recordatorio:</b>\n` +
      `<code>/completar_recordatorio [ID]</code>\n\n` +
      `<i>Ejemplo:</i> <code>/completar_recordatorio 5</code>\n` +
      `Escribe <code>/recordatorios</code> para ver los IDs activos.`
    );
  }

  try {
    const reminder = db.prepare("SELECT * FROM reminders WHERE id = ?").get(reminderId);
    if (!reminder) {
      return await sendMessageToChat(chatId, `🔍 No se encontró ningún recordatorio con el ID #${reminderId}.`);
    }

    if (reminder.status === 'completed') {
      return await sendMessageToChat(chatId, `ℹ️ El recordatorio <b>#${reminderId} (${reminder.title})</b> ya figuraba como completado.`);
    }

    db.prepare("UPDATE reminders SET status = 'completed' WHERE id = ?").run(reminderId);

    let renewalNotice = '';
    if (reminder.recurrence_days > 0) {
      const nextDueDate = addDaysToDateString(reminder.due_date, reminder.recurrence_days);

      const newInfo = db.prepare(`
        INSERT INTO reminders (title, description, customer_name, customer_phone, due_date, due_time, advance_notice_days, recurrence_days, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
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

      renewalNotice = `\n🔄 <b>Próxima Cita Auto-Agendada:</b> <b>${nextDueDate}</b> (ID #${newInfo.lastInsertRowid})\nFrecuencia cíclica: Cada ${reminder.recurrence_days} días`;
    }

    notifyRealtime('REMINDER_STATUS_CHANGED', {
      id: reminderId,
      status: 'completed'
    }, `✅ Recordatorio #${reminderId} (${reminder.title}) completado desde Telegram`);

    const text = 
      `✅ <b>RECORDATORIO COMPLETADO</b>\n\n` +
      `• <b>ID:</b> #${reminder.id}\n` +
      `• <b>Tarea:</b> ${reminder.title}\n` +
      `• <b>Cliente:</b> ${reminder.customer_name || 'General'}\n` +
      `• <b>Estado:</b> 🟢 Completado / Realizado${renewalNotice}`;

    await sendMessageToChat(chatId, text);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al completar recordatorio: ${err.message}`);
  }
}

async function handleEliminarRecordatorioCommand(chatId, args) {
  const reminderId = parseInt((args || '').trim().replace(/[^0-9]/g, ''), 10);
  if (isNaN(reminderId) || reminderId <= 0) {
    return await sendMessageToChat(chatId, 
      `ℹ️ <b>Uso de Eliminar Recordatorio:</b>\n` +
      `<code>/eliminar_recordatorio [ID]</code>\n\n` +
      `<i>Ejemplo:</i> <code>/eliminar_recordatorio 8</code>\n` +
      `Escribe <code>/recordatorios</code> para ver los IDs activos.`
    );
  }

  try {
    const reminder = db.prepare("SELECT * FROM reminders WHERE id = ?").get(reminderId);
    if (!reminder) {
      return await sendMessageToChat(chatId, `🔍 No se encontró ningún recordatorio con el ID #${reminderId}.`);
    }

    db.prepare("DELETE FROM reminders WHERE id = ?").run(reminderId);

    notifyRealtime('REMINDER_DELETED', {
      id: reminderId
    }, `🗑️ Recordatorio #${reminderId} eliminado desde Telegram`);

    const timeTxt = reminder.due_time ? ` a las ${reminder.due_time}` : '';
    const text = 
      `🗑️ <b>RECORDATORIO ELIMINADO CON ÉXITO</b>\n\n` +
      `• <b>ID:</b> #${reminder.id}\n` +
      `• <b>Tarea:</b> ${reminder.title}\n` +
      `• <b>Cliente:</b> ${reminder.customer_name || 'General'}\n` +
      `• <b>Fecha Agendada:</b> ${reminder.due_date}${timeTxt}\n\n` +
      `⚠️ El registro fue retirado permanentemente del sistema.`;

    await sendMessageToChat(chatId, text);
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error al eliminar recordatorio: ${err.message}`);
  }
}

// ============================================================================
// VALORIZACIÓN Y DESCARGA DE INVENTARIO
// ============================================================================

function generateInventoryCsv() {
  const products = db.prepare("SELECT * FROM products ORDER BY category ASC, name ASC").all();

  const headers = [
    'ID',
    'Código de Barras',
    'Producto',
    'Categoría',
    'Stock Actual',
    'Stock Mínimo',
    'Precio Costo Unitario ($)',
    'Precio Venta Unitario ($)',
    'Total Costo Invertido ($)',
    'Total Valor Venta ($)',
    'Utilidad Estimada ($)',
    'Margen (%)',
    'Estado'
  ];

  function escapeCsv(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  let totalUnits = 0;
  let totalCostVal = 0;
  let totalRetailVal = 0;

  const lines = [];
  lines.push(headers.map(escapeCsv).join(';'));

  for (const p of products) {
    const stock = Number(p.stock) || 0;
    const price = Number(p.price) || 0;
    const cost = Number(p.cost_price) || 0;
    const minStock = (p.min_stock !== null && p.min_stock !== undefined) ? Number(p.min_stock) : 5;

    const rowCost = stock > 0 ? (stock * cost) : 0;
    const rowRetail = stock > 0 ? (stock * price) : 0;
    const rowProfit = rowRetail - rowCost;
    const rowMargin = rowRetail > 0 ? ((rowProfit / rowRetail) * 100).toFixed(1) + '%' : '0%';

    let estado = 'Normal';
    if (stock <= 0) estado = 'Agotado';
    else if (stock <= minStock) estado = 'Stock Bajo';

    totalUnits += stock;
    totalCostVal += rowCost;
    totalRetailVal += rowRetail;

    lines.push([
      p.id,
      p.barcode || '',
      p.name,
      p.category || 'Sin categoría',
      stock,
      minStock,
      Math.round(cost),
      Math.round(price),
      Math.round(rowCost),
      Math.round(rowRetail),
      Math.round(rowProfit),
      rowMargin,
      estado
    ].map(escapeCsv).join(';'));
  }

  const overallProfit = totalRetailVal - totalCostVal;
  const overallMargin = totalRetailVal > 0 ? ((overallProfit / totalRetailVal) * 100).toFixed(1) + '%' : '0%';

  // Fila final de Totales
  lines.push([
    'TOTALES',
    '',
    `Total: ${products.length} referencias`,
    '',
    totalUnits,
    '',
    '',
    '',
    Math.round(totalCostVal),
    Math.round(totalRetailVal),
    Math.round(overallProfit),
    overallMargin,
    ''
  ].map(escapeCsv).join(';'));

  // UTF-8 BOM (\uFEFF) para garantizar apertura nativa sin errores en Microsoft Excel en español
  const csvContent = '\uFEFF' + lines.join('\r\n');
  return Buffer.from(csvContent, 'utf8').toString('base64');
}

async function sendInventoryFile(chatId) {
  try {
    await sendMessageToChat(chatId, '⏳ <i>Generando archivo de inventario para Excel...</i>');
    const base64Csv = generateInventoryCsv();
    const storeName = getBusinessName().replace(/[^a-zA-Z0-9_-]/g, '_');
    const todayStr = getLocalTodayStr();
    const filename = `Inventario_${storeName}_${todayStr}.csv`;
    const caption = `📊 Inventario consolidado al ${todayStr} - ${getBusinessName()}`;

    const sent = await sendTelegramDocument(base64Csv, filename, caption, 'text/csv', chatId);
    if (!sent) {
      await sendMessageToChat(chatId, '⚠️ Hubo un inconveniente al enviar el archivo adjunto a Telegram.');
    }
  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error generando archivo: ${err.message}`);
  }
}

async function handleInventarioCommand(chatId) {
  const storeName = getBusinessName();
  const todayStr = getLocalTodayStr();

  try {
    const products = db.prepare("SELECT * FROM products ORDER BY category ASC, name ASC").all();

    let totalUnits = 0;
    let totalCostVal = 0;
    let totalRetailVal = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    const totalRefs = products.length;

    for (const p of products) {
      const stock = Number(p.stock) || 0;
      const price = Number(p.price) || 0;
      const cost = Number(p.cost_price) || 0;
      const minStock = (p.min_stock !== null && p.min_stock !== undefined) ? Number(p.min_stock) : 5;

      totalUnits += stock;
      if (stock > 0) {
        totalRetailVal += (stock * price);
        totalCostVal += (stock * cost);
      }
      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      }
    }

    const projectedProfit = totalRetailVal - totalCostVal;
    const profitMargin = totalRetailVal > 0 ? ((projectedProfit / totalRetailVal) * 100).toFixed(1) : '0';

    const text = 
      `📦 <b>VALORIZACIÓN DE INVENTARIO - ${storeName.toUpperCase()}</b>\n` +
      `📅 Fecha: <code>${todayStr}</code>\n` +
      `───────────────────────────────\n` +
      `🏷️ <b>Referencias registradas:</b> ${totalRefs} productos\n` +
      `🔢 <b>Unidades físicas en stock:</b> <b>${totalUnits.toLocaleString('es-CO')}</b> unds\n` +
      `───────────────────────────────\n` +
      `💵 <b>Capital Invertido (Costo):</b> <b>$${Math.round(totalCostVal).toLocaleString('es-CO')}</b>\n` +
      `🏷️ <b>Valor Comercial (Venta):</b> <b>$${Math.round(totalRetailVal).toLocaleString('es-CO')}</b>\n` +
      `📈 <b>Utilidad Bruta Proyectada:</b> <b>+$${Math.round(projectedProfit).toLocaleString('es-CO')}</b> (${profitMargin}% margen)\n` +
      `───────────────────────────────\n` +
      `⚠️ <b>Agotados (stock 0):</b> ${outOfStockCount} referencias\n` +
      `🟠 <b>Stock bajo / crítico:</b> ${lowStockCount} referencias\n\n` +
      `¿Deseas descargar el archivo detallado para abrir en <b>Excel</b>?`;

    // Registrar estado interactivo para permitir respuesta por texto
    setSession(chatId, 'AWAITING_INVENTORY_DOWNLOAD_CONFIRM', {});

    // Enviar con botones táctiles integrados
    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '📥 Sí, descargar Excel (CSV)', callback_data: 'dl_inv_csv' },
          { text: '❌ No, solo el resumen', callback_data: 'cancel_inv' }
        ]
      ]
    };

    await telegramApiRequest('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    });

  } catch (err) {
    await sendMessageToChat(chatId, `❌ Error consultando inventario: ${err.message}`);
  }
}

async function handleInventoryConfirmStep(chatId, message) {
  const rawText = message.text || '';
  const normalized = normalizeText(rawText);

  // Si responde sí, descargar, etc.
  if (['si', 's', 'descargar', 'descargalo', 'enviar', 'mandalo', 'claro', 'por favor', 'porfa', 'dale', 'ok', 'yes', 'csv', 'excel'].includes(normalized)) {
    clearSession(chatId);
    return await sendInventoryFile(chatId);
  }

  // Si responde no, cancelar, etc.
  if (['no', 'n', 'cancelar', 'no gracias', 'listo', 'ninguno', 'nop'].includes(normalized)) {
    clearSession(chatId);
    return await sendMessageToChat(chatId, '👍 <b>Entendido.</b> No se descargó el archivo.');
  }

  // Si escribe un nuevo comando reconocido o cualquier otro texto, cancelar la espera y procesar el nuevo mensaje
  clearSession(chatId);
  return await processIncomingMessage(message);
}

// 9. Asistente Paso a Paso para Crear Nuevo Producto
async function startProductCreation(chatId) {
  setSession(chatId, 'WAITING_PHOTO', {});
  const text = 
    `✨ <b>ASISTENTE: CREAR NUEVO PRODUCTO</b>\n\n` +
    `📸 <b>Paso 1 de 5:</b> Envíame una <b>foto del producto</b> tomada con tu cámara o desde tu galería.\n\n` +
    `<i>(O si prefieres que no tenga foto, escribe <code>omitir</code> o <code>siguiente</code>)</i>\n` +
    `<i>Para cancelar en cualquier momento escribe <code>/cancelar</code></i>`;

  await sendMessageToChat(chatId, text);
}

// Manejador del flujo asistido de creación de producto
async function handleProductCreationStep(chatId, message) {
  const session = userSessions.get(chatId);
  const text = message.text ? message.text.trim() : '';

  if (normalizeText(text) === 'cancelar' || normalizeText(text) === '/cancelar') {
    clearSession(chatId);
    return await sendMessageToChat(chatId, '❌ <i>Creación de producto cancelada.</i>');
  }

  switch (session.step) {
    case 'WAITING_PHOTO': {
      let imagePath = null;
      if (message.photo && message.photo.length > 0) {
        const bestPhoto = message.photo[message.photo.length - 1];
        await sendMessageToChat(chatId, '⏳ <i>Descargando y optimizando imagen del producto...</i>');
        imagePath = await downloadTelegramFile(bestPhoto.file_id);
      } else if (['omitir', 'siguiente', 'no', 'sin foto'].includes(normalizeText(text))) {
        imagePath = null;
      } else {
        return await sendMessageToChat(chatId, '📸 Por favor envía una <b>foto</b> o escribe <code>omitir</code> para continuar sin foto:');
      }

      session.data.image_path = imagePath;
      setSession(chatId, 'WAITING_NAME', session.data);

      await sendMessageToChat(chatId, 
        `📝 <b>Paso 2 de 5: Nombre del producto</b>\n\n` +
        `Escribe el nombre o descripción del artículo:\n` +
        `<i>Ejemplo: Cerveza Corona 330ml</i>`
      );
      break;
    }

    case 'WAITING_NAME': {
      if (!text || text.length < 2) {
        return await sendMessageToChat(chatId, '⚠️ Por favor escribe un nombre válido para el producto:');
      }

      // Verificación inteligente anti-duplicados
      const normalizedInput = normalizeText(text);
      let duplicateMatch = null;
      try {
        const allProds = db.prepare("SELECT id, name, price, stock, category FROM products").all();
        duplicateMatch = allProds.find(p => normalizeText(p.name) === normalizedInput);
      } catch (e) {}

      if (duplicateMatch) {
        return await sendMessageToChat(chatId, 
          `⚠️ <b>¡YA EXISTE UN PRODUCTO CON ESTE NOMBRE!</b>\n\n` +
          `📌 <b>${duplicateMatch.name}</b> (ID #${duplicateMatch.id})\n` +
          `💵 Precio actual: <b>${duplicateMatch.price.toLocaleString('es-CO')}</b>\n` +
          `📦 Stock actual: <b>${duplicateMatch.stock} unds</b>\n` +
          `🏷️ Categoría: <b>${duplicateMatch.category || 'General'}</b>\n\n` +
          `👉 <i>Para mantener tu inventario ordenado y sin duplicados:</i>\n` +
          `1. Escribe un <b>nombre diferente o más específico</b> (ej: indicando presentación, tamaño o sabor).\n` +
          `2. O escribe <code>cancelar</code> si lo que deseas es:\n` +
          `   • Reabastecerlo: <code>/abastecer ${duplicateMatch.name} [cantidad]</code>\n` +
          `   • Cambiarle precio: <code>/cambiar_precio ${duplicateMatch.name} [nuevo_precio]</code>`
        );
      }

      session.data.name = text;
      
      let categories = [];
      try {
        categories = db.prepare("SELECT DISTINCT category FROM products WHERE category != '' LIMIT 6").all().map(r => r.category);
      } catch (e) {}

      let catSuggestions = categories.length > 0 
        ? `\n<i>Categorías en uso: ${categories.join(', ')}</i>` 
        : '';

      setSession(chatId, 'WAITING_CATEGORY', session.data);
      await sendMessageToChat(chatId, 
        `🏷️ <b>Paso 3 de 5: Categoría</b>\n\n` +
        `¿A qué categoría pertenece? (Ej: Licores, Cervezas, Abarrotes, Pasabocas):${catSuggestions}`
      );
      break;
    }

    case 'WAITING_CATEGORY': {
      session.data.category = text || 'General';
      setSession(chatId, 'WAITING_PRICE', session.data);

      await sendMessageToChat(chatId, 
        `💰 <b>Paso 4 de 5: Precio de Venta al Público</b>\n\n` +
        `¿Cuánto vale para el cliente? (Solo números, ej: <code>6000</code> o <code>120000</code>):`
      );
      break;
    }

    case 'WAITING_PRICE': {
      const price = parseColombianMoney(text);
      if (isNaN(price) || price <= 0) {
        return await sendMessageToChat(chatId, '⚠️ Ingresa un precio numérico válido mayor a 0 (ej: <code>5000</code> o <code>700.000</code>):');
      }
      session.data.price = price;
      setSession(chatId, 'WAITING_COST_AND_STOCK', session.data);

      await sendMessageToChat(chatId, 
        `🔢 <b>Paso 5 de 5: Stock y Costo Proveedor</b>\n\n` +
        `Ingresa las <b>existencias iniciales</b> y el <b>costo de compra</b> (separados por espacio).\n\n` +
        `• <i>Ejemplo 1 (Stock y costo):</i> <code>1 450.000</code> o <code>24 3500</code>\n` +
        `• <i>Ejemplo 2 (Solo stock, sin costo):</i> <code>1 0</code>`
      );
      break;
    }

    case 'WAITING_COST_AND_STOCK': {
      const parts = text.split(/\s+/);
      const stock = parseFloat(parts[0] || '0');
      const costRaw = parts.slice(1).join(' ');
      const cost_price = costRaw ? parseColombianMoney(costRaw) : 0;

      if (isNaN(stock) || stock < 0) {
        return await sendMessageToChat(chatId, '⚠️ Ingresa una cantidad de stock válida (ej: <code>1 450.000</code>):');
      }

      session.data.stock = stock;
      session.data.cost_price = isNaN(cost_price) ? 0 : cost_price;
      session.data.min_stock = 5;

      try {
        const stmt = db.prepare(`
          INSERT INTO products (name, price, cost_price, category, stock, min_stock, image_path, sort_order, unit_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'unit')
        `);
        const info = stmt.run(
          session.data.name,
          session.data.price,
          session.data.cost_price,
          session.data.category,
          session.data.stock,
          session.data.min_stock,
          session.data.image_path
        );

        clearSession(chatId);

        const textSuccess = 
          `✅ <b>¡PRODUCTO CREADO EXITOSAMENTE!</b>\n\n` +
          `• ID: #${info.lastInsertRowid}\n` +
          `• Nombre: <b>${session.data.name}</b>\n` +
          `• Categoría: ${session.data.category}\n` +
          `• Precio Venta: <b>$${session.data.price.toLocaleString('es-CO')}</b>\n` +
          (session.data.cost_price > 0 ? `• Costo: $${session.data.cost_price.toLocaleString('es-CO')}\n` : '') +
          `• Stock Inicial: <b>${session.data.stock} unds</b>\n` +
          (session.data.image_path ? `• Imagen: 📸 Vinculada\n` : '') +
          `\n🚀 Ya está activo y listo para vender en el punto de venta.`;

        await sendMessageToChat(chatId, textSuccess);
      } catch (err) {
        clearSession(chatId);
        await sendMessageToChat(chatId, `❌ Error al guardar el producto en la base de datos: ${err.message}`);
      }
      break;
    }

    default:
      clearSession(chatId);
      break;
  }
}

// ============================================================================
// ENRUTADOR PRINCIPAL DE MENSAJES RECIBIDOS (CASE-INSENSITIVE)
// ============================================================================
async function processIncomingMessage(message) {
  if (!message || !message.chat || !message.chat.id) return;
  const chatId = String(message.chat.id);
  const config = getTelegramConfig();

  const rawText = message.text || message.caption || '';
  const cleanText = rawText.trim();
  const normalized = normalizeText(cleanText);

  // Seguridad estricta: Solo responder al Chat ID configurado del dueño/administrador
  if (!config.chatId || String(config.chatId).trim() !== chatId.trim()) {
    console.log(`[Telegram Bot] Mensaje de Chat ID no autorizado: ${chatId} (${message.from?.first_name || 'Usuario'}) - "${cleanText}"`);
    if (normalized === '/start' || normalized === '/id' || normalized === 'id' || normalized === 'hola' || normalized === '/menu' || normalized === 'menu') {
      const storeName = getBusinessName();
      await sendMessageToChat(chatId,
        `👋 <b>¡Hola ${message.from?.first_name || ''}!</b>\n\n` +
        `🤖 Este es el bot de control de <b>${storeName}</b>.\n` +
        `🔑 Tu Chat ID es: <code>${chatId}</code>\n\n` +
        `<i>Si eres el administrador de la tienda, ingresa este Chat ID en los Ajustes del Punto de Venta para autorizar tu acceso remoto.</i>`
      );
    }
    return;
  }

  // Si el usuario está en medio de un flujo interactivo
  if (userSessions.has(chatId)) {
    const session = userSessions.get(chatId);
    const rawText = message.text || message.caption || '';
    const cleanText = rawText.trim();
    const normalized = normalizeText(cleanText);

    if (normalized === 'cancelar' || normalized === '/cancelar') {
      clearSession(chatId);
      return await sendMessageToChat(chatId, '👍 <i>Operación cancelada exitosamente.</i>');
    }

    if (session && session.step === 'AWAITING_INVENTORY_DOWNLOAD_CONFIRM') {
      return await handleInventoryConfirmStep(chatId, message);
    }
    if (session && session.step === 'AWAITING_DELETE_CONFIRM') {
      return await handleDeleteConfirmStep(chatId, message);
    }
    if (session && session.step === 'AWAITING_DELETE_PRODUCT_NAME') {
      clearSession(chatId);
      return await handleDeleteProductCommand(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_PHOTO_PRODUCT_NAME') {
      clearSession(chatId);
      return await handleCambiarFotoCommand(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_NEW_PHOTO') {
      return await handlePhotoUploadStep(chatId, message);
    }
    if (session && session.step === 'WAITING_EDIT_PRODUCT_NAME') {
      clearSession(chatId);
      return await handleEditarCommand(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_GASTO_AMOUNT') {
      return await handleGastoAmountStep(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_GASTO_CONCEPT') {
      return await handleGastoConceptStep(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_ABASTECER_INPUT') {
      clearSession(chatId);
      return await handleAbastecerCommand(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_QUITAR_INPUT') {
      clearSession(chatId);
      return await handleQuitarStockCommand(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_AJUSTAR_INPUT') {
      clearSession(chatId);
      return await handleAjustarStockCommand(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_CAMBIAR_PRECIO_INPUT') {
      clearSession(chatId);
      return await handleCambiarPrecioCommand(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_PRECIO_INPUT') {
      clearSession(chatId);
      return await handlePrecioCommand(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_CREAR_RECORDATORIO_INPUT') {
      clearSession(chatId);
      return await handleCrearRecordatorioCommand(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_ABONO_INPUT') {
      clearSession(chatId);
      return await handleAbonoCommand(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_RECEIPT_PHOTO') {
      return await handleReceiptPhotoStep(chatId, message);
    }
    if (session && session.step === 'WAITING_RECEIPT_CONFIRM') {
      if (['si', 's', 'confirmar', 'yes', 'ok'].includes(normalized)) {
        return await finalizeReceiptExpense(chatId, session.data);
      }
      if (['no', 'n', 'cancelar'].includes(normalized)) {
        if (session.data?.tempPath && fs.existsSync(session.data.tempPath)) {
          try { fs.unlinkSync(session.data.tempPath); } catch (e) {}
        }
        clearSession(chatId);
        return await sendMessageToChat(chatId, '👍 <i>Registro de factura cancelado.</i>');
      }
      clearSession(chatId);
      return await processIncomingMessage(message);
    }
    if (session && session.step === 'WAITING_RECEIPT_EDIT_AMOUNT') {
      const amount = parseColombianMoney(cleanText);
      if (isNaN(amount) || amount <= 0) {
        return await sendMessageToChat(chatId, '⚠️ Por favor ingresa un monto numérico válido mayor a cero (ej: <code>13500</code> o <code>13.500</code>):');
      }
      session.data.amount = amount;
      setSession(chatId, 'WAITING_RECEIPT_CONFIRM', session.data);
      
      const previewMsg = 
        `🧾 <b>FACTURA ACTUALIZADA</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏢 <b>Comercio:</b> <b>${session.data.merchant || 'Comercio'}</b>\n` +
        `📝 <b>Concepto:</b> ${session.data.description}\n` +
        `💰 <b>Nuevo Monto:</b> <b>${amount.toLocaleString('es-CO')}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `<i>¿Confirmas asentar este gasto en caja?</i>`;

      return await telegramApiRequest('sendMessage', {
        chat_id: chatId,
        text: previewMsg,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: `✅ Registrar ${amount.toLocaleString('es-CO')} en Caja`, callback_data: 'rcpt_confirm' }
            ],
            [
              { text: '✏️ Cambiar Monto', callback_data: 'rcpt_edit_amt' },
              { text: '📝 Cambiar Concepto', callback_data: 'rcpt_edit_concept' }
            ],
            [
              { text: '❌ Cancelar', callback_data: 'rcpt_cancel' }
            ]
          ]
        }
      });
    }
    if (session && session.step === 'WAITING_RECEIPT_EDIT_CONCEPT') {
      const newConcept = cleanText.trim();
      if (!newConcept || newConcept.length < 2) {
        return await sendMessageToChat(chatId, '⚠️ Por favor ingresa una breve descripción para el gasto:');
      }
      session.data.description = newConcept;
      setSession(chatId, 'WAITING_RECEIPT_CONFIRM', session.data);

      const previewMsg = 
        `🧾 <b>FACTURA ACTUALIZADA</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏢 <b>Comercio:</b> <b>${session.data.merchant || 'Comercio'}</b>\n` +
        `📝 <b>Nuevo Concepto:</b> ${newConcept}\n` +
        `💰 <b>Monto:</b> <b>${session.data.amount.toLocaleString('es-CO')}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `<i>¿Confirmas asentar este gasto en caja?</i>`;

      return await telegramApiRequest('sendMessage', {
        chat_id: chatId,
        text: previewMsg,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: `✅ Registrar ${session.data.amount.toLocaleString('es-CO')} en Caja`, callback_data: 'rcpt_confirm' }
            ],
            [
              { text: '✏️ Cambiar Monto', callback_data: 'rcpt_edit_amt' },
              { text: '📝 Cambiar Concepto', callback_data: 'rcpt_edit_concept' }
            ],
            [
              { text: '❌ Cancelar', callback_data: 'rcpt_cancel' }
            ]
          ]
        }
      });
    }
    if (session && session.step === 'WAITING_RECEIPT_MANUAL_AMOUNT') {
      return await handleReceiptManualAmountStep(chatId, cleanText);
    }
    if (session && session.step === 'WAITING_RECEIPT_MANUAL_CONCEPT') {
      return await handleReceiptManualConceptStep(chatId, cleanText);
    }

    // Flujo de creación de producto
    return await handleProductCreationStep(chatId, message);
  }

  if (message.photo && message.photo.length > 0) {
    const captionNorm = normalizeText(rawText);
    if (captionNorm.includes('factura') || captionNorm.includes('gasto') || captionNorm.includes('recibo') || captionNorm.includes('ticket')) {
      return await handleReceiptPhotoStep(chatId, message);
    }
    if (!rawText) {
      const bestPhoto = message.photo[message.photo.length - 1];
      const tempPath = await downloadReceiptPhoto(bestPhoto.file_id);
      if (tempPath) {
        setSession(chatId, 'WAITING_PHOTO_ACTION', { tempPath, fileId: bestPhoto.file_id });
        return await telegramApiRequest('sendMessage', {
          chat_id: chatId,
          text: '📸 <b>Foto recibida. ¿Cómo deseas procesarla?</b>',
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🧾 Registrar como Factura de Gasto', callback_data: 'photo_as_receipt' }
              ],
              [
                { text: '📦 Crear Producto Nuevo', callback_data: 'photo_as_product' }
              ],
              [
                { text: '❌ Descartar', callback_data: 'photo_discard' }
              ]
            ]
          }
        });
      }
    }
  }

  // RECORDATORIOS Y MANTENIMIENTOS
  if (['/recordatorios', 'recordatorios', '/mantenimientos', 'mantenimientos', '/citas', 'citas'].includes(normalized)) {
    return await handleRecordatoriosCommand(chatId);
  }

  if (normalized.startsWith('/crear_recordatorio') || normalized.startsWith('crear recordatorio') || normalized.startsWith('/agendar') || normalized.startsWith('agendar')) {
    const args = cleanText.replace(/^\/?(crear_recordatorio|crear recordatorio|agendar recordatorio|agendar)\s*/i, '');
    return await handleCrearRecordatorioCommand(chatId, args);
  }

  if (normalized.startsWith('/completar_recordatorio') || normalized.startsWith('completar recordatorio') || normalized.startsWith('/completar') || normalized.startsWith('completar')) {
    const args = cleanText.replace(/^\/?(completar_recordatorio|completar recordatorio|completar)\s*/i, '');
    return await handleCompletarRecordatorioCommand(chatId, args);
  }

  if (normalized.startsWith('/eliminar_recordatorio') || normalized.startsWith('eliminar recordatorio') || normalized.startsWith('/borrar_recordatorio') || normalized.startsWith('borrar recordatorio')) {
    const args = cleanText.replace(/^\/?(eliminar_recordatorio|eliminar recordatorio|borrar_recordatorio|borrar recordatorio)\s*/i, '');
    return await handleEliminarRecordatorioCommand(chatId, args);
  }

  // 1. Ayuda y Menú
  if (['/start', '/help', '/menu', 'menu', 'ayuda', 'comandos', 'hola', 'opciones'].includes(normalized)) {
    return await handleMenuCommand(chatId);
  }

  // 1.1 Enlaces de Conexión Remota y Carta Digital
  if (['/link', 'link', '/links', 'links', '/ngrok', 'ngrok', '/carta', 'carta', '/menu_digital', 'menu digital', '/acceso', 'acceso'].includes(normalized)) {
    return await handleLinksCommand(chatId);
  }

  // 2. Caja y Finanzas
  if (['/caja', 'caja', '/ventas', 'ventas', '/resumen', 'resumen', 'balance'].includes(normalized)) {
    return await handleCajaCommand(chatId);
  }

  // 2.0.1 Reporte Consolidado del Mes (Utilidad Neta Real)
  if (['/mes', 'mes', '/reporte_mes', 'reporte mes', '/balance_mes', 'balance mes', 'utilidad mes'].includes(normalized)) {
    return await handleReporteMesCommand(chatId);
  }

  // 2.0.2 Cartera y Cuentas por Cobrar (Fiados)
  if (['/fiados', 'fiados', '/cartera', 'cartera', '/creditos', 'creditos', '/deudas', 'deudas'].includes(normalized)) {
    return await handleFiadosCommand(chatId);
  }

  // 2.0.3 Registrar Abono o Pago de Cartera
  if (normalized === '/abono' || normalized === 'abono' || normalized.startsWith('/abono ') || normalized.startsWith('abono ')) {
    const args = cleanText.replace(/^\/?(abono)\s*/i, '');
    return await handleAbonoCommand(chatId, args);
  }

  // 2.1 Valorización y Descarga de Inventario
  if (['/inventario', 'inventario', '/descargar_inventario', 'descargar inventario', '/exportar_inventario', 'exportar inventario', '/descargar'].includes(normalized)) {
    return await handleInventarioCommand(chatId);
  }

  // 3. Top Vendidos
  if (['/top', 'top', '/mas_vendidos', 'mas vendidos', 'top ventas'].includes(normalized)) {
    return await handleTopCommand(chatId);
  }

  // 4. Agotados o Inventario Bajo
  if (['/agotados', 'agotados', '/stock_bajo', 'stock bajo', 'stockbajo', '/inventario_bajo', 'inventario bajo', 'alertas', '/alertas', 'alerta', '/faltantes', 'faltantes', 'que falta', 'que se acabo'].includes(normalized)) {
    return await handleAgotadosCommand(chatId);
  }

  // 5. Crear Producto
  if (['/crear', 'crear', '/nuevo', 'nuevo', '/nuevo_producto', 'nuevo producto', 'agregar producto'].includes(normalized)) {
    return await startProductCreation(chatId);
  }

  // 6. Gasto (con o sin argumentos)
  if (normalized === '/gasto' || normalized === 'gasto' || normalized === '/egreso' || normalized === 'egreso' ||
      normalized.startsWith('/gasto ') || normalized.startsWith('gasto ') || normalized.startsWith('/egreso ') || normalized.startsWith('egreso ')) {
    const args = cleanText.replace(/^\/?(gasto|egreso)\s*/i, '');
    return await handleGastoCommand(chatId, args);
  }

  // 6.1 Subir Factura / Comprobante de Gasto
  if (normalized === '/factura' || normalized === 'factura' || normalized === '/gasto_foto' || normalized === 'gasto foto' ||
      normalized === '/recibo' || normalized === 'recibo' || normalized === '/ticket' || normalized === 'ticket') {
    return await handleFacturaCommand(chatId);
  }

  // 6.2 Buscar Gastos Históricos
  if (normalized === '/buscar_gasto' || normalized === 'buscar gasto' || normalized === '/gastos' || normalized === 'gastos' ||
      normalized.startsWith('/buscar_gasto ') || normalized.startsWith('buscar gasto ') ||
      normalized.startsWith('/gastos ') || normalized.startsWith('gastos ')) {
    const args = cleanText.replace(/^\/?(buscar_gasto|buscar gasto|gastos)\s*/i, '');
    return await handleBuscarGastoCommand(chatId, args);
  }

  // 6.3 Ver Comprobante de Factura
  if (normalized.startsWith('/ver_factura') || normalized.startsWith('ver factura') || normalized.startsWith('/comprobante') || normalized.startsWith('comprobante')) {
    const args = cleanText.replace(/^\/?(ver_factura|ver factura|comprobante)\s*/i, '');
    return await handleVerFacturaCommand(chatId, args);
  }

  // 7. Abastecer / Entrada de Stock (con o sin argumentos)
  if (normalized === '/abastecer' || normalized === 'abastecer' || normalized === '/entrada' || normalized === 'entrada' ||
      normalized === '/sumar_stock' || normalized === 'sumar stock' || normalized === '/stock' || normalized === 'stock' ||
      normalized.startsWith('/abastecer ') || normalized.startsWith('abastecer ') ||
      normalized.startsWith('/entrada ') || normalized.startsWith('entrada ') ||
      normalized.startsWith('/sumar_stock ') || normalized.startsWith('sumar stock ') ||
      normalized.startsWith('/stock ') || normalized.startsWith('stock ')) {
    const args = cleanText.replace(/^\/?(abastecer|entrada|sumar_stock|sumar stock|stock)\s*/i, '');
    return await handleAbastecerCommand(chatId, args);
  }

  // 7.1 Quitar / Salida / Merma de Stock (con o sin argumentos)
  if (normalized === '/quitar' || normalized === 'quitar' || normalized === '/quitar_stock' || normalized === 'quitar stock' ||
      normalized === '/salida' || normalized === 'salida' || normalized === '/merma' || normalized === 'merma' ||
      normalized === '/restar_stock' || normalized === 'restar stock' ||
      normalized.startsWith('/quitar_stock ') || normalized.startsWith('quitar stock ') ||
      normalized.startsWith('/quitar ') || normalized.startsWith('quitar ') ||
      normalized.startsWith('/salida ') || normalized.startsWith('salida ') ||
      normalized.startsWith('/merma ') || normalized.startsWith('merma ') ||
      normalized.startsWith('/restar_stock ') || normalized.startsWith('restar stock ')) {
    const args = cleanText.replace(/^\/?(quitar_stock|quitar stock|quitar|salida|merma|restar_stock|restar stock)\s*/i, '');
    return await handleQuitarStockCommand(chatId, args);
  }

  // 7.2 Ajustar / Fijar Stock Físico (con o sin argumentos)
  if (normalized === '/ajustar_stock' || normalized === 'ajustar stock' || normalized === '/ajuste' || normalized === 'ajuste' ||
      normalized === '/fijar_stock' || normalized === 'fijar stock' ||
      normalized.startsWith('/ajustar_stock ') || normalized.startsWith('ajustar stock ') ||
      normalized.startsWith('/ajuste ') || normalized.startsWith('ajuste ') ||
      normalized.startsWith('/fijar_stock ') || normalized.startsWith('fijar stock ')) {
    const args = cleanText.replace(/^\/?(ajustar_stock|ajustar stock|ajuste|fijar_stock|fijar stock)\s*/i, '');
    return await handleAjustarStockCommand(chatId, args);
  }

  // 8. Consultar Precio (con o sin argumentos)
  if (normalized === '/precio' || normalized === 'precio' || normalized === '/buscar' || normalized === 'buscar' ||
      normalized.startsWith('/precio ') || normalized.startsWith('precio ') ||
      normalized.startsWith('/buscar ') || normalized.startsWith('buscar ')) {
    const args = cleanText.replace(/^\/?(precio|buscar)\s*/i, '');
    return await handlePrecioCommand(chatId, args);
  }

  // 9. Cambiar Precio (con o sin argumentos)
  if (normalized === '/cambiar_precio' || normalized === 'cambiar precio' || normalized === '/ajustar_precio' || normalized === 'ajustar precio' ||
      normalized.startsWith('/cambiar_precio ') || normalized.startsWith('cambiar precio ') ||
      normalized.startsWith('/ajustar_precio ') || normalized.startsWith('ajustar precio ')) {
    const args = cleanText.replace(/^\/?(cambiar_precio|cambiar precio|ajustar precio)\s*/i, '');
    return await handleCambiarPrecioCommand(chatId, args);
  }

  // 10. Actualizar Foto de Producto
  if (normalized === '/cambiar_foto' || normalized === 'cambiar foto' || normalized === '/foto' || normalized === 'foto' ||
      normalized === '/actualizar_foto' || normalized === 'actualizar foto' ||
      normalized.startsWith('/cambiar_foto ') || normalized.startsWith('cambiar foto ') ||
      normalized.startsWith('/foto ') || normalized.startsWith('foto ') ||
      normalized.startsWith('/actualizar_foto ') || normalized.startsWith('actualizar foto ')) {
    const args = cleanText.replace(/^\/?(cambiar_foto|cambiar foto|foto|actualizar_foto|actualizar foto)\s*/i, '');
    return await handleCambiarFotoCommand(chatId, args);
  }

  // 11. Eliminar Producto
  if (normalized === '/eliminar' || normalized === 'eliminar' || normalized === '/borrar' || normalized === 'borrar' ||
      normalized === '/eliminar_producto' || normalized === 'eliminar producto' ||
      normalized.startsWith('/eliminar ') || normalized.startsWith('eliminar ') ||
      normalized.startsWith('/borrar ') || normalized.startsWith('borrar ') ||
      normalized.startsWith('/eliminar_producto ') || normalized.startsWith('eliminar producto ')) {
    const args = cleanText.replace(/^\/?(eliminar_producto|eliminar producto|eliminar|borrar)\s*/i, '');
    return await handleDeleteProductCommand(chatId, args);
  }

  // 12. Editar / Detalle de Producto
  if (normalized === '/editar' || normalized === 'editar' || normalized === '/editar_producto' || normalized === 'editar producto' ||
      normalized === '/info' || normalized === 'info' || normalized === '/detalle' || normalized === 'detalle' ||
      normalized.startsWith('/editar ') || normalized.startsWith('editar ') ||
      normalized.startsWith('/editar_producto ') || normalized.startsWith('editar producto ') ||
      normalized.startsWith('/info ') || normalized.startsWith('info ') ||
      normalized.startsWith('/detalle ') || normalized.startsWith('detalle ')) {
    const args = cleanText.replace(/^\/?(editar_producto|editar producto|editar|info|detalle)\s*/i, '');
    return await handleEditarCommand(chatId, args);
  }

  // Si no coincide con ningún comando, responder amigablemente con el menú de ayuda
  await sendMessageToChat(chatId, 
    `🤔 No reconocí el comando <i>"${cleanText}"</i>.\n\n` +
    `Escribe <code>/menu</code> o <code>ayuda</code> para ver la lista de acciones disponibles.`
  );
}

// ============================================================================
// SERVICIO DE LONG POLLING (ESCUCHA AUTÓNOMA CONTINUA)
// ============================================================================
let isPollingActive = false;
let pollingOffset = 0;
let pollingTimeoutId = null;

async function registerBotCommands() {
  const commands = [
    { command: 'menu', description: 'Abrir panel de comandos rápidos' },
    { command: 'caja', description: 'Consultar balance y ventas en vivo' },
    { command: 'mes', description: 'Reporte mensual de ventas y utilidad' },
    { command: 'fiados', description: 'Cartera y cuentas por cobrar' },
    { command: 'abono', description: 'Registrar abono a deuda de cliente' },
    { command: 'inventario', description: 'Valorización y descarga en Excel' },
    { command: 'abastecer', description: 'Ingreso de mercancía (+ stock)' },
    { command: 'quitar', description: 'Salida o merma de existencias (-)' },
    { command: 'ajustar_stock', description: 'Fijar conteo físico exacto' },
    { command: 'precio', description: 'Consultar precio y existencias' },
    { command: 'crear', description: 'Crear nuevo producto (con foto)' },
    { command: 'editar', description: 'Ficha y opciones del producto' },
    { command: 'cambiar_precio', description: 'Ajustar precio de venta' },
    { command: 'cambiar_foto', description: 'Actualizar foto de un producto' },
    { command: 'eliminar', description: 'Eliminar producto del catálogo' },
    { command: 'gasto', description: 'Registrar salida de dinero en caja' },
    { command: 'factura', description: 'Subir foto de factura o recibo' },
    { command: 'buscar_gasto', description: 'Consultar gastos históricos' },
    { command: 'top', description: 'Top 5 productos más vendidos hoy' },
    { command: 'agotados', description: 'Ver productos agotados o stock bajo' },
    { command: 'recordatorios', description: 'Consultar citas y mantenimientos' },
    { command: 'crear_recordatorio', description: 'Agendar cita/mantenimiento' },
    { command: 'completar_recordatorio', description: 'Marcar recordatorio realizado' },
    { command: 'eliminar_recordatorio', description: 'Eliminar recordatorio por ID' }
  ];
  await telegramApiRequest('setMyCommands', { commands });
}

async function processIncomingCallbackQuery(cbQuery) {
  if (!cbQuery || !cbQuery.id) return;

  // Responder de inmediato a Telegram para quitar el icono de cargando del botón
  await telegramApiRequest('answerCallbackQuery', {
    callback_query_id: cbQuery.id
  });

  const fromChatId = String(cbQuery.message?.chat?.id || cbQuery.from?.id || '');
  const config = getTelegramConfig();

  // Validar autorización de Chat ID
  if (config.chatId && String(config.chatId).trim() !== '' && fromChatId !== String(config.chatId).trim()) {
    console.log(`[Telegram Bot] CallbackQuery ignorado de Chat ID no autorizado: ${fromChatId}`);
    return;
  }

  const data = cbQuery.data;
  if (data === 'dl_inv_csv') {
    clearSession(fromChatId);
    await sendInventoryFile(fromChatId);
  } else if (data === 'cancel_inv') {
    clearSession(fromChatId);
    await sendMessageToChat(fromChatId, '👍 <b>Entendido.</b> No se descargó el archivo.');
  } else if (data && data.startsWith('del_prod_')) {
    const prodId = parseInt(data.replace('del_prod_', ''), 10);
    clearSession(fromChatId);
    try {
      const prod = db.prepare('SELECT name FROM products WHERE id = ?').get(prodId);
      const prodName = prod ? prod.name : `#${prodId}`;
      db.prepare('DELETE FROM products WHERE id = ?').run(prodId);
      await sendMessageToChat(fromChatId, 
        `🗑️✅ <b>PRODUCTO ELIMINADO CON ÉXITO</b>\n\n` +
        `Se eliminó "<b>${prodName}</b>" permanentemente del inventario.\n` +
        `Ya no aparecerá en el punto de venta.`
      );
    } catch (err) {
      await sendMessageToChat(fromChatId, `❌ Error al eliminar producto: ${err.message}`);
    }
  } else if (data === 'del_cancel') {
    clearSession(fromChatId);
    await sendMessageToChat(fromChatId, '👍 <i>Operación cancelada. El producto no fue modificado ni eliminado.</i>');
  } else if (data === 'rcpt_confirm') {
    const session = userSessions.get(fromChatId);
    if (session && session.data && session.data.tempPath) {
      await finalizeReceiptExpense(fromChatId, session.data);
    } else {
      await sendMessageToChat(fromChatId, '⏱️ <i>La sesión de confirmación expiró. Envía la foto nuevamente si deseas registrarla.</i>');
    }
  } else if (data === 'rcpt_edit_amt') {
    const session = userSessions.get(fromChatId);
    if (session && session.data && session.data.tempPath) {
      setSession(fromChatId, 'WAITING_RECEIPT_EDIT_AMOUNT', session.data);
      await sendMessageToChat(fromChatId, '✏️ ¿Cuál es el <b>monto correcto</b> a registrar? (ej: <code>13500</code> o <code>13.500</code>):');
    }
  } else if (data === 'rcpt_edit_concept') {
    const session = userSessions.get(fromChatId);
    if (session && session.data && session.data.tempPath) {
      setSession(fromChatId, 'WAITING_RECEIPT_EDIT_CONCEPT', session.data);
      await sendMessageToChat(fromChatId, '📝 Envía el <b>nuevo concepto o detalle</b> para este gasto:');
    }
  } else if (data === 'rcpt_cancel') {
    const session = userSessions.get(fromChatId);
    if (session && session.data && session.data.tempPath && fs.existsSync(session.data.tempPath)) {
      try { fs.unlinkSync(session.data.tempPath); } catch (e) {}
    }
    clearSession(fromChatId);
    await sendMessageToChat(fromChatId, '👍 <i>Registro de factura cancelado.</i>');
  } else if (data === 'photo_as_receipt') {
    const session = userSessions.get(fromChatId);
    if (session && session.data && session.data.tempPath) {
      const tempPath = session.data.tempPath;
      await sendMessageToChat(fromChatId, '⏳ <i>Analizando comprobante con IA...</i>');
      const aiResult = await analyzeReceiptWithGemini(tempPath);
      if (aiResult && aiResult.total > 0) {
        const detectedConcept = aiResult.concept || aiResult.merchant || 'Gasto operativo';
        setSession(fromChatId, 'WAITING_RECEIPT_CONFIRM', {
          tempPath,
          amount: aiResult.total,
          description: detectedConcept,
          merchant: aiResult.merchant || 'Comercio / Proveedor',
          nit: aiResult.nit || null,
          invoice_number: aiResult.invoice_number || null,
          payment_method: aiResult.payment_method || null,
          date: aiResult.date || getLocalTodayStr()
        });

        let extraDetails = '';
        if (aiResult.nit) extraDetails += `🆔 <b>NIT / ID:</b> ${aiResult.nit}\n`;
        if (aiResult.invoice_number) extraDetails += `📄 <b>Factura N°:</b> ${aiResult.invoice_number}\n`;
        if (aiResult.date) extraDetails += `📅 <b>Fecha comprobante:</b> ${aiResult.date}\n`;
        if (aiResult.items_summary) extraDetails += `🛒 <b>Detalle items:</b> ${aiResult.items_summary}\n`;
        if (aiResult.payment_method) extraDetails += `💳 <b>Método detectado:</b> ${aiResult.payment_method}\n`;

        const previewMsg = 
          `🧾 <b>FACTURA AUDITADA CON ÉXITO</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🏢 <b>Comercio:</b> <b>${aiResult.merchant || 'Detectado en comprobante'}</b>\n` +
          extraDetails +
          `📝 <b>Concepto a registrar:</b> ${detectedConcept}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 <b>TOTAL DETECTADO:</b> <b>${aiResult.total.toLocaleString('es-CO')}</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `<i>¿Confirmas asentar este gasto en caja y archivar el comprobante?</i>`;

        return await telegramApiRequest('sendMessage', {
          chat_id: fromChatId,
          text: previewMsg,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: `✅ Registrar ${aiResult.total.toLocaleString('es-CO')} en Caja`, callback_data: 'rcpt_confirm' }
              ],
              [
                { text: '✏️ Modificar Monto', callback_data: 'rcpt_edit_amt' },
                { text: '📝 Modificar Concepto', callback_data: 'rcpt_edit_concept' }
              ],
              [
                { text: '❌ Descartar Comprobante', callback_data: 'rcpt_cancel' }
              ]
            ]
          }
        });
      } else {
        setSession(fromChatId, 'WAITING_RECEIPT_MANUAL_AMOUNT', { tempPath });
        await sendMessageToChat(fromChatId, 
          `🧾 <b>FOTO DE FACTURA RECIBIDA</b>\n\n` +
          `👉 ¿De cuánto fue el <b>monto total</b> de este gasto? (ej: <code>13500</code> o <code>13.500</code>):\n\n` +
          `<i>(O escribe <code>cancelar</code>)</i>`
        );
      }
    }
  } else if (data === 'photo_as_product') {
    const session = userSessions.get(fromChatId);
    let imagePath = null;
    if (session?.data?.tempPath && fs.existsSync(session.data.tempPath)) {
      const ext = path.extname(session.data.tempPath) || '.jpg';
      const prodFilename = `prod_${Date.now()}_${Math.round(Math.random() * 1E6)}${ext}`;
      const destPath = path.join(uploadsDir, prodFilename);
      try {
        fs.copyFileSync(session.data.tempPath, destPath);
        fs.unlinkSync(session.data.tempPath);
        imagePath = `/api/uploads/${prodFilename}`;
      } catch (e) {
        console.error('Error moviendo foto de producto:', e);
      }
    } else if (session?.data?.fileId) {
      imagePath = await downloadTelegramFile(session.data.fileId);
    }

    clearSession(fromChatId);
    setSession(fromChatId, 'WAITING_NAME', { image_path: imagePath });
    await sendMessageToChat(fromChatId, 
      `✨ <b>ASISTENTE: CREAR NUEVO PRODUCTO</b>\n` +
      (imagePath ? `📸 <i>Foto vinculada con éxito.</i>\n\n` : `\n`) +
      `📝 <b>Paso 2 de 5: Nombre del producto</b>\n\n` +
      `Escribe el nombre o descripción del artículo:\n` +
      `<i>Ejemplo: Cerveza Corona 330ml</i>\n\n` +
      `<i>(Para cancelar escribe <code>cancelar</code>)</i>`
    );
  } else if (data === 'photo_discard') {
    const session = userSessions.get(fromChatId);
    if (session?.data?.tempPath && fs.existsSync(session.data.tempPath)) {
      try { fs.unlinkSync(session.data.tempPath); } catch (e) {}
    }
    clearSession(fromChatId);
    await sendMessageToChat(fromChatId, '👍 <i>Foto descartada.</i>');
  }
}

// Control estricto anti-concurrencia y deduplicación de actualizaciones
let pollingGeneration = 0;
let isLoopExecuting = false;
const processedUpdateIds = new Set();

async function runPollingLoop(generation) {
  if (!isPollingActive || generation !== pollingGeneration) return;
  if (isLoopExecuting) return;

  const config = getTelegramConfig();
  if (!config.token || config.token.trim() === '') {
    pollingTimeoutId = setTimeout(() => runPollingLoop(generation), 15000);
    return;
  }

  isLoopExecuting = true;

  try {
    const res = await telegramApiRequest('getUpdates', {
      offset: pollingOffset,
      timeout: 10,
      allowed_updates: ['message', 'callback_query']
    }, 18000);

    if (generation === pollingGeneration && isPollingActive && res && res.ok && Array.isArray(res.result)) {
      for (const update of res.result) {
        pollingOffset = update.update_id + 1;

        if (processedUpdateIds.has(update.update_id)) {
          continue;
        }
        processedUpdateIds.add(update.update_id);
        if (processedUpdateIds.size > 2000) {
          const first = processedUpdateIds.values().next().value;
          processedUpdateIds.delete(first);
        }

        if (update.callback_query) {
          try {
            const sender = update.callback_query.from?.first_name || update.callback_query.from?.id || 'Usuario';
            console.log(`[Telegram Bot] 🔘 Botón pulsado por ${sender}: ${update.callback_query.data}`);
            await processIncomingCallbackQuery(update.callback_query);
          } catch (err) {
            console.error('[Telegram Bot CallbackQuery Error]:', err);
          }
        } else if (update.message) {
          try {
            const sender = update.message.from?.first_name || update.message.chat?.id || 'Usuario';
            const txt = update.message.text || update.message.caption || '[Foto/Archivo]';
            console.log(`[Telegram Bot] 📩 Mensaje recibido de ${sender}: "${txt}"`);
            await processIncomingMessage(update.message);
          } catch (err) {
            console.error('[Telegram Bot Error al procesar mensaje]:', err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Telegram Bot Polling Error]:', err?.message || err);
  } finally {
    isLoopExecuting = false;
  }

  if (isPollingActive && generation === pollingGeneration) {
    pollingTimeoutId = setTimeout(() => runPollingLoop(generation), 1000);
  }
}

function startTelegramPolling() {
  const config = getTelegramConfig();
  if (!config.token || config.token.trim() === '') {
    console.log('ℹ️ Bot de Telegram: Token no configurado aún en Ajustes.');
    return;
  }

  pollingGeneration++;
  const currentGen = pollingGeneration;
  isPollingActive = true;
  console.log(`🤖 Bot Interactivo de Telegram: Iniciando servicio de escucha (Gen #${currentGen})...`);
  registerBotCommands().catch(() => {});
  runPollingLoop(currentGen);
}

function stopTelegramPolling() {
  pollingGeneration++;
  isPollingActive = false;
  isLoopExecuting = false;
  if (pollingTimeoutId) {
    clearTimeout(pollingTimeoutId);
    pollingTimeoutId = null;
  }
}

module.exports = {
  setEventBroadcaster, 
  sendTelegramMessage, 
  sendTelegramDocument, 
  sendTelegramPhoto,
  sendTelegramPhotoBuffer,
  startTelegramPolling, 
  stopTelegramPolling 
};
