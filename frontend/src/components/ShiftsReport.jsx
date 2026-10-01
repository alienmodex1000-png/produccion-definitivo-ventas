import React, { useState, useEffect } from 'react';
import { Trash2, Printer, Search, X, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { API_URL, exportToPDF } from '../utils/constants';
import { formatCOP } from '../utils/currency';
import PrintableShiftTicket from './PrintableShiftTicket';

const ShiftsReport = ({ config }) => {
  const [shifts, setShifts] = useState([]);
  const [shiftToPrint, setShiftToPrint] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedShiftId, setExpandedShiftId] = useState(null);
  const [shiftProducts, setShiftProducts] = useState({});
  const [loadingProductsId, setLoadingProductsId] = useState(null);
  
  const fetchShifts = async () => {
    try {
      const res = await fetch(`${API_URL}/shifts`);
      if (res.ok) {
        const data = await res.json().catch(() => []);
        setShifts(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  useEffect(() => { fetchShifts(); }, []);

  const toggleShiftProducts = async (shiftId) => {
    if (expandedShiftId === shiftId) {
      setExpandedShiftId(null);
      return;
    }
    setExpandedShiftId(shiftId);
    if (!shiftProducts[shiftId]) {
      setLoadingProductsId(shiftId);
      try {
        const res = await fetch(`${API_URL}/shifts/${shiftId}/products`);
        if (res.ok) {
          const prods = await res.json().catch(() => []);
          setShiftProducts(prev => ({ ...prev, [shiftId]: Array.isArray(prods) ? prods : [] }));
        }
      } catch (err) {
        console.error('Error cargando productos del turno:', err);
      } finally {
        setLoadingProductsId(null);
      }
    }
  };

  const handlePrintShift = async (s) => {
    let products = shiftProducts[s.id];
    if (!products) {
      try {
        const res = await fetch(`${API_URL}/shifts/${s.id}/products`);
        if (res.ok) {
          products = await res.json().catch(() => []);
          setShiftProducts(prev => ({ ...prev, [s.id]: Array.isArray(products) ? products : [] }));
        }
      } catch (e) {}
    }
    setShiftToPrint({ ...s, products: products || [] });
    setTimeout(() => { 
      document.body.classList.add('print-shift-only'); 
      const cleanup = () => {
        document.body.classList.remove('print-shift-only');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      window.print();
      setTimeout(cleanup, 3000);
    }, 250);
  };

  const deleteShift = async (shift) => {
    if (shift.status === 'open') {
      alert('⚠️ No es posible eliminar un turno que se encuentra actualmente abierto y en operación.');
      return;
    }
    if (confirm(`¿Eliminar permanentemente del historial el turno #${shift.id} de ${shift.user_name}?`)) {
      const pwd = prompt('Ingrese Contraseña de Administrador para eliminar:');
      if (pwd !== (config.admin_password || '1234')) {
        alert('Contraseña incorrecta. Acción cancelada.');
        return;
      }
      try {
        const res = await fetch(`${API_URL}/shifts/` + shift.id, { method: 'DELETE' });
        if (res.ok) {
          fetchShifts();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'Error al eliminar el turno.');
        }
      } catch (err) {
        alert('Error de conexión.');
      }
    }
  };

  const filteredShifts = (Array.isArray(shifts) ? shifts : []).filter(s => 
    !searchQuery || 
    (s.user_name && s.user_name.toLowerCase().includes(searchQuery.toLowerCase())) || 
    String(s.id).includes(searchQuery)
  );

  // Totales acumulados para métricas rápidas
  const totalRecaudado = filteredShifts.reduce((acc, s) => acc + (s.total_collected || ((s.cash_sales || 0) + (s.transfer_sales || 0))), 0);
  const totalVentas = filteredShifts.reduce((acc, s) => acc + (s.total_turn_sales !== undefined ? s.total_turn_sales : (s.total_sales || ((s.cash_sales || 0) + (s.transfer_sales || 0) + (s.debt_sales || 0)))), 0);
  const totalCartera = filteredShifts.reduce((acc, s) => acc + (s.debt_payments !== undefined ? s.debt_payments : (s.collected_debts || 0)), 0);
  const totalDescuadre = filteredShifts.reduce((acc, s) => acc + (s.discrepancy || 0), 0);
  const totalArticulos = filteredShifts.reduce((acc, s) => acc + (Number(s.total_items_sold) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0 }}>Historial y Auditoría de Turnos</h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Supervisión integral de recaudos en caja, ventas directas, cobros de cartera y productos despachados
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '250px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Buscar cajero o ID turno..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '10px 16px 10px 38px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', background: 'var(--bg-surface)', color: 'var(--text-main)', width: '100%', fontSize: '0.9rem', outline: 'none' }} />
            {searchQuery && <X size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
          </div>
          <button onClick={() => exportToPDF(shifts, 'Historial_Cierres', [
            { label: 'Turno', key: 'id' },
            { label: 'Cajero', key: 'user_name' },
            { label: 'Apertura', key: 'start_time', format: val => val ? new Date(val + 'Z').toLocaleString('es-CO') : '' },
            { label: 'Cierre', key: 'end_time', format: val => val ? new Date(val + 'Z').toLocaleString('es-CO') : 'ABIERTO' },
            { label: 'Artículos Vend.', key: 'total_items_sold' },
            { label: 'Base Inicial', key: 'initial_cash' },
            { label: 'Efectivo Declarado', key: 'final_cash' },
            { label: 'Ventas Efec', key: 'cash_sales' },
            { label: 'Ventas Transf', key: 'transfer_sales' },
            { label: 'Abonos Cartera', key: 'debt_payments' },
            { label: 'Total Recaudado', key: 'total_collected' },
            { label: 'Total Facturado', key: 'total_turn_sales' },
            { label: 'Gastos', key: 'expenses' },
            { label: 'Diferencia (Descuadre)', key: 'discrepancy' }
          ], config)} className="nav-btn" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }}>
            Exportar a PDF
          </button>
        </div>
      </div>

      {/* TARJETAS RESUMEN DE TURNOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'var(--bg-surface)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-cyan)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--primary-cyan)', fontWeight: '700' }}>💰 TOTAL RECAUDADO</span>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', marginTop: '6px', color: 'var(--primary-cyan)' }}>
            ${totalRecaudado.toLocaleString('es-CO')}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Efectivo + Transferencias</span>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>🚀 TOTAL FACTURADO</span>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', marginTop: '6px', color: 'var(--text-bright)' }}>
            ${totalVentas.toLocaleString('es-CO')}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ventas directas + Fiados</span>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid #10b981' }}>
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700' }}>💳 RECAUDO CARTERA</span>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', marginTop: '6px', color: '#10b981' }}>
            ${totalCartera.toLocaleString('es-CO')}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Abonos cobrados en turno</span>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid #8b5cf6' }}>
          <span style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: '700' }}>📦 ARTÍCULOS VENDIDOS</span>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', marginTop: '6px', color: '#c084fc' }}>
            {totalArticulos.toLocaleString('es-CO')} <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>uds</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Despachadas en {filteredShifts.length} turnos</span>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: `1px solid ${totalDescuadre < 0 ? 'var(--danger-rose)' : 'var(--border-glass)'}` }}>
          <span style={{ fontSize: '0.75rem', color: totalDescuadre < 0 ? 'var(--danger-rose)' : 'var(--success-emerald)', fontWeight: '700' }}>
            {totalDescuadre < 0 ? '⚠️ DESCUADRE ACUMULADO' : '✅ BALANCE CUADRE'}
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', marginTop: '6px', color: totalDescuadre < 0 ? 'var(--danger-rose)' : 'var(--success-emerald)' }}>
            ${totalDescuadre.toLocaleString('es-CO')}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{filteredShifts.length} turnos registrados</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cajero</th>
              <th>Apertura</th>
              <th>Cierre</th>
              <th style={{ textAlign: 'center' }}>📦 Productos</th>
              <th>Base</th>
              <th>Declarado</th>
              <th>Ventas (Efec)</th>
              <th>Ventas (Transf)</th>
              <th style={{ color: '#10b981' }}>Abonos Cartera</th>
              <th style={{ color: 'var(--primary-cyan)', fontWeight: '800' }}>💰 Total Recaudado</th>
              <th>🚀 Ventas Turno</th>
              <th>Gastos</th>
              <th>Diferencia</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredShifts.map(s => {
              const rec = s.total_collected !== undefined && s.total_collected !== null 
                ? s.total_collected 
                : ((s.cash_sales || 0) + (s.transfer_sales || 0));
              const ven = s.total_turn_sales !== undefined && s.total_turn_sales !== null
                ? s.total_turn_sales
                : (s.total_sales || ((s.cash_sales || 0) + (s.transfer_sales || 0) + (s.debt_sales || 0)));
              const abonos = s.debt_payments !== undefined && s.debt_payments !== null
                ? s.debt_payments
                : (s.collected_debts || 0);

              return (
                <React.Fragment key={s.id}>
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>#{s.id}</td>
                    <td style={{ fontWeight: '600' }}>{s.user_name}</td>
                    <td>{new Date(s.start_time + 'Z').toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{s.end_time ? new Date(s.end_time + 'Z').toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : <span style={{ color: '#10b981', fontWeight: 'bold' }}>ACTIVO</span>}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => toggleShiftProducts(s.id)}
                        title="Ver lista de productos despachados en este turno"
                        style={{
                          background: expandedShiftId === s.id ? 'var(--primary-cyan)' : 'rgba(139, 92, 246, 0.15)',
                          color: expandedShiftId === s.id ? '#000' : '#c084fc',
                          border: '1px solid rgba(139, 92, 246, 0.35)',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: '700'
                        }}
                      >
                        <Package size={13} />
                        <span>{s.total_items_sold || 0} uds</span>
                        {expandedShiftId === s.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </td>
                    <td>{formatCOP(s.initial_cash || 0, true)}</td>
                    <td style={{ fontWeight: '600' }}>{s.final_cash !== null && s.final_cash !== undefined ? formatCOP(s.final_cash, true) : '-'}</td>
                    <td>{formatCOP(s.cash_sales || 0, true)}</td>
                    <td>{formatCOP(s.transfer_sales || 0, true)}</td>
                    <td style={{ color: '#10b981', fontWeight: '600' }}>{formatCOP(abonos, true)}</td>
                    <td style={{ color: 'var(--primary-cyan)', fontWeight: '800' }}>
                      {formatCOP(rec, true)}
                    </td>
                    <td style={{ fontWeight: '700' }}>{formatCOP(ven, true)}</td>
                    <td style={{ color: 'var(--danger-rose)' }}>{formatCOP(s.expenses || 0, true)}</td>
                    <td style={{ 
                      fontWeight: '800', 
                      color: s.discrepancy < 0 ? 'var(--danger-rose)' : s.discrepancy > 0 ? 'var(--warning-amber)' : 'var(--success-emerald)' 
                    }}>
                      {s.discrepancy !== null ? `${s.discrepancy < 0 ? '-' : '+'}${formatCOP(Math.abs(s.discrepancy), true)}` : '-'}
                    </td>
                    <td>
                      <span className={`status-badge ${s.status}`}>
                        {s.status === 'closed' ? 'CERRADO' : 'ABIERTO'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handlePrintShift(s)} title="Imprimir Cierre con detalle de auditoría" className="btn-icon" style={{ color: 'var(--primary-cyan)' }}>
                          <Printer size={18} />
                        </button>
                        {s.status === 'open' ? (
                          <button disabled title="Turno en operación (no se puede eliminar mientras esté abierto)" className="btn-icon" style={{ opacity: 0.25, cursor: 'not-allowed' }}>
                            <Trash2 size={18} />
                          </button>
                        ) : (
                          <button onClick={() => deleteShift(s)} title="Borrar Turno del Historial" className="btn-icon" style={{ color: 'var(--danger-rose)' }}>
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* SUBTABLA EXPANDIBLE DE PRODUCTOS VENDIDOS EN EL TURNO */}
                  {expandedShiftId === s.id && (
                    <tr>
                      <td colSpan="16" style={{ padding: '0', background: 'rgba(255,255,255,0.01)' }}>
                        <div style={{ padding: '14px 20px', borderLeft: '4px solid #8b5cf6', margin: '8px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <span style={{ fontWeight: '800', color: '#c084fc', fontSize: '0.92rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <Package size={17} /> Desglose de Productos Vendidos — Turno #{s.id} ({s.user_name})
                              </span>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Inventario físico despachado durante este turno para control y relevo de caja
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-bright)' }}>
                                Total Unidades: <strong style={{ color: '#c084fc' }}>{s.total_items_sold || 0} uds</strong>
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-bright)' }}>
                                Variedad: <strong style={{ color: 'var(--primary-cyan)' }}>{s.distinct_products_sold || (shiftProducts[s.id] ? shiftProducts[s.id].length : 0)} productos</strong>
                              </span>
                            </div>
                          </div>

                          {loadingProductsId === s.id ? (
                            <div style={{ padding: '18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              ⏳ Consultando productos despachados en el turno...
                            </div>
                          ) : !shiftProducts[s.id] || shiftProducts[s.id].length === 0 ? (
                            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                              No se registraron artículos despachados en este turno.
                            </div>
                          ) : (
                            <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-glass)', opacity: 0.7 }}>
                                    <th style={{ padding: '6px 8px' }}>#</th>
                                    <th style={{ padding: '6px 8px' }}>Descripción de Producto</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>Cantidad Despachada</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Total Facturado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {shiftProducts[s.id].map((prod, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                                      <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                      <td style={{ padding: '6px 8px', fontWeight: '600' }}>{prod.product_name}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                        <span style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', padding: '2px 8px', borderRadius: '10px', fontWeight: '800' }}>
                                          x{prod.total_quantity}
                                        </span>
                                      </td>
                                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--text-bright)' }}>
                                        {formatCOP(prod.total_amount || 0, true)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
      {/* Hidden printable component */}
      <PrintableShiftTicket shift={shiftToPrint} config={config} />
    </div>
  );
};

export default ShiftsReport;
