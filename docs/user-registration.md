# Alta de usuarios

Actualización: 25 de noviembre de 2026. Migración `28_user_registration.sql` y función `admin-users`.

- El jefe registra nombres y apellidos separados, edad (18–100 años), departamento del catálogo y teléfono opcional (10–15 dígitos, prefijo `+` opcional).
- PostgreSQL asigna el identificador al guardar la solicitud: prefijo `00` jefe, `01` ingeniero biomédico, `02` usuario; consecutivo global desde `181000`, avanzando por encima de sufijos existentes. Los identificadores actuales no se modifican. La secuencia tolera concurrencia; puede dejar saltos tras intentos fallidos.
- El catálogo incluye los departamentos existentes, las áreas hospitalarias activas y departamentos hospitalarios iniciales. El cliente no puede insertar departamentos.
- Se conserva la aprobación explícita mediante «Crear cuenta Auth», con contraseña temporal. La función toma identidad, rol y datos exclusivamente de la solicitud validada, ignorando esos campos si se alteran desde el cliente. Solo un jefe activo puede crear cuentas.
- Las contraseñas temporales y los cambios de contraseña en la app admiten 6–12 caracteres, conservando mayúscula, minúscula y número. El backend valida antes de contactar Auth. Supabase Auth tiene mínimo global 6; sus demás requisitos globales se conservan. El máximo se aplica en los flujos de la aplicación; Auth no expone un parámetro global de longitud máxima.
- Los usuarios existentes pueden seguir iniciando sesión con su contraseña actual, aunque sea más larga. El alta exige cambiar la contraseña temporal y luego volver a iniciar sesión.
- Las solicitudes antiguas sin datos personales completos deben registrarse nuevamente. No se inventan nombres, apellidos, edades ni teléfonos para las cuentas existentes.

Validación: pruebas del formulario, límites de contraseña y handler Edge aislado; comprobación SQL en copia local con rollback para los tres roles, identificadores, permisos, nombres con acentos y rechazo de entradas inválidas. El respaldo previo se guarda fuera del repositorio. No se crean cuentas de prueba en producción.
