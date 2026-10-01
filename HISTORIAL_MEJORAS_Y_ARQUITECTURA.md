# 📘 MANUAL MAESTRO DE ARQUITECTURA, MEJORAS Y REGLAS DE NO-REGRESIÓN
> **Software Definitivo Punto de Venta e Inventario**  
> *Fecha de consolidación: 8 de Septiembre de 2026*  
> *Huso Horario Oficial: Colombia (UTC-5 / America/Bogota)*  
> *Directorio de Despliegue Principal:* `produccion_definitivo/`

---

## 📌 1. Arquitectura y Aislamiento de Datos de Negocio
Para garantizar que el software sea 100% actualizable sin riesgo de pérdida de información, los datos vivos están estrictamente separados del código ejecutable:

* **Directorio de Datos:** `datos_negocio/`
  * `database.sqlite`: Base de datos viva relacional (SQLite con soporte de foreign keys e índices).
  * `imagenes/`: Almacén de fotos de productos subidas por el usuario.
  * `backups/`: Copias de seguridad automáticas diarias (`database_backup_YYYY-MM-DD.sqlite`).
* **Regla de Oro:** Ningún instalador, script de actualización o comando de compilación debe sobrescribir o limpiar la carpeta `datos_negocio/`.

---

## 🕒 2. Estándar de Zona Horaria (Colombia UTC-5)
Para evitar discrepancias entre el reloj del servidor y la fecha de corte comercial:
1. **En Consultas SQL (Backend SQLite):**
   * Siempre utilizar: `date(created_at, '-5 hours')` o `date(paid_at, '-5 hours')`.
   * Esto asegura que las ventas realizadas entre 7:00 p.m. y medianoche pertenezcan al día calendario comercial de Colombia y no al día siguiente en UTC.
2. **En Backend Node.js:**
   * Utilizar la función oficial:
     ```javascript
     function getLocalTodayStr() {
       return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
     }
     ```
3. **En Frontend React:**
   * Formatear timestamps con: `.toLocaleString('es-CO', { timeZone: 'America/Bogota' })`.

---

## 🛡️ 3. Turnos de Caja e Inviolabilidad Operativa
El sistema maneja un control estricto de caja por cajero y turno:
1. **Regla de Navegación (`App.jsx`):**
   * Si en la base de datos no hay ningún turno con `status = 'open'`, la aplicación exige inmediatamente la pantalla de **"Apertura de Caja"**.
2. **Blindaje de Turno Activo (No-Regresión):**
   * En `backend/server.js` (`DELETE /api/shifts/:id`), **está prohibido eliminar un turno en estado `'open'`**. El servidor rechaza la petición con código `400`.
   * En `ShiftsReport.jsx`, el botón de eliminación aparece inhabilitado (`disabled`) con aviso explicativo para cualquier turno abierto.
3. **Cuadre de Cierre:**
   * Registra Ventas en Efectivo, Transferencias, Abonos Cobrados de Cartera, Ventas a Crédito (Fiados), Gastos y Descuadres (Sobrante/Faltante), notificando el balance exacto a Telegram.

---

## 💳 4. Créditos, Fiados y Abonos de Cartera
1. **Registro de Cobro (`POST /api/sales/:id/pay`):**
   * **Resolución Automática de Turno:** Si no se especifica `shift_id`, el backend busca y vincula automáticamente el turno abierto actual (`targetShiftId`).
   * **Desglose Obligatorio:** Se calculan y guardan con exactitud `cash_amount` y `transfer_amount` (evitando valores `NULL` que omitan el dinero del cuadre de caja).
   * **Abonos Parciales:** Crean una venta hija (`status = 'completed'`, `payment_status = 'paid'`, `customer_name = 'Abono: ...'`, `parent_sale_id = id_padre`) y descuentan el total de la deuda original.
   * **Liquidación Total:** Cambia el estado a `'paid'`, registra fecha de cobro y asigna el dinero al turno de pago.
2. **Reversión de Cobros (`POST /api/sales/:id/revert-payment`):**
   * Protegido por contraseña de Administrador.
   * Si es un abono parcial, elimina la venta hija y reintegra el dinero a la cuenta pendiente del cliente.
   * Si es liquidación total, regresa la cuenta a `payment_status = 'pending'` y `payment_method = 'Fiado'`.

---

## 📦 5. Inventario, Valoración Económica y Alertas de Stock
1. **Valoración Económica Inteligente (`InventoryManager.jsx`):**
   * **Valor Comercial:** Suma de `(Stock × Precio de Venta al Público)`.
   * **Capital Invertido:** Suma de `(Stock × Precio de Costo)` de los productos costeados.
   * **Ganancia Proyectada:** Utilidad real estimada (`Valor Venta - Valor Costo`). No falsea 100% de ganancia en artículos con costo `$0`.
   * **Adaptabilidad a Ajustes (`enable_profit_tracking`):**
     * Si está apagado: Muestra vista 100% comercial (Valor Venta, Unidades Físicas, Referencias y Alertas).
     * Si está encendido: Muestra las 4 tarjetas financieras completas y el botón rápido `[ 🏷️ Ver Sin Costo (N) ]` para completar precios de compra.
   * **Nueva Columna en Tabla:** "Valor en Stock" visible por fila y reflejado en el reporte PDF.
2. **Notificaciones de Stock a Telegram:**
   * **Condicionado a `strict_inventory`:** Si el inventario estricto está apagado en Ajustes, NO se envían mensajes a Telegram por stock bajo o agotado.
   * **Orden de Deducción:** La deducción física se guarda en la base de datos **antes** de evaluar el stock restante, garantizando que Telegram reporte el saldo real remanente.
3. **Diferenciación Matemática entre "Agotado" y "Alerta de Stock Bajo":**
   * El sistema distingue con total claridad entre:
     * `🔴 X AGOTADOS (stock = 0)`
     * `🟠 Y CON STOCK BAJO (0 < stock <= min_stock)`
   * El botón de filtrado rápido muestra: `[ ⚠️ Ver Alertas (X agotados / Y stock bajo) ]`, eliminando falsas alarmas cuando quedan pocas unidades de alto valor.
4. **Modo Venta Limpia (Cuando `strict_inventory = false`):**
   * En el catálogo del POS (`App.jsx`), se ocultan las insignias rojas de "AGOTADO" y el número de stock cuando el control estricto está apagado.
   * Permite ventas fluidas sin bloqueos mientras se mantiene la trazabilidad absoluta de unidades vendidas e ingresos en reportes y base de datos.
5. **Entrada Rápida de Mercancía (`+`):**
   * Botón directo esmeralda en la tabla de inventario que suma cantidades al stock actual mediante `/api/products/adjust-stock/:id`, evitando errores de reemplazo de stock total.
6. **Sincronización en Tiempo Real Multi-Dispositivo (Ngrok y Terminales Secundarios):**
   * Auto-refresco en segundo plano cada 25 segundos y cada vez que la pestaña recupera el foco (`window.addEventListener('focus')`), sincronizando cambios de inventario hechos desde teléfonos u otros equipos de forma transparente.
8. **Bot Interactivo y Bidireccional de Telegram (`telegramService.js`):**
   * **Sin dependencias externas:** Implementado con `https` nativo mediante *Long Polling* autónomo (`getUpdates`), compatible con Windows y Termux Android.
   * **Seguridad Estricta:** Solo procesa mensajes que provengan del `telegram_chat_id` registrado en la base de datos de la tienda.
   * **Comandos Tolerantes:** Procesamiento *case-insensitive* y sin acentos (`/caja`, `caja`, `gasto 15000 hielo`, `/stock aguila 12`).
   * **Menú y Botón Nativo:** Auto-registro de comandos con `setMyCommands` para mostrar el botón azul de menú en Telegram.
   * **Asistente de Creación de Productos con Foto (`/crear`):** Descarga fotos de Telegram directo a `datos_negocio/imagenes/` y registra el producto en SQLite en 5 pasos interactivos con timeout de seguridad.
   * **Gestión Integral de Stock Remoto (+, -, =):**
      * `/abastecer [producto] [cant]` o `/stock [producto] [cant]`: Entrada de mercancía (+ unidades).
      * `/quitar [producto] [cant]`, `/merma` o `/salida`: Reducción de existencias por rotura, vencimiento o consumo (- unidades), con blindaje contra números negativos (`Math.max(0, ...)`).
      * `/ajustar_stock [producto] [total]`: Fijar el inventario físico exacto tras conteo en bodega.
   * **Valorización y Descarga de Inventario Remoto (`/inventario`):**
      * Muestra un **Resumen Ejecutivo** inmediato con referencias activas, unidades totales, capital invertido (costo), valor comercial (venta), ganancia bruta proyectada, margen y alertas de agotados / stock bajo.
      * **Confirmación Interactiva Doble (Botones + Texto):** Incluye botones táctiles `[ 📥 Descargar Excel (CSV) ]` y `[ ❌ No, solo el resumen ]` procesados vía `callback_query`, y también responde a respuestas por texto ("sí", "descargar", "no", "cancelar").
      * **Identidad de Negocio Institucional en Notificaciones:**
       * Todas las notificaciones salientes automáticas (`sendTelegramMessage`) incorporan de forma estándar el encabezado de identidad del negocio:
         `🏪 [NOMBRE DEL NEGOCIO]`
         `━━━━━━━━━━━━━━━━━━━━`
       * Si un mismo dueño tiene varias sucursales o tiendas apuntando al mismo bot o chat de Telegram, puede identificar inmediatamente de qué establecimiento procede cada evento.
    * **Visualización Remota para Celulares (Vista Computador Miniatura Dinámica):**
       * Al acceder desde un dispositivo móvil (por túnel Ngrok o red local), el sistema inyecta dinámicamente un viewport de escritorio panorámico (`width=1200, initial-scale=screen.width/1200, user-scalable=yes`).
       * La interfaz no se deforma ni se apila en una sola columna vertical gigante: se visualiza de forma idéntica a la pantalla del computador (productos a la izquierda, carrito y cuentas a la derecha, barra de navegación completa).
       * Soporta navegación táctil fluida con zoom de pellizco (*pinch-to-zoom*) para inspeccionar cualquier detalle o pulsar botones con facilidad.
       * Se eliminó el botón manual de cambio de modo en la cabecera, manteniéndola limpia y 100% enfocada en las operaciones del negocio.
    * **Seguridad y Pantalla de Bloqueo Remota (Ngrok):**
       * Al ingresar desde internet, la pantalla exige la Contraseña de Administrador con interfaz profesional estilo panel de acceso seguro.
       * **Cero exposición de credenciales:** Se eliminó cualquier pista visual de contraseña pública ("💡 Clave por defecto inicial: 1234").
       * **Validación en Servidor:** El desbloqueo ya no compara contraseñas en el frontend; se procesa de forma segura mediante el endpoint `POST /api/auth/verify-admin-pin`, devolviendo `200` si es correcta o `401` si es rechazada.
    * **Gestión y Administración Total de Catálogo por Telegram (`telegramService.js`):**
       * **Prevención Inteligente Anti-Duplicados (`/crear`):** En el paso 2 del asistente (`WAITING_NAME`), se compara el nombre normalizado contra la base de datos completa. Si ya existe un producto con el mismo nombre, el bot bloquea la creación, muestra la ficha del producto existente (ID, precio, stock, categoría) e instruye al comerciante a diferenciar el nombre o reabastecerlo/editarlo con `/abastecer` o `/cambiar_precio`.
       * **Eliminación Segura de Productos (`/eliminar [prod]` o `/borrar`):** Búsqueda inteligente por nombre o paso interactivo si no se envía argumento. Incluye confirmación obligatoria con detalles del producto y botones táctiles interactivos (`[ 🗑️ Sí, eliminar producto ]` / `[ ❌ No, cancelar ]`), impidiendo borrados accidentales.
       * **Actualización Remota de Foto (`/cambiar_foto [prod]` o `/foto`):** Permite buscar un producto y actualizar su imagen simplemente enviando una nueva foto desde la cámara o galería del teléfono. El bot descarga, optimiza y vincula la imagen en SQLite de inmediato.
       * **Ficha Completa y Opciones de Edición (`/editar [prod]`, `/info`, `/detalle`):** Muestra el resumen completo del producto (ID, nombre, categoría, precios de venta y costo, ganancia unitaria neta, margen comercial %, stock actual y estado de foto) junto con comandos de un solo toque para modificar cualquier atributo.
       * **Registro Inteligente de Gastos de Caja (`/gasto`):** Funciona tanto en sintaxis directa (`/gasto 25.000 Hielo y vasos`) como en modo asistido interactivo paso a paso si el usuario solo escribe `/gasto` (solicitando primero el monto y luego el concepto).
       * **Operaciones de Stock Asistidas:** Los comandos `/abastecer`, `/quitar`, `/ajustar_stock`, `/precio` y `/cambiar_precio` ahora guían interactivamente al usuario si los envía sin argumentos, eliminando la necesidad de recordar sintaxis complejas.
       * **Menú Profesional Reorganizado y Autocompletado Telegram:** Se categorizó visualmente `/menu` en cuatro bloques ejecutivos (Ventas y Balance, Inventario y Stock, Gestión de Productos, y Caja Chica y Gastos) y se sincronizó con la API nativa de Telegram (`setMyCommands`) para que la barra de comandos "/" del chat muestre todas las herramientas disponibles.
       * **Sistema de Facturas y Comprobantes de Gastos Físicos y Remotos:**
          * **Almacenamiento Físico Aislado:** Se creó la carpeta `datos_negocio/facturas_gastos/`, respaldada junto con la base de datos y las imágenes de productos, y servida estáticamente vía `/api/facturas/`.
          * **Nomenclatura Estandarizada y Cronológica en Disco:** Los archivos de facturas se renombran automáticamente según el patrón: `Gasto_#ID_YYYY-MM-DD_HH-mm_Concepto_Monto.jpg` (ej: `Gasto_#42_2026-09-14_15-30_Hielo_y_Vasos_$35000.jpg`), lo que permite que el dueño pueda ordenarlos cronológicamente en Windows o buscarlos directamente en el Explorador de Archivos por concepto, fecha o valor.
          * **Captura Inteligente y Resiliente en Telegram (`/factura` o foto con caption):**
             * El usuario puede enviar la foto directamente o invocar el comando `/factura`.
             * **Arquitectura de Doble Capa (Híbrida):** Si existe `gemini_api_key` en la configuración del sistema, analiza el comprobante con Visión de Google Gemini (1.5 Flash) extrayendo automáticamente el proveedor, monto neto final pagado, concepto y fecha.
             * **Fallback Indestructible:** Si no hay API Key o falla la conexión, el sistema almacena la foto de inmediato y solicita el valor por texto sin arrojar errores ni bloquear al usuario.
             * **Confirmación Humana:** Presenta una tarjeta interactiva con botones táctiles (`[ ✅ Sí, registrar gasto ]`, `[ ✏️ Cambiar valor ]`, `[ ❌ Cancelar ]`) antes de descontar el dinero de caja.
          * **Búsqueda y Recuperación de Facturas por Telegram:**
             * `/buscar_gasto [palabra]` o `/gastos`: Busca en el historial de gastos y muestra el ID, fecha, concepto, valor y si tiene foto adjunta.
             * `/ver_factura [ID]`: Envía la foto original del comprobante en alta resolución directamente al chat de Telegram usando `sendPhoto` nativo.
          * **Visor de Facturas en el Punto de Venta Web (`AccountingManager.jsx`):**
             * La tabla de gastos en caja incluye la columna **Comprobante** con el botón `[ 📄 Ver ]`.
             * Al hacer clic, abre un modal en pantalla con la foto completa del recibo, detalles del gasto y un enlace para descargar o imprimir la imagen en alta definición para auditorías o contabilidad.

---

## 📋 7. Checklist de Verificación para Futuros Desarrollos (Reglas de No-Regresión)
Antes de entregar o desplegar cualquier nueva mejora futura, verificar siempre:
* [ ] ¿La base de datos sigue apuntando a `datos_negocio/database.sqlite`?
* [ ] ¿Las consultas por fecha utilizan `date(..., '-5 hours')` para Colombia?
* [ ] ¿El endpoint `DELETE /api/shifts/:id` sigue impidiendo borrar turnos abiertos?
* [ ] ¿Los abonos en `/api/sales/:id/pay` desglosan `cash_amount` y `transfer_amount` sin dejar campos en `NULL`?
* [ ] ¿Los abonos y pagos de deuda envían notificación con saldo restante a Telegram?
* [ ] ¿Todas las notificaciones de Telegram llevan la cabecera con el nombre institucional del negocio?
* [ ] ¿En modo de stock estricto se mantiene `MAX(0, stock - ?)` impidiendo números negativos?
* [ ] ¿Las tarjetas de venta en `App.jsx` respetan el modo venta limpia si `strict_inventory` está desactivado?
* [ ] ¿El auto-refresco en foco y de 25s en `App.jsx` sigue activo para sincronización Ngrok?
* [ ] ¿El bot de Telegram inicia automáticamente con `telegram.startTelegramPolling()` y se reinicia si cambian tokens en `/api/config`?
* [ ] ¿El frontend compila limpiamente con `npm run build` y se copió a `produccion_definitivo/frontend_dist` y `app/public`?
* [ ] ¿`PRAGMA integrity_check` y `PRAGMA foreign_key_check` devuelven `ok` y `0 errores`?

