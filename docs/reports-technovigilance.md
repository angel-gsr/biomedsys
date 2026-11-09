# Reportes y tecnovigilancia

La migración `19_reports_technovigilance.sql` se instala después de la 18. No
reimporta el inventario ni sustituye datos de reportes anteriores. Las nuevas
columnas de identidad permanecen vacías en reportes históricos para no inventar
una ubicación o serie retrospectiva.

## Identidad del equipo

La búsqueda manual y el QR consultan `get_report_equipment_identity` con la sesión
activa. Nombre, modelo, serie, área y ubicación se muestran bloqueados. El trigger
de inserción vuelve a tomar los datos del catálogo y guarda una instantánea: no
confía en las cadenas enviadas por el navegador. El código QR sigue siendo un
identificador, no una autorización adicional.

## Correcciones y PDF

La flecha de cada reporte abre una vista previa autorizada. Solo el autor puede
corregir fecha/tipo del evento, descripción, consecuencia y acción inicial durante
los primeros diez minutos desde `created_at`. PostgreSQL verifica su propio reloj
después de bloquear la fila. Una corrección no reinicia el plazo. La RPC también
comprueba `edited_at` para evitar sobrescribir correcciones simultáneas.

Los datos del equipo, el autor y la fecha de creación no se pueden modificar.
Una vez vencido el plazo, el incidente original queda congelado; el flujo de
mantenimiento y las observaciones biomédicas siguen operando separadamente.

La vista previa PDF consulta la revisión actual antes de generar el archivo. El
documento se genera en el navegador, incluye la ubicación original del reporte y
puede previsualizarse antes de abrirse o descargarse. No representa por sí mismo
un acta firmada ni una notificación enviada a una autoridad.

## Bandeja del técnico y seguimiento

Jefes y técnicos activos pueden leer los reportes de la institución. Los usuarios
siguen viendo exclusivamente sus propios reportes. Las bandejas consultan cambios
cada 15 segundos y al recuperar foco; Tecnovigilancia permite sincronizar a mano.
Las órdenes siguen respetando la asignación existente: leer un incidente no
autoriza a intervenir una orden de otro técnico.

El seguimiento almacena riesgo interno, tipo de falla, fecha de confirmación,
supuesto de notificación, referencias de acta/acuse, fechas y notas. Los traslados
actualizan el inventario con área/ubicación compatibles y motivo obligatorio;
quedan auditados y no alteran la instantánea del reporte.

## Plazos internos y normativos

Las metas internas de acta solicitadas son **10 días naturales** para riesgo
catastrófico/alto, **15** para medio y **30** para bajo, contados desde la fecha de
registro en zona `America/Mexico_City`. El riesgo lo selecciona explícitamente
el profesional; no se infiere de la prioridad del reporte o del equipo.

La [NOM-240-SSA1-2012, numeral 12.3](https://sidof.segob.gob.mx/notas/docFuente/5275834)
establece plazos distintos para notificación inicial desde la confirmación:

| Supuesto | Plazo |
| --- | --- |
| Amenaza grave para la salud pública | 2 días hábiles |
| Muerte o deterioro grave de salud | 10 días naturales |
| Otros incidentes notificables | 30 días naturales |

Los 15 días no se presentan como plazo de la NOM. La fecha de confirmación es
obligatoria para calcular una fecha normativa. El calendario excluye sábados,
domingos y las fechas oficiales que el jefe registre en Tecnovigilancia; los
cambios recalculan los seguimientos por amenaza pública. El responsable debe
validar los días inhábiles aplicables y la clasificación del caso. La aplicación
registra referencias de las actuaciones; no transmite notificaciones a COFEPRIS.

## Validación y despliegue

Antes de cualquier migración remota, respaldar y restaurar como mínimo `public`
en una base desechable con la compatibilidad de Auth y permisos equivalentes.
`scripts/inventory/validate_reports_technovigilance.py` está restringido a la copia
local `biomedgest_restore`, puerto 55439. Revierte sus escenarios al finalizar y
verifica identidad canónica, edición, vencimiento, aislamiento, traslado,
calendario y continuidad de las órdenes.

Después de instalar ejecutar
`scripts/inventory/verify_reports_technovigilance_postflight.sql`. Comprobar los
conteos y las huellas de los registros existentes antes de confirmar la
transacción. No se necesitan variables de entorno nuevas ni cambios en Vercel.

Aplicada y verificada en `yvqccoavcwfzcxrfvsjs` el 9 de noviembre de 2026:
se conservaron 6 reportes, 5 perfiles/usuarios Auth, 100 equipos, 100 riesgos,
44 programas, 199 vínculos documentales y 162 incidencias de revisión. Los
respaldos y el resultado de despliegue se guardan fuera del repositorio.
