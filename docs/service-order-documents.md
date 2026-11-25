# Orden de servicio y cierre técnico

La orden conserva los datos del reporte, equipo, serie, ubicación, prioridad y responsable. El PDF inicial muestra estos datos con logo, marca de agua y formato institucional. No incorpora un seguimiento técnico que aún está en elaboración.

El biomédico asignado inicia la atención y completa el seguimiento existente: inicio y fin, diagnóstico, trabajo realizado, pruebas, condición final y observaciones. La emisión del informe final requiere guardar el seguimiento completo, incluida su fecha de finalización. La validación administrativa y cierre por jefatura mantienen su flujo existente.

En la orden, el biomédico puede agregar su firma con dedo, lápiz o mouse y pulsar **Guardar firma y generar informe final**. También puede generar el documento sin firma dibujada para firmarlo en papel. El PDF final incluye el seguimiento guardado, nombre del responsable, firma, identificador de documento, fecha de emisión y estado de validación.

La migración 41 incorpora `service_order_documents` y dos funciones. `issue_service_order_document` verifica la sesión activa, rol biomédico, asignación de la orden y autoría del seguimiento antes de guardar una copia de los datos y firma. Ni el jefe ni otro biomédico pueden firmar en nombre del responsable. `get_service_order_document` permite consultar el último documento al responsable o al jefe. Las cuentas clínicas y visitantes no tienen acceso. No existen permisos directos de escritura sobre la tabla.

Los documentos emitidos son copias inmutables. Consultarlos posteriormente no reconstruye los datos a partir de un seguimiento modificado. Si el ingeniero edita el expediente, puede emitir una nueva versión; la firma anterior no se reutiliza automáticamente. Repetir la emisión de exactamente los mismos datos y firma devuelve el mismo documento. Se almacenan los datos y el PNG de la firma, no un PDF duplicado en Storage.

La migración se aplicó al proyecto `yvqccoavcwfzcxrfvsjs`, con respaldo verificado. Los registros previos permanecieron iguales. Las pruebas SQL de permisos, firma, autoría, versiones e idempotencia se revirtieron. Validación adicional: 149 pruebas automatizadas, TypeScript, compilación y flujos simulados en Chrome para jefe/biomédico en móvil y escritorio; revisión visual de los PDFs y firma incrustada.
