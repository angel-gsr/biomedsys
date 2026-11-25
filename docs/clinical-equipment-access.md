# Consulta de equipos y documentos

El perfil `usuario` conserva su rol y permisos. En la barra superior y en el menú se muestra su departamento, en lugar de una profesión que no consta en su cuenta.

Los usuarios habilitados pueden consultar el inventario básico: nombre, fabricante, modelo, serie, área y ubicación; también los documentos vinculados y los archivos del equipo en modo de lectura. El acceso no permite consultar expedientes técnicos, riesgos internos ni evidencias privadas de mantenimientos. Las comprobaciones se realizan en Supabase, además de ocultar los controles de edición.

La acción **Solicitar** está disponible en el listado y en la ficha. Abre el vale con el equipo seleccionado. El préstamo, calendario y PDF mantienen su flujo existente.

Las fotografías se buscan por fabricante y modelo normalizados, sin sustituirlas por imágenes de equipos parecidos. El catálogo inicial contiene 39 fotografías de modelos, optimizadas en WebP (aproximadamente 576 KiB en total). Son referencias del modelo, no fotografías de la unidad física del hospital. Cuando no existe una fotografía verificada se indica expresamente. Las fuentes se documentan en [equipment-image-credits.md](equipment-image-credits.md).

Base de datos: migración `39_clinical_equipment_documents.sql`. La política de lectura de archivos incluida en esa migración también se aplica en la migración 40.
