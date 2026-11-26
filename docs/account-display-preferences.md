# Preferencias de visualización por cuenta

El idioma y el tema se guardan en localStorage con una clave que incorpora el UUID de la cuenta. Al cargar, cambiar o cerrar sesión se seleccionan sus preferencias antes de mostrar el perfil correspondiente. El modo automático conserva el horario de Puebla.

Los eventos de almacenamiento de otra cuenta se ignoran. Las pestañas de la misma cuenta sí comparten sus preferencias. Las selecciones se conservan por cuenta en ese navegador; no se sincronizan entre dispositivos mediante Supabase.

La clave global anterior no se hereda: no contiene información que permita identificar a su propietario. Las cuentas sin preferencias propias comienzan en español y tema automático y pueden guardar su selección desde Configuración. Al cerrar sesión se restablecen esos valores para la pantalla de acceso.

Validación: 165 pruebas automatizadas, TypeScript y compilación. Una prueba de Chrome con dos cuentas y tres pestañas en un mismo contexto verificó aislamiento de tema e idioma, sincronización de la misma cuenta y restauración después de recargar.
