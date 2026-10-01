/**
 * Utilidades Centralizadas para Formato de Moneda Colombiana (COP)
 * Garantiza separadores de miles por punto (1.111.111) sin decimales.
 */

/**
 * Formatea un número o string a formato monetario colombiano con puntos de miles.
 * @param {number|string} val - Monto a formatear
 * @param {boolean} includeSymbol - Si debe incluir el prefijo '$'
 * @returns {string} Ejemplo: "$1.111.111" o "1.111.111"
 */
export function formatCOP(val, includeSymbol = false) {
  if (val === null || val === undefined || val === '') return includeSymbol ? '$0' : '0';
  let num = 0;
  if (typeof val === 'number') {
    num = Math.round(val);
  } else {
    const cleanStr = String(val).replace(/[^\d]/g, '');
    num = cleanStr ? parseInt(cleanStr, 10) : 0;
    if (String(val).startsWith('-')) num = -num;
  }
  if (isNaN(num)) return includeSymbol ? '$0' : '0';
  
  const formatted = Math.abs(num).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  const sign = num < 0 ? '-' : '';
  return includeSymbol ? `${sign}$${formatted}` : `${sign}${formatted}`;
}

/**
 * Formatea dinámicamente el texto mientras el usuario escribe en un campo de entrada.
 * Elimina caracteres no numéricos y añade los puntos de miles en tiempo real.
 * @param {string|number} rawValue - Valor tipeado
 * @returns {string} Ejemplo: "1111111" -> "1.111.111"
 */
export function formatCOPInput(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return '';
  let num = 0;
  if (typeof rawValue === 'number') {
    num = Math.round(rawValue);
  } else {
    const digits = String(rawValue).replace(/\D/g, '');
    if (!digits) return '';
    num = parseInt(digits, 10);
  }
  if (isNaN(num)) return '';
  return num.toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

/**
 * Extrae el valor numérico puro entero a partir de un texto formateado con puntos.
 * @param {string|number} formattedValue - Ejemplo: "1.111.111" o "$1.111.111"
 * @returns {number} Ejemplo: 1111111
 */
export function parseCOP(formattedValue) {
  if (typeof formattedValue === 'number') return Math.round(formattedValue);
  if (!formattedValue) return 0;
  const digits = String(formattedValue).replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Retorna la cadena numérica pura (para enviar a la base de datos o APIs).
 * @param {string|number} formattedValue 
 * @returns {string} Ejemplo: "1111111"
 */
export function parseCOPString(formattedValue) {
  return String(parseCOP(formattedValue));
}
