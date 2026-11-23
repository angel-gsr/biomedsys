# Inventario administrable e incidentes por equipo

La migración `22_inventory_control_incidents.sql` requiere las migraciones 19–21.
Mantiene los datos actuales y añade controles administrativos e incidentes
estructurados. No elimina ni recrea activos durante el despliegue.

## Reportar un incidente

Después de seleccionar un equipo o leer su QR, el formulario carga sus opciones
de incidente. Distingue los casos ya reportados, con su número de ocurrencias,
de los posibles problemas del inventario. Los textos originales del Excel se
conservan y se separan en etiquetas técnicas usando saltos de línea, comas y
punto y coma. Los reportes históricos aportan su tipo de evento, sin inferir
diagnósticos de las narraciones.

**Otro incidente** permite registrar una etiqueta técnica breve, de 3 a 240
caracteres, además de la descripción del caso. Al guardar queda disponible para
reportes futuros del mismo equipo. La etiqueta no debe contener nombres ni datos
de pacientes. No se reutilizan la descripción, la consecuencia ni la acción
clínica de otros reportes como opciones.

La base comprueba que cada opción pertenezca al equipo seleccionado. La etiqueta
se guarda en el reporte y aparece en su detalle y PDF. Se puede corregir durante
los mismos diez minutos permitidos al autor; cambiarla no extiende el plazo.
Los contadores se calculan a partir de los reportes actuales y no son métricas de
riesgo o diagnósticos clínicos.

## Control del jefe

En Inventario se ofrecen **Agregar equipo**, **Editar / retirar** y **Equipos
retirados**. La ficha también permite abrir la edición completa.

El alta asigna automáticamente un código único `EQ-######`. Permite indicar
nombre/tipo, marca, modelo, serie, años, área, ubicación, resguardo y estado. Los
equipos nuevos quedan pendientes de revisión; no se inventan riesgos, manuales,
rutinas ni información de garantía. Al editar un modelo compartido se reutiliza
o crea la referencia apropiada, sin renombrar el modelo de otros activos.

Las operaciones del nuevo formulario exigen un motivo y dejan auditoría. El
código y UUID del equipo no se cambian. Los reportes ya emitidos conservan su
instantánea original de nombre, modelo, serie y ubicación.

La eliminación se implementa como **retiro del inventario activo**: el equipo
pasa a baja y desaparece de las búsquedas activas y de nuevos reportes/reservas. Se
conservan documentos, reportes, mantenimiento, datos importados e historial.
Primero deben finalizarse o cancelarse sus mantenimientos y reservas pendientes.
El jefe puede restaurarlo, registrando otro motivo; vuelve a **Sin confirmar**.

El calendario y el retiro comparten un bloqueo transaccional. Los triggers de
mantenimiento y capacitación comprueban que el equipo siga activo después de
obtener ese bloqueo, incluidas las rutas anteriores de programación.

Los técnicos y usuarios no pueden dar altas, editar, retirar ni restaurar activos.
Las RPC vuelven a comprobar el rol activo; ocultar botones no es la protección
principal. Las sesiones ordinarias tampoco escriben el catálogo de incidentes.

## Validación

Antes de aplicar se respalda la base completa y `public`, y se restaura una copia
local con permisos equivalentes. `scripts/inventory/validate_inventory_control.py`
se restringe a `biomedgest_inventory_control_restore`, localhost:55442. Todas las
pruebas se revierten. Comprueba opciones por equipo, privacidad de narraciones,
corrección, altas, aislamiento de modelos, conservación de reportes, retiro,
restauración, reservas pendientes, permisos y vencimiento de diez minutos.

El postflight de solo lectura es
`scripts/inventory/verify_inventory_control_postflight.sql`. El despliegue compara
conteos y huellas de los datos existentes, excluyendo únicamente las columnas
nuevas antes de confirmar. No necesita variables nuevas ni despliegue en Vercel.
