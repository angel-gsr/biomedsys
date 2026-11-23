# Calendario general

El apartado existente `calendario` reúne las fechas reales de `maintenances`,
`trainings` y `calendar_bookings`. No se copian órdenes ni capacitaciones a una
segunda agenda. La vista de Capacitaciones conserva su administración, y sus
fechas aparecen también en el calendario general.

El jefe puede programar cirugías, reservas de equipo, mantenimientos preventivos
y capacitaciones de protocolo únicas. Debe indicar inicio y fin, y seleccionar
los recursos ocupados. Las cirugías requieren una sala del catálogo de
ubicaciones; las reservas de equipo requieren al menos un equipo. Los
mantenimientos necesitan una rutina vinculada al equipo, conservando la regla de
una orden preventiva activa por equipo/rutina. Los técnicos pueden consultar la
agenda institucional pero no programar, modificar ni cancelar eventos.

La selección de la sala debe identificar la misma ubicación del catálogo en
todos los eventos que utilicen ese espacio. Los títulos se utilizan únicamente
para coordinación operativa; no se necesitan nombres ni datos de pacientes.

## Cruces y horarios antiguos

Los intervalos se comparan como `[inicio, fin)`: dos eventos pueden terminar y
comenzar en el mismo instante. Se rechaza cualquier cruce activo que comparta
sala o equipo, tanto desde el calendario como desde las rutas anteriores de
programación de mantenimiento/capacitación. Cancelar libera la reserva sin
eliminar su historial.

Los triggers usan un bloqueo transaccional compartido para que dos sesiones no
puedan reservar simultáneamente un recurso. Los avisos del navegador son
orientativos; PostgreSQL vuelve a validar la disponibilidad al guardar.

Los registros previos conservan sus fechas y contenido original. No se inventa
una duración ni se convierte automáticamente una ubicación de texto libre en
una sala del catálogo. Un evento activo sin hora de fin se marca como pendiente
y su recurso conocido se considera ocupado hasta completar el horario. Los
eventos sin recursos vinculados no permiten comprobar cruces de sala/equipo.

Las fechas se guardan como instantes `timestamptz` y se muestran en la zona local
del dispositivo, indicada encima del calendario. Las sesiones en otras zonas
ven el mismo instante convertido a su horario local.

## Despliegue y validación

`20_general_calendar.sql` agrega los extremos de los intervalos y las salas a
las tablas existentes, además de las reservas de cirugía/uso. Requiere la base
actualizada hasta la migración 19.

Antes de aplicar, crear un respaldo completo y de `public`, revisar sus índices
y restaurar `public` en PostgreSQL desechable con Auth y permisos equivalentes.
`scripts/inventory/validate_general_calendar.py` está restringido a la copia local
`biomedgest_calendar_restore`, puerto 55440. Revierte los escenarios al finalizar.
Comprueba cruces por sala/equipo, continuidad con las APIs anteriores, eventos
consecutivos, cancelación, duraciones pendientes, permisos y fuentes originales.
También se comprobó la exclusión de reservas dobles con dos sesiones concurrentes.

El postflight de solo lectura está en
`scripts/inventory/verify_general_calendar_postflight.sql`. La migración conserva
los registros existentes y no carga cirugías de demostración en producción.

Aplicada en `yvqccoavcwfzcxrfvsjs` el 23 de noviembre de 2026. Se conservaron
7 reportes, 5 perfiles, 100 equipos, 3 mantenimientos, una capacitación y 199
vínculos documentales. Los respaldos y el resultado de la transacción se guardan
fuera del repositorio. No se necesitan variables nuevas ni despliegues en Vercel.
