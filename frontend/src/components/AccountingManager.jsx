import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Search, X, FileText, ExternalLink, Camera, Loader } from 'lucide-react';
import { API_URL } from '../utils/constants';
import { formatCOP, formatCOPInput, parseCOP } from '../utils/currency';

const AccountingManager = ({ config, activeShift, isAdmin, adminPassword }) => {
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchExpenses = async () => {
    try {
      const res = await fetch(`${API_URL}/expenses`);
      if (res.ok) {
        const data = await res.json().catch(() => []);
        setExpenses(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  useEffect(() => { 
    fetchExpenses(); 
    const handleRealtime = (e) => {
      if (e?.detail?.type && (e.detail.type.startsWith('EXPENSE') || e.detail.type.startsWith('SHIFT'))) {
        fetchExpenses();
      }
    };
    window.addEventListener('pos-realtime-event', handleRealtime);
    return () => window.removeEventListener('pos-realtime-event', handleRealtime);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!amount || !description) return;
    setIsUploading(true);
    try {
      let receiptImageUrl = null;
      // 1. Upload receipt file first if provided
      if (receiptFile) {
        const formData = new FormData();
        formData.append('receipt', receiptFile);
        formData.append('description', description);
        formData.append('amount', parseCOP(amount));
        const uploadRes = await fetch(`${API_URL}/expenses/upload-receipt`, {
          method: 'POST',
          body: formData
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          receiptImageUrl = uploadData.image_url;
        }
      }
      // 2. Register expense with receipt URL and payment method
      const res = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: parseCOP(amount), 
          description, 
          shift_id: activeShift?.id || null, 
          receipt_image: receiptImageUrl,
          payment_method: paymentMethod 
        })
      });
      if (res.ok) {
        setAmount('');
        setDescription('');
        setPaymentMethod('Efectivo');
        clearReceipt();
        fetchExpenses();
      }
    } catch (err) {
      console.error('Error registrando gasto:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteExpense = async (id) => {
    if (!isAdmin) {
      alert('Solo el Administrador puede eliminar registros de gastos.');
      return;
    }
    if (confirm('¿Eliminar este gasto definitivamente?')) {
      try {
        const res = await fetch(`${API_URL}/expenses/` + id, { 
          method: 'DELETE',
          headers: {
            'x-admin-password': adminPassword
          }
        });
        if (res.ok) {
          fetchExpenses();
        } else {
          const err = await res.json();
          alert(err.error || 'Error al eliminar gasto.');
        }
      } catch (err) {
        alert('Error de conexión.');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', gap: '20px' }}>
      <form onSubmit={handleAddExpense} style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
        <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>💸 Registrar Gasto Operativo</h3>
        
        {/* Selector de Origen de Fondos */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
            Origen del Dinero (¿De dónde sale el pago?):
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setPaymentMethod('Efectivo')}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: paymentMethod === 'Efectivo' ? '2px solid var(--success-emerald)' : '1px solid var(--border-glass)',
                background: paymentMethod === 'Efectivo' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-dark)',
                color: paymentMethod === 'Efectivo' ? 'var(--success-emerald)' : 'var(--text-muted)',
                fontWeight: paymentMethod === 'Efectivo' ? '800' : '600',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              💵 Caja (Efectivo)
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('Transferencia')}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: paymentMethod === 'Transferencia' ? '2px solid var(--primary-cyan)' : '1px solid var(--border-glass)',
                background: paymentMethod === 'Transferencia' ? 'rgba(6, 182, 212, 0.15)' : 'var(--bg-dark)',
                color: paymentMethod === 'Transferencia' ? 'var(--primary-cyan)' : 'var(--text-muted)',
                fontWeight: paymentMethod === 'Transferencia' ? '800' : '600',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              📱 Transferencia
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('Bolsillo Dueño')}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: paymentMethod === 'Bolsillo Dueño' ? '2px solid #a855f7' : '1px solid var(--border-glass)',
                background: paymentMethod === 'Bolsillo Dueño' ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-dark)',
                color: paymentMethod === 'Bolsillo Dueño' ? '#c084fc' : 'var(--text-muted)',
                fontWeight: paymentMethod === 'Bolsillo Dueño' ? '800' : '600',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              👤 Bolsillo Dueño
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            {paymentMethod === 'Efectivo' && '💡 Resta del efectivo físico en la gaveta para cuadrar el arqueo del turno.'}
            {paymentMethod === 'Transferencia' && '💡 Pagado desde la cuenta/Nequi del negocio. No descuadra la gaveta de efectivo físico.'}
            {paymentMethod === 'Bolsillo Dueño' && '💡 Pagado con dinero personal del dueño. No resta de la registradora ni del banco del negocio.'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="Descripción del gasto..." value={description} onChange={e => setDescription(e.target.value)} style={{ flex: 2, minWidth: '180px', padding: '10px', borderRadius: '5px', background: 'var(--bg-dark)', border: '1px solid var(--border-glass)', color: 'var(--text-main)' }} required />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: '120px' }}>
            <span style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>$</span>
            <input 
              type="text" 
              inputMode="numeric" 
              placeholder="Valor (ej: 50.000)..." 
              value={amount} 
              onChange={e => setAmount(formatCOPInput(e.target.value))} 
              style={{ width: '100%', padding: '10px 10px 10px 24px', borderRadius: '5px', background: 'var(--bg-dark)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold' }} 
              required 
            />
          </div>
        </div>
        {/* Receipt attachment */}
        <div style={{ marginBottom: '12px' }}>
          {receiptPreview ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '10px 14px' }}>
              <img src={receiptPreview} alt="preview" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--success-emerald)' }}>✅ Comprobante adjunto</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{receiptFile?.name}</div>
              </div>
              <button type="button" onClick={clearReceipt} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger-rose)', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>✕ Quitar</button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-dark)', border: '1px dashed var(--border-glass)', borderRadius: '10px', padding: '10px 14px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Camera size={18} />
              <span>📎 Adjuntar foto de factura/comprobante <em>(opcional)</em></span>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
          )}
        </div>
        <button type="submit" className="nav-btn active" disabled={isUploading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {isUploading ? '⏳ Guardando...' : '💾 Registrar Gasto'}
        </button>
      </form>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Buscar por descripción u origen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '10px 16px 10px 38px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', background: 'var(--bg-surface)', color: 'var(--text-main)', width: '100%', fontSize: '0.9rem', outline: 'none' }} />
          {searchQuery && <X size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Descripción</th>
            <th>Origen</th>
            <th>Valor</th>
            <th style={{ textAlign: 'center' }}>Comprobante</th>
            {isAdmin && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(expenses) ? expenses : []).filter(exp => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (exp.description && exp.description.toLowerCase().includes(q)) ||
                   (exp.payment_method && exp.payment_method.toLowerCase().includes(q));
          }).map(exp => {
            let dateFormatted = '-';
            try {
              dateFormatted = new Date(exp.created_at + 'Z').toLocaleString('es-CO');
            } catch (e) {
              dateFormatted = String(exp.created_at || '-');
            }
            return (
            <tr key={exp.id}>
              <td>{dateFormatted}</td>
              <td style={{ fontWeight: '600' }}>{exp.description}</td>
              <td>
                {exp.payment_method === 'Transferencia' ? (
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '3px 8px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--primary-cyan)', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                    📱 Transfer.
                  </span>
                ) : exp.payment_method === 'Bolsillo Dueño' ? (
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '3px 8px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                    👤 Dueño
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', padding: '3px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success-emerald)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    💵 Caja
                  </span>
                )}
              </td>
              <td style={{ color: 'var(--danger-rose)', fontWeight: 'bold' }}>-{formatCOP(exp.amount, true)}</td>
              <td style={{ textAlign: 'center' }}>
                {exp.receipt_image ? (
                  <button 
                    onClick={() => setSelectedReceipt(exp)} 
                    className="btn-icon primary" 
                    title="Ver Factura / Comprobante"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '0.8rem', borderRadius: '4px' }}
                  >
                    <FileText size={15} /> Ver
                  </button>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-</span>
                )}
              </td>
              {isAdmin && (
                <td><button onClick={() => deleteExpense(exp.id)} className="btn-icon danger" title="Eliminar gasto"><Trash2 size={16} /></button></td>
              )}
            </tr>
          );
        })}
        </tbody>
      </table>

      {selectedReceipt && (
        <div className="modal-overlay" onClick={() => setSelectedReceipt(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="var(--primary-teal)" /> Comprobante de Gasto #{selectedReceipt.id}
              </h3>
              <button onClick={() => setSelectedReceipt(null)} className="btn-icon" style={{ cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-main)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
              <div><strong>Concepto:</strong> {selectedReceipt.description}</div>
              <div><strong>Monto:</strong> <span style={{ color: 'var(--danger-rose)', fontWeight: 'bold' }}>{formatCOP(selectedReceipt.amount, true)}</span></div>
              <div><strong>Origen:</strong> {selectedReceipt.payment_method === 'Transferencia' ? '📱 Transferencia' : selectedReceipt.payment_method === 'Bolsillo Dueño' ? '👤 Bolsillo Dueño' : '💵 Caja (Efectivo)'}</div>
              <div><strong>Fecha:</strong> {new Date(selectedReceipt.created_at + 'Z').toLocaleString('es-CO')}</div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', textAlign: 'center', background: '#0a0a0a', borderRadius: 'var(--radius-md)', padding: '10px' }}>
              <img 
                src={selectedReceipt.receipt_image} 
                alt={`Comprobante #${selectedReceipt.id}`} 
                style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain', borderRadius: '4px' }} 
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' }}>
              <a 
                href={selectedReceipt.receipt_image} 
                target="_blank" 
                rel="noreferrer" 
                className="nav-btn"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <ExternalLink size={16} /> Abrir imagen completa
              </a>
              <button onClick={() => setSelectedReceipt(null)} className="nav-btn active">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingManager;
