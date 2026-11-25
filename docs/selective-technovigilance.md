# Tecnovigilancia derivada de reportes

Tecnovigilancia es un expediente especial relacionado con un reporte de falla. No sustituye el reporte ni su orden correctiva y no genera copias adicionales de estos.

La bandeja incluye reportes con al menos uno de estos datos:

- Prioridad Alta o Crítica.
- Lesión registrada en el paciente o el operador: temporal, moderada, grave o fallecimiento. La lesión temporal se conserva como señal de daño para los registros que ya utilizaban esa opción.
- Riesgo explícito de daño moderado o grave.
- Tipo de evento explícitamente registrado como incidente adverso o incidente adverso potencial.

La prioridad sirve como señal para revisión. El personal biomédico confirma en el formulario si el caso corresponde a un incidente adverso con daño ocurrido o a uno potencial. Una falla ordinaria sin daño ni señal de riesgo permanece en Mesa de ayuda. Su flecha abre la vista del reporte; para casos elegibles abre Tecnovigilancia.

El reporte incorpora resultado para el operador y una casilla de daño potencial. Ambos conservan valores explícitos por defecto (No aplica / falso), aparecen en su consulta y PDF y están sujetos al mismo límite de diez minutos para corrección del autor. Se agrega la opción Lesión moderada al resultado del paciente.

El formulario especial incluye clasificación, persona afectada o en riesgo, consecuencias, medidas de seguridad, riesgo interno y el seguimiento documental existente. El PDF se habilita al guardar los campos requeridos; vuelve a bloquearse cuando hay cambios pendientes. La generación consulta los datos guardados en Supabase. Incluye logo, marca de agua, folio de origen, equipo, evaluación, seguimiento y responsable; permite vista previa, descarga e impresión.

La clasificación interna no envía avisos a COFEPRIS. Se mantiene la distinción existente entre metas internas y plazos normativos; referencia de consulta: [NOM-240-SSA1-2012, texto oficial](https://sidof.segob.gob.mx/notas/docFuente/5275834).

Seguridad: la migración 42 filtra candidatos en Supabase y rechaza guardar o generar el PDF especial para reportes sin criterio. Las operaciones requieren personal biomédico habilitado. La función anterior de guardado pasa a ser privada; solo se reutiliza internamente para preservar el cálculo de fechas, incluido el calendario de días inhábiles de expedientes anteriores.

Aplicado al proyecto `yvqccoavcwfzcxrfvsjs` con respaldo verificado. Los reportes, revisiones, órdenes y documentos anteriores se conservaron. No se crearon expedientes históricos en bloque. Pruebas SQL con reversión: exclusión e inclusión por cada criterio, permisos, formulario completo, acceso al PDF, corrección y calendario. Validación adicional: 154 pruebas automatizadas, TypeScript, compilación y navegación/formulario/PDF en Chrome para jefe y biomédico en móvil y escritorio.
