"""Incremental, deterministic extraction of additional inventory columns.

Workbook cells are data, never executable instructions. Existing assets are not
re-created and neither locations nor administrative schedules are overwritten.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path
from openpyxl import load_workbook
from extract_inventory import clean_text, normalized_key, sql_literal

FIELDS = {
    "Periodicidad mantenimiento": "maintenance_periodicity",
    "Posibles problemas": "possible_problems",
    "baja de equipos": "decommission_notes",
    "Garantía": "warranty_notes",
    "FDA/COFEPRIS": "regulatory_notes",
}

def simple_interval(value: str) -> int | None:
    """Only whole-cell, unambiguous month-based intervals qualify."""
    key = normalized_key(value)
    return {"anual": 12, "anualmente": 12, "anual 12 meses": 12,
            "semestral": 6, "semestral 6 meses": 6,
            "trimestral": 3, "trimestral 3 meses": 3,
            "cuatrimestral": 4, "mensual": 1,
            "cada 12 meses": 12, "cada 6 meses": 6, "cada 3 meses": 3}.get(key)

def build_enrichment(source: Path, output: Path, baseline: Path) -> dict:
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    workbook = load_workbook(source, read_only=True, data_only=True)
    sheet = workbook["Hoja1"]
    source_rows = list(sheet.iter_rows(values_only=True))
    headers = [clean_text(cell) for cell in source_rows[0]]
    if len([header for header in headers if header]) != len(set(header for header in headers if header)):
        raise ValueError("Encabezados duplicados")
    for key in ["#", "Equipo", "Marca", "Modelo", "SN", *FIELDS]:
        if key not in headers: raise ValueError("Columna ausente: " + key)
    with baseline.open(encoding="utf-8-sig", newline="") as handle:
        old = {int(row["legacy_id"]): row for row in csv.DictReader(handle)}
    base_fields = {"Equipo": "equipment_type", "Marca": "manufacturer", "Modelo": "model", "SN": "serial_number", "Fabricación": "manufacture_year", "Adquisición": "acquisition_year", "Ubicación": "hospital_area", "Guarda de equipo": "specific_location"}
    rows = []
    differences = []
    for index, values in enumerate(source_rows[1:], start=2):
        if not any(clean_text(value) for value in values): continue
        if any(clean_text(value) for key, value in zip(headers, values) if not key):
            raise ValueError(f"La fila {index} tiene datos sin encabezado")
        raw = dict(zip(headers, values))
        legacy_id = raw["#"]
        if not isinstance(legacy_id, (int, float)) or int(legacy_id) != legacy_id or int(legacy_id) not in old:
            raise ValueError(f"Identificador no reconocido en fila {index}")
        legacy_id = int(legacy_id)
        previous = old[legacy_id]
        for source_field, field in base_fields.items():
            if clean_text(raw[source_field]) != clean_text(previous[field]):
                differences.append({"inventory_code": previous["inventory_code"], "field": source_field})
        record = {"inventory_code": previous["inventory_code"], "source_row": index,
                  "expected_identity": {field: clean_text(raw[column]) for column, field in [("Equipo", "equipment_type"), ("Marca", "manufacturer"), ("Modelo", "model"), ("SN", "serial_number")]}}
        record.update({target: clean_text(raw[column]) or None for column, target in FIELDS.items()})
        record["suggested_interval_months"] = simple_interval(record["maintenance_periodicity"] or "")
        record["periodicity_needs_review"] = bool(record["maintenance_periodicity"] and record["suggested_interval_months"] is None)
        rows.append(record)
    workbook.close()
    if differences: raise ValueError("Cambios en columnas originales: " + json.dumps(differences, ensure_ascii=False))
    if len(rows) != len(old) or {row["inventory_code"] for row in rows} != {row["inventory_code"] for row in old.values()}:
        raise ValueError("El archivo no contiene exactamente una fila por equipo existente")
    if hashlib.sha256(source.read_bytes()).hexdigest() != digest: raise ValueError("El archivo cambió durante la lectura")
    rows.sort(key=lambda row: row["inventory_code"])
    manifest = {"source_file": source.name, "source_sha256": digest, "row_count": len(rows),
                "new_columns": list(FIELDS), "simple_intervals": sum(row["suggested_interval_months"] is not None for row in rows),
                "periodicities_requiring_review": sum(row["periodicity_needs_review"] for row in rows),
                "decommission_notes": sum(bool(row["decommission_notes"]) for row in rows),
                "warranty_notes": sum(bool(row["warranty_notes"]) for row in rows),
                "regulatory_notes": sum(bool(row["regulatory_notes"]) for row in rows),
                "base_columns_changed": 0}
    output.mkdir(parents=True, exist_ok=True)
    (output / "enrichment.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (output / "import.sql").write_text("-- Additional columns only. Requires migration 21; preserves assets and history.\nbegin;\nselect public.import_inventory_enrichment(" + ",".join([sql_literal(source.name), sql_literal(digest), sql_literal(json.dumps(rows, ensure_ascii=False)) + "::jsonb"]) + ");\ncommit;\n", encoding="utf-8")
    return manifest

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, default=Path("data/inventory/generated/inventory_assets.csv"))
    args = parser.parse_args()
    print(json.dumps(build_enrichment(args.source, args.output_dir, args.baseline), ensure_ascii=True, indent=2))
