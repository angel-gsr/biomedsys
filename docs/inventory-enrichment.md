# Ampliación del inventario desde Final (2).xlsx

La actualización conserva los 100 equipos, sus UUID, sus movimientos, órdenes,
reportes, riesgos, documentos y configuraciones. Las ocho columnas básicas de
identidad/ubicación del Excel coinciden con el paquete original; también se
compararon rutinas, enlaces y evaluaciones de riesgo, sin cambios.

La migración `21_inventory_enrichment.sql` agrega una tabla por equipo con la
información adicional. No recrea activos ni vuelve a importar el inventario base.
Los lotes incluyen el nombre del archivo, SHA-256, fila original y contenido;
cada versión se conserva y los cambios quedan auditados.

## Columnas

| Excel | Integración |
| --- | --- |
| Periodicidad mantenimiento | Texto completo y sugerencia de meses solo para valores inequívocos |
| Posibles problemas | Descripción completa en la ficha técnica |
| baja de equipos | Nota de baja/sustitución; no cambia el estado operativo automáticamente |
| Garantía | Valor original; los vacíos permanecen sin información |
| FDA/COFEPRIS | Referencia textual del archivo, sin afirmar una verificación regulatoria vigente |

Los 100 equipos tienen periodicidad y posibles problemas. Hay 11 notas de
sustitución, 46 valores de garantía y 46 referencias regulatorias. De las
periodicidades, 56 son intervalos simples y 44 requieren revisar tareas, horas de
uso o intervalos múltiples. No se reduce una periodicidad compuesta a un único
número ni se generan fechas u órdenes automáticamente.

Jefe y técnico ven estos campos en la ficha. El jefe puede cargar una sugerencia
simple en el formulario preventivo y confirmar con **Guardar periodicidad**.
Se conservan sus fechas de referencia y última intervención. La ficha muestra
la configuración específica del equipo, en lugar de tomar únicamente la
periodicidad global de la rutina compartida.

La consulta básica del usuario conserva sus restricciones. La importación está
reservada al despliegue administrativo; las sesiones de navegador no pueden
ejecutarla ni escribir directamente estas tablas.

## Extracción y validación

```powershell
python scripts/inventory/extract_inventory_enrichment.py 'C:\ruta\Final (2).xlsx' --output-dir data/inventory/enrichment
python -m unittest discover -s scripts/inventory -p 'test_inventory_enrichment.py' -v
```

El extractor lee el Excel sin modificarlo, rechaza códigos repetidos, datos sin
encabezado o cambios en las columnas originales comparadas. No ejecuta fórmulas
ni instrucciones contenidas en celdas. Emite JSON, manifiesto y SQL revisable.

Antes de aplicar, respaldar la base completa y `public`, revisar los índices de
los respaldos y restaurar `public` en PostgreSQL local. La prueba
`validate_inventory_enrichment.py` está restringida a `biomedgest_enrichment_restore`
en localhost:55441; verifica textos y nulos exactos, idempotencia, rechazo íntegro
ante una identidad incorrecta y permisos de jefe/técnico/usuario.

Aplicar la migración 21 antes de `data/inventory/enrichment/import.sql`. Un lote
conocido no se vuelve a aplicar, evitando que reproducir un archivo anterior
deshaga una actualización posterior. El postflight está en
`scripts/inventory/verify_inventory_enrichment_postflight.sql`.

Fuente importada: `Final (2).xlsx`, SHA-256
`3eff2c6bfbcaa84282dc5ae6a3e44215a70f34c3c412a58a1f3091f870c9c7fc`.
Se aplicó en `yvqccoavcwfzcxrfvsjs` el 23 de noviembre de 2026. Se verificaron
conteos y huellas de las tablas previas antes de confirmar la transacción;
la importación solo añadió la nueva información y su trazabilidad. Los respaldos
y el resultado del despliegue se conservan fuera del repositorio.
