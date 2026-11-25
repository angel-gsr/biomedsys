import { preferences } from "./preferences"
// Only interface labels are translated. Never translate user-entered clinical data.
const dictionary:Record<string,string>=Object.fromEntries(`
Inicio|Home
Resumen|Overview
Mesa de ayuda|Help desk
Tecnovigilancia|Medical device vigilance
Inventario|Inventory
Inventario de activos|Asset inventory
Calendario general|General calendar
Calendario|Calendar
Documentos|Documents
Mantenimiento|Maintenance
Capacitaciones|Training
Configuración|Settings
Configuración institucional|Institution settings
Usuarios y permisos|Users and permissions
Usuarios|Users
Trazabilidad|Traceability
Cotizaciones|Quotes
Mi jornada|My workday
Mis órdenes|My service orders
Órdenes|Service orders
Órdenes de servicio|Service orders
Orden de servicio|Service order
Reportes|Reports
Mis reportes|My reports
Avisos|Notices
Alertas|Alerts
Perfil|Profile
Mi perfil|My profile
Ver mi perfil|View my profile
Cerrar sesión|Sign out
Menú|Menu
Cerrar menú|Close menu
ADMINISTRACIÓN|ADMINISTRATION
Ingeniería Clínica|Clinical Engineering
Ingeniería Biomédica|Biomedical Engineering
Ingeniero biomédico|Biomedical engineer
Ingenieros biomédicos habilitados|Enabled biomedical engineers
Ingeniero|Engineer
Técnico|Technician
Jefe|Manager
Jefes|Managers
Jefe / administrador|Manager / administrator
Usuario|User
Clínico|Clinical user
Enfermería / Médico|Nursing / Physician
Panel de control|Dashboard
Buscar|Search
Buscar usuario|Search users
Buscar equipo|Search equipment
Buscar equipo para documentos|Search equipment documents
Buscar folio, equipo o servicio...|Search reference, equipment or department...
Nombre, ID o departamento...|Name, ID or department...
Código, equipo, fabricante o modelo|Code, equipment, manufacturer or model
Código, equipo, marca, modelo o serie...|Code, equipment, manufacturer, model or serial...
Filtros de inventario|Inventory filters
Limpiar filtros|Clear filters
Limpiar|Clear
Todas|All
Todos|All
Todas las áreas|All departments
Área|Department
Áreas por letra|Departments by letter
Área hospitalaria|Hospital department
Equipo|Equipment
Equipos|Equipment
Equipos por área|Equipment by department
Documentos del equipo|Equipment documents
Selecciona un equipo de la lista anterior.|Select equipment from the list above.
No se encontraron equipos|No equipment found
Prueba otra búsqueda o cambia el área.|Try another search or change the department.
Este equipo no tiene documentos vinculados|No documents linked to this equipment
Manual de usuario|User manual
Manual de servicio|Service manual
Documento|Document
Abrir documento|Open document
Enlace por revisar|Link pending review
Explora por área o busca un equipo para consultar sus manuales y documentos disponibles.|Browse departments or search equipment to view manuals and documents.
Cargando equipos y documentos...|Loading equipment and documents...
Los documentos abren enlaces externos; su disponibilidad depende del sitio de origen.|Documents open external links; availability depends on the source website.
Código|Code
Fabricante|Manufacturer
Marca|Manufacturer
Modelo|Model
Serie|Serial number
Número de serie|Serial number
Nombre del equipo|Equipment name
Ubicación|Location
Ubicación actual|Current location
Estado|Status
Estado operativo|Operating status
Operativo|Operational
Fuera de servicio|Out of service
En reparación|Under repair
Sin confirmar|Unconfirmed
Retirado|Retired
Riesgo|Risk
Alto|High
Medio|Medium
Bajo|Low
Alta|High
Crítica|Critical
Ordinaria|Routine
Prioridad|Priority
Prioridad del incidente|Incident priority
Atención inmediata|Immediate attention
Atención prioritaria|Priority attention
Revisión programada|Scheduled review
Identificación|Identification
Ficha del equipo|Equipment record
Ficha técnica|Technical record
Administración del equipo|Equipment administration
Editar / retirar|Edit / retire
Agregar equipo|Add equipment
Guardar equipo|Save equipment
Equipos retirados|Retired equipment
Restaurar equipo|Restore equipment
Retirar del inventario|Retire equipment
Volver al inventario|Back to inventory
Nombre / tipo de equipo|Equipment name / type
Fabricante / marca|Manufacturer
Año de fabricación|Manufacture year
Año de adquisición|Acquisition year
Resguardo|Custody
Serie provisional / pendiente|Provisional / pending serial number
Motivo del alta, edición o retiro|Reason for registration, edit or retirement
Motivo de restauración|Reason for restoration
No hay equipos retirados.|No retired equipment.
Retirar|Retire
Restaurar|Restore
Riesgo funcional|Functional risk
Evaluación de riesgo|Risk assessment
Periodicidad de mantenimiento|Maintenance frequency
Rutina de mantenimiento|Maintenance checklist
Posibles problemas|Possible issues
Garantía|Warranty
Referencias FDA / COFEPRIS|FDA / COFEPRIS references
Sin registrar|Not recorded
No registrado|Not recorded
No registrada|Not recorded
No disponible|Unavailable
Pendiente|Pending
No aplica|Not applicable
Sin asignar|Unassigned
Sin área|No department
Sin ubicación específica|No specific location
Sin observaciones|No observations
Archivos privados del equipo|Private equipment files
No hay archivos vinculados.|No linked files.
Guardar archivo|Save file
Cargar archivo|Upload file
Cambiar archivo|Change file
Ningún archivo seleccionado|No file selected
Descripción|Description
Descripción (opcional)|Description (optional)
Eliminar archivo|Delete file
Descargar|Download
Descargar PDF|Download PDF
Generando PDF...|Generating PDF...
Exportar PNG|Export PNG
Imprimir|Print
Etiqueta QR|QR label
Escanear QR|Scan QR
Escanear equipo|Scan equipment
Reintentar|Retry
Cerrar lector|Close scanner
El código contiene únicamente un enlace con el identificador técnico del equipo.|The code contains only a link with the equipment technical identifier.
Registrar reporte|Create report
Reportar falla|Report a fault
Enviar reporte|Submit report
Nuevo reporte|New report
Reporte de incidente|Incident report
Incidente del equipo|Equipment incident
Otro incidente|Other incident
Observaciones|Observations
Observaciones (opcional)|Observations (optional)
Agrega solo algún detalle extra, si es necesario.|Add extra details only if necessary.
Resultado para el paciente|Patient outcome
Acción tomada|Action taken
Sin lesión|No injury
Lesión temporal|Temporary injury
Lesión grave|Serious injury
Fallecimiento|Death
Acciones|Actions
Acción|Action
Recibido|Received
Clasificado|Classified
Asignado|Assigned
En atención|In progress
Resuelto|Resolved
Cerrado|Closed
Orden vinculada|Linked order
Ver orden|View order
Ver órdenes|View orders
Ver reporte|View report
Ver detalle|View details
Ocultar|Hide
Abrir|Open
Abrir PDF|Open PDF
Ver PDF|View PDF
Vista previa|Preview
Clasificar y crear orden|Classify and create order
Orden de servicio del incidente|Incident service order
Asignación de servicio|Service assignment
Asignación confirmada|Assignment confirmed
Confirmar asignación y crear orden|Confirm assignment and create order
Confirmando...|Confirming...
Volver a Mesa de ayuda|Back to help desk
Orden no disponible|Order unavailable
No se encontró la orden o no tienes acceso a ella.|The order was not found or you do not have access.
Orden de servicio confirmada · Vista de consulta|Confirmed service order · Read-only view
Selecciona un técnico habilitado|Select an enabled technician
Fecha de atención|Service date
Atención programada|Scheduled service
Programación|Schedule
Asignación|Assignment
Equipo y ubicación|Equipment and location
Incidente reportado|Reported incident
Seguimiento técnico|Technical follow-up
Fecha del evento|Event date
Tipo de incidente|Incident type
Problema|Issue
Acción inicial|Initial action
Diagnóstico|Diagnosis
Trabajo realizado|Work performed
Pruebas|Tests
Condición final|Final condition
Observaciones técnicas|Technical notes
Validación|Validation
Notas de cierre|Closure notes
El incidente ya tiene una orden confirmada.|This incident already has a confirmed order.
Al confirmar se creará la orden vinculada. Después podrás consultarla y descargar su PDF.|Confirming creates the linked order. You can then view it and download its PDF.
Revisa los datos y confirma la asignación del ingeniero biomédico.|Review the details and confirm the biomedical engineer assignment.
Cargando incidente...|Loading incident...
Cargando datos del incidente...|Loading incident details...
Incidente|Incident
Equipo / modelo|Equipment / model
Consulta|Read-only
Expediente|Service record
Expediente técnico|Technical service record
Inicio|Home
Finalización|Completion
Resultados de pruebas|Test results
Guardar borrador|Save draft
Enviar para validación|Submit for validation
Validar y cerrar|Validate and close
Validar preventivo|Validate preventive maintenance
Iniciar|Start
Cancelar|Cancel
Aplicar|Apply
Sin transición disponible|No transition available
Mantenimientos|Maintenance
Preventivo|Preventive
Correctivo|Corrective
Mantenimiento preventivo|Preventive maintenance
Mantenimiento correctivo|Corrective maintenance
Programado|Scheduled
En proceso|In progress
Completado|Completed
Cancelado|Cancelled
Guardar|Save
Guardar cambios|Save changes
Guardando...|Saving...
Actualizar|Update
Actualizando...|Updating...
Actualizando agenda...|Updating schedule...
Creando...|Creating...
Eliminar|Delete
Eliminando...|Deleting...
Confirmar|Confirm
Confirmar eliminación|Confirm deletion
Volver|Back
Cerrar|Close
Anterior|Previous
Siguiente|Next
Todos los perfiles|All roles
Perfil institucional|Institutional profile
PERFIL INSTITUCIONAL|INSTITUTIONAL PROFILE
Directorio de perfiles|User directory
Alta de usuario|User registration
Alta segura|Secure registration
Datos de la nueva cuenta|New account details
Solicitar alta|Request registration
Registrar usuario|Register user
Registrar solicitud|Register request
Solicitudes de alta|Registration requests
Sin solicitudes|No requests
Crear cuenta Auth|Create login account
Crear cuenta|Create account
Nombre completo|Full name
Nombres|Given names
Apellidos|Last names
Edad|Age
Teléfono (opcional)|Phone (optional)
10 dígitos|10 digits
Departamento|Department
Selecciona un departamento|Select a department
Rol|Role
Acceso|Access
Acceso a la cuenta|Account access
Conexión|Connection
Activo|Online
Inactivo|Offline
Habilitado|Enabled
Inhabilitado|Disabled
Habilitados|Enabled
Inhabilitados|Disabled
Motivo del cambio|Reason for change
ID institucional|Institutional ID
ID automático|Automatic ID
Información del identificador automático|Automatic identifier information
Eliminar usuario|Delete user
¿Eliminar usuario?|Delete user?
Editar|Edit
No hay coincidencias|No matches
Prueba con otros filtros.|Try other filters.
Foto de perfil|Profile photo
Foto de perfil (opcional)|Profile photo (optional)
Vista previa de perfil|Profile preview
Cargar foto|Upload photo
Cargar foto de perfil|Upload profile photo
Quitar foto|Remove photo
Procesando imagen...|Processing image...
Miniatura de 192 × 192 px; máximo 64 KB.|192 × 192 px thumbnail; maximum 64 KB.
Contraseña temporal|Temporary password
Nueva contraseña|New password
Confirmar contraseña|Confirm password
Cambiar contraseña|Change password
Cambia tu contraseña temporal|Change your temporary password
Contraseña actualizada|Password updated
Ir a iniciar sesión|Go to sign in
Entre 6 y 12 caracteres, con mayúscula, minúscula y número.|Between 6 and 12 characters, including uppercase, lowercase and a number.
Seguridad de la cuenta|Account security
Iniciar sesión|Sign in
Te damos la bienvenida|Welcome
Acceso institucional|Institutional access
Contraseña|Password
Entrar|Sign in
Ingresar|Sign in
Mi actividad|My activity
Sin actividad visible|No visible activity
Guardar perfil|Save profile
Perfil actualizado.|Profile updated.
Fecha y hora|Date and time
Fecha|Date
Hora|Time
Hoy|Today
Mes anterior|Previous month
Mes siguiente|Next month
Mes|Month
Semana|Week
Día|Day
Programar evento|Schedule event
Nuevo evento|New event
Quirófano|Operating room
Cirugía|Surgery
Cirugías|Surgeries
Capacitación|Training
Programar capacitación|Schedule training
Nueva capacitación|New training session
Guardar capacitación|Save training
Capacitaciones programadas|Scheduled training
Equipo nuevo, personal nuevo, necesidades detectadas y protocolos.|New equipment, new staff, identified needs and protocols.
No hay capacitaciones registradas|No training sessions registered
Programa la primera sesión usando el botón superior.|Schedule the first session using the button above.
Administra las capacitaciones; sus fechas también aparecen en el calendario general.|Manage training sessions; their dates also appear in the general calendar.
Impartido por|Provided by
Selecciona quién imparte|Select the instructor
Ingeniero de la sesión actual|Currently signed-in engineer
La capacitación se asigna automáticamente a tu cuenta.|The training session is automatically assigned to your account.
Título|Title
Motivo|Reason
Periodicidad|Frequency
Equipo nuevo|New equipment
Personal nuevo|New staff
Necesidad detectada|Identified need
Protocolo|Protocol
Única|One-time
Semanal|Weekly
Mensual|Monthly
Semestral|Every six months
Anual|Annual
Aula o servicio|Room or department
Ej. Uso seguro del nuevo monitor|E.g. Safe use of the new monitor
Equipo relacionado|Related equipment
Sin equipo específico|No specific equipment
Participantes activos|Enabled participants
Guardar participantes|Save participants
Gestionar|Manage
Cerrar gestión|Close management
Completar|Complete
Convocado|Invited
Confirmado|Confirmed
Asistió|Attended
No asistió|Did not attend
Evidencias de capacitación|Training evidence
Recurrencia|Recurrence
Notificaciones|Notifications
Bandeja personal|Personal inbox
Marcar leída|Mark as read
Marcar pendiente|Mark as unread
No hay notificaciones|No notifications
Ver alertas hospitalarias|View hospital alerts
Alerta hospitalaria|Hospital alert
Notificación|Notification
Alertas hospitalarias|Hospital alerts
Emitir alerta|Send alert
Activar sonido|Enable sound
Silenciar|Mute
Historial|History
Activas|Active
Atender alerta|Respond to alert
Cerrar alerta|Close alert
Motivo del cierre|Reason for closure
Área y ubicación de la emergencia|Emergency department and location
Volver al catálogo|Back to catalogue
Catálogo|Catalogue
Aviso general|General notice
Jefe y biomédicos|Manager and biomedical engineers
Preferencias de visualización|Display preferences
Se guardan en este navegador y se aplican inmediatamente.|Saved in this browser and applied immediately.
Idioma de la interfaz|Interface language
Apariencia|Appearance
Modo claro|Light mode
Modo oscuro|Dark mode
Automático (hora de Puebla)|Automatic (Puebla time)
Automático: claro de 06:00 a 17:59 y oscuro de 18:00 a 05:59, según America/Mexico_City (Puebla).|Automatic: light from 06:00 to 17:59 and dark from 18:00 to 05:59, using America/Mexico_City (Puebla).
El idioma cambia la interfaz; los nombres, documentos y datos clínicos conservan su contenido original.|Language changes the interface; names, documents and clinical data retain their original content.
Nombre de la institución|Institution name
Zona horaria|Time zone
Moneda predeterminada|Default currency
Aviso preventivo (días)|Preventive warning (days)
Guardar configuración|Save settings
Configuración guardada y auditada.|Settings saved and audited.
Integridad de Storage|Storage integrity
Verificar|Verify
Actividad reciente|Recent activity
Sin actividad reciente|No recent activity
Sin datos|No data
Cargando...|Loading...
Error|Error
Cerrar aviso|Dismiss notification
Información|Information
Generar PDF|Generate PDF
Descargar hoja de mantenimiento|Download maintenance checklist
Ver órdenes de mantenimiento|View maintenance orders
No hay reportes para mostrar|No reports to display
Cargando reportes...|Loading reports...
Seguimiento de solicitudes y fallas reportadas.|Track requests and reported faults.
Clasifica, prioriza y asigna reportes de equipamiento médico.|Classify, prioritize and assign medical equipment reports.
Consulta, filtra y administra perfiles sin exponer privilegios de Auth en el navegador.|View, filter and manage user profiles securely.
El identificador se asigna automáticamente al guardar. Después podrás establecer la contraseña temporal.|The identifier is assigned automatically when saved. You can then set the temporary password.
Seleccionar|Select
Por definir|To be defined
Activo / inactivo|Online / offline
Eliminar evidencia|Delete evidence
Archivo de evidencia|Evidence file
Adjuntar fotografías|Attach photos
Cámara|Camera
Galería|Gallery
Tomar foto|Take photo
Seleccionar fotos|Select photos
Atención|Service
Orden|Order
Tipo|Type
Reporte|Report
Datos del equipo|Equipment details
Datos del incidente|Incident details
Volver al catálogo|Back to catalogue
Cancelar cambios|Cancel changes
No existen registros visibles para tu cuenta.|No records are visible to your account.
Prueba con otros filtros.|Try other filters.
No hay documentos vinculados|No linked documents
Administración|Administration
Clínica|Clinical
Confirmado|Confirmed
Validado|Validated
Completada|Completed
Cancelada|Cancelled
Programada|Scheduled
En curso|In progress
Acceso exclusivo para personal autorizado · v2.4|Authorized personnel only · v2.4
Tecnología que cuida.|Technology that cares.
Atención sin interrupciones.|Uninterrupted care.
Bienvenido|Welcome
Entrando...|Signing in...
Autenticando...|Authenticating...
Correo electrónico|Email
Conectado|Connected
Desconectado|Disconnected
Volver al inicio|Back to home
Ubicación del incidente|Incident location
Observaciones técnicas|Technical notes
Inicio de sesión|Sign in
Validar|Validate
Detalles|Details
Inicio de sesión seguro|Secure sign in
Campos obligatorios|Required fields
Impartido por:|Provided by:
Estado:|Status:
Técnico:|Technician:
Prioridad:|Priority:
Datos personales|Personal details
Restablecer|Reset
Descarga|Download
Sin archivos|No files
Nombre|Name
Total|Total
Cantidad|Quantity
Concepto|Item
Importe|Amount
Moneda|Currency
Guardar cotización|Save quote
Nueva cotización|New quote
Agregar concepto|Add item
Solicitada|Requested
En revisión|Under review
Aprobada|Approved
Rechazada|Rejected
Filtrar|Filter
Exportar|Export
Confirmar cambio|Confirm change
Ayuda|Help
Acceso denegado|Access denied
Aviso|Notice
Información del equipo|Equipment information
Mantenimiento próximo|Upcoming maintenance
Mantenimiento vencido|Overdue maintenance
No se encontró el equipo|Equipment not found
Actualizar ubicación|Update location
Equipo registrado|Registered equipment
Consultar equipo|Find equipment
Sesión iniciada|Signed in
Terminar|Finish
Continuar|Continue
Aceptar|Accept
Personal autorizado|Authorized personnel
Volver a iniciar sesión|Sign in again
Adjuntos|Attachments
Archivos|Files
Foto|Photo
Sin fotografía|No photo
Selecciona un archivo|Select a file
Ver documento|View document
Rutina preventiva|Preventive checklist
Guardar rutina|Save checklist
Imprimir orden|Print order
Vista de consulta|Read-only view
Filtros|Filters
Estado de revisión|Review status
Revisión pendiente|Pending review
Confirmar estado operativo|Confirm operating status
Desactivar|Disable
Inhabilitar|Disable
Habilitar|Enable
Sin conexión al estado|Status unavailable
Información de la cuenta|Account information
Usuario final|End user
Sin descripción|No description
Sin resultados|No results
Inicio:|Start:
Finalización:|Completion:
Diagnóstico:|Diagnosis:
Trabajo:|Work:
Pruebas:|Tests:
Condición:|Condition:
Actividad:|Activity:
Acta interna|Internal report
Acta registrada|Report recorded
Acta completada el|Report completed on
Estado del reporte:|Report status:
Técnico asignado:|Assigned technician:
Sin reporte vinculado|No linked report
La evidencia documental depende de configurar Supabase Storage; no se simularán archivos.|Documentary evidence uses configured private storage; files are never simulated.
El técnico debe finalizar primero el expediente.|The technician must complete the service record first.
Observaciones de validación|Validation notes
Inicio de atención|Service start
Completa nombres, apellidos y edad (18 a 100 años).|Complete given names, last names and age (18–100).
Registra los datos personales pendientes; el nombre anterior se conserva como referencia en el encabezado.|Complete missing personal details; the previous name remains in the heading for reference.
`.trim().split("\n").filter(Boolean).map(line=>{const i=line.indexOf("|");return [line.slice(0,i),line.slice(i+1)]}))
Object.assign(dictionary,{
 "Pendientes y atenciones":"Pending work and recent service","pendientes · primero los de mayor prioridad":"pending · highest priority first","Atenciones recientes":"Recent service","Revisar incidente":"Review incident","Incidente sin asignar":"Unassigned incident","No hay incidentes pendientes de asignar.":"No incidents pending assignment.","Volver a Resumen":"Back to overview","Filtrar por tipo de evento":"Filter by event type","Todos los eventos":"All events","Concluido":"Finished","Revisa primero los incidentes críticos y de prioridad alta.":"Review critical and high-priority incidents first.",
 "Todas las opciones":"All options","Todas las secciones":"All sections","Solicitud de equipo":"Equipment request",
 "Reportar falla de equipo":"Report equipment fault","Cuéntanos qué sucede. Los campos con * son obligatorios.":"Tell us what happened. Fields marked * are required.",
 "Equipo o número de inventario":"Equipment or inventory number","Falla":"Fault","Evento adverso":"Adverse event","Otro":"Other",
 "Selecciona el incidente del equipo localizado":"Select an incident for this equipment","Reportados anteriormente en este equipo":"Previously reported for this equipment","Posibles problemas disponibles":"Available possible issues",
 "Las opciones corresponden únicamente al equipo seleccionado. No se muestran descripciones ni datos de otros pacientes.":"Options apply only to the selected equipment. Other patients' descriptions and data are not shown.",
 "Datos del equipo verificados y bloqueados. Completa únicamente la información del incidente.":"Equipment details verified and locked. Complete only the incident information.",
 "Fotos del incidente":"Incident photos","Fotos del incidente (opcional)":"Incident photos (optional)","Tomar foto del incidente":"Take incident photo","Seleccionar fotos del incidente":"Choose incident photos","Elegir fotos":"Choose photos",
 "Toma una foto o selecciona imágenes. Se adjuntarán al enviar el reporte.":"Take or select photos. They will be attached when you submit the report.",
 "Entendido":"Understood","Datos del incidente":"Incident details","Fecha del evento":"Event date","Tipo de evento":"Event type",
 "OPERACIÓN":"OPERATIONS","En línea":"Online","Jefe de Ingeniería Clínica":"Head of Clinical Engineering",
 "Jefe que imparte":"Manager instructor","Ingeniero que imparte":"Engineer instructor",
 "Parámetros operativos públicos de la institución; no contiene secretos de Supabase.":"Public institution settings; no Supabase secrets are shown.",
 "Compara objetos privados y metadatos sin exponer la clave administrativa.":"Compare private files and metadata without exposing administrative credentials.",
 "Metadatos sin objeto:":"Metadata without a file:","Objetos huérfanos:":"Orphaned files:",
 "Equipos activos":"Active equipment","Órdenes abiertas":"Open orders","Reportes abiertos":"Open reports","Capacitaciones próximas":"Upcoming training",
 "Estado actual calculado con la información disponible en BioMedGest.":"Current status calculated from available BioMedGest data.",
 "Disponibilidad de equipos":"Equipment availability","Reportes por prioridad":"Reports by priority","Prioridad registrada":"Recorded priority",
 "Registros abiertos visibles para tu sesión":"Open records visible to your session","Órdenes de mantenimiento":"Maintenance orders","Ver mantenimiento":"View maintenance",
 "No hay órdenes abiertas":"No open orders","No se muestran órdenes de demostración.":"Demo orders are not shown.",
 "No hay reportes abiertos":"No open reports","Sin reportes en el periodo":"No reports in this period","equipos con estado desconocido":"equipment with unknown status",
 "Sin datos recientes":"No recent data","Cargando panel...":"Loading dashboard...","Ubicación específica":"Specific location","Resguardo del equipo":"Equipment custody",
 "Ficha clínica limitada":"Limited clinical record","Función":"Function","Aplicación clínica":"Clinical application","Requerimiento de mantenimiento":"Maintenance requirement",
 "Puntaje total":"Total score","Categoría":"Category","Fecha de evaluación":"Assessment date","Ver ficha":"View record",
 "Motivo del cierre *":"Reason for closure *","Seguridad hospitalaria":"Hospital safety","Activación pendiente":"Activation pending",
 "Seguimiento de reportes, asignaciones y mantenimientos en tu jornada.":"Track reports, assignments and maintenance during your workday.",
 "Cargando órdenes...":"Loading orders...","Consultando órdenes de servicio...":"Loading service orders...","No fue posible consultar la información":"Unable to load information",
 "Foto de perfil inválida o no cargada":"Invalid or missing profile photo","Procesando imagen...":"Processing image...",
 "La identidad Auth se crea únicamente mediante la función backend protegida.":"Login accounts are created exclusively by the protected backend.",
 "Al cambiar el rol, el prefijo del ID se ajusta automáticamente: 00 jefe, 01 biomédico, 02 usuario. Se conserva la contraseña.":"Changing the role automatically adjusts the ID prefix: 00 manager, 01 biomedical engineer, 02 user. The password is preserved.",
 "La cuenta inhabilitada se eliminará del directorio y se bloqueará su acceso. Sus reportes, órdenes e historial se conservarán para mantener la trazabilidad. Esta acción no permite reactivar la cuenta.":"The disabled account will be removed from the directory and access will be blocked. Reports, orders and history are retained for traceability. The account cannot be reactivated.",
 "La contraseña temporal se envía directamente a la función y no se almacena en React ni PostgreSQL.":"The temporary password is sent to the protected backend and is never stored in the database.",
 "Usa de 6 a 12 caracteres, con mayúscula, minúscula y número.":"Use 6 to 12 characters, including uppercase, lowercase and a number.",
 "Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.":"Password updated successfully. Sign in with your new password.",
 "Puedes editar tus datos personales. Tu rol y estado requieren autorización de un jefe.":"You can edit your personal details. Role and access changes require a manager.",
 "Reportes, asignaciones, mantenimientos y cambios persistidos.":"Reports, assignments, maintenance and saved changes.",
 "Foto de perfil (opcional)":"Profile photo (optional)","Impartido por":"Provided by","No hay archivos vinculados.":"No linked files.",
})
Object.assign(dictionary,{
 "Organizar evento":"Organize event","Evento":"Event","Dirigido a":"Audience","Jefes":"Managers","Usuarios":"Users","Ingenieros biomédicos":"Biomedical engineers",
 "Responsable:":"Responsible:","Programar mantenimiento":"Schedule maintenance","Volver al calendario":"Back to calendar","Edad":"Age",
 "El jefe organizador también puede consultar el evento.":"The organizing manager can also view the event.",
 "El instructor y el jefe también pueden consultar la capacitación.":"The instructor and manager can also view the training.",
 "Se crea una orden preventiva. El equipo, responsable y horario aparecerán en el calendario de todos los perfiles.":"A preventive order is created. Equipment, assigned engineer and schedule will appear in every profile’s calendar.",
 "Este equipo no tiene una rutina preventiva vinculada.":"This equipment has no linked preventive routine.",
 "Mantenimientos, capacitaciones y eventos dirigidos a tu perfil en una sola agenda.":"Maintenance, training and events for your profile in one calendar.",
 "Revisa la separación sugerida del nombre y completa solo los datos que conozcas.":"Review the suggested name split and complete only the information you know.",
 "Departamento actual":"Current department",
})
export function t(value:string):string {
 if(preferences().language!=="en")return value
 const exact=dictionary[value];if(exact)return exact
 const match=value.match(/^(.*?)(\s*\*|:)$/);if(match && dictionary[match[1]])return dictionary[match[1]]+match[2]
 return value
}
