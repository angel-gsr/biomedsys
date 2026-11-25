# Capacitadores, documentos, preferencias y perfiles

Actualización: 25 de noviembre de 2026. Migraciones 34 y 35; función `admin-users` actualizada para transferir la foto de la solicitud al perfil creado.

## Capacitaciones

El jefe elige primero «Jefe» o «Ingeniero biomédico» y luego ve únicamente los instructores habilitados de ese grupo. En el perfil 01 no aparece el selector: el instructor es la persona autenticada. PostgreSQL fuerza esta regla, valida el rol y el acceso del instructor e impide que un técnico gestione la capacitación de otro. Los nombres de instructores históricos se conservan aunque su cuenta se inhabilite; eso no permite seleccionarlos para nuevas sesiones.

## Documentos y equipo

El índice A–Z, incluida Ñ, filtra por la inicial del área, ignora acentos y desactiva letras sin áreas. Cambiar el área o limpiar filtros reinicia la letra y el equipo seleccionado. Las búsquedas y permisos existentes se conservan. La ficha del equipo muestra un botón de edición ampliado, con lápiz, antes del encabezado del equipo y alineado a la izquierda.

## Preferencias

Configuración está disponible en los tres perfiles. Cada navegador guarda idioma español/inglés y apariencia clara/oscura/automática; solo el jefe conserva la configuración institucional. El cambio de idioma usa un diccionario local para textos de interfaz; no envía información a servicios externos de traducción ni modifica nombres, documentos o registros clínicos. Los valores persistidos de estados y roles no se traducen al escribir en la base de datos.

El modo automático calcula la hora en `America/Mexico_City`, independientemente de la zona del dispositivo. Usa claro desde las 06:00 hasta las 17:59 y oscuro desde las 18:00 hasta las 05:59; vuelve a comprobar la hora cada minuto y al recuperar el foco. La zona de la configuración institucional y su moneda se eligen en listas, y se conserva la configuración de avisos preventivos.

## Perfiles y fotografías

El alta y la edición administrativa incluyen nombres, apellidos, edad, teléfono opcional de diez dígitos, departamento, rol y foto opcional. Para registros antiguos sin datos separados se solicita completar esos campos; no se adivinan apellidos ni edades. La RPC `manage_profile_details` valida y guarda todo en una transacción, reutilizando el cambio de rol e identificador auditado.

Las fotos se recortan al centro y se reducen a 192 × 192 píxeles en el navegador, eliminando el original y sus metadatos del archivo subido. Solo se acepta WebP/JPEG procesado, hasta 64 KiB, en el bucket privado `profile-avatars`. Los originales PNG/JPEG/WebP de hasta 10 MiB se procesan localmente. El jefe puede subir y quitar las fotos; usuarios autenticados pueden consultar su propia foto y el jefe las del directorio. Los enlaces firmados duran diez minutos. Si la foto no existe o falla, se muestran las iniciales. Al crear Auth se conserva la referencia validada de la solicitud; no se guarda imagen base64 en perfiles.

## Verificación

Pruebas automatizadas de grupos de instructores, asignación propia, índice alfabético, límites y recorte de imágenes, avatar privado, edición y reglas de idioma/horario. Comprobaciones SQL con rollback para los roles, las referencias de fotos y la conservación histórica. Recorrido de Chrome con backend simulado para jefe, técnico y usuario en 1280 y 390 píxeles: idioma, temas, menú, capacitación y foto comprimida. No se crearon capacitaciones ni cuentas reales durante las pruebas.
