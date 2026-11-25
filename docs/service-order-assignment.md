# Orden de servicio desde Mesa de ayuda

El jefe abre «Clasificar y crear orden» para consultar el incidente y elegir prioridad, ingeniero biomédico habilitado y fecha de atención. Abrir o regresar no escribe en la base de datos. «Confirmar asignación y crear orden» llama la RPC existente `create_corrective_order_from_report`, que conserva sus controles de permisos y unicidad de orden por reporte.

Al confirmar se abre la orden retornada por el servidor. Al regresar, el reporte muestra «Orden vinculada» y su estado en verde; desaparece la acción de asignación y queda «Ver orden». Esta vista es de consulta, agrupada en asignación, equipo, incidente y seguimiento técnico. No permite reasignar ni editar desde Mesa de ayuda. La atención y validación técnica siguen disponibles en el módulo Órdenes.

El PDF se genera con jsPDF a partir de los mismos datos consultados; incluye folios de orden y reporte, técnico, prioridad, programación, equipo, incidente y expediente disponible. El documento pagina automáticamente texto largo y muestra su fecha de generación. No modifica la orden ni crea una firma o validación legal.

No requiere migración de Supabase ni altera órdenes existentes. Pruebas: confirmación explícita, regreso sin escritura, orden exacta retornada, consulta sin controles de edición, PDF con datos y varias páginas; recorrido con backend simulado en escritorio y móvil, más lectura del PDF descargado.
