import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { API_URL } from '../utils/constants';

const UsersManager = ({ config }) => {
  const [users, setUsers] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ username: '', pin: '', role: 'cashier' });

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      if (res.ok) setUsers(await res.json());
    } catch (e) {}
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.pin && !editingId) {
      alert("El PIN es obligatorio para nuevos usuarios.");
      return;
    }
    const url = editingId ? `${API_URL}/users/${editingId}` : `${API_URL}/users`;
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
        setFormData({ username: '', pin: '', role: 'cashier' });
        fetchUsers();
      } else {
        alert("Error al guardar (¿Usuario duplicado?)");
      }
    } catch (err) {}
  };

  const handleEdit = (u) => {
    setEditingId(u.id);
    setFormData({ username: u.username, pin: '', role: u.role });
    setIsFormVisible(true);
  };

  const handleDelete = async (id, username) => {
    if (confirm(`¿Eliminar al usuario "${username}"?`)) {
      const pwd = prompt('Ingrese Contraseña de Administrador para eliminar:');
      if (pwd !== (config.admin_password || '1234')) {
        alert('Contraseña incorrecta. Acción cancelada.');
        return;
      }
      try {
        const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
        if (res.ok) fetchUsers();
      } catch (err) {}
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>Gestión de Personal (Usuarios)</h3>
        {!isFormVisible && (
          <button onClick={() => setIsFormVisible(true)} className="nav-btn active">
            <Plus size={16} /> Nuevo Usuario
          </button>
        )}
      </div>

      {isFormVisible && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', marginBottom: '30px', maxWidth: '600px' }}>
          <h3 style={{ marginBottom: '15px' }}>{editingId ? 'Editar Usuario' : 'Crear Usuario'}</h3>
          
          <div className="form-group">
            <label>Nombre de Usuario</label>
            <input name="username" value={formData.username} onChange={handleChange} required placeholder="Ej: Cajero 1" />
          </div>
          
          <div className="form-group">
            <label>PIN de Acceso (Numérico) {editingId && <span style={{fontSize:'0.8em', color:'var(--text-muted)'}}>(Dejar en blanco para no cambiar)</span>}</label>
            <input type="password" name="pin" value={formData.pin} onChange={handleChange} required={!editingId} placeholder="Ej: 1234" />
          </div>

          <div className="form-group">
            <label>Rol en el Sistema</label>
            <select name="role" value={formData.role} onChange={handleChange} style={{ width: '100%', padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', borderRadius: '8px' }}>
              <option value="cashier">Cajero (Solo ventas)</option>
              <option value="admin">Administrador (Acceso total)</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setIsFormVisible(false); setEditingId(null); setFormData({username:'', pin:'', role:'cashier'}); }} className="checkout-btn-secondary" style={{ width: 'auto', padding: '10px 24px' }}>Cancelar</button>
            <button type="submit" className="checkout-btn" style={{ width: 'auto', padding: '10px 30px' }}>Guardar</button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Fecha de Creación</th>
            <th style={{ textAlign: 'center' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td style={{ fontWeight: 'bold' }}>{u.username}</td>
              <td>
                <span className="status-badge" style={{ background: u.role === 'admin' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.05)', color: u.role === 'admin' ? 'var(--warning-amber)' : 'var(--text-muted)' }}>
                  {u.role === 'admin' ? 'Administrador' : 'Cajero'}
                </span>
              </td>
              <td>{new Date(u.created_at + 'Z').toLocaleString('es-CO')}</td>
              <td>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button onClick={() => handleEdit(u)} className="btn-icon" title="Editar"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(u.id, u.username)} className="btn-icon danger" title="Eliminar"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UsersManager;
