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
