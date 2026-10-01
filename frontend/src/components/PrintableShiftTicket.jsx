import React from 'react';

const PrintableShiftTicket = ({ shift, config }) => {
  if (!shift) return null;

  return (
    <div id="printable-shift-ticket" style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: '58mm',
      margin: 0,
      padding: 0,
      color: '#000',
      fontFamily: 'monospace',
      display: 'none' // Hidden by default, made visible via CSS @media print
    }}>
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '15px', margin: '0 0 2px 0', fontWeight: 'bold' }}>{config?.business_name || 'Mi Negocio'}</h2>
        {config?.business_nit && <p style={{ fontSize: '9.5px', margin: '1px 0' }}>NIT/RUT: {config.business_nit}</p>}
        {config?.business_address && <p style={{ fontSize: '9.5px', margin: '1px 0' }}>Dir: {config.business_address}</p>}
        {config?.business_phone && <p style={{ fontSize: '9.5px', margin: '1px 0' }}>Tel: {config.business_phone}</p>}
        <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }}></div>
        <p style={{ fontSize: '12px', margin: '3px 0', fontWeight: 'bold' }}>REPORTE DE CAJA (TURNO)</p>
        <p style={{ fontSize: '10px', margin: '0' }}>Turno: {shift.id ? `#${shift.id}` : 'Actual'}</p>
        <p style={{ fontSize: '10px', margin: '0' }}>Cajero: {shift.user_name || 'Desconocido'}</p>
        <p style={{ fontSize: '10px', margin: '0' }}>
          Fecha: {new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
        </p>
      </div>
      
      <div style={{ borderBottom: '1px dashed #000', marginBottom: '8px' }}></div>
      
      {/* 1. ARQUEO DE EFECTIVO FÍSICO (GAVETA) */}
      <div style={{ fontSize: '11px', marginBottom: '6px' }}>
        <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontSize: '11.5px', textDecoration: 'underline' }}>
          1. EFECTIVO EN GAVETA (CAJA)
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>Base Inicial:</span>
          <span>${(shift.initial_cash || 0).toLocaleString('es-CO')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>+ Ventas Efectivo:</span>
          <span>${((shift.direct_cash !== undefined ? shift.direct_cash : shift.cash_sales) || 0).toLocaleString('es-CO')}</span>
        </div>
        {(shift.debt_payments > 0 || shift.collected_debts > 0 || shift.collected_debts_cash > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>+ Abonos Cartera:</span>
            <span>${(shift.debt_payments || shift.collected_debts || shift.collected_debts_cash || 0).toLocaleString('es-CO')}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>- Gastos Efectivo:</span>
          <span>-${((shift.cash_expenses !== undefined ? shift.cash_expenses : shift.expenses) || 0).toLocaleString('es-CO')}</span>
        </div>
        {(shift.cash_refunds > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>- Devoluciones Efectivo:</span>
            <span>-${(shift.cash_refunds || 0).toLocaleString('es-CO')}</span>
          </div>
        )}
        <div style={{ borderTop: '1px dotted #000', margin: '4px 0 2px 0' }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>= TOTAL EFECTIVO ESPERADO:</span>
          <span>${(shift.expected_cash || 0).toLocaleString('es-CO')}</span>
        </div>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

      {/* 2. DINERO DIGITAL / TRANSFERENCIAS */}
      <div style={{ fontSize: '11px', marginBottom: '6px' }}>
        <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontSize: '11.5px', textDecoration: 'underline' }}>
          2. DINERO DIGITAL / BANCOS
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
          <span>+ Ventas Transferencia:</span>
          <span style={{ fontWeight: 'bold' }}>${(shift.transfer_sales || 0).toLocaleString('es-CO')}</span>
        </div>
        {shift.transfer_expenses > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>- Gastos Transferencia:</span>
            <span>-${shift.transfer_expenses.toLocaleString('es-CO')}</span>
          </div>
        )}
        {shift.transfer_details && shift.transfer_details.length > 0 && (
          <div style={{ margin: '4px 0', padding: '3px 0', borderTop: '1px dotted #666', borderBottom: '1px dotted #666', fontSize: '9.5px' }}>
            <p style={{ margin: '0 0 2px 0', fontWeight: 'bold' }}>Detalle de Transferencias ({shift.transfer_details.length}):</p>
            {shift.transfer_details.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
                <span>#{t.id} {t.created_at ? t.created_at.split(' ')[1] || t.created_at : ''}</span>
                <span>${(t.transfer_amount || t.total || 0).toLocaleString('es-CO')}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>= TOTAL EN BANCOS/NEQUI:</span>
          <span>${(shift.transfer_sales || 0).toLocaleString('es-CO')}</span>
        </div>
      </div>

      {/* 3. CRÉDITOS Y FIADOS */}
      {(shift.debt_sales > 0) && (
        <>
          <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
          <div style={{ fontSize: '11px', marginBottom: '6px' }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontSize: '11.5px', textDecoration: 'underline' }}>
              3. CRÉDITOS DEL TURNO
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Ventas Fiadas (Por cobrar):</span>
              <span style={{ fontWeight: 'bold' }}>${(shift.debt_sales || 0).toLocaleString('es-CO')}</span>
            </div>
          </div>
        </>
      )}

      <div style={{ borderBottom: '1px double #000', margin: '6px 0' }}></div>

      {/* 4. BALANCE CONSOLIDADO */}
      <div style={{ fontSize: '11.5px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontWeight: 'bold' }}>
          <span>TOTAL RECAUDADO REAL:</span>
          <span>${(shift.total_collected !== undefined ? shift.total_collected : ((shift.cash_sales || 0) + (shift.transfer_sales || 0))).toLocaleString('es-CO')}</span>
        </div>
        <p style={{ margin: '0 0 4px 0', fontSize: '9px', textAlign: 'right', fontStyle: 'italic' }}>(Efectivo físico + Bancos)</p>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>TOTAL FACTURADO:</span>
          <span>${((shift.total_turn_sales !== undefined ? shift.total_turn_sales : ((shift.direct_cash || 0) + (shift.transfer_sales || 0) + (shift.debt_sales || 0))) || 0).toLocaleString('es-CO')}</span>
        </div>
        <p style={{ margin: '0', fontSize: '9px', textAlign: 'right', fontStyle: 'italic' }}>(Efectivo + Transferencias + Fiados)</p>
      </div>

      <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

      {/* 5. CUADRE FINAL (SI YA SE DECLARÓ) */}
      {shift.final_cash !== undefined && (
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>EFECTIVO DECLARADO:</span>
            <span>${Number(shift.final_cash).toLocaleString('es-CO')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span>DIFERENCIA / DESCUADRE:</span>
            <span>${(shift.discrepancy || 0).toLocaleString('es-CO')}</span>
          </div>
        </div>
      )}

      {/* 6. PRODUCTOS VENDIDOS EN EL TURNO (AUDITORÍA FÍSICA) */}
      {Array.isArray(shift.products) && shift.products.length > 0 && (
        <>
          <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
          <div style={{ fontSize: '11px', marginBottom: '8px' }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', fontSize: '11.5px', textDecoration: 'underline' }}>
              6. PRODUCTOS VENDIDOS ({shift.products.reduce((acc, p) => acc + (Number(p.total_quantity) || 0), 0)} uds)
            </p>
            {shift.products.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontSize: '9.5px' }}>
                <span style={{ maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.product_name}
                </span>
                <span style={{ fontWeight: 'bold' }}>
                  x{p.total_quantity} (${(p.total_amount || 0).toLocaleString('es-CO')})
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: '30px', marginBottom: '10px' }}>
        <div style={{ borderTop: '1px solid #000', width: '80%', margin: '0 auto 5px auto' }}></div>
        <p style={{ fontSize: '10px', textAlign: 'center', margin: 0 }}>Firma del Cajero</p>
      </div>

      <div style={{ marginTop: '30px', marginBottom: '10px' }}>
        <div style={{ borderTop: '1px solid #000', width: '80%', margin: '0 auto 5px auto' }}></div>
        <p style={{ fontSize: '10px', textAlign: 'center', margin: 0 }}>Firma del Supervisor</p>
      </div>

      <div style={{ textAlign: 'center', marginTop: '15px' }}>
        <p style={{ fontSize: '9px', margin: '0' }}>*** FIN DEL REPORTE ***</p>
      </div>
    </div>
  );
};

export default PrintableShiftTicket;
