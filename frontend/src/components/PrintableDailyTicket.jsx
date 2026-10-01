import React from 'react';
import { formatCOP } from '../utils/currency';

const PrintableDailyTicket = ({ report, startDate, endDate, config }) => {
  if (!report) return null;

  const formatDate = (dateStr) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const now = new Date();

  return (
    <div id="printable-daily-ticket">
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '15px', margin: '0 0 3px 0', fontWeight: 'bold' }}>{config?.business_name || 'Mi Negocio'}</h2>
        {config?.business_nit && <p style={{ fontSize: '10px', margin: '1px 0' }}>NIT/RUT: {config.business_nit}</p>}
        <p style={{ fontSize: '11px', margin: '1px 0' }}>{config?.business_address || ''}</p>
        <p style={{ fontSize: '11px', margin: '1px 0' }}>{config?.business_phone || ''}</p>
        <br />
        <h3 style={{ fontSize: '14px', margin: '0' }}>REPORTE DIARIO DE CAJA</h3>
        <p style={{ fontSize: '12px', margin: '0' }}>Del: {formatDate(startDate)}</p>
        <p style={{ fontSize: '12px', margin: '0' }}>Al:  {formatDate(endDate)}</p>
        <p style={{ fontSize: '10px', margin: '5px 0 0 0' }}>Impreso: {now.toLocaleDateString('es-CO')} {now.toLocaleTimeString('es-CO')}</p>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>

      <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span>Ventas Totales:</span>
        <span style={{ fontWeight: 'bold' }}>{formatCOP(report.total_sales || 0, true)}</span>
      </div>
      <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', marginBottom: '2px', paddingLeft: '10px' }}>
        <span>- Efectivo:</span>
        <span>{formatCOP(report.total_cash || 0, true)}</span>
      </div>
      <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', marginBottom: '2px', paddingLeft: '10px' }}>
        <span>- Transf/Otros:</span>
        <span>{formatCOP(report.total_transfer || 0, true)}</span>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>

      <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span>Fiados (Cartera):</span>
        <span style={{ fontWeight: 'bold' }}>+{formatCOP(report.total_debts || 0, true)}</span>
      </div>
      <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span>Gastos Extra:</span>
        <span style={{ fontWeight: 'bold' }}>-{formatCOP(report.total_expenses || 0, true)}</span>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>

      {config?.enable_profit_tracking !== 'false' && (
      <>
      <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span>Capital Reinv:</span>
        <span>{formatCOP(report.total_sales + report.total_debts - (report.total_profit || 0), true)}</span>
      </div>
      
      <div style={{ fontSize: '14px', display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontWeight: 'bold' }}>
        <span>Ganancia Real:</span>
        <span>{formatCOP(report.net_profit || 0, true)}</span>
      </div>
      </>
      )}
      {config?.enable_profit_tracking === 'false' && (
      <div style={{ fontSize: '14px', display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontWeight: 'bold' }}>
        <span>Balance Caja Neto:</span>
        <span>{formatCOP(report.total_sales - report.total_expenses, true)}</span>
      </div>
      )}

      <div style={{ borderTop: '1px solid #000', margin: '20px 0 10px 0' }}></div>
      <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '20px' }}>
        <p style={{ margin: 0 }}>___________________________</p>
        <p style={{ margin: '5px 0 0 0' }}>Firma del Administrador</p>
      </div>

      <div style={{ textAlign: 'center', marginTop: '15px' }}>
        <p style={{ fontSize: '10px', margin: 0 }}>*** FIN DEL REPORTE ***</p>
      </div>
    </div>
  );
};

export default PrintableDailyTicket;
