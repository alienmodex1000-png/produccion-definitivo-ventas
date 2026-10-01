import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Check, 
  Clock, 
  AlertCircle, 
  Edit2, 
  Trash2, 
  Search, 
  Calendar, 
  User, 
  Phone, 
  Repeat, 
  Bell, 
  MessageCircle, 
  CheckCircle2, 
  AlertTriangle,
  X,
  Filter,
  RotateCcw
} from 'lucide-react';
import { API_URL, getLocalTodayStr } from '../utils/constants';

const RemindersManager = ({ config = {}, customers: propCustomers = [], isAdmin = false, adminPassword = '' }) => {
  const [reminders, setReminders] = useState([]);
  const [customers, setCustomers] = useState(propCustomers || []);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // all, today, upcoming, overdue, completed
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState(null);

  const initialFormState = {
    title: '',
    description: '',
    customer_name: '',
    customer_phone: '',
    due_date: '',
    due_time: '',
    advance_notice_days: 1,
    recurrence_days: 0
  };

  const [formData, setFormData] = useState(initialFormState);

  const todayStr = getLocalTodayStr();

  const formatTime12h = (timeStr) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const mStr = m < 10 ? `0${m}` : m;
    return `${h12}:${mStr} ${period}`;
  };

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/reminders`);
      if (res.ok) {
        const data = await res.json();
        setReminders(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching reminders:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_URL}/customers`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchReminders();
    fetchCustomers();

    const handleRealtimeEvent = (e) => {
      const eventData = e.detail;
      if (eventData && eventData.type && eventData.type.startsWith('REMINDER')) {
        fetchReminders();
      }
    };

    window.addEventListener('pos-realtime-event', handleRealtimeEvent);
    return () => window.removeEventListener('pos-realtime-event', handleRealtimeEvent);
  }, []);

  const handleCustomerSelect = (name) => {
    const found = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
    setFormData(prev => ({
      ...prev,
      customer_name: name,
      customer_phone: found && found.phone ? found.phone : prev.customer_phone
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'customer_name') {
      handleCustomerSelect(value);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      ...initialFormState,
      due_date: todayStr
    });
    setIsModalOpen(true);
  };

  const handleEdit = (r) => {
    setEditingId(r.id);
    setFormData({
      title: r.title || '',
      description: r.description || '',
      customer_name: r.customer_name || '',
      customer_phone: r.customer_phone || '',
      due_date: r.due_date ? r.due_date.slice(0, 10) : todayStr,
      due_time: r.due_time || '',
      advance_notice_days: r.advance_notice_days !== undefined ? r.advance_notice_days : 1,
      recurrence_days: r.recurrence_days !== undefined ? r.recurrence_days : 0
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId ? `${API_URL}/reminders/${editingId}` : `${API_URL}/reminders`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData(initialFormState);
        fetchReminders();
        showNotification(editingId ? 'Recordatorio actualizado correctamente' : '¡Recordatorio agendado exitosamente!');
      } else {
        alert('Error al guardar el recordatorio');
      }
    } catch (err) {
      alert('Error de conexión al guardar el recordatorio');
    }
  };

  const handleToggleStatus = async (r) => {
    const newStatus = r.status === 'pending' ? 'completed' : 'pending';
    try {
      const res = await fetch(`${API_URL}/reminders/${r.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const data = await res.json();
        fetchReminders();
        if (newStatus === 'completed' && data.nextDueDate) {
          showNotification(`✅ Mantenimiento completado. Próxima cita auto-agendada para el ${data.nextDueDate} (ID #${data.nextReminderId})`);
        } else if (newStatus === 'completed') {
          showNotification('✅ Recordatorio marcado como completado');
        } else {
          showNotification('🔄 Recordatorio reabierto como pendiente');
        }
      }
    } catch (err) {
      alert('Error al cambiar el estado del recordatorio');
    }
  };

  const executeDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/reminders/${id}`, { 
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword || sessionStorage.getItem('pos_admin_token') || ''
        }
      });
      if (res.ok) {
        fetchReminders();
        showNotification('🗑️ Recordatorio eliminado correctamente');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Error al eliminar recordatorio');
      }
    } catch (err) {
      alert('Error al eliminar');
    }
  };

  const handleDeleteClick = (r) => {
    if (!isAdmin) return;
    if (window.confirm(`¿Estás seguro de eliminar el recordatorio "${r.title}"?`)) {
      executeDelete(r.id);
    }
  };

  const showNotification = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4500);
  };

  // Helper calculation
  const getDiffDays = (dueDateStr) => {
    if (!dueDateStr) return 0;
    const [y1, m1, d1] = dueDateStr.slice(0, 10).split('-').map(Number);
    const [y2, m2, d2] = todayStr.slice(0, 10).split('-').map(Number);
    const date1 = new Date(y1, m1 - 1, d1);
    const date2 = new Date(y2, m2 - 1, d2);
    const diffTime = date1.getTime() - date2.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Summary Metrics
  const summary = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    let totalPending = 0;

    reminders.forEach(r => {
      if (r.status === 'pending') {
        totalPending++;
        const diff = getDiffDays(r.due_date);
        if (diff < 0) overdue++;
        else if (diff === 0) today++;
        else if (diff <= 7) upcoming++;
      }
    });

    return { overdue, today, upcoming, totalPending };
  }, [reminders, todayStr]);

  // Filtered List
  const filteredReminders = useMemo(() => {
    return reminders.filter(r => {
      const isPending = r.status === 'pending';
      const diff = getDiffDays(r.due_date);

      // Status tab filter
      if (activeFilter === 'today') {
        if (!isPending || diff !== 0) return false;
      } else if (activeFilter === 'upcoming') {
        if (!isPending || diff <= 0) return false;
      } else if (activeFilter === 'overdue') {
        if (!isPending || diff >= 0) return false;
      } else if (activeFilter === 'completed') {
        if (isPending) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (r.title || '').toLowerCase().includes(q);
        const matchCustomer = (r.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (r.customer_phone || '').toLowerCase().includes(q);
        const matchDesc = (r.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCustomer && !matchPhone && !matchDesc) return false;
      }

      return true;
    });
  }, [reminders, activeFilter, searchQuery, todayStr]);

  const openWhatsApp = (r) => {
    if (!r.customer_phone) return;
    const cleanPhone = r.customer_phone.replace(/\D/g, '');
    const businessName = config.business_name || 'nuestro establecimiento';
    const timeText = r.due_time ? ` a las ${formatTime12h(r.due_time)}` : '';
    const message = encodeURIComponent(
      `Hola ${r.customer_name || 'estimado cliente'}, te saludamos de *${businessName}*.\n\n` +
      `Te recordamos tu servicio / mantenimiento de "*${r.title}*" programado para el día *${r.due_date}*${timeText}.\n` +
      (r.description ? `📝 Observaciones: ${r.description}\n` : '') +
      `\n¡Estaremos atentos para atenderte!`
    );
    window.open(`https://wa.me/57${cleanPhone}?text=${message}`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', gap: '20px', paddingBottom: '30px' }}>
      
      {/* Toast Notificación */}
      {successMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--primary-cyan)',
          color: 'var(--text-bright)',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 9999,
          fontWeight: '600',
          fontSize: '0.9rem'
        }}>
          <CheckCircle2 size={20} color="var(--success-emerald)" />
          {successMessage}
        </div>
      )}

      {/* Cabecera Principal */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: '16px',
        background: 'var(--bg-surface)',
        padding: '20px 24px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-glass)',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: '800', fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-bright)' }}>
            <Bell size={24} color="var(--primary-cyan)" /> Recordatorios y Mantenimientos
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Agenda servicios técnicos, mantenimientos preventivos cíclicos y citas con avisos en pantalla y Telegram.
          </p>
        </div>

        <button 
          onClick={handleOpenCreate} 
          className="checkout-btn" 
          style={{ width: 'auto', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> Nuevo Recordatorio
        </button>
      </div>

      {/* Tarjetas de Métricas de Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        
        {/* Vencidos */}
        <div 
          onClick={() => setActiveFilter('overdue')}
          style={{ 
            background: activeFilter === 'overdue' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-surface)',
            border: '1px solid ' + (activeFilter === 'overdue' ? 'var(--danger-rose)' : 'var(--border-glass)'),
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>VENCIDOS</div>
            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: summary.overdue > 0 ? 'var(--danger-rose)' : 'var(--text-main)', marginTop: '2px' }}>
              {summary.overdue}
            </div>
          </div>
          <AlertCircle size={28} color={summary.overdue > 0 ? 'var(--danger-rose)' : 'var(--text-muted)'} />
        </div>

        {/* Para Hoy */}
        <div 
          onClick={() => setActiveFilter('today')}
          style={{ 
            background: activeFilter === 'today' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-surface)',
            border: '1px solid ' + (activeFilter === 'today' ? 'var(--warning-amber)' : 'var(--border-glass)'),
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>PARA HOY</div>
            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: summary.today > 0 ? 'var(--warning-amber)' : 'var(--text-main)', marginTop: '2px' }}>
              {summary.today}
            </div>
          </div>
          <Clock size={28} color={summary.today > 0 ? 'var(--warning-amber)' : 'var(--text-muted)'} />
        </div>

        {/* Próximos 7 días */}
        <div 
          onClick={() => setActiveFilter('upcoming')}
          style={{ 
            background: activeFilter === 'upcoming' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
            border: '1px solid ' + (activeFilter === 'upcoming' ? 'var(--success-emerald)' : 'var(--border-glass)'),
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>PRÓXIMOS (7 DÍAS)</div>
            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--success-emerald)', marginTop: '2px' }}>
              {summary.upcoming}
            </div>
          </div>
          <Calendar size={28} color="var(--success-emerald)" />
        </div>

        {/* Total Pendientes */}
        <div 
          onClick={() => setActiveFilter('all')}
          style={{ 
            background: activeFilter === 'all' ? 'rgba(14, 165, 233, 0.15)' : 'var(--bg-surface)',
            border: '1px solid ' + (activeFilter === 'all' ? 'var(--primary-cyan)' : 'var(--border-glass)'),
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>TOTAL PENDIENTES</div>
            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--primary-cyan)', marginTop: '2px' }}>
              {summary.totalPending}
            </div>
          </div>
          <Bell size={28} color="var(--primary-cyan)" />
        </div>

      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: '12px',
        background: 'var(--bg-surface)',
        padding: '12px 18px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-glass)'
      }}>
        {/* Chips de Filtro */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            onClick={() => setActiveFilter('all')}
            className={`nav-btn ${activeFilter === 'all' ? 'active' : ''}`}
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            Todos ({reminders.filter(r => r.status === 'pending').length})
          </button>

          <button 
            type="button" 
            onClick={() => setActiveFilter('today')}
            className={`nav-btn ${activeFilter === 'today' ? 'active' : ''}`}
            style={{ 
              padding: '6px 14px', 
              fontSize: '0.82rem',
              color: activeFilter === 'today' ? '#000' : 'var(--warning-amber)',
              background: activeFilter === 'today' ? 'var(--warning-amber)' : 'transparent',
              borderColor: 'var(--warning-amber)'
            }}
          >
            🟡 Hoy ({summary.today})
          </button>

          <button 
            type="button" 
            onClick={() => setActiveFilter('upcoming')}
            className={`nav-btn ${activeFilter === 'upcoming' ? 'active' : ''}`}
            style={{ 
              padding: '6px 14px', 
              fontSize: '0.82rem',
              color: activeFilter === 'upcoming' ? '#000' : 'var(--success-emerald)',
              background: activeFilter === 'upcoming' ? 'var(--success-emerald)' : 'transparent',
              borderColor: 'var(--success-emerald)'
            }}
          >
            🟢 Próximos ({summary.upcoming})
          </button>

          <button 
            type="button" 
            onClick={() => setActiveFilter('overdue')}
            className={`nav-btn ${activeFilter === 'overdue' ? 'active' : ''}`}
            style={{ 
              padding: '6px 14px', 
              fontSize: '0.82rem',
              color: activeFilter === 'overdue' ? '#fff' : 'var(--danger-rose)',
              background: activeFilter === 'overdue' ? 'var(--danger-rose)' : 'transparent',
              borderColor: 'var(--danger-rose)'
            }}
          >
            🚨 Vencidos ({summary.overdue})
          </button>

          <button 
            type="button" 
            onClick={() => setActiveFilter('completed')}
            className={`nav-btn ${activeFilter === 'completed' ? 'active' : ''}`}
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            ✔️ Completados ({reminders.filter(r => r.status === 'completed').length})
          </button>
        </div>

        {/* Buscador */}
        <div style={{ position: 'relative', minWidth: '260px', flex: '1 1 260px', maxWidth: '400px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            placeholder="Buscar por tarea, cliente o teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px', height: '36px', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Cuadrícula de Tarjetas de Recordatorios */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando recordatorios...</div>
      ) : filteredReminders.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px', 
          background: 'var(--bg-surface)', 
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid var(--border-glass)',
          color: 'var(--text-muted)'
        }}>
          <Bell size={42} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <h4 style={{ color: 'var(--text-main)', margin: '0 0 6px 0' }}>No hay recordatorios en esta sección</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            {searchQuery ? 'Ningún registro coincide con la búsqueda.' : 'Crea una nueva alerta o mantenimiento para empezar a organizarte.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredReminders.map(r => {
            const isPending = r.status === 'pending';
            const diffDays = getDiffDays(r.due_date);
            const isOverdue = isPending && diffDays < 0;
            const isToday = isPending && diffDays === 0;
            const isUpcoming = isPending && diffDays > 0;

            let cardBorder = 'var(--border-glass)';
            let statusBadge = null;

            if (!isPending) {
              cardBorder = 'rgba(255, 255, 255, 0.08)';
              statusBadge = (
                <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success-emerald)', padding: '2px 8px', borderRadius: '12px', fontWeight: '800' }}>
                  ✔️ COMPLETADO
                </span>
              );
            } else if (isOverdue) {
              cardBorder = 'rgba(239, 68, 68, 0.4)';
              statusBadge = (
                <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.18)', color: 'var(--danger-rose)', padding: '2px 8px', borderRadius: '12px', fontWeight: '800' }}>
                  🚨 VENCIDO (HACE {Math.abs(diffDays)} DÍAS)
                </span>
              );
            } else if (isToday) {
              cardBorder = 'rgba(245, 158, 11, 0.45)';
              statusBadge = (
                <span style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning-amber)', padding: '2px 8px', borderRadius: '12px', fontWeight: '800' }}>
                  🔔 HOY
                </span>
              );
            } else {
              cardBorder = 'rgba(14, 165, 233, 0.3)';
              statusBadge = (
                <span style={{ fontSize: '0.72rem', background: 'rgba(14, 165, 233, 0.15)', color: 'var(--primary-cyan)', padding: '2px 8px', borderRadius: '12px', fontWeight: '800' }}>
                  🟢 EN {diffDays} DÍAS
                </span>
              );
            }

            return (
              <div 
                key={r.id} 
                style={{ 
                  background: 'var(--bg-surface)', 
                  border: `1px solid ${cardBorder}`, 
                  borderRadius: 'var(--radius-lg)', 
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: 'var(--shadow-card)',
                  opacity: !isPending ? 0.65 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Cabecera Tarjeta: Estado + Acciones */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '800' }}>#{r.id}</span>
                    {statusBadge}
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => handleEdit(r)} className="btn-icon" title="Editar recordatorio">
                      <Edit2 size={15} color="var(--primary-cyan)" />
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDeleteClick(r)} className="btn-icon danger" title="Eliminar recordatorio (Exclusivo Administrador)">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Título de la Tarea */}
                <div>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '1.05rem', 
                    fontWeight: '800', 
                    color: 'var(--text-bright)',
                    textDecoration: !isPending ? 'line-through' : 'none'
                  }}>
                    {r.title}
                  </h3>
                </div>

                {/* Cliente y Contacto */}
                <div style={{ 
                  background: 'var(--bg-card)', 
                  padding: '10px 12px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <User size={16} color="var(--primary-cyan)" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.customer_name || 'General / Sin cliente'}
                      </div>
                      {r.customer_phone && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          📞 {r.customer_phone}
                        </div>
                      )}
                    </div>
                  </div>

                  {r.customer_phone && (
                    <button
                      type="button"
                      onClick={() => openWhatsApp(r)}
                      title="Enviar recordatorio por WhatsApp"
                      style={{
                        background: 'rgba(37, 211, 102, 0.15)',
                        color: '#25D366',
                        border: '1px solid rgba(37, 211, 102, 0.35)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                  )}
                </div>

                {/* Notas o Especificaciones Técnicas */}
                {r.description && (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {r.description}
                  </p>
                )}

                {/* Insignias de Configuración (Fecha, Hora, Aviso Previo, Recurrencia) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 'auto', paddingTop: '8px', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '0.78rem', 
                    fontWeight: '700', 
                    color: isOverdue ? 'var(--danger-rose)' : isToday ? 'var(--warning-amber)' : 'var(--text-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Calendar size={14} /> {r.due_date}
                  </span>

                  {r.due_time && (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: '800', 
                      background: 'rgba(14, 165, 233, 0.12)', 
                      color: 'var(--primary-cyan)', 
                      padding: '3px 8px', 
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid rgba(14, 165, 233, 0.25)'
                    }}>
                      <Clock size={12} /> {formatTime12h(r.due_time)}
                    </span>
                  )}

                  {r.advance_notice_days !== undefined && r.advance_notice_days !== null && (
                    <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '6px' }}>
                      ⏰ Aviso {r.advance_notice_days === 0 ? 'el mismo día' : `${r.advance_notice_days}d antes`}
                    </span>
                  )}

                  {r.recurrence_days > 0 && (
                    <span style={{ fontSize: '0.72rem', background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', padding: '2px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Repeat size={11} /> Cada {r.recurrence_days} días
                    </span>
                  )}
                </div>

                {/* Botón de Acción Principal (Completar / Reabrir) */}
                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(r)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.82rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: isPending ? 'var(--success-emerald)' : 'var(--bg-card)',
                      color: isPending ? '#000000' : 'var(--text-main)',
                      border: isPending ? 'none' : '1px solid var(--border-glass)'
                    }}
                  >
                    {isPending ? (
                      <>
                        <Check size={16} /> Marcar como Completado
                      </>
                    ) : (
                      <>
                        <RotateCcw size={16} /> Reabrir Alerta
                      </>
                    )}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Recordatorio */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '620px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: 'var(--shadow-premium)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={20} color="var(--primary-cyan)" />
                {editingId ? 'Editar Recordatorio / Mantenimiento' : 'Agendar Nuevo Recordatorio'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="btn-icon"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Título */}
              <div className="form-group">
                <label style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Tarea, Servicio o Motivo *
                </label>
                <input 
                  type="text" 
                  name="title" 
                  value={formData.title} 
                  onChange={handleChange} 
                  required 
                  placeholder="Ej: Mantenimiento Preventivo, Cambio de Aceite, Revisión de Filtros..."
                  autoFocus
                />
              </div>

              {/* Cliente y Teléfono */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Cliente o Referencia
                  </label>
                  <input 
                    type="text" 
                    name="customer_name" 
                    list="reminders-customers-list"
                    value={formData.customer_name} 
                    onChange={handleChange} 
                    placeholder="Nombre del cliente..."
                  />
                  <datalist id="reminders-customers-list">
                    {customers.map(c => (
                      <option key={c.id} value={c.name}>{c.phone ? `(${c.phone})` : ''}</option>
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Teléfono / WhatsApp
                  </label>
                  <input 
                    type="text" 
                    name="customer_phone" 
                    value={formData.customer_phone} 
                    onChange={handleChange} 
                    placeholder="Ej: 3001234567"
                  />
                </div>
              </div>

              {/* Fecha Programada, Hora Exacta y Aviso Previo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Fecha Programada *
                  </label>
                  <input 
                    type="date" 
                    name="due_date" 
                    value={formData.due_date} 
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} color="var(--primary-cyan)" /> Hora (Opcional)
                  </label>
                  <input 
                    type="time" 
                    name="due_time" 
                    value={formData.due_time || ''} 
                    onChange={handleChange} 
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Aviso Previo
                  </label>
                  <select 
                    name="advance_notice_days" 
                    value={formData.advance_notice_days} 
                    onChange={handleChange}
                  >
                    <option value="0">El mismo día</option>
                    <option value="1">1 día antes</option>
                    <option value="2">2 días antes</option>
                    <option value="3">3 días antes</option>
                    <option value="7">7 días antes (1 sem.)</option>
                    <option value="15">15 días antes (2 sem.)</option>
                  </select>
                </div>
              </div>

              {/* Recurrencia Automática */}
              <div className="form-group" style={{ 
                background: 'rgba(168, 85, 247, 0.05)', 
                border: '1px solid rgba(168, 85, 247, 0.25)', 
                padding: '12px 14px', 
                borderRadius: 'var(--radius-md)' 
              }}>
                <label style={{ fontWeight: '700', color: '#c084fc', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Repeat size={14} /> Recurrencia Automática (Citas Periódicas)
                </label>
                <select 
                  name="recurrence_days" 
                  value={formData.recurrence_days} 
                  onChange={handleChange}
                  style={{ marginTop: '4px' }}
                >
                  <option value="0">No recurrente (Única vez)</option>
                  <option value="15">Cada 15 días (Quincenal)</option>
                  <option value="30">Cada 30 días (Mensual)</option>
                  <option value="60">Cada 60 días (Bimestral)</option>
                  <option value="90">Cada 90 días (Trimestral)</option>
                  <option value="180">Cada 180 días (Semestral)</option>
                  <option value="365">Cada 365 días (Anual)</option>
                </select>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Al completar este servicio, el sistema agendará automáticamente la siguiente cita sumando los días elegidos.
                </p>
              </div>

              {/* Descripción / Notas */}
              <div className="form-group">
                <label style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Notas Adicionales / Especificaciones Técnicas
                </label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleChange} 
                  rows={3} 
                  placeholder="Detalles sobre repuestos requeridos, modelo del equipo, observaciones..."
                  style={{ 
                    width: '100%', 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border-glass)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '10px', 
                    color: 'var(--text-bright)',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="checkout-btn-secondary" 
                  style={{ width: 'auto', padding: '10px 22px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="checkout-btn" 
                  style={{ width: 'auto', padding: '10px 28px' }}
                >
                  {editingId ? 'Guardar Cambios' : 'Agendar Recordatorio'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default RemindersManager;

