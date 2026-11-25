# Solicitudes clínicas y Uso de equipo

Las solicitudes de médicos/enfermería se registran desde Solicitud de equipo → Solicitar equipo, con búsqueda o QR, inicio, fin y ubicación de uso. El solicitante se obtiene de la sesión en Supabase; no se acepta un identificador de persona enviado por el navegador.

Una solicitud válida reserva directamente el horario. No introduce una aprobación pendiente del jefe. El equipo debe estar activo y operativo, las fechas deben ser futuras y el fin posterior al inicio. El servidor reutiliza el bloqueo transaccional y la validación de cruces del calendario para impedir reservas simultáneas o coincidencias con mantenimientos, capacitaciones y otras actividades que ocupen el mismo equipo. Los avisos de conflicto no revelan títulos de eventos restringidos.

Se almacena en `calendar_bookings` como `uso_equipo`; el calendario consulta esa misma fuente, sin copiar eventos. Los perfiles habilitados pueden consultar la disponibilidad, ubicación, solicitante y horario. Las cirugías mantienen sus permisos anteriores.

En el detalle del calendario, el solicitante o un jefe pueden cancelar una reserva que no haya terminado. La cancelación conserva el historial, libera el horario y retira la entrada de la agenda. Otro usuario o un técnico no pueden cancelar reservas ajenas. Las reservas históricas existentes se conservan.

Aplicar `supabase/37_equipment_use_requests.sql` después de la migración 36. No altera publicaciones Realtime ni permite escrituras directas de usuarios en `calendar_bookings`.

Validación realizada:

- Respaldo completo del proyecto `yvqccoavcwfzcxrfvsjs`; pruebas de escritura con rollback y comparación de conteos/huellas antes de aplicar la migración.
- Registro, visibilidad para los tres perfiles, identidad del solicitante, cancelación propia y del jefe, denegación de cancelación ajena y acceso anónimo.
- Cruces solicitud/mantenimiento en ambas direcciones, reutilización del horario al cancelar, rechazo de equipos fuera de servicio y fechas/ubicación inválidas.
- TypeScript, compilación y 136 pruebas automatizadas.
- Chrome con datos simulados a 1280 y 390 px: solicitud → calendario → cancelación y contraste oscuro. No se generaron solicitudes reales mediante las pruebas.

## Vale de préstamo

La migración 38 añade un vale por reserva, con folio `VP-año-ID`, datos automáticos del equipo y solicitante, ubicación de destino, periodo y estado. Al registrar la solicitud se conserva una instantánea de la identificación. Las reservas anteriores usan los datos disponibles al consultar el vale y se identifican como tales. No se inventan datos no registrados ni se solicitan datos de pacientes.

Al guardar una solicitud se abre su vale con vista previa del PDF. Desde Calendario → Uso de equipo → Ver evento → Ver vale / PDF también puede consultarse después. La consulta está autorizada para el solicitante y el personal biomédico; otros usuarios clínicos solo ven la disponibilidad del equipo.

El PDF A4 usa el símbolo vectorial de la app como logo y marca de agua; no reutiliza sellos o marcas institucionales de los ejemplos. Incluye espacios de entrega y recepción para firmar en papel o dibujar firmas opcionales en el navegador. Las firmas dibujadas solo se incorporan a la copia PDF generada, sin cargarse a Supabase. Al cerrar el vale se descartan; descargar el PDF permite conservarlas. La consulta posterior permite generar otra copia sin firmas. No constituye un mecanismo de firma electrónica certificada.

Incluye descarga, impresión desde la vista PDF y compartir mediante la función nativa del dispositivo cuando soporte archivos; en otros navegadores descarga el archivo para enviarlo manualmente. La app no envía documentos a terceros por sí sola.

Pruebas adicionales: respaldo completo y migración 38 con comprobación de permisos e identificación inmutable; 138 pruebas automatizadas; generación y descarga de PDF firmado en Chrome a 1280 y 390 px. Los PDF de prueba se verificaron como A4 de una página, con imagen de firma y texto dentro de los márgenes, además de revisión visual del documento.
