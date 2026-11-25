# Resumen y calendario operativo

Actualización: 25 de noviembre de 2026.

- Resumen elimina «Nuevo reporte» y coloca los pendientes antes de las gráficas. Combina órdenes programadas/en proceso e incidentes sin asignar, sin duplicar reportes con orden vinculada. Ordena por prioridad y fecha; muestra hasta seis pendientes y tres atenciones concluidas recientes.
- Cada elemento abre su orden o incidente. Las órdenes abiertas desde Resumen regresan a Resumen; las de Mesa de ayuda mantienen su regreso anterior. «Ver mantenimiento» abre Mantenimiento, no el calendario.
- Los indicadores de próximos mantenimientos excluyen trabajos terminados y cancelados. Los datos se consultan al entrar, al recuperar el foco, al recibir eventos internos de cambios y cada 15 segundos; la actualización de fondo conserva los datos mientras carga.
- Calendario sigue consultando los registros originales mediante `list_general_calendar`, sin copiar eventos. Una verificación de solo lectura confirmó la correspondencia entre sus estados y las tablas originales. Cancelados desaparecen; concluidos conservan su historial y dejan de marcar «Fin pendiente». Los detalles abiertos se actualizan o cierran si su origen cambia o deja de estar disponible.
- Las etiquetas de colores filtran por tipo y conservan el selector explícito. La agenda se muestra al seleccionar una fecha. Se elimina el botón inferior de órdenes de mantenimiento.
- En la lista de inventario la edición usa el mismo estilo compacto de «Ver ficha». En la ficha conserva el tamaño grande y comparte una barra superior con «Volver al inventario», alineada a la derecha sin superponerse al encabezado.
- El enlace QR de equipo se procesa una vez por cuenta; las actualizaciones de sesión por foco no redirigen de nuevo a una ficha anterior. Al salir de la ficha se limpia ese parámetro de la URL.

La revisión automática rechazó ampliar la publicación Realtime. Se implementó consulta automática con intervalo de 15 segundos y foco, sin cambiar publicaciones, permisos ni datos de Supabase.

Verificación: prioridad y deduplicación de pendientes, cambios de estado y cancelaciones, filtros, acciones de retorno y temporizadores. Recorrido de navegador con backend simulado en 1280, 390 y 320 píxeles; no se crearon ni concluyeron órdenes reales durante las pruebas.
