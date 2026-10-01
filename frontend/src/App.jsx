import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  History, 
  Settings, 
  Trash2, 
  Package, 
  X, 
  CheckCircle, 
  CheckCircle2, 
  Edit2, 
  Plus, 
  FileText, 
  Search, 
  AlertTriangle, 
  UserPlus, 
  DollarSign, 
  RotateCcw,
  BarChart2,
  Calendar,
  Users,
  Check,
  Shield,
  Copy,
  Power,
  Printer,
  Lock,
  Monitor,
  Smartphone,
  Globe,
  Eye,
  EyeOff,
  User,
  AlertCircle,
  QrCode,
  Bell,
  Coins,
  Send
} from 'lucide-react';
import { formatCOP, formatCOPInput, parseCOP } from './utils/currency';
import { printThermalElement, triggerCashDrawerPulse } from './utils/printHelper';

const formatItemTime = (dStr) => {
  if (!dStr) return '';
  try {
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  } catch (e) {}
  return String(dStr);
};

const formatSafeDate = (dStr) => {
  if (!dStr) return '-';
  try {
    const str = String(dStr);
    const d = new Date(str.endsWith('Z') ? str : str + 'Z');
    if (isNaN(d.getTime())) {
      const d2 = new Date(str);
      return isNaN(d2.getTime()) ? str : d2.toLocaleString('es-CO');
    }
    return d.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  } catch (e) {
    return String(dStr || '-');
  }
};

const formatMoney = (val) => {
  const n = Number(val);
  return isNaN(n) ? '0' : n.toLocaleString();
};

const PrintableTicket = ({ sale, config }) => {
  if (!sale) return null;
  const isAbono = typeof sale.customer_name === 'string' && sale.customer_name.startsWith('Abono:');
  const hasItems = Array.isArray(sale.items) && sale.items.length > 0;

  return (
    <div id="printable-ticket" style={{ fontFamily: 'monospace', padding: '2px 1px', color: '#000', background: '#fff' }}>
      {/* Encabezado del Negocio */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        <h2 style={{ fontSize: '15px', margin: '0 0 2px 0', fontWeight: '900', letterSpacing: '0.5px' }}>
          {config?.business_name || 'Mi Negocio'}
        </h2>
        {config?.business_nit && <p style={{ fontSize: '9.5px', margin: '1px 0' }}>NIT/RUT: {config.business_nit}</p>}
        {config?.business_address && <p style={{ fontSize: '9.5px', margin: '1px 0' }}>Dir: {config.business_address}</p>}
        {config?.business_phone && <p style={{ fontSize: '9.5px', margin: '1px 0' }}>Tel: {config.business_phone}</p>}
        
        <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>
        
        <p style={{ fontSize: '11px', margin: '2px 0', fontWeight: 'bold' }}>
          {isAbono ? 'COMPROBANTE DE ABONO A CUENTA' : `TICKET DE VENTA #${sale.id}`}
        </p>
        <p style={{ fontSize: '9px', margin: '1px 0', color: '#222' }}>
          Fecha: {formatSafeDate(sale.created_at)}
        </p>
        {sale.user_name && <p style={{ fontSize: '9px', margin: '1px 0', color: '#222' }}>Atendido por: {sale.user_name}</p>}
      </div>

      <div style={{ borderBottom: '1px dashed #000', marginBottom: '6px' }}></div>

      {/* Tabla de Productos / Conceptos */}
      {hasItems ? (
        <table style={{ width: '100%', fontSize: '10.5px', textAlign: 'left', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              <th style={{ padding: '3px 0', width: '28px', textAlign: 'center', fontWeight: 'bold' }}>CANT</th>
              <th style={{ padding: '3px 4px', textAlign: 'left', fontWeight: 'bold' }}>PRODUCTO / CONCEPTO</th>
              <th style={{ padding: '3px 0', width: '70px', textAlign: 'right', fontWeight: 'bold' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, i) => {
              const qty = item.quantity || 1;
              const unitPrice = item.price || 0;
              const lineTotal = qty * unitPrice;
              const isMulti = qty > 1;

              return (
                <tr key={i} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ verticalAlign: 'top', textAlign: 'center', padding: '4px 0', fontWeight: 'bold' }}>
                    {qty}
                  </td>
                  <td style={{ verticalAlign: 'top', padding: '4px', wordBreak: 'break-word' }}>
                    <div style={{ fontWeight: '600' }}>
                      {item.product_name || item.name}
                    </div>
                    {isMulti && (
                      <div style={{ fontSize: '9px', color: '#444', fontStyle: 'italic', marginTop: '1px' }}>
                        ({qty} x ${formatMoney(unitPrice)} c/u)
                      </div>
                    )}
                  </td>
                  <td style={{ verticalAlign: 'top', textAlign: 'right', padding: '4px 0', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    ${formatMoney(lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: '6px 0', textAlign: 'center', fontSize: '10.5px', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', margin: '4px 0' }}>
          <p style={{ fontWeight: 'bold', margin: '2px 0' }}>{isAbono ? 'ABONO A CRÉDITO PENDIENTE' : 'PAGO DE CUENTA / FIADO'}</p>
          <p style={{ margin: '2px 0' }}>Cliente: {typeof sale.customer_name === 'string' ? sale.customer_name.replace('Abono: ', '') : 'Cliente'}</p>
        </div>
      )}

      {/* Total a Pagar Destacado */}
      <div style={{ borderTop: '1px dashed #000', margin: '6px 0 4px 0', paddingTop: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '900' }}>
          <span>TOTAL A PAGAR:</span>
          <span>${formatMoney(sale.total)}</span>
        </div>
      </div>

      {/* Desglose de Pago e Información Adicional */}
      <div style={{ borderTop: '1px dashed #000', marginTop: '6px', paddingTop: '6px', fontSize: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span style={{ color: '#333' }}>Método de Pago:</span>
          <span style={{ fontWeight: 'bold' }}>{sale.payment_method}</span>
        </div>

        {sale.payment_method === 'Mixto' && (
          <div style={{ margin: '4px 0', fontSize: '9.5px', border: '1px dashed #666', padding: '3px 5px', borderRadius: '3px', background: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>💵 Efectivo:</span>
              <span style={{ fontWeight: 'bold' }}>${formatMoney(sale.cash_amount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span>📱 Transferencia:</span>
              <span style={{ fontWeight: 'bold' }}>${formatMoney(sale.transfer_amount)}</span>
            </div>
          </div>
        )}

        {sale.customer_name && !isAbono && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ color: '#333' }}>Cliente / Referencia:</span>
            <span style={{ fontWeight: 'bold' }}>{sale.customer_name}</span>
          </div>
        )}

        {/* Mensaje al Pie */}
        <p style={{ marginTop: '10px', textAlign: 'center', fontSize: '9px', fontStyle: 'italic', lineHeight: '1.3' }}>
          {config?.footer_message || '¡Muchas gracias por su compra! Vuelva pronto.'}
        </p>
      </div>
    </div>
  );
};

import { API_URL, getImageUrl, THEMES, getLocalTodayStr } from './utils/constants';
import PrintableShiftTicket from './components/PrintableShiftTicket';
import InventoryManager from './components/InventoryManager';
import DailyReport from './components/DailyReport';
import SettingsForm from './components/SettingsForm';
import AccountingManager from './components/AccountingManager';
import ShiftsReport from './components/ShiftsReport';
import CartaDigital from './components/CartaDigital';
import RemindersManager from './components/RemindersManager';
import QRCode from 'qrcode';

const getTableTimeStats = (createdAt) => {
  if (!createdAt) return { label: 'Reciente', minutes: 0, level: 'normal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
  try {
    const raw = String(createdAt);
    const dateParsed = new Date(raw.endsWith('Z') ? raw : (raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z'));
    const startMs = isNaN(dateParsed.getTime()) ? new Date(raw).getTime() : dateParsed.getTime();
    if (isNaN(startMs)) return { label: 'Reciente', minutes: 0, level: 'normal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
    
    const diffMs = Math.max(0, Date.now() - startMs);
    const totalMinutes = Math.floor(diffMs / 60000);
    
    let label = '';
    if (totalMinutes < 1) {
      label = '< 1 min';
    } else if (totalMinutes < 60) {
      label = totalMinutes + ' min';
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      label = hours + 'h ' + mins + 'm';
    }

    if (totalMinutes < 45) {
      return {
        label,
        minutes: totalMinutes,
        level: 'normal',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.3)'
      };
    } else if (totalMinutes < 90) {
      return {
        label,
        minutes: totalMinutes,
        level: 'medium',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.35)'
      };
    } else {
      return {
        label,
        minutes: totalMinutes,
        level: 'long',
        color: '#f43f5e',
        bg: 'rgba(244, 63, 94, 0.15)',
        border: 'rgba(244, 63, 94, 0.4)'
      };
    }
  } catch (e) {
    return { label: 'Reciente', minutes: 0, level: 'normal', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
  }
};

const App = () => {
  const isMenuRoute = typeof window !== 'undefined' && (
    window.location.pathname === '/carta' ||
    window.location.pathname.startsWith('/carta/') ||
    window.location.hash.startsWith('#/carta') ||
    window.location.search.includes('view=carta')
  );

  if (isMenuRoute) {
    return <CartaDigital />;
  }
  const [view, setView] = useState('pos');
  const [reminderBadgeCount, setReminderBadgeCount] = useState(0); // 'pos', 'inventory', 'history', 'report', 'debts', 'settings'
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [config, setConfig] = useState({});

  // Notificaciones y Sincronización en Tiempo Real (SSE)
  const [realtimeToasts, setRealtimeToasts] = useState([]);

  // Tick para refrescar el cronómetro de mesas en vivo cada 30 segundos
  const [tableTimerTick, setTableTimerTick] = useState(0);
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setTableTimerTick(t => t + 1);
    }, 30000);
    return () => clearInterval(timerInterval);
  }, []);

  // Modal de Carta Digital y Código QR para Mesas
  const [showQrMenuModal, setShowQrMenuModal] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [qrTargetMode, setQrTargetMode] = useState('ngrok'); // 'ngrok' o 'local'
  const [copiedQrLink, setCopiedQrLink] = useState(false);
  const [isSendingQrTelegram, setIsSendingQrTelegram] = useState(false);
  const [sentQrTelegramSuccess, setSentQrTelegramSuccess] = useState(false);

  useEffect(() => {
    if (showQrMenuModal) {
      fetch(`${API_URL}/network-info`)
        .then(res => res.json())
        .then(data => {
          setNetworkInfo(data);
          if (!data.ngrok_url) {
            setQrTargetMode('local');
          }
        })
        .catch(err => console.error('Error fetching network info:', err));
    }
  }, [showQrMenuModal]);

  useEffect(() => {
    if (!showQrMenuModal) return;
    const urlToEncode = qrTargetMode === 'ngrok' && networkInfo?.ngrok_url
      ? `${networkInfo.ngrok_url}/carta`
      : (networkInfo?.local_url ? `${networkInfo.local_url}/carta` : `${window.location.origin}/carta`);

    QRCode.toDataURL(urlToEncode, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.error('Error generating QR:', err));
  }, [showQrMenuModal, qrTargetMode, networkInfo]);

  const handleSendQrTelegram = async () => {
    if (!qrCodeDataUrl) return;
    const currentUrl = qrTargetMode === 'ngrok' && networkInfo?.ngrok_url
      ? `${networkInfo.ngrok_url}/carta`
      : (networkInfo?.local_url ? `${networkInfo.local_url}/carta` : `${window.location.origin}/carta`);

    setIsSendingQrTelegram(true);
    setSentQrTelegramSuccess(false);
    try {
      const res = await fetch(`${API_URL}/telegram/send-carta-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_data_url: qrCodeDataUrl,
          target_url: currentUrl,
          mode: qrTargetMode
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSentQrTelegramSuccess(true);
        showTemporaryNotification('📲 ¡Código QR enviado a tu Telegram con éxito!', 'success');
        setTimeout(() => setSentQrTelegramSuccess(false), 3500);
      } else {
        alert(data.error || 'No se pudo enviar el código QR a Telegram. Verifica la configuración de tu bot.');
      }
    } catch (err) {
      alert('Error de red al conectar con el servidor.');
    } finally {
      setIsSendingQrTelegram(false);
    }
  };

  const handlePrintTableQr = () => {
    const printWindow = window.open('', '_blank', 'width=650,height=750');
    if (!printWindow) {
      alert('Por favor permita las ventanas emergentes para imprimir el código QR de mesa.');
      return;
    }
    const currentUrl = qrTargetMode === 'ngrok' && networkInfo?.ngrok_url
      ? `${networkInfo.ngrok_url}/carta`
      : (networkInfo?.local_url ? `${networkInfo.local_url}/carta` : `${window.location.origin}/carta`);
    const wifi = config.digital_menu_wifi || '';
    const phone = config.digital_menu_phone || config.business_phone || '';
    const customMsg = config.digital_menu_message || '¡Escanea con la cámara de tu celular para ver el menú y precios en vivo!';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Rótulo de Mesa QR - ${config.business_name || 'Restaurante'}</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            @page {
              size: auto;
              margin: 10mm;
            }
            html, body {
              background: #f1f5f9;
              color: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justifyContent: center;
              min-height: 100vh;
              padding: 20px;
            }
            .card-wrapper {
              width: 100%;
              max-width: 320px;
              margin: 0 auto;
            }
            .card {
              width: 100%;
              border: 3.5px solid #0f172a;
              border-radius: 22px;
              padding: 24px 20px;
              text-align: center;
              background: #ffffff;
              box-shadow: 0 4px 20px rgba(0,0,0,0.08);
              position: relative;
              overflow: hidden;
            }
            .header-tag {
              display: inline-block;
              background: #0f172a !important;
              color: #ffffff !important;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              padding: 5px 14px;
              border-radius: 20px;
              margin-bottom: 12px;
            }
            .biz-name {
              font-size: 22px;
              font-weight: 900;
              color: #0f172a;
              margin: 0 0 4px 0;
              line-height: 1.2;
            }
            .biz-sub {
              font-size: 12px;
              color: #64748b;
              margin-bottom: 14px;
            }
            .qr-container {
              width: 180px;
              height: 180px;
              margin: 0 auto 14px auto;
              padding: 8px;
              background: #ffffff;
              border: 2px solid #e2e8f0;
              border-radius: 16px;
              display: flex;
              align-items: center;
              justifyContent: center;
            }
            .qr-img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              display: block;
            }
            .call-to-action {
              font-size: 13px;
              font-weight: 700;
              color: #1e293b;
              line-height: 1.4;
              margin: 0 0 12px 0;
            }
            .network-box {
              background: #f8fafc !important;
              border: 1px dashed #cbd5e1;
              border-radius: 12px;
              padding: 10px 12px;
              margin-top: 10px;
              text-align: left;
            }
            .info-row {
              font-size: 12px;
              color: #334155;
              line-height: 1.4;
              margin: 4px 0;
              display: flex;
              justifyContent: space-between;
              align-items: center;
              gap: 8px;
            }
            .info-row strong {
              color: #0f172a;
              font-weight: 700;
            }
            .info-row span {
              font-family: monospace;
              font-size: 12px;
              font-weight: 700;
              color: #0284c7;
              background: #e0f2fe !important;
              padding: 2px 6px;
              border-radius: 6px;
            }
            .footer-url {
              font-size: 9px;
              color: #94a3b8;
              font-family: monospace;
              margin-top: 14px;
              word-break: break-all;
            }
            .cut-guide {
              font-size: 10px;
              color: #94a3b8;
              margin-top: 14px;
              text-align: center;
            }
            @media print {
              body {
                background: #ffffff !important;
                padding: 0 !important;
                min-height: auto !important;
              }
              .card {
                box-shadow: none !important;
                page-break-inside: avoid !important;
              }
              .cut-guide {
                display: block;
              }
            }
          </style>
        </head>
        <body>
          <div class="card-wrapper">
            <div class="card">
              <span class="header-tag">🍽️ CARTA DIGITAL EN VIVO</span>
              <h1 class="biz-name">${config.business_name || 'Restaurante'}</h1>
              <p class="biz-sub">${config.business_address || 'Punto de Atención'}</p>
              
              <div class="qr-container">
                <img src="${qrCodeDataUrl}" class="qr-img" alt="QR Menú" />
              </div>

              <p class="call-to-action">${customMsg}</p>

              ${(wifi || phone) ? `
                <div class="network-box">
                  ${wifi ? `<div class="info-row">📶 <strong>Red Wi-Fi:</strong> <span>${wifi}</span></div>` : ''}
                  ${phone ? `<div class="info-row">📞 <strong>Pedidos / WhatsApp:</strong> <span>${phone}</span></div>` : ''}
                </div>
              ` : ''}

              <p class="footer-url">${currentUrl}</p>
            </div>
            <p class="cut-guide">✂️ Recortar por el borde exterior para acrílico o porta-menú de mesa</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const addRealtimeToast = (toast) => {
    const id = Date.now() + Math.random();
    setRealtimeToasts(prev => [...prev.slice(-3), { ...toast, id }]);
    setTimeout(() => {
      setRealtimeToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Detección de Túnel Ngrok / Acceso Remoto por Internet
  const isNgrokRemote = typeof window !== 'undefined' && (
    window.location.hostname.includes('ngrok') ||
    window.location.hostname.includes('ngrok-free.app') ||
    window.location.hostname.includes('ngrok.io') ||
    window.location.hostname.includes('ngrok-free.dev') ||
    window.location.search.includes('remote=1')
  );

  const [isNgrokAuth, setIsNgrokAuth] = useState(() => {
    if (!isNgrokRemote) return true; // Acceso local en tienda no requiere este bloqueo
    return sessionStorage.getItem('ngrok_pos_authenticated') === 'true';
  });

  const [remotePin, setRemotePin] = useState('');
  const [showRemotePosLogin, setShowRemotePosLogin] = useState(false);
  const [remotePinError, setRemotePinError] = useState('');
  const [showRemotePin, setShowRemotePin] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Modo Computador (vista ancha para celulares): Solo aplica si se ingresa por túnel Ngrok
  const [forceDesktopMode, setForceDesktopMode] = useState(() => {
    if (!isNgrokRemote) return false;
    const saved = localStorage.getItem('force_desktop_mode');
    if (saved !== null) return saved === 'true';
    return true; // Por defecto activo al conectar remotamente por Ngrok
  });

  const toggleDesktopMode = () => {
    const nextVal = !forceDesktopMode;
    setForceDesktopMode(nextVal);
    localStorage.setItem('force_desktop_mode', String(nextVal));
  };

  const handleUnlockRemote = async (e) => {
    if (e) e.preventDefault();
    setIsUnlocking(true);
    setRemotePinError('');
    try {
      const res = await fetch(`${API_URL}/auth/verify-admin-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: remotePin })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        sessionStorage.setItem('ngrok_pos_authenticated', 'true');
        setIsNgrokAuth(true);
        setRemotePin('');
      } else {
        setRemotePinError(data.message || 'Contraseña incorrecta. Acceso no autorizado.');
      }
    } catch (err) {
      setRemotePinError('Error de conexión al verificar credenciales.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLockRemote = () => {
    sessionStorage.removeItem('ngrok_pos_authenticated');
    setIsNgrokAuth(false);
  };

  // ─── SISTEMA DE ROLES Y SEGURIDAD (ADMIN VS CAJERO) ───
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);
  const [showAdminPinText, setShowAdminPinText] = useState(false);
  const [pendingAdminAction, setPendingAdminAction] = useState(null);

  // ─── SISTEMA DE DEVOLUCIONES ───
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundSale, setRefundSale] = useState(null);
  const [refundItems, setRefundItems] = useState([]); // [{...saleItem, refundQty: 0, selected: false}]
  const [refundReturnToStock, setRefundReturnToStock] = useState(true);
  const [refundReason, setRefundReason] = useState('');
  const [refundPaymentMethod, setRefundPaymentMethod] = useState('Efectivo');
  const [refundUserName, setRefundUserName] = useState('');
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);
  const [refundError, setRefundError] = useState('');

  const openRefundModal = (sale) => {
    if (!sale.items || sale.items.length === 0) {
      alert('Esta venta no tiene artículos para procesar devolución.');
      return;
    }
    setRefundSale(sale);
    setRefundItems(sale.items.map(item => ({
      ...item,
      refundQty: 0,
      availableQty: item.quantity - (item.refunded_quantity || 0)
    })));
    setRefundReturnToStock(true);
    setRefundReason('');
    setRefundPaymentMethod(sale.payment_method === 'Fiado' ? 'Efectivo' : sale.payment_method || 'Efectivo');
    setRefundUserName('');
    setRefundError('');
    setShowRefundModal(true);
  };

  const refundTotal = refundItems.reduce((sum, ri) => sum + (ri.refundQty * ri.price), 0);
  const isFullRefundSelected = refundItems.every(ri => ri.refundQty >= ri.availableQty && ri.availableQty > 0);

  const handleProcessRefund = async () => {
    const itemsToRefund = refundItems.filter(ri => ri.refundQty > 0).map(ri => ({
      sale_item_id: ri.id,
      product_id: ri.product_id,
      product_name: ri.product_name,
      quantity: ri.refundQty,
      unit_price: ri.price
    }));
    if (itemsToRefund.length === 0) {
      setRefundError('Selecciona al menos un artículo con cantidad mayor a 0 para devolver.');
      return;
    }
    if (!refundReason) {
      setRefundError('Por favor selecciona el motivo de la devolución.');
      return;
    }
    setIsProcessingRefund(true);
    setRefundError('');
    try {
      const res = await fetch(`${API_URL}/sales/${refundSale.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemsToRefund,
          isFullRefund: isFullRefundSelected,
          returnToStock: refundReturnToStock,
          reason: refundReason,
          paymentMethod: refundPaymentMethod,
          userName: refundUserName || 'Cajero'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar devolución');
      setShowRefundModal(false);
      await fetchData();
      alert(`✅ Devolución #DEV-${data.refundId} procesada exitosamente.\n\n💵 Monto reembolsado: ${data.refundAmount.toLocaleString('es-CO')}\n📦 Stock restituido: ${refundReturnToStock ? 'Sí' : 'No'}\n\n📲 El dueño recibió una notificación detallada en Telegram.`);
    } catch (err) {
      setRefundError(err.message);
    } finally {
      setIsProcessingRefund(false);
    }
  };



  // Verificar sesión persistida de administrador
  useEffect(() => {
    const savedToken = sessionStorage.getItem('pos_admin_token');
    if (savedToken) {
      fetch(`${API_URL}/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: savedToken })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setIsAdmin(true);
            setAdminPassword(savedToken);
          } else {
            sessionStorage.removeItem('pos_admin_token');
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleAdminLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!adminPinInput.trim()) {
      setAdminPinError('Ingrese una contraseña o PIN');
      return;
    }
    setIsVerifyingAdmin(true);
    try {
      const res = await fetch(`${API_URL}/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPinInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const pin = adminPinInput.trim();
        setIsAdmin(true);
        setAdminPassword(pin);
        sessionStorage.setItem('pos_admin_token', pin);
        setShowAdminLoginModal(false);
        setAdminPinInput('');
        setAdminPinError('');
        showTemporaryNotification('👑 Modo Administrador activado', 'success');

        setTimeout(async () => {
          try {
            const headers = { 'x-admin-password': pin };
            const [pRes, cRes] = await Promise.all([
              fetch(`${API_URL}/products`, { headers }),
              fetch(`${API_URL}/config`, { headers })
            ]);
            if (pRes.ok) {
              const pData = await pRes.json();
              setProducts(Array.isArray(pData) ? pData : []);
            }
            if (cRes.ok) {
              const cData = await cRes.json();
              if (cData && typeof cData === 'object') setConfig(cData);
            }
          } catch (e) {}
        }, 50);

        if (pendingAdminAction) {
          const action = pendingAdminAction;
          setPendingAdminAction(null);
          action();
        }
      } else {
        setAdminPinError(data.error || 'Contraseña incorrecta');
      }
    } catch (err) {
      setAdminPinError('Error al comunicarse con el servidor');
    } finally {
      setIsVerifyingAdmin(false);
    }
  };

  const handleLogoutAdmin = () => {
    setIsAdmin(false);
    setAdminPassword('');
    sessionStorage.removeItem('pos_admin_token');
    showTemporaryNotification('👤 Modo Cajero activado', 'info');
    if (['settings', 'report', 'shifts'].includes(view)) {
      setView('pos');
    }
    setTimeout(fetchData, 50);
  };

  const requireAdminPin = (callback) => {
    if (isAdmin) {
      callback();
    } else {
      setPendingAdminAction(() => callback);
      setShowAdminLoginModal(true);
    }
  };
  const [sales, setSales] = useState([]);
  const [activeAccounts, setActiveAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null); // null = Venta Rápida
  const [paymentMethod, setPaymentMethod] = useState('Efectivo'); // 'Efectivo', 'Transferencia', 'Fiado', 'Mixto'
  const [mixedCash, setMixedCash] = useState('');
  const [mixedTransfer, setMixedTransfer] = useState('');
  const [debtorName, setDebtorName] = useState(''); // Nombre de la persona que fía (deudor)
  const [cashTendered, setCashTendered] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [modalAction, setModalAction] = useState(null);
  const [payDebtModal, setPayDebtModal] = useState(null); // Modal de cobro de deudas
  const [partialAmount, setPartialAmount] = useState(''); // Monto de abono
  const [debtPayMethod, setDebtPayMethod] = useState('Efectivo'); // Método de cobro seleccionado
  const [editDebtModal, setEditDebtModal] = useState(null); // Modal de edición de deudas
  const [editDebtForm, setEditDebtForm] = useState({ customer_name: '', total: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeShift, setActiveShift] = useState(null);
  const [shiftUserName, setShiftUserName] = useState('');
  const [shiftInitialCash, setShiftInitialCash] = useState('');
  const [shiftFinalCash, setShiftFinalCash] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [shiftStats, setShiftStats] = useState(null);
  const [saleToPrint, setSaleToPrint] = useState(null);
  const [postSaleModal, setPostSaleModal] = useState(null);
  const [printTicketOnCheckout, setPrintTicketOnCheckout] = useState(true);
  const [isHistorical, setIsHistorical] = useState(false);
  const [customDate, setCustomDate] = useState('');

  useEffect(() => {
    if (config?.print_mode === 'manual') {
      setPrintTicketOnCheckout(false);
    } else {
      setPrintTicketOnCheckout(true);
    }
  }, [config?.print_mode]);
  const [editDateModal, setEditDateModal] = useState(null);
  const [showTransferList, setShowTransferList] = useState(false);
  const [newDateInput, setNewDateInput] = useState('');
  const [adminPwdInput, setAdminPwdInput] = useState('');
  
  // Modal de Corrección de Venta (Exclusivo Administrador)
  const [editSaleModal, setEditSaleModal] = useState(null);
  const [editSalePaymentMethod, setEditSalePaymentMethod] = useState('Efectivo');
  const [editSaleMixedCash, setEditSaleMixedCash] = useState('');
  const [editSaleMixedTransfer, setEditSaleMixedTransfer] = useState('');
  const [editSaleCustomerName, setEditSaleCustomerName] = useState('');
  const [editSaleNotes, setEditSaleNotes] = useState('');
  const [isSavingSaleCorrection, setIsSavingSaleCorrection] = useState(false);
  const [editSaleError, setEditSaleError] = useState('');

  const [historyStartDate, setHistoryStartDate] = useState(() => getLocalTodayStr());
  const [historyEndDate, setHistoryEndDate] = useState(() => getLocalTodayStr());
  const [historyTypeFilter, setHistoryTypeFilter] = useState('all'); // 'all', 'debts', 'refunds'
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState('all'); // 'all', 'Efectivo', 'Transferencia', 'Mixto', 'Fiado'
  const [historyUserFilter, setHistoryUserFilter] = useState('all'); // 'all' or user_name
  const [cartViewMode, setCartViewMode] = useState(() => {
    try {
      return localStorage.getItem('pos_cart_view_mode') || 'rounds';
    } catch (e) {
      return 'rounds';
    }
  }); // 'rounds' | 'grouped'
  const [showTablesModal, setShowTablesModal] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [manualRoundCounter, setManualRoundCounter] = useState(1);
  const [currentOpenRound, setCurrentOpenRound] = useState(1);
  const [roundToCheckoutModal, setRoundToCheckoutModal] = useState(null);
  const [roundPaymentMethod, setRoundPaymentMethod] = useState('Efectivo');
  const [roundCashTendered, setRoundCashTendered] = useState('');
  const [roundMixedCash, setRoundMixedCash] = useState('');
  const [roundMixedTransfer, setRoundMixedTransfer] = useState('');
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitTab, setSplitTab] = useState('items'); // 'items' | 'equal'
  const [splitItemQuantities, setSplitItemQuantities] = useState({});
  const [splitEqualPeople, setSplitEqualPeople] = useState(2);
  const [splitPaymentMethod, setSplitPaymentMethod] = useState('Efectivo');
  const [splitCashTendered, setSplitCashTendered] = useState('');
  const [splitMixedCash, setSplitMixedCash] = useState('');
  const [splitMixedTransfer, setSplitMixedTransfer] = useState('');

  const handleSetCartViewMode = (mode) => {
    setCartViewMode(mode);
    try {
      localStorage.setItem('pos_cart_view_mode', mode);
    } catch (e) {}
  };
  
  // Custom Prompt Modal State
  const [promptConfig, setPromptConfig] = useState(null);
  const [promptValue, setPromptValue] = useState('');

  const customPrompt = (message, defaultValue = '', type = 'text') => {
    return new Promise((resolve) => {
      setPromptValue(defaultValue);
      setPromptConfig({ message, type, resolve });
    });
  };

  // Estados para membresía contable y bloqueo
  const [licenseStatus, setLicenseStatus] = useState({ isValid: true, reason: '', uuid: '', daysLeft: 999, expires: null, type: 'subscription' });
  const [activationTokenInput, setActivationTokenInput] = useState('');

  // Estados para notificaciones del lector de códigos de barras
  const [scanNotification, setScanNotification] = useState(null);

  // Efecto para inyectar dinámicamente el color del tema en el documento
  useEffect(() => {
    const themeName = config.theme_color || 'Azul Galáctico';
    const activeTheme = THEMES[themeName] || THEMES['Azul Galáctico'];
    
    const root = document.documentElement;
    root.style.setProperty('--primary-cyan', activeTheme.primary);
    root.style.setProperty('--primary-cyan-glow', activeTheme.glow);
    root.style.setProperty('--border-active', activeTheme.border);

    // Aplicar Modo Claro u Oscuro
    if (config.theme_mode === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }

    // Modo PC miniatura automático en celular
    if (isNgrokRemote && forceDesktopMode) {
      document.body.classList.add('desktop-viewport');
    } else {
      document.body.classList.remove('desktop-viewport');
    }
  }, [config.theme_color, config.theme_mode, isNgrokRemote, forceDesktopMode]);

  
  // Sincronizar ronda abierta actual según la mesa seleccionada
  useEffect(() => {
    const items = selectedAccountId === null
      ? cart
      : (activeAccounts.find(a => a.id === selectedAccountId)?.items || []);
    if (items.length > 0) {
      const rounds = items.map(i => i.round_num || 1);
      const maxR = Math.max(...rounds);
      const hasUnconfirmed = items.some(i => i.is_confirmed === false || i.is_confirmed === 0);
      setCurrentOpenRound(hasUnconfirmed ? maxR : maxR + 1);
    } else {
      setCurrentOpenRound(1);
    }
  }, [selectedAccountId]);

  // Configuración modular de Mesas y Rondas
  const isTablesEnabled = config?.enable_tables_system !== 'false';
  const isRoundsEnabled = isTablesEnabled && config?.enable_rounds_system !== 'false';
  const effectiveCartViewMode = isRoundsEnabled ? cartViewMode : 'grouped';

  // Si las mesas se desactivan desde Ajustes, asegurar que el foco vuelva a Venta Rápida
  useEffect(() => {
    if (!isTablesEnabled && selectedAccountId !== null) {
      setSelectedAccountId(null);
    }
  }, [isTablesEnabled, selectedAccountId]);

  // Cada vez que cambia la cuenta (mesa) seleccionada, pre-cargar el nombre para el fiado
  useEffect(() => {
    if (selectedAccountId !== null) {
      const activeAcc = activeAccounts.find(a => a.id === selectedAccountId);
      if (activeAcc) {
        setDebtorName(activeAcc.customer_name);
      }
    } else {
      setDebtorName('');
    }
  }, [selectedAccountId, activeAccounts]);

  // Escucha global del lector de códigos de barras USB
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (document.activeElement.id === 'barcode-search-input' && e.key === 'Enter') {
          handleBarcodeScanned(document.activeElement.value);
          document.activeElement.value = '';
          e.preventDefault();
        }
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 50) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'F9') {
        if (config?.enable_cash_drawer_button === 'true') {
          e.preventDefault();
          handleOpenCashDrawer();
          return;
        }
      }

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          handleBarcodeScanned(buffer);
          buffer = '';
          e.preventDefault();
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, selectedAccountId, activeAccounts, cart, config]);

  useEffect(() => {
    fetchData();

    // Sincronización multi-dispositivo en tiempo real (SSE)
    let eventSource = null;
    try {
      eventSource = new EventSource(`${API_URL}/events`);
      
      eventSource.onmessage = (e) => {
        try {
          if (!e.data || e.data.startsWith(':')) return; // ignorar heartbeat
          const eventData = JSON.parse(e.data);
          if (eventData.type === 'CONNECTED') return;

          // 1. Refrescar datos en memoria de inmediato
          fetchData();

          // 2. Emitir evento a componentes secundarios (ej: AccountingManager, Reportes)
          window.dispatchEvent(new CustomEvent('pos-realtime-event', { detail: eventData }));

          // 3. Mostrar Toast si trae mensaje descriptivo
          if (eventData.message) {
            let icon = '🔔';
            let color = 'var(--primary-cyan)';
            let title = 'Actualización en Vivo';

            if (eventData.type === 'REMINDER_DUE_ALARM') {
              icon = '⏰';
              color = '#f59e0b';
              title = '⏰ ¡Alerta de Recordatorio!';
              try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                  const ctx = new AudioCtx();
                  const now = ctx.currentTime;
                  const playTone = (freq, start, dur) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, start);
                    gain.gain.setValueAtTime(0.3, start);
                    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(start);
                    osc.stop(start + dur);
                  };
                  playTone(587.33, now, 0.18);
                  playTone(880.00, now + 0.2, 0.25);
                  playTone(1174.66, now + 0.45, 0.35);
                }
              } catch (e) {}
            } else if (eventData.type === 'REMINDER_CREATED') {
              icon = '🔔';
              color = '#38bdf8';
              title = '🔔 Recordatorio Agendado';
            } else if (eventData.type === 'EXPENSE_CREATED' || eventData.type === 'EXPENSE_DELETED') {
              icon = '💸';
              color = 'var(--warning-amber)';
              title = eventData.source === 'telegram' ? '📲 Gasto desde Telegram' : '💸 Gasto en Caja';
            } else if (eventData.type === 'PRODUCT_UPDATED' || eventData.type === 'PRODUCT_CREATED') {
              icon = eventData.type === 'PRODUCT_CREATED' ? '📦' : '🏷️';
              color = '#38bdf8';
              title = eventData.source === 'telegram' ? '📲 Catálogo (Telegram)' : '🏷️ Inventario';
            } else if (eventData.type === 'SALE_CREATED') {
              icon = '🛒';
              color = 'var(--success-emerald)';
              title = '🛒 Nueva Venta';
            } else if (eventData.type === 'REFUND_CREATED') {
              icon = '↩️';
              color = '#c084fc';
              title = '↩️ Devolución Procesada';
            } else if (eventData.type === 'SHIFT_OPENED' || eventData.type === 'SHIFT_CLOSED') {
              icon = '⏱️';
              color = '#60a5fa';
              title = 'Turno de Caja';
            }

            addRealtimeToast({
              icon,
              color,
              title,
              message: eventData.message
            });
          }
        } catch (err) {
          console.error('Error procesando evento en tiempo real:', err);
        }
      };

      eventSource.onerror = () => {
        // EventSource nativo reconecta automáticamente en segundo plano
      };
    } catch (err) {
      console.warn('SSE no soportado o error de conexión:', err);
    }

    const handleFocus = () => {
      fetchData();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [historyStartDate, historyEndDate]);

  const fetchRemindersSummary = async () => {
    try {
      const res = await fetch(`${API_URL}/reminders/summary`);
      if (res.ok) {
        const data = await res.json();
        setReminderBadgeCount(data.badgeCount || 0);
      }
    } catch (e) {}
  };

  const fetchData = async () => {
    try {
      let salesUrl = `${API_URL}/sales`;
      if (historyStartDate && historyEndDate) {
        salesUrl += `?startDate=${historyStartDate}&endDate=${historyEndDate}`;
      }

      const headers = adminPassword ? { 'x-admin-password': adminPassword } : {};

      const [prodRes, configRes, salesRes, accRes, licenseRes, shiftRes] = await Promise.all([
        fetch(`${API_URL}/products`, { headers }).catch(e => null),
        fetch(`${API_URL}/config`, { headers }).catch(e => null),
        fetch(salesUrl).catch(e => null),
        fetch(`${API_URL}/accounts`).catch(e => null),
        fetch(`${API_URL}/licensing/status`).catch(e => null),
        fetch(`${API_URL}/shifts/current`).catch(e => null)
      ]);

      if (prodRes && prodRes.ok) {
        const pData = await prodRes.json().catch(() => []);
        setProducts(Array.isArray(pData) ? pData : []);
      }
      if (configRes && configRes.ok) {
        const cData = await configRes.json().catch(() => ({}));
        if (cData && typeof cData === 'object') {
          setConfig(cData);
          if (cData.enable_reminders === 'true') {
            fetchRemindersSummary();
          }
        }
      }
      if (salesRes && salesRes.ok) {
        const sData = await salesRes.json().catch(() => []);
        setSales(Array.isArray(sData) ? sData : []);
      } else if (salesRes) {
        // En caso de respuesta con error del backend, asegurar que sales permanezca como arreglo vacío
        setSales(prev => Array.isArray(prev) ? prev : []);
      }
      if (accRes && accRes.ok) {
        const aData = await accRes.json().catch(() => []);
        setActiveAccounts(Array.isArray(aData) ? aData : []);
      }
      if (licenseRes && licenseRes.ok) {
        const lData = await licenseRes.json().catch(() => null);
        if (lData) setLicenseStatus(lData);
      }
      if (shiftRes && shiftRes.ok) {
        const shiftData = await shiftRes.json().catch(() => ({}));
        setActiveShift(shiftData?.currentShift || null);
      }
    } catch (err) {
      console.error('Error al recuperar datos del servidor:', err);
    }
  };

  const handleOpenShift = async () => {
    if (!shiftUserName.trim()) {
      alert("Ingrese el nombre del encargado.");
      return;
    }
    const cash = parseCOP(shiftInitialCash);
    try {
      const res = await fetch(`${API_URL}/shifts/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: shiftUserName.trim(), initial_cash: cash })
      });
      if (res.ok) {
        await fetchData();
        showTemporaryNotification("Turno abierto exitosamente.", "success");
      } else {
        alert("Error al abrir turno");
      }
    } catch(e) { alert("Error de red"); }
  };

  const handleOpenCloseShiftModal = async () => {
    try {
      const res = await fetch(`${API_URL}/shifts/current/stats`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "No hay un turno activo o error al consultar el arqueo.");
        return;
      }
      const data = await res.json();
      if (data && !data.error) {
        setShiftStats(data);
        setShowCloseShiftModal(true);
      } else {
        alert(data?.error || "Error al obtener datos del turno activo.");
      }
    } catch(e) {
      alert("Error de conexión al cargar resumen del turno");
    }
  };

  const handleCloseShift = async () => {
    if (shiftFinalCash === '') {
      alert("Ingrese el efectivo final contado en caja.");
      return;
    }
    const cash = parseCOP(shiftFinalCash);
    try {
      const res = await fetch(`${API_URL}/shifts/${activeShift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_cash: cash, notes: shiftNotes })
      });
      if (res.ok) {
        setActiveShift(null);
        setShowCloseShiftModal(false);
        setShiftFinalCash('');
        setShiftNotes('');
        setShiftUserName('');
        setShiftInitialCash('');
        await fetchData();
        showTemporaryNotification("Turno cerrado exitosamente.", "success");
      } else {
        alert("Error al cerrar turno");
      }
    } catch(e) { alert("Error de red"); }
  };

  const handleOpenCashDrawer = () => {
    triggerCashDrawerPulse();
    showTemporaryNotification('🪙 Pulso enviado: Cajón monedero abierto', 'success');
  };

  const handleActivateLicense = async () => {
    if (!activationTokenInput.trim()) {
      alert('Por favor pegue su clave de activación de un clic.');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_URL}/licensing/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: activationTokenInput.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setLicenseStatus(data.status);
        setActivationTokenInput('');
        showTemporaryNotification('¡Licencia activada de inmediato!', 'success');
        await fetchData();
      } else {
        const errData = await res.json();
        alert(`Error al activar: ${errData.error || 'Clave inválidía'}`);
      }
    } catch (err) {
      alert('Error de red al conectar con el servidor.');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copiado al portapapeles.');
  };

  const handleShutdown = async () => {
    if (confirm('¿Está seguro de apagar el servidor del Punto de Venta. Esto cerrará las bases de datos y la conexión en segundo plano de forma segura.')) {
      try {
        fetch(`${API_URL}/system/shutdown`, { method: 'POST' }).catch(err => console.log('Apagado enviado', err));
        
        setModalAction({
          title: 'Sistema Cerrado de Forma Segura x R',
          message: 'El servidor en segundo plano se ha apagado con éxito y la base de datos SQLite se encuentra a salvo. Ya puede cerrar este navegador y apagar su computadora comercial de forma segura. ¡Gracias!',
          onConfirm: () => {
            window.close();
            document.body.innerHTML = `
              <div style="background:#070b13;color:#94a3b8;min-height:100vh;display:flex;justify-content:center;align-items:center;font-family:sans-serif;text-align:center;">
                <div>
                  <h1 style="color:#f8fafc;margin-bottom:16px;font-size:2rem;font-family:Outfit,sans-serif;">POS APAGADO CON ÉXITO x R</h1>
                  <p style="color:#64748b;font-size:1rem;">La base de datos SQLite se ha cerrado de forma segura.</p>
                  <p style="color:#64748b;margin-top:12px;">Ya puede apagar este computador comercial.</p>
                </div>
              </div>
            `;
          }
        });
      } catch (err) {
        alert('Error inesperado al apagar.');
      }
    }
  };

  const handleBarcodeScanned = (barcode) => {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return;

    const matchedProduct = products.find(p => p.barcode === cleanBarcode);
    
    if (matchedProduct) {
      if (matchedProduct.stock <= 0) {
        showTemporaryNotification(`Alerta: Sin stock de ${matchedProduct.name}`, 'error');
        return;
      }
      addToCart(matchedProduct);
      showTemporaryNotification(`Escaneado: ${matchedProduct.name}`, 'success');
    } else {
      showTemporaryNotification(`Código no registrado: ${cleanBarcode}`, 'error');
    }
  };

  const showTemporaryNotification = (message, type = 'success') => {
    setScanNotification({ message, type });
    setTimeout(() => setScanNotification(null), 3000);
  };

  
  // Función para calcular existencias comprometidas en TODO el negocio (Venta Rápida + Todas las Mesas)
  const getCommittedUnits = (productId) => {
    let committed = 0;
    // 1. Unidades en Venta Rápida
    (cart || []).forEach(item => {
      if ((item.product_id || item.id) === productId) {
        committed += (Number(item.quantity) || 0);
      }
    });
    // 2. Unidades en TODAS las mesas activas
    (activeAccounts || []).forEach(acc => {
      (acc.items || []).forEach(item => {
        if ((item.product_id || item.id) === productId) {
          committed += (Number(item.quantity) || 0);
        }
      });
    });
    return committed;
  };

  const syncAccountItems = async (accountId, items) => {
    try {
      await fetch(`${API_URL}/accounts/${accountId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
    } catch (err) {
      console.error('Error al sincronizar mesa:', err);
    }
  };

  const addToCart = async (product) => {
    let quantityToAdd = 1;

    if (product.unit_type === 'kg') {
      const weightStr = await customPrompt(`Ingrese el peso en Kg para ${product.name} (ej. 1.358):`, "1.000");
      if (!weightStr) return;
      const weight = parseFloat(weightStr);
      if (isNaN(weight) || weight <= 0) {
        showTemporaryNotification('Peso inválido', 'error');
        return;
      }
      quantityToAdd = weight;
    }

    // =========================================================================
    // BLINDAJE DE INVENTARIO COMPROMETIDO (VENTA RÁPIDA + TODAS LAS MESAS)
    // =========================================================================
    const committedAlready = getCommittedUnits(product.id);
    if (config?.strict_inventory !== 'false' && (committedAlready + quantityToAdd) > product.stock) {
      const remainingAvailable = Math.max(0, product.stock - committedAlready);
      showTemporaryNotification(`Inventario comprometido: Hay ${product.stock} en existencia física (${committedAlready} ya apartados en mesas o venta rápida). Disponibles: ${remainingAvailable}`, 'error');
      return;
    }

    const nowIso = new Date().toISOString();

    if (selectedAccountId === null) {
      setCart(prev => {
        const currentRounds = prev.map(i => i.round_num || 1);
        const maxRound = currentRounds.length > 0 ? Math.max(...currentRounds) : 1;
        const targetRound = Math.max(maxRound, currentOpenRound);

        if (effectiveCartViewMode === 'rounds') {
          const existingInCurrentRound = prev.find(i => 
            i.id === product.id && 
            (i.round_num || 1) === targetRound && 
            (i.is_confirmed === false || i.is_confirmed === 0)
          );

          if (existingInCurrentRound) {
            const newQty = existingInCurrentRound.quantity + quantityToAdd;
            return prev.map(item => item === existingInCurrentRound ? { ...item, quantity: newQty } : item);
          }

          const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          return [...prev, {
            ...product,
            row_id: rowId,
            quantity: quantityToAdd,
            original_price: product.price,
            added_at: nowIso,
            round_num: targetRound,
            is_confirmed: false
          }];
        } else {
          const existing = prev.find(item => item.id === product.id);
          if (existing) {
            const newQty = existing.quantity + quantityToAdd;
            return prev.map(item => item === existing ? { ...item, quantity: newQty } : item);
          }
          const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          return [...prev, { ...product, row_id: rowId, quantity: quantityToAdd, original_price: product.price, added_at: nowIso, round_num: 1, is_confirmed: true }];
        }
      });
    } else {
      const account = activeAccounts.find(a => a.id === selectedAccountId);
      if (!account) return;

      const newItems = [...account.items];
      const currentRounds = newItems.map(i => i.round_num || 1);
      const maxRound = currentRounds.length > 0 ? Math.max(...currentRounds) : 1;
      const targetRound = Math.max(maxRound, currentOpenRound);

      if (effectiveCartViewMode === 'rounds') {
        const existingInCurrentRound = newItems.find(i => 
          (i.product_id || i.id) === product.id && 
          (i.round_num || 1) === targetRound && 
          (i.is_confirmed === false || i.is_confirmed === 0)
        );

        if (existingInCurrentRound) {
          const newQty = existingInCurrentRound.quantity + quantityToAdd;
          existingInCurrentRound.quantity = newQty;
        } else {
          const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          newItems.push({
            row_id: rowId,
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            cost_price: product.cost_price || 0,
            quantity: quantityToAdd,
            original_price: product.price,
            added_at: nowIso,
            round_num: targetRound,
            is_confirmed: false
          });
        }
      } else {
        const existing = newItems.find(item => (item.product_id || item.id) === product.id);
        if (existing) {
          const newQty = existing.quantity + quantityToAdd;
          existing.quantity = newQty;
        } else {
          const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          newItems.push({
            row_id: rowId,
            product_id: product.id,
            product_name: product.name,
            price: product.price,
            cost_price: product.cost_price || 0,
            quantity: quantityToAdd,
            original_price: product.price,
            added_at: nowIso,
            round_num: 1,
            is_confirmed: true
          });
        }
      }

      const updatedAccounts = activeAccounts.map(a => a.id === selectedAccountId ? { ...a, items: newItems } : a);
      setActiveAccounts(updatedAccounts);
      syncAccountItems(selectedAccountId, newItems);
    }
  };

  const removeFromCart = (itemIdentifier) => {
    if (selectedAccountId === null) {
      setCart(prev => prev.filter(item => (item.row_id || item.id) !== itemIdentifier && item.id !== itemIdentifier));
    } else {
      const account = activeAccounts.find(a => a.id === selectedAccountId);
      if (!account) return;

      const newItems = account.items.filter(item => (item.row_id || item.id) !== itemIdentifier && item.id !== itemIdentifier && item.product_id !== itemIdentifier);
      const updatedAccounts = activeAccounts.map(a => a.id === selectedAccountId ? { ...a, items: newItems } : a);
      setActiveAccounts(updatedAccounts);
      syncAccountItems(selectedAccountId, newItems);
    }
  };

  const updateQuantity = (itemIdentifier, amount) => {
    const allCartItems = selectedAccountId === null
      ? cart
      : (activeAccounts.find(a => a.id === selectedAccountId)?.items || []);

    const matchedItem = allCartItems.find(i => (i.row_id || i.id) === itemIdentifier || i.id === itemIdentifier);
    if (!matchedItem) return;

    const prodId = matchedItem.product_id || matchedItem.id;
    const matchedProduct = products.find(p => p.id === prodId);
    const maxStock = matchedProduct ? matchedProduct.stock : 9999;

    // Validación acumulativa global al sumar (Venta Rápida + Todas las Mesas)
    if (amount > 0 && config?.strict_inventory !== 'false') {
      const committedAlready = getCommittedUnits(prodId);
      if ((committedAlready + amount) > maxStock) {
        const remainingAvailable = Math.max(0, maxStock - committedAlready);
        showTemporaryNotification(`Inventario comprometido: Hay ${maxStock} en total (${committedAlready} ya apartados en mesas o venta rápida). Disponibles: ${remainingAvailable}`, 'error');
        return;
      }
    }

    if (selectedAccountId === null) {
      setCart(prev => {
        const itemIndex = prev.findIndex(i => (i.row_id || i.id) === itemIdentifier || i.id === itemIdentifier);
        if (itemIndex === -1) return prev;
        const item = prev[itemIndex];
        if (item.quantity + amount <= 0) {
          return prev.filter((_, idx) => idx !== itemIndex);
        }
        const updated = [...prev];
        updated[itemIndex] = { ...item, quantity: item.quantity + amount };
        return updated;
      });
    } else {
      const account = activeAccounts.find(a => a.id === selectedAccountId);
      if (!account) return;

      const itemIndex = account.items.findIndex(i => (i.row_id || i.id) === itemIdentifier || i.id === itemIdentifier);
      if (itemIndex === -1) return;
      const item = account.items[itemIndex];

      if (item.quantity + amount <= 0) {
        const newItems = account.items.filter((_, idx) => idx !== itemIndex);
        const updatedAccounts = activeAccounts.map(a => a.id === selectedAccountId ? { ...a, items: newItems } : a);
        setActiveAccounts(updatedAccounts);
        syncAccountItems(selectedAccountId, newItems);
        return;
      }

      const newItems = [...account.items];
      newItems[itemIndex] = { ...item, quantity: item.quantity + amount };
      const updatedAccounts = activeAccounts.map(a => a.id === selectedAccountId ? { ...a, items: newItems } : a);
      setActiveAccounts(updatedAccounts);
      syncAccountItems(selectedAccountId, newItems);
    }
  };

  const confirmCurrentRound = (roundNumToConfirm) => {
    if (selectedAccountId === null) {
      setCart(prev => prev.map(item => {
        if ((item.round_num || 1) === roundNumToConfirm) {
          return { ...item, is_confirmed: true };
        }
        return item;
      }));
      setCurrentOpenRound(roundNumToConfirm + 1);
      showTemporaryNotification(`Ronda #${roundNumToConfirm} confirmada con éxito`, 'success');
    } else {
      const account = activeAccounts.find(a => a.id === selectedAccountId);
      if (!account) return;

      const newItems = account.items.map(item => {
        if ((item.round_num || 1) === roundNumToConfirm) {
          return { ...item, is_confirmed: true };
        }
        return item;
      });

      const updatedAccounts = activeAccounts.map(a => a.id === selectedAccountId ? { ...a, items: newItems } : a);
      setActiveAccounts(updatedAccounts);
      syncAccountItems(selectedAccountId, newItems);
      setCurrentOpenRound(roundNumToConfirm + 1);
      showTemporaryNotification(`Ronda #${roundNumToConfirm} confirmada para la mesa`, 'success');
    }
  };

  const moveItemToRound = (itemKey, targetRound) => {
    let targetNum = parseInt(targetRound, 10);
    if (targetRound === 'new') {
      const allRounds = currentCart.map(i => i.round_num || 1);
      targetNum = (allRounds.length > 0 ? Math.max(...allRounds) : 1) + 1;
    }

    if (isNaN(targetNum) || targetNum < 1) return;

    if (selectedAccountId === null) {
      setCart(prev => prev.map(item => {
        const key = item.row_id || item.id;
        if (key === itemKey || item.id === itemKey) {
          return { ...item, round_num: targetNum };
        }
        return item;
      }));
      showTemporaryNotification(`Producto reasignado a Ronda #${targetNum}`, 'info');
    } else {
      const account = activeAccounts.find(a => a.id === selectedAccountId);
      if (!account) return;

      const newItems = account.items.map(item => {
        const key = item.row_id || item.id;
        if (key === itemKey || item.id === itemKey) {
          return { ...item, round_num: targetNum };
        }
        return item;
      });

      const updatedAccounts = activeAccounts.map(a => a.id === selectedAccountId ? { ...a, items: newItems } : a);
      setActiveAccounts(updatedAccounts);
      syncAccountItems(selectedAccountId, newItems);
      showTemporaryNotification(`Producto reasignado a Ronda #${targetNum}`, 'info');
    }
  };

  const createAccount = async () => {
    const nextNum = activeAccounts.length + 1;
    const name = await customPrompt('Nombre o número de la Mesa / Cuenta:', `Mesa ${nextNum}`);
    if (!name) return;
    try {
      const res = await fetch(`${API_URL}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: name })
      });
      const newAccount = await res.json();
      setActiveAccounts([...activeAccounts, newAccount]);
      setSelectedAccountId(newAccount.id);
    } catch (err) {
      alert('Error al abrir la mesa.');
    }
  };

  const editAccount = async (id, currentName, e) => {
    e.stopPropagation();
    const newName = await customPrompt('Nuevo nombre de la mesa/cuenta:', currentName);
    if (!newName || newName === currentName) return;
    try {
      const res = await fetch(`${API_URL}/accounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: newName })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      alert('Error al editar mesa.');
    }
  };

  const deleteAccount = async (id, e) => {
    e.stopPropagation();
    if (confirm('¿Seguro que quieres eliminar esta mesa?')) {
      const pwd = await customPrompt('Ingrese Contraseña de Administrador para eliminar:', '', 'password');
      if (pwd !== (config.admin_password || '1234')) {
        alert('Contraseña incorrecta. Acción cancelada.');
        return;
      }
      try {
        const res = await fetch(`${API_URL}/accounts/${id}`, { method: 'DELETE' });
        if (res.ok) {
          if (selectedAccountId === id) setSelectedAccountId(null);
          fetchData();
        }
      } catch (err) {
        alert('Error al eliminar mesa.');
      }
    }
  };

  const deleteSaleFromHistory = async (id) => {
    if (!isAdmin) {
      requireAdminPin(() => deleteSaleFromHistory(id));
      return;
    }
    if (confirm('¿Seguro que quieres borrar este registro permanentemente del historial? (Se borrará incluso de la base de datos)')) {
      try {
        const res = await fetch(`${API_URL}/sales/${id}`, { 
          method: 'DELETE',
          headers: { 'x-admin-password': adminPassword }
        });
        if (res.ok) {
          fetchData();
          showTemporaryNotification('Registro eliminado del historial', 'info');
        } else {
          const err = await res.json();
          alert(err.error || 'Error al eliminar venta.');
        }
      } catch (err) {
        alert('Error de conexión con el servidor.');
      }
    }
  };

  const printReceipt = (sale) => {
    if (!sale) return;
    setSaleToPrint(sale);
    
    // Esperar un ciclo para que React monte o actualice el componente <PrintableTicket />
    setTimeout(() => {
      printThermalElement('printable-ticket', {
        ticketWidth: config?.ticket_width || '58mm',
        title: `Ticket_${sale.id || 'POS'}`
      });
    }, 120);
  };

  const handleTestPrint = (width) => {
    const testSale = {
      id: 'PRUEBA',
      created_at: new Date().toISOString(),
      user_name: 'Administrador (Prueba)',
      items: [
        { product_name: `Ticket de Prueba (${width || config?.ticket_width || '58mm'})`, quantity: 1, price: 1000 },
        { product_name: 'Conexión de Impresora Térmica OK', quantity: 1, price: 2000 }
      ],
      total: 3000,
      payment_method: 'Efectivo',
      customer_name: 'Comprobación de Sistema POS'
    };
    printReceipt(testSale);
  };

  const handlePostSalePrinting = (sale, total, change) => {
    if (!sale) return;
    const mode = config?.print_mode || 'ask';

    // Respeto absoluto a la voluntad del cajero para esta venta puntual:
    if (!printTicketOnCheckout) {
      // Si el establecimiento está configurado en auto o ask por defecto, restablecemos la casilla marcada para la próxima venta
      if (mode !== 'manual') {
        setPrintTicketOnCheckout(true);
      }
      return;
    }

    if (mode === 'auto') {
      printReceipt(sale);
    } else if (mode === 'ask') {
      setPostSaleModal({
        sale,
        total: total !== undefined ? total : sale.total,
        change: change !== undefined ? change : 0
      });
    } else if (mode === 'manual') {
      // El negocio está en manual en Ajustes, pero el cajero activó la casilla para este cliente puntual
      printReceipt(sale);
      setPrintTicketOnCheckout(false); // Vuelve a su estado predeterminado apagado
    }
  };

  useEffect(() => {
    if (!postSaleModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        printReceipt(postSaleModal.sale);
        setPostSaleModal(null);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPostSaleModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [postSaleModal]);

  const editItemPrice = async (itemIdentifier) => {
    const newPriceStr = await customPrompt("Ingrese el nuevo precio unitario para este artículo:", "", "number");
    if (!newPriceStr) return;
    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice) || newPrice < 0) {
      showTemporaryNotification('Precio inválido', 'error');
      return;
    }

    if (selectedAccountId === null) {
      setCart(prev => prev.map(item => {
        const key = item.row_id || item.id;
        if (key === itemIdentifier || item.id === itemIdentifier) {
          return { ...item, price: newPrice, original_price: item.original_price || item.price,
      round_num: item.round_num || 1,
      added_at: item.added_at || null,
      is_confirmed: item.is_confirmed !== undefined ? item.is_confirmed : true };
        }
        return item;
      }));
    } else {
      const account = activeAccounts.find(a => a.id === selectedAccountId);
      if (!account) return;
      const newItems = account.items.map(item => {
        const key = item.row_id || item.id;
        if (key === itemIdentifier || item.id === itemIdentifier) {
          return { ...item, price: newPrice, original_price: item.original_price || item.price };
        }
        return item;
      });
      const updatedAccounts = activeAccounts.map(a => a.id === selectedAccountId ? { ...a, items: newItems } : a);
      setActiveAccounts(updatedAccounts);
      syncAccountItems(selectedAccountId, newItems);
    }
  };

  const currentCart = selectedAccountId === null
    ? cart
    : (activeAccounts.find(a => a.id === selectedAccountId)?.items || []);

  const displayCart = React.useMemo(() => {
    if (cartViewMode !== 'grouped') return currentCart;
    const map = new Map();
    currentCart.forEach(item => {
      const prodId = item.product_id || item.id;
      const groupKey = `${prodId}_${item.price}`;
      if (!map.has(groupKey)) {
        map.set(groupKey, {
          ...item,
          quantity: item.quantity,
          roundsCount: 1,
          primaryKey: item.row_id || item.id
        });
      } else {
        const existing = map.get(groupKey);
        existing.quantity += item.quantity;
        existing.roundsCount += 1;
      }
    });
    return Array.from(map.values());
  }, [currentCart, cartViewMode]);

  // Agrupación estructurada de ítems en Bloques/Tarjetas por Ronda
  const roundsGrouped = React.useMemo(() => {
    const roundsMap = new Map();
    currentCart.forEach(item => {
      const rNum = item.round_num || 1;
      if (!roundsMap.has(rNum)) {
        roundsMap.set(rNum, {
          round_num: rNum,
          is_confirmed: item.is_confirmed !== undefined ? !!item.is_confirmed : true,
          added_at: item.added_at,
          items: []
        });
      }
      const r = roundsMap.get(rNum);
      r.items.push(item);
      if (item.is_confirmed === false || item.is_confirmed === 0) {
        r.is_confirmed = false;
      }
    });
    return Array.from(roundsMap.values()).sort((a, b) => a.round_num - b.round_num);
  }, [currentCart]);

  // Lista de todos los números de ronda existentes para el selector manual
  const allExistingRoundNumbers = React.useMemo(() => {
    const nums = Array.from(new Set(currentCart.map(i => i.round_num || 1))).sort((a, b) => a - b);
    return nums.length > 0 ? nums : [1];
  }, [currentCart]);

  const cartTotal = Math.round(currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0));
  const cartCostTotal = Math.round(currentCart.reduce((sum, item) => {
    const cost = item.cost_price || 0;
    return sum + (cost * item.quantity);
  }, 0));

  
  // Cobro exclusivo de una sola ronda
  const handleCheckoutSingleRound = async () => {
    if (!roundToCheckoutModal || roundToCheckoutModal.items.length === 0) return;
    setIsProcessing(true);

    const roundItems = roundToCheckoutModal.items;
    const total = roundToCheckoutModal.subtotal;
    const costTotal = roundItems.reduce((sum, item) => sum + ((item.cost_price || 0) * item.quantity), 0);

    const itemsFormatted = roundItems.map(item => ({
      id: item.product_id || item.id,
      name: item.product_name || item.name,
      price: item.price,
      cost_price: item.cost_price || 0,
      quantity: item.quantity,
      original_price: item.original_price || item.price,
      round_num: roundToCheckoutModal.round_num,
      added_at: item.added_at
    }));

    const body = {
      total,
      cost_total: costTotal,
      payment_method: roundPaymentMethod,
      payment_status: roundPaymentMethod === 'Fiado' ? 'pending' : 'paid',
      customer_name: roundPaymentMethod === 'Fiado' ? debtorName.trim() : null,
      items: itemsFormatted,
      shift_id: activeShift ? activeShift.id : null
    };

    if (roundPaymentMethod === 'Mixto') {
      const mc = parseCOP(roundMixedCash);
      const mt = parseCOP(roundMixedTransfer);
      if (mc + mt !== total) {
        alert(`La suma del efectivo ($${formatCOP(mc)}) y la transferencia ($${formatCOP(mt)}) debe ser igual al total de la ronda ($${formatCOP(total)}).`);
        setIsProcessing(false);
        return;
      }
      body.cash_amount = mc;
      body.transfer_amount = mt;
    } else if (roundPaymentMethod === 'Efectivo') {
      body.cash_amount = total;
      body.transfer_amount = 0;
    } else if (roundPaymentMethod === 'Transferencia') {
      body.cash_amount = 0;
      body.transfer_amount = total;
    }

    try {
      const res = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        // Remover los productos de esta ronda de la mesa
        if (selectedAccountId !== null) {
          const account = activeAccounts.find(a => a.id === selectedAccountId);
          if (account) {
            const remainingItems = account.items.filter(i => (i.round_num || 1) !== roundToCheckoutModal.round_num);
            if (remainingItems.length === 0) {
              await fetch(`${API_URL}/accounts/${selectedAccountId}`, { method: 'DELETE' });
              setSelectedAccountId(null);
              showTemporaryNotification(`¡Ronda #${roundToCheckoutModal.round_num} pagada! Todas las rondas liquidadas, mesa liberada.`, 'success');
            } else {
              await syncAccountItems(selectedAccountId, remainingItems);
              setActiveAccounts(prev => prev.map(a => a.id === selectedAccountId ? { ...a, items: remainingItems } : a));
              showTemporaryNotification(`Ronda #${roundToCheckoutModal.round_num} pagada con éxito. La mesa continúa abierta.`, 'success');
            }
          }
        } else {
          setCart(prev => prev.filter(i => (i.round_num || 1) !== roundToCheckoutModal.round_num));
          showTemporaryNotification(`Ronda #${roundToCheckoutModal.round_num} cobrada con éxito.`, 'success');
        }

        setRoundToCheckoutModal(null);
        setRoundCashTendered('');
        setRoundMixedCash('');
        setRoundMixedTransfer('');
        await fetchData();

        const newSale = await fetch(`${API_URL}/sales`).then(r => r.json()).then(data => data[0]);
        if (newSale) {
          setSaleToPrint(newSale);
          const chg = roundPaymentMethod === 'Efectivo' && roundCashTendered && parseCOP(roundCashTendered) > roundToCheckoutModal.subtotal
            ? parseCOP(roundCashTendered) - roundToCheckoutModal.subtotal
            : 0;
          handlePostSalePrinting(newSale, roundToCheckoutModal.subtotal, chg);
        }
      } else {
        alert('Error al registrar el cobro de la ronda.');
      }
    } catch (err) {
      alert('Error de conexión al procesar el cobro.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cobro parcial por selección de ítems (División de comensales)
  
  // Cobro de 1 parte equitativa
  const handleCheckoutEqualShare = async () => {
    const shareAmount = Math.round(cartTotal / splitEqualPeople);
    if (shareAmount <= 0) return;
    setIsProcessing(true);

    const body = {
      total: shareAmount,
      cost_total: 0,
      payment_method: splitPaymentMethod,
      payment_status: 'paid',
      customer_name: selectedAccountId !== null 
        ? `${activeAccounts.find(a => a.id === selectedAccountId)?.customer_name || 'Mesa'} (Parte 1/${splitEqualPeople})`
        : `Venta Parcial (1/${splitEqualPeople})`,
      items: [{
        id: null,
        name: `Pago parcial equitativo (1 de ${splitEqualPeople} partes)`,
        price: shareAmount,
        cost_price: 0,
        quantity: 1,
        original_price: shareAmount
      }],
      shift_id: activeShift ? activeShift.id : null
    };

    if (splitPaymentMethod === 'Efectivo') {
      body.cash_amount = shareAmount;
      body.transfer_amount = 0;
    } else if (splitPaymentMethod === 'Transferencia') {
      body.cash_amount = 0;
      body.transfer_amount = shareAmount;
    }

    try {
      const res = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        showTemporaryNotification(`Pago de 1 parte (${shareAmount.toLocaleString('es-CO')}) cobrado con éxito.`, 'success');
        setSplitEqualPeople(prev => Math.max(1, prev - 1));
        await fetchData();

        const newSale = await fetch(`${API_URL}/sales`).then(r => r.json()).then(data => data[0]);
        if (newSale) {
          setSaleToPrint(newSale);
          const chg = splitPaymentMethod === 'Efectivo' && splitCashTendered && parseCOP(splitCashTendered) > shareAmount
            ? parseCOP(splitCashTendered) - shareAmount
            : 0;
          handlePostSalePrinting(newSale, shareAmount, chg);
        }
      } else {
        alert('Error al registrar el cobro de la parte.');
      }
    } catch (e) {
      alert('Error de conexión.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getCartItemKey = (item, idx) => {
    return String(item.row_id || item.id || `${item.product_id || 'prod'}_${item.round_num || 1}_${idx}`);
  };

  const handleCheckoutSplitItems = async () => {
    const itemsToPay = [];
    let splitTotal = 0;
    let splitCostTotal = 0;

    currentCart.forEach((item, idx) => {
      const itemKey = getCartItemKey(item, idx);
      const qtyToPay = Number(splitItemQuantities[itemKey]) || 0;
      if (qtyToPay > 0) {
        const itemSubtotal = item.price * qtyToPay;
        splitTotal += itemSubtotal;
        splitCostTotal += (item.cost_price || 0) * qtyToPay;
        itemsToPay.push({
          id: item.product_id || item.id,
          name: item.product_name || item.name,
          price: item.price,
          cost_price: item.cost_price || 0,
          quantity: qtyToPay,
          original_price: item.original_price || item.price,
          round_num: item.round_num || 1,
          added_at: item.added_at
        });
      }
    });

    if (itemsToPay.length === 0 || splitTotal <= 0) {
      alert('Seleccione al menos un producto para cobrar a este cliente.');
      return;
    }

    setIsProcessing(true);

    const body = {
      total: splitTotal,
      cost_total: splitCostTotal,
      payment_method: splitPaymentMethod,
      payment_status: 'paid',
      customer_name: selectedAccountId !== null 
        ? `${activeAccounts.find(a => a.id === selectedAccountId)?.customer_name || 'Mesa'} (Pago Separado)`
        : 'Venta Rápida (Pago Separado)',
      items: itemsToPay,
      shift_id: activeShift ? activeShift.id : null
    };

    if (splitPaymentMethod === 'Mixto') {
      const mc = parseCOP(splitMixedCash);
      const mt = parseCOP(splitMixedTransfer);
      if (mc + mt !== splitTotal) {
        alert(`La suma del efectivo ($${formatCOP(mc)}) y la transferencia ($${formatCOP(mt)}) debe ser igual al total ($${formatCOP(splitTotal)}).`);
        setIsProcessing(false);
        return;
      }
      body.cash_amount = mc;
      body.transfer_amount = mt;
    } else if (splitPaymentMethod === 'Efectivo') {
      body.cash_amount = splitTotal;
      body.transfer_amount = 0;
    } else if (splitPaymentMethod === 'Transferencia') {
      body.cash_amount = 0;
      body.transfer_amount = splitTotal;
    }

    try {
      const res = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        // Descontar las cantidades pagadas de la mesa
        if (selectedAccountId !== null) {
          const account = activeAccounts.find(a => a.id === selectedAccountId);
          if (account) {
            let updatedItems = account.items.map((item, idx) => {
              const itemKey = getCartItemKey(item, idx);
              const paidQty = Number(splitItemQuantities[itemKey]) || 0;
              if (paidQty > 0) {
                return { ...item, quantity: item.quantity - paidQty };
              }
              return item;
            }).filter(i => i.quantity > 0);

            if (updatedItems.length === 0) {
              await fetch(`${API_URL}/accounts/${selectedAccountId}`, { method: 'DELETE' });
              setSelectedAccountId(null);
              setShowSplitModal(false);
              showTemporaryNotification('¡Cuenta pagada en su totalidad! Mesa liberada con éxito.', 'success');
            } else {
              await syncAccountItems(selectedAccountId, updatedItems);
              setActiveAccounts(prev => prev.map(a => a.id === selectedAccountId ? { ...a, items: updatedItems } : a));
              showTemporaryNotification(`Cobro parcial de $${splitTotal.toLocaleString('es-CO')} registrado. Continúa la cuenta restante.`, 'success');
            }
          }
        } else {
          let updatedCart = cart.map((item, idx) => {
            const itemKey = getCartItemKey(item, idx);
            const paidQty = Number(splitItemQuantities[itemKey]) || 0;
            if (paidQty > 0) {
              return { ...item, quantity: item.quantity - paidQty };
            }
            return item;
          }).filter(i => i.quantity > 0);
          setCart(updatedCart);
          if (updatedCart.length === 0) setShowSplitModal(false);
          showTemporaryNotification(`Cobro parcial de $${splitTotal.toLocaleString('es-CO')} registrado.`, 'success');
        }

        setSplitItemQuantities({});
        setSplitCashTendered('');
        setSplitMixedCash('');
        setSplitMixedTransfer('');
        await fetchData();

        const newSale = await fetch(`${API_URL}/sales`).then(r => r.json()).then(data => data[0]);
        if (newSale) {
          setSaleToPrint(newSale);
          const chg = splitPaymentMethod === 'Efectivo' && splitCashTendered && parseCOP(splitCashTendered) > splitTotal
            ? parseCOP(splitCashTendered) - splitTotal
            : 0;
          handlePostSalePrinting(newSale, splitTotal, chg);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert('Error al registrar el cobro parcial: ' + (errData.error || 'Verifique los datos'));
      }
    } catch (e) {
      alert('Error de conexión al procesar.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (currentCart.length === 0) return;
    
    if (paymentMethod === 'Fiado' && !debtorName.trim()) {
      alert('Por favor ingrese el nombre del cliente/vecino para registrar la cuenta de Fiado.');
      return;
    }

    setIsProcessing(true);

    const itemsFormatted = currentCart.map(item => ({
      id: item.product_id || item.id,
      name: item.product_name || item.name,
      price: item.price,
      cost_price: item.cost_price || 0,
      quantity: item.quantity,
      original_price: item.original_price || item.price
    }));

    const body = {
      total: cartTotal,
      cost_total: cartCostTotal,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'Fiado' ? 'pending' : 'paid',
      customer_name: paymentMethod === 'Fiado' ? debtorName.trim() : null,
      items: itemsFormatted,
      shift_id: (isHistorical && customDate) ? null : (activeShift ? activeShift.id : null),
      created_at: (isHistorical && customDate) ? customDate : null
    };

    if (paymentMethod === 'Mixto') {
      const mc = parseCOP(mixedCash);
      const mt = parseCOP(mixedTransfer);
      if (mc + mt !== cartTotal) {
        alert(`La suma del efectivo ($${formatCOP(mc)}) y la transferencia ($${formatCOP(mt)}) debe ser igual al total ($${formatCOP(cartTotal)}).`);
        setIsProcessing(false);
        return;
      }
      body.cash_amount = mc;
      body.transfer_amount = mt;
    } else if (paymentMethod === 'Efectivo') {
      body.cash_amount = cartTotal;
      body.transfer_amount = 0;
    } else if (paymentMethod === 'Transferencia') {
      body.cash_amount = 0;
      body.transfer_amount = cartTotal;
    }

    try {
      const res = await fetch(`${API_URL}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        if (selectedAccountId !== null) {
          await fetch(`${API_URL}/accounts/${selectedAccountId}`, { method: 'DELETE' });
          setSelectedAccountId(null);
        } else {
          setCart([]);
        }
        setDebtorName('');
        setCashTendered('');
        setPaymentMethod('Efectivo');
        setIsHistorical(false);
        setCustomDate('');
        setMixedCash('');
        setMixedTransfer('');
        await fetchData();
        showTemporaryNotification(paymentMethod === 'Fiado' ? 'Fiado registrado en Cartera con éxito.' : 'Mesa cobrada con éxito.');
        
        // Auto-asignar para impresion rápida y modo post-venta
        const newSale = await fetch(`${API_URL}/sales`).then(r => r.json()).then(data => data[0]);
        if (newSale) {
          setSaleToPrint(newSale);
          const chg = paymentMethod === 'Efectivo' && cashTendered && parseCOP(cashTendered) > cartTotal
            ? parseCOP(cashTendered) - cartTotal
            : 0;
          handlePostSalePrinting(newSale, cartTotal, chg);
        }
        
      } else {
        alert('Error al registrar la venta.');
      }
    } catch (err) {
      alert('Error de red al procesar.');
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelSale = (id) => {
    setModalAction({
      title: '¿Anular esta venta?',
      message: 'Se marcará la venta como Anulada y se reincorporarán automáticamente todas las cantidades físicas al inventario de la tienda.',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_URL}/sales/${id}/cancel`, { method: 'POST' });
          if (res.ok) {
            await fetchData();
            showTemporaryNotification('Venta anulada e inventario reabastecido.', 'success');
          } else {
            const data = await res.json();
            alert(`Error: ${data.error || 'No se pudo anular'}`);
          }
        } catch (e) {
          alert('Error de conexión.');
        }
      }
    });
  };

  const triggerPayDebt = (sale) => {
    setPayDebtModal(sale);
    setPartialAmount(formatCOPInput(sale.total));
    setDebtPayMethod('Efectivo');
  };

  const triggerEditDebt = (sale) => {
    setEditDebtModal(sale);
    setEditDebtForm({ customer_name: sale.customer_name || '', total: formatCOPInput(sale.total) });
  };

  const handleEditDebt = async (e) => {
    e.preventDefault();
    if (!editDebtModal) return;
    try {
      const res = await fetch(`${API_URL}/sales/${editDebtModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: editDebtForm.customer_name, total: parseCOP(editDebtForm.total) })
      });
      if (res.ok) {
        setEditDebtModal(null);
        await fetchData();
        showTemporaryNotification('Deuda actualizada.', 'success');
      } else {
        alert('Error al actualizar la deuda.');
      }
    } catch (err) {
      alert('Error de red.');
    }
  };

  const openEditSaleModal = (sale) => {
    if (!isAdmin) {
      requireAdminPin(() => openEditSaleModal(sale));
      return;
    }
    setEditSaleModal(sale);
    setEditSalePaymentMethod(sale.payment_method || 'Efectivo');
    if (sale.payment_method === 'Mixto') {
      setEditSaleMixedCash(sale.cash_amount !== null && sale.cash_amount !== undefined ? String(sale.cash_amount) : '');
      setEditSaleMixedTransfer(sale.transfer_amount !== null && sale.transfer_amount !== undefined ? String(sale.transfer_amount) : '');
    } else {
      setEditSaleMixedCash('');
      setEditSaleMixedTransfer('');
    }
    setEditSaleCustomerName(sale.customer_name || '');
    setEditSaleNotes('');
    setEditSaleError('');
  };

  const handleSaveSaleCorrection = async (e) => {
    if (e) e.preventDefault();
    if (!editSaleModal) return;
    setEditSaleError('');

    const saleTotal = Number(editSaleModal.total) || 0;
    let mCash = 0;
    let mTransfer = 0;

    if (editSalePaymentMethod === 'Mixto') {
      mCash = parseCOP(editSaleMixedCash);
      mTransfer = parseCOP(editSaleMixedTransfer);
      if (Math.round(mCash + mTransfer) !== Math.round(saleTotal)) {
        setEditSaleError(`La suma de Efectivo ($${mCash.toLocaleString('es-CO')}) y Transferencia ($${mTransfer.toLocaleString('es-CO')}) debe ser exactamente igual a $${saleTotal.toLocaleString('es-CO')}.`);
        return;
      }
    }

    if (editSalePaymentMethod === 'Fiado' && !editSaleCustomerName.trim()) {
      setEditSaleError('Debe ingresar el nombre del cliente/deudor para registrar esta venta como Fiado.');
      return;
    }

    setIsSavingSaleCorrection(true);
    try {
      const res = await fetch(`${API_URL}/sales/${editSaleModal.id}/correction`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword || sessionStorage.getItem('pos_admin_token') || ''
        },
        body: JSON.stringify({
          payment_method: editSalePaymentMethod,
          mixed_cash: mCash,
          mixed_transfer: mTransfer,
          customer_name: editSaleCustomerName.trim(),
          notes: editSaleNotes.trim(),
          admin_name: 'Administrador'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEditSaleModal(null);
        showTemporaryNotification('✅ Venta y arqueo de caja actualizados con éxito', 'success');
        await fetchData();
      } else {
        setEditSaleError(data.error || 'Error al guardar la corrección');
      }
    } catch (err) {
      setEditSaleError('Error de red al comunicarse con el servidor');
    } finally {
      setIsSavingSaleCorrection(false);
    }
  };

  const triggerEditDate = (sale) => {
    setEditDateModal(sale);
    const dbDate = new Date(sale.created_at + 'Z');
    const localDateStr = new Date(dbDate.getTime() - (dbDate.getTimezoneOffset() * 60000)).toISOString().substring(0, 16);
    setNewDateInput(localDateStr);
    setAdminPwdInput('');
  };

  const handleEditDateSubmit = async (e) => {
    e.preventDefault();
    if (!editDateModal || !newDateInput) return;
    if (adminPwdInput !== (config.admin_password || '1234')) {
      alert('Contraseña incorrecta. Acción cancelada.');
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/sales/${editDateModal.id}/date`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_at: newDateInput })
      });
      if (res.ok) {
        setEditDateModal(null);
        await fetchData();
        showTemporaryNotification('Fecha actualizada. Registro desvinculado del turno actual.', 'success');
      } else {
        alert('Error al actualizar la fecha.');
      }
    } catch (err) {
      alert('Error de red.');
    }
  };

  const confirmAndPayDebt = async () => {
    if (!payDebtModal) return;
    if (!activeShift) {
      alert('⚠️ Debes tener un turno de caja abierto para poder registrar cobros o abonos.');
      return;
    }
    const amount = parseCOP(partialAmount);
    const debtTotal = Math.round(Number(payDebtModal.total) || 0);
    if (!amount || amount <= 0) {
      alert('Por favor ingrese un monto válido a cobrar.');
      return;
    }
    if (amount > debtTotal) {
      alert(`El monto no puede exceder el saldo total pendiente (${formatCOP(debtTotal, true)}).`);
      return;
    }

    const isFull = amount >= debtTotal;
    const actionLabel = isFull ? 'LIQUIDAR LA TOTALIDAD' : 'REGISTRAR UN ABONO PARCIAL';
    const confirmMessage = `¿Confirmas ${actionLabel} de ${formatCOP(amount, true)} en ${debtPayMethod} para "${payDebtModal.customer_name}"?\n\nEsta acción sumará el dinero al turno de caja actual.`;

    if (window.confirm(confirmMessage)) {
      await handlePayDebt(debtPayMethod);
    }
  };

  const handlePayDebt = async (method) => {
    if (!payDebtModal) return;
    try {
      const debtTotal = Math.round(Number(payDebtModal.total) || 0);
      const amount = parseCOP(partialAmount) || debtTotal;
      const cashAmt = method === 'Efectivo' ? amount : null;
      const transAmt = method === 'Transferencia' ? amount : null;

      const res = await fetch(`${API_URL}/sales/${payDebtModal.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payment_method: method, 
          shift_id: activeShift ? activeShift.id : null, 
          partial_amount: amount,
          cash_amount: cashAmt,
          transfer_amount: transAmt
        })
      });
      if (res.ok) {
        setPayDebtModal(null);
        await fetchData();
        showTemporaryNotification('Cobro registrado exitosamente. Dinero cargado a caja.', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Error al liquidar la deuda.');
      }
    } catch (err) {
      alert('Error de red.');
    }
  };

  const triggerRevertPayment = async (sale) => {
    const isAbono = sale.customer_name && sale.customer_name.startsWith('Abono:');
    const targetName = sale.customer_name || 'este cliente';
    const confirmMsg = isAbono
      ? `¿Estás seguro de REVERTIR este abono parcial de ${sale.total.toLocaleString()} para "${targetName}"?\n\nEl dinero se descontará del turno de caja y se reintegrará a la deuda pendiente.`
      : `¿Estás seguro de REVERTIR el cobro de ${sale.total.toLocaleString()} para "${targetName}"?\n\nLa cuenta volverá a aparecer como PENDIENTE en Créditos y se descontará del turno actual.`;

    if (!window.confirm(confirmMsg)) return;

    const pwd = await customPrompt('Ingrese Contraseña de Administrador para autorizar la reversión:', '', 'password');
    if (pwd !== (config.admin_password || '1234')) {
      alert('Contraseña incorrecta. Acción cancelada.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/sales/${sale.id}/revert-payment`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await fetchData();
        showTemporaryNotification(data.message || 'Pago revertido con éxito.', 'success');
      } else {
        alert(`Error: ${data.error || 'No se pudo revertir el pago'}`);
      }
    } catch (err) {
      alert('Error de red al revertir el pago.');
    }
  };

  // BLOQUEO DE SEGURIDAD PARA ACCESO REMOTO VÍA NGROK
  if (isNgrokRemote && !isNgrokAuth) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 999999,
        fontFamily: "'Outfit', sans-serif"
      }}>
        <div style={{
          background: 'rgba(30, 41, 59, 0.9)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '24px',
          padding: '36px 28px',
          maxWidth: '430px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(56, 189, 248, 0.15)',
          textAlign: 'center',
          color: '#f8fafc'
        }}>
          {/* Lock Icon with neon cyan glow */}
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            color: 'var(--primary-cyan)',
            boxShadow: '0 0 25px rgba(56, 189, 248, 0.25)'
          }}>
            <Lock size={36} />
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(56, 189, 248, 0.15)',
            color: 'var(--primary-cyan)',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: '800',
            marginBottom: '12px',
            letterSpacing: '0.5px'
          }}>
            <Globe size={14} /> {config?.business_name ? config.business_name.toUpperCase() : 'SISTEMA POS REMOTO'}
          </div>

          <h2 style={{ fontSize: '1.45rem', fontWeight: '800', margin: '0 0 8px 0', color: '#ffffff' }}>
            Acceso Remoto al Sistema POS
          </h2>
          
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: '1.5' }}>
            Conexión por internet activa. Ingresa tu <strong>PIN o Contraseña de Administrador</strong> para operar el negocio a distancia.
          </p>

          <form onSubmit={handleUnlockRemote}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input
                type={showRemotePin ? 'text' : 'password'}
                autoFocus
                placeholder="Contraseña del sistema..."
                value={remotePin}
                onChange={(e) => { setRemotePin(e.target.value); setRemotePinError(''); }}
                style={{
                  width: '100%',
                  padding: '14px 44px 14px 16px',
                  borderRadius: '12px',
                  border: remotePinError ? '2px solid #ef4444' : '1px solid rgba(148, 163, 184, 0.3)',
                  background: '#0b1329',
                  color: '#ffffff',
                  fontSize: '1.05rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  textAlign: 'center',
                  letterSpacing: showRemotePin ? 'normal' : '4px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowRemotePin(!showRemotePin)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showRemotePin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {remotePinError && (
              <div style={{
                color: '#ef4444',
                fontSize: '0.84rem',
                fontWeight: '600',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                <AlertTriangle size={15} /> {remotePinError}
              </div>
            )}

            <button
              type="submit"
              disabled={!remotePin.trim() || isUnlocking}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                color: '#000',
                fontWeight: '900',
                fontSize: '1rem',
                border: 'none',
                cursor: (remotePin.trim() && !isUnlocking) ? 'pointer' : 'not-allowed',
                opacity: remotePin.trim() ? 1 : 0.6,
                boxShadow: '0 4px 15px rgba(56, 189, 248, 0.3)',
                transition: 'all 0.2s ease',
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              {isUnlocking ? 'Verificando...' : 'Desbloquear Sistema POS'}
            </button>

            <button
              type="button"
              onClick={() => { window.location.href = '/carta'; }}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '12px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#38bdf8',
                fontWeight: '700',
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              📋 ¿Eres cliente? Ver Carta Digital Pública
            </button>
          </form>

          <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '22px', marginBottom: 0 }}>
            🔒 Bloqueo de seguridad remoto • Tienda POS
          </p>
        </div>
      </div>
    );
  }

  if (!licenseStatus.isValid) {
    let blockTitle = 'Membresía Temporal Suspendidía ⏳';
    let blockDesc = `El plazo de uso autorizado del software ha finalizado (Fecha de vencimiento: ${licenseStatus.expires || 'N/A'}). Para continuar facturando y modificando su inventario, por favor solicite su código de renovación a soporte técnico.`;
    
    if (licenseStatus.reason === 'sin_licencia' || licenseStatus.reason === 'clave_invalida') {
      blockTitle = 'Habilitación de Software Requeridía x  ';
      blockDesc = 'Este sistema se encuentra listo para operar de forma local. Se requiere ingresar una clave de activación autorizada para desbloquear el Punto de Venta.';
    } else if (licenseStatus.reason === 'hardware_no_coincide') {
      blockTitle = 'Conflicto de Licencia de Hardware x ️';
      blockDesc = 'Alerta de Seguridad: Se ha detectado que los archivos del software fueron copiados o transferidos a una computadora diferente no registrada. Póngase en contacto con soporte técnico para habilitar este equipo.';
    } else if (licenseStatus.reason === 'tampering_reloj') {
      blockTitle = 'x  Alerta de Seguridad del Sistema';
      blockDesc = 'Manipulación de fecha detectadía: Se ha alterado o atrasado el reloj de Windows en este equipo. Por favor, reajuste el reloj a la hora y fecha correctas del día de hoy en su panel de Windows para restablecer el acceso.';
    }

    return (
      <div style={{
        background: '#070b13',
        color: '#94a3b8',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Inter, sans-serif',
        padding: '20px'
      }}>
        <div style={{
          background: '#101726',
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '40px',
          borderRadius: '16px',
          maxWidth: '550px',
          width: '100%',
          boxShadow: '0 10px 30pxrgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          textAlign: 'center'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Shield size={48} color="#f59e0b" />
          </div>
          <div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.8rem', color: '#f8fafc', fontWeight: '900' }}>
              {blockTitle}
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '12px', lineHeight: '1.6' }}>
              {blockDesc}
            </p>
          </div>

          {licenseStatus.reason !== 'tampering_reloj' ? (
            <>
              {/* Caja de Huella de Hardware */}
              <div style={{ background: '#070b13', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Huella de Hardware de este Equipo:
                </span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    value={licenseStatus.uuid} 
                    readOnly 
                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#f59e0b', fontSize: '0.85rem', fontFamily: 'monospace', outline: 'none', textAlign: 'center' }} 
                  />
                  <button 
                    onClick={() => copyToClipboard(licenseStatus.uuid)} 
                    style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    title="Copiar Huella al Portapapeles"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              {/* Formulario de Activación */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#f8fafc', textTransform: 'uppercase' }}>
                  Ingresar Clave de Activación:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Pegue el código de un clic recibido..." 
                    value={activationTokenInput} 
                    onChange={e => setActivationTokenInput(e.target.value)} 
                    style={{ flex: 1, background: '#070b13', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', color: '#f8fafc', fontSize: '0.85rem', fontFamily: 'monospace', outline: 'none' }}
                  />
                  <button 
                    onClick={handleActivateLicense} 
                    disabled={isProcessing}
                    style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', padding: '12px 20px', fontWeight: '900', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
                  >
                    {isProcessing ? 'PROCESANDO...' : 'ACTIVAR'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid #ef4444', padding: '16px', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem', lineHeight: '1.5' }}>
              Bloqueo de seguridad activo: La fecha de la computadora está en el pasado con respecto a sus transacciones. Comuníquese con soporte si requiere asistencia de base de datos.
            </div>
          )}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              x ~ SOPORTE TÉCNICO AUTORIZADO
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
              +57 301 566 5588
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!activeShift && licenseStatus.isValid) {
    return (
      <div style={{ background: '#070b13', color: '#f8fafc', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, sans-serif' }}>
        {modalAction && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(2, 6, 12, 0.75)', display: 'flex', justifyContent: 'center',
            alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(8px)'
          }}>
            <div style={{
              background: 'var(--bg-surface)', padding: '30px', borderRadius: 'var(--radius-lg)',
              maxWidth: '450px', width: '90%', border: '1px solid var(--border-glass)',
              boxShadow: 'var(--shadow-premium)', display: 'flex', flexDirection: 'column', gap: '20px'
            }}>
              <h3 style={{ margin: 0, color: 'var(--text-bright)', fontSize: '1.3rem' }}>{modalAction.title}</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>{modalAction.message}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                {!modalAction.onConfirm && <button onClick={() => setModalAction(null)} className="nav-btn active" style={{ padding: '8px 24px' }}>Aceptar</button>}
                {modalAction.onConfirm && (
                  <>
                    <button onClick={() => setModalAction(null)} className="nav-btn" style={{ padding: '8px 16px' }}>Cancelar</button>
                    <button onClick={() => { modalAction.onConfirm(); setModalAction(null); }} className="nav-btn active" style={{ padding: '8px 24px', background: 'var(--primary-cyan)', color: 'black' }}>Confirmar</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        <div style={{ background: 'var(--bg-card)', padding: '40px', borderRadius: '16px', maxWidth: '400px', width: '100%', textAlign: 'center', border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-premium)' }}>
          <h2 style={{ marginBottom: '20px', fontFamily: 'Outfit', color: 'var(--text-bright)' }}>Apertura de Caja</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nombre del Encargado:</label>
            <input type="text" value={shiftUserName} onChange={e=>setShiftUserName(e.target.value)} style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', outline: 'none' }} placeholder="Ej. Carlos" />
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Base / Efectivo Inicial:</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>$</span>
              <input 
                type="text" 
                inputMode="numeric" 
                value={shiftInitialCash} 
                onChange={e => setShiftInitialCash(formatCOPInput(e.target.value))} 
                style={{ width: '100%', padding: '12px 12px 12px 28px', borderRadius: '8px', background: 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', outline: 'none', fontVariantNumeric: 'tabular-nums', fontSize: '1.05rem', fontWeight: 'bold' }} 
                placeholder="0" 
              />
            </div>
            <button onClick={handleOpenShift} style={{ background: 'var(--primary-cyan)', color: 'black', padding: '12px', borderRadius: '8px', fontWeight: '900', cursor: 'pointer', marginTop: '10px', border: 'none', fontFamily: 'Outfit' }}>ABRIR TURNO</button>
            <button onClick={handleShutdown} style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger-rose)', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Power size={18} /> APAGAR SISTEMA
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-wrapper ${isNgrokRemote && forceDesktopMode ? 'force-desktop-wrapper' : ''}`}>
      <div className={`app-container ${isNgrokRemote && forceDesktopMode ? 'force-desktop-mode' : ''}`}>
      {modalAction && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 12, 0.75)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'var(--bg-surface)', padding: '30px', borderRadius: 'var(--radius-lg)',
            maxWidth: '450px', width: '90%', border: '1px solid var(--border-glass)',
            boxShadow: 'var(--shadow-premium)', display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bright)' }}>{modalAction.title}</h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>{modalAction.message}</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button onClick={() => setModalAction(null)} style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}>CANCELAR</button>
              <button onClick={() => { modalAction.onConfirm(); setModalAction(null); }} style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--danger-rose)', color: '#000', cursor: 'pointer', fontWeight: '900' }}>ANULAR VENTA</button>
            </div>
          </div>
        </div>
      )}

      {payDebtModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 12, 0.75)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'var(--bg-surface)', padding: '30px', borderRadius: 'var(--radius-lg)',
            width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px',
            border: '1px solid var(--border-glass)'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bright)' }}>Cobrar Cuenta / Fiado Pendiente</h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              Registrar el pago de la cuenta de <strong>{payDebtModal.customer_name}</strong> por un total de <strong>{formatCOP(payDebtModal.total, true)}</strong>.
            </p>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '700' }}>MONTO A ABONAR / PAGAR</p>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '1.2rem' }}>$</span>
                <input 
                  type="text" 
                  inputMode="numeric" 
                  value={partialAmount} 
                  onChange={e => setPartialAmount(formatCOPInput(e.target.value))} 
                  style={{ width: '100%', padding: '12px 12px 12px 32px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', background: 'var(--bg-dark)', color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums' }} 
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setPartialAmount(formatCOPInput(payDebtModal.total))}
                  style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '6px', background: 'var(--bg-dark)', border: '1px solid var(--border-glass)', color: 'var(--text-bright)', cursor: 'pointer', fontWeight: '700' }}
                >
                  Saldo Total ({formatCOP(payDebtModal.total, true)})
                </button>
                {payDebtModal.total > 10000 && (
                  <button 
                    type="button" 
                    onClick={() => setPartialAmount(formatCOPInput(Math.round(payDebtModal.total / 2)))}
                    style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '6px', background: 'var(--bg-dark)', border: '1px solid var(--border-glass)', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    50% ({formatCOP(Math.round(payDebtModal.total / 2), true)})
                  </button>
                )}
              </div>
            </div>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '700' }}>MÉTODO DE PAGO (SELECCIÓN)</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button"
                  onClick={() => setDebtPayMethod('Efectivo')} 
                  style={{ 
                    flex: 1, 
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: debtPayMethod === 'Efectivo' ? '#10b981' : 'var(--bg-dark)',
                    color: debtPayMethod === 'Efectivo' ? '#ffffff' : 'var(--text-muted)',
                    border: debtPayMethod === 'Efectivo' ? '2px solid #059669' : '1px solid var(--border-glass)',
                    fontWeight: '800',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: debtPayMethod === 'Efectivo' ? '0 0 15px rgba(16, 185, 129, 0.35)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {debtPayMethod === 'Efectivo' ? '✓ ' : ''}Efectivo 💵
                </button>
                <button 
                  type="button"
                  onClick={() => setDebtPayMethod('Transferencia')} 
                  style={{ 
                    flex: 1, 
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: debtPayMethod === 'Transferencia' ? '#0284c7' : 'var(--bg-dark)',
                    color: debtPayMethod === 'Transferencia' ? '#ffffff' : 'var(--text-muted)',
                    border: debtPayMethod === 'Transferencia' ? '2px solid #0369a1' : '1px solid var(--border-glass)',
                    fontWeight: '800',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: debtPayMethod === 'Transferencia' ? '0 0 15px rgba(2, 132, 199, 0.35)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {debtPayMethod === 'Transferencia' ? '✓ ' : ''}Transf. 📱
                </button>
              </div>
            </div>
            <button 
              type="button"
              onClick={confirmAndPayDebt}
              style={{ 
                width: '100%', 
                padding: '14px', 
                background: debtPayMethod === 'Efectivo' ? '#10b981' : '#0284c7', 
                color: '#ffffff',
                fontWeight: '900',
                fontSize: '1.05rem',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                boxShadow: debtPayMethod === 'Efectivo' ? '0 4px 15px rgba(16, 185, 129, 0.4)' : '0 4px 15px rgba(2, 132, 199, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              💰 Confirmar Cobro de {formatCOP(parseCOP(partialAmount) || 0, true)}
            </button>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setPayDebtModal(null)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
          </div>
        )}

      {editDateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 12, 0.75)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'var(--bg-surface)', padding: '30px', borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: '400px',
            border: '1px solid var(--border-glass)'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bright)' }}>Editar Fecha Histórica</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Si seleccionas una fecha anterior, el registro se separará del turno actual y desaparecerá el descuadre.
            </p>
            <form onSubmit={handleEditDateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label>Nueva Fecha y Hora</label>
                <input 
                  type="datetime-local" 
                  value={newDateInput} 
                  onChange={e => setNewDateInput(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>
              <div className="form-group">
                <label>Contraseña Administrador</label>
                <input 
                  type="password" 
                  value={adminPwdInput} 
                  onChange={e => setAdminPwdInput(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setEditDateModal(null)} className="nav-btn" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="nav-btn active" style={{ flex: 1, background: 'var(--primary-cyan)', color: '#000' }}>Guardar Fecha</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editDebtModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 12, 0.75)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'var(--bg-surface)', padding: '30px', borderRadius: 'var(--radius-lg)',
            width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px',
            border: '1px solid var(--border-glass)'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-bright)' }}>Editar Cuenta Pendiente</h3>
            <form onSubmit={handleEditDebt} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label>Nombre del Cliente</label>
                <input type="text" value={editDebtForm.customer_name} onChange={e => setEditDebtForm({...editDebtForm, customer_name: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Valor Pendiente</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>$</span>
                  <input 
                    type="text" 
                    inputMode="numeric" 
                    value={editDebtForm.total} 
                    onChange={e => setEditDebtForm({...editDebtForm, total: formatCOPInput(e.target.value)})} 
                    required 
                    style={{ width: '100%', paddingLeft: '28px', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold' }} 
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="nav-btn active" style={{ flex: 1, background: 'var(--primary-cyan)', color: '#000' }}>Guardar Cambios</button>
                <button type="button" onClick={() => setEditDebtModal(null)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Corrección de Venta (Exclusivo Administrador) */}
      {editSaleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(2, 6, 12, 0.8)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'var(--bg-surface)', padding: '28px', borderRadius: 'var(--radius-lg)', 
            width: '95%', maxWidth: '480px', border: '1px solid var(--border-glass)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit2 size={20} color="var(--primary-cyan)" /> Corregir Venta #TKT-{editSaleModal.id}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Total: <strong style={{ color: 'var(--primary-cyan)' }}>${formatMoney(editSaleModal.total)}</strong> | Fecha: {formatSafeDate(editSaleModal.created_at)}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setEditSaleModal(null)}
                className="btn-icon" 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {editSaleError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger-rose)', color: 'var(--danger-rose)', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.84rem' }}>
                ⚠️ {editSaleError}
              </div>
            )}

            <form onSubmit={handleSaveSaleCorrection} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Selector de Método de Pago */}
              <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px', display: 'block' }}>
                  Método de Pago Real:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { id: 'Efectivo', label: '💵 Efectivo', color: 'var(--success-emerald)' },
                    { id: 'Transferencia', label: '📱 Transferencia', color: 'var(--primary-cyan)' },
                    { id: 'Mixto', label: '🔄 Mixto', color: '#38bdf8' },
                    { id: 'Fiado', label: '⏳ Fiado / Crédito', color: 'var(--warning-amber)' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setEditSalePaymentMethod(m.id);
                        if (m.id === 'Mixto') {
                          if (!editSaleMixedCash && !editSaleMixedTransfer) {
                            setEditSaleMixedCash(String(editSaleModal.total));
                            setEditSaleMixedTransfer('0');
                          }
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: editSalePaymentMethod === m.id ? `2px solid ${m.color}` : '1px solid var(--border-glass)',
                        background: editSalePaymentMethod === m.id ? 'rgba(255,255,255,0.08)' : 'var(--bg-dark)',
                        color: editSalePaymentMethod === m.id ? '#fff' : 'var(--text-muted)',
                        fontWeight: '700',
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Si es Pago Mixto, desglosar montos */}
              {editSalePaymentMethod === 'Mixto' && (
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--primary-cyan)' }}>Desglose de Pago Mixto</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total: ${formatMoney(editSaleModal.total)}</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.76rem', color: 'var(--success-emerald)', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                        💵 Efectivo:
                      </label>
                      <input 
                        type="text" 
                        value={formatCOPInput(editSaleMixedCash)}
                        onChange={(e) => {
                          const val = parseCOP(e.target.value);
                          setEditSaleMixedCash(String(val));
                          const remaining = Math.max(0, editSaleModal.total - val);
                          setEditSaleMixedTransfer(String(remaining));
                        }}
                        className="app-input" 
                        placeholder="$0"
                        style={{ width: '100%', padding: '8px 10px', fontSize: '0.9rem', fontWeight: 'bold' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.76rem', color: 'var(--primary-cyan)', fontWeight: '700', display: 'block', marginBottom: '4px' }}>
                        📱 Transferencia:
                      </label>
                      <input 
                        type="text" 
                        value={formatCOPInput(editSaleMixedTransfer)}
                        onChange={(e) => {
                          const val = parseCOP(e.target.value);
                          setEditSaleMixedTransfer(String(val));
                        }}
                        className="app-input" 
                        placeholder="$0"
                        style={{ width: '100%', padding: '8px 10px', fontSize: '0.9rem', fontWeight: 'bold' }}
                      />
                    </div>
                  </div>

                  {(() => {
                    const sum = (parseCOP(editSaleMixedCash) || 0) + (parseCOP(editSaleMixedTransfer) || 0);
                    const diff = editSaleModal.total - sum;
                    return (
                      <div style={{ marginTop: '8px', fontSize: '0.78rem', fontWeight: '700', color: diff === 0 ? 'var(--success-emerald)' : 'var(--danger-rose)' }}>
                        {diff === 0 ? '✓ Montos exactos conciliados' : `Diferencia pendiente: $${formatMoney(diff)}`}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Nombre de Cliente / Deudor / Referencia */}
              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px', display: 'block' }}>
                  {editSalePaymentMethod === 'Fiado' ? '👤 Nombre del Deudor / Cliente (Obligatorio):' : '👤 Cliente / Mesa / Referencia (Opcional):'}
                </label>
                <input 
                  type="text" 
                  value={editSaleCustomerName} 
                  onChange={e => setEditSaleCustomerName(e.target.value)} 
                  placeholder={editSalePaymentMethod === 'Fiado' ? 'Ej: Don Pedro Gómez' : 'Ej: Mesa 3, Comprobante Nequi #9823'} 
                  required={editSalePaymentMethod === 'Fiado'}
                  className="app-input" 
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              {/* Motivo de la Corrección */}
              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px', display: 'block' }}>
                  📝 Motivo de la Corrección (Auditoría):
                </label>
                <input 
                  type="text" 
                  value={editSaleNotes} 
                  onChange={e => setEditSaleNotes(e.target.value)} 
                  placeholder="Ej: Empleado marcó Efectivo por error pero el cliente pagó por Nequi" 
                  className="app-input" 
                  style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditSaleModal(null)} 
                  className="nav-btn" 
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingSaleCorrection}
                  className="nav-btn active" 
                  style={{ flex: 1.3, background: 'var(--primary-cyan)', color: '#000', fontWeight: '800', padding: '10px' }}
                >
                  {isSavingSaleCorrection ? 'Guardando...' : '💾 Guardar Corrección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCloseShiftModal && (
        <div className="modal-overlay" onClick={() => setShowCloseShiftModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px', color: 'var(--text-bright)' }}>Cerrar Caja (Terminar Turno)</h3>
            
            {shiftStats && !shiftStats.error ? (
              <div style={{ marginBottom: '20px', padding: '15px', background: 'var(--bg-dark)', borderRadius: 'var(--radius-md)' }}>
                {config?.blind_close === 'true' ? (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <h4 style={{ color: 'var(--warning-amber)', marginBottom: '8px' }}>🙈 Cierre de Caja Ciego Activo</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>El sistema ha ocultado el total esperado. Por favor, cuente el dinero físicamente en la gaveta e ingrese el valor total. El descuadre se calculará internamente.</p>
                  </div>
                ) : (
                  <>
                    {/* BLOQUE 1: EFECTIVO FÍSICO (CAJA / GAVETA) */}
                    <div style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.25)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--primary-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          💵 1. Efectivo Físico en Gaveta
                        </span>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(6, 182, 212, 0.2)', color: 'var(--primary-cyan)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                          {(shiftStats.cash_count || 0)} vts
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.88rem' }}>
                        <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Base de Apertura:</span>
                          <span style={{ fontWeight: 'bold' }}>+{formatCOP(shiftStats.initial_cash || 0, true)}</span>
                        </p>
                        <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Ventas Directas en Efectivo:</span>
                          <span style={{ fontWeight: 'bold' }}>+{formatCOP((shiftStats.direct_cash !== undefined ? shiftStats.direct_cash : shiftStats.cash_sales), true)}</span>
                        </p>
                        {(shiftStats.debt_payments > 0 || shiftStats.collected_debts_cash > 0 || shiftStats.collected_debts > 0) && (
                          <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, color: '#10b981' }}>
                            <span>Abonos Recibidos (Efectivo):</span>
                            <span style={{ fontWeight: 'bold' }}>+{formatCOP((shiftStats.debt_payments || shiftStats.collected_debts_cash || shiftStats.collected_debts || 0), true)}</span>
                          </p>
                        )}
                        <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, color: 'var(--danger-rose)' }}>
                          <span>(-) Gastos en Efectivo de Caja:</span>
                          <span style={{ fontWeight: 'bold' }}>-{formatCOP((shiftStats.cash_expenses !== undefined ? shiftStats.cash_expenses : shiftStats.expenses), true)}</span>
                        </p>
                        {shiftStats.cash_refunds > 0 && (
                          <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, color: 'var(--danger-rose)' }}>
                            <span>(-) Devoluciones en Efectivo:</span>
                            <span style={{ fontWeight: 'bold' }}>-{formatCOP(shiftStats.cash_refunds, true)}</span>
                          </p>
                        )}
                      </div>
                      <div style={{ borderTop: '1px dashed rgba(6, 182, 212, 0.4)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--primary-cyan)', fontWeight: 'bold', fontSize: '0.92rem' }}>Total Físico Esperado en Gaveta:</span>
                        <span style={{ color: 'var(--primary-cyan)', fontWeight: '900', fontSize: '1.2rem' }}>{formatCOP(shiftStats.expected_cash, true)}</span>
                      </div>
                    </div>

                    {/* BLOQUE 2: DINERO DIGITAL & TRANSFERENCIAS */}
                    <div style={{ background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          📱 2. Dinero Digital & Transferencias
                        </span>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                          {(shiftStats.transfer_count || shiftStats.transfer_details?.length || 0)} transf.
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.88rem' }}>
                        <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Ventas por Transferencia:</span>
                          <span style={{ fontWeight: 'bold', color: '#c084fc' }}>+{formatCOP(shiftStats.transfer_sales || 0, true)}</span>
                        </p>
                        {shiftStats.transfer_expenses > 0 && (
                          <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, color: 'var(--danger-rose)' }}>
                            <span>(-) Gastos desde Cuenta/Bancos:</span>
                            <span style={{ fontWeight: 'bold' }}>-{formatCOP(shiftStats.transfer_expenses, true)}</span>
                          </p>
                        )}
                        {shiftStats.transfer_refunds > 0 && (
                          <p style={{ display: 'flex', justifyContent: 'space-between', margin: 0, color: 'var(--danger-rose)' }}>
                            <span>(-) Devoluciones Transferencia:</span>
                            <span style={{ fontWeight: 'bold' }}>-{formatCOP(shiftStats.transfer_refunds, true)}</span>
                          </p>
                        )}
                      </div>
                      <div style={{ borderTop: '1px dashed rgba(168, 85, 247, 0.4)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#c084fc', fontWeight: 'bold', fontSize: '0.92rem' }}>Total en Bancos / Billeteras:</span>
                        <span style={{ color: '#c084fc', fontWeight: '900', fontSize: '1.2rem' }}>{formatCOP(Math.max(0, (shiftStats.transfer_sales || 0) - (shiftStats.transfer_expenses || 0) - (shiftStats.transfer_refunds || 0)), true)}</span>
                      </div>

                      {/* Botón desplegable para auditar transferencias */}
                      {shiftStats.transfer_details && shiftStats.transfer_details.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setShowTransferList(!showTransferList)}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(168, 85, 247, 0.4)',
                              color: '#c084fc',
                              fontSize: '0.8rem',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%',
                              fontWeight: '600'
                            }}
                          >
                            <span>{showTransferList ? '▲ Ocultar detalle de transferencias' : '▼ Auditar transferencias (' + shiftStats.transfer_details.length + ')'}</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Nequi, Daviplata, QR</span>
                          </button>

                          {showTransferList && (
                            <div style={{ marginTop: '8px', maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '6px' }}>
                              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                                    <th style={{ padding: '3px' }}>Hora</th>
                                    <th style={{ padding: '3px' }}>Venta #</th>
                                    <th style={{ padding: '3px' }}>Cliente / Ref</th>
                                    <th style={{ padding: '3px', textAlign: 'right' }}>Monto</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {shiftStats.transfer_details.map((t, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                      <td style={{ padding: '4px 3px', color: 'var(--text-muted)' }}>{t.created_at ? t.created_at.slice(11, 16) : '-'}</td>
                                      <td style={{ padding: '4px 3px', fontWeight: 'bold' }}>#{t.id}</td>
                                      <td style={{ padding: '4px 3px', color: 'var(--text-muted)' }}>{t.customer_name || t.notes || 'Mostrador'}</td>
                                      <td style={{ padding: '4px 3px', textAlign: 'right', fontWeight: 'bold', color: '#c084fc' }}>{formatCOP(t.transfer_amount || t.total, true)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* BLOQUE 3: CRÉDITOS Y FIADOS DEL TURNO */}
                    {(shiftStats.debt_sales > 0) && (
                      <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--warning-amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            📝 3. Fiados Nuevos del Turno:
                          </span>
                          <span style={{ fontWeight: 'bold', color: 'var(--warning-amber)', fontSize: '0.95rem' }}>
                            {formatCOP(shiftStats.debt_sales || 0, true)}
                            {shiftStats.debt_count ? <small style={{ fontWeight: 'normal', opacity: 0.8, marginLeft: '4px' }}>({shiftStats.debt_count})</small> : null}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* BLOQUE 4: BALANCE GENERAL CONSOLIDADO */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '14px' }}>
                      <p style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 6px 0', fontSize: '0.92rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-bright)' }}>💰 Total Recaudado Líquido (Efectivo + Transf):</span>
                        <span style={{ fontWeight: 'bold', color: '#10b981', fontSize: '1.05rem' }}>{formatCOP((shiftStats.total_collected !== undefined ? shiftStats.total_collected : ((shiftStats.cash_sales || 0) + (shiftStats.transfer_sales || 0))), true)}</span>
                      </p>
                      {shiftStats.total_turn_sales !== undefined && (
                        <p style={{ display: 'flex', justifyContent: 'space-between', margin: '0 0 4px 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          <span>Total Facturado en Turno (con fiados):</span>
                          <span>{formatCOP(shiftStats.total_turn_sales, true)}</span>
                        </p>
                      )}
                      {shiftStats.owner_expenses > 0 && (
                        <p style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0 0 0', fontSize: '0.82rem', color: '#c084fc' }}>
                          <span>• Gastos Bolsillo Dueño:</span>
                          <span style={{ fontWeight: 'bold' }}>{formatCOP(shiftStats.owner_expenses, true)} (Fondos Propios)</span>
                        </p>
                      )}
                    </div>

                    <div style={{ marginTop: '10px', marginBottom: '14px', textAlign: 'center' }}>
                      <button type="button" onClick={() => { 
                        printThermalElement('printable-shift-ticket', {
                          ticketWidth: config?.ticket_width || '58mm',
                          title: 'Arqueo_Turno'
                        });
                      }} style={{ background: 'var(--primary-cyan)', color: '#000', padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto', fontWeight: 'bold', fontSize: '0.9rem', boxShadow: '0 2px 8px rgba(6, 182, 212, 0.3)' }}>
                        <Printer size={16} /> Imprimir Tirilla de Cierre / Arqueo
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p>Calculando cuadre de caja...</p>
            )}

            <div className="form-group">
              <label style={{ fontWeight: '700' }}>
                ¿Cuánto dinero contaste en la gaveta física? <br/>
                <small style={{ color: 'var(--warning-amber)', fontWeight: 'normal' }}>
                  ⚠️ Ingrese todo el efectivo físico (incluyendo la base inicial si permanece en la caja).
                </small>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '1.1rem' }}>$</span>
                <input 
                  type="text" 
                  inputMode="numeric" 
                  autoFocus 
                  placeholder="Total contado físico en gaveta (ej: 500.000)..." 
                  value={shiftFinalCash} 
                  onChange={e => setShiftFinalCash(formatCOPInput(e.target.value))} 
                  style={{ width: '100%', padding: '12px 12px 12px 28px', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold', fontSize: '1.1rem' }} 
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Notas / Observaciones del Turno (Opcional)</label>
              <textarea rows="2" placeholder="Novedades, descuadres, billetes falsos..." value={shiftNotes} onChange={e => setShiftNotes(e.target.value)}></textarea>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowCloseShiftModal(false)} className="checkout-btn-secondary">Cancelar</button>
              <button onClick={handleCloseShift} className="checkout-btn">CERRAR CAJA DEFINITIVAMENTE</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Area */}
      <main>
        {/* Banner de Advertencia de Expiración */}
        {licenseStatus.isValid && licenseStatus.type === 'subscription' && licenseStatus.daysLeft <= 10 && (
          <div style={{
            background: 'var(--warning-amber)',
            color: '#000000',
            fontWeight: '800',
            padding: '10px 20px',
            textAlign: 'center',
            fontSize: '0.85rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            boxShadow: '0 4px 10pxrgba(245,158,11,0.15)'
          }}>
            <span>a️ ATENCI N COMERCIAL: Su membresía expira en <strong style={{fontSize: '1rem'}}>{licenseStatus.daysLeft}</strong> días (Vence el: {licenseStatus.expires}). Póngase en contacto con soporte técnico para activar más tiempo.</span>
          </div>
        )}

        {/* Encabezado Principal */}
        <header style={{ display: 'flex', gap: '20px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px', flexShrink: 0 }}>
          {/* Logo a la izquierda */}
          <div style={{ flexShrink: 0 }}>
            {config.business_logo_url !== 'none' && (
              <img src={config.business_logo_url || "/logo.jpeg"} alt={config.business_name || "Tienda POS"} style={{ height: '90px', borderRadius: '12px', objectFit: 'contain' }} />
            )}
          </div>

          {/* Textos y botones a la derecha */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: '1 1 auto', gap: '12px' }}>
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
              {/* Selector y Estado de Rol: Modo Cajero vs Administrador */}
              {isAdmin ? (
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(234, 88, 12, 0.18))', 
                  border: '1px solid rgba(245, 158, 11, 0.5)', 
                  padding: '5px 14px', 
                  borderRadius: '24px',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)'
                }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: '800', color: 'var(--warning-amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    👑 Modo Administrador
                  </span>
                  <button 
                    onClick={handleLogoutAdmin}
                    style={{ 
                      background: 'rgba(239, 68, 68, 0.2)', 
                      border: '1px solid rgba(239, 68, 68, 0.4)', 
                      color: 'var(--danger-rose)', 
                      borderRadius: '12px', 
                      padding: '3px 10px', 
                      fontSize: '0.74rem', 
                      fontWeight: '800', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px' 
                    }}
                    title="Cerrar sesión de Administrador y volver a Modo Cajero"
                  >
                    <Lock size={12} /> Salir a Cajero
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => { setAdminPinInput(''); setAdminPinError(''); setShowAdminLoginModal(true); }}
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '7px', 
                    background: 'rgba(14, 165, 233, 0.12)', 
                    border: '1px solid rgba(14, 165, 233, 0.4)', 
                    padding: '5px 14px', 
                    borderRadius: '24px', 
                    color: 'var(--primary-cyan)', 
                    fontSize: '0.82rem', 
                    fontWeight: '800', 
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(14, 165, 233, 0.15)'
                  }}
                  title="Hacer clic para ingresar con contraseña o PIN de Administrador"
                >
                  <User size={15} /> <span>Modo Cajero</span> · <span style={{ textDecoration: 'underline', color: 'var(--primary-cyan)', fontWeight: '700' }}>Ingresar Admin 🔑</span>
                </button>
              )}

              {isNgrokRemote && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--primary-cyan)', fontSize: '0.72rem', fontWeight: '800', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  <Globe size={13} /> Túnel Ngrok
                </span>
              )}

              <div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-bright)', letterSpacing: '-0.5px', margin: 0 }}>
                  {config.business_name || "Sistema POS"}
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Punto de Venta e Inventario
                </p>
              </div>
            </div>
            
            <nav style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* === NAVEGACIÓN POR ROL === */}
              {/* Pestañas siempre visibles para el Cajero */}
              <button onClick={() => setView('pos')} className={`nav-btn ${view === 'pos' ? 'active' : ''}`}><ShoppingCart size={18} /> Ventas</button>
              <button onClick={() => setView('debts')} className={`nav-btn ${view === 'debts' ? 'active' : ''}`}><Users size={18} /> Créditos</button>
              <button onClick={() => setView('history')} className={`nav-btn ${view === 'history' ? 'active' : ''}`}><History size={18} /> Historial</button>
              <button onClick={() => setView('accounting')} className={`nav-btn ${view === 'accounting' ? 'active' : ''}`}><DollarSign size={18} /> Gastos</button>

              {/* Botón de Recordatorios (Habilitable a voluntad desde Ajustes) */}
              {config.enable_reminders === 'true' && (
                <button 
                  onClick={() => setView('reminders')} 
                  className={`nav-btn ${view === 'reminders' ? 'active' : ''}`}
                  style={{
                    position: 'relative',
                    borderColor: reminderBadgeCount > 0 ? 'var(--warning-amber)' : undefined
                  }}
                  title="Recordatorios y Mantenimientos"
                >
                  <Bell size={18} /> Recordatorios
                  {reminderBadgeCount > 0 && (
                    <span style={{
                      background: 'var(--danger-rose)',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: '900',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      marginLeft: '4px'
                    }}>
                      {reminderBadgeCount}
                    </span>
                  )}
                </button>
              )}

              {/* Botón de Carta Digital QR (Habilitable a voluntad desde Ajustes) */}
              {config.enable_digital_menu !== 'false' && (
                <button 
                  onClick={() => setShowQrMenuModal(true)} 
                  className="nav-btn" 
                  style={{ 
                    background: 'rgba(99, 102, 241, 0.15)', 
                    color: '#818cf8', 
                    borderColor: 'rgba(99, 102, 241, 0.35)',
                    fontWeight: '700'
                  }}
                  title="Abrir Código QR y enlace de la Carta Digital para clientes"
                >
                  <QrCode size={18} /> Carta QR
                </button>
              )}

              {/* Pestañas exclusivas del Administrador - completamente ocultas en modo cajero */}
              {isAdmin && (
                <>
                  <button onClick={() => setView('inventory')} className={`nav-btn ${view === 'inventory' ? 'active' : ''}`}><Package size={18} /> Inventario</button>
                  <button onClick={() => setView('report')} className={`nav-btn ${view === 'report' ? 'active' : ''}`}><BarChart2 size={18} /> Cierre</button>
                  <button onClick={() => setView('shifts')} className={`nav-btn ${view === 'shifts' ? 'active' : ''}`}><Users size={18} /> Turnos</button>
                  <button onClick={() => setView('settings')} className={`nav-btn ${view === 'settings' ? 'active' : ''}`}><Settings size={18} /> Ajustes</button>
                </>
              )}

              {config.enable_cash_drawer_button === 'true' && (
                <button 
                  type="button"
                  onClick={handleOpenCashDrawer} 
                  className="nav-btn" 
                  title="Abrir cajón monedero sin imprimir (F9)"
                  style={{ 
                    background: 'rgba(234, 179, 8, 0.15)', 
                    color: 'var(--warning-amber)', 
                    borderColor: 'rgba(234, 179, 8, 0.35)',
                    fontWeight: '700'
                  }}
                >
                  <Coins size={18} /> Abrir Cajón <span style={{ fontSize: '0.72rem', opacity: 0.8, marginLeft: '3px' }}>(F9)</span>
                </button>
              )}

              <button onClick={handleOpenCloseShiftModal} className="nav-btn" style={{ background: 'var(--primary-cyan)', color: 'black' }}><CheckCircle size={18} /> Cerrar Caja</button>
              <button onClick={handleShutdown} className="nav-btn danger-btn" style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger-rose)', borderColor: 'rgba(239, 68, 68, 0.2)' }}><Power size={18} /> Apagar POS</button>

              {/* Botón de Bloquear Acceso Remoto Ngrok */}
              {isNgrokRemote && (
                <button 
                  onClick={handleLockRemote} 
                  className="nav-btn" 
                  title="Bloquear sesión remota de Ngrok"
                  style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger-rose)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <Lock size={18} /> Bloquear
                </button>
              )}
            </nav>
          </div>
        </header>

        {/* Notificaciones del Lector de Códigos de Barras */}
        {scanNotification && (
          <div style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            background: scanNotification.type === 'success' ? 'var(--success-emerald)' : 'var(--danger-rose)',
            color: '#000',
            fontWeight: '800',
            padding: '12px 24px',
            borderRadius: '30px',
            boxShadow: '0 10px 25pxrgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.95rem'
          }}>
            <span>x  {scanNotification.message}</span>
          </div>
        )}

        {/* Vistas Principales */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {view === 'pos' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Barra de Filtro de Categorías y Buscador */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                  {['Todas', ...new Set(products.map(p => p.category).filter(Boolean))].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`nav-btn ${selectedCategory === cat ? 'active' : ''}`}
                      style={{
                        padding: '8px 14px',
                        fontSize: '0.85rem',
                        borderRadius: '20px'
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px', width: '380px', position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Escriba para buscar o escanee código de barras..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      padding: '12px 16px 12px 38px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-glass)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-main)',
                      width: '100%',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                  {searchQuery && (
                    <X 
                      size={18} 
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }}
                      onClick={() => setSearchQuery('')}
                    />
                  )}
                </div>
              </div>

              {/* Grid de Productos */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div className="product-grid">
                  {products
                    .filter(p => {
                      const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
                      const matchesSearch = !searchQuery || 
                        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (p.barcode && p.barcode.includes(searchQuery));
                      return matchesCategory && matchesSearch;
                    })
                    .map(p => {
                      const isStrict = config?.strict_inventory !== 'false';
                      const isLowStock = isStrict && p.stock > 0 && p.stock <= p.min_stock;
                      const isCriticalStock = isStrict && p.stock <= 0;
                      let stockClass = '';
                      if (isCriticalStock) stockClass = 'critical-stock';
                      else if (isLowStock) stockClass = 'low-stock';

                      return (
                        <div 
                          key={p.id} 
                          onClick={() => (!isStrict || !isCriticalStock) && addToCart(p)}
                          className={`product-card ${stockClass}`}
                          style={p.image_path ? {
                            backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.7) 100%), url(${getImageUrl(p.image_path)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            color: '#fff',
                            border: 'none'
                          } : {}}
                        >
                          {/* Nivel 1: Fila Superior Flex de Estado (Ubicación y Stock sin solaparse nunca) */}
                          <div className="product-card-header">
                            {p.location ? (
                              <span className="p-location-chip" title={`Ubicación: ${p.location}`}>
                                📍 {p.location}
                              </span>
                            ) : <span />}
                            {isStrict && (
                              <span className={`stock-tag ${stockClass}`} style={p.image_path ? { background: 'rgba(0,0,0,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' } : {}}>
                                {(() => {
                                  const committed = getCommittedUnits(p.id);
                                  const available = Math.max(0, p.stock - committed);
                                  const shouldHideNum = !isAdmin && config?.hide_stock_cashier === 'true';

                                  if (available <= 0 && isStrict) {
                                    return committed > 0 ? (shouldHideNum ? '🍽️ En mesas' : `🍽️ ${committed} en mesas`) : 'AGOTADO';
                                  }
                                  if (shouldHideNum) {
                                    if (isLowStock) {
                                      return committed > 0 ? `⚠️ Pocas • 🍽️ ${committed}` : '⚠️ Pocas unidades';
                                    }
                                    return committed > 0 ? `🟢 Disp. • 🍽️ ${committed}` : '🟢 Disponible';
                                  }
                                  return committed > 0 ? `${available} disp. • 🍽️ ${committed}` : `Stock: ${p.stock}`;
                                })()}
                              </span>
                            )}
                          </div>

                          {/* Nivel 2: Cuerpo Central (Nombre del producto con 100% de ancho sin obstáculos) */}
                          <div className="product-card-body">
                            <span className="p-name" style={p.image_path ? { color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.95)' } : {}}>
                              {p.name}
                            </span>
                            {config?.enable_product_descriptions === 'true' && p.description && (
                              <span className="p-desc" style={{ color: p.image_path ? '#e2e8f0' : 'var(--text-muted)' }}>
                                {p.description}
                              </span>
                            )}
                          </div>

                          {/* Nivel 3: Fila Inferior (Precio destacado) */}
                          <div className="product-card-footer">
                            <span className="p-price" style={p.image_path ? { color: 'var(--primary-cyan)', textShadow: '0 2px 4px rgba(0,0,0,0.9)' } : {}}>
                              ${p.price.toLocaleString('es-CO')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {view === 'debts' && (
            <div style={{ overflowY: 'auto', height: '100%' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Cuentas Abiertas / Fiados (Cartera de Clientes)</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Aquí puedes registrar los abonos o liquidar las cuentas que tus clientes tienen pendientes de pago.</p>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código Ticket</th>
                    <th>Cliente / Mesa</th>
                    <th>Fecha y Hora del Registro</th>
                    <th>Valor Pendiente</th>
                    <th>Costo de Mercancía</th>
                    <th>Estado de Cuenta</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(sales) ? sales : [])
                    .filter(s => s && s.payment_method === 'Fiado' && s.payment_status === 'pending' && s.status === 'completed')
                    .map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary-cyan)' }}>#TKT-{s.id}</td>
                        <td style={{ fontWeight: '700', color: 'var(--text-bright)' }}>👤 {s.customer_name || 'Sin nombre'}</td>
                        <td>{formatSafeDate(s.created_at)}</td>
                        <td style={{ fontWeight: '800', color: 'var(--warning-amber)', fontSize: '1.1rem' }}>${formatMoney(s.total)}</td>
                        <td style={{ color: 'var(--text-muted)' }}>${formatMoney(s.cost_total)}</td>
                        <td>
                          <span className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning-amber)' }}>PENDIENTE</span>
                        </td>
                        <td style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button onClick={() => triggerPayDebt(s)} className="nav-btn active" style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'var(--success-emerald)', color: '#000' }} title="Registrar Pago o Abono">
                            <Check size={14} style={{ marginRight: '4px' }} /> ABONAR
                          </button>
                          <button onClick={() => triggerEditDebt(s)} className="btn-icon" title="Editar Deuda" style={{ background: 'var(--bg-dark)' }}>
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => triggerEditDate(s)} className="btn-icon" title="Editar Fecha Histórica" style={{ background: 'var(--bg-dark)' }}>
                            <Calendar size={14} />
                          </button>
                          <button onClick={() => deleteSaleFromHistory(s.id)} className="btn-icon danger" title="Eliminar Deuda">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {(Array.isArray(sales) ? sales : []).filter(s => s && s.payment_method === 'Fiado' && s.payment_status === 'pending' && s.status === 'completed').length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        ✅ Al día: No existen deudas ni cuentas por cobrar en este momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {view === 'inventory' && (
            <InventoryManager products={products} onSave={fetchData} config={config} isAdmin={isAdmin} adminPassword={adminPassword} />
          )}

          {view === 'history' && (
            <div style={{ overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '15px', padding: '15px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', marginBottom: '15px', border: '1px solid var(--border-glass)', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--primary-cyan)' }}><History size={18} style={{ marginRight: '5px', verticalAlign: 'middle' }}/> Filtros de Búsqueda:</span>
                <input 
                  type="date" 
                  value={historyStartDate} 
                  onChange={(e) => setHistoryStartDate(e.target.value)} 
                  className="app-input" 
                  style={{ padding: '8px' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>hasta</span>
                <input 
                  type="date" 
                  value={historyEndDate} 
                  onChange={(e) => setHistoryEndDate(e.target.value)} 
                  className="app-input" 
                  style={{ padding: '8px' }}
                />
                <button 
                  onClick={fetchData} 
                  className="nav-btn active" 
                  style={{ background: 'var(--primary-cyan)', color: '#000', padding: '8px 16px' }}
                >
                  Buscar Historial
                </button>
                <button 
                  onClick={() => { setHistoryStartDate(''); setHistoryEndDate(''); setHistoryPaymentFilter('all'); setHistoryUserFilter('all'); setTimeout(fetchData, 100); }} 
                  className="nav-btn" 
                  style={{ padding: '8px 16px' }}
                >
                  Limpiar Filtros
                </button>

                {/* Filtro de Método de Pago */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select 
                    value={historyPaymentFilter} 
                    onChange={(e) => setHistoryPaymentFilter(e.target.value)}
                    className="app-input"
                    style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-dark)', color: 'var(--text-main)', border: historyPaymentFilter !== 'all' ? '1px solid var(--primary-cyan)' : '1px solid var(--border-glass)', cursor: 'pointer' }}
                  >
                    <option value="all">💳 Todos los métodos</option>
                    <option value="Efectivo">💵 Solo Efectivo</option>
                    <option value="Transferencia">📱 Solo Transferencias</option>
                    <option value="Mixto">🔄 Solo Mixto</option>
                    <option value="Fiado">⏳ Solo Fiados / Créditos</option>
                  </select>
                </div>

                {/* Filtro de Cajero */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select 
                    value={historyUserFilter} 
                    onChange={(e) => setHistoryUserFilter(e.target.value)}
                    className="app-input"
                    style={{ padding: '7px 10px', fontSize: '0.82rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-dark)', color: 'var(--text-main)', border: historyUserFilter !== 'all' ? '1px solid var(--primary-cyan)' : '1px solid var(--border-glass)', cursor: 'pointer' }}
                  >
                    <option value="all">👤 Todos los cajeros</option>
                    {Array.from(new Set((Array.isArray(sales) ? sales : []).map(s => s.user_name).filter(Boolean))).sort().map(c => (
                      <option key={c} value={c}>👤 {c}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                  <button 
                    type="button"
                    onClick={() => setHistoryTypeFilter('all')}
                    className="nav-btn"
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '0.8rem',
                      background: historyTypeFilter === 'all' ? 'var(--primary-cyan)' : 'var(--bg-dark)',
                      color: historyTypeFilter === 'all' ? '#000' : 'var(--text-muted)',
                      fontWeight: '700'
                    }}
                  >
                    Todas las Ventas
                  </button>
                  <button 
                    type="button"
                    onClick={() => setHistoryTypeFilter('debts')}
                    className="nav-btn"
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '0.8rem',
                      background: historyTypeFilter === 'debts' ? 'var(--warning-amber)' : 'var(--bg-dark)',
                      color: historyTypeFilter === 'debts' ? '#000' : 'var(--text-muted)',
                      fontWeight: '700'
                    }}
                  >
                    💳 Solo Créditos y Abonos
                  </button>
                  <button 
                    type="button"
                    onClick={() => setHistoryTypeFilter('refunds')}
                    className="nav-btn"
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '0.8rem',
                      background: historyTypeFilter === 'refunds' ? '#a855f7' : 'var(--bg-dark)',
                      color: historyTypeFilter === 'refunds' ? '#fff' : 'var(--text-muted)',
                      fontWeight: '700',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>↩️ Devoluciones y Reembolsos</span>
                    {(Array.isArray(sales) ? sales : []).filter(s => (Number(s?.refunded_amount) || 0) > 0 || s?.status === 'refunded').length > 0 && (
                      <span style={{ 
                        background: historyTypeFilter === 'refunds' ? '#fff' : '#a855f7', 
                        color: historyTypeFilter === 'refunds' ? '#a855f7' : '#fff', 
                        borderRadius: '10px', 
                        padding: '1px 7px', 
                        fontSize: '0.72rem', 
                        fontWeight: '800' 
                      }}>
                        {(Array.isArray(sales) ? sales : []).filter(s => (Number(s?.refunded_amount) || 0) > 0 || s?.status === 'refunded').length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* BARRA DE RESUMEN DE FILTROS ACTIVOS (MÉTODO / CAJERO) */}
              {(historyPaymentFilter !== 'all' || historyUserFilter !== 'all') && (() => {
                const matched = (Array.isArray(sales) ? sales : []).filter(s => {
                  if (!s) return false;
                  if (historyTypeFilter === 'debts') {
                    if (!(s.payment_method === 'Fiado' || s.payment_shift_id !== null || (typeof s.customer_name === 'string' && s.customer_name.startsWith('Abono:')))) return false;
                  }
                  if (historyTypeFilter === 'refunds') {
                    if (!((Number(s.refunded_amount) || 0) > 0 || s.status === 'refunded')) return false;
                  }
                  if (historyPaymentFilter !== 'all' && s.payment_method !== historyPaymentFilter) return false;
                  if (historyUserFilter !== 'all' && s.user_name !== historyUserFilter) return false;
                  return true;
                });
                const totalFilteredSum = matched.reduce((acc, s) => {
                  if (s.status === 'cancelled') return acc;
                  if (historyPaymentFilter === 'Transferencia') return acc + (Number(s.transfer_amount) || (s.payment_method === 'Transferencia' ? Number(s.total) || 0 : 0));
                  if (historyPaymentFilter === 'Efectivo') return acc + (Number(s.cash_amount) || (s.payment_method === 'Efectivo' ? Number(s.total) || 0 : 0));
                  return acc + (Number(s.total) || 0);
                }, 0);

                return (
                  <div style={{ margin: '0 0 14px 0', padding: '10px 16px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: '700', color: 'var(--primary-cyan)' }}>🔍 Filtro Activo:</span>
                      {historyPaymentFilter !== 'all' && (
                        <span style={{ background: 'var(--bg-dark)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-glass)', color: 'var(--text-bright)' }}>
                          Método: <strong>{historyPaymentFilter}</strong>
                        </span>
                      )}
                      {historyUserFilter !== 'all' && (
                        <span style={{ background: 'var(--bg-dark)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-glass)', color: 'var(--text-bright)' }}>
                          Cajero: <strong>{historyUserFilter}</strong>
                        </span>
                      )}
                      <span style={{ color: 'var(--text-muted)' }}>({matched.length} tickets encontrados)</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '6px' }}>Total Filtrado:</span>
                      <strong style={{ fontSize: '1.15rem', color: 'var(--primary-cyan)' }}>${formatMoney(totalFilteredSum)}</strong>
                    </div>
                  </div>
                );
              })()}

              {historyTypeFilter === 'refunds' && (() => {
                const refundedSales = (Array.isArray(sales) ? sales : []).filter(s => (Number(s?.refunded_amount) || 0) > 0 || s?.status === 'refunded');
                const totalRefundedSum = refundedSales.reduce((acc, s) => acc + (Number(s.refunded_amount) || 0), 0);
                const totalRefundCount = refundedSales.reduce((acc, s) => acc + (Array.isArray(s.refunds) ? s.refunds.length : ((Number(s.refunded_amount) || 0) > 0 ? 1 : 0)), 0);
                return (
                  <div style={{ margin: '0 0 16px 0', padding: '14px 18px', background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.35)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '1.8rem' }}>↩️</div>
                      <div>
                        <div style={{ fontWeight: '800', color: '#c084fc', fontSize: '0.95rem' }}>Historial Auditado de Devoluciones y Reembolsos</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          Mostrando todas las ventas con reembolsos procesados y comprobantes DEV oficiales
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Reembolsado</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f87171' }}>-${formatMoney(totalRefundedSum)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Comprobantes Emitidos</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#c084fc' }}>{totalRefundCount} dev.</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código Recibo</th>
                    <th>Fecha y Hora</th>
                    <th>Valor Venta</th>
                    <th>Costo Mercancía</th>
                    <th>Ganancia</th>
                    <th>Método</th>
                    <th>Estado Pago</th>
                    <th>Mesa/Cliente</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(sales) ? sales : [])
                    .filter(s => {
                      if (!s) return false;
                      if (historyTypeFilter === 'debts') {
                        if (!(s.payment_method === 'Fiado' || s.payment_shift_id !== null || (typeof s.customer_name === 'string' && s.customer_name.startsWith('Abono:')))) return false;
                      }
                      if (historyTypeFilter === 'refunds') {
                        if (!((Number(s.refunded_amount) || 0) > 0 || s.status === 'refunded')) return false;
                      }
                      if (historyPaymentFilter !== 'all') {
                        if (s.payment_method !== historyPaymentFilter) return false;
                      }
                      if (historyUserFilter !== 'all') {
                        if (s.user_name !== historyUserFilter) return false;
                      }
                      return true;
                    })
                    .map(s => {
                    const refundedAmt = Number(s.refunded_amount) || 0;
                    const hasRefund = refundedAmt > 0 || s.status === 'refunded';
                    const netSaleTotal = Math.max(0, (Number(s.total) || 0) - refundedAmt);
                    const netProfit = s.status === 'cancelled' ? 0 : Math.max(0, netSaleTotal - (Number(s.cost_total) || 0));
                    const isFullyRefunded = s.status === 'refunded' || (refundedAmt >= (Number(s.total) || 0) && (Number(s.total) || 0) > 0);
                    const isCreditPaid = s.payment_status === 'paid' && (s.payment_shift_id !== null || s.parent_sale_id !== null || (typeof s.customer_name === 'string' && s.customer_name.startsWith('Abono:')) || s.payment_method === 'Fiado');
                    const hasCorrection = s.notes && (s.notes.includes('[CORRECCIÓN') || s.notes.includes('Corregido'));
                    return (
                      <React.Fragment key={s.id}>
                        <tr 
                          onClick={() => setExpandedSaleId(expandedSaleId === s.id ? null : s.id)}
                          style={{ cursor: 'pointer' }}
                          className={expandedSaleId === s.id ? 'expanded-row-parent' : ''}
                        >
                          <td style={{ fontWeight: 'bold', color: 'var(--primary-cyan)' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span>#TKT-{s.id}</span>
                              {hasCorrection && (
                                <span 
                                  title={s.notes}
                                  style={{
                                    background: 'rgba(245, 158, 11, 0.2)',
                                    color: 'var(--warning-amber)',
                                    border: '1px solid rgba(245, 158, 11, 0.45)',
                                    borderRadius: '4px',
                                    padding: '1px 5px',
                                    fontSize: '0.68rem',
                                    fontWeight: '800',
                                    cursor: 'help',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                  }}
                                >
                                  ✏️ Editada
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div>{formatSafeDate(s.created_at)}</div>
                            {s.paid_at && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--success-emerald)', fontWeight: 'bold', marginTop: '2px' }}>
                                ✓ Liquidado: {formatSafeDate(s.paid_at)}
                              </div>
                            )}
                          </td>
                          <td>
                            {hasRefund ? (
                              <div>
                                <div style={{ fontWeight: '800', color: isFullyRefunded ? 'var(--text-muted)' : 'var(--text-bright)', fontSize: '0.92rem' }}>
                                  ${formatMoney(netSaleTotal)}
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: 'normal' }}>neto</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: '700' }}>
                                  - Dev: ${formatMoney(refundedAmt)}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                  Orig: ${formatMoney(s.total)}
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontWeight: 'bold' }}>${formatMoney(s.total)}</div>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>${formatMoney(s.cost_total)}</td>
                          <td style={{ color: (s.status === 'cancelled' || isFullyRefunded) ? 'var(--text-muted)' : 'var(--success-emerald)', fontWeight: '700' }}>
                            ${(s.status === 'cancelled' || isFullyRefunded) ? 0 : formatMoney(netProfit)}
                            {hasRefund && !isFullyRefunded && (
                              <div style={{ fontSize: '0.68rem', color: '#c084fc', fontWeight: '600' }}>
                                Ajustada por dev.
                              </div>
                            )}
                          </td>
                          <td style={{ minWidth: '130px' }}>
                            {s.payment_method === 'Mixto' ? (
                              <div>
                                <span className="status-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--primary-cyan)', fontWeight: '700', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px' }}>
                                  🔄 Mixto
                                </span>
                                <div style={{ fontSize: '0.72rem', lineHeight: '1.4', background: 'rgba(0,0,0,0.25)', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-glass)' }}>
                                  <div style={{ color: 'var(--success-emerald)', fontWeight: '600' }}>💵 Efec: ${formatMoney(s.cash_amount)}</div>
                                  <div style={{ color: 'var(--primary-cyan)', fontWeight: '600' }}>📱 Transf: ${formatMoney(s.transfer_amount)}</div>
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontWeight: '600' }}>
                                {s.payment_method === 'Efectivo' && '💵 '}
                                {s.payment_method === 'Transferencia' && '📱 '}
                                {s.payment_method === 'Fiado' && '⏳ '}
                                {s.payment_method}
                              </span>
                            )}
                          </td>
                          <td>
                            {isFullyRefunded ? (
                              <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontWeight: '800', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                                🔴 REEMBOLSADO TOTAL
                              </span>
                            ) : hasRefund ? (
                              <div>
                                <span className="status-badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', fontWeight: '800', border: '1px solid rgba(168, 85, 247, 0.4)', display: 'inline-block', marginBottom: '2px' }}>
                                  🟣 DEV. PARCIAL
                                </span>
                                <div style={{ fontSize: '0.7rem', color: 'var(--success-emerald)', fontWeight: '600' }}>
                                  Neto: ${formatMoney(netSaleTotal)}
                                </div>
                              </div>
                            ) : isCreditPaid ? (
                              <span className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success-emerald)', fontWeight: '800' }}>
                                🟢 CRÉDITO COBRADO
                              </span>
                            ) : (
                              <span className={`status-badge ${s.payment_status === 'paid' ? 'completed' : 'cancelled'}`} style={s.payment_status === 'pending' ? { background: 'rgba(245,158,11,0.15)', color: 'var(--warning-amber)' } : {}}>
                                {s.payment_status === 'paid' ? 'COBRADO' : 'DEUDA PENDIENTE'}
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: '600' }}>{s.customer_name || '-'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                              {/* Botón para Revertir Abono / Liquidación de crédito */}
                              {isCreditPaid && s.status !== 'cancelled' && (
                                <button 
                                  onClick={() => triggerRevertPayment(s)} 
                                  title="Revertir este cobro y devolver a Cartera de Créditos PENDIENTE" 
                                  className="btn-icon" 
                                  style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning-amber)', border: '1px solid var(--warning-amber)' }}
                                >
                                  <RotateCcw size={16} />
                                </button>
                              )}
                              {/* Botón de Devolución: disponible para Cajero y Admin en ventas completadas con artículos */}
                              {s.status === 'completed' && Array.isArray(s.items) && s.items.length > 0 && s.items.some(i => (Number(i.quantity) - (Number(i.refunded_quantity) || 0)) > 0) && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); openRefundModal(s); }} 
                                  title="Procesar devolución de artículos" 
                                  className="btn-icon" 
                                  style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.4)' }}
                                >
                                  ↩️
                                </button>
                              )}
                              {s.status === 'completed' && (!s.customer_name || (typeof s.customer_name === 'string' && !s.customer_name.startsWith('Abono:'))) && isAdmin && (
                                <button onClick={() => cancelSale(s.id)} title="Anular venta total y reabastecer stock" className="btn-icon danger"><RotateCcw size={16} /></button>
                              )}
                              {/* Corregir medio de pago / datos: exclusivo Administrador */}
                              {isAdmin && s.status !== 'cancelled' && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); openEditSaleModal(s); }} 
                                  title="Corregir medio de pago, cliente o notas de esta venta" 
                                  className="btn-icon" 
                                  style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--primary-cyan)', border: '1px solid rgba(56, 189, 248, 0.35)' }}
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                              {/* Editar fecha: solo Administrador */}
                              {isAdmin && (
                                <button onClick={() => triggerEditDate(s)} title="Editar Fecha Histórica" className="btn-icon" style={{ background: 'var(--bg-dark)' }}><Calendar size={16} /></button>
                              )}
                              <button onClick={() => printReceipt(s)} title="Reimprimir Ticket" className="btn-icon" style={{ color: 'var(--primary-cyan)' }}><Printer size={16} /></button>
                              {isAdmin && (<button onClick={() => deleteSaleFromHistory(s.id)} title="Borrar registro del historial" className="btn-icon danger"><Trash2 size={16} /></button>)}
                            </div>
                          </td>
                        </tr>
                        {expandedSaleId === s.id && (
                          <tr>
                            <td colSpan="9" style={{ padding: '0', background: 'rgba(255,255,255,0.01)' }}>
                              <div style={{ padding: '16px 24px', borderLeft: '4px solid var(--primary-cyan)', margin: '10px 20px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                                {s.notes && (
                                  <div style={{ 
                                    margin: '0 0 14px 0', 
                                    padding: '8px 12px', 
                                    background: s.notes.includes('[CORRECCIÓN') ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.04)', 
                                    border: `1px solid ${s.notes.includes('[CORRECCIÓN') ? 'rgba(245, 158, 11, 0.35)' : 'var(--border-glass)'}`, 
                                    borderRadius: '6px', 
                                    fontSize: '0.8rem', 
                                    color: s.notes.includes('[CORRECCIÓN') ? 'var(--warning-amber)' : 'var(--text-muted)' 
                                  }}>
                                    <strong>{s.notes.includes('[CORRECCIÓN') ? '📝 Registro de Auditoría / Corrección:' : '📝 Nota / Observación:'}</strong> {s.notes}
                                  </div>
                                )}
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-bright)' }}>Artículos Vendidos en Ticket</h4>
                                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-glass)', opacity: 0.7 }}>
                                      <th style={{ padding: '8px 0' }}>Descripción Producto</th>
                                      <th style={{ padding: '8px 0', textAlign: 'center' }}>Cantidad</th>
                                      <th style={{ padding: '8px 0', textAlign: 'right' }}>Venta Unit.</th>
                                      {isAdmin && <th style={{ padding: '8px 0', textAlign: 'right' }}>Costo Unit.</th>}
                                      <th style={{ padding: '8px 0', textAlign: 'right' }}>Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Array.isArray(s.items) && s.items.map((item, idx) => {
                                      const refQty = Number(item.refunded_quantity) || 0;
                                      const remainingQty = Math.max(0, (Number(item.quantity) || 0) - refQty);
                                      const isItemFullyRefunded = refQty >= (Number(item.quantity) || 0);
                                      return (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)', opacity: isItemFullyRefunded ? 0.65 : 1 }}>
                                          <td style={{ padding: '8px 0', fontWeight: '500' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                              <span style={{ textDecoration: isItemFullyRefunded ? 'line-through' : 'none' }}>{item.product_name}</span>
                                              {refQty > 0 && (
                                                <span style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '4px', padding: '1px 6px', fontSize: '0.7rem', fontWeight: '700' }}>
                                                  ↩️ {refQty} devuelto{refQty > 1 ? 's' : ''}
                                                </span>
                                              )}
                                            </div>
                                            {item.original_price && item.original_price !== item.price && (
                                              <div style={{ fontSize: '0.65rem', color: 'var(--warning-amber)', marginTop: '2px' }}>
                                                Desc: de ${formatMoney(item.original_price)} a ${formatMoney(item.price)}
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ padding: '8px 0', textAlign: 'center' }}>
                                            {refQty > 0 ? (
                                              <div>
                                                <span style={{ fontWeight: '700' }}>{remainingQty} u.</span>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: '4px' }}>({item.quantity} u.)</span>
                                              </div>
                                            ) : (
                                              <span>{item.quantity} u.</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '8px 0', textAlign: 'right' }}>
                                            {item.original_price && item.original_price !== item.price ? (
                                              <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '4px' }}>${formatMoney(item.original_price)}</span>
                                            ) : null}
                                            ${formatMoney(item.price)}
                                          </td>
                                          {isAdmin && <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-muted)' }}>${formatMoney(item.cost_price)}</td>}
                                          <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '700', color: isItemFullyRefunded ? 'var(--text-muted)' : 'var(--primary-cyan)' }}>
                                            {refQty > 0 ? (
                                              <div>
                                                <span style={{ textDecoration: isItemFullyRefunded ? 'line-through' : 'none' }}>${formatMoney(remainingQty * (item.price || 0))}</span>
                                                <div style={{ fontSize: '0.7rem', color: '#f87171', fontWeight: 'normal' }}>
                                                  -${formatMoney(refQty * (item.price || 0))}
                                                </div>
                                              </div>
                                            ) : (
                                              `${formatMoney((item.quantity || 1) * (item.price || 0))}`
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>

                                {Array.isArray(s.refunds) && s.refunds.length > 0 && (
                                  <div style={{ marginTop: '14px', padding: '12px 16px', background: 'rgba(168, 85, 247, 0.08)', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ fontWeight: '800', color: '#c084fc', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>↩️ Comprobantes de Devolución Oficiales ({s.refunds.length})</span>
                                      </div>
                                      <div style={{ fontSize: '0.82rem', color: '#f87171', fontWeight: '800' }}>
                                        Total Reembolsado en Ticket: -${formatMoney(s.refunded_amount)}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {s.refunds.map(ref => (
                                        <div key={ref.id} style={{ background: 'rgba(0,0,0,0.35)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-glass)', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                          <div>
                                            <span style={{ fontWeight: '800', color: '#c084fc', marginRight: '8px' }}>#DEV-{ref.id}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{formatSafeDate(ref.created_at)}</span>
                                            <div style={{ marginTop: '4px', color: 'var(--text-bright)' }}>
                                              <span style={{ color: 'var(--text-muted)' }}>Motivo:</span> <i>"{ref.reason || 'Sin motivo especificado'}"</i>
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                              <span>👤 Atendido por: <b>{ref.user_name || 'Cajero'}</b></span>
                                              <span>📦 Reabastecido a bodega: <b>{ref.returned_to_stock ? '✅ Sí' : '❌ No'}</b></span>
                                              <span>💳 Medio: <b>{ref.refund_method || 'Efectivo'}</b></span>
                                            </div>
                                          </div>
                                          <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: '800', color: '#f87171' }}>
                                              -${formatMoney(ref.amount)}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: '600' }}>
                                              Reembolsado en {ref.refund_method || 'Efectivo'}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {s.payment_method === 'Mixto' && (
                                  <div style={{ marginTop: '12px', padding: '8px 14px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.25)', display: 'flex', gap: '20px', alignItems: 'center', fontSize: '0.85rem' }}>
                                    <span style={{ fontWeight: '800', color: 'var(--primary-cyan)' }}>🔄 Desglose Pago Mixto:</span>
                                    <span style={{ color: 'var(--success-emerald)' }}>💵 Efectivo: <b>${formatMoney(s.cash_amount)}</b></span>
                                    <span style={{ color: 'var(--primary-cyan)' }}>📱 Transferencia: <b>${formatMoney(s.transfer_amount)}</b></span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {view === 'report' && (
            <DailyReport config={config} dates={dates => dates} products={products} />
          )}

          {view === 'daily' && (
            <DailyReport config={config} dates={dates => dates} products={products} />
          )}

          {view === 'accounting' && (
            <AccountingManager config={config} activeShift={activeShift} isAdmin={isAdmin} adminPassword={adminPassword} />
          )}

          {view === 'shifts' && (
            <ShiftsReport config={config} />
          )}

          {view === 'reminders' && (
            <RemindersManager config={config} isAdmin={isAdmin} adminPassword={adminPassword} />
          )}

          {view === 'settings' && (
            <SettingsForm config={config} onSave={fetchData} adminPassword={adminPassword} onAdminPasswordChange={setAdminPassword} onTestPrint={handleTestPrint} />
          )}
        </div>
      </main>

      {/* Right Sidebar - Active Cart, Mesas y Caja Registradora Rediseñada */}
      <aside>
        {/* Cabecera Sidebar y Modo de Atención */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-glass)', flexShrink: 0 }}>
          {isTablesEnabled ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-bright)', margin: 0 }}>
                  <ShoppingCart size={18} color="var(--primary-cyan)" /> Registradora
                </h3>
                {activeAccounts.length > 0 && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', fontWeight: '700', background: 'rgba(129, 140, 248, 0.12)', padding: '2px 8px', borderRadius: '10px' }}>
                    {activeAccounts.length} mesa{activeAccounts.length > 1 ? 's' : ''} activa{activeAccounts.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Switcher Inteligente de Mesas / Venta Rápida */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr auto', gap: '6px' }}>
                <button 
                  type="button"
                  onClick={() => setSelectedAccountId(null)}
                  className="nav-btn"
                  style={{
                    padding: '6px 8px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    justifyContent: 'center',
                    background: selectedAccountId === null ? 'var(--primary-cyan)' : 'var(--bg-surface)',
                    color: selectedAccountId === null ? '#000' : 'var(--text-main)',
                    borderColor: selectedAccountId === null ? 'var(--primary-cyan)' : 'var(--border-glass)',
                    boxShadow: selectedAccountId === null ? '0 0 10px rgba(14,165,233,0.25)' : 'none'
                  }}
                  title="Venta de mostrador directa"
                >
                  ⚡ Rápida
                </button>

                <button 
                  type="button"
                  onClick={() => setShowTablesModal(true)}
                  className="nav-btn"
                  style={{
                    padding: '6px 8px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    justifyContent: 'center',
                    background: selectedAccountId !== null ? 'var(--accent-purple)' : 'var(--bg-surface)',
                    color: selectedAccountId !== null ? '#ffffff' : 'var(--text-main)',
                    borderColor: selectedAccountId !== null ? 'var(--accent-purple)' : 'var(--border-glass)',
                    boxShadow: selectedAccountId !== null ? '0 0 10px rgba(129,140,248,0.25)' : 'none'
                  }}
                  title="Abrir panel de mesas y cuentas activas"
                >
                  🪑 Mesas ({activeAccounts.length}) ▾
                </button>

                <button 
                  type="button"
                  onClick={createAccount}
                  className="nav-btn"
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    background: 'rgba(16, 185, 129, 0.12)',
                    borderColor: 'var(--success-emerald)',
                    color: 'var(--success-emerald)',
                    justifyContent: 'center'
                  }}
                  title="Crear nueva mesa inmediatamente"
                >
                  <Plus size={15} />
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-bright)', margin: 0 }}>
                <ShoppingCart size={18} color="var(--primary-cyan)" /> Registradora Mostrador
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--success-emerald)', fontWeight: '700', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ⚡ Venta Rápida
              </span>
            </div>
          )}

          {/* Banner de Mesa Activa en atención */}
          {isTablesEnabled && selectedAccountId !== null && (
            <div style={{
              marginTop: '8px',
              padding: '6px 10px',
              background: 'rgba(129, 140, 248, 0.08)',
              border: '1px solid rgba(129, 140, 248, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.85rem' }}>🪑</span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {activeAccounts.find(a => a.id === selectedAccountId)?.customer_name || 'Mesa'}
                </strong>
                {config.enable_table_timer !== 'false' && (() => {
                  const currentAcc = activeAccounts.find(a => a.id === selectedAccountId);
                  const timeStats = getTableTimeStats(currentAcc?.created_at);
                  return (
                    <span 
                      style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: '700', 
                        color: timeStats.color, 
                        background: timeStats.bg, 
                        border: `1px solid ${timeStats.border}`, 
                        padding: '1px 6px', 
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                      title="Tiempo de estadía de la mesa"
                    >
                      ⏱️ ${timeStats.label}
                    </span>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    const a = activeAccounts.find(acc => acc.id === selectedAccountId);
                    if (a) editAccount(a.id, a.customer_name, e);
                  }}
                  className="btn-icon"
                  style={{ padding: '2px 5px', fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-main)' }}
                  title="Renombrar mesa"
                >
                  <Edit2 size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTablesModal(true)}
                  className="btn-icon"
                  style={{ padding: '2px 6px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'var(--accent-purple)', fontWeight: '700' }}
                  title="Cambiar a otra mesa"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={(e) => deleteAccount(selectedAccountId, e)}
                  className="btn-icon danger"
                  style={{ padding: '2px 5px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  title="Liberar mesa"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Subcabecera de Carrito: Conteo de ítems, Selector Rondas/Consolidado y +Ronda */}
        <div style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)' }}>
            {currentCart.length} {currentCart.length === 1 ? 'artículo' : 'artículos'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isRoundsEnabled && (
              <>
                <div className="cart-mode-toggle">
                  <button 
                    type="button"
                    onClick={() => handleSetCartViewMode('rounds')}
                    className={`cart-mode-btn ${effectiveCartViewMode === 'rounds' ? 'active' : ''}`}
                    title="Modo Rondas: pedidos detallados cronológicamente por horario"
                  >
                    ⏱️ Rondas
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleSetCartViewMode('grouped')}
                    className={`cart-mode-btn ${effectiveCartViewMode === 'grouped' ? 'active' : ''}`}
                    title="Modo Consolidado: agrupa productos idénticos en una sola fila"
                  >
                    📦 Consolidado
                  </button>
                </div>

                {effectiveCartViewMode === 'rounds' && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualRoundCounter(prev => prev + 1);
                      showTemporaryNotification(`Nueva Ronda #${manualRoundCounter + 1} activada`, 'info');
                    }}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '10px',
                      border: '1px dashed var(--accent-purple)',
                      background: 'rgba(129, 140, 248, 0.1)',
                      color: 'var(--accent-purple)',
                      fontSize: '0.68rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                    title="Comenzar nueva ronda de pedidos"
                  >
                    + Ronda
                  </button>
                )}
              </>
            )}

            {currentCart.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('¿Vaciar todos los artículos de esta cuenta?')) {
                    if (selectedAccountId === null) {
                      setCart([]);
                    } else {
                      const updatedAccounts = activeAccounts.map(a => a.id === selectedAccountId ? { ...a, items: [] } : a);
                      setActiveAccounts(updatedAccounts);
                      syncAccountItems(selectedAccountId, []);
                    }
                  }
                }}
                className="btn-icon danger"
                style={{ padding: '2px 4px', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}
                title="Vaciar cuenta"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Contenido del Carrito Ampliado Verticalmente (Bloques por Ronda) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
          {currentCart.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)' }}>
              <ShoppingCart size={40} style={{ opacity: 0.15, marginBottom: '12px' }} />
              <p style={{ fontSize: '0.85rem', fontWeight: '500' }}>Sin artículos en esta cuenta</p>
              <p style={{ fontSize: '0.72rem', marginTop: '4px' }}>Haga clic en los productos para agregarlos.</p>
            </div>
          ) : effectiveCartViewMode === 'rounds' ? (
            /* ============================================================
               MODO RONDAS: TARJETAS VISUALES SEPARADAS POR TANDA DE PEDIDO
               ============================================================ */
            roundsGrouped.map(round => {
              const roundSubtotal = round.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
              const isUnconfirmed = !round.is_confirmed;

              return (
                <div key={round.round_num} className={`round-block-card ${isUnconfirmed ? 'open-round' : ''}`}>
                  {/* Cabecera del Bloque de Ronda */}
                  <div className="round-block-header">
                    <div className="round-block-title">
                      <span>📦 Ronda {round.round_num}</span>
                      {round.added_at && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                          · ⏱️ {formatItemTime(round.added_at)}
                        </span>
                      )}
                      <span 
                        style={{
                          fontSize: '0.66rem',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          fontWeight: '800',
                          background: isUnconfirmed ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isUnconfirmed ? 'var(--warning-amber)' : 'var(--success-emerald)',
                          border: isUnconfirmed ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        {isUnconfirmed ? '🟡 En curso' : '🟢 Confirmada'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="round-block-subtotal">
                        ${Math.round(roundSubtotal).toLocaleString('es-CO')}
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          setRoundToCheckoutModal({
                            round_num: round.round_num,
                            items: round.items,
                            subtotal: Math.round(roundSubtotal)
                          });
                          setRoundPaymentMethod('Efectivo');
                          setRoundCashTendered('');
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--primary-cyan)',
                          background: 'rgba(14, 165, 233, 0.15)',
                          color: 'var(--primary-cyan)',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Cobrar únicamente los productos de esta ronda"
                      >
                        💳 Cobrar Ronda
                      </button>
                    </div>
                  </div>

                  {/* Lista de productos de esta ronda */}
                  <div style={{ padding: '4px 10px' }}>
                    {round.items.map((item, idx) => {
                      const itemKey = item.row_id || item.id || (item.product_id + '_' + idx);
                      const itemName = item.name || item.product_name;
                      const productDetail = products.find(p => p.id === (item.product_id || item.id));
                      const isKg = productDetail?.unit_type === 'kg';

                      return (
                        <div 
                          key={itemKey} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '8px 0', 
                            borderBottom: idx < round.items.length - 1 ? '1px solid var(--border-glass)' : 'none',
                            gap: '8px'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <p style={{ fontWeight: '700', fontSize: '0.86rem', margin: 0, color: 'var(--text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {itemName}
                              </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.73rem', color: 'var(--primary-cyan)', fontWeight: '700' }}>
                                ${item.price.toLocaleString('es-CO')}
                              </span>
                              <button 
                                type="button"
                                onClick={() => editItemPrice(itemKey)} 
                                className="btn-icon" 
                                style={{ padding: '1px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--warning-amber)' }} 
                                title="Editar Precio Unitario"
                              >
                                <Edit2 size={11} />
                              </button>

                              {/* Selector para Mover Producto a Otra Ronda */}
                              <select 
                                value={item.round_num || 1} 
                                onChange={(e) => moveItemToRound(itemKey, e.target.value)}
                                className="round-move-select"
                                title="Cambiar este producto a otra ronda"
                              >
                                {allExistingRoundNumbers.map(r => (
                                  <option key={r} value={r}>Ronda {r}</option>
                                ))}
                                <option value="new">+ Nueva Ronda</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            {!isKg && (
                              <button 
                                type="button"
                                onClick={() => updateQuantity(itemKey, -1)} 
                                className="btn-icon" 
                                style={{ padding: '2px 6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                              >
                                -
                              </button>
                            )}
                            <span style={{ fontWeight: '800', fontSize: '0.88rem', minWidth: '16px', textAlign: 'center' }}>
                              {item.quantity} {isKg ? 'kg' : ''}
                            </span>
                            {!isKg && (
                              <button 
                                type="button"
                                onClick={() => updateQuantity(itemKey, 1)} 
                                className="btn-icon" 
                                style={{ padding: '2px 6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                              >
                                +
                              </button>
                            )}
                            <p style={{ fontWeight: '800', minWidth: '58px', textAlign: 'right', fontSize: '0.86rem', color: 'var(--text-bright)' }}>
                              {formatCOP(item.quantity * item.price, true)}
                            </p>
                            <button 
                              type="button"
                              onClick={() => removeFromCart(itemKey)} 
                              className="btn-icon danger" 
                              style={{ padding: '4px 6px' }}
                              title="Eliminar de esta ronda"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Botón de Confirmar Ronda si aún no está confirmada */}
                  {isUnconfirmed && (
                    <div style={{ padding: '4px 10px 8px 10px' }}>
                      <button 
                        type="button"
                        onClick={() => confirmCurrentRound(round.round_num)}
                        className="confirm-round-btn"
                        title="Sellar y confirmar esta tanda de pedidos"
                      >
                        <Check size={14} /> Confirmar / Enviar Ronda #{round.round_num}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            /* ============================================================
               MODO CONSOLIDADO: AGRUPACIÓN EN 1 SOLA FILA POR PRODUCTO
               ============================================================ */
            displayCart.map((item, idx) => {
              const itemKey = item.row_id || item.id || (item.product_id + '_' + idx);
              const itemName = item.name || item.product_name;
              const productDetail = products.find(p => p.id === (item.product_id || item.id));
              const isKg = productDetail?.unit_type === 'kg';
              const isGrouped = item.roundsCount > 1;

              return (
                <div 
                  key={itemKey} 
                  className="cart-item" 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '8px 0', 
                    borderBottom: '1px solid var(--border-glass)',
                    gap: '8px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      <p style={{ fontWeight: '700', fontSize: '0.86rem', margin: 0, color: 'var(--text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {itemName}
                      </p>
                      {isGrouped && (
                        <span className="round-badge" style={{ background: 'rgba(14, 165, 233, 0.15)', color: 'var(--primary-cyan)' }}>
                          📦 {item.roundsCount} rondas
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '0.73rem', color: 'var(--primary-cyan)', fontWeight: '700', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ${item.price.toLocaleString('es-CO')}
                      <button 
                        type="button"
                        onClick={() => editItemPrice(itemKey)} 
                        className="btn-icon" 
                        style={{ padding: '1px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--warning-amber)' }} 
                        title="Editar Precio Unitario"
                      >
                        <Edit2 size={11} />
                      </button>
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    {!isKg && (
                      <button 
                        type="button"
                        onClick={() => updateQuantity(itemKey, -1)} 
                        className="btn-icon" 
                        style={{ padding: '2px 6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                      >
                        -
                      </button>
                    )}
                    <span style={{ fontWeight: '800', fontSize: '0.88rem', minWidth: '16px', textAlign: 'center' }}>
                      {item.quantity} {isKg ? 'kg' : ''}
                    </span>
                    {!isKg && (
                      <button 
                        type="button"
                        onClick={() => updateQuantity(itemKey, 1)} 
                        className="btn-icon" 
                        style={{ padding: '2px 6px', fontSize: '0.85rem', fontWeight: 'bold' }}
                      >
                        +
                      </button>
                    )}
                    <p style={{ fontWeight: '800', minWidth: '58px', textAlign: 'right', fontSize: '0.86rem', color: 'var(--text-bright)' }}>
                      {formatCOP(item.quantity * item.price, true)}
                    </p>
                    <button 
                      type="button"
                      onClick={() => removeFromCart(itemKey)} 
                      className="btn-icon danger" 
                      style={{ padding: '4px 6px' }}
                      title="Eliminar de la cuenta"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Panel de Cobro y Fiado Compacto y Ergonómico (Ahorra ~200px de altura) */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-glass)', background: 'rgba(255, 255, 255, 0.015)', flexShrink: 0 }}>
          
          {/* Fila del Total a Pagar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-muted)' }}>Total a Pagar</span>
            <span style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--primary-cyan)', textShadow: '0 0 10px rgba(14,165,233,0.15)' }}>
              {formatCOP(cartTotal, true)}
            </span>
          </div>

          {/* Selector de Método de Pago Compacto Segmentado */}
          <div className="segmented-pay-group">
            <button 
              type="button"
              onClick={() => setPaymentMethod('Efectivo')} 
              className={`segmented-pay-btn ${paymentMethod === 'Efectivo' ? 'active-efectivo' : ''}`}
            >
              <span>💵</span> Efectivo
            </button>
            <button 
              type="button"
              onClick={() => setPaymentMethod('Transferencia')} 
              className={`segmented-pay-btn ${paymentMethod === 'Transferencia' ? 'active-transf' : ''}`}
            >
              <span>📱</span> Transf.
            </button>
            <button 
              type="button"
              onClick={() => setPaymentMethod('Mixto')} 
              className={`segmented-pay-btn ${paymentMethod === 'Mixto' ? 'active-mixto' : ''}`}
            >
              <span>🔀</span> Mixto
            </button>
            <button 
              type="button"
              onClick={() => setPaymentMethod('Fiado')} 
              className={`segmented-pay-btn ${paymentMethod === 'Fiado' ? 'active-fiado' : ''}`}
            >
              <span>📋</span> Fiar
            </button>
          </div>

          {/* Opciones Específicas del Método de Pago */}
          {paymentMethod === 'Efectivo' && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={cashTendered} 
                  onChange={(e) => setCashTendered(formatCOPInput(e.target.value))} 
                  placeholder="Recibido (ej: 50.000)" 
                  style={{ height: '32px', padding: '4px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-active)', borderRadius: '6px', width: '100%', fontSize: '0.82rem', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}
                />
                {cashTendered && (
                  <button 
                    type="button"
                    onClick={() => setCashTendered('')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {cashTendered && parseCOP(cashTendered) >= cartTotal && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-emerald)', fontWeight: '700', fontSize: '0.78rem', marginTop: '3px' }}>
                  <span>Cambio:</span>
                  <span>{formatCOP(parseCOP(cashTendered) - cartTotal, true)}</span>
                </div>
              )}
              {cashTendered && parseCOP(cashTendered) > 0 && parseCOP(cashTendered) < cartTotal && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger-rose)', fontWeight: '700', fontSize: '0.78rem', marginTop: '3px' }}>
                  <span>Faltan:</span>
                  <span>{formatCOP(cartTotal - parseCOP(cashTendered), true)}</span>
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'Mixto' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
              <div>
                <label style={{ fontSize: '0.66rem', color: 'var(--success-emerald)', fontWeight: '700', display: 'block', marginBottom: '1px' }}>💵 Efectivo</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={mixedCash} 
                  onChange={e => {
                    const val = formatCOPInput(e.target.value);
                    setMixedCash(val);
                    if (val !== '') {
                      const numericVal = parseCOP(val);
                      if (numericVal <= cartTotal) {
                        setMixedTransfer(formatCOPInput(cartTotal - numericVal));
                      }
                    }
                  }} 
                  placeholder="$0" 
                  style={{ height: '30px', padding: '4px 6px', background: 'var(--bg-surface)', borderColor: 'rgba(16, 185, 129, 0.4)', width: '100%', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.66rem', color: 'var(--primary-cyan)', fontWeight: '700', display: 'block', marginBottom: '1px' }}>📱 Transf.</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={mixedTransfer} 
                  onChange={e => {
                    const val = formatCOPInput(e.target.value);
                    setMixedTransfer(val);
                    if (val !== '') {
                      const numericVal = parseCOP(val);
                      if (numericVal <= cartTotal) {
                        setMixedCash(formatCOPInput(cartTotal - numericVal));
                      }
                    }
                  }} 
                  placeholder="$0" 
                  style={{ height: '30px', padding: '4px 6px', background: 'var(--bg-surface)', borderColor: 'rgba(56, 189, 248, 0.4)', width: '100%', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }} 
                />
              </div>
            </div>
          )}

          {paymentMethod === 'Fiado' && (
            <div style={{ marginBottom: '8px' }}>
              <input 
                type="text" 
                value={debtorName} 
                onChange={(e) => setDebtorName(e.target.value)} 
                placeholder="Nombre Cliente / Mesa para Fiado..." 
                style={{ height: '32px', padding: '4px 8px', borderColor: 'var(--warning-amber)', background: 'var(--bg-surface)', width: '100%', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-main)' }}
              />
            </div>
          )}

          {/* Control A Voluntad de Impresión y Fecha Histórica */}
          <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <label 
              title={
                config?.print_mode === 'manual' 
                  ? "Ajustes: Manual (No imprimir por defecto). Marca aquí si este cliente solicita ticket." 
                  : config?.print_mode === 'auto'
                    ? "Ajustes: Automático. Desmarca aquí si este cliente no desea ticket (ahorro de papel)."
                    : "Ajustes: Preguntar. Desmarca aquí si deseas cobrar de inmediato sin modal ni impresión."
              }
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                cursor: 'pointer', 
                color: printTicketOnCheckout ? 'var(--primary-cyan)' : 'var(--text-muted)', 
                fontSize: '0.74rem',
                fontWeight: printTicketOnCheckout ? '700' : '500',
                background: printTicketOnCheckout ? 'rgba(14, 165, 233, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                padding: '3px 8px',
                borderRadius: '6px',
                border: printTicketOnCheckout ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid var(--border-glass)',
                userSelect: 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <input 
                type="checkbox" 
                checked={printTicketOnCheckout} 
                onChange={(e) => setPrintTicketOnCheckout(e.target.checked)} 
                style={{ marginRight: '6px', accentColor: 'var(--primary-cyan)', cursor: 'pointer' }}
              />
              <Printer size={13} style={{ marginRight: '4px' }} />
              {printTicketOnCheckout ? 'Imprimir Ticket' : 'Sin Ticket (Ahorro)'}
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
              <input 
                type="checkbox" 
                checked={isHistorical} 
                onChange={(e) => setIsHistorical(e.target.checked)} 
                style={{ marginRight: '5px', accentColor: 'var(--primary-cyan)' }}
              />
              Fecha histórica
            </label>
            {isHistorical && (
              <input 
                type="datetime-local" 
                value={customDate} 
                onChange={(e) => setCustomDate(e.target.value)} 
                className="app-input" 
                style={{ height: '26px', padding: '2px 4px', fontSize: '0.7rem', width: '100%', marginTop: '4px' }}
              />
            )}
          </div>

          {/* Botón Principal de Cobro */}
          <div style={{ display: 'grid', gridTemplateColumns: currentCart.length > 0 ? '1.1fr 1.6fr' : '1fr', gap: '8px' }}>
            {currentCart.length > 0 && (
              <button 
                type="button"
                onClick={() => {
                  setShowSplitModal(true);
                  setSplitItemQuantities({});
                  setSplitCashTendered('');
                }}
                className="checkout-btn-secondary"
                style={{
                  padding: '11px 6px',
                  fontSize: '0.82rem',
                  fontWeight: '800',
                  borderColor: 'var(--warning-amber)',
                  color: 'var(--warning-amber)',
                  background: 'rgba(245, 158, 11, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
                title="Pagar por cliente separado o dividir en partes iguales"
              >
                ✂️ Pagos Separados
              </button>
            )}

            <button 
              disabled={currentCart.length === 0 || isProcessing} 
              onClick={handleCheckout}
              className="checkout-btn"
              style={{
                padding: '11px',
                fontSize: '0.94rem',
                ...(paymentMethod === 'Fiado' ? { background: 'var(--warning-amber)', color: '#000', boxShadow: '0 0 15px rgba(245,158,11,0.25)' } : {})
              }}
            >
              {isProcessing ? 'PROCESANDO...' : paymentMethod === 'Fiado' ? 'DEJAR EN CUENTA (FIADO)' : (selectedAccountId !== null ? 'COBRAR TOTAL MESA (F12)' : 'COBRAR VENTA (F12)')}
            </button>
          </div>
        </div>
      </aside>

      
      {/* MODAL VISUAL INTELIGENTE DE MESAS Y CUENTAS ACTIVAS */}
      {showTablesModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowTablesModal(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '820px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  🪑 Control de Mesas y Cuentas Abiertas
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                  {activeAccounts.length} mesa{activeAccounts.length === 1 ? '' : 's'} en curso actualmente
                </p>
              </div>
              <button 
                onClick={() => setShowTablesModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Barra de Búsqueda y Creación Rápida */}
            <div style={{ padding: '12px 20px', display: 'flex', gap: '10px', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-surface)' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  placeholder="Buscar mesa por nombre o número..."
                  className="app-input"
                  style={{ width: '100%', paddingLeft: '34px', height: '36px', fontSize: '0.85rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {config.enable_digital_menu !== 'false' && (
                  <button
                    type="button"
                    onClick={() => { setShowTablesModal(false); setShowQrMenuModal(true); }}
                    className="nav-btn"
                    style={{ padding: '8px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.35)', height: '36px', fontWeight: '700' }}
                    title="Generar e imprimir QR de la Carta para mesas"
                  >
                    <QrCode size={16} /> Carta QR
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowTablesModal(false);
                    createAccount();
                  }}
                  className="checkout-btn"
                  style={{ width: 'auto', padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--success-emerald)', color: '#000', height: '36px' }}
                >
                  <Plus size={16} /> Abrir Nueva Mesa
                </button>
              </div>
            </div>

            {/* Matriz Visual de Tarjetas de Mesas */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {activeAccounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: '10px' }}>🪑</span>
                  <h4 style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '6px' }}>No hay mesas abiertas en este momento</h4>
                  <p style={{ fontSize: '0.82rem', marginBottom: '16px' }}>Todas las ventas están en mostrador o listas para abrir una nueva mesa.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTablesModal(false);
                      createAccount();
                    }}
                    className="checkout-btn"
                    style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', fontSize: '0.9rem' }}
                  >
                    <Plus size={16} /> Abrir Primera Mesa
                  </button>
                </div>
              ) : (
                <div className="table-matrix-grid">
                  {activeAccounts
                    .filter(a => a.customer_name.toLowerCase().includes(tableSearchQuery.toLowerCase()))
                    .map(a => {
                      const totalMesa = Math.round((a.items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0));
                      const totalItems = (a.items || []).reduce((sum, item) => sum + item.quantity, 0);
                      const isSelected = selectedAccountId === a.id;
                      const timeStats = getTableTimeStats(a.created_at);
                      const hasUnconfirmed = (a.items || []).some(item => item.is_confirmed === false || item.is_confirmed === 0);
                      const timerEnabled = config.enable_table_timer !== 'false';
                      return (
                        <div 
                          key={a.id}
                          className={`table-matrix-card ${isSelected ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedAccountId(a.id);
                            setShowTablesModal(false);
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: isSelected ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.1rem'
                              }}>
                                🪑
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <strong style={{ fontSize: '0.95rem', color: isSelected ? 'var(--accent-purple)' : 'var(--text-bright)', display: 'block' }}>
                                    {a.customer_name}
                                  </strong>
                                  {timerEnabled && (
                                    <span 
                                      title={`Tiempo de estadía: ${timeStats.label}`}
                                      style={{ 
                                        fontSize: '0.68rem', 
                                        fontWeight: '700', 
                                        color: timeStats.color, 
                                        background: timeStats.bg, 
                                        border: `1px solid ${timeStats.border}`,
                                        padding: '1px 6px', 
                                        borderRadius: '12px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      ⏱️ {timeStats.label}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                  <span style={{ fontSize: '0.72rem', color: totalItems > 0 ? 'var(--warning-amber)' : 'var(--text-muted)' }}>
                                    {totalItems > 0 ? `🟢 ${totalItems} producto${totalItems > 1 ? 's' : ''}` : '⚪ Sin productos'}
                                  </span>
                                  {hasUnconfirmed && (
                                    <span style={{ fontSize: '0.68rem', color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                                      ⏳ Ronda pendiente
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                              <button 
                                type="button"
                                onClick={(e) => editAccount(a.id, a.customer_name, e)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                title="Editar nombre de mesa"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => deleteAccount(a.id, e)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--danger-rose)', cursor: 'pointer', padding: '4px' }}
                                title="Eliminar mesa"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '8px', borderTop: '1px solid var(--border-glass)' }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: '600' }}>Consumo</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: '800', color: totalMesa > 0 ? 'var(--primary-cyan)' : 'var(--text-muted)' }}>
                              ${totalMesa.toLocaleString('es-CO')}
                            </span>
                          </div>

                          <button
                            type="button"
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: isSelected ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                              color: isSelected ? '#fff' : 'var(--text-main)',
                              fontSize: '0.78rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              marginTop: '2px'
                            }}
                          >
                            {isSelected ? '✓ Mesa Seleccionada' : 'Atender / Cargar Mesa'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedAccountId(null);
                  setShowTablesModal(false);
                }}
                className="nav-btn"
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                ⚡ Cambiar a Venta Rápida (Mostrador)
              </button>
              <button
                type="button"
                onClick={() => setShowTablesModal(false)}
                className="nav-btn"
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE COBRO ESPECÍFICO DE RONDA */}
      {roundToCheckoutModal && (
        <div className="modal-overlay" style={{ zIndex: 10002 }} onClick={() => setRoundToCheckoutModal(null)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '520px', width: '92%', padding: '0', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                💳 Cobrar Ronda #{roundToCheckoutModal.round_num}
              </h3>
              <button 
                type="button"
                onClick={() => setRoundToCheckoutModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', maxHeight: '55vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '700' }}>PRODUCTOS DE ESTA RONDA</p>
              <div style={{ background: 'var(--bg-surface)', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px', border: '1px solid var(--border-glass)' }}>
                {roundToCheckoutModal.items.map((i, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', padding: '4px 0', borderBottom: idx < roundToCheckoutModal.items.length - 1 ? '1px solid var(--border-glass)' : 'none' }}>
                    <span>{i.quantity}x {i.product_name || i.name}</span>
                    <strong style={{ color: 'var(--text-bright)' }}>${Math.round(i.quantity * i.price).toLocaleString('es-CO')}</strong>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-muted)' }}>Total a Pagar Ronda</span>
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary-cyan)' }}>
                  ${roundToCheckoutModal.subtotal.toLocaleString('es-CO')}
                </span>
              </div>

              <div className="segmented-pay-group" style={{ marginBottom: '10px' }}>
                <button 
                  type="button"
                  onClick={() => setRoundPaymentMethod('Efectivo')} 
                  className={`segmented-pay-btn ${roundPaymentMethod === 'Efectivo' ? 'active-efectivo' : ''}`}
                >
                  <span>💵</span> Efectivo
                </button>
                <button 
                  type="button"
                  onClick={() => setRoundPaymentMethod('Transferencia')} 
                  className={`segmented-pay-btn ${roundPaymentMethod === 'Transferencia' ? 'active-transf' : ''}`}
                >
                  <span>📱</span> Transf.
                </button>
                <button 
                  type="button"
                  onClick={() => setRoundPaymentMethod('Mixto')} 
                  className={`segmented-pay-btn ${roundPaymentMethod === 'Mixto' ? 'active-mixto' : ''}`}
                >
                  <span>🔀</span> Mixto
                </button>
              </div>

              {roundPaymentMethod === 'Efectivo' && (
                <div style={{ marginBottom: '10px' }}>
                  <input 
                    type="text" 
                    inputMode="numeric" 
                    value={roundCashTendered} 
                    onChange={e => setRoundCashTendered(formatCOPInput(e.target.value))} 
                    placeholder="Recibido (ej: 50.000)" 
                    style={{ height: '34px', padding: '6px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-active)', borderRadius: '6px', width: '100%', fontSize: '0.85rem', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}
                  />
                  {roundCashTendered && parseCOP(roundCashTendered) >= roundToCheckoutModal.subtotal && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-emerald)', fontWeight: '700', fontSize: '0.8rem', marginTop: '4px' }}>
                      <span>Cambio a devolver:</span>
                      <span>{formatCOP(parseCOP(roundCashTendered) - roundToCheckoutModal.subtotal, true)}</span>
                    </div>
                  )}
                </div>
              )}

              {roundPaymentMethod === 'Mixto' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--success-emerald)', fontWeight: '700' }}>💵 Efectivo</label>
                    <input 
                      type="text" 
                      inputMode="numeric" 
                      value={roundMixedCash} 
                      onChange={e => {
                        const val = formatCOPInput(e.target.value);
                        setRoundMixedCash(val);
                        if (val !== '') {
                          const n = parseCOP(val);
                          if (n <= roundToCheckoutModal.subtotal) setRoundMixedTransfer(formatCOPInput(roundToCheckoutModal.subtotal - n));
                        }
                      }} 
                      placeholder="$0"
                      style={{ height: '32px', padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid rgba(16,185,129,0.4)', width: '100%', borderRadius: '6px', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--primary-cyan)', fontWeight: '700' }}>📱 Transf.</label>
                    <input 
                      type="text" 
                      inputMode="numeric" 
                      value={roundMixedTransfer} 
                      onChange={e => {
                        const val = formatCOPInput(e.target.value);
                        setRoundMixedTransfer(val);
                        if (val !== '') {
                          const n = parseCOP(val);
                          if (n <= roundToCheckoutModal.subtotal) setRoundMixedCash(formatCOPInput(roundToCheckoutModal.subtotal - n));
                        }
                      }} 
                      placeholder="$0"
                      style={{ height: '32px', padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid rgba(56,189,248,0.4)', width: '100%', borderRadius: '6px', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-glass)', background: 'var(--bg-panel)', display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setRoundToCheckoutModal(null)}
                className="nav-btn"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCheckoutSingleRound}
                className="checkout-btn"
                style={{ flex: 2, padding: '10px' }}
              >
                {isProcessing ? 'PROCESANDO...' : `CONFIRMAR PAGO RONDA #${roundToCheckoutModal.round_num}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROFESIONAL DE DIVISIÓN DE CUENTAS (SPLIT BILL) */}
      {showSplitModal && (
        <div className="modal-overlay" style={{ zIndex: 10002 }} onClick={() => setShowSplitModal(false)}>
          <div 
            className="modal-content" 
            style={{ maxWidth: '680px', width: '94%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-bright)', margin: 0 }}>
                  ✂️ Dividir Cuenta / Pago Separado
                </h3>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Total actual de la mesa: ${cartTotal.toLocaleString('es-CO')}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowSplitModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Pestañas de Modo de División */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-surface)' }}>
              <button 
                type="button"
                onClick={() => setSplitTab('items')}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  background: splitTab === 'items' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                  borderBottom: splitTab === 'items' ? '2px solid var(--primary-cyan)' : 'none',
                  color: splitTab === 'items' ? 'var(--primary-cyan)' : 'var(--text-muted)',
                  fontWeight: '800',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                🍽️ Por Selección de Productos (Cliente por Cliente)
              </button>
              <button 
                type="button"
                onClick={() => setSplitTab('equal')}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  background: splitTab === 'equal' ? 'rgba(129, 140, 248, 0.12)' : 'transparent',
                  borderBottom: splitTab === 'equal' ? '2px solid var(--accent-purple)' : 'none',
                  color: splitTab === 'equal' ? 'var(--accent-purple)' : 'var(--text-muted)',
                  fontWeight: '800',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                👥 En Partes Iguales (Equitativo)
              </button>
            </div>

            {/* Contenido Pestaña 1: Selección de Ítems */}
            {splitTab === 'items' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    Marque los productos y cantidades que va a pagar este comensal:
                  </p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = {};
                        currentCart.forEach((item, idx) => {
                          allSelected[getCartItemKey(item, idx)] = item.quantity;
                        });
                        setSplitItemQuantities(allSelected);
                      }}
                      className="nav-btn"
                      style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                    >
                      ✓ Marcar Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitItemQuantities({})}
                      className="nav-btn"
                      style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                    >
                      ✕ Desmarcar
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {currentCart.map((item, idx) => {
                    const itemKey = getCartItemKey(item, idx);
                    const selectedQty = Number(splitItemQuantities[itemKey]) || 0;
                    const isChecked = selectedQty > 0;

                    return (
                      <div 
                        key={itemKey}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: isChecked ? 'rgba(14, 165, 233, 0.09)' : 'var(--bg-surface)',
                          border: isChecked ? '1px solid var(--primary-cyan)' : '1px solid var(--border-glass)',
                          borderRadius: '8px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              setSplitItemQuantities(prev => ({
                                ...prev,
                                [itemKey]: e.target.checked ? item.quantity : 0
                              }));
                            }}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cyan)', cursor: 'pointer' }}
                          />
                          <div>
                            <strong style={{ fontSize: '0.86rem', color: isChecked ? 'var(--text-bright)' : 'var(--text-muted)', display: 'block' }}>
                              {item.product_name || item.name}
                            </strong>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              ${item.price.toLocaleString('es-CO')} c/u · En mesa: {item.quantity} {item.round_num ? `(Ronda ${item.round_num})` : ''}
                            </span>
                          </div>
                        </div>

                        {/* Selector de cantidad a pagar por este comensal */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            disabled={!isChecked || selectedQty <= 1}
                            onClick={() => {
                              setSplitItemQuantities(prev => ({
                                ...prev,
                                [itemKey]: Math.max(1, selectedQty - 1)
                              }));
                            }}
                            className="btn-icon"
                            style={{ padding: '2px 8px', fontSize: '0.85rem', fontWeight: '800' }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: '0.88rem', fontWeight: '800', minWidth: '22px', textAlign: 'center', color: isChecked ? 'var(--primary-cyan)' : 'var(--text-muted)' }}>
                            {selectedQty}
                          </span>
                          <button
                            type="button"
                            disabled={!isChecked || selectedQty >= item.quantity}
                            onClick={() => {
                              setSplitItemQuantities(prev => ({
                                ...prev,
                                [itemKey]: Math.min(item.quantity, selectedQty + 1)
                              }));
                            }}
                            className="btn-icon"
                            style={{ padding: '2px 8px', fontSize: '0.85rem', fontWeight: '800' }}
                          >
                            +
                          </button>
                          <strong style={{ fontSize: '0.9rem', minWidth: '70px', textAlign: 'right', color: isChecked ? 'var(--primary-cyan)' : 'var(--text-muted)' }}>
                            ${Math.round(selectedQty * item.price).toLocaleString('es-CO')}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotal seleccionado y Medio de Pago */}
                {(() => {
                  const subtotalPagar = currentCart.reduce((sum, item, idx) => {
                    const itemKey = getCartItemKey(item, idx);
                    const q = Number(splitItemQuantities[itemKey]) || 0;
                    return sum + (q * item.price);
                  }, 0);

                  const countSelectedItems = currentCart.reduce((sum, item, idx) => {
                    const itemKey = getCartItemKey(item, idx);
                    return sum + (Number(splitItemQuantities[itemKey]) || 0);
                  }, 0);

                  return (
                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                          Total a Cobrar a este Cliente ({countSelectedItems} prod.):
                        </span>
                        <span style={{ fontSize: '1.45rem', fontWeight: '900', color: 'var(--primary-cyan)' }}>
                          ${subtotalPagar.toLocaleString('es-CO')}
                        </span>
                      </div>

                      <div className="segmented-pay-group" style={{ marginBottom: '8px' }}>
                        <button 
                          type="button"
                          onClick={() => setSplitPaymentMethod('Efectivo')} 
                          className={`segmented-pay-btn ${splitPaymentMethod === 'Efectivo' ? 'active-efectivo' : ''}`}
                        >
                          <span>💵</span> Efectivo
                        </button>
                        <button 
                          type="button"
                          onClick={() => setSplitPaymentMethod('Transferencia')} 
                          className={`segmented-pay-btn ${splitPaymentMethod === 'Transferencia' ? 'active-transf' : ''}`}
                        >
                          <span>📱</span> Transf.
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setSplitPaymentMethod('Mixto');
                            setSplitMixedCash('');
                            setSplitMixedTransfer('');
                          }} 
                          className={`segmented-pay-btn ${splitPaymentMethod === 'Mixto' ? 'active-mixto' : ''}`}
                        >
                          <span>🔀</span> Mixto
                        </button>
                      </div>

                      {splitPaymentMethod === 'Efectivo' && (
                        <div style={{ marginBottom: '8px' }}>
                          <input 
                            type="text" 
                            inputMode="numeric" 
                            value={splitCashTendered} 
                            onChange={e => setSplitCashTendered(formatCOPInput(e.target.value))} 
                            placeholder="Recibido de este cliente (ej: 50.000)" 
                            style={{ height: '34px', padding: '4px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-active)', borderRadius: '6px', width: '100%', fontSize: '0.84rem', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}
                          />
                          {splitCashTendered && parseCOP(splitCashTendered) >= subtotalPagar && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-emerald)', fontWeight: '700', fontSize: '0.8rem', marginTop: '4px' }}>
                              <span>Cambio a devolver:</span>
                              <span>{formatCOP(parseCOP(splitCashTendered) - subtotalPagar, true)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {splitPaymentMethod === 'Mixto' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>💵 Efectivo:</label>
                            <input 
                              type="text" 
                              inputMode="numeric" 
                              value={splitMixedCash} 
                              onChange={e => {
                                const formatted = formatCOPInput(e.target.value);
                                setSplitMixedCash(formatted);
                                const rem = Math.max(0, subtotalPagar - parseCOP(formatted));
                                setSplitMixedTransfer(rem > 0 ? formatCOPInput(rem) : '');
                              }} 
                              placeholder="$0" 
                              style={{ height: '32px', padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '6px', width: '100%', fontSize: '0.82rem', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>📱 Transferencia:</label>
                            <input 
                              type="text" 
                              inputMode="numeric" 
                              value={splitMixedTransfer} 
                              onChange={e => setSplitMixedTransfer(formatCOPInput(e.target.value))} 
                              placeholder="$0" 
                              style={{ height: '32px', padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '6px', width: '100%', fontSize: '0.82rem', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={subtotalPagar === 0 || isProcessing}
                        onClick={handleCheckoutSplitItems}
                        className="checkout-btn"
                        style={{ width: '100%', padding: '11px', marginTop: '6px' }}
                      >
                        {isProcessing ? 'PROCESANDO...' : `COBRAR SELECCIÓN ($${subtotalPagar.toLocaleString('es-CO')})`}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Contenido Pestaña 2: División en Partes Iguales */}
            {splitTab === 'equal' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Seleccione el número de personas para dividir el total en montos exactos iguales:
                </p>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  {[2, 3, 4, 5, 6].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSplitEqualPeople(n)}
                      style={{
                        flex: 1,
                        padding: '10px 4px',
                        borderRadius: '8px',
                        border: splitEqualPeople === n ? '2px solid var(--accent-purple)' : '1px solid var(--border-glass)',
                        background: splitEqualPeople === n ? 'rgba(129, 140, 248, 0.15)' : 'var(--bg-surface)',
                        color: splitEqualPeople === n ? '#fff' : 'var(--text-muted)',
                        fontWeight: '800',
                        fontSize: '0.88rem',
                        cursor: 'pointer'
                      }}
                    >
                      {n} personas
                    </button>
                  ))}
                </div>

                {(() => {
                  const shareAmount = Math.round(cartTotal / splitEqualPeople);
                  return (
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Cuenta Mesa:</span>
                        <strong style={{ fontSize: '1.1rem', color: 'var(--text-bright)' }}>${cartTotal.toLocaleString('es-CO')}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '8px', borderTop: '1px solid var(--border-glass)' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--accent-purple)', fontWeight: '700' }}>
                          Cada comensal paga:
                        </span>
                        <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-purple)' }}>
                          ${shareAmount.toLocaleString('es-CO')}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                        💡 Sugerencia operativa: Puede cobrar el monto de ${shareAmount.toLocaleString('es-CO')} a cada persona usando la pestaña "Por Selección" o registrando cada parte por el medio de pago que entregue el cliente.
                      </p>
                    </div>
                  );
                })()}

                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px', marginTop: '12px' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    MEDIO DE PAGO PARA ESTA PARTE:
                  </p>
                  
                  <div className="segmented-pay-group" style={{ marginBottom: '10px' }}>
                    <button 
                      type="button"
                      onClick={() => setSplitPaymentMethod('Efectivo')} 
                      className={`segmented-pay-btn ${splitPaymentMethod === 'Efectivo' ? 'active-efectivo' : ''}`}
                    >
                      <span>💵</span> Efectivo
                    </button>
                    <button 
                      type="button"
                      onClick={() => setSplitPaymentMethod('Transferencia')} 
                      className={`segmented-pay-btn ${splitPaymentMethod === 'Transferencia' ? 'active-transf' : ''}`}
                    >
                      <span>📱</span> Transf.
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isProcessing || splitEqualPeople < 1}
                    onClick={handleCheckoutEqualShare}
                    className="checkout-btn"
                    style={{ width: '100%', padding: '11px', background: 'var(--accent-purple)', color: '#fff', fontWeight: '800' }}
                  >
                    {isProcessing ? 'PROCESANDO...' : `COBRAR 1 PARTE (${Math.round(cartTotal / splitEqualPeople).toLocaleString('es-CO')})`}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSplitTab('items')}
                    className="nav-btn"
                    style={{ width: '100%', justifyContent: 'center', padding: '8px', marginTop: '8px', fontSize: '0.78rem' }}
                  >
                    O preferir cobrar por Selección de Productos
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CARTA DIGITAL Y CÓDIGO QR */}
      {showQrMenuModal && (
        <div className="modal-overlay" style={{ zIndex: 10002 }} onClick={() => setShowQrMenuModal(false)}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '92%', borderRadius: '16px', overflow: 'hidden', padding: 0 }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-bright)' }}>
                    Carta Digital y QR para Mesas
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Tus clientes pueden escanear y ver productos, precios y existencias en vivo
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowQrMenuModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Selector de tipo de conexión: Ngrok vs Local Wi-Fi */}
              <div style={{ display: 'flex', width: '100%', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setQrTargetMode('ngrok')}
                  disabled={!networkInfo?.ngrok_url}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: qrTargetMode === 'ngrok' ? '#818cf8' : 'var(--border-glass)',
                    background: qrTargetMode === 'ngrok' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface)',
                    color: qrTargetMode === 'ngrok' ? '#818cf8' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: networkInfo?.ngrok_url ? 'pointer' : 'not-allowed',
                    opacity: networkInfo?.ngrok_url ? 1 : 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Globe size={14} /> Internet (Ngrok)
                  {networkInfo?.ngrok_url && <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '1px 5px', borderRadius: '4px' }}>Online</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setQrTargetMode('local')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: qrTargetMode === 'local' ? 'var(--primary-cyan)' : 'var(--border-glass)',
                    background: qrTargetMode === 'local' ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-surface)',
                    color: qrTargetMode === 'local' ? 'var(--primary-cyan)' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Smartphone size={14} /> Red Wi-Fi Local
                </button>
              </div>

              {/* Imagen del Código QR */}
              <div style={{
                background: '#ffffff',
                padding: '14px',
                borderRadius: '16px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="Código QR Carta Digital" style={{ width: '220px', height: '220px', display: 'block' }} />
                ) : (
                  <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    Generando QR...
                  </div>
                )}
              </div>

              {/* URL actual */}
              <div style={{
                width: '100%',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-glass)',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                  {qrTargetMode === 'ngrok' && networkInfo?.ngrok_url
                    ? `${networkInfo.ngrok_url}/carta`
                    : (networkInfo?.local_url ? `${networkInfo.local_url}/carta` : `${window.location.origin}/carta`)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const url = qrTargetMode === 'ngrok' && networkInfo?.ngrok_url
                      ? `${networkInfo.ngrok_url}/carta`
                      : (networkInfo?.local_url ? `${networkInfo.local_url}/carta` : `${window.location.origin}/carta`);
                    navigator.clipboard?.writeText(url);
                    setCopiedQrLink(true);
                    setTimeout(() => setCopiedQrLink(false), 2500);
                  }}
                  style={{
                    background: copiedQrLink ? 'var(--success-emerald)' : 'rgba(255,255,255,0.08)',
                    color: copiedQrLink ? '#000' : 'var(--text-bright)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {copiedQrLink ? <Check size={12} /> : <Copy size={12} />}
                  {copiedQrLink ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '10px' }}>
                <div style={{ display: 'flex', width: '100%', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const url = qrTargetMode === 'ngrok' && networkInfo?.ngrok_url
                        ? `${networkInfo.ngrok_url}/carta`
                        : (networkInfo?.local_url ? `${networkInfo.local_url}/carta` : `${window.location.origin}/carta`);
                      window.open(url, '_blank');
                    }}
                    className="nav-btn"
                    style={{ flex: 1, padding: '10px', fontSize: '0.85rem', fontWeight: '700', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}
                  >
                    <Eye size={16} /> Abrir Carta
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintTableQr()}
                    className="nav-btn"
                    style={{ flex: 1, padding: '10px', fontSize: '0.85rem', fontWeight: '700', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}
                  >
                    <Printer size={16} /> Imprimir Rótulo QR
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSendQrTelegram}
                  disabled={isSendingQrTelegram}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '0.92rem',
                    fontWeight: '800',
                    justifyContent: 'center',
                    background: sentQrTelegramSuccess ? '#10b981' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: sentQrTelegramSuccess ? '0 4px 15px rgba(16, 185, 129, 0.4)' : '0 4px 15px rgba(2, 132, 199, 0.4)',
                    cursor: isSendingQrTelegram ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: isSendingQrTelegram ? 0.7 : 1
                  }}
                >
                  <Send size={16} />
                  {isSendingQrTelegram ? (
                    'Enviando QR a Telegram...'
                  ) : sentQrTelegramSuccess ? (
                    '✓ ¡Código QR Enviado a Telegram!'
                  ) : (
                    'Enviar Código QR a Telegram'
                  )}
                </button>
              </div>

              <p style={{ margin: '14px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                💡 <strong>Tip para el negocio:</strong> Imprime este rótulo para ponerlo en acrílicos o porta-menús en cada mesa. Los clientes escanean con la cámara y ven la carta digital sin necesidad de descargar ninguna aplicación.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DEVOLUCIÓN INTELIGENTE */}
      {showRefundModal && refundSale && (
        <div className="modal-overlay" style={{ zIndex: 10001 }}>
          <div className="modal-content" style={{ maxWidth: '580px', padding: '0', overflow: 'hidden', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
            {/* Header del Modal */}
            <div style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(124, 58, 237, 0.2))', padding: '20px 24px', borderBottom: '1px solid rgba(168, 85, 247, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontWeight: '800', color: '#c084fc', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ↩️ Procesar Devolución
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Ticket <strong style={{ color: 'var(--text-bright)' }}>#TKT-{refundSale.id}</strong> — Total: <strong style={{ color: 'var(--text-bright)' }}>${refundSale.total.toLocaleString('es-CO')}</strong>
                  </p>
                </div>
                <button onClick={() => setShowRefundModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1 }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Nombre Cajero */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: '700', fontSize: '0.88rem' }}>👤 Nombre del Cajero que Procesa</label>
                <input
                  type="text"
                  value={refundUserName}
                  onChange={e => setRefundUserName(e.target.value)}
                  placeholder="Ej: Carlos, María..."
                  className="app-input"
                  style={{ marginTop: '6px' }}
                />
              </div>

              {/* Artículos a devolver */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-bright)' }}>📦 Artículos del Ticket</label>
                  <button
                    type="button"
                    onClick={() => setRefundItems(prev => prev.map(ri => ({ ...ri, refundQty: ri.availableQty })))}
                    style={{ background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', color: '#c084fc', borderRadius: '8px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer' }}
                  >
                    Seleccionar Todo
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {refundItems.map((ri, idx) => (
                    <div key={ri.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: ri.refundQty > 0 ? 'rgba(168, 85, 247, 0.08)' : 'var(--bg-surface)', border: `1px solid ${ri.refundQty > 0 ? 'rgba(168, 85, 247, 0.3)' : 'var(--border-glass)'}`, borderRadius: '10px', padding: '10px 14px', transition: 'all 0.15s' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{ri.product_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          ${ri.price.toLocaleString('es-CO')} c/u — Disponibles para devolver: <strong style={{ color: ri.availableQty > 0 ? 'var(--success-emerald)' : 'var(--danger-rose)' }}>{ri.availableQty}</strong>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setRefundItems(prev => prev.map((r, i) => i === idx ? { ...r, refundQty: Math.max(0, r.refundQty - 1) } : r))}
                          disabled={ri.refundQty <= 0}
                          style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-dark)', color: 'var(--text-bright)', fontWeight: '800', fontSize: '1.1rem', cursor: 'pointer', opacity: ri.refundQty <= 0 ? 0.4 : 1 }}
                        >−</button>
                        <span style={{ minWidth: '28px', textAlign: 'center', fontWeight: '800', fontSize: '1rem', color: ri.refundQty > 0 ? '#c084fc' : 'var(--text-muted)' }}>{ri.refundQty}</span>
                        <button
                          type="button"
                          onClick={() => setRefundItems(prev => prev.map((r, i) => i === idx ? { ...r, refundQty: Math.min(r.availableQty, r.refundQty + 1) } : r))}
                          disabled={ri.refundQty >= ri.availableQty}
                          style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-dark)', color: 'var(--text-bright)', fontWeight: '800', fontSize: '1.1rem', cursor: 'pointer', opacity: ri.refundQty >= ri.availableQty ? 0.4 : 1 }}
                        >+</button>
                      </div>
                      <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: '800', color: ri.refundQty > 0 ? '#c084fc' : 'var(--text-muted)', fontSize: '0.9rem' }}>
                        ${(ri.refundQty * ri.price).toLocaleString('es-CO')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Motivo */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontWeight: '700', fontSize: '0.88rem' }}>🔄 Motivo de la Devolución *</label>
                <select
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  className="app-input"
                  style={{ marginTop: '6px' }}
                >
                  <option value="">— Seleccionar motivo —</option>
                  <option value="Producto en mal estado o vencido">Producto en mal estado o vencido</option>
                  <option value="Error en digitación o cobro">Error en digitación o cobro</option>
                  <option value="Cliente cambió de opinión / no consumió">Cliente cambió de opinión / no consumió</option>
                  <option value="Inconformidad con el producto">Inconformidad con el producto</option>
                  <option value="Producto incorrecto entregado">Producto incorrecto entregado</option>
                  <option value="Otro motivo">Otro motivo</option>
                </select>
              </div>

              {/* Medio de reembolso */}
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontWeight: '700', fontSize: '0.88rem' }}>💳 Medio de Reembolso al Cliente</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {['Efectivo', 'Transferencia'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRefundPaymentMethod(m)}
                      style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `2px solid ${refundPaymentMethod === m ? '#a855f7' : 'var(--border-glass)'}`, background: refundPaymentMethod === m ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-dark)', color: refundPaymentMethod === m ? '#c084fc' : 'var(--text-muted)', fontWeight: '800', cursor: 'pointer' }}
                    >
                      {m === 'Efectivo' ? '💵 Efectivo' : '📱 Transferencia'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Retornar al inventario */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: refundReturnToStock ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)', border: `1px solid ${refundReturnToStock ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '10px', padding: '12px 16px', cursor: 'pointer', marginBottom: '16px' }} onClick={() => setRefundReturnToStock(prev => !prev)}>
                <input type="checkbox" checked={refundReturnToStock} onChange={e => setRefundReturnToStock(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--success-emerald)', cursor: 'pointer' }} />
                <div>
                  <div style={{ fontWeight: '800', fontSize: '0.88rem', color: refundReturnToStock ? 'var(--success-emerald)' : 'var(--danger-rose)' }}>
                    {refundReturnToStock ? '✅ Reintegrar productos al inventario' : '❌ No reintegrar (producto dañado o vencido)'}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {refundReturnToStock ? 'Los artículos volverán al stock disponible para venderse.' : 'Los artículos se dan de baja sin recuperar el stock.'}
                  </div>
                </div>
              </div>

              {/* Resumen y error */}
              {refundError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '10px 14px', color: 'var(--danger-rose)', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚠️ {refundError}
                </div>
              )}

              <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '10px', padding: '14px 18px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>💵 Total a Reembolsar:</span>
                <span style={{ fontWeight: '900', fontSize: '1.4rem', color: '#c084fc' }}>${refundTotal.toLocaleString('es-CO')}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-glass)', display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowRefundModal(false)} className="checkout-btn-secondary" style={{ flex: 1 }}>Cancelar</button>
              <button
                onClick={handleProcessRefund}
                disabled={isProcessingRefund || refundTotal === 0}
                className="checkout-btn"
                style={{ flex: 2, background: refundTotal > 0 ? 'linear-gradient(135deg, #9333ea, #7c3aed)' : undefined, opacity: refundTotal === 0 ? 0.5 : 1 }}
              >
                {isProcessingRefund ? '⏳ Procesando...' : `↩️ Confirmar Devolución · ${refundTotal.toLocaleString('es-CO')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AUTENTICACIÓN DE ADMINISTRADOR */}
      {showAdminLoginModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: '420px', textAlign: 'center', padding: '30px', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <Shield size={28} />
            </div>
            
            <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-bright)', fontWeight: '800' }}>
              Acceso de Administrador
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Ingrese la Contraseña de Administrador para desbloquear el control total, métricas y ajustes.
            </p>

            <form onSubmit={handleAdminLoginSubmit}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <input 
                  type={showAdminPinText ? 'text' : 'password'}
                  value={adminPinInput}
                  onChange={(e) => { setAdminPinInput(e.target.value); setAdminPinError(''); }}
                  placeholder="Ingrese contraseña o PIN"
                  autoFocus
                  style={{ 
                    width: '100%', 
                    padding: '14px 44px 14px 14px', 
                    fontSize: '1.1rem', 
                    textAlign: 'center',
                    letterSpacing: showAdminPinText ? '0' : '4px',
                    borderRadius: 'var(--radius-md)',
                    border: adminPinError ? '1px solid var(--danger-rose)' : '1px solid var(--border-glass)',
                    background: 'var(--bg-dark)',
                    color: 'var(--text-main)',
                    outline: 'none'
                  }}
                />
                <button 
                  type="button" 
                  onClick={() => setShowAdminPinText(!showAdminPinText)}
                  style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showAdminPinText ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {adminPinError && (
                <div style={{ color: 'var(--danger-rose)', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <AlertCircle size={15} /> {adminPinError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowAdminLoginModal(false); setAdminPinInput(''); setAdminPinError(''); setPendingAdminAction(null); }}
                  className="checkout-btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isVerifyingAdmin}
                  className="checkout-btn"
                  style={{ flex: 1 }}
                >
                  {isVerifyingAdmin ? 'Verificando...' : 'Desbloquear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE IMPRESIÓN POST-VENTA */}
      {postSaleModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            boxShadow: 'var(--shadow-premium)',
            borderRadius: '16px',
            padding: '28px 24px',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '2px solid var(--success-emerald)',
              color: 'var(--success-emerald)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-bright)', fontSize: '1.35rem', fontWeight: '800' }}>
                ¡Venta Cobrada con Éxito!
              </h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                Ticket #{postSaleModal.sale?.id} • {postSaleModal.sale?.payment_method || 'Venta'}
              </p>
            </div>

            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-glass)',
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: '800' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Cobrado:</span>
                <span style={{ color: 'var(--primary-cyan)' }}>{formatCOP(postSaleModal.total, true)}</span>
              </div>
              {postSaleModal.change > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: '800', borderTop: '1px dashed var(--border-glass)', paddingTop: '8px' }}>
                  <span style={{ color: 'var(--success-emerald)' }}>💵 Cambio / Vuelto:</span>
                  <span style={{ color: 'var(--success-emerald)' }}>{formatCOP(postSaleModal.change, true)}</span>
                </div>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>
              ¿Deseas imprimir el ticket térmico para el cliente?
            </p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setPostSaleModal(null)}
                className="checkout-btn-secondary"
                style={{ flex: 1, padding: '12px', fontSize: '0.88rem' }}
              >
                Omitir (Esc)
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  printReceipt(postSaleModal.sale);
                  setPostSaleModal(null);
                }}
                className="checkout-btn"
                style={{ flex: 1.3, padding: '12px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Printer size={18} /> Imprimir (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Componente Oculto para Impresión */}
      <div style={{ display: 'none' }}>
        <PrintableTicket sale={saleToPrint} config={config} />
        <PrintableShiftTicket shift={shiftStats ? { ...shiftStats, id: activeShift?.id, user_name: activeShift?.user_name } : null} config={config} />
      </div>

      {/* CUSTOM PROMPT MODAL */}
      {promptConfig && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', width: '380px', border: '1px solid var(--border-glass)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <h4 style={{ color: 'var(--text-bright)', marginBottom: '20px', fontSize: '1.1rem', fontWeight: 'bold' }}>{promptConfig.message}</h4>
            <div style={{ position: 'relative', marginBottom: '24px' }}>
              <input
                type={promptConfig.type}
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => { 
                  if (e.key === 'Enter') { promptConfig.resolve(promptValue); setPromptConfig(null); } 
                  else if (e.key === 'Escape') { promptConfig.resolve(null); setPromptConfig(null); } 
                }}
                style={{ width: '100%', padding: '12px', paddingRight: '40px', borderRadius: '8px', border: '1px solid var(--border-active)', background: 'var(--bg-dark)', color: 'var(--text-main)', boxSizing: 'border-box', fontSize: '1rem', outline: 'none' }}
              />
              {promptValue && (
                <span 
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
                  onClick={() => setPromptValue('')}
                >
                  X
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { promptConfig.resolve(null); setPromptConfig(null); }} style={{ padding: '10px 20px', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-glass)', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
              <button onClick={() => { promptConfig.resolve(promptValue); setPromptConfig(null); }} style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--primary-cyan)', color: 'black', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Aceptar</button>
            </div>
          </div>
        </div>
      )}
      </div>
          {/* Notificaciones Flotantes en Tiempo Real (SSE) */}
      {realtimeToasts.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '420px',
          pointerEvents: 'none'
        }}>
          {realtimeToasts.map(toast => (
            <div 
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                background: 'rgba(15, 23, 42, 0.96)',
                backdropFilter: 'blur(16px)',
                border: `1.5px solid ${toast.color || '#38bdf8'}`,
                borderLeft: `6px solid ${toast.color || '#38bdf8'}`,
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5), 0 4px 10px rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                padding: '14px 18px',
                color: '#ffffff',
                animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px'
              }}
            >
              <div style={{ fontSize: '1.6rem', lineHeight: '1', flexShrink: 0, marginTop: '2px' }}>{toast.icon || '🔔'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.6px', color: toast.color || '#38bdf8', marginBottom: '4px' }}>
                  {toast.title || 'Actualización en Vivo'}
                </div>
                <div style={{ fontSize: '0.92rem', color: '#f8fafc', fontWeight: '600', lineHeight: '1.4', wordBreak: 'break-word', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
                  {toast.message}
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setRealtimeToasts(prev => prev.filter(t => t.id !== toast.id))}
                style={{ 
                  background: 'rgba(255, 255, 255, 0.1)', 
                  border: 'none', 
                  color: '#cbd5e1', 
                  borderRadius: '50%', 
                  width: '24px', 
                  height: '24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer', 
                  fontSize: '1rem', 
                  lineHeight: '1', 
                  flexShrink: 0,
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
