import React, { useState, useEffect, useMemo } from 'react';
import { API_URL } from '../utils/constants';
import { 
  Search, 
  Wifi, 
  Phone, 
  Sparkles, 
  AlertCircle, 
  Check, 
  Copy, 
  X,
  Share2,
  UtensilsCrossed,
  Info,
  MessageCircle,
  ExternalLink,
  Lock,
  ChevronDown,
  ChevronUp,
  MapPin
} from 'lucide-react';

export default function CartaDigital({ onOpenAdminLogin }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuData, setMenuData] = useState({ enabled: true, config: {}, products: [] });
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [copiedWifi, setCopiedWifi] = useState(false);
  const [expandAllCategories, setExpandAllCategories] = useState(false);

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${API_URL}/menu`);
      if (res.status === 403) {
        setMenuData({ enabled: false, config: {}, products: [] });
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('No se pudo cargar la carta digital');
      const data = await res.json();
      setMenuData(data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar la carta digital:', err);
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();

    // Sincronización en tiempo real vía Server-Sent Events (SSE)
    let eventSource = null;
    try {
      eventSource = new EventSource(`${API_URL}/events`);
      eventSource.onmessage = (event) => {
        try {
          const ev = JSON.parse(event.data);
          if (ev.type === 'PRICE_CHANGED' || ev.type === 'STOCK_UPDATED' || ev.type === 'NEW_PRODUCT' || ev.type === 'PRODUCT_DELETED') {
            fetchMenu();
          }
        } catch (e) {}
      };
    } catch (e) {
      console.warn('SSE no disponible en la red pública.');
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const { config = {}, products = [] } = menuData;

  // Formateador de moneda
  const formatMoney = (val) => {
    const n = Number(val);
    return isNaN(n) ? '0' : n.toLocaleString('es-CO');
  };

  // URL segura para imágenes
  const getProductImg = (img) => {
    if (!img || img === 'none') return null;
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    const cleanImg = img.replace(/^\/+/, '');
    const cleanBase = API_URL.replace(/\/api$/, '');
    return `${cleanBase}/${cleanImg}`;
  };

  const effectivePhone = config.digital_menu_phone || config.business_phone || '';

  // Teléfono sanitizado para enlace WhatsApp
  const whatsappUrl = useMemo(() => {
    const raw = effectivePhone;
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    const cleanPhone = digits.length === 10 ? `57${digits}` : digits;
    const businessName = config.business_name || 'Restaurante';
    const text = encodeURIComponent(`¡Hola ${businessName}! Estoy viendo su carta digital y me gustaría hacer una consulta o pedir a la mesa.`);
    return `https://wa.me/${cleanPhone}?text=${text}`;
  }, [effectivePhone, config.business_name]);

  // Generar URL para pedir un producto específico
  const getProductOrderUrl = (product) => {
    const raw = effectivePhone;
    const digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    const cleanPhone = digits.length === 10 ? `57${digits}` : digits;
    const text = encodeURIComponent(`¡Hola! Me gustaría pedir de la carta: *${product.name}* ($${formatMoney(product.price)} COP).`);
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  // Categorías y conteos de productos
  const { categories, categoryCounts } = useMemo(() => {
    const counts = { 'Todos': products.length };
    const set = new Set();
    products.forEach(p => {
      const cat = (p.category && p.category.trim()) ? p.category.trim() : 'Varios';
      set.add(cat);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return {
      categories: ['Todos', ...Array.from(set).sort()],
      categoryCounts: counts
    };
  }, [products]);

  // Filtrado de productos por categoría y buscador
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'Todos' || (p.category && p.category.trim() === selectedCategory);
      const matchSearch = !searchQuery.trim() || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Agrupación por categoría para vista en "Todos" sin búsqueda
  const groupedProducts = useMemo(() => {
    if (selectedCategory !== 'Todos' || searchQuery.trim()) return null;
    const groups = {};
    products.forEach(p => {
      const cat = (p.category && p.category.trim()) ? p.category.trim() : 'Varios';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [products, selectedCategory, searchQuery]);

  // Copiar clave de Wi-Fi
  const handleCopyWifi = () => {
    if (config.digital_menu_wifi) {
      navigator.clipboard?.writeText(config.digital_menu_wifi);
      setCopiedWifi(true);
      setTimeout(() => setCopiedWifi(false), 2500);
    }
  };

  // Pantalla de Carga
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#090d16',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(14, 165, 233, 0.2)',
          borderTopColor: '#0ea5e9',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '16px'
        }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#38bdf8' }}>Cargando Carta Digital...</h3>
        <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Consultando los productos y precios más recientes</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Pantalla de Carta Deshabilitada
  if (!menuData.enabled) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#090d16',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <AlertCircle size={36} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '8px', color: '#ffffff' }}>
          Carta Digital no disponible
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#94a3b8', maxWidth: '420px', lineHeight: '1.5', marginBottom: '24px' }}>
          El establecimiento tiene deshabilitada temporalmente la carta en línea. Consulta con el personal de atención para ver los productos disponibles.
        </p>
        {onOpenAdminLogin && (
          <button
            onClick={onOpenAdminLogin}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#94a3b8',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Lock size={14} /> Acceso de Administración
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#090d16',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      paddingBottom: whatsappUrl ? '90px' : '40px'
    }}>
      {/* ─── ENCABEZADO PRINCIPAL DE LA MARCA ─── */}
      <header style={{
        background: 'linear-gradient(180deg, #131c2e 0%, #090d16 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '24px 16px 18px 16px',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Avatar o Logotipo */}
        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
          margin: '0 auto 12px auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 30px rgba(14, 165, 233, 0.35)',
          fontSize: '1.8rem',
          border: '3px solid #090d16'
        }}>
          🍽️
        </div>

        <h1 style={{
          fontSize: '1.65rem',
          fontWeight: '900',
          margin: '0 0 6px 0',
          color: '#ffffff',
          letterSpacing: '-0.5px'
        }}>
          {config.business_name || 'Nuestro Menú'}
        </h1>

        <p style={{
          fontSize: '0.82rem',
          color: '#94a3b8',
          margin: '0 0 14px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <Sparkles size={14} color="#38bdf8" />
          <span>{config.digital_menu_message || 'Carta Digital Oficial · Precios actualizados en vivo'}</span>
        </p>

        {/* Badges de Contacto Directo (WhatsApp, Wi-Fi, Ubicación) */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: '560px',
          margin: '0 auto'
        }}>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#4ade80',
                fontSize: '0.78rem',
                fontWeight: '700',
                textDecoration: 'none',
                transition: 'all 0.2s'
              }}
            >
              <MessageCircle size={14} /> WhatsApp: {effectivePhone}
            </a>
          )}

          {config.digital_menu_wifi && (
            <button
              type="button"
              onClick={() => setShowWifiModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                background: 'rgba(14, 165, 233, 0.12)',
                border: '1px solid rgba(14, 165, 233, 0.3)',
                color: '#38bdf8',
                fontSize: '0.78rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <Wifi size={14} /> Red Wi-Fi
            </button>
          )}

          {config.business_address && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              fontSize: '0.75rem'
            }}>
              <MapPin size={13} /> {config.business_address}
            </span>
          )}
        </div>
      </header>

      {/* ─── MODAL DE CREDENCIALES WI-FI ─── */}
      {showWifiModal && (
        <div 
          onClick={() => setShowWifiModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: '#131c2e',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              borderRadius: '18px',
              maxWidth: '380px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              textAlign: 'center'
            }}
          >
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(14, 165, 233, 0.15)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto'
            }}>
              <Wifi size={28} />
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: '0 0 6px 0', color: '#ffffff' }}>
              Red Wi-Fi para Clientes
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 16px 0' }}>
              Conéctate gratis a nuestra red durante tu visita:
            </p>

            <div style={{
              background: '#090d16',
              border: '1px dashed rgba(14, 165, 233, 0.4)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '1.05rem',
                fontWeight: '700',
                color: '#38bdf8',
                letterSpacing: '0.5px',
                wordBreak: 'break-all'
              }}>
                {config.digital_menu_wifi}
              </span>
              <button
                type="button"
                onClick={handleCopyWifi}
                style={{
                  background: copiedWifi ? '#10b981' : 'rgba(255,255,255,0.08)',
                  color: copiedWifi ? '#000' : '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                {copiedWifi ? <Check size={14} /> : <Copy size={14} />}
                {copiedWifi ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowWifiModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '0.88rem',
                cursor: 'pointer'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ─── CONTENEDOR PRINCIPAL CON BUSCADOR Y CATEGORÍAS ─── */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '16px' }}>
        
        {/* Barra de Búsqueda Rápida */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={18} color="#64748b" style={{ position: 'absolute', top: '13px', left: '14px' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar en la carta (ej: cerveza, picada, cóctel)..."
            style={{
              width: '100%',
              height: '44px',
              padding: '8px 14px 8px 42px',
              background: '#131c2e',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: '#ffffff',
              fontSize: '0.92rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                top: '11px',
                right: '12px',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Cabecera del Selector de Categorías con Botón de Expandir */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          padding: '0 4px'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🏷️ Categorías ({categories.length - 1})
          </span>
          <button
            type="button"
            onClick={() => setExpandAllCategories(!expandAllCategories)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px'
            }}
          >
            {expandAllCategories ? (
              <><span>Contraer</span> <ChevronUp size={15} /></>
            ) : (
              <><span>Ver todas las categorías</span> <ChevronDown size={15} /></>
            )}
          </button>
        </div>

        {/* Selector de Categorías Inteligente (Multi-Fila / Expandible o Deslizable con Altura Blindada) */}
        <div style={{
          display: 'flex',
          flexWrap: expandAllCategories ? 'wrap' : 'wrap', // Siempre envoltura fluida para que NUNCA se corten
          gap: '8px',
          marginBottom: '20px'
        }}>
          {categories.map(cat => {
            const isSelected = selectedCategory === cat;
            const count = categoryCounts[cat] || 0;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  minHeight: '38px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: isSelected ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.08)',
                  background: isSelected ? 'rgba(14, 165, 233, 0.22)' : '#131c2e',
                  color: isSelected ? '#38bdf8' : '#94a3b8',
                  fontWeight: isSelected ? '800' : '600',
                  fontSize: '0.84rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                <span>{cat}</span>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isSelected ? '#0ea5e9' : 'rgba(255,255,255,0.08)',
                  color: isSelected ? '#000000' : '#64748b',
                  fontWeight: '800'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ─── LISTADO DE PRODUCTOS ─── */}
        {filteredProducts.length === 0 ? (
          <div style={{
            background: '#131c2e',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px',
            padding: '40px 20px',
            textAlign: 'center',
            color: '#94a3b8'
          }}>
            <UtensilsCrossed size={40} color="#64748b" style={{ margin: '0 auto 12px auto' }} />
            <h4 style={{ color: '#ffffff', margin: '0 0 6px 0', fontSize: '1.05rem' }}>
              No se encontraron productos
            </h4>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>
              Prueba con otro término de búsqueda o selecciona otra categoría.
            </p>
          </div>
        ) : groupedProducts ? (
          /* VISTA POR GRUPOS Y SECCIONES CUANDO ESTÁ EN "TODOS" */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {Object.keys(groupedProducts).sort().map(categoryName => {
              const items = groupedProducts[categoryName];
              return (
                <section key={categoryName}>
                  {/* Encabezado de Sección de Categoría */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '8px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    marginBottom: '14px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>🏷️</span>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: '#ffffff' }}>
                        {categoryName}
                      </h3>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                        {items.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCategory(categoryName)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Filtrar solo {categoryName} →
                    </button>
                  </div>

                  {/* Rejilla de Productos de la Sección */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '12px'
                  }}>
                    {items.map(product => renderProductCard(product))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          /* VISTA FILTRADA POR CATEGORÍA O BÚSQUEDA */
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '14px',
              padding: '0 4px'
            }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Mostrando <strong>{filteredProducts.length}</strong> producto{filteredProducts.length === 1 ? '' : 's'} en <strong>{selectedCategory}</strong>
              </span>
              {selectedCategory !== 'Todos' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('Todos')}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#38bdf8',
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ✕ Ver Todos
                </button>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px'
            }}>
              {filteredProducts.map(product => renderProductCard(product))}
            </div>
          </div>
        )}

      </main>

      {/* ─── BOTÓN FLOTANTE PERMANENTE DE WHATSAPP (PEDIDOS / ATENCIÓN) ─── */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#22c55e',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '30px',
            boxShadow: '0 8px 25px rgba(34, 197, 94, 0.45)',
            textDecoration: 'none',
            fontWeight: '800',
            fontSize: '0.92rem',
            transition: 'transform 0.15s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageCircle size={22} />
          <span>Pedir por WhatsApp</span>
        </a>
      )}

      {/* ─── PIE DE PÁGINA Y ACCESO ADMINISTRATIVO ─── */}
      <footer style={{
        marginTop: '40px',
        padding: '24px 16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '0.78rem'
      }}>
        <p style={{ margin: '0 0 6px 0' }}>
          {config.business_name || 'Restaurante y Punto de Venta'}
        </p>
        <p style={{ margin: '0 0 16px 0', fontSize: '0.72rem' }}>
          Sistema POS con Sincronización en Tiempo Real
        </p>

        {onOpenAdminLogin && (
          <button
            type="button"
            onClick={onOpenAdminLogin}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '6px 14px',
              color: '#64748b',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Lock size={12} /> Acceso Cajero / Administración
          </button>
        )}
      </footer>
    </div>
  );

  // Renderizador de cada tarjeta de producto
  function renderProductCard(p) {
    const isSoldOut = p.stock !== null && p.stock !== undefined && Number(p.stock) <= 0;
    const imgUrl = getProductImg(p.image_path);
    const orderUrl = getProductOrderUrl(p);

    return (
      <div
        key={p.id}
        style={{
          background: '#131c2e',
          border: isSoldOut ? '1px dashed rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          opacity: isSoldOut ? 0.65 : 1,
          transition: 'transform 0.15s ease, border-color 0.15s ease',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Imagen del Producto */}
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={p.name}
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '10px',
                objectFit: 'cover',
                background: '#090d16',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                flexShrink: 0
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div style={{
              width: '74px',
              height: '74px',
              borderRadius: '10px',
              background: '#090d16',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              color: '#64748b',
              flexShrink: 0
            }}>
              🍽️
            </div>
          )}

          {/* Información */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {p.category && (
              <span style={{
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                fontWeight: '800',
                color: '#38bdf8',
                letterSpacing: '0.5px',
                display: 'block',
                marginBottom: '2px'
              }}>
                {p.category}
              </span>
            )}
            <h4 style={{
              fontSize: '0.96rem',
              fontWeight: '800',
              margin: '0 0 4px 0',
              color: '#ffffff',
              lineHeight: '1.25',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {p.name}
            </h4>

            {p.description && (
              <p style={{
                fontSize: '0.74rem',
                color: '#94a3b8',
                margin: '0 0 6px 0',
                lineHeight: '1.3',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {p.description}
              </p>
            )}

            {/* Estado Agotado */}
            {isSoldOut && (
              <span style={{
                display: 'inline-block',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                padding: '1px 6px',
                borderRadius: '4px',
                fontSize: '0.68rem',
                fontWeight: '800',
                marginTop: '2px'
              }}>
                Agotado por el momento
              </span>
            )}
          </div>
        </div>

        {/* Fila Inferior: Precio y Botón de Pedir por WhatsApp */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div>
            <span style={{
              fontSize: '1.2rem',
              fontWeight: '900',
              color: '#38bdf8'
            }}>
              ${formatMoney(p.price)}
            </span>
            <span style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: '4px' }}>COP</span>
          </div>

          {orderUrl && !isSoldOut && (
            <a
              href={orderUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '8px',
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#4ade80',
                fontSize: '0.74rem',
                fontWeight: '700',
                textDecoration: 'none'
              }}
              title="Pedir este producto directamente por WhatsApp"
            >
              <MessageCircle size={13} /> Pedir
            </a>
          )}
        </div>
      </div>
    );
  }
}
