import React from 'react';
import { formatCOPInput, parseCOP } from '../utils/currency';

/**
 * Campo de Entrada Monetaria con formato Colombiano en tiempo real (separador de miles con punto).
 * Despliega los puntos dinámicamente y expone tanto el evento estándar como el valor numérico limpio.
 */
export default function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  className,
  style = {},
  prefix = "$",
  autoFocus = false,
  disabled = false,
  id,
  name,
  required = false,
  onKeyDown
}) {
  const displayValue = formatCOPInput(value);

  const handleInputChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    const formatted = formatCOPInput(rawVal);
    if (onChange) {
      // Pasamos un evento sintético con el valor formateado y el valor numérico limpio
      onChange({
        target: {
          name: name || id,
          value: formatted,
          rawValue: rawVal ? parseInt(rawVal, 10) : 0
        }
      });
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      {prefix && (
        <span style={{
          position: 'absolute',
          left: '12px',
          color: 'var(--text-muted, #94a3b8)',
          fontWeight: '700',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 1
        }}>
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        id={id}
        name={name}
        className={className}
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        required={required}
        style={{
          color: 'var(--text-main)',
          background: 'var(--bg-surface)',
          ...style,
          paddingLeft: prefix ? '28px' : style.paddingLeft || '12px',
          fontVariantNumeric: 'tabular-nums'
        }}
      />
    </div>
  );
}
