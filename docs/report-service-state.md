# Reportes selectivos y estado del equipo

La migración 23 establece como **Operativo** el estado inicial de todos los
equipos activos, por indicación del propietario. Conserva los activos retirados
y todos los reportes anteriores. Este es un cambio administrativo de línea base,
no una reescritura de los incidentes históricos.

Cada reporte nuevo cambia su equipo a **Fuera de servicio** en la misma
transacción. Si no puede guardarse el reporte, el cambio de estado tampoco se
confirma. La operación se ejecuta en PostgreSQL para todos los clientes; no
depende de que el navegador actualice la pantalla. El inventario consulta cambios
al regresar a la app, tras registrar reportes y cada 15 segundos.

El formulario utiliza el desplegable de problemas específico del equipo, con
las opciones importadas y los incidentes anteriores. El usuario no necesita
reescribir el problema. La descripción del reporte se genera con la opción
seleccionada; **Observaciones** es el único texto libre de detalle y es opcional.
**Otro incidente** registra esa categoría sin exigir otra explicación. La acción
inmediata también se elige de una lista. Los datos de identidad permanecen
bloqueados.

Las observaciones se guardan separadas, aparecen en el detalle/PDF y respetan los
diez minutos de corrección del autor. Las descripciones de reportes históricos
se conservan. Para clientes anteriores que aún envíen una narración en
`description`, el servidor la conserva como observaciones del reporte nuevo.
Las observaciones nunca alimentan el catálogo compartido de fallas.

Corregir o cerrar un reporte no devuelve automáticamente el equipo a Operativo.
El cambio debe realizarse de forma autorizada tras su revisión. Se permite
programar el mantenimiento del equipo fuera de servicio; las nuevas reservas de
uso clínico y cirugía requieren que los equipos vinculados estén operativos.
No se cancelan automáticamente cirugías o reservas previas: el personal debe
revisar su planificación ante el incidente.

Antes de aplicar se respalda y restaura `public` en una base desechable. La prueba
`scripts/inventory/validate_report_service_state.py` se restringe a
`biomedgest_report_state_restore`, localhost:55443, y revierte sus escenarios.
Verifica el estado inicial, selección sin observaciones, cambio de estado,
restricción clínica, mantenimiento y revisión autorizada, y vencimiento de las
observaciones. El postflight es
`scripts/inventory/verify_report_service_state_postflight.sql`.
