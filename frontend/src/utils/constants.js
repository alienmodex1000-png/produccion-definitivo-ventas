// Use absolute path for Vite dev server, relative path for Express static server
export const API_URL = (window.location.hostname === 'localhost' && window.location.port !== '3005' && window.location.port !== '') 
  ? 'http://localhost:3005/api' 
  : '/api';

export const getLocalTodayStr = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
};

export const getImageUrl = (path) => {
  if (!path) return '';
  if (path.includes('localhost:3005')) {
    return path.replace('http://localhost:3005', `${window.location.protocol}//${window.location.hostname}:3005`);
  }
  if (path.startsWith('/api')) {
    return (window.location.hostname === 'localhost' && window.location.port !== '3005' && window.location.port !== '') ? `http://localhost:3005${path}` : path;
  }
  if (!path.startsWith('http') && !path.startsWith('/')) {
    return (window.location.hostname === 'localhost' && window.location.port !== '3005' && window.location.port !== '') ? `http://localhost:3005/api/uploads/${path}` : `/api/uploads/${path}`;
  }
  return path;
};

// Paleta de Temas Premium Personalizables
export const THEMES = {
  'Azul Galáctico': {
    primary: '#0ea5e9',
    glow: 'rgba(14, 165, 233, 0.35)',
    border: 'rgba(14, 165, 233, 0.3)'
  },
  'Verde Esmeralda': {
    primary: '#10b981',
    glow: 'rgba(16, 185, 129, 0.35)',
    border: 'rgba(16, 185, 129, 0.3)'
  },
  'Naranja Atardecer': {
    primary: '#f97316',
    glow: 'rgba(249, 115, 22, 0.35)',
    border: 'rgba(249, 115, 22, 0.3)'
  },
  'Rosa Neón': {
    primary: '#ec4899',
    glow: 'rgba(236, 72, 153, 0.35)',
    border: 'rgba(236, 72, 153, 0.3)'
  },
  'Oro Premium': {
    primary: '#eab308',
    glow: 'rgba(234, 179, 8, 0.35)',
    border: 'rgba(234, 179, 8, 0.3)'
  }
};

export const exportToPDF = async (data, filename, headers, config = {}) => {
  if (!data || data.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

  // Create a temporary container
  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  container.style.width = '1000px';
  container.style.background = '#ffffff';

  // Header
  const headerHtml = `
    <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
        ${config.business_logo ? `<img src="${getImageUrl(config.business_logo)}" style="max-height: 80px; object-fit: contain; margin-bottom: 10px;" crossorigin="anonymous" />` : ''}
        <h1 style="margin: 0; color: #1e293b; font-size: 24px;">${config.business_name || 'Reporte del Sistema'}</h1>
        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">${filename.replace(/_/g, ' ')}</p>
        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">Fecha de emisión: ${new Date().toLocaleString('es-CO')}</p>
    </div>
  `;

  // Table
  let tableRows = '';
  for (const row of data) {
    tableRows += `<tr>`;
    for (const h of headers) {
      let val = row[h.key];
      if (h.format) val = h.format(val);
      const str = val === null || val === undefined ? '' : String(val);
      tableRows += `<td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155;">${str}</td>`;
    }
    tableRows += `</tr>`;
  }

  const tableHeader = headers.map(h => `<th style="padding: 12px 10px; text-align: left; background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 13px; color: #0f172a;">${h.label}</th>`).join('');

  const tableHtml = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
            <tr>${tableHeader}</tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
  `;

  container.innerHTML = headerHtml + tableHtml;
  document.body.appendChild(container);

  try {
    const opt = {
      margin: 10,
      filename: filename + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    const pdfBase64 = await window.html2pdf().set(opt).from(container).outputPdf('datauristring');
    
    // Trigger download
    window.html2pdf().set(opt).from(container).save();

    // Send to Telegram
    fetch(`${API_URL}/telegram/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            base64Data: pdfBase64,
            filename: filename + '.pdf',
            caption: '📊 *Aquí tienes tu Reporte exportado en PDF*',
            mimeType: 'application/pdf'
        })
    }).catch(err => console.error("Error enviando PDF a Telegram:", err));

  } catch (error) {
    console.error("Error generando PDF", error);
    alert("Hubo un error al generar el PDF");
  } finally {
    document.body.removeChild(container);
  }
};

