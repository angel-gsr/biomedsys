# Ficha, documentos e historial de incidencias

La ficha del inventario conserva el botón **Editar / retirar**. Se retira de su parte inferior el formulario duplicado de Administración del equipo y la revisión de incidencias de importación. Los datos de importación y sus decisiones anteriores se conservan en la base; no son reportes de fallas. La configuración de mantenimiento preventivo sigue disponible.

**Registro de incidencias** consulta exclusivamente reportes asociados mediante el identificador del equipo. Incluye fecha, folio, incidente, observaciones, prioridad, estado y orden vinculada, incluidos los reportes cerrados. Abre el reporte correspondiente para consulta o PDF. Se actualiza periódicamente y al volver a la ventana. El jefe y los biomédicos consultan los reportes del equipo; los usuarios clínicos ven únicamente sus propios reportes, conservando los permisos existentes.

**Documentos y archivos del equipo** reúne los enlaces y las cargas de archivos que antes aparecían separados. El jefe puede agregar, editar y quitar enlaces con título, categoría y URL. La edición del título es propia de la relación con ese equipo; los documentos compartidos con otros equipos no se alteran. Quitar un enlace desvincula únicamente ese equipo y requiere confirmación.

La carga utiliza el bucket privado existente, con lectura autorizada y URLs temporales. Admite PDF, JPG, PNG, WebP, TXT, DOC y DOCX, hasta 10 MB por archivo. El jefe puede editar el nombre visible y la descripción. Esa edición no cambia el contenido ni la ruta del objeto. La eliminación mantiene su confirmación y permisos existentes. Los biomédicos conservan la carga de archivos y los usuarios clínicos la consulta de documentos.

Los títulos personalizados también aparecen en Documentos. Se aceptan enlaces HTTP/HTTPS y se rechazan URLs ejecutables, credenciales incrustadas y formatos inválidos. No se descargan automáticamente los recursos de URLs externas.

La migración 43 se aplicó a `yvqccoavcwfzcxrfvsjs`, con respaldo previo. Se verificó que los registros existentes permanecieran iguales. Las pruebas SQL de enlaces compartidos, permisos, metadatos, filtrado del historial y acceso anónimo se revirtieron. Validación adicional: 158 pruebas automatizadas, TypeScript, compilación y comprobaciones en Chrome de los tres perfiles en escritorio y móvil.
