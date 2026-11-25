# Reportes y órdenes correctivas

Al guardar un **reporte nuevo**, una transacción de Supabase vincula una orden de mantenimiento correctivo (MC), deja el equipo fuera de servicio y mantiene la orden disponible, sin responsable. Si la creación de la orden falla, tampoco se guarda un reporte incompleto.

En Mesa de ayuda y Órdenes de servicio, un biomédico puede **Tomar orden**. La asignación usa bloqueo transaccional: dos cuentas no pueden quedarse con la misma orden. Repetir la petición del mismo responsable no crea duplicados. El jefe puede seleccionar un ingeniero y confirmar la asignación de la orden existente; una orden ya tomada no se reasigna mediante esta operación.

Las órdenes disponibles se actualizan al volver a la ventana y mediante consulta periódica. El responsable abre su orden y puede iniciar la atención y completar el expediente. El jefe conserva la consulta del documento y su PDF.

El comprobante del reporte se genera automáticamente después de guardarlo. Incluye identificación y serie del equipo, ubicación, falla, observaciones, prioridad, autor, departamento, orden vinculada, logo, marca de agua y espacio para firma. Permite vista previa, descarga e impresión. La consulta posterior conserva la ventana de edición de diez minutos y genera el documento con los datos consultados.

Una falla imprevista puede registrarse aunque exista una reserva del equipo: el conflicto de agenda no debe impedir reportar una avería. No se cancelan reservas previas. El equipo fuera de servicio queda indisponible para nuevas solicitudes. La orden sin asignar no bloquea horarios adicionales; la orden asignada se refleja en el calendario de mantenimiento.

La migración `40_automatic_corrective_orders.sql` se aplicó al proyecto `yvqccoavcwfzcxrfvsjs`, con respaldo previo y comprobación de registros existentes. **No convierte reportes anteriores en órdenes nuevas**: estos conservan su asignación manual por el jefe. La conversión masiva se retiró después de que la revisión automática rechazara ese efecto adicional.

Validación: 146 pruebas automatizadas; comprobaciones SQL reversibles de creación, permisos, asignación, duplicados y acceso a documentos; prueba de concurrencia con dos conexiones y reversión; flujos de navegador simulados para los tres perfiles en escritorio y móvil, y revisión del PDF generado.
