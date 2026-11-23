import json
import tempfile
import unittest
from pathlib import Path
from openpyxl import Workbook
from extract_inventory_enrichment import build_enrichment, simple_interval

class EnrichmentTests(unittest.TestCase):
    def test_only_exact_unambiguous_intervals_are_converted(self):
        self.assertEqual(simple_interval("Semestral"), 6)
        self.assertEqual(simple_interval("Anual (12 meses)"), 12)
        for value in ["Cuatrimestral/Semestral", "Cada 10,000 horas; sensor cada 2 años", "Anual (con control mensual)", "Cada 24 meses y cada 6 meses"]:
            self.assertIsNone(simple_interval(value))

    def test_extra_columns_preserve_text_and_do_not_recreate_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            baseline = root / "baseline.csv"
            baseline.write_text("legacy_id,inventory_code,equipment_type,manufacturer,model,serial_number,manufacture_year,acquisition_year,hospital_area,specific_location\n1,EQ-000001,Monitor,Marca,Modelo,123,2020,2021,UCI,Sala 1\n",encoding="utf-8")
            w = Workbook();s=w.active;s.title="Hoja1"
            s.append(["#","Equipo","Marca","Modelo","SN","Fabricación","Adquisición","Ubicación","Guarda de equipo","Periodicidad mantenimiento","Posibles problemas","baja de equipos ","Garantía","FDA/COFEPRIS",None])
            s.append([1,"Monitor","Marca","Modelo",123,2020,2021,"UCI","Sala 1","Cuatrimestral/Semestral","Falla de batería\nNo enciende","Sustitución recomendada",None,"No verificado",None])
            file = root / "updated.xlsx";w.save(file)
            manifest=build_enrichment(file,root/"out",baseline)
            row=json.loads((root/"out/enrichment.json").read_text(encoding="utf-8"))[0]
            self.assertEqual(manifest["row_count"],1)
            self.assertEqual(row["possible_problems"],"Falla de batería\nNo enciende")
            self.assertTrue(row["periodicity_needs_review"])
            self.assertIsNone(row["warranty_notes"])
            sql=(root/"out/import.sql").read_text(encoding="utf-8")
            self.assertIn("import_inventory_enrichment",sql)
            self.assertNotIn("insert into public.equipment_assets",sql)
            s.cell(2,4,"Otro modelo");w.save(file)
            with self.assertRaisesRegex(ValueError,"Cambios en columnas originales"):
                build_enrichment(file,root/"out",baseline)

if __name__ == "__main__": unittest.main()
