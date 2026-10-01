import React, { useState } from 'react';
import { Plus, Edit2, Trash2, PackagePlus, Search, X } from 'lucide-react';
import { API_URL, getImageUrl, exportToPDF } from '../utils/constants';
import { formatCOP, formatCOPInput, parseCOP } from '../utils/currency';

const InventoryManager = ({ products, onSave, config, isAdmin, adminPassword }) => {
  const [editingProductId, setEditingProductId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showMissingCostOnly, setShowMissingCostOnly] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const isCostTrackingEnabled = isAdmin && config?.enable_profit_tracking !== 'false';
  const [imageFile, setImageFile] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', price: '', cost_price: '', category: '', barcode: '', stock: '', min_stock: '', sort_order: '0', location: '', image_path: '', unit_type: 'unit', description: '', business_line: '' 
  });

  const handleEdit = (p) => {
    setEditingProductId(p.id);
    setFormData({ 
      name: p.name, 
      price: formatCOPInput(p.price), 
      cost_price: p.cost_price ? formatCOPInput(p.cost_price) : '',
      category: p.category || '', 
      barcode: p.barcode || '', 
      stock: p.stock || 0, 
      min_stock: p.min_stock || 5, 
      sort_order: p.sort_order?.toString() || '0',
      location: p.location || '',
      image_path: p.image_path || '',
      unit_type: p.unit_type || 'unit',
      description: p.description || '',
      business_line: p.business_line || ''
    });
    setImageFile(null);
    setIsFormVisible(true);
  };

  const handleCancel = () => {
    setEditingProductId(null);
    setFormData({ name: '', price: '', cost_price: '', category: '', barcode: '', stock: '', min_stock: '', sort_order: '0', location: '', image_path: '', unit_type: 'unit', description: '', business_line: '' });
    setImageFile(null);
    setIsFormVisible(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'price' || name === 'cost_price') {
      setFormData({ ...formData, [name]: formatCOPInput(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingProductId ? `${API_URL}/products/${editingProductId}` : `${API_URL}/products`;
    const method = editingProductId ? 'PUT' : 'POST';

    try {
      let finalImagePath = formData.image_path;

      if (imageFile) {
        const fileData = new FormData();
        fileData.append('image', imageFile);
        const uploadRes = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          body: fileData
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalImagePath = uploadData.image_path; 
        }
      }

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword 
        },
        body: JSON.stringify({ 
          ...formData, 
          price: parseCOP(formData.price), 
          cost_price: parseCOP(formData.cost_price || 0),
          stock: Number(formData.stock || 0),
          min_stock: Number(formData.min_stock || 5),
          sort_order: Number(formData.sort_order || 0),
          barcode: formData.barcode ? formData.barcode.trim() : null,
          location: formData.location ? formData.location.trim() : null,
          image_path: finalImagePath,
          unit_type: formData.unit_type || 'unit',
          business_line: formData.business_line || null
        })
      });
      if (res.ok) {
        handleCancel();
        onSave();
      } else {
        const errorText = await res.text();
        alert(`Error al guardar: ${errorText || 'Código de barras duplicado'}`);
      }
    } catch (err) {
      alert('Error al conectar con el servidor.');
    }
  };

  // Filtrado reactivo de productos
  const safeProducts = Array.isArray(products) ? products : [];
  const filteredProducts = safeProducts.filter(p => {
    if (!p) return false;
    const matchesSearch = !searchQuery || (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) || (p.barcode && String(p.barcode).includes(searchQuery));
    const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesLowStock = !showLowStockOnly || ((Number(p.stock) || 0) <= (Number(p.min_stock) || 5));
    const matchesMissingCost = !showMissingCostOnly || (!p.cost_price || Number(p.cost_price) <= 0);
    return matchesSearch && matchesCategory && matchesLowStock && matchesMissingCost;
  });

  // Métricas de valoración económica del inventario
  let totalUnits = 0;
  let totalRetailValue = 0;
  let totalCostValue = 0;
  let costedRetailValue = 0;
  let costedCount = 0;
  let missingCostCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  // Conteo global para el botón de alertas
  let globalOutOfStock = 0;
  let globalLowStock = 0;
  safeProducts.forEach(p => {
    if (!p) return;
    const s = Number(p.stock) || 0;
    if (s <= 0) globalOutOfStock++;
    else if (s <= (Number(p.min_stock) || 5)) globalLowStock++;
  });

  filteredProducts.forEach(p => {
    const stock = Math.max(0, Number(p.stock) || 0);
    const price = Number(p.price) || 0;
    const cost = Number(p.cost_price) || 0;

    totalUnits += stock;
    totalRetailValue += (stock * price);

    if (cost > 0) {
      totalCostValue += (stock * cost);
      costedRetailValue += (stock * price);
      costedCount++;
    } else {
      missingCostCount++;
    }

    if (stock <= 0) {
      outOfStockCount++;
    } else if (stock <= (p.min_stock || 5)) {
      lowStockCount++;
    }
  });

  const projectedProfit = costedRetailValue - totalCostValue;
  const profitMarginPct = costedRetailValue > 0 ? ((projectedProfit / costedRetailValue) * 100) : 0;
  const costCoveragePct = filteredProducts.length > 0 ? Math.round((costedCount / filteredProducts.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>Control General de Existencias</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Valoración en tiempo real y administración física de mercancía.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {!isFormVisible && (
            <>
              <button onClick={() => {
                const pdfProducts = filteredProducts.map(p => ({
                  ...p,
                  stock_retail_val: `$${(Math.max(0, p.stock || 0) * (p.price || 0)).toLocaleString('es-CO')}`,
                  stock_cost_val: p.cost_price > 0 ? `$${(Math.max(0, p.stock || 0) * p.cost_price).toLocaleString('es-CO')}` : 'Sin costo'
                }));
                exportToPDF(pdfProducts, 'Inventario_Valorizado', [
                  { label: 'ID', key: 'id' },
                  { label: 'Categoría', key: 'category' },
                  { label: 'Nombre', key: 'name' },
                  { label: 'Código de Barras', key: 'barcode' },
                  ...(isCostTrackingEnabled ? [{ label: 'Costo Unit.', key: 'cost_price' }] : []),
                  { label: 'Precio Venta', key: 'price' },
                  { label: 'Stock Actual', key: 'stock' },
                  { label: 'Valor en Venta', key: 'stock_retail_val' },
                  ...(isCostTrackingEnabled ? [{ label: 'Valor al Costo', key: 'stock_cost_val' }] : []),
                  { label: 'Stock Mínimo', key: 'min_stock' },
                  { label: 'Ubicación', key: 'location' }
                ], config);
              }} className="nav-btn" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }}>
                 Exportar Inventario (PDF)
              </button>
              {isAdmin && (
                <button onClick={() => setIsFormVisible(true)} className="nav-btn active">
                  <Plus size={16} /> Agregar Producto Nuevo
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* TARJETAS EJECUTIVAS DE VALORACIÓN DEL INVENTARIO */}
      {!isFormVisible && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '22px' }}>
          {/* Tarjeta 1: Valor Comercial (Venta al Público) */}
          <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--primary-cyan)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary-cyan)', fontWeight: '800', letterSpacing: '0.5px' }}>
              💰 VALOR COMERCIAL EN STOCK
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: '900', marginTop: '6px', color: 'var(--text-bright)', fontFamily: 'Outfit, sans-serif' }}>
              ${totalRetailValue.toLocaleString('es-CO')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Recaudo total proyectado a precio de venta
            </div>
          </div>

          {/* Tarjeta 2: Capital Invertido o Unidades Físicas */}
          {isCostTrackingEnabled ? (
            <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '800', letterSpacing: '0.5px' }}>
                📦 CAPITAL INVERTIDO (AL COSTO)
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', marginTop: '6px', color: 'var(--text-bright)', fontFamily: 'Outfit, sans-serif' }}>
                ${totalCostValue.toLocaleString('es-CO')}
              </div>
              <div style={{ fontSize: '0.75rem', color: costCoveragePct === 100 ? 'var(--success-emerald)' : 'var(--warning-amber)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {costCoveragePct === 100 ? (
                  <span>✅ 100% de productos costeados</span>
                ) : (
                  <span>⚠️ {costCoveragePct}% costeado ({missingCostCount} sin costo)</span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '800', letterSpacing: '0.5px' }}>
                📦 UNIDADES FÍSICAS EN STOCK
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', marginTop: '6px', color: 'var(--text-bright)', fontFamily: 'Outfit, sans-serif' }}>
                {totalUnits.toLocaleString('es-CO')} <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>unds.</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Total de artículos en inventario
              </div>
            </div>
          )}

          {/* Tarjeta 3: Ganancia Bruta Proyectada o Variedad de Referencias */}
          {isCostTrackingEnabled ? (
            <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--success-emerald)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--success-emerald)', fontWeight: '800', letterSpacing: '0.5px' }}>
                📈 GANANCIA BRUTA PROYECTADA
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', marginTop: '6px', color: 'var(--success-emerald)', fontFamily: 'Outfit, sans-serif' }}>
                ${projectedProfit.toLocaleString('es-CO')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Margen estimado: <strong style={{ color: 'var(--text-bright)' }}>{profitMarginPct.toFixed(1)}%</strong>
                {costCoveragePct < 100 && <span style={{ color: 'var(--warning-amber)', marginLeft: '4px' }}>(sobre costeados)</span>}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '800', letterSpacing: '0.5px' }}>
                🏷️ VARIEDAD DE PRODUCTOS
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', marginTop: '6px', color: 'var(--text-bright)', fontFamily: 'Outfit, sans-serif' }}>
                {filteredProducts.length} <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-muted)' }}>referencias</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {filteredProducts.length !== products.length ? `Filtradas de ${products.length} totales` : 'En catálogo activo'}
              </div>
            </div>
          )}

          {/* Tarjeta 4: Unidades Totales o Estado del Stock */}
          <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: `1px solid ${outOfStockCount > 0 ? 'var(--danger-rose)' : lowStockCount > 0 ? 'var(--warning-amber)' : 'var(--border-glass)'}`, boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <span style={{ fontSize: '0.75rem', color: outOfStockCount > 0 ? 'var(--danger-rose)' : lowStockCount > 0 ? 'var(--warning-amber)' : 'var(--text-muted)', fontWeight: '800', letterSpacing: '0.5px' }}>
              {isCostTrackingEnabled ? '🏷️ UNIDADES Y ESTADO' : '⚠️ ESTADO DEL STOCK'}
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: '900', marginTop: '6px', color: outOfStockCount > 0 ? 'var(--danger-rose)' : lowStockCount > 0 ? 'var(--warning-amber)' : 'var(--text-bright)', fontFamily: 'Outfit, sans-serif' }}>
              {isCostTrackingEnabled ? (
                <span>{totalUnits.toLocaleString('es-CO')} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)' }}>unds.</span></span>
              ) : (
                <span>{outOfStockCount} <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--danger-rose)' }}>agotados</span></span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {isCostTrackingEnabled ? (
                <span>{filteredProducts.length} referencias ({outOfStockCount} agotados | {lowStockCount} stock bajo)</span>
              ) : (
                <span>{lowStockCount} ref. adicionales con stock bajo</span>
              )}
            </div>
          </div>
        </div>
      )}

      {isFormVisible && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', marginBottom: '30px' }}>
          <h3 style={{ color: 'var(--text-bright)', marginBottom: '16px', fontWeight: '800' }}>
            {editingProductId ? '🛠️ Modificar Información de Producto' : '➕ Registrar Entrada de Producto'}
          </h3>
          
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '2 1 250px' }}>
              <label>Descripción / Nombre del Artículo</label>
              <input name="name" value={formData.name} onChange={handleChange} required placeholder="Ej: Leche Entera Colanta 1L" />
            </div>
            <div className="form-group" style={{ flex: '1 1 150px', position: 'relative' }}>
                <label>Código de Barras (Escanea o escribe)</label>
                <div style={{ position: 'relative' }}>
                  <input id="barcode-search-input" name="barcode" value={formData.barcode} onChange={handleChange} placeholder="Ej: 770200..." style={{ width: '100%', paddingRight: '30px', boxSizing: 'border-box' }} />
                  {formData.barcode && (
                    <span 
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() => setFormData({ ...formData, barcode: '' })}
                    >
                      X
                    </span>
                  )}
                </div>
              </div>
            <div className="form-group" style={{ flex: '1 1 150px' }}>
              <label>Categoría</label>
              <input name="category" value={formData.category} onChange={handleChange} required placeholder="Ej: Abarrotes, Lácteos" />
            </div>
          </div>
          
          {config?.enable_product_descriptions === 'true' && (
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px' }}>
              <div className="form-group" style={{ flex: '1 1 100%' }}>
                <label>Descripción Detallada (Opcional)</label>
                <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Ej: RAM 8GB, SSD 256GB, Color Plata..." style={{ width: '100%', minHeight: '60px', padding: '12px', background: 'var(--bg-dark)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)', resize: 'vertical' }} />
              </div>
            </div>
          )}

          {config?.enable_business_lines === 'true' && (
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px' }}>
              <div className="form-group" style={{ flex: '1 1 200px', border: '1px solid #a855f7', padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgba(168,85,247,0.05)' }}>
                <label style={{ color: '#a855f7', fontWeight: 'bold' }}>🏪 Línea de Negocio</label>
                <select name="business_line" value={formData.business_line || ''} onChange={handleChange} style={{ padding: '10px', border: '1px solid #a855f7', borderRadius: 'var(--radius-md)', background: 'var(--bg-dark)', color: 'var(--text-main)', width: '100%', marginTop: '6px' }}>
                  <option value="">— Sin asignar (General) —</option>
                  <option value={config.business_line_1_name || 'Línea 1'}>{config.business_line_1_name || 'Línea 1'}</option>
                  <option value={config.business_line_2_name || 'Línea 2'}>{config.business_line_2_name || 'Línea 2'}</option>
                </select>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Asigna este producto a una línea para ver métricas separadas.</p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px' }}>
            <div className="form-group" style={{ flex: '1 1 120px' }}>
              <label>Precio Venta al Público</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>$</span>
                <input 
                  type="text" 
                  inputMode="numeric" 
                  name="price" 
                  value={formData.price} 
                  onChange={handleChange} 
                  required 
                  placeholder="Precio cobro (ej: 25.000)" 
                  style={{ width: '100%', paddingLeft: '24px', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold' }} 
                />
              </div>
            </div>
            {config.enable_profit_tracking !== 'false' && (
            <div className="form-group" style={{ flex: '1 1 120px' }}>
              <label>Precio Costo (Compra)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>$</span>
                <input 
                  type="text" 
                  inputMode="numeric" 
                  name="cost_price" 
                  value={formData.cost_price} 
                  onChange={handleChange} 
                  placeholder="Precio costo (ej: 18.000)" 
                  style={{ width: '100%', paddingLeft: '24px', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold' }} 
                />
              </div>
            </div>
            )}
            <div className="form-group" style={{ flex: '1 1 100px' }}>
              <label>Stock Físico Inicial</label>
              <input type="number" name="stock" value={formData.stock} onChange={handleChange} required placeholder="Existencias en estante" />
            </div>
            <div className="form-group" style={{ flex: '1 1 100px' }}>
              <label>Alerta Mínima Stock</label>
              <input type="number" name="min_stock" value={formData.min_stock} onChange={handleChange} required placeholder="Cantidad de advertencia" />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px' }}>
            <div className="form-group" style={{ flex: '1 1 120px' }}>
              <label>Ubicación (Opcional)</label>
              <input name="location" value={formData.location} onChange={handleChange} placeholder="Ej: Estante 3" />
            </div>
            <div className="form-group" style={{ flex: '1 1 120px' }}>
              <label>Tipo de Venta</label>
              <select name="unit_type" value={formData.unit_type} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', borderRadius: '8px' }}>
                <option value="unit">Por Unidad</option>
                <option value="kg">Por Peso (Kg)</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label>Imagen del Producto</label>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleCancel} className="checkout-btn-secondary" style={{ width: 'auto', padding: '10px 24px' }}>CANCELAR</button>
            <button type="submit" className="checkout-btn" style={{ width: 'auto', padding: '10px 30px' }}>
              {editingProductId ? 'GUARDAR EDICIÓN' : 'AGREGAR PRODUCTO'}
            </button>
          </div>
        </form>
      )}


      {/* Barra de Filtro de Categorías y Buscador */}
      {!isFormVisible && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
            {['Todas', ...new Set(safeProducts.map(p => p?.category).filter(Boolean))].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`nav-btn ${selectedCategory === cat ? 'active' : ''}`}
                style={{ padding: '8px 14px', fontSize: '0.85rem', borderRadius: '20px' }}
              >
                {cat}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {isCostTrackingEnabled && missingCostCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowMissingCostOnly(!showMissingCostOnly);
                  if (!showMissingCostOnly) setShowLowStockOnly(false);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '20px',
                  border: '1px solid #0ea5e9',
                  background: showMissingCostOnly ? '#0ea5e9' : 'rgba(14, 165, 233, 0.1)',
                  color: showMissingCostOnly ? '#000' : '#0ea5e9',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
                title="Ver productos que no tienen registrado el precio de compra o costo"
              >
                🏷️ {showMissingCostOnly ? 'Mostrando Sin Costo' : `Ver Sin Costo (${missingCostCount})`}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowLowStockOnly(!showLowStockOnly);
                if (!showLowStockOnly) setShowMissingCostOnly(false);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: '1px solid var(--warning-amber)',
                background: showLowStockOnly ? 'var(--warning-amber)' : 'rgba(245, 158, 11, 0.1)',
                color: showLowStockOnly ? '#000' : 'var(--warning-amber)',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              ⚠️ {showLowStockOnly ? 'Mostrando Agotados / Stock Bajo' : `Ver Alertas (${globalOutOfStock} agotados / ${globalLowStock} stock bajo)`}
            </button>
            <div style={{ display: 'flex', gap: '10px', width: '320px', position: 'relative', maxWidth: '100%' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '10px 16px 10px 38px',
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
        </div>
      )}
      
      <table className="data-table">
        <thead>
          <tr>
            <th>Código de Barras</th>
            <th>Descripción del Producto</th>
            <th>Categoría</th>
            <th>Venta Público</th>
            {isCostTrackingEnabled && <th>Costo Proveedor</th>}
            <th>Cant. Física</th>
            <th>Valor en Stock</th>
            <th>Alerta Mín.</th>
            <th style={{ textAlign: 'center' }}>Gestión</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.map(p => {
            const isLowStock = p.stock > 0 && p.stock <= p.min_stock;
            const isCriticalStock = p.stock <= 0;
            let stockColor = 'inherit';
            let stockLabel = `${p.stock} u.`;
            if (isCriticalStock) {
              stockColor = 'var(--danger-rose)';
              stockLabel = 'AGOTADO';
            } else if (isLowStock) {
              stockColor = 'var(--warning-amber)';
              stockLabel = `${p.stock} u. (Bajo)`;
            }

            return (
              <tr key={p.id}>
                <td style={{ color: p.barcode ? 'var(--text-main)' : 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {p.barcode || 'Sin Código'}
                </td>
                <td style={{ fontWeight: '500' }}>{p.name}</td>
                <td><span className="status-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>{p.category}</span></td>
                <td style={{ fontWeight: 'bold', color: 'var(--primary-cyan)' }}>{formatCOP(p.price, true)}</td>
                {isCostTrackingEnabled && (
                  <td style={{ color: p.cost_price > 0 ? 'var(--text-muted)' : 'var(--warning-amber)' }}>
                    {p.cost_price > 0 ? formatCOP(p.cost_price, true) : 'Sin costo'}
                  </td>
                )}
                <td style={{ color: stockColor, fontWeight: isLowStock || isCriticalStock ? '800' : 'normal' }}>
                  {stockLabel}
                </td>
                <td>
                  <div style={{ fontWeight: '800', color: 'var(--text-bright)', fontSize: '0.95rem' }}>
                    ${(Math.max(0, p.stock || 0) * (p.price || 0)).toLocaleString('es-CO')}
                  </div>
                  {isCostTrackingEnabled && (
                    <div style={{ fontSize: '0.72rem', marginTop: '2px' }}>
                      {p.cost_price > 0 ? (
                        <span style={{ color: 'var(--text-muted)' }}>Costo: ${(Math.max(0, p.stock || 0) * p.cost_price).toLocaleString('es-CO')}</span>
                      ) : (
                        <span style={{ color: 'var(--warning-amber)', fontWeight: '600' }}>⚠️ Sin costo</span>
                      )}
                    </div>
                  )}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{p.min_stock} u.</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {config?.enable_fifo === 'true' && (
                      <button onClick={(e) => {
                        e.stopPropagation();
                        const qty = prompt(`Ingresar nuevo Lote para: ${p.name}\n\nCantidad a ingresar:`);
                        if (!qty || isNaN(qty) || qty <= 0) return;
                        const cost = prompt(`Costo unitario para este lote de ${qty} unidades:\n(Dejar en blanco para usar el costo actual $${p.cost_price || 0})`, p.cost_price || 0);
                        if (cost === null || isNaN(cost)) return;
                        
                        fetch(`${API_URL}/inventory/batches`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ product_id: p.id, quantity: Number(qty), cost: Number(cost) })
                        }).then(res => {
                          if (res.ok) { alert('Lote registrado y stock actualizado.'); onSave(); }
                          else alert('Error al registrar lote.');
                        });
                      }} className="btn-icon" style={{ background: 'var(--primary-cyan)', color: '#000' }} title="Ingresar Lote (PEPS)">
                        <PackagePlus size={14} />
                      </button>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const qtyStr = prompt(`📦 Entrada rápida de mercancía para:\n"${p.name}"\n\nStock actual: ${p.stock} u.\n\n¿Cuántas unidades llegaron? (Ej: 6 o 12):`);
                        if (!qtyStr) return;
                        const qty = parseFloat(qtyStr);
                        if (isNaN(qty) || qty <= 0) {
                          alert('Por favor ingrese una cantidad numérica válida mayor a 0.');
                          return;
                        }
                        fetch(`${API_URL}/products/adjust-stock/${p.id}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ quantity: qty })
                        }).then(async res => {
                          if (res.ok) {
                            const data = await res.json();
                            alert(`✅ Se añadieron ${qty} unidades a "${p.name}".\nNuevo stock disponible: ${data.newStock} u.`);
                            onSave();
                          } else {
                            alert('Error al ajustar el inventario.');
                          }
                        }).catch(() => alert('Error de conexión con el servidor.'));
                      }} 
                      className="btn-icon" 
                      style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success-emerald)', border: '1px solid rgba(16, 185, 129, 0.3)' }} 
                      title="Entrada rápida de mercancía (+)"
                    >
                      <Plus size={14} />
                    </button>
                    {isAdmin && (
                      <>
                        <button onClick={() => handleEdit(p)} className="btn-icon" title="Editar"><Edit2 size={14} /></button>
                        <button onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Eliminar definitivamente el producto "${p.name}"?`)) {
                              fetch(`${API_URL}/products/${p.id}`, { 
                                method: 'DELETE',
                                headers: {
                                  'x-admin-password': adminPassword
                                }
                              }).then(async (res) => {
                                if (res.ok) {
                                  onSave();
                                } else {
                                  const err = await res.json();
                                  alert(err.error || 'Error al eliminar producto.');
                                }
                              }).catch(() => alert('Error de conexión con el servidor.'));
                            }
                          }} className="btn-icon danger" title="Eliminar"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default InventoryManager;
