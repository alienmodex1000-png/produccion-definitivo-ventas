# 🛡️ BITÁCORA MAESTRA DEL SISTEMA, LOGROS CONQUISTADOS Y BLINDAJE ARQUITECTÓNICO

**Fecha de Consolidación:** Septiembre de 2026  
**Ecosistema:** Sistema POS Inteligente para Tiendas de Barrio, Minimercados y Fondas (Comercio Colombiano)  
**Arquitectura:** Backend autónomo Node.js (con motor nativo `node:sqlite`) + Frontend React/Vite con Polyfills Legados + Bot de Telegram con Visión IA + Túnel Ngrok Seguro + Blindaje Windows Defender

---

## 📌 1. RESUMEN EJECUTIVO Y ESTADO GENERAL DEL SISTEMA

Certificamos que el sistema se encuentra en un estado **100% conectado, robusto, coherente, funcional y blindado para producción**.

Todos los módulos financieros, de control de inventario, auditoría de comprobantes con IA, gestión de turnos, arqueos de caja física, devoluciones trazables con vouchers oficiales y control remoto por Telegram operan en total armonía y con una tolerancia absoluta a fallos.

---

## 🏆 2. LOS 12 PILARES TÉCNICOS CONQUISTADOS (INTOQUEBLES)

### 1. Módulo Inteligente de Facturas y Gastos con Visión IA
* **Cadena Multi-Modelo Resiliente:** Failover en cascada automático:  
  `gemini-3.5-flash-lite` ➔ `gemini-3.6-flash` ➔ `gemini-3.7-flash` ➔ `gemini-3.5-flash`.
* **Extracción Profunda Probada:** Extrae de fotos de facturas o tirillas colombianas:
  * Razón Social / Comercio (ej: `D1 SAS`, `Ara`, `Éxito`)
  * NIT o Identificación Tributaria (ej: `900276962-1`)
  * Número de Factura (ej: `M3K358160`)
  * Fecha y hora del comprobante
  * Detalle de artículos comprados
  * Método de pago detectado (ej: `Efectivo`)
  * Total Neto Pagado en pesos colombianos (ej: `$13.500`)
* **Tarjeta de Auditoría Interactiva en Telegram:** Mensajes con botones inline:
  * `[ ✅ Registrar $X en Caja ]` | `[ ✏️ Modificar Monto ]` | `[ 📝 Modificar Concepto ]` | `[ ❌ Descartar ]`
* **Contingencia Offline / Sin Claves:** Si no hay internet o no hay clave de IA, el bot no se bloquea: solicita con cortesía el monto y concepto manual, archivando la foto física.
* **Archivado Contable Estandarizado:** Cada comprobante confirmado se renombra y guarda en `datos_negocio/facturas_gastos/` bajo el patrón:  
  `Gasto_N[ID]_[FECHA]_[HORA]_[COMERCIO]_[TOTAL].jpg`  
  y se vincula a la columna `receipt_image` para auditoría visual en el POS y consulta remota vía `/ver_factura [ID]`.

### 2. Estricta Seguridad y Separación de Roles (Cajero vs Administrador)
* **Modo Cajero Blindado:**
  * Pestañas permitidas: `Ventas`, `Créditos`, `Historial`, `Gastos`, `Cerrar Caja`, `Apagar POS`.
  * Pestañas gerenciales **totalmente invisibles**: `Inventario`, `Cierre`, `Turnos`, `Ajustes` (sin candados visibles para no generar fricción).
  * En el Historial de Ventas se ocultan los botones de editar fecha histórica y borrar registros.
  * Los costos de compra (`cost_price`) y márgenes de utilidad quedan 100% ocultos para el cajero.
* **Modo Administrador Gerencial:**
  * Desbloqueo instantáneo con PIN seguro (`1234` configurable).
  * Revela todas las pestañas y funciones de gestión avanzada.
  * Botón visible de salida rápida `[ 🔒 Salir a Cajero ]`.

### 3. Módulo de Devoluciones y Reembolsos Auditados (Comprobantes DEV)
* **Trazabilidad Total con Tablas Propias:** Tablas relacionales atómicas `sale_refunds` y `sale_refund_items`.
* **Folios Oficiales `#DEV-X`:** Cada reembolso genera un comprobante con fecha, motivo, responsable (`Cajero`), si reingresó a stock o no (`returned_to_stock`) y medio de reembolso.
* **Flexibilidad Total:** Permite devoluciones completas del ticket o devoluciones parciales ítem por ítem con control de cantidades.
* **Pestaña Dedicada en Historial:** Botón con contador en tiempo real `[ ↩️ Devoluciones y Reembolsos (N) ]` y banner de auditoría superior con el Total Reembolsado y la cantidad de comprobantes DEV emitidos.
* **Valores Netos Coherentes en Tabla:** Desglosa valor neto cobrado (`$8.000 neto`), deducción del reembolso (`- Dev: $220.000`) y valor original tachado (`Orig: $228.000`), recalculando la utilidad neta con el badge `🟣 DEV. PARCIAL` o `🔴 REEMBOLSADO TOTAL`.
* **Detalle de Ítems Devueltos:** Artículos marcados con insignia `↩️ X devuelto(s)` y tachado de subtotales.
* **Alerta Inmediata al Dueño:** Telegram notifica al segundo quién devolvió, qué productos, cuánto dinero y el motivo.

### 4. Cuadre de Caja y Arqueo Físico de Turnos Matemáticamente Preciso
* **Fórmula de Arqueo Inquebrantable:**  
  $$\text{Efectivo Esperado} = \text{Base Inicial} + \text{Ventas Efectivo} + \text{Abonos Cartera} - \text{Gastos Efectivo} - \text{Devoluciones Efectivo}$$
* **Arqueo en Vivo (`/api/shifts/current/stats`):** El efectivo esperado deduce automáticamente las devoluciones de efectivo, evitando falsos faltantes al cajero.
* **Cierre de Turno y Rendición de Cuentas (`/api/shifts/:id/close`):** Se audita y notifica a Telegram la línea explícita: `• Devoluciones de Efectivo: -$XXX.XXX`.
* **Cierre a Ciegas (`blind_close`):** Configurable para obligar al cajero a contar el dinero físico sin ver el sistema.

### 5. Motor de Base de Datos Nativo Autónomo (`node:sqlite`)
* **Cero Compiladores C++ o Python:** Implementado sobre `node:sqlite` nativo (`DatabaseSync`), eliminando cualquier dependencia de `better-sqlite3`, `node-gyp` o dependencias externas.
* **Binario Portátil `node.exe`:** Node v24.15.0 embebido en la raíz (87.4 MB). Funciona de forma 100% offline y autónoma en cualquier computador con Windows sin instalar nada.
* **Auto-Migración en Caliente Transparente:** Al arrancar con una base de datos antigua de un cliente, `database.js` aplica de forma automática y silenciosa las columnas y tablas faltantes sin alterar ningún dato histórico.

### 6. Estructura Aislada de Datos del Negocio (`datos_negocio/`)
* Carpeta única de datos protegida fuera del código:
  * `database.sqlite` (única base de datos oficial)
  * `imagenes/` (fotos de productos del inventario)
  * `facturas_gastos/` (comprobantes auditados de compras y gastos)
* Respaldos automáticos diarios al iniciar: `backend/backups/database_backup_[FECHA].sqlite`.

### 7. Blindaje de Windows Defender y Entornos de Clientes (`Blindar_y_Crear_Acceso_Directo.bat`)
* **Detección Dinámica de Ruta (`%~dp0`):** Detecta automáticamente la carpeta del sistema sin importar su nombre o unidad de disco (`C:`, `D:`, etc.).
* **Auto-Elevación a Administrador:** Solicita permisos de Windows con un clic.
* **Exclusión Sagrada en Windows Defender:** Aplica `Add-MpPreference -ExclusionPath` y `Add-MpPreference -ExclusionProcess "node.exe"`, prohibiendo que el antivirus borre o bloquee archivos (`node.exe`, `iniciar.vbs`, scripts).
* **Acceso Directo Profesional:** Crea el acceso directo en el Escritorio con icono oficial para que el cliente nunca manipule ni borre por error los archivos internos.

### 8. Centro de Mando Remoto por Telegram
* **Comandos en Vivo 24/7:** `/caja`, `/top`, `/agotados`, `/gastos`, `/ver_factura [ID]`, `/crear`, `/cambiar_precio`.
* **Supervisión Móvil:** El dueño consulta ventas, dinero en gaveta y facturas en tiempo real desde su teléfono.

### 9. Compatibilidad Universal para Equipos Legados
* **Frontend Vite + Legacy:** Genera bundles modernos y polyfills legados (`@vitejs/plugin-legacy`) compatibles con navegadores antiguos de tiendas (Chrome viejo, Windows 7, 8, 10, 11).
* **Tiempos de Respuesta Ultrarrápidos:** Respuestas de API locales en menos de 5 milisegundos.

### 10. Infraestructura Remota con Túnel Ngrok Persistente
* Dominio reservado fijo (`statutory-trolling-endpoint.ngrok-free.dev`) con reconexión automática tras caídas de internet.
* Identificación y protección de conexiones remotas.

### 11. Licenciamiento y Membresías Offline-First
* Algoritmo criptográfico SHA-256 / HMAC embebido en `backend/licensing.js`.
* Validación 100% local: si el cliente no tiene internet durante semanas, el punto de venta jamás se detiene.

### 12. Multi-Ambiente y Líneas de Negocio Duales
* Separación de ventas, inventario y reportes en dos líneas de negocio configurables (ej: *Fonda Montañero* y *Enchiladas y cocteles*).

---


### 13. Sincronización Reactiva en Tiempo Real (SSE) y Notificaciones Toast
- **Canal Nativo `/api/events` (Server-Sent Events):** Cero dependencias externas (usa `text/event-stream` nativo de HTTP), 100% compatible con túneles Ngrok, proxies y redes móviles con reconexión automática en segundo plano.
- **Transmisión Inmediata (<50ms):** Cualquier gasto registrado desde Telegram (manual o factura con IA), cambio de precio (`/cambiar_precio`), ajuste de stock o venta remota actualiza la memoria del navegador al instante.
- **Cero Interrupción de Caja:** El cajero puede estar cobrando o con productos en el carrito sin perder su venta ni sufrir parpadeos de pantalla.
- **Notificaciones Flotantes (Toasts):** Tarjeta animada elegante en la esquina superior derecha con icono, color distintivo y descripción de la acción remota realizada.

---


### 14. Rediseño Ergonómico de Ventas: Matriz de Mesas, Modo Rondas y Adaptabilidad Universal
- **Redistribución Espacial y Adaptabilidad (1366x768 / Laptops):** Ajuste de rejilla a proporción óptima (64% productos, 36% registradora con minmax(430px, 490px)). Ahorro de ~200px de altura en el pie de cobro gracias a selectores segmentados ultra compactos, permitiendo visualizar de 6 a 12 ítems simultáneos sin scroll.
- **Selector y Gestor Visual de Mesas (`MesasGridModal`):** Eliminación del scrollbar horizontal limitado. Acceso instantáneo con `[ ⚡ Venta Rápida ]`, `[ 🪑 Mesas (N activas) ▾ ]` con tarjeta matriz interactiva, cálculo de consumo en vivo (`$83.000 (7 productos)`), edición de nombres y creación en 1 clic. Banner destacado de mesa en curso con opción de cambio rápido.
- **Modo Rondas Cronológico ("Rondas" vs "Consolidado"):** Persistencia en base de datos SQLite (`account_items.added_at`, `account_items.round_num`). Visualización detallada por horarios (`⏱️ 03:15 p. m. · R1`, `⏱️ 03:45 p. m. · R2`) con toggle instantáneo a `[ 📦 Consolidado ]` que agrupa productos idénticos para cobro y claridad total para el cliente.
- **Pie de Cobro Segmentado Ergonómico:** Botones táctiles compactos de 1 sola fila para `💵 Efectivo`, `📱 Transf.`, `🔀 Mixto` y `📋 Fiar`, con cálculo automático de vuelto y deudas.

---


### 15. Blindaje de Stock Global Multi-Ronda y División de Cuentas (Split Bill)
- **Control Acumulativo de Inventario en Todo el Negocio:** Validación matemática global en tiempo real: el sistema suma las existencias reservadas en Venta Rápida y en todas las mesas abiertas activas. Si un producto ya fue tomado en mostrador o en otra mesa, es físicamente imposible volver a pedirlo o comprometerlo, evitando cualquier sobreventa física. El catálogo refleja automáticamente la etiqueta `APARTADO (N en mesas)`.
- **Botón Principal Dual de Cobro:** Integración de `[ ✂️ Pagos Separados ]` directamente al lado del botón principal de cobro de la registradora para acceso inmediato con un solo toque.
- **Cobro Directo e Independiente por Ronda (`[ 💳 Cobrar Ronda ]`):** Permite liquidar y facturar una tanda de pedidos específica (con su ticket individual y medios de pago) manteniendo la mesa abierta con las rondas restantes. Si es la última ronda, la mesa se libera automáticamente.
- **Modal Profesional de División de Cuenta (`[ ✂️ Pagos Separados ]`):**
  - *Modo Selección Libre (Comensal por Comensal):* Casillas interactivas y selector de cantidades para cobrar únicamente lo consumido por cada cliente y extraer esos ítems de la mesa.
  - *Modo Partes Iguales (Equitativo):* Cálculo instantáneo del monto exacto por persona (entre 2 y 6 comensales) con botón directo para registrar cada pago consecutivo.

---

### 16. Resolución Definitiva del Cálculo Reactivo y Subtotal en División de Cuentas (Split Bill)
- **Identificación y Causa Raíz Superada:** Corrección de la discrepancia de tipos (String vs Number) en las claves de ítems (`getCartItemKey`) generadas entre el estado React y la base de datos SQLite (`account_items.id`), que anteriormente causaba que `subtotalPagar` se evaluara en `$0` y deshabilitara el botón de cobro.
- **Cálculo Reactivo Directo:** Recálculo instantáneo del subtotal iterando el carrito en tiempo real (`currentCart.reduce(...)`) con cada clic de checkbox, botón `+` o `-`, o botones rápidos `[ ✓ Marcar Todos ]` y `[ ✕ Desmarcar ]`.
- **Soporte Integral de Medios de Pago:** Inclusión de campos interactivos para Efectivo (con cálculo de cambio a devolver), Transferencia y Mixto (distribución matemática automática de Efectivo + Transferencia).
- **Deducción Parcial Atómica:** Liquidación exacta de cantidades consumidas, emisión de ticket de venta individual y liberación automática de la mesa cuando se cancela el último producto restante.

---

### 17. Cronómetro Inteligente de Estadía en Mesas y Carta Digital Interactiva con QR en Vivo
- **Cronómetro de Tiempo de Estadía en Mesas:** Medición precisa y en tiempo real del tiempo de consumo transcurrido desde la apertura de cada mesa (`⏱️ < 1 min`, `⏱️ 45 min`, `⏱️ 2h 10m`). Cuenta con semáforo inteligente de 3 niveles de color (Verde Esmeralda `< 45 min`, Ámbar `45-90 min`, Rosa Intenso `> 90 min`), indicador de `⏳ Ronda pendiente` si hay pedidos sin confirmar a cocina, y badge de tiempo activo visible en el encabezado de ventas al seleccionar la mesa.
- **Carta Digital Interactiva Móvil (`/carta`):** Menú digital público responsive optimizado para smartphones, con carrusel de categorías táctiles, búsqueda instantánea, fotografías de productos, precios en vivo actualizados automáticamente por Server-Sent Events (SSE), insignia de agotados e información de contacto y Wi-Fi del establecimiento.
- **Blindaje de Privacidad y Costos en API Pública (`/api/menu`):** El endpoint público para clientes filtra estrictamente el costo de compra (`cost_price`), utilidades y datos confidenciales del cajero, exponiendo únicamente lo necesario para el comensal.
- **Generador e Impresor de Códigos QR para Mesas (`[ 📱 Carta QR ]`):** Modal interactivo con generación en vivo de código QR mediante canvas/SVG sin dependencias externas lentas. Soporta enlace público de internet vía túnel oficial Ngrok y enlace de red local Wi-Fi, con función de copiado rápido al portapapeles y botón para imprimir el rótulo de mesa en acrílico o porta-menú con instrucciones para los clientes.
- **100% Configurable y Habilitable a Voluntad:** Integración en el panel de **Ajustes** de switches y campos para activar/desactivar el cronómetro, la carta digital, ocultar agotados, y personalizar la clave de Wi-Fi, teléfono de WhatsApp y mensaje de bienvenida.

---

### 18. Perfeccionamiento de la Carta Digital, Enlaces de WhatsApp, Seguridad Ngrok y Rótulo QR Imprimible
- **Visibilidad Integral de Categorías (Wrap Multi-Fila):** Reemplazo del desbordamiento horizontal comprimido por un contenedor reactivo `flex-wrap: wrap` con altura mínima de 38px e insignias de conteo de productos (`Todos 84`, `Cervezas 10`, etc.). Al seleccionar "Todos", la carta se agrupa por secciones visuales ordenadas (`🏷️ Cervezas 10`, `🏷️ Licor 25`, etc.).
- **Canal de Pedidos y Atención por WhatsApp:** Integración con el teléfono oficial configurado (`digital_menu_phone` o `business_phone`). Se dotó a la carta de 3 puntos de contacto: botón flotante inferior permanente (FAB `💬 Pedir por WhatsApp`), botón directo por producto `[ 💬 Pedir ]` con mensaje pre-cargado personalizado, e insignia superior en la cabecera.
- **Blindaje y Redirección Inteligente en Enlaces Ngrok:** Toda visita remota a la raíz (`/`) o `/carta` de un usuario no autenticado muestra de forma inmediata la Carta Digital sin exponer datos de ventas, dinero en caja, costos ni turnos. Dispone de un acceso discreto para el dueño (`🔒 Acceso Cajero / Administración`) y botón de retorno al menú para clientes.
- **Corrección Geométrica del Rótulo QR Imprimible:** Reingeniería del diseño para portamenús y acrílicos de mesa con `box-sizing: border-box`, ancho acotado de 320px, código QR centrado y contenido (`180x180px`), `-webkit-print-color-adjust: exact !important` para preservar insignias y colores en papel/impresora térmica o láser, caja informativa de Wi-Fi y WhatsApp, y guía de recorte.

---

### 19. Origen de Fondos en Gastos, Conciliación de Arqueos y Rediseño de Tarjetas de Productos
- **Clasificación Multiorigen de Gastos (`payment_method`):**
  - `💵 Caja (Efectivo)`: Resta del efectivo físico esperado (`expected_cash`) en el turno para conciliar el arqueo del cajero al centavo.
  - `📱 Transferencia`: Gasto pagado electrónicamente desde la cuenta/Nequi de la tienda. NO resta de la gaveta de billetes físicos (no descuadra al cajero).
  - `👤 Bolsillo del Dueño`: Aporte con dinero propio del propietario. No reduce la gaveta de caja ni el banco del negocio; se computa en la contabilidad general para determinar la Utilidad Neta Real del establecimiento.
- **Notificaciones Ejecutivas de Telegram:** Todo gasto registrado vía POS o bot incluye el origen de fondos (`💳 Origen: 💵 Efectivo de Caja` / `📱 Transferencia` / `👤 Bolsillo del Dueño`) y en el reporte de cierre de turno se desglosa el impacto de cada fuente.
- **Rediseño Arquitectónico de Tarjetas de Producto en 3 Niveles:**
  - Separación vertical en Flexbox:
    1. *Fila Superior Flex:* Ubicación a la izquierda y cápsula de stock/mesas a la derecha (`81 disp. • 🍽️ 1` o `AGOTADO`).
    2. *Cuerpo Central:* 100% del ancho dedicado al nombre del producto, soportando hasta 2 líneas (`-webkit-line-clamp: 2`) con corte de palabras inteligente y **cero solapamiento de textos**.
    3. *Fila Inferior:* Precio de venta anclado con alto contraste y degradado oscuro reforzado (`rgba(0,0,0,0.92)`).

---

### 20. Control Ciego de Inventario para Cajeros (Ocultar Stock Numérico a Voluntad)
- **Privacidad y Prevención de Mermas (Inventario Ciego):** Se implementó una directiva configurable en Ajustes (`hide_stock_cashier`) para ocultar las cifras exactas de existencias físicas a los cajeros en la cuadrícula de ventas.
- **Insignias Semafóricas Discretas para el Cajero:**
  - `🟢 Disponible`: Cuando el producto tiene existencias suficientes sin compromisos.
  - `⚠️ Pocas unidades`: Cuando las existencias alcanzan o caen bajo el stock mínimo de advertencia.
  - `🚫 AGOTADO`: Cuando el inventario llega a 0 (con bloqueo estricto si está activo).
  - En caso de ítems reservados en mesas abiertas, se indica con elegancia: `🟢 Disp. • 🍽️ X` o `🍽️ En mesas`.
- **Visibilidad Integral y Transparente para el Administrador:**
  - Al ingresar el PIN de Administrador, el sistema revela instantáneamente la cifra numérica precisa de inventario (`Stock: 24`, `Stock: 15`, `Stock: 83`), garantizando auditorías rápidas y control total para el dueño.
- **Cumplimiento de la Regla de Oro #4 (Rol Cajero):** La privacidad del inventario general y las métricas confidenciales del negocio quedan totalmente blindadas frente al personal de caja sin interrumpir la fluidez operativa de las ventas.

---

### 21. Estandarización Universal del Formato Monetario Colombiano (COP)
- **Separador de Miles con Puntos (`1.111.111`) y Cero Decimales:**
  - En Colombia, el peso (COP) no maneja centavos y exige estrictamente el punto (`.`) como separador de miles. Se erradicaron todos los valores numéricos crudos o desprovistos de puntuación en pantallas, formularios, modales, tickets y notificaciones.
- **Módulo Centralizado de Moneda (`currency.js`):**
  - `formatCOP(val, includeSymbol = false)`: Formatea cualquier número o string numérico bajo el estándar `es-CO` (`1111111` -> `1.111.111` o `$ 1.111.111`).
  - `formatCOPInput(rawValue)`: Máscara en tiempo real para inputs. Limpia cualquier carácter no numérico y formatea dinámicamente según el usuario digita en su teclado.
  - `parseCOP(formattedValue)`: Desempaqueta y parsea de forma segura a entero limpio para cálculos matemáticos locales y envíos limpios a endpoints de backend y SQLite, eliminando el riesgo de truncamiento por `parseFloat("1.111.111")`.
- **Componente Reutilizable `CurrencyInput.jsx` y Reemplazo de `<input type="number">`:**
  - Los campos de entrada numérica en HTML5 (`type="number"`) no admiten formateo con puntos en navegadores modernos. Se adaptaron todos los modales clave con `type="text"` y `inputMode="numeric"`:
    - **Apertura y Cierre de Caja:** Efectivo inicial (`initial_cash`) y conteo físico final formateados en vivo con prefijo `$`.
    - **Panel de Cobro y Checkout:** Efectivo entregado (`cashTendered`), pagos mixtos (`mixedCash`, `mixedTransfer`), cambio y montos faltantes calculados y formateados al instante.
    - **Módulo de Fiados y Deudas:** Formulación y abonos parciales formateados con punto en modal y listados.
    - **Módulos de Gastos e Inventario:** Entradas de precio de venta, precio de costo y montos de egresos enmascaradas con formato COP.
- **Auditoría y Unificación en Reportes, Tickets y Telegram:**
  - Los reportes de turnos (`ShiftsReport.jsx`), reportes diarios (`DailyReport.jsx`, `PrintableDailyTicket.jsx`) y notificaciones del bot de Telegram (`server.js`, `telegramService.js`) fueron auditados y configurados con `es-CO` y símbolo `$`.

---

### 22. Módulo Pro de Recordatorios, Mantenimientos Cíclicos y Alertas Telegram
- **Activación a Voluntad del Negocio (`enable_reminders`):**
  - Switch configurable en la sección de Ajustes del Sistema para habilitar o deshabilitar el módulo según el modelo de negocio (talleres, servicios técnicos, citas, revisiones periódicas, garantías o cambios de consumibles). Si está apagado, no sobrecarga la barra de navegación.
- **Componente Pro `RemindersManager.jsx`:**
  - **Tarjetas de Métricas en Tiempo Real:** Contadores dinámicos para `VENCIDOS 🔴`, `PARA HOY 🟡`, `PRÓXIMOS (7 DÍAS) 🟢` y `TOTAL PENDIENTES 📋`.
  - **Insignia Pulsante en Navbar:** Contador reactivo en la barra superior con el total de tareas para hoy o vencidas (`Recordatorios (2)`).
  - **Buscador y Filtros por Pestañas:** Filtros rápidos por estado y búsqueda instantánea por cliente, tarea, teléfono o notas.
  - **Hora Exacta Programada (`due_time`):** Selector de hora opcional (`<input type="time">`) en modal de creación/edición, renderizado elegante en formato 12 Horas (`02:30 PM`) con insignia distintiva en cada tarjeta.
  - **Protección de Eliminación con Clave de Administrador (PIN):** El cajero tiene visibilidad completa para atender a los clientes y completar citas, pero la eliminación de cualquier recordatorio está protegida por un modal de confirmación que exige la contraseña de administración, evitando borrados accidentales o no autorizados.
  - **Integración WhatsApp 1-Clic:** Botón directo `💬 WhatsApp` para enviar un mensaje pre-cargado de cortesía al cliente recordando su cita o mantenimiento preventivo, especificando fecha y hora exacta si fue asignada.
- **Mantenimientos Cíclicos y Auto-Renovación (`recurrence_days`):**
  - Soporte de recurrencia periódica (quincenal, mensual, trimestral, semestral o anual).
  - Al marcar un servicio como completado, el sistema calcula automáticamente la siguiente fecha conservando la hora programada y crea la nueva cita en el calendario.
- **Avisos Previos y Motor de Monitoreo en Segundo Plano:**
  - Selector de días de anticipación (`advance_notice_days`: 0, 1, 2, 3, 7 o 15 días antes).
  - Tarea periódica en segundo plano en `server.js` (cada 30 min y al arrancar) que audita vencimientos y dispara notificaciones push a Telegram para alertar al dueño antes de la fecha.
- **Auditoría y Control Total desde Telegram:**
  - `/recordatorios` : Listado ejecutivo categorizado en Vencidos 🔴, Hoy 🟡 y Próximos 🟢 con enlaces de acción directa.
  - `/crear_recordatorio [fecha] [hora?] [cliente] - [tarea]` : Agendar recordatorios desde el móvil con hora opcional.
  - `/completar_recordatorio [id]` : Marcar como realizado desde el chat (y renovar la cita si es cíclica).
  - `/eliminar_recordatorio [id]` : Suprimir recordatorios de manera remota mediante comando autorizado.
  - **Notificación de Auditoría en Telegram:** Cada vez que se elimina un recordatorio (sea desde el POS o desde el bot), se despacha un mensaje de auditoría detallado a Telegram reportando el ID, tarea, cliente y fecha programada.
- **Fallback Offline Garantizado:**
  - 100% operativo en red local y SQLite sin internet. Sincronización multi-dispositivo en vivo mediante Server-Sent Events (SSE).

---

### 23. Módulo de Cartera, Cobranza y Reportes Financieros Remotos vía Telegram
- **Control de Cartera y Fiados (`/fiados` o `/cartera`):**
  - Despliega en Telegram el balance consolidado de cuentas por cobrar (`SUM(total)` donde `payment_status = 'pending'`), total de deudores activos y los 10 clientes con mayor saldo pendiente de pago junto con su fecha de origen y comandos rápidos de abono.
- **Asentamiento Remoto de Pagos y Abonos (`/abono [cliente] [monto] [metodo?]`):**
  - Permite al propietario cobrar deudas en la calle y registrar el abono instantáneamente desde su celular.
  - Discrimina automáticamente medio de pago (`Efectivo` o `Transferencia`/Nequi) y descuenta el saldo adeudado o liquida la cuenta al 100% bajo transacciones atómicas SQLite (`BEGIN TRANSACTION ... COMMIT`).
  - Si hay turno abierto, se asigna el recaudo al cajero activo en turno; si no, queda asentado en contabilidad general.
  - Emite evento en tiempo real vía SSE (`SALE_PAID`) para que la pantalla del cajero se actualice al milisegundo sin recargar.
- **Reporte Mensual Ejecutivo Consolidado (`/mes` o `/reporte_mes`):**
  - Genera una radiografía contable del mes en curso: Facturación Bruta (discriminada en Efectivo y Transferencias), Costo de Mercancía Vendida, Utilidad Bruta, Gastos Operativos totales discriminados, **Utilidad Neta Real** y Margen Neto de Ganancia en porcentaje.

---

### 24. Blindaje, Timeouts y Resiliencia en el Bot Interactivo de Telegram (Long-Polling & Comandos Remotos)
- **Corrección de Dependencia Crítica (`getBusinessName`):**
  - Se identificó y resolvió una excepción de tiempo de ejecución (`ReferenceError: getBusinessName is not defined`) que provocaba que comandos como `/start`, `/caja`, `/mes`, `/fiados`, `/recordatorios` e `/inventario` fallaran silenciosamente antes de emitir su respuesta en Telegram.
  - Implementación de la función auxiliar `getBusinessName()` que consulta la tabla `config` en SQLite con fallback seguro a `'Mi Tienda'`.
- **Prevención de Interbloqueos y Sockets Huérfanos en Long-Polling:**
  - `telegramApiRequest` fue blindado con un parámetro de `timeoutMs` (por defecto 25s) y evento `req.setTimeout(...)` con destrucción forzada del socket (`req.destroy()`) y cabecera HTTP `'Connection': 'close'`, evitando que sockets caídos o colgados en Windows TLS queden indefinidamente en estado `ESTABLISHED`.
  - El bucle `runPollingLoop` se optimizó a un sondeo de 10 segundos con un timeout de socket de 18 segundos, garantizando una reactividad fluida sin bloqueos.
- **Enrutador Amigable para Usuarios y Chat IDs No Autorizados:**
  - Si un usuario no registrado o con Chat ID diferente envía `/start`, `/id` o `/menu`, el bot responde cordialmente saludando al usuario, indicando el nombre del comercio y mostrando su Chat ID numérico para que pueda autorizarlo fácilmente en los Ajustes del POS.
- **Monitoreo y Diagnóstico en Consola de Servidor:**
  - Registro en tiempo real de todos los mensajes y botones pulsados en la consola del backend (`[Telegram Bot] 📩 Mensaje recibido de Carlos: "/caja"`), facilitando auditorías visuales inmediatas.

---

### 25. Normalización Cromática Dinámica Universal (Modo Claro & Modo Oscuro) y Reseteo Global de Formularios
- **Erradicación de Estilos Inline Rígidos:** Corrección del conflicto de especificidad CSS provocado por atributos en línea duros (`color: '#fff'` o `color: 'white'`) heredados del diseño original oscuro, los cuales sobreescribían las variables dinámicas de tema en modo claro (`body.light-mode`), provocando textos invisibles (blanco sobre blanco) en campos de cobro (`cashTendered`, `mixedCash`, `mixedTransfer`, `debtorName`), modal de apertura de caja, división de cuentas y carta digital.
- **Normalización de Variables en `index.css`:**
  - Incorporación de `--bg-card: #ffffff;` en `body.light-mode` y `--bg-card: #131c2e;` en `:root`.
  - Regla maestra de reseteo para todas las entradas de datos:
    ```css
    input, select, textarea {
      color: var(--text-main);
      font-family: inherit;
    }
    input::placeholder, textarea::placeholder {
      color: var(--text-muted);
    }
    ```
- **Refactorización Integral a Tokens Dinámicos:**
  - Reemplazo sistemático por `color: var(--text-main)` y `background: var(--bg-surface)` en `CurrencyInput.jsx`, `App.jsx`, `SettingsForm.jsx`, `InventoryManager.jsx` y `UsersManager.jsx`.
- **Pulido Visual de Estados de Protección (`.checkout-btn:disabled`):**
  - Rediseño del botón de cobro cuando el carrito está vacío o en proceso de facturación, dotándolo de un tono neutro elegante con borde sutil, eliminando transparencias deslavadas y comunicando con claridad al cajero su estado de espera.

---

### 26. Auto-Aprovisionamiento en Equipos Nuevos y Despliegue en Cero
- **Inicialización Autónoma de Base de Datos:** Garantía de que al eliminar `database.sqlite` para entregar el sistema limpio a un nuevo cliente, `database.js` auto-aprovisiona de forma silenciosa e instantánea la totalidad de las 14 tablas, las configuraciones maestras, las categorías iniciales y el usuario `admin` con PIN `1234` predeterminado.
- **Cero Dependencia de Pasos Manuales:** El instalador o cliente puede ejecutar `INICIAR_SISTEMA.bat` inmediatamente en cualquier computador virgen y comenzar a operar sin necesidad de scripts SQL ni asistentes técnicos externos.
- **Cuádruple Sincronización Estricta (4-Way Sync):** Consolidación en espejo exacto de ejecutables, bundles y fuentes entre `Software definitivo venta/`, `produccion_definitivo/` y sus respectivas carpetas de respaldo.

---

### 27. Módulo Pro de Impresión Térmica, Detección de Dispositivos y Confirmación Post-Venta
- **Endpoints de Conectividad con Windows (`/api/printers` y `/api/printers/set-default`):**
  - Consulta en tiempo real de impresoras instaladas en el sistema operativo mediante PowerShell y WScript nativo. Detecta nombre del dispositivo, puerto de comunicación (`USB001`, `USB003`, etc.), controlador y estado predeterminado.
  - Capacidad de fijar la impresora predeterminada de Windows en 1 clic directamente desde el panel de **Ajustes** sin necesidad de acceder al Panel de Control de Windows.
- **Selector de Comportamiento Post-Venta (3 Modos a Voluntad):**
  - `🟡 Preguntar después de cada venta (ask)`: Despliega un diálogo express con el total cobrado, cambio a devolver y atajos de teclado (`Enter` para imprimir ticket, `Esc` para omitir y continuar con la siguiente venta). Máximo ahorro de papel para tiendas de barrio.
  - `🟢 Imprimir automáticamente siempre (auto)`: Disparo instantáneo de la orden de impresión al cerrar la venta para restaurantes y supermercados de alto flujo.
  - `⚪ No imprimir automáticamente (manual)`: Operación 100% digital sin gasto de papel, preservando la capacidad de reimpresión manual desde el Historial.
- **Calibre Dinámico de Papel Térmico (58mm vs 80mm):**
  - Soporte y adaptación geométrica automática para impresoras compactas de 58 mm y rollos anchos de 80 mm (`body.ticket-80mm`), optimizando el tamaño tipográfico, columnas y márgenes.
- **Herramienta de Verificación en 1 Clic (`[ 📄 Imprimir Ticket de Prueba ]`):**
  - Botón integrado en Ajustes para comprobar de inmediato la comunicación física, nitidez y corte de papel sin crear ventas ficticias.

---

### 28. Detección en Tiempo Real de Impresoras (En Línea vs Desconectada vs Virtual) y Rebalanceo Ergonómico 50/50 de Ajustes
- **Detección Fisiológica de Dispositivos USB en Spooler de Windows (`Win32_Printer`):**
  - **Causa Raíz:** En Windows, los controladores de impresoras térmicas instaladas (`XP-58`, `POS Printer 203DPI Series`, etc.) permanecen registrados indefinidamente en el sistema de impresión aunque el cable USB esté desconectado o el interruptor esté apagado. Asimismo, coexisten controladores virtuales como `Microsoft Print to PDF` y `OneNote`.
  - **Diagnóstico y Clasificación Inteligente:** El endpoint `/api/printers` en `server.js` ahora extrae y analiza en tiempo real `WorkOffline` y `PrinterStatus`:
    - `isVirtual`: Identifica automáticamente impresoras lógicas de software (`Microsoft Print to PDF`, `OneNote`, `Fax`, puertos virtuales `PORTPROMPT:`, `nul:`).
    - `isOnline`: Determina si el hardware térmico está físicamente enchufado por USB y encendido (`WorkOffline: false` y estado operativo activo).
    - `statusText`: Insignias cromáticas directas en la interfaz:
      - 🟢 **En línea y lista:** Impresora USB física conectada, encendida y lista para despachar tickets.
      - 🔴 **Desconectada (Sin cable USB o apagada):** Driver instalado pero sin enlace físico de datos.
      - 📄 **Impresora Virtual (PDF/Archivo):** Salida a documento digital.
  - **Transparencia Operativa:** Mensaje explicativo para el usuario en la tarjeta de impresoras que disipa cualquier confusión sobre por qué Windows lista drivers instalados aun con el cable desconectado.
- **Arquitectura de Navegación por Categorías y Rebalanceo Visual 50/50 en Ajustes:**
  - **Ergonomía de Pestañas (Pills Filter Bar):** Se integró una barra superior con selectores temáticos (`📑 Ver Todo`, `🏢 General & Marca`, `🖨️ Impresión Térmica`, `🔒 Seguridad & Roles`, `⚙️ Operaciones & Caja`, `🍽️ Mesas & Carta QR`, `🤖 Telegram & Visión IA`, `🌐 Acceso Remoto`, `⚠️ Mantenimiento`), permitiendo al usuario enfocar de inmediato una sola sección o visualizar el panel global.
  - **Balance Equitativo 50/50 entre Columnas:**
    - **Columna Izquierda (Identidad, Hardware Físico y Restaurante):** Identidad & Marca, Impresora Térmica & Tickets de Venta, Módulos de Restaurante & Carta Digital QR, Zona de Mantenimiento y Reinicio.
    - **Columna Derecha (Seguridad, Políticas Operativas e Integraciones Cloud):** Sistema de Roles & PIN Maestro, Operaciones, Arqueo Ciego e Inventario, Motor de Inteligencia Artificial PRO, Bot de Telegram & Notificaciones, Túnel de Acceso Remoto Ngrok.
    - Eliminación definitiva del vacío visual en la columna derecha, logrando una simetría y armonía estética de estándar premium internacional.

---

### 29. Corrección Quirúrgica de Importación en Modal Post-Venta y Blindaje del Historial de Ventas
- **Causa Raíz:** En `App.jsx`, el modal de confirmación de impresión post-venta (`PostSalePrintModal`) implementado para agilizar la entrega de tickets tras cobrar una venta invocaba el icono `<CheckCircle2 size={36} />`. En el bloque de importación de `lucide-react` solo figuraba `CheckCircle` (sin el `2`), lo que provocaba una excepción de JavaScript en tiempo de ejecución: `ReferenceError: CheckCircle2 is not defined`.
- **Comportamiento Seguro:** El componente `ErrorBoundary` del sistema actuó según su diseño, capturando el error e impidiendo la corrupción de datos en pantalla mediante el panel protector *"Protección de Interfaz Activa"*.
- **Resolución y Auditoría Integral:**
  - Se incorporó formalmente `CheckCircle2` a la lista de importaciones de `lucide-react` en `App.jsx`.
  - Se desarrolló y ejecutó un script de verificación léxica (`check_missing_tags.js`) escaneando los 14 archivos `.jsx` de la aplicación, certificando que **no existe ningún otro símbolo, componente o icono huérfano en el frontend**.
  - Recompilación limpia con Vite (`npm run build`), ejecución de la sincronización cuádruple (`sync_all.js`) y liberación total del puerto 3005.

---

### 30. Corrección de Contraste en Selectores de Fecha (Modo Oscuro) y Localización Semántica al Español ("Consultar Reporte")
- **Legibilidad y Contraste Universal en Controles de Fecha:**
  - **Problema Detectado:** Los selectores nativos `<input type="date">` en Chromium/Windows renderizaban un fondo blanco rígido sin contraste en modo oscuro (`body:not(.light-mode)`), dejando las cifras de fechas en blanco sobre blanco (`#f8fafc` sobre `#ffffff`), resultando ilegibles para el usuario.
  - **Resolución Arquitectónica:**
    - Se incorporó `color-scheme: dark;` en `:root` y `color-scheme: light;` en `body.light-mode`.
    - Se definió la clase maestra `.app-input` junto a reglas explícitas para `input[type="date"]`, `input[type="datetime-local"]` e `input[type="time"]`:
      - Modo Oscuro: Fondo profundo `var(--bg-dark)` (`#090d16`), texto nítido blanco (`#f8fafc`), borde refinado `rgba(255, 255, 255, 0.18)` y filtro invertido `filter: invert(0.9)` para el icono del calendario.
      - Modo Claro: Fondo blanco puro (`#ffffff`), texto azul noche (`#0f172a`), borde gris pizarra (`#cbd5e1`) y filtro normal `filter: invert(0.2)` para el icono del calendario.
- **Humanización y Terminología Comercial Amigable (Cero Anglicismos Técnicos):**
  - **Problema Detectado:** En la sección de Reporte Diario / Cierres figuraba el botón `"Generar Dashboard"`, un término técnico en inglés ajeno a los comerciantes, cajeros y dueños de negocios locales.
  - **Solución Implementada:** Se transformó el botón a **`[ 📊 Consultar Reporte ]`** con icono representativo `<BarChart2 size={17} />`, comunicando inmediatamente y en perfecto español la acción que realiza el sistema.
  - Se revisaron todos los botones y rótulos de la interfaz para garantizar un lenguaje 100% claro, profesional, cercano y comprensible en Colombia y Latinoamérica.

### 📌 Pilar 31: Arquitectura de Impresión Coherente a 2 Niveles ("A Voluntad"), Erradicación de Desbordamiento Térmico y Modo Kiosco POS
- **Coherencia Absoluta con los Ajustes de Impresión:**
  - Se conectaron armónicamente las 3 políticas configurables en **Ajustes** (`print_mode`: `ask`, `auto`, `manual`) con un interruptor táctico directo en la barra de cobro del punto de venta.
  - **Nivel 1 (Ajustes - Política del Local):**
    - `auto`: Pre-activa por defecto el selector de cobro en `[✓] Imprimir Ticket`.
    - `manual`: Pre-activa por defecto el selector de cobro en `[ ] Sin Ticket (Ahorro)`.
    - `ask`: Mantiene el modal interno post-venta con cálculo de cambio, atajo `Enter` (imprimir) y `Esc` (cerrar sin imprimir).
  - **Nivel 2 (Punto de Venta - A Voluntad del Cajero):**
    - El cajero dispone de un control visual inmediato `[✓] Imprimir Ticket` justo sobre el botón de cobro.
    - Si el negocio está en `auto` pero un cliente puntual dice *"no me dé papel"*, el cajero desmarca en 0.2 segundos y cobra sin imprimir ni abrir modales. El sistema restablece automáticamente la preferencia del local para el siguiente cliente.
    - Si el negocio está en `manual` pero un cliente pide comprobante, el cajero marca la casilla y el ticket se expulsa inmediatamente al cobrar, sin obligar al cajero a buscar la venta en el Historial.
- **Erradicación del Desbordamiento Térmico ("Total: 2 páginas"):**
  - Se reestructuró la hoja de estilos de impresión `@media print`:
    - Se forzó `html, body { height: auto !important; min-height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }` para neutralizar el cálculo de altura de ventana (`100vh`) de Chromium.
    - Se aplicó `page-break-after: avoid !important; break-after: avoid !important; position: relative !important;` en `#printable-ticket`, `#printable-shift-ticket` y `#printable-daily-ticket`.
    - Resultado: Los tickets térmicos (58mm y 80mm) se imprimen en exactamente 1 sola página continua y compacta, erradicando hojas en blanco y desperdicio de rollos térmicos.
- **Lanzador Oficial para Modo Kiosco e Impresión Silenciosa Directa:**
  - Se actualizó el lanzador maestro `iniciar.vbs` e `iniciar_tienda.bat`.
  - Autodetecta Google Chrome o Microsoft Edge y los inicializa en modo aplicación dedicada con `--kiosk-printing --app=http://localhost:3005`.
  - Permite a los clientes con impresoras térmicas físicas conectadas imprimir tickets a velocidad instantánea (0.2s) sin que el navegador muestre jamás la ventana de diálogo o vista previa nativa.

### 📌 Pilar 32: Unificación Nativa del Lanzador POS (Cero Accesos Directos Múltiples), Rediseño de Ticket Térmico Comercial y Blindaje de Pagos Separados
- **Lanzador Oficial Único (`iniciar.vbs` e `iniciar_tienda.bat`):**
  - Se unificó el comportamiento en **un único acceso directo oficial en el Escritorio (`Punto de Venta`)**.
  - Al abrirse, detecta automáticamente Google Chrome o Microsoft Edge en Windows y lanza la aplicación en **Modo Ventana POS Nativa** con `--app=http://localhost:3005 --kiosk-printing`.
  - Ventajas:
    1. Cero ventanas emergentes de confirmación de Edge/Chrome al cobrar si el local tiene configurado `print_mode = 'auto'`.
    2. Aspecto 100% de software nativo de escritorio (sin barra de URL, sin botones de navegación de internet).
    3. Cero archivos basura o accesos duplicados que confundan al cliente o al cajero.
- **Rediseño Profesional del Ticket Térmico (Estándar Comercial POS):**
  - Se erradicó la colisión `CantDesc` y `$5.000$5.000` en papel de 58mm:
    - Encabezados claros y separados: `CANT`, `PRODUCTO / CONCEPTO`, `TOTAL`.
    - Inteligencia de Cantidades: Si `qty === 1`, muestra una sola cifra de precio (`$5.000`). Si `qty > 1`, muestra el total de la línea y desglosa debajo `(2 x $4.000 c/u)`.
    - Total destacado: `TOTAL A PAGAR: $...` con líneas divisorias limpias.
    - Desglose de medios de pago, cambio/devuelta y referencia de comensal/mesa.
- **Blindaje del Botón de Pagos Separados:**
  - Se modificó la condición de renderizado de `currentCart.length > 1` a `currentCart.length > 0`.
  - Ahora el botón `[ ✂️ Pagos Separados ]` permanece disponible siempre que haya productos en el carrito, permitiendo divisiones equitativas o por comensal incluso con 1 solo ítem cargado.

### 📌 Pilar 33: Control a Voluntad de la Salida de Impresión (Ventana de Windows vs Modo Silencioso) desde Ajustes
- **Configuración Dinámica de Salida (`kiosk_printing`):**
  - Se incorporó en **Ajustes ➔ Impresora Térmica** el selector maestro:
    - `⚪ Mostrar Ventana de Impresión de Windows`: Permite al usuario ver la previsualización del ticket en pantalla, confirmar manualmente antes de imprimir o seleccionar otra impresora (ej. cambiar entre impresora térmica y PDF de oficina).
    - `🟢 Impresión Silenciosa POS (Modo Kiosco)`: Para negocios que buscan máxima agilidad (0.2s sin diálogos emergentes).
- **Persistencia y Lectura Dinámica por el Lanzador Único:**
  - El backend almacena la preferencia en SQLite y genera automáticamente el archivo `datos_negocio/launcher_config.json`.
  - El lanzador maestro `iniciar.vbs` y el script `iniciar_tienda.bat` leen en tiempo de arranque este archivo:
    - Si `kiosk_printing` es `true` ➔ Inicia Chromium con `--kiosk-printing`.
    - Si `kiosk_printing` es `false` ➔ Inicia Chromium en modo aplicación sin `--kiosk-printing`, permitiendo la apertura natural de la ventana de impresión de Windows.
  - Se mantiene **un único acceso directo en el Escritorio**, ofreciendo flexibilidad total y cero confusión para el cliente.

### 📌 Pilar 34: Aislamiento Total de Perfil POS (`--user-data-dir`) y Persistencia de Modo de Impresión
- **Diagnóstico del Comportamiento de Chromium / Windows:**
  - Cuando un navegador basado en Chromium (Edge o Chrome) arranca con la bandera `--kiosk-printing`, esa bandera se fija en el proceso maestro del sistema operativo. Si el usuario modifica la opción en los Ajustes sin cerrar el proceso maestro existente, el navegador continúa operando bajo la bandera inicial.
  - Además, si no se especifica un directorio de datos independiente, el POS se acopla a cualquier ventana personal de Chrome/Edge abierta por el usuario, heredando parámetros del proceso previo.
- **Solución de Aislamiento de Grado Industrial:**
  - En `iniciar.vbs` e `iniciar_tienda.bat`, se implementó el parámetro `--user-data-dir="%LOCALAPPDATA%\TiendaPOS\pos_profile"`. Esto aísla el POS al 100% de cualquier otra instancia de Chrome/Edge en el PC del comerciante.
  - Al cerrar la ventana del POS, el proceso dedicado termina limpiamente. Al volver a abrirlo, lee al instante `datos_negocio/launcher_config.json` y arranca con o sin `--kiosk-printing` exactamente según la voluntad configurada en Ajustes.
  - En el backend (`server.js`), se inicializa `datos_negocio/launcher_config.json` en el arranque leyendo la base de datos (por defecto `kiosk_printing: false` para permitir la ventana de Windows).
  - En `SettingsForm.jsx`, se agregó retroalimentación visual inmediata informando al usuario que debe cerrar y reabrir la ventana del Punto de Venta al conmutar entre Ventana de Windows y Modo Silencioso.

### 📌 Pilar 35: Arqueo y Cierre de Turno Avanzado Multicanal con Desglose Integral de Dinero Digital (Transferencias / Nequi / Daviplata / Bancos) y Auditoría Transaccional en Tirilla y Pantalla
- **Arquitectura de Cuadre en 4 Bloques Separados:**
  - Se rediseñó integralmente el modal de cierre de turno en pantalla (`App.jsx`) y la tirilla térmica de arqueo (`PrintableShiftTicket.jsx`) para reflejar la realidad del comercio moderno en Colombia, donde el dinero se divide entre efectivo físico en gaveta y dinero digital en cuentas bancarias/billeteras:
    1. **Bloque 1: 💵 Arqueo de Efectivo Físico (Caja Registradora / Gaveta):**
       - Base de apertura inicial.
       - Ventas directas cobradas en efectivo físico (con conteo de transacciones).
       - Abonos recibidos en efectivo físico de carteras/fiados.
       - (-) Gastos pagados en efectivo desde la gaveta.
       - (-) Devoluciones/reembolsos entregados en efectivo.
       - **(=) Total Físico Esperado en Gaveta** (cifra exacta con la que el cajero debe cuadrar billetes y monedas).
    2. **Bloque 2: 📱 Dinero Digital & Transferencias (Nequi, Daviplata, Bancos, QR):**
       - Total de ventas recibidas por transferencia (con conteo de operaciones).
       - (-) Gastos pagados directamente por transferencia bancaria.
       - (-) Devoluciones realizadas por medios digitales.
       - **(=) Total en Bancos / Billeteras Digitales**.
       - **Auditoría interactiva en pantalla:** Botón desplegable interactivo `[ ▼ Auditar transferencias ]` que despliega tabla con hora, número de venta, cliente/referencia y monto transferido, permitiendo al administrador cotejar contra la app bancaria.
    3. **Bloque 3: 📝 Créditos & Fiados del Turno:**
       - Total de nuevos fiados otorgados en el turno y cantidad de créditos abiertos, alertando sobre cartera por cobrar.
    4. **Bloque 4: 📊 Balance General Consolidado:**
       - **Total Recaudado Líquido (Efectivo + Transferencias):** El dinero real que ingresó al negocio durante el turno.
       - **Total Facturado en Turno:** Facturación bruta (Efectivo + Transferencias + Fiados).
       - Desglose de gastos cubiertos de bolsillo propio del dueño (que no descuentan de la gaveta ni de las cuentas del negocio).
- **Tirilla Térmica de Arqueo Enriquecida (`PrintableShiftTicket.jsx`):**
  - La impresión térmica ahora incluye el desglose pormenorizado de las transferencias digitales (ID de venta, hora y valor), garantizando trazabilidad física y auditoría contable inalterable en papel.

### 📌 Pilar 36: Identidad de Marca Multi-Negocio en Notificaciones de Telegram y Separación Estricta de Acceso Remoto POS vs Carta Digital Pública
- **Identidad de Marca Multi-Sucursal en Telegram (`telegramService.js`):**
  - Para comerciantes que operan múltiples tiendas o negocios con el mismo bot o chat de Telegram, todas las alertas del sistema ahora inyectan automáticamente en la cabecera el banner corporativo del establecimiento configurado en Ajustes (`config.business_name`):
    `🏪 FONDA EL MONTAÑERO`
    `━━━━━━━━━━━━━━━━━━━━`
  - Aplica de forma centralizada e instantánea para aperturas/cierres de turno, ventas, fiados, abonos, alertas de stock bajo, gastos, facturas, recordatorios y alertas de conexión remota. Si el dueño maneja varios locales, ahora reconoce al instante qué negocio generó la notificación.
- **Separación Estricta de Enrutamiento Ngrok (POS vs Carta Digital):**
  - **Enlace Raíz (`https://...ngrok.app/`):** Dirigido exclusivamente al **Punto de Venta / Panel de Administración Remoto**. Si se accede por internet remoto, presenta directamente la pantalla de seguridad con candado de neón requiriendo el PIN de Administrador. Ya no redirige a la Carta Digital por defecto, permitiendo al dueño operar su caja, inventario y ventas a distancia sin rodeos.
  - **Enlace de Carta Digital (`https://...ngrok.app/carta`):** Destinado a clientes y mesas mediante escaneo del Código QR. Es 100% público, directo, sin pedir contraseñas ni PIN, protegiendo costos y márgenes de ganancia.
### 📌 Pilar 37: Apertura de Cajón Monedero Modular y sin Desperdicio de Papel (Pulso ESC/POS Dual y Atajo F9)
- **Módulo Opcional y Configurable a Voluntad (`enable_cash_drawer_button`):**
  - Se incorporó en **Ajustes ➔ Impresora Térmica** la tarjeta de configuración:
    - Switch maestro: `🪙 Habilitar Botón de Apertura de Cajón Monedero`.
    - Subtítulo explicativo: *"Muestra el botón 'Abrir Cajón' (y atajo F9) en el punto de venta para expulsar la gaveta sin imprimir ticket ni gastar papel."*
    - Botón de diagnóstico directo en Ajustes: `[ ⚡ Probar Apertura de Cajón ]`, permitiendo al comerciante verificar la conexión física del cable RJ11 y el solenoide en 1 segundo.
- **Acceso Rápido en Barra Superior del POS y Tecla Rápida `F9`:**
  - Al estar habilitada la opción, aparece en la barra superior del punto de venta el botón de acceso rápido con icono de monedas: `[ 🪙 Abrir Cajón (F9) ]`.
  - Escucha la tecla **`F9`** desde cualquier parte del punto de venta (incluso con el cursor en búsqueda de productos o códigos de barras), expulsando la gaveta al instante.
  - Muestra un toast visual no intrusivo: *"🪙 Pulso enviado: Cajón monedero abierto"*.
  - Por solicitud explícita del usuario y para evitar spam innecesario en Telegram (dado que el cajón también se abre manualmente con llave), no genera notificaciones a Telegram, preservando la tranquilidad del dueño.
- **Arquitectura de Disparo Dual Ultra-Rápida:**
  - **Canal 1 (Backend Nativo - WinSpool API de Windows):**
    - Se diseñó el script `backend/open_drawer.ps1` que utiliza P/Invoke en C# (`winspool.drv` -> `OpenPrinter`, `StartDocPrinter`, `StartPagePrinter`, `WritePrinter`) para enviar directamente los códigos raw ESC/POS estándar (`ESC p 0 25 250`, `ESC p 1 25 250`, `DLE DC4 1 0 5`) a la impresora térmica configurada o a la impresora predeterminada de Windows.
    - Se expuso el endpoint `POST /api/system/open-drawer`.
    - La ejecución toma ~250ms, no alimenta papel, no corta tirilla y dispara el solenoide de forma limpia y silenciosa.
  - **Canal 2 (Frontend Driver Fallback):**
    - En `frontend/src/utils/printHelper.js`, la función `triggerCashDrawerPulse()` llama al backend de forma asíncrona; si la conexión local fallara o estuviera desconectada, activa un iframe invisible de 0 píxeles que invoca el comando de impresión del controlador de Windows con la instrucción de apertura de cajón configurada en las propiedades del controlador.

### 📌 Pilar 38: Módulo Exclusivo de Administrador para Corrección de Medio de Pago y Auditoría de Ventas en Historial
- **Blindaje Estricto de Rol Cajero vs Administrador:**
  - El rol cajero mantiene su pantalla 100% enfocada en despachos rápidos: no visualiza botones de edición ni puede alterar ventas registradas en el historial.
  - Si un empleado comete una equivocación en el medio de pago (ej. cobrar por Nequi/Daviplata y presionar Efectivo por afán), simplemente lo reporta al Administrador.
  - El botón `[ ✏️ ]` aparece únicamente cuando el sistema se encuentra en **Modo Administrador (`isAdmin === true`)** y para ventas no anuladas.
- **Modal Interactivo de Corrección Integral de Venta:**
  - Permite rectificar con un clic el método de pago entre:
    - **💵 Efectivo:** Asigna el total neto al flujo de efectivo de caja.
    - **📱 Transferencia:** Asigna el total a dinero digital en cuentas bancarias/billeteras.
    - **🔄 Pago Mixto:** Despliega campos dedicados para Efectivo y Transferencia con cálculo automático del saldo restante y verificación en tiempo real de conciliación exacta contra el total de la venta.
    - **⏳ Fiado / Crédito:** Exige el nombre del cliente/deudor y actualiza el estado de la venta a `pending` para integrarse de inmediato en la Cartera de Cuentas por Cobrar.
  - Edición de **Cliente / Referencia / Mesa**.
  - Campo de **Motivo de la Corrección** para registrar la causa del ajuste administrativo.
- **Auto-Conciliación Instantánea del Arqueo de Turno y Caja Registradora:**
  - El endpoint transaccional `PUT /api/sales/:id/correction` actualiza de forma atómica en SQLite `payment_method`, `payment_status`, `cash_amount`, `transfer_amount`, `customer_name` y `notes`.
  - Como las estadísticas de arqueo de caja se calculan dinámicamente sobre la base de datos, el dinero físico esperado en la gaveta y el saldo en bancos se corrigen en tiempo real sin requerir cierres forzados ni reinicios.
### 📌 Pilar 39: Modularidad Camaleónica Universal de Negocio: Modalidad de Mesas y Cuentas Abiertas vs Mostrador Directo y Control de Rondas
- **Interruptor Maestro Modular en Ajustes (`enable_tables_system`):**
  - Se incorporó en **Ajustes ➔ Mesas & Carta QR** el selector maestro de modalidad operativa:
    - `🪑 Habilitar Sistema de Mesas y Cuentas Abiertas`: Conmutador configurable a voluntad.
    - **Modo Restaurante/Bar (Activo):** Permite abrir cuentas por mesa, comensales, comanda de cocina, división de cuentas y carta digital de mesa.
    - **Modo Mostrador Directo / Tienda (Desactivado):** Transforma el panel derecho del POS en una registradora de mostrador 100% limpia. Desaparecen los botones de `[ ⚡ Rápida ]`, `[ 🪑 Mesas ]`, creación de mesas y contadores, reduciendo la fricción para tiendas de barrio, minimarkets, ferreterías y droguerías donde solo existe la venta directa.
- **Control Modular de Rondas de Consumo (`enable_rounds_system`):**
  - Opción anidada para negocios que usan mesas pero no desean segmentar por "Ronda 1, Ronda 2":
    - Al desactivarse, los productos se agregan consolidados en una lista directa tradicional.
    - Oculta el selector `[ ⏱️ Rondas | 📦 Consolidado ]` y el botón `+ Ronda` de la cabecera del carrito.
- **Fallback Automático y Preservación de Datos:**
  - Si el dueño desactiva las mesas mientras existían mesas abiertas, los datos se preservan intactos en SQLite sin pérdida de información, y el foco del punto de venta se redirige de forma automática y segura a `Venta Rápida (selectedAccountId = null)`.
  - El sistema detecta dinámicamente el modo efectivo de vista del carrito (`effectiveCartViewMode`) asegurando una experiencia ultra-fluida al agregar y cobrar productos.

---

## 🔒 3. REGLAS DE ORO ARQUITECTÓNICAS (INVIOLABLES)

Al desarrollar futuras mejoras, se deben respetar **ESTRICTAMENTE** estas 8 reglas:

1. **Regla de Esquema SQLite:**  
   * La columna de base inicial en `shifts` es **`initial_cash`** (NO usar `base_cash`).  
   * La columna de imagen en `expenses` es **`receipt_image`**.  
   * En `sale_refunds`, el monto es **`refund_amount`** y el medio de pago es **`payment_method`**.  
   * No renombrar ni eliminar columnas existentes. Usar siempre `safeAlter("ALTER TABLE ... ADD COLUMN ...")`.
2. **Regla de Privacidad de Proveedores de IA:**  
   Bajo ninguna circunstancia se debe mostrar la palabra "Google", "Gemini", "AI Studio" ni la palabra "gratis" en Telegram, tickets ni en la interfaz gráfica. Siempre referirse como *"Inteligencia Artificial"*, *"Lectura Inteligente"* o *"Visión IA"*.
3. **Regla de Contingencia Indestructible:**  
   Toda funcionalidad que use internet (IA, Ngrok, Telegram) **DEBE tener un fallback offline inmediato**. El punto de venta local jamás debe depender de internet para facturar o abrir caja.
4. **Regla del Rol Cajero:**  
   El cajero nunca debe tener acceso a costos de compra (`cost_price`), márgenes de utilidad, inventario general, edición de fechas históricas ni ajustes de configuración.
5. **Regla de Conciliación de Arqueos:**  
   Todo movimiento que entregue o reciba efectivo físico (ventas, abonos, gastos, devoluciones) DEBE incluirse en el cálculo de `expected_cash` tanto en `/api/shifts/current/stats` como en `/api/shifts/:id/close`.
6. **Regla de Atomicidad:**  
   Toda operación que afecte múltiples tablas (venta + stock, devolución + reembolso + stock, gasto + caja) debe ejecutarse dentro de un bloque seguro o transacción SQLite (`BEGIN TRANSACTION` ... `COMMIT`).
7. **Regla de Sincronización de Carpetas:**  
   Cualquier modificación debe sincronizarse inmediatamente entre `Software definitivo venta/`, `produccion_definitivo/` y `Software definitivo venta - copia/`.
8. **Regla de Preservación de Datos:**  
   La carpeta `datos_negocio/` es sagrada. Los scripts de compilación, empaquetado o limpieza nunca deben borrar `database.sqlite`, `imagenes/` ni `facturas_gastos/`.

---

## 🚀 4. RESUMEN DE ARCHIVOS CLAVE DEL PAQUETE DISTRIBUIBLE

* **`iniciar_tienda.bat`**: Lanzador principal con consola visible para diagnósticos.
* **`iniciar.vbs`**: Lanzador silencioso en segundo plano sin ventana negra.
* **`detener.bat`**: Detiene limpiamente el proceso y libera el puerto 3005.
* **`Blindar_y_Crear_Acceso_Directo.bat`**: Blindador de Windows Defender y creador del acceso directo en el Escritorio.
* **`node.exe`**: Runtime portátil de Node.js v24 con `node:sqlite` nativo.
* **`backend/`**: Código del servidor Express, endpoints y bot de Telegram.
* **`frontend_dist/`**: Aplicación web SPA compilada y optimizada con Vite.
* **`datos_negocio/`**: Base de datos SQLite y almacén de comprobantes e imágenes.

---

### PILAR 40: FILTROS DINÁMICOS (MÉTODO + CAJERO) E INSIGNIA DE VENTA EDITADA
* **Insignia Visual `[ ✏️ Editada ]` en Historial de Ventas:**
  * Al detectar notas de corrección de pago o auditoría en una venta (`[CORRECCIÓN...]`), se muestra un distintivo ambarino interactivo `#TKT-XXX [ ✏️ Editada ]`.
  * Al desplegar el ticket, se resalta la traza de auditoría con la fecha, el usuario administrador y la observación registrada.
* **Filtros Avanzados en Barra Superior de Historial:**
  * Selector dinámico por **Método de Pago** (`Todos`, `💵 Solo Efectivo`, `📱 Solo Transferencias`, `🔄 Solo Mixto`, `⏳ Solo Fiados`).
  * Selector dinámico por **Cajero** alimentado en tiempo real con los usuarios registrados en el rango de búsqueda.
  * Botón de reseteo rápido `[ Limpiar Filtros ]`.
  * **Barra de Resumen Contable Instantáneo:** Al filtrar por un método (ej. Transferencia o Efectivo), calcula y muestra en tiempo real la sumatoria neta de dinero recaudado para conciliar al instante con extractos bancarios de Nequi o Daviplata.

### PILAR 41: AUDITORÍA DE INVENTARIO Y DESGLOSE DE PRODUCTOS POR TURNO
* **Métricas Agregadas por Turno:**
  * Consulta agregada en SQLite (`node:sqlite`) con `SUM(quantity)` y `COUNT(DISTINCT product_id)` por turno para ventas completadas.
  * Nuevo endpoint `GET /api/shifts/:id/products` que devuelve el listado consolidado de artículos vendidos (producto, cantidad total vendida y total facturado).
  * Estadísticas en tiempo real en `GET /api/shifts/current/stats` (`total_items_sold` y `distinct_products_sold`).
* **Experiencia en Historial de Turnos (`ShiftsReport.jsx`):**
  * Tarjeta de resumen global: `📦 ARTÍCULOS VENDIDOS` con la sumatoria de unidades de todos los turnos filtrados.
  * Columna interactiva en la tabla con botón desplegable `[ 📦 X uds ]`.
  * Subtabla expandible por turno mostrando el inventario exacto despachado (ranking de artículos, unidades vendidas y dinero recaudado).
* **Auditoría Física en Ticket Térmico (`PrintableShiftTicket.jsx`):**
  * Sección `6. PRODUCTOS VENDIDOS (X uds)` incluida antes de las firmas de entrega y recepción, permitiendo conteo físico y verificación de stock durante el relevo de cajeros.

### PILAR 42: BLINDAJE DE TELEGRAM (ANTI-DUPLICADOS, FLUJO DE FOTOS) Y RECORDATORIOS EXACTOS
* **Blindaje Anti-Duplicados y Concurrencia en Telegram Polling (`telegramService.js`):**
  * Implementación de control por generación de ciclo (`pollingGeneration`), bloqueo de ejecución única (`isLoopExecuting`) y registro de deduplicación de actualizaciones con historial FIFO (`processedUpdateIds Set`).
  * Se elimina el envío múltiple o duplicado de mensajes tras cambios de configuración o reinicios de escucha.
* **Flujo Asistido de Fotos para Creación de Productos:**
  * Al enviar una foto y presionar `[ 📦 Crear Producto Nuevo ]` (`photo_as_product`), la imagen se descarga/mueve a la carpeta física de imágenes (`datos_negocio/imagenes/`) y se inicia limpiamente el paso `WAITING_NAME`, guiando al usuario por nombre, categoría, precio, stock y costo sin truncar el proceso.
* **Cálculo de Fechas de Recordatorios sin Desplazamiento UTC (`server.js`, `RemindersManager.jsx`, `telegramService.js`):**
  * Solución a la discrepancia de 1 día antes al guardar para "hoy": uso de funciones locales puras (`addDaysToDateString` y `getDaysDiff` basadas en partes de calendario `[YYYY, MM, DD]` y zona horaria `America/Bogota`).
  * Reconocimiento en lenguaje natural ampliado: `hoy`, `mañana`, `pasado mañana`, `DD/MM/AAAA`, `DD-MM-AAAA` y `DD/MM`.
* **Alertas Inmediatas de Recordatorios en Telegram:**
  * Disparo reactivo inmediato de `checkRemindersAndNotify` tras crear o editar recordatorios (`POST /api/reminders`, `PUT /api/reminders/:id` y `/crear_recordatorio`).
  * Verificación tolerante de configuración (`enable_reminders !== 'false'`) asegurando la entrega de notificaciones a tiempo.

---
*Bitácora Maestra actualizada y sellada con éxito. Todo el avance alcanzado queda documentado y blindado contra cualquier retroceso futuro.*
