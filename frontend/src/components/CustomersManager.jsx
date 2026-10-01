import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';
import { API_URL, exportToPDF } from '../utils/constants';

const CustomersManager = ({ config }) => {
  const [customers, setCustomers] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_URL}/customers`);
      if (res.ok) setCustomers(await res.json());
    } catch (e) {}
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId ? `${API_URL}/customers/${editingId}` : `${API_URL}/customers`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsFormVisible(false);
        setEditingId(null);
        setFormData({ name: '', phone: '', email: '', address: '' });
        fetchCustomers();
      }
    } catch (err) {}
  };

  const handleEdit = (c) => {
    setEditingId(c.id);
    setFormData({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '' });
    setIsFormVisible(true);
  };

  const handleDelete = async (id, name) => {
    if (confirm(`¿Eliminar al cliente "${name}"?`)) {
      const pwd = prompt('Ingrese Contraseña de Administrador para eliminar:');
      if (pwd !== (config.admin_password || '1234')) {
        alert('Contraseña incorrecta. Acción cancelada.');
        return;
      }
      try {
        const res = await fetch(`${API_URL}/customers/${id}`, { method: 'DELETE' });
        if (res.ok) fetchCustomers();
      } catch (err) {}
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Directorio de Clientes (CRM)</h3>
        {!isFormVisible && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => exportToPDF(customers, 'Clientes', [
              { label: 'ID', key: 'id' },
              { label: 'Nombre', key: 'name' },
              { label: 'Teléfono', key: 'phone' },
              { label: 'Email', key: 'email' },
              { label: 'Dirección', key: 'address' }
            ], config)} className="nav-btn" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }}>
              Exportar (PDF)
            </button>
            <button onClick={() => setIsFormVisible(true)} className="nav-btn active">
              <Plus size={16} /> Nuevo Cliente
            </button>
          </div>
        )}
      </div>

      {isFormVisible && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '15px' }}>{editingId ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}</h3>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '2 1 200px' }}>
              <label>Nombre Completo *</label>
              <input name="name" value={formData.name} onChange={handleChange} required placeholder="Ej: Juan Pérez" />
            </div>
            <div className="form-group" style={{ flex: '1 1 150px' }}>
              <label>Teléfono</label>
              <input name="phone" value={formData.phone} onChange={handleChange} placeholder="Opcional" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px' }}>
            <div className="form-group" style={{ flex: '1 1 200px' }}>
              <label>Correo Electrónico</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Opcional" />
            </div>
            <div className="form-group" style={{ flex: '2 1 250px' }}>
              <label>Dirección</label>
              <input name="address" value={formData.address} onChange={handleChange} placeholder="Opcional" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setIsFormVisible(false); setEditingId(null); setFormData({name:'', phone:'', email:'', address:''}); }} className="checkout-btn-secondary" style={{ width: 'auto', padding: '10px 24px' }}>Cancelar</button>
            <button type="submit" className="checkout-btn" style={{ width: 'auto', padding: '10px 30px' }}>Guardar</button>
          </div>
        </form>
      )}


      {!isFormVisible && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '12px 16px 12px 38px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', background: 'var(--bg-surface)', color: 'var(--text-main)', width: '100%', fontSize: '0.9rem', outline: 'none' }}
          />
          {searchQuery && <X size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
        </div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Email</th>
            <th>Dirección</th>
            <th style={{ textAlign: 'center' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {customers.filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.phone && c.phone.includes(searchQuery)) || (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))).map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 'bold' }}>{c.name}</td>
              <td>{c.phone || '-'}</td>
              <td>{c.email || '-'}</td>
              <td>{c.address || '-'}</td>
              <td>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button onClick={() => handleEdit(c)} className="btn-icon" title="Editar"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(c.id, c.name)} className="btn-icon danger" title="Eliminar"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No hay clientes registrados</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CustomersManager;
