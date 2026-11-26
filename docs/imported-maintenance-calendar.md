# Calendarización de los 100 equipos

Se integraron las columnas de periodicidad, último mantenimiento registrado y próximo mantenimiento del inventario actualizado recibido el 26 de noviembre de 2026. La correspondencia se comprobó para los 100 equipos por identificador original, fila de origen y número de serie. El conjunto normalizado se conserva en `data/inventory/schedules/maintenance_dates_2026-11-26.json`, con la huella SHA-256 del archivo.

La migración 45 agrega las fechas de referencia a la información del equipo y las expone mediante una consulta autenticada. La ficha muestra último mantenimiento y próxima fecha efectiva, periodicidad, vencimiento y notas cuando corresponda. No muestra nombres del archivo de origen.

Se actualizaron las fechas efectivas de 99 programas. En EQ-000001 se conservó el registro más reciente del sistema: último mantenimiento 23/11/2026 y próximo 23/05/2027. Las fechas anteriores del archivo, 10/08/2026 y 10/02/2027, se conservaron como referencia. No se modificaron expedientes técnicos, órdenes, reportes, equipos, ubicaciones ni estados operativos.

Se conservaron exactamente las fechas proporcionadas, incluidas 20 vencidas y 15 que no coinciden con el intervalo nominal. Las periodicidades mixtas o por horas no se convierten en una recurrencia mensual supuesta. En dos ventiladores, las referencias explícitas al sensor de O2 se interpretaron como 08/01/2028 y 16/05/2028, conservando el texto de condición de uso.

El calendario general integra automáticamente las próximas fechas de los programas como previsiones de mantenimiento visibles para todos los perfiles. No son reservas ni órdenes ejecutables: el archivo no incluye horas o responsables. Se presentan sin hora y no bloquean equipos o salas. La selección de mes permite consultar las fechas de 2027 y 2028 directamente.

Cuando existe una orden preventiva activa del mismo equipo/programa, se muestra esa orden y se oculta la previsión duplicada. Una cancelación permite que reaparezca la previsión; un cierre validado actualiza las fechas del programa conforme al flujo existente. Las fechas se consultan desde el programa, sin copiar eventos a una agenda paralela.

El importador `scripts/inventory/import_maintenance_dates.py` realiza actualizaciones por lote en una transacción, valida identidades y conserva registros posteriores a los del archivo. Repetir el mismo archivo es una operación sin cambios y no sobrescribe ajustes posteriores. Por defecto ejecuta una simulación con reversión; `--apply` confirma la transacción. Requiere la migración 45 y acceso administrativo mediante el archivo local de conexión.

Aplicado al proyecto Supabase `yvqccoavcwfzcxrfvsjs`, con respaldo verificado y pruebas previas revertidas. Se verificaron 100 previsiones únicas en los tres perfiles, conservación de datos anteriores, fechas de 2028, idempotencia, permisos y sustitución de la previsión por una orden real. Validación de interfaz: 167 pruebas automatizadas, TypeScript, compilación y comprobaciones en Chrome para escritorio y móvil.
