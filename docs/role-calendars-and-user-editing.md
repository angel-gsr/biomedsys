# Calendarios por perfil y edición de usuarios

Actualización del 25 de noviembre de 2026.

- El catálogo de códigos hospitalarios y las notificaciones usan fondos oscuros con texto de alto contraste y conservan los colores e iconos de cada código.
- En Resumen, las gráficas y el semáforo aparecen antes de los pendientes. La gráfica vuelve a mostrarse también en pantallas pequeñas.
- La edición de usuarios precarga los campos almacenados. Para cuentas antiguas que solo tienen nombre completo, propone una separación editable; no inventa edad o teléfono. No exige registrar una edad desconocida para actualizar esas cuentas, pero valida el rango y conserva las edades ya registradas.
- Los enlaces QR se consumen una sola vez al abrir la aplicación. La selección normal de inventario no deja un enlace de equipo pendiente; un fallo transitorio al recuperar el foco conserva los formularios abiertos. Un cierre de sesión o una cuenta efectivamente inhabilitada sigue cerrando el acceso.
- El jefe programa órdenes preventivas desde Mantenimiento, con búsqueda/QR, rutina vinculada, ingeniero, inicio, fin y ubicación. Se conserva la validación de coincidencias de sala/equipo del servidor. El calendario obtiene esos eventos de las órdenes reales.
- Todos los perfiles habilitados tienen calendario y pueden ver los equipos en mantenimiento, responsable y horario. La consulta clínica no incluye expedientes, observaciones técnicas ni reportes privados.
- Las capacitaciones se programan desde su módulo, con hora de fin y perfiles destinatarios. El jefe y el instructor siempre pueden consultarlas; también los perfiles seleccionados y los participantes individuales registrados.
- Calendario ofrece únicamente Organizar evento: título, descripción, ubicación, intervalo y destinatarios (jefes, ingenieros biomédicos y usuarios). Solo el jefe crea, edita o cancela estos eventos. Los demás perfiles consultan los que les corresponden.
- Los mantenimientos y capacitaciones conservan su fuente original, sin duplicar eventos. Se actualizan al entrar, recuperar el foco y cada 15 segundos. Los cancelados desaparecen de la agenda.

## Supabase

Aplicar `supabase/36_role_calendars_and_profile_edit.sql` después de la migración 35. Añade `trainings.calendar_audience`, `organized_events` y RPC con validación de sesión/rol. La tabla de eventos no permite acceso directo de `anon` o `authenticated`; sus operaciones pasan por RPC. No modifica publicaciones Realtime.

Aplicado a `yvqccoavcwfzcxrfvsjs` tras respaldo completo y pruebas transaccionales con rollback. La comparación de conteos y huellas verificó que perfiles, reportes, órdenes, capacitaciones e historial existentes se conservaron.

## Verificación

TypeScript, compilación y suite de componentes. Pruebas de Supabase: destinatarios, instructor, visibilidad clínica de mantenimiento, cancelación, edición de perfiles antiguos y denegación de operaciones no autorizadas. Revisión en Chrome con respuestas simuladas para los tres perfiles a 1280, 390 y 320 px: contraste de texto, formularios, fotografía y calendario. Los escenarios de interfaz no equivalen a iniciar sesión con contraseñas reales ni a probar una cámara física.
