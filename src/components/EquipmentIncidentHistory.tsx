import { useEffect, useState } from "react"
import { FileText } from "lucide-react"
import {
  getEquipmentIncidentHistory,
  type EquipmentIncident,
} from "../lib/equipmentDocuments"
import { useOperationalRefresh } from "../lib/useOperationalRefresh"
import { ReportPreview } from "./ReportPreview"
import { Button } from "./ui"
import { t } from "../lib/i18n"
export function EquipmentIncidentHistory({
  equipmentId,
}: {
  equipmentId: string
}) {
  const [rows, setRows] = useState<EquipmentIncident[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0),
    [preview, setPreview] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    getEquipmentIncidentHistory(equipmentId)
      .then((data) => {
        if (active) {
          setRows(data)
          setError("")
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause && typeof cause === "object" && "message" in cause
              ? String(cause.message)
              : "No fue posible consultar las incidencias.",
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [equipmentId, reload])
  useOperationalRefresh(
    () => setReload((n) => n + 1),
    ["reports", "maintenances"],
  )
  return (
    <section className="panel equipment-incident-history">
      <h3>{t("Registro de incidencias")}</h3>
      <p>
        {t(
          "Historial de reportes e incidentes atribuidos a este equipo, según los permisos de tu cuenta.",
        )}
      </p>
      {loading ? (
        <p role="status">{t("Consultando reportes del equipo...")}</p>
      ) : error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : rows.length ? (
        <div className="equipment-incident-list">
          {rows.map((row) => (
            <article key={row.id}>
              <div>
                <strong>
                  {row.report_number} · {row.incident}
                </strong>
                <small>
                  {new Date(row.created_at).toLocaleString("es-MX")} ·{" "}
                  {row.status}
                </small>
                {row.observations && <p>{row.observations}</p>}
                {row.maintenance_number && (
                  <small>
                    {t("Orden vinculada")}: {row.maintenance_number}
                  </small>
                )}
              </div>
              <span
                className={`badge badge-${
                  row.priority === "Crítica"
                    ? "danger"
                    : row.priority === "Alta"
                      ? "warning"
                      : "success"
                }`}
              >
                {t(row.priority)}
              </span>
              <Button
                icon={FileText}
                variant="secondary"
                onClick={() => setPreview(row.id)}
              >
                {t("Ver reporte / PDF")}
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <p>
          {t("No hay reportes de incidentes registrados para este equipo.")}
        </p>
      )}
      {preview !== null && (
        <ReportPreview
          reportId={preview}
          onClose={() => setPreview(null)}
          onChanged={() => setReload((n) => n + 1)}
        />
      )}
    </section>
  )
}
