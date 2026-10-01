import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CRITICAL UI ERROR CAUGHT BY ERRORBOUNDARY:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem('pos_active_view');
      sessionStorage.removeItem('pos_active_view');
    } catch(e) {}
    window.location.href = window.location.origin + window.location.pathname;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: '#1e293b',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            border: '1px solid #334155',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              fontSize: '32px'
            }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', marginBottom: '10px', color: '#fff' }}>
              Protección de Interfaz Activa
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: '1.5', marginBottom: '24px' }}>
              Se detectó una discrepancia momentánea en el formato de datos. Sus registros, ventas e inventarios se encuentran completamente a salvo en la base de datos.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: '#0ea5e9',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.3)'
                }}
              >
                🔄 Recargar Sistema
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  backgroundColor: '#334155',
                  color: '#e2e8f0',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                Volver a la Registradora
              </button>
            </div>
            {this.state.error && (
              <details style={{ marginTop: '24px', textAlign: 'left', fontSize: '0.75rem', color: '#64748b' }}>
                <summary style={{ cursor: 'pointer', outline: 'none' }}>Detalle técnico</summary>
                <pre style={{ marginTop: '8px', padding: '10px', background: '#0b1120', borderRadius: '6px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
