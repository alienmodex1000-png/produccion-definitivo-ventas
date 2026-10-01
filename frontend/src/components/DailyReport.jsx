import React, { useState, useEffect } from 'react';
import PrintableDailyTicket from './PrintableDailyTicket';
import { printThermalElement } from '../utils/printHelper';
import { API_URL, getLocalTodayStr } from '../utils/constants';
import { Printer, Search, Package, DollarSign, TrendingUp, AlertTriangle, BarChart2 } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, LabelList,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#0ea5e9', '#10b981', '#ec4899', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#64748b'];

const DailyReport = ({ config, dates, products = [] }) => {
  const [report, setReport] = useState(null);
  const [advanced, setAdvanced] = useState(null);
  const [startDate, setStartDate] = useState(() => getLocalTodayStr());
  const [endDate, setEndDate] = useState(() => getLocalTodayStr());
  
  // X-Ray Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productStats, setProductStats] = useState(null);

  const fetchReport = () => {
    setReport(null);
    setAdvanced(null);
    
    // Fetch Totals
    fetch(`${API_URL}/reports/daily?startDate=${startDate}&endDate=${endDate}`)
      .then(res => res.json())
      .then(data => setReport(data));
      
    // Fetch Advanced Chart Data
    fetch(`${API_URL}/reports/advanced?startDate=${startDate}&endDate=${endDate}`)
      .then(res => res.json())
      .then(data => setAdvanced(data));
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const [isSendingPdf, setIsSendingPdf] = useState(false);

  const handleSendToTelegram = async () => {
    setIsSendingPdf(true);
    try {
      const element = document.getElementById('printable-report');
      // Forzar fondo blanco
      element.style.background = '#ffffff';
      
      const opt = {
        margin:       10,
        filename:     'Reporte_Caja.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: 'avoid-all' }
      };

      const pdfBase64 = await window.html2pdf().set(opt).from(element).outputPdf('datauristring');
      
      // Restaurar fondo original
      element.style.background = '';

      const res = await fetch(`${API_URL}/telegram/send-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data: pdfBase64, dateString: new Date().toLocaleString() })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert('✅ ¡PDF enviado a Telegram exitosamente!');
      } else {
        alert('❌ Error: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('Error al generar o enviar el PDF.');
    } finally {
      setIsSendingPdf(false);
    }
  };

  const handlePrint = () => {
    printThermalElement('printable-daily-ticket', {
      ticketWidth: config?.ticket_width || '58mm',
      title: 'Reporte_Diario'
    });
  };

  // Handle Product X-Ray Search
  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setSearchTerm(''); // clear search
    
    fetch(`${API_URL}/reports/product/${product.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
           setProductStats(data);
        }
      });
  };

  const filteredProducts = searchTerm 
    ? products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode === searchTerm)
    : [];

  if (!report || !advanced) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Generando reporte financiero avanzado...</div>;

  if (report.error || advanced.error) {
    return (
      <div style={{ padding: '24px', color: 'var(--danger-rose)', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-glass)', margin: '20px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>⚠️ No se pudo generar el reporte financiero</h3>
        <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>{report?.error || advanced?.error || 'Verifique la conexión o el rango de fechas seleccionado.'}</p>
        <button onClick={fetchReport} className="nav-btn active" style={{ marginTop: '16px', background: 'var(--primary-cyan)', color: '#000' }}>Reintentar Consulta</button>
      </div>
    );
  }

  const safeNum = (v) => Number(v) || 0;

  return (
    <div id="printable-report" className="print-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', height: '100%', paddingBottom: '30px' }}>
      <style>{`

        .metric-card {
            background: var(--bg-surface);
            border: 1px solid var(--border-glass);
            border-radius: var(--radius-md);
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 16px;
            animation: fadeInUp 0.4s ease-out;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .xray-input {
            background: var(--bg-surface);
            color: var(--text-bright);
            border: 2px solid var(--primary-cyan);
        }
        .xray-input:focus {
            box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.2);
            outline: none;
        }
      `}</style>

      {/* FILTROS DE FECHA */}
      <div className="no-print" style={{ display: 'flex', gap: '15px', padding: '16px 20px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', alignItems: 'center', flexWrap: 'wrap', boxShadow: 'var(--shadow-premium)' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <span style={{ fontWeight: '800', color: 'var(--warning-amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📅 Rango de Fechas:
            </span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="app-input" 
              style={{ minWidth: '150px' }}
            />
            <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>hasta</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="app-input" 
              style={{ minWidth: '150px' }}
            />
            <button 
              type="button"
              onClick={fetchReport} 
              className="nav-btn active" 
              style={{ background: 'var(--warning-amber)', color: '#000', padding: '9px 18px', borderRadius: '8px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '0.88rem', boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)' }}
            >
              <BarChart2 size={17} /> Consultar Reporte
            </button>
            <button 
              type="button"
              onClick={handlePrint} 
              style={{ background: 'var(--primary-cyan)', color: '#000', padding: '9px 18px', borderRadius: '8px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '0.88rem', boxShadow: '0 2px 8px rgba(14, 165, 233, 0.25)' }}
            >
              <Printer size={17} /> Imprimir Reporte
            </button>
            <button 
              type="button"
              onClick={handleSendToTelegram} 
              disabled={isSendingPdf}
              style={{ background: '#0088cc', color: '#fff', padding: '9px 18px', borderRadius: '8px', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '0.88rem', boxShadow: '0 2px 8px rgba(0, 136, 204, 0.25)' }}
            >
              <span style={{ fontSize: '1.1rem' }}>✈️</span> {isSendingPdf ? 'Enviando...' : 'Enviar PDF a Telegram'}
            </button>
        </div>
      </div>

      <h1 style={{ display: 'none' }} className="print-header">Reporte Financiero de Negocio <br/><small style={{ fontSize: '1rem', color: '#666' }}>Del {startDate} al {endDate}</small></h1>

      {/* TARJETAS GLOBALES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700' }}>INGRESOS VENTAS DEL DÍA</span>
          <h2 style={{ fontSize: '1.7rem', fontWeight: '800', marginTop: '10px', color: 'var(--text-bright)' }}>
            ${safeNum(report.total_sales).toLocaleString('es-CO')}
          </h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Efectivo: ${safeNum(report.total_cash).toLocaleString('es-CO')} | Transf: ${safeNum(report.total_transfer).toLocaleString('es-CO')}
          </div>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid #10b981', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '700' }}>💳 RECAUDO CARTERA (ABONOS)</span>
          <h2 style={{ fontSize: '1.7rem', fontWeight: '800', marginTop: '10px', color: '#10b981' }}>
            +${safeNum(report.total_collected_debts).toLocaleString('es-CO')}
          </h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Efec: ${safeNum(report.collected_debts_cash).toLocaleString('es-CO')} | Transf: ${safeNum(report.collected_debts_transfer).toLocaleString('es-CO')}
          </div>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--primary-cyan)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary-cyan)', fontWeight: '700' }}>💰 TOTAL RECAUDADO EN CAJA</span>
          <h2 style={{ fontSize: '1.7rem', fontWeight: '800', marginTop: '10px', color: 'var(--primary-cyan)' }}>
            ${(safeNum(report.total_sales) + safeNum(report.total_collected_debts)).toLocaleString('es-CO')}
          </h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Efec Total: ${(safeNum(report.total_cash) + safeNum(report.collected_debts_cash)).toLocaleString('es-CO')} | Transf Total: ${(safeNum(report.total_transfer) + safeNum(report.collected_debts_transfer)).toLocaleString('es-CO')}
          </div>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--warning-amber)', fontWeight: '700' }}>FIADOS PENDIENTES (POR COBRAR)</span>
          <h2 style={{ fontSize: '1.7rem', fontWeight: '800', marginTop: '10px', color: 'var(--warning-amber)' }}>
            +${safeNum(report.total_debts).toLocaleString('es-CO')}
          </h2>
        </div>
        <div style={{ background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--danger-rose)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--danger-rose)', fontWeight: '800' }}>GASTOS EXTRA (SALIDAS)</span>
          <h2 style={{ fontSize: '1.7rem', fontWeight: '800', marginTop: '10px', color: 'var(--danger-rose)' }}>
            -${safeNum(report.total_expenses).toLocaleString('es-CO')}
          </h2>
        </div>
        {config.enable_profit_tracking !== 'false' && (
        <div style={{ background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--primary-cyan)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary-cyan)', fontWeight: '800' }}>CAPITAL DE REINVERSIÓN</span>
          <h2 style={{ fontSize: '1.7rem', fontWeight: '800', marginTop: '10px', color: 'var(--primary-cyan)' }}>
            ${safeNum(report.total_reinvestment).toLocaleString('es-CO')}
          </h2>
        </div>
        )}
        {config.enable_profit_tracking !== 'false' && (
        <div style={{ background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--success-emerald)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--success-emerald)', fontWeight: '800' }}>GANANCIA REAL DISPONIBLE</span>
          <h2 style={{ fontSize: '1.7rem', fontWeight: '800', marginTop: '10px', color: 'var(--success-emerald)' }}>
            ${safeNum(report.net_utility).toLocaleString('es-CO')}
          </h2>
        </div>
        )}
        {config.enable_profit_tracking === 'false' && (
        <div style={{ background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--primary-cyan)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary-cyan)', fontWeight: '800' }}>BALANCE FINAL (CAJA - GASTOS)</span>
          <h2 style={{ fontSize: '1.7rem', fontWeight: '800', marginTop: '10px', color: 'var(--primary-cyan)' }}>
            ${(safeNum(report.total_sales) - safeNum(report.total_expenses)).toLocaleString('es-CO')}
          </h2>
        </div>
        )}
      </div>

      {/* ─── DESGLOSE POR LÍNEA DE NEGOCIO ─── */}
      {report.breakdown_by_line && report.breakdown_by_line.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid #a855f7', marginBottom: '24px', boxShadow: '0 4px 20px rgba(168,85,247,0.1)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#a855f7', marginBottom: '16px' }}>
            🏪 Desglose por Línea de Negocio y Top 5 Productos
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {report.breakdown_by_line.map((line, idx) => (
              <div key={idx} style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{idx === 0 ? '🏠' : '🍽️'}</span>
                  <span style={{ fontWeight: '800', color: '#a855f7', fontSize: '0.95rem' }}>{line.name}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ventas cobradas:</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--success-emerald)' }}>${line.total_sales.toLocaleString('es-CO')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Transacciones:</span>
                    <span style={{ fontWeight: 'bold' }}>{line.transaction_count}</span>
                  </div>
                  {line.total_debts > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Fiados:</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--warning-amber)' }}>${line.total_debts.toLocaleString('es-CO')}</span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid rgba(168,85,247,0.2)', paddingTop: '6px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>% del total:</span>
                    <span style={{ fontWeight: 'bold', color: '#a855f7' }}>
                      {report.total_sales > 0 ? Math.round((line.total_sales / report.total_sales) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* --- TOP 5 PRODUCTOS DE LA LÍNEA --- */}
                {advanced && advanced.business_lines_top5 && advanced.business_lines_top5[line.name] && advanced.business_lines_top5[line.name].length > 0 && (
                  <div style={{ borderTop: '1px dashed rgba(168,85,247,0.3)', paddingTop: '12px', marginTop: '12px' }}>
                    <h4 style={{ fontSize: '0.85rem', color: '#c084fc', marginBottom: '8px', fontWeight: 'bold' }}>🔥 Top 5 más vendidos</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {advanced.business_lines_top5[line.name].map((prod, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '4px' }}>
                          <span style={{ color: 'var(--text-bright)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '8px' }}>
                            {i + 1}. {prod.name}
                          </span>
                          <div style={{ display: 'flex', gap: '10px', textAlign: 'right' }}>
                            <span style={{ color: 'var(--primary-cyan)' }}>{prod.quantity} <small>und</small></span>
                            <span style={{ color: 'var(--success-emerald)', fontWeight: 'bold', minWidth: '60px' }}>${prod.total_sold.toLocaleString('es-CO')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DASHBOARD GRÁFICOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px' }}>
        
        {/* Gráfico A: Evolución Diaria */}
        <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', minHeight: '350px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-bright)', marginBottom: '16px' }}>Evolución Diaria (Ingresos vs Gastos)</h3>
          {advanced.daily_evolution && advanced.daily_evolution.length > 0 ? (
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={advanced.daily_evolution} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.1)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" className="chart-text" />
                <YAxis stroke="var(--text-muted)" className="chart-text" />
                <RechartsTooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '8px', color: 'var(--text-bright)' }} />
                <Legend />
                <Line type="monotone" dataKey="income" name="Ingresos ($)" stroke="var(--success-emerald)" activeDot={{ r: 8 }} strokeWidth={3}><LabelList dataKey="income" position="top" formatter={(value) => value > 0 ? `${Number(value).toLocaleString()}` : ""} className="chart-text" fontSize={11} /></Line>
                <Line type="monotone" dataKey="expenses" name="Gastos ($)" stroke="var(--danger-rose)" strokeWidth={3}><LabelList dataKey="expenses" position="bottom" formatter={(value) => value > 0 ? `${Number(value).toLocaleString()}` : ""} className="chart-text" fontSize={11} /></Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
          ) : (
             <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No hay datos para este rango de fechas.</div>
          )}
        </div>

        {/* Gráfico B: Dona Top Productos */}
        <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', minHeight: '350px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-bright)', marginBottom: '16px' }}>Top Ventas por Producto</h3>
          {advanced.donut_products && advanced.donut_products.length > 0 ? (
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={advanced.donut_products || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  className="chart-text"
                  label={(props) => {
                    const RADIAN = Math.PI / 180;
                    const radius = 80 * 1.2;
                    const x = props.cx + radius * Math.cos(-props.midAngle * RADIAN);
                    const y = props.cy + radius * Math.sin(-props.midAngle * RADIAN);
                    return (
                      <text x={x} y={y} fill={props.fill} textAnchor={x > props.cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} className="chart-text">
                        <tspan x={x} dy="-0.6em">{props.name.length > 18 ? props.name.substring(0,18) + '.' : props.name}</tspan>
                        <tspan x={x} dy="1.2em" fontWeight="bold">${Number(props.value).toLocaleString()}</tspan>
                      </text>
                    );
                  }}
                  labelLine={false}
                >
                  {(advanced.donut_products || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'Otros' ? '#94a3b8' : COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => `$${value.toLocaleString()}`} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--primary-cyan)', borderRadius: '8px', color: 'var(--text-bright)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          ) : (
            <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No hay ventas registradas.</div>
          )}
        </div>

        {/* Gráfico C: Categorías */}
        <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', minHeight: '350px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-bright)', marginBottom: '16px' }}>Rendimiento por Categoría</h3>
            {advanced.categories && advanced.categories.length > 0 ? (
            <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={advanced.categories} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.1)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" className="chart-text" />
                    <YAxis stroke="var(--text-muted)" className="chart-text" />
                    <RechartsTooltip formatter={(value) => `$${value.toLocaleString()}`} contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '8px', color: 'var(--text-bright)' }} />
                    <Bar dataKey="total_sold" name="Ingresos por Categoría ($)" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="total_sold" position="top" formatter={(value) => `$${Number(value).toLocaleString()}`} className="chart-text" fontSize={11} />
                        {advanced.categories.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
                </ResponsiveContainer>
            </div>
            ) : (
                <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No hay ventas por categoría.</div>
            )}
        </div>

      </div>

      {/* BUSCADOR DE RAYOS X (PRODUCTO ESPECÍFICO) AL FINAL PARA MAYOR ENFOQUE */}
      <div className="no-print" style={{ background: 'var(--bg-surface)', padding: '32px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', marginTop: '10px' }}>
        <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary-cyan)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Search size={24} /> Análisis de Rayos X: Búsqueda de Métricas por Producto
        </h3>
        
        <div style={{ position: 'relative', width: '100%', maxWidth: '600px', marginBottom: '30px' }}>
            <input
                type="text"
                placeholder="Escribe el nombre o código de barras del producto a inspeccionar..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="app-input xray-input"
                style={{ width: '100%', padding: '16px 20px', fontSize: '1.1rem', borderRadius: '8px' }}
            />
            {filteredProducts.length > 0 && (
                <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-surface)', listStyle: 'none', padding: 0, margin: 0, zIndex: 10, borderRadius: '8px', border: '1px solid var(--primary-cyan)', maxHeight: '250px', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    {filteredProducts.map(p => (
                        <li key={p.id} onClick={() => handleProductSelect(p)} style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 'bold', color: 'var(--text-bright)' }}>{p.name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stock: {p.stock} | Categoría: {p.category || 'N/A'}</div>
                        </li>
                    ))}
                </ul>
            )}
        </div>

        {selectedProduct && productStats && (
            <div style={{ marginTop: '20px', borderTop: '2px dashed var(--border-glass)', paddingTop: '30px' }}>
                <h4 style={{ fontSize: '1.5rem', color: 'var(--text-bright)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Package size={24} color="var(--text-muted)"/> Rendimiento Histórico: <span style={{color: 'var(--primary-cyan)'}}>{selectedProduct.name}</span>
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                    <div className="metric-card">
                        <div style={{ background: 'rgba(14, 165, 233, 0.1)', padding: '12px', borderRadius: '50%' }}>
                            <Package size={32} color="var(--primary-cyan)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Unidades Vendidas</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-bright)' }}>{productStats.stats.total_units || 0}</div>
                        </div>
                    </div>
                    <div className="metric-card">
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '50%' }}>
                            <DollarSign size={32} color="var(--success-emerald)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Ingresos Brutos</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-bright)' }}>${(productStats.stats.total_revenue || 0).toLocaleString('es-CO')}</div>
                        </div>
                    </div>
                    {config.enable_profit_tracking !== 'false' && (
                    <div className="metric-card">
                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '50%' }}>
                            <TrendingUp size={32} color="var(--warning-amber)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Utilidad Neta (Ganancia)</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--text-bright)' }}>${(productStats.stats.total_profit || 0).toLocaleString('es-CO')}</div>
                        </div>
                    </div>
                    )}
                    <div className="metric-card" style={{ border: selectedProduct.stock <= (selectedProduct.min_stock || 5) ? '2px solid var(--danger-rose)' : '1px solid var(--border-glass)' }}>
                        <div style={{ background: selectedProduct.stock <= (selectedProduct.min_stock || 5) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(100, 116, 139, 0.1)', padding: '12px', borderRadius: '50%' }}>
                            <AlertTriangle size={32} color={selectedProduct.stock <= (selectedProduct.min_stock || 5) ? 'var(--danger-rose)' : 'var(--text-muted)'} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Stock Actual</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: selectedProduct.stock <= (selectedProduct.min_stock || 5) ? 'var(--danger-rose)' : 'var(--text-bright)' }}>
                                {selectedProduct.stock}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ height: '250px', background: 'var(--bg-surface)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
                    <h5 style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '1rem' }}>Tendencia de Ventas (Últimos 7 días)</h5>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={productStats.trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.1)" />
                            <XAxis dataKey="date" stroke="var(--text-muted)" tick={{fontSize: 12}} />
                            <YAxis stroke="var(--text-muted)" tick={{fontSize: 12}} allowDecimals={false} />
                            <RechartsTooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: '8px', color: 'var(--text-bright)' }} />
                            <Line type="monotone" dataKey="units" name="Unidades Vendidas" stroke="var(--primary-cyan)" strokeWidth={4} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}
      </div>
      
      <div style={{ display: 'none' }}>
        <PrintableDailyTicket 
          report={report} 
          startDate={startDate} 
          endDate={endDate} 
          config={config} 
        />
      </div>

    </div>
  );
};

export default DailyReport;
