# Códigos y alertas hospitalarias

La campana de la barra superior abre la bandeja personal en los tres perfiles.
El botón contiguo abre los 14 códigos, sus destinatarios, las alertas activas
y el historial. Elegir un código muestra un formulario: se requiere ubicación
y un envío explícito. No se emite una alerta al abrir el catálogo.

Catálogo contrastado con la [referencia de Protección Civil de Veracruz](https://www.veracruz.gob.mx/proteccioncivil/wp-content/uploads/sites/5/2022/11/C%C3%B3digos-de-Seguridad-Hospitalaria-Nacional.pdf)
y el [instructivo de IMSS Bienestar](https://imssbienestar.gob.mx/assets/doc/transparencia/coordinaciones/normatividad/Instructivo%20Codigos%20de%20seguridad.pdf).
Los destinatarios siguientes son la configuración inicial de esta aplicación,
no una afirmación sobre la asignación clínica institucional de esos códigos.

| Destinatarios | Códigos |
| --- | --- |
| Todos los perfiles activos | Negro, rojo, verde, café, amarillo y plata |
| Jefe e ingenieros biomédicos | Ámbar, azul, rosa, blanco, magenta, morado, naranja y oro |

El emisor puede consultar su propia alerta dirigida y recibe sus actualizaciones.
Su nombre, ID institucional, perfil y departamento se toman del servidor al emitir
y quedan guardados en la alerta. Los registros anteriores toman la identidad
disponible al aplicar la migración 26. Los avisos nuevos incluyen nombre e ID;
la tarjeta y el aviso flotante los muestran automáticamente.
Los destinatarios se deciden en PostgreSQL; el cliente no puede cambiar el alcance.
Los avisos generales y sus cambios de estado generan notificaciones persistentes
para todos los perfiles activos. Las cuentas inactivas no pueden emitir ni recibir.
Los demás servicios hospitalarios no se han conectado todavía.

Solo jefe y técnico pueden marcar «En atención» o cerrar, con responsable, hora,
motivo obligatorio de cierre y auditoría. Leer una notificación no cierra la alerta.
Un identificador por envío evita duplicados al reintentar tras un fallo de red.

La X de cada notificación la archiva solo para su destinatario y la quita del
contador; no borra el registro ni cierra una emergencia. La X del aviso flotante
oculta ese aviso y detiene su sonido en la sesión actual. Las alertas nuevas
vuelven a mostrar un aviso. El cierre de la emergencia sigue requiriendo jefe
o biomédico y motivo de cierre. Migración: `supabase/27_notification_dismissal.sql`.

La recepción usa Supabase Realtime, con consulta de respaldo cada 10 segundos
y al volver a la app. Cada código tiene un patrón sonoro propio: 18 segundos para
avisos generales y 6 segundos para avisos dirigidos. Son patrones de esta app,
no señales acústicas hospitalarias oficiales. Se reproducen en secuencia para
evitar superposiciones y se cancelan al cerrar la alerta o desactivar el sonido.
Requieren
el botón «Activar sonido» en cada sesión/navegador y una pestaña operativa.
No se garantiza sonido con la aplicación cerrada, el teléfono bloqueado o el
navegador suspendido; no hay push externo ni integración con altavoces hospitalarios.

## Verificación

Migraciones: `supabase/25_hospital_alerts.sql` y `supabase/26_hospital_alert_identity_sound.sql`.
En la restauración local desechable de PostgreSQL, ejecutar
`python scripts/inventory/validate_hospital_alerts.py`.
Las pruebas verifican aislamiento por destinatario, todos los perfiles activos,
rechazo a inactivos, idempotencia, privilegios, cierre e historial; revierten todos
sus cambios. Las pruebas de navegador usan datos simulados y no emiten alertas reales.
