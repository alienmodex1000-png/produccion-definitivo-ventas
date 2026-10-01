import React, { useState } from 'react';
import { API_URL } from '../utils/constants';
import { 
  Eye, 
  EyeOff, 
  Sparkles, 
  Bot, 
  Shield, 
  Store, 
  Send, 
  Globe, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Save, 
  Trash2,
  Clock,
  QrCode,
  Utensils,
  Printer,
  Sliders,
  Layers,
  Coins
} from 'lucide-react';
import { triggerCashDrawerPulse } from '../utils/printHelper';

const CATEGORIES = [
  { id: 'all', label: '📑 Ver Todo', icon: Layers },
  { id: 'general', label: '🏢 General & Marca', icon: Store },
  { id: 'printer', label: '🖨️ Impresión Térmica', icon: Printer },
  { id: 'security', label: '🔒 Seguridad & Roles', icon: Shield },
  { id: 'operations', label: '⚙️ Operaciones & Caja', icon: Sliders },
  { id: 'restaurant', label: '🍽️ Mesas & Carta QR', icon: Utensils },
  { id: 'integrations', label: '🤖 Telegram & Visión IA', icon: Bot },
  { id: 'remote', label: '🌐 Acceso Remoto', icon: Globe },
  { id: 'danger', label: '⚠️ Mantenimiento', icon: AlertTriangle }
];

const SettingsForm = ({ config, onSave, adminPassword, onAdminPasswordChange, onTestPrint }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [formData, setFormData] = useState({
    enable_gemini_receipts: 'true',
    enable_tables_system: 'true',
    enable_rounds_system: 'true',
    enable_table_timer: 'true',
    enable_digital_menu: 'true',
    digital_menu_hide_soldout: 'false',
    digital_menu_wifi: '',
    digital_menu_phone: '',
    digital_menu_message: '',
    print_mode: 'ask',
    kiosk_printing: 'false',
    ticket_width: '58mm',
    ...config
  });
  const [logoFile, setLogoFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para gestión de impresoras en Windows
  const [printersList, setPrintersList] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [settingDefault, setSettingDefault] = useState(null);
  const [printerStatusMsg, setPrinterStatusMsg] = useState('');

  // Estados para mostrar/ocultar credenciales sensibles
  const [showAdminPwd, setShowAdminPwd] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [showNgrokToken, setShowNgrokToken] = useState(false);

  // Estados para pruebas de conectividad en vivo
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramResult, setTelegramResult] = useState(null);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiResult, setGeminiResult] = useState(null);

  const fetchPrinters = async () => {
    setLoadingPrinters(true);
    setPrinterStatusMsg('');
    try {
      const res = await fetch(`${API_URL}/printers`);
      if (res.ok) {
        const data = await res.json();
        setPrintersList(data.printers || []);
        if ((data.printers || []).length === 0) {
          setPrinterStatusMsg('No se detectaron impresoras activas en Windows.');
        }
      } else {
        setPrinterStatusMsg('No se pudo consultar las impresoras de Windows.');
      }
    } catch (e) {
      setPrinterStatusMsg('Error de conexión al consultar impresoras.');
    } finally {
      setLoadingPrinters(false);
    }
  };

  const handleSetDefaultPrinter = async (printerName) => {
    setSettingDefault(printerName);
    setPrinterStatusMsg('');
    try {
      const res = await fetch(`${API_URL}/printers/set-default`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({ name: printerName })
      });
      const data = await res.json();
      if (res.ok) {
        setPrinterStatusMsg(`✓ "${printerName}" fijada como predeterminada.`);
        setPrintersList(prev => prev.map(p => ({
          ...p,
          isDefault: p.name === printerName
        })));
        setFormData(prev => ({ ...prev, selected_printer: printerName }));
      } else {
        setPrinterStatusMsg(`Error: ${data.error || 'No se pudo cambiar'}`);
      }
    } catch (e) {
      setPrinterStatusMsg('Error de red al fijar impresora.');
    } finally {
      setSettingDefault(null);
    }
  };

  React.useEffect(() => {
    fetchPrinters();
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRemoveLogo = () => {
    if (confirm('¿Desea eliminar el logo actual del negocio?')) {
      setFormData({ ...formData, business_logo_url: 'none' });
      setLogoFile(null);
    }
  };

  const handleFactoryReset = async () => {
    if (confirm('⚠️ ¡ADVERTENCIA EXTREMA!\n\n¿Estás seguro de que deseas BORRAR TODA LA BASE DE DATOS (Productos, Ventas, Gastos, Historial)?\n\nEsta acción NO se puede deshacer.')) {
      const pwd = prompt('Ingresa la Contraseña de Administrador para confirmar el borrado total:');
      if (!pwd) return;
      try {
        const res = await fetch(`${API_URL}/factory-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_password: pwd })
        });
        if (res.ok) {
          alert('El sistema ha sido restaurado de fábrica con éxito. La página se recargará.');
          window.location.reload();
        } else {
          const err = await res.json();
          alert('Error: ' + err.error);
        }
      } catch (e) {
        alert('Error de conexión con el servidor.');
      }
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTelegramResult(null);
    try {
      const res = await fetch(`${API_URL}/test-telegram`, { 
        method: 'POST',
        headers: { 'x-admin-password': adminPassword }
      });
      const data = await res.json();
      if (res.ok) {
        setTelegramResult({ ok: true, message: data.message || 'Mensaje de prueba enviado con éxito.' });
      } else {
        setTelegramResult({ ok: false, message: data.error || 'No se pudo enviar el mensaje. Verifica tu Token y Chat ID.' });
      }
    } catch (e) {
      setTelegramResult({ ok: false, message: 'Error de conexión con el servidor.' });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    setGeminiResult(null);
    try {
      const res = await fetch(`${API_URL}/test-gemini`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({ gemini_api_key: formData.gemini_api_key })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGeminiResult({ ok: true, message: data.message || 'Motor de IA conectado y operativo.' });
      } else {
        setGeminiResult({ ok: false, message: data.error || 'Error de autenticación con el motor de IA.' });
      }
    } catch (e) {
      setGeminiResult({ ok: false, message: 'Error de conexión con el servidor local.' });
    } finally {
      setTestingGemini(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      if (logoFile) {
        const fileData = new FormData();
        fileData.append('logo', logoFile);
        await fetch(`${API_URL}/upload-logo`, { 
          method: 'POST',
          headers: { 'x-admin-password': adminPassword },
          body: fileData 
        });
      }

      const configData = { ...formData };
      if (logoFile) {
        delete configData.business_logo_url;
      }

      const res = await fetch(`${API_URL}/config`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify(configData)
      });

      if (res.ok) {
        if (configData.admin_password && configData.admin_password.trim()) {
          sessionStorage.setItem('pos_admin_token', configData.admin_password.trim());
          if (onAdminPasswordChange) {
            onAdminPasswordChange(configData.admin_password.trim());
          }
        }
        onSave();
        const ngrokChanged =
          formData.ngrok_auth_token !== config.ngrok_auth_token ||
          formData.ngrok_domain !== config.ngrok_domain ||
          formData.ngrok_enabled !== config.ngrok_enabled;

        const kioskChanged = formData.kiosk_printing !== (config.kiosk_printing || 'false');
        const kioskNotice = kioskChanged 
          ? '\n\n💡 Salida de Impresión cambiada:\nCierra la ventana del Punto de Venta y vuelve a abrirla desde el acceso directo para que Windows active el nuevo modo.' 
          : '';

        if (formData.ngrok_enabled === 'true' && ngrokChanged) {
          try {
            const ngrokRes = await fetch(`${API_URL}/ngrok/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ forceRestart: true })
            });
            const ngrokData = await ngrokRes.json();
            if (ngrokData.success) {
              alert(`✅ Configuración guardada exitosamente.\n\n🌐 Túnel Ngrok ACTIVO:\n${ngrokData.url}\n\nEl enlace también fue enviado a tu Telegram.${kioskNotice}`);
            } else {
              alert(`✅ Configuración guardada exitosamente.\n\nℹ️ Nota sobre el Acceso Remoto (Ngrok):\n${ngrokData.message || 'No se pudo iniciar el túnel remoto en este momento.'}\n\n💡 Recuerda: El sistema local y todas tus configuraciones están operando al 100%.${kioskNotice}`);
            }
          } catch (e) {
            alert(`✅ Configuración guardada exitosamente.${kioskNotice}`);
          }
        } else {
          alert(`✅ Configuración guardada exitosamente.${kioskNotice}`);
        }
      } else {
        alert('Hubo un error al guardar la configuración.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const currentLogo = formData.business_logo_url === 'none' ? null : (formData.business_logo_url || '/logo.jpeg');

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDERIZADO MODULAR DE TARJETAS
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Identidad del Negocio y Marca
  const renderGeneralCard = () => (
    <div 
      style={{ 
        background: 'var(--bg-surface)', 
        padding: '24px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-glass)',
        boxShadow: 'var(--shadow-premium)'
      }}
    >
      <h3 style={{ color: 'var(--primary-cyan)', marginTop: 0, marginBottom: '18px', fontWeight: '800', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Store size={22} /> Identidad del Negocio y Marca
      </h3>

      {/* Logo */}
      <div className="form-group">
        <label>Logo del Establecimiento (Opcional)</label>
        {currentLogo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
            <img src={currentLogo} alt="Logo actual" style={{ height: '65px', maxHeight: '65px', objectFit: 'contain', borderRadius: '6px' }} />
            <button 
              type="button" 
              onClick={handleRemoveLogo} 
              className="danger-btn" 
              style={{ 
                padding: '6px 12px', 
                fontSize: '0.8rem', 
                borderRadius: 'var(--radius-md)', 
                background: 'rgba(239, 68, 68, 0.1)', 
                color: 'var(--danger-rose)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Trash2 size={14} /> Eliminar Logo
            </button>
          </div>
        )}
        <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0])} />
      </div>

      <div className="form-group">
        <label>Nombre de la Tienda / Negocio *</label>
        <input name="business_name" value={formData.business_name || ''} onChange={handleChange} required placeholder="Ej: Mi Negocio" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div className="form-group">
          <label>NIT o Cédula (Opcional)</label>
          <input name="business_nit" value={formData.business_nit || ''} onChange={handleChange} placeholder="Ej: 900.123.456-7" />
        </div>
        <div className="form-group">
          <label>Teléfono de Contacto</label>
          <input name="business_phone" value={formData.business_phone || ''} onChange={handleChange} placeholder="Ej: 300 123 4567" />
        </div>
      </div>

      <div className="form-group">
        <label>Dirección del Local (Opcional)</label>
        <input name="business_address" value={formData.business_address || ''} onChange={handleChange} placeholder="Ej: Calle Principal # 12 - 34" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '10px' }}>
        <div className="form-group">
          <label>Modo de Pantalla</label>
          <select name="theme_mode" value={formData.theme_mode || 'dark'} onChange={handleChange}>
            <option value="dark">🌙 Modo Oscuro (Predeterminado)</option>
            <option value="light">☀️ Modo Claro</option>
          </select>
        </div>

        <div className="form-group">
          <label>Color Temático del Sistema</label>
          <select name="theme_color" value={formData.theme_color || 'Azul Galáctico'} onChange={handleChange}>
            <option value="Azul Galáctico">Azul Galáctico</option>
            <option value="Verde Esmeralda">Verde Esmeralda (Salud/Naturaleza)</option>
            <option value="Púrpura Neón">Púrpura Neón (Moderno/Gourmet)</option>
            <option value="Rojo Carmesí">Rojo Carmesí (Carnes/Comida)</option>
            <option value="Naranja Atardecer">Naranja Atardecer (Panadería/Café)</option>
            <option value="Gris Grafito">Gris Grafito (Minimalista)</option>
          </select>
        </div>
      </div>
    </div>
  );

  // 2. Impresora Térmica y Tickets de Venta
  const renderPrinterCard = () => (
    <div 
      style={{ 
        background: 'var(--bg-surface)', 
        padding: '24px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-glass)',
        boxShadow: 'var(--shadow-premium)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ color: 'var(--primary-cyan)', margin: 0, fontWeight: '800', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Printer size={22} /> Impresora Térmica y Tickets de Venta
        </h3>
        <button
          type="button"
          onClick={fetchPrinters}
          disabled={loadingPrinters}
          style={{
            background: 'rgba(14, 165, 233, 0.1)',
            color: 'var(--primary-cyan)',
            border: '1px solid var(--border-active)',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <RefreshCw size={13} className={loadingPrinters ? 'animate-spin' : ''} />
          {loadingPrinters ? 'Detectando...' : 'Detectar Impresoras'}
        </button>
      </div>

      {/* Perfil Maestro de Impresión del Negocio */}
      <div className="form-group" style={{ marginBottom: '18px' }}>
        <label style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--text-bright)', marginBottom: '8px', display: 'block' }}>
          🎯 Modo de Operación de la Impresora Térmica:
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
          {/* Opción 1: Modo 100% Silencioso (Cero Confirmaciones) */}
          <div 
            onClick={() => setFormData(prev => ({ ...prev, print_mode: 'auto', kiosk_printing: 'true' }))}
            style={{
              padding: '14px',
              borderRadius: '10px',
              border: (formData.print_mode === 'auto' && formData.kiosk_printing === 'true') 
                ? '2px solid var(--primary-cyan)' 
                : '1px solid var(--border-glass)',
              background: (formData.print_mode === 'auto' && formData.kiosk_printing === 'true')
                ? 'rgba(14, 165, 233, 0.12)'
                : 'var(--bg-card)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '0.92rem', color: (formData.print_mode === 'auto' && formData.kiosk_printing === 'true') ? 'var(--primary-cyan)' : 'var(--text-bright)' }}>
                ⚡ Modo 100% Silencioso POS (Directo al Papel - Sin Confirmaciones)
              </strong>
              {(formData.print_mode === 'auto' && formData.kiosk_printing === 'true') && (
                <span style={{ color: 'var(--primary-cyan)', fontSize: '0.8rem', fontWeight: '800' }}>✓ ACTIVO</span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Al cobrar una venta, <strong>expulsa el ticket físico en 0.2 segundos</strong> sin mostrar ninguna ventana de confirmación en pantalla ni diálogos de Windows. Ideal para restaurantes, cafeterías, bares y horas pico de alto flujo.
            </p>
          </div>

          {/* Opción 2: Preguntar en Pantalla (Ahorro de Papel) */}
          <div 
            onClick={() => setFormData(prev => ({ ...prev, print_mode: 'ask', kiosk_printing: 'true' }))}
            style={{
              padding: '14px',
              borderRadius: '10px',
              border: (formData.print_mode === 'ask' && formData.kiosk_printing === 'true') 
                ? '2px solid var(--primary-cyan)' 
                : '1px solid var(--border-glass)',
              background: (formData.print_mode === 'ask' && formData.kiosk_printing === 'true')
                ? 'rgba(14, 165, 233, 0.12)'
                : 'var(--bg-card)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '0.92rem', color: (formData.print_mode === 'ask' && formData.kiosk_printing === 'true') ? 'var(--primary-cyan)' : 'var(--text-bright)' }}>
                📋 Preguntar Antes de Imprimir (Ahorro Inteligente de Papel)
              </strong>
              {(formData.print_mode === 'ask' && formData.kiosk_printing === 'true') && (
                <span style={{ color: 'var(--primary-cyan)', fontSize: '0.8rem', fontWeight: '800' }}>✓ ACTIVO</span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Al cobrar, muestra una confirmación rápida en pantalla (<em>¿Deseas comprobante? [Enter = Sí / Esc = No]</em>). Si confirmas, sale directo de la impresora sin ventanas de Windows.
            </p>
          </div>

          {/* Opción 3: Vista Previa de Windows */}
          <div 
            onClick={() => setFormData(prev => ({ ...prev, print_mode: 'ask', kiosk_printing: 'false' }))}
            style={{
              padding: '14px',
              borderRadius: '10px',
              border: (formData.kiosk_printing === 'false' && formData.print_mode !== 'manual') 
                ? '2px solid var(--primary-cyan)' 
                : '1px solid var(--border-glass)',
              background: (formData.kiosk_printing === 'false' && formData.print_mode !== 'manual')
                ? 'rgba(14, 165, 233, 0.12)'
                : 'var(--bg-card)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '0.92rem', color: (formData.kiosk_printing === 'false' && formData.print_mode !== 'manual') ? 'var(--primary-cyan)' : 'var(--text-bright)' }}>
                👁️ Vista Previa de Windows (Control Total / Elegir Impresora)
              </strong>
              {(formData.kiosk_printing === 'false' && formData.print_mode !== 'manual') && (
                <span style={{ color: 'var(--primary-cyan)', fontSize: '0.8rem', fontWeight: '800' }}>✓ ACTIVO</span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Abre la ventana clásica de impresión de Windows para ver el ticket en pantalla, cambiar de impresora o guardarlo como archivo PDF antes de imprimir.
            </p>
          </div>

          {/* Opción 4: Solo Manual */}
          <div 
            onClick={() => setFormData(prev => ({ ...prev, print_mode: 'manual', kiosk_printing: 'false' }))}
            style={{
              padding: '14px',
              borderRadius: '10px',
              border: (formData.print_mode === 'manual') 
                ? '2px solid var(--primary-cyan)' 
                : '1px solid var(--border-glass)',
              background: (formData.print_mode === 'manual')
                ? 'rgba(14, 165, 233, 0.12)'
                : 'var(--bg-card)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: '0.92rem', color: (formData.print_mode === 'manual') ? 'var(--primary-cyan)' : 'var(--text-bright)' }}>
                🌿 Modo Solo Manual (Cero Gasto de Papel)
              </strong>
              {(formData.print_mode === 'manual') && (
                <span style={{ color: 'var(--primary-cyan)', fontSize: '0.8rem', fontWeight: '800' }}>✓ ACTIVO</span>
              )}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              No se imprime nada al cobrar. Las facturas quedan archivadas en el Historial para imprimir únicamente si un cliente lo solicita expresamente.
            </p>
          </div>
        </div>

        {/* Nota de Sistema sobre Windows con botón de reinicio en 1 clic */}
        <div style={{ marginTop: '12px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            💡 <strong>Regla de Windows:</strong> Los navegadores aplican el Modo Silencioso al arrancar. Cuando cambies de modo, pulsa <strong>Guardar Ajustes</strong> y luego reinicia la ventana del POS.
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch(`${API_URL}/system/restart-pos-window`, { method: 'POST' });
              } catch (e) {
                alert('Por favor cierra y vuelve a abrir el Punto de Venta desde el acceso directo.');
              }
            }}
            style={{
              background: 'var(--primary-cyan)',
              color: '#000',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '6px',
              fontWeight: '800',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)'
            }}
          >
            <RefreshCw size={14} /> Reiniciar Ventana POS
          </button>
        </div>
      </div>

      {/* Ancho del Papel y Ticket de Prueba */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.82rem' }}>Ancho de Papel Térmico:</label>
          <select 
            name="ticket_width" 
            value={formData.ticket_width || '58mm'} 
            onChange={handleChange}
            style={{ width: '100%', padding: '9px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', color: 'var(--text-main)' }}
          >
            <option value="58mm">58 mm (Estándar pequeño tiendas/fondas)</option>
            <option value="80mm">80 mm (Ancho extendido restaurantes/supermercados)</option>
          </select>
        </div>

        <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onTestPrint && onTestPrint(formData.ticket_width || '58mm')}
            style={{
              height: '40px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--success-emerald)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '8px',
              fontWeight: '800',
              fontSize: '0.84rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Printer size={16} /> Imprimir Ticket de Prueba
          </button>
        </div>
      </div>

      {/* Mensaje de Pie de Ticket */}
      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '0.82rem' }}>Mensaje al Pie del Ticket:</label>
        <input 
          name="footer_message" 
          value={formData.footer_message || ''} 
          onChange={handleChange} 
          placeholder="Ej: ¡Muchas gracias por su compra! Vuelva pronto." 
          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontSize: '0.85rem' }}
        />
      </div>

      {/* Configuración Modular de Cajón Monedero / Gaveta de Dinero */}
      <div style={{ background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
          <label style={{ margin: 0, fontWeight: '800', fontSize: '0.9rem', color: 'var(--warning-amber)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              name="enable_cash_drawer_button" 
              checked={formData.enable_cash_drawer_button === 'true'} 
              onChange={(e) => setFormData(prev => ({ ...prev, enable_cash_drawer_button: e.target.checked ? 'true' : 'false' }))}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--warning-amber)' }}
            />
            🪙 Habilitar Botón de Apertura de Cajón Monedero
          </label>

          <button
            type="button"
            onClick={() => {
              triggerCashDrawerPulse();
              alert('⚡ Pulso de apertura enviado a la impresora. Si tienes un cajón monedero conectado por cable RJ11, la gaveta saltará abierta de inmediato sin imprimir ticket.');
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: 'rgba(234, 179, 8, 0.15)',
              color: 'var(--warning-amber)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              fontWeight: '700',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⚡ Probar Apertura de Cajón
          </button>
        </div>
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Muestra el botón <strong>"Abrir Cajón"</strong> (y habilita el atajo de teclado <strong>F9</strong>) en la barra de navegación del Punto de Venta para expulsar la gaveta física sin imprimir comprobante ni gastar papel.
        </p>
      </div>

      {/* Lista de Impresoras Detectadas en Windows */}
      <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
        <div style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Dispositivos Detectados en Windows:</span>
          {printersList.length > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{printersList.length} encontrada(s)</span>}
        </div>

        {printerStatusMsg && (
          <div style={{ fontSize: '0.78rem', color: 'var(--primary-cyan)', marginBottom: '8px', background: 'rgba(14, 165, 233, 0.08)', padding: '6px 10px', borderRadius: '6px' }}>
            {printerStatusMsg}
          </div>
        )}

        {printersList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Haz clic en <strong>"Detectar Impresoras"</strong> para listar los dispositivos térmicos instalados en este computador.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {printersList.map((p, idx) => (
              <div 
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: p.isDefault ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card)',
                  border: p.isDefault ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-glass)'
                }}
              >
                <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Printer size={15} color={p.isDefault ? 'var(--success-emerald)' : 'var(--text-muted)'} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  </div>
                  
                  {/* Badge de Estado en Vivo (Conectada vs Desconectada vs Virtual) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span 
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: p.isVirtual 
                          ? 'rgba(148, 163, 184, 0.12)' 
                          : p.isOnline 
                            ? 'rgba(16, 185, 129, 0.15)' 
                            : 'rgba(239, 68, 68, 0.12)',
                        color: p.isVirtual 
                          ? 'var(--text-muted)' 
                          : p.isOnline 
                            ? 'var(--success-emerald)' 
                            : 'var(--danger-rose)',
                        border: p.isVirtual 
                          ? '1px solid rgba(148, 163, 184, 0.25)' 
                          : p.isOnline 
                            ? '1px solid rgba(16, 185, 129, 0.35)' 
                            : '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <span 
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: p.isVirtual ? '#94a3b8' : p.isOnline ? '#10b981' : '#ef4444'
                        }}
                      ></span>
                      {p.isVirtual ? 'Virtual (PDF/Archivo)' : p.isOnline ? '🟢 En línea y lista' : '🔴 Desconectada (Sin cable USB o apagada)'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Puerto: <code style={{ color: 'var(--primary-cyan)' }}>{p.port || 'USB'}</code>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {p.isDefault ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', background: 'var(--success-emerald)', color: '#000', padding: '4px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
                      ✓ Predeterminada
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetDefaultPrinter(p.name)}
                      disabled={settingDefault === p.name}
                      style={{
                        background: 'transparent',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-glass)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {settingDefault === p.name ? 'Conectando...' : 'Fijar Predeterminada'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nota explicativa profesional sobre controladores en Windows */}
        <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(14, 165, 233, 0.05)', border: '1px solid rgba(14, 165, 233, 0.2)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          💡 <strong>Nota del Sistema:</strong> Windows almacena los controladores instalados permanentemente aunque el cable esté desenchufado. Nuestro sistema consulta el spooler de Windows en tiempo real para advertirte si la impresora está físicamente conectada (🟢) o si debes revisar el cable USB o encenderla (🔴).
        </div>
      </div>
    </div>
  );

  // 3. Restaurante, Mesas y Carta Digital QR
  const renderRestaurantCard = () => (
    <div 
      style={{ 
        background: 'var(--bg-surface)', 
        padding: '24px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-glass)',
        boxShadow: 'var(--shadow-card)' 
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ color: 'var(--accent-purple)', margin: 0, fontWeight: '800', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Utensils size={22} color="var(--accent-purple)" /> Módulos de Restaurante, Fondas y Carta Digital
        </h3>
        <span style={{ fontSize: '0.72rem', background: 'rgba(129, 140, 248, 0.12)', color: 'var(--accent-purple)', padding: '3px 8px', borderRadius: '12px', fontWeight: '700' }}>
          Experiencia Gastronómica
        </span>
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 18px 0', lineHeight: '1.4' }}>
        Personalice las herramientas de atención a la mesa y autoservicio según el modelo operativo de su establecimiento.
      </p>

      {/* SWITCH MAESTRO: SISTEMA DE MESAS Y CUENTAS ABIERTAS */}
      <div style={{ padding: '16px', background: formData.enable_tables_system !== 'false' ? 'rgba(129, 140, 248, 0.08)' : 'rgba(239, 68, 68, 0.05)', border: formData.enable_tables_system !== 'false' ? '1px solid rgba(129, 140, 248, 0.3)' : '1px solid var(--border-glass)', borderRadius: '10px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Utensils size={22} color={formData.enable_tables_system !== 'false' ? 'var(--accent-purple)' : 'var(--text-muted)'} />
            <div>
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-bright)', display: 'block' }}>
                🪑 Habilitar Sistema de Mesas y Cuentas Abiertas
              </strong>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: '1.4', display: 'block', marginTop: '2px' }}>
                {formData.enable_tables_system !== 'false'
                  ? 'Activo: Permite abrir cuentas por mesa, acumular pedidos y dividir pagos (Restaurantes, Bares, Fondas, Billares).'
                  : 'Desactivado: Modo Mostrador Directo (Tiendas, Minimarkets, Droguerías). Oculta las mesas en el punto de venta para una registradora limpia y ágil.'}
              </span>
            </div>
          </div>
          <label className="switch" style={{ margin: 0, flexShrink: 0 }}>
            <input
              type="checkbox"
              name="enable_tables_system"
              checked={formData.enable_tables_system !== 'false'}
              onChange={(e) => setFormData({ ...formData, enable_tables_system: e.target.checked ? 'true' : 'false' })}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      {/* Opciones secundarias de Mesas: solo si el sistema de mesas está activo */}
      {formData.enable_tables_system !== 'false' && (
        <>
          {/* SWITCH 2: SISTEMA DE RONDAS DE CONSUMO */}
          <div style={{ padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '10px', marginBottom: '14px', marginLeft: '12px', borderLeft: '3px solid var(--primary-cyan)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={18} color="var(--primary-cyan)" />
                <div>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--text-bright)', display: 'block' }}>
                    ⏰ Sistema de Rondas de Consumo por Mesa
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Clasifica los pedidos de cada mesa por Ronda 1, Ronda 2, etc. Desactívalo si prefieres que los pedidos de la mesa se consoliden directamente sin distinción de rondas.
                  </span>
                </div>
              </div>
              <label className="switch" style={{ margin: 0, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  name="enable_rounds_system"
                  checked={formData.enable_rounds_system !== 'false'}
                  onChange={(e) => setFormData({ ...formData, enable_rounds_system: e.target.checked ? 'true' : 'false' })}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>

          {/* SWITCH 3: CRONÓMETRO DE ESTADÍA EN MESAS */}
          <div style={{ padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '10px', marginBottom: '14px', marginLeft: '12px', borderLeft: '3px solid var(--warning-amber)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={18} color="var(--warning-amber)" />
                <div>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--text-bright)', display: 'block' }}>
                    Cronómetro de Tiempo de Estadía en Mesas
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Muestra en vivo el tiempo transcurrido de cada mesa con semáforo de colores inteligente (verde recién sentados, ámbar consumo medio, púrpura larga estadía) y estado de comandas.
                  </span>
                </div>
              </div>
              <label className="switch" style={{ margin: 0, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  name="enable_table_timer"
                  checked={formData.enable_table_timer !== 'false'}
                  onChange={(e) => setFormData({ ...formData, enable_table_timer: e.target.checked ? 'true' : 'false' })}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </>
      )}

      {/* SWITCH 2: CARTA DIGITAL PÚBLICA QR */}
      <div style={{ padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: formData.enable_digital_menu !== 'false' ? '14px' : '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <QrCode size={20} color="var(--primary-cyan)" />
            <div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-bright)', display: 'block' }}>
                Carta Digital Pública en Tiempo Real (Menú QR)
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Habilita la dirección web pública <code>/carta</code> y el generador de códigos QR para que los comensales consulten fotos, categorías y precios desde sus celulares.
              </span>
            </div>
          </div>
          <label className="switch" style={{ margin: 0, flexShrink: 0 }}>
            <input
              type="checkbox"
              name="enable_digital_menu"
              checked={formData.enable_digital_menu !== 'false'}
              onChange={(e) => setFormData({ ...formData, enable_digital_menu: e.target.checked ? 'true' : 'false' })}
            />
            <span className="slider round"></span>
          </label>
        </div>

        {/* CAMPOS COMPLEMENTARIOS DE LA CARTA DIGITAL */}
        {formData.enable_digital_menu !== 'false' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-glass)', paddingTop: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                📶 Red y Clave Wi-Fi de Cortesía para Clientes (Opcional):
              </label>
              <input
                name="digital_menu_wifi"
                value={formData.digital_menu_wifi || ''}
                onChange={handleChange}
                placeholder="Ej: Red: Fonda Montañero | Clave: Paisa2026"
                style={{ width: '100%', height: '36px', padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                📞 Teléfono / WhatsApp para Pedidos o Reservas:
              </label>
              <input
                name="digital_menu_phone"
                value={formData.digital_menu_phone || ''}
                onChange={handleChange}
                placeholder="Ej: 310 123 4567"
                style={{ width: '100%', height: '36px', padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                💬 Mensaje de Bienvenida en la Carta Digital:
              </label>
              <input
                name="digital_menu_message"
                value={formData.digital_menu_message || ''}
                onChange={handleChange}
                placeholder="Ej: ¡Bienvenidos a la auténtica tradición! Precios con impuestos incluidos."
                style={{ width: '100%', height: '36px', padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="digital_menu_hide_soldout"
                name="digital_menu_hide_soldout"
                checked={formData.digital_menu_hide_soldout === 'true'}
                onChange={(e) => setFormData({ ...formData, digital_menu_hide_soldout: e.target.checked ? 'true' : 'false' })}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-purple)' }}
              />
              <label htmlFor="digital_menu_hide_soldout" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Ocultar por completo los productos agotados en la Carta (si se desmarca, se mostrarán con la insignia <em>"Agotado hoy"</em>).
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 4. Zona de Peligro / Mantenimiento
  const renderDangerCard = () => (
    <div 
      style={{ 
        background: 'rgba(239, 68, 68, 0.03)', 
        padding: '20px 24px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid rgba(239, 68, 68, 0.25)' 
      }}
    >
      <h4 style={{ color: 'var(--danger-rose)', marginTop: 0, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertTriangle size={18} /> Zona de Mantenimiento y Reinicio
      </h4>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 14px 0', lineHeight: '1.4' }}>
        Restauración del software a su estado inicial de fábrica (elimina ventas, gastos y productos de prueba manteniendo la configuración de marca).
      </p>
      <button 
        type="button" 
        onClick={handleFactoryReset} 
        className="danger-btn" 
        style={{ 
          width: '100%', 
          padding: '12px', 
          background: 'rgba(239, 68, 68, 0.1)', 
          color: 'var(--danger-rose)', 
          border: '1px solid var(--danger-rose)', 
          borderRadius: 'var(--radius-md)', 
          fontWeight: '700',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '0.9rem'
        }}
      >
        <Trash2 size={16} /> RESTAURAR SISTEMA DE FÁBRICA
      </button>
    </div>
  );

  // 5. Sistema de Roles y Seguridad (Admin vs Cajero)
  const renderSecurityCard = () => (
    <div 
      style={{ 
        background: 'var(--bg-surface)', 
        padding: '24px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-glass)',
        boxShadow: 'var(--shadow-premium)'
      }}
    >
      <h3 style={{ color: 'var(--warning-amber)', marginTop: 0, marginBottom: '18px', fontWeight: '800', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Shield size={22} /> Sistema de Roles y Seguridad (Admin vs Cajero)
      </h3>

      {/* Explicación Profesional de Roles */}
      <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontWeight: '800', fontSize: '0.85rem', color: 'var(--warning-amber)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              👑 Modo Administrador
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
              Acceso total: gestión de catálogo, costos de compra, margen de ganancia, borrado de ventas y ajustes del sistema.
            </p>
          </div>
          <div style={{ background: 'rgba(14, 165, 233, 0.06)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontWeight: '800', fontSize: '0.85rem', color: 'var(--primary-cyan)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              👤 Modo Cajero (Operativo)
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
              Operación de ventas, cobros y arqueos. Los costos, utilidades, borrado de registros y ajustes quedan blindados.
            </p>
          </div>
        </div>
      </div>

      {/* Contraseña de Administrador protegida */}
      <div className="form-group" style={{ border: '1px solid rgba(245, 158, 11, 0.3)', padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.04)' }}>
        <label style={{ color: 'var(--warning-amber)', fontWeight: '700' }}>
          PIN o Contraseña Maestra de Administrador
        </label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: '6px' }}>
          <input 
            type={showAdminPwd ? 'text' : 'password'} 
            name="admin_password" 
            value={formData.admin_password !== undefined ? formData.admin_password : '1234'} 
            onChange={handleChange} 
            placeholder="Ej: 1234"
            style={{ paddingRight: '44px', fontWeight: 'bold' }}
          />
          <button 
            type="button" 
            onClick={() => setShowAdminPwd(!showAdminPwd)} 
            style={{ 
              position: 'absolute', 
              right: '10px', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center'
            }}
            title={showAdminPwd ? "Ocultar clave" : "Mostrar clave"}
          >
            {showAdminPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
          Utiliza este PIN en la barra superior del sistema para alternar entre Modo Cajero y Modo Administrador en cualquier momento.
        </small>
      </div>
    </div>
  );

  // 6. Operaciones, Caja y Control de Inventario
  const renderOperationsCard = () => (
    <div 
      style={{ 
        background: 'var(--bg-surface)', 
        padding: '24px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-glass)',
        boxShadow: 'var(--shadow-premium)'
      }}
    >
      <h3 style={{ color: 'var(--primary-cyan)', marginTop: 0, marginBottom: '18px', fontWeight: '800', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Sliders size={22} /> Operaciones, Caja y Control de Inventario
      </h3>

      {/* Cierre Ciego */}
      <div className="form-group" style={{ border: '1px solid var(--border-glass)', padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            id="blind_close_toggle" 
            name="blind_close" 
            checked={formData.blind_close === 'true'} 
            onChange={(e) => setFormData({...formData, blind_close: e.target.checked ? 'true' : 'false'})} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--warning-amber)', cursor: 'pointer' }} 
          />
          <label htmlFor="blind_close_toggle" style={{ margin: 0, fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer' }}>
            Habilitar Cierre de Caja Ciego
          </label>
        </div>
        <p style={{ margin: '6px 0 0 28px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Oculta el total esperado a los cajeros al momento de cerrar turno para evitar arqueos manipulados. Solo verán lo que ingresen en su conteo físico.
        </p>
      </div>

      {/* Control Estricto de Stock */}
      <div className="form-group" style={{ border: '1px solid var(--border-glass)', padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            id="strict_inv_toggle" 
            name="strict_inventory" 
            checked={formData.strict_inventory !== 'false'} 
            onChange={(e) => setFormData({...formData, strict_inventory: e.target.checked ? 'true' : 'false'})} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cyan)', cursor: 'pointer' }} 
          />
          <label htmlFor="strict_inv_toggle" style={{ margin: 0, fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer' }}>
            Control Estricto de Stock (Bloquear al llegar a 0)
          </label>
        </div>
        <p style={{ margin: '6px 0 0 28px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          • <b>Activado:</b> Bloquea la venta y alerta "AGOTADO" al llegar a 0.<br/>
          • <b>Desactivado:</b> Venta ágil sin bloqueos de inventario físico.
        </p>
      </div>

      {/* Control Ciego de Inventario (Ocultar Stock Numérico a Cajeros) */}
      <div className="form-group" style={{ border: '1px solid var(--border-glass)', padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            id="hide_stock_cashier_toggle" 
            name="hide_stock_cashier" 
            checked={formData.hide_stock_cashier === 'true'} 
            onChange={(e) => setFormData({...formData, hide_stock_cashier: e.target.checked ? 'true' : 'false'})} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cyan)', cursor: 'pointer' }} 
          />
          <label htmlFor="hide_stock_cashier_toggle" style={{ margin: 0, fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer' }}>
            Ocultar Cantidad Exacta de Stock a Cajeros (Control Ciego de Inventario)
          </label>
        </div>
        <p style={{ margin: '6px 0 0 28px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          • <b>Activado:</b> Los cajeros solo verán si el producto está <i>"🟢 Disponible"</i>, <i>"⚠️ Pocas unidades"</i> o <i>"🚫 AGOTADO"</i> sin ver el número exacto, evitando desvíos o robos hormiga.<br/>
          • <b>Desactivado:</b> Se muestra la cifra numérica exacta (ej. <i>Stock: 24</i>). El Administrador siempre ve la cantidad exacta en ambos casos.
        </p>
      </div>

      {/* Inventario Avanzado PEPS */}
      <div className="form-group" style={{ border: '1px solid var(--border-glass)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <label style={{ margin: 0, fontWeight: '700', color: 'var(--text-main)' }}>Inventario Avanzado (PEPS / FIFO)</label>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Costeo exacto por cada lote de mercancía recibido.</p>
          </div>
          <select name="enable_fifo" value={formData.enable_fifo || 'false'} onChange={handleChange} style={{ width: 'auto', minWidth: '160px' }}>
            <option value="false">Apagado (Simple)</option>
            <option value="true">Encendido (Precisión)</option>
          </select>
        </div>
      </div>

      {/* Ganancias y Costos */}
      <div className="form-group" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.04)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            id="profit_tracking_toggle" 
            name="enable_profit_tracking" 
            checked={formData.enable_profit_tracking !== 'false'} 
            onChange={(e) => setFormData({...formData, enable_profit_tracking: e.target.checked ? 'true' : 'false'})} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--success-emerald)', cursor: 'pointer' }} 
          />
          <label htmlFor="profit_tracking_toggle" style={{ margin: 0, fontWeight: '700', color: 'var(--success-emerald)', cursor: 'pointer' }}>
            Cálculo de Ganancias y Costos (Utilidad Neta)
          </label>
        </div>
        <p style={{ margin: '6px 0 0 28px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Calcula automáticamente la rentabilidad neta deduciendo el costo base de los productos vendidos.
        </p>
      </div>

      {/* Descripciones de Productos */}
      <div className="form-group" style={{ border: '1px solid var(--border-glass)', padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            id="desc_toggle" 
            name="enable_product_descriptions" 
            checked={formData.enable_product_descriptions === 'true'} 
            onChange={(e) => setFormData({...formData, enable_product_descriptions: e.target.checked ? 'true' : 'false'})} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cyan)', cursor: 'pointer' }} 
          />
          <label htmlFor="desc_toggle" style={{ margin: 0, fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer' }}>
            Habilitar Descripciones Detalladas de Productos
          </label>
        </div>
      </div>

      {/* Líneas de Negocio (Multitienda) */}
      <div className="form-group" style={{ border: '1px solid rgba(168, 85, 247, 0.3)', padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(168, 85, 247, 0.04)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '8px' }}>
          <input 
            type="checkbox" 
            id="bl_toggle" 
            name="enable_business_lines" 
            checked={formData.enable_business_lines === 'true'} 
            onChange={(e) => setFormData({...formData, enable_business_lines: e.target.checked ? 'true' : 'false'})} 
            style={{ width: '18px', height: '18px', accentColor: '#a855f7', cursor: 'pointer' }} 
          />
          <label htmlFor="bl_toggle" style={{ margin: 0, fontWeight: '700', color: '#c084fc', cursor: 'pointer' }}>
            🏪 Habilitar Líneas de Negocio (Multitienda en 1 Caja)
          </label>
        </div>
        <p style={{ margin: '0 0 10px 28px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Separa reportes contables si administras 2 actividades comerciales bajo un mismo sistema.
        </p>
        {formData.enable_business_lines === 'true' && (
          <div style={{ marginLeft: '28px', display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '10px' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Línea 1</label>
              <input name="business_line_1_name" value={formData.business_line_1_name || ''} onChange={handleChange} placeholder="Ej: Restaurante" />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Línea 2</label>
              <input name="business_line_2_name" value={formData.business_line_2_name || ''} onChange={handleChange} placeholder="Ej: Bar / Coctelería" />
            </div>
          </div>
        )}
      </div>

      {/* Módulo de Recordatorios y Mantenimientos */}
      <div className="form-group" style={{ border: '1px solid rgba(6, 182, 212, 0.35)', padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(6, 182, 212, 0.04)', margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '6px' }}>
          <input 
            type="checkbox" 
            id="reminders_toggle" 
            name="enable_reminders" 
            checked={formData.enable_reminders === 'true'} 
            onChange={(e) => setFormData({...formData, enable_reminders: e.target.checked ? 'true' : 'false'})} 
            style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cyan)', cursor: 'pointer' }} 
          />
          <label htmlFor="reminders_toggle" style={{ margin: 0, fontWeight: '700', color: 'var(--primary-cyan)', cursor: 'pointer' }}>
            🔔 Activar Módulo de Recordatorios y Mantenimientos
          </label>
        </div>
        <p style={{ margin: '0 0 0 28px', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Ideal para negocios de servicio técnico, talleres, citas, revisiones periódicas o productos con mantenimiento preventivo. Permite agendar tareas con avisos previos en pantalla y notificaciones vía Telegram.
        </p>
      </div>
    </div>
  );

  // 7. Inteligencia Artificial PRO
  const renderAiCard = () => (
    <div 
      style={{ 
        background: 'linear-gradient(145deg, rgba(30, 20, 50, 0.6) 0%, rgba(19, 28, 46, 0.95) 100%)', 
        padding: '24px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid rgba(168, 85, 247, 0.4)',
        boxShadow: '0 8px 32px 0 rgba(168, 85, 247, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h3 style={{ color: '#d8b4fe', margin: 0, fontWeight: '800', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={22} color="#c084fc" /> Inteligencia Artificial - Reconocimiento de Facturas
        </h3>
        <span 
          style={{ 
            background: 'linear-gradient(135deg, #9333ea, #ec4899)', 
            color: '#ffffff', 
            fontSize: '0.72rem', 
            fontWeight: '900', 
            padding: '4px 10px', 
            borderRadius: '20px',
            letterSpacing: '0.6px',
            boxShadow: '0 0 12px rgba(168, 85, 247, 0.4)'
          }}
        >
          MÓDULO PRO
        </span>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.45', margin: '0 0 16px 0' }}>
        Motor de visión artificial avanzado para reconocimiento, extracción y clasificación automática de facturas y recibos de gastos enviados por Telegram.
      </p>

      {/* Switch de activación */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          padding: '12px 16px', 
          background: 'rgba(168, 85, 247, 0.08)', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid rgba(168, 85, 247, 0.25)',
          marginBottom: '16px',
          cursor: 'pointer'
        }}
      >
        <input 
          type="checkbox" 
          id="ia_receipts_toggle" 
          name="enable_gemini_receipts" 
          checked={formData.enable_gemini_receipts !== 'false'} 
          onChange={(e) => setFormData({...formData, enable_gemini_receipts: e.target.checked ? 'true' : 'false'})} 
          style={{ width: '20px', height: '20px', accentColor: '#a855f7', cursor: 'pointer' }} 
        />
        <label htmlFor="ia_receipts_toggle" style={{ margin: 0, fontWeight: '700', color: '#f3e8ff', cursor: 'pointer', fontSize: '0.9rem' }}>
          Habilitar Escaneo Inteligente de Comprobantes
        </label>
      </div>

      {/* Clave de IA */}
      <div className="form-group" style={{ marginBottom: '14px' }}>
        <label style={{ color: '#e9d5ff', fontWeight: '600' }}>
          Clave de Activación del Motor de IA
        </label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input 
            type={showGeminiKey ? 'text' : 'password'} 
            name="gemini_api_key" 
            value={formData.gemini_api_key || ''} 
            onChange={handleChange} 
            placeholder="Clave de autorización suministrada por su proveedor..." 
            style={{ 
              paddingRight: '44px',
              background: 'rgba(15, 23, 42, 0.6)',
              borderColor: 'rgba(168, 85, 247, 0.3)',
              color: '#f3e8ff'
            }}
          />
          <button 
            type="button" 
            onClick={() => setShowGeminiKey(!showGeminiKey)} 
            style={{ 
              position: 'absolute', 
              right: '10px', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center'
            }}
            title={showGeminiKey ? "Ocultar clave" : "Mostrar clave"}
          >
            {showGeminiKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Botón prueba IA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
        <button 
          type="button" 
          onClick={handleTestGemini} 
          disabled={testingGemini}
          style={{ 
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(236, 72, 153, 0.25))', 
            color: '#f3e8ff', 
            border: '1px solid rgba(168, 85, 247, 0.5)', 
            padding: '9px 18px', 
            borderRadius: 'var(--radius-md)', 
            cursor: 'pointer', 
            fontWeight: '700',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 10px rgba(168, 85, 247, 0.2)'
          }}
        >
          {testingGemini ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
          {testingGemini ? 'Verificando con el Motor...' : '⚡ Probar Conexión del Motor de IA'}
        </button>

        {geminiResult && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '0.85rem', 
              fontWeight: '600',
              color: geminiResult.ok ? 'var(--success-emerald)' : 'var(--danger-rose)',
              background: geminiResult.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${geminiResult.ok ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
            }}
          >
            {geminiResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span>{geminiResult.message}</span>
          </div>
        )}
      </div>

      <div 
        style={{ 
          marginTop: '16px', 
          padding: '12px 14px', 
          borderRadius: 'var(--radius-md)', 
          background: 'rgba(0, 0, 0, 0.25)', 
          border: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          lineHeight: '1.4'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', fontWeight: '700', marginBottom: '4px' }}>
          <Shield size={14} /> Servicio Gestionado & Respaldo Permanente
        </div>
        • Para activar, gestionar o renovar este servicio con su proveedor de software, ingrese su clave autorizada.<br/>
        • Si este módulo se encuentra inactivo, el sistema continuará archivando las fotos y registrando sus gastos en modo estándar sin interrupciones.
      </div>
    </div>
  );

  // 8. Telegram & Notificaciones Móviles
  const renderTelegramCard = () => (
    <div 
      style={{ 
        background: 'var(--bg-surface)', 
        padding: '24px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid rgba(0, 136, 204, 0.3)',
        boxShadow: 'var(--shadow-premium)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h3 style={{ color: '#0088cc', margin: 0, fontWeight: '800', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Send size={20} /> Telegram & Notificaciones Móviles
        </h3>
        <span style={{ fontSize: '0.75rem', background: 'rgba(0, 136, 204, 0.1)', color: '#0088cc', padding: '3px 8px', borderRadius: '12px', fontWeight: '700' }}>
          Enlace Directo
        </span>
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 16px 0', lineHeight: '1.4' }}>
        Recibe reportes de ventas, cortes de caja, alertas de seguridad y envía comprobantes de gastos directamente al bot del negocio.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', marginBottom: '14px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Token del Bot (@BotFather)</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type={showTelegramToken ? 'text' : 'password'} 
              name="telegram_bot_token" 
              value={formData.telegram_bot_token || ''} 
              onChange={handleChange} 
              placeholder="123456:ABC-DEF..." 
              style={{ paddingRight: '40px' }}
            />
            <button 
              type="button" 
              onClick={() => setShowTelegramToken(!showTelegramToken)} 
              style={{ 
                position: 'absolute', 
                right: '8px', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center'
              }}
              title={showTelegramToken ? "Ocultar token" : "Mostrar token"}
            >
              {showTelegramToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label>Chat ID del Dueño (@userinfobot)</label>
          <input 
            name="telegram_chat_id" 
            value={formData.telegram_chat_id || ''} 
            onChange={handleChange} 
            placeholder="Ej: 987654321" 
          />
        </div>
      </div>

      {/* Eventos Notificables */}
      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', marginBottom: '14px' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px', display: 'block' }}>
          Notificaciones Activas en Tiempo Real:
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" name="telegram_notify_sales" checked={formData.telegram_notify_sales !== 'false'} onChange={(e) => setFormData({...formData, telegram_notify_sales: e.target.checked ? 'true' : 'false'})} />
            💰 Venta Realizada
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" name="telegram_notify_stock" checked={formData.telegram_notify_stock !== 'false'} onChange={(e) => setFormData({...formData, telegram_notify_stock: e.target.checked ? 'true' : 'false'})} />
            ⚠️ Alerta Stock Bajo
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" name="telegram_notify_security" checked={formData.telegram_notify_security !== 'false'} onChange={(e) => setFormData({...formData, telegram_notify_security: e.target.checked ? 'true' : 'false'})} />
            🛡️ Alertas de Seguridad
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" name="telegram_notify_shifts" checked={formData.telegram_notify_shifts !== 'false'} onChange={(e) => setFormData({...formData, telegram_notify_shifts: e.target.checked ? 'true' : 'false'})} />
            🏁 Aperturas / Cierres Caja
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" name="telegram_notify_debts" checked={formData.telegram_notify_debts !== 'false'} onChange={(e) => setFormData({...formData, telegram_notify_debts: e.target.checked ? 'true' : 'false'})} />
            💵 Abono / Cobro de Deuda
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" name="telegram_notify_reminders" checked={formData.telegram_notify_reminders !== 'false'} onChange={(e) => setFormData({...formData, telegram_notify_reminders: e.target.checked ? 'true' : 'false'})} />
            🔔 Recordatorios y Mantenimientos
          </label>
        </div>
      </div>

      {/* Botón prueba Telegram */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button 
          type="button" 
          onClick={handleTestTelegram} 
          disabled={testingTelegram}
          style={{ 
            background: 'rgba(0, 136, 204, 0.15)', 
            color: '#0088cc', 
            border: '1px solid #0088cc', 
            padding: '8px 16px', 
            borderRadius: 'var(--radius-md)', 
            cursor: 'pointer', 
            fontWeight: '700',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {testingTelegram ? <RefreshCw className="animate-spin" size={15} /> : <Bot size={15} />}
          {testingTelegram ? 'Enviando prueba...' : 'Probar Conexión a Telegram'}
        </button>

        {telegramResult && (
          <div 
            style={{ 
              fontSize: '0.82rem', 
              fontWeight: '600',
              color: telegramResult.ok ? 'var(--success-emerald)' : 'var(--danger-rose)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {telegramResult.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            <span>{telegramResult.message}</span>
          </div>
        )}
      </div>
    </div>
  );

  // 9. Acceso Remoto Seguro (Ngrok)
  const renderNgrokCard = () => (
    <div 
      style={{ 
        background: 'var(--bg-surface)', 
        padding: '24px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-glass)',
        boxShadow: 'var(--shadow-premium)'
      }}
    >
      <h3 style={{ color: 'var(--primary-cyan)', marginTop: 0, marginBottom: '14px', fontWeight: '800', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Globe size={20} /> Acceso Remoto Seguro (Túnel Móvil)
      </h3>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 14px 0', lineHeight: '1.4' }}>
        Permite conectarse al sistema en tiempo real desde cualquier celular o computador remoto a través de internet seguro.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '14px' }}>
        <input 
          type="checkbox" 
          id="ngrok_toggle" 
          name="ngrok_enabled" 
          checked={formData.ngrok_enabled === 'true'} 
          onChange={(e) => setFormData({...formData, ngrok_enabled: e.target.checked ? 'true' : 'false'})} 
          style={{ width: '18px', height: '18px', accentColor: 'var(--primary-cyan)', cursor: 'pointer' }} 
        />
        <label htmlFor="ngrok_toggle" style={{ margin: 0, fontWeight: '700', color: 'var(--primary-cyan)', cursor: 'pointer', fontSize: '0.9rem' }}>
          Activar Túnel de Acceso Remoto al Iniciar
        </label>
      </div>

      {formData.ngrok_enabled === 'true' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>AuthToken de Acceso</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showNgrokToken ? 'text' : 'password'}
                name="ngrok_auth_token" 
                value={formData.ngrok_auth_token || ''} 
                onChange={handleChange} 
                placeholder="Token de túnel" 
                style={{ paddingRight: '40px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowNgrokToken(!showNgrokToken)} 
                style={{ 
                  position: 'absolute', 
                  right: '8px', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={showNgrokToken ? "Ocultar token" : "Mostrar token"}
              >
                {showNgrokToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Dominio Fijo (Opcional)</label>
            <input 
              name="ngrok_domain" 
              value={formData.ngrok_domain || ''} 
              onChange={handleChange} 
              placeholder="mi-tienda.ngrok.app" 
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <form 
      onSubmit={handleSubmit} 
      style={{ 
        width: '100%', 
        maxWidth: '1240px', 
        margin: '0 auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px',
        paddingBottom: '40px'
      }}
    >
      {/* ─── CABECERA DE AJUSTES CON BOTÓN DE GUARDADO PRINCIPAL ─── */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: '16px',
          background: 'var(--bg-surface)',
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-premium)'
        }}
      >
        <div>
          <h2 style={{ color: 'var(--text-bright)', margin: 0, fontWeight: '800', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            ⚙️ Ajustes del Sistema y Establecimiento
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
            Control central de identidad, operaciones, inteligencia artificial, notificaciones móviles y seguridad.
          </p>
        </div>

        <button 
          type="submit" 
          disabled={isSaving} 
          className="checkout-btn" 
          style={{ 
            padding: '12px 24px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontWeight: '800',
            fontSize: '0.9rem',
            boxShadow: 'var(--shadow-glow)'
          }}
        >
          {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
          {isSaving ? 'GUARDANDO CAMBIOS...' : 'GUARDAR AJUSTES'}
        </button>
      </div>

      {/* ─── BARRA DE PESTAÑAS / FILTRO RÁPIDO DE CATEGORÍAS ─── */}
      <div 
        style={{ 
          display: 'flex', 
          gap: '8px', 
          flexWrap: 'wrap', 
          background: 'var(--bg-surface)', 
          padding: '10px 14px', 
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid var(--border-glass)',
          alignItems: 'center'
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', marginRight: '4px' }}>
          Sección:
        </span>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: isActive ? '800' : '600',
                background: isActive ? 'var(--primary-cyan)' : 'var(--bg-card)',
                color: isActive ? '#000000' : 'var(--text-main)',
                border: isActive ? '1px solid var(--primary-cyan)' : '1px solid var(--border-glass)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 10px rgba(6, 182, 212, 0.3)' : 'none'
              }}
            >
              <Icon size={14} color={isActive ? '#000' : 'currentColor'} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ─── CONTENIDO: VISTA FILTRADA O GRID 50/50 ─── */}
      {activeCategory === 'all' ? (
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', 
            gap: '24px', 
            alignItems: 'start' 
          }}
        >
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* COLUMNA 1 (IZQUIERDA): IDENTIDAD, IMPRESIÓN, RESTAURANTE Y SISTEMA */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {renderGeneralCard()}
            {renderPrinterCard()}
            {renderRestaurantCard()}
            {renderDangerCard()}
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* COLUMNA 2 (DERECHA): SEGURIDAD, OPERACIONES, IA Y CONECTIVIDAD */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {renderSecurityCard()}
            {renderOperationsCard()}
            {renderAiCard()}
            {renderTelegramCard()}
            {renderNgrokCard()}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '820px', margin: '0 auto', width: '100%' }}>
          {activeCategory === 'general' && renderGeneralCard()}
          {activeCategory === 'printer' && renderPrinterCard()}
          {activeCategory === 'security' && renderSecurityCard()}
          {activeCategory === 'operations' && renderOperationsCard()}
          {activeCategory === 'restaurant' && renderRestaurantCard()}
          {activeCategory === 'integrations' && (
            <>
              {renderAiCard()}
              {renderTelegramCard()}
            </>
          )}
          {activeCategory === 'remote' && renderNgrokCard()}
          {activeCategory === 'danger' && renderDangerCard()}
        </div>
      )}

      {/* ─── BOTÓN INFERIOR DE GUARDAR ─── */}
      <div 
        style={{ 
          marginTop: '10px',
          display: 'flex',
          justifyContent: 'flex-end'
        }}
      >
        <button 
          type="submit" 
          disabled={isSaving} 
          className="checkout-btn" 
          style={{ 
            width: '100%',
            maxWidth: '360px',
            padding: '14px 28px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: '10px', 
            fontSize: '1rem',
            boxShadow: 'var(--shadow-glow)'
          }}
        >
          {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
          {isSaving ? 'GUARDANDO CAMBIOS...' : 'GUARDAR TODOS LOS AJUSTES'}
        </button>
      </div>

    </form>
  );
};

export default SettingsForm;
