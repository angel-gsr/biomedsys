import { useEffect, useState } from "react"
import { CalendarDays } from "lucide-react"
import {
  getMaintenanceDates,
  maintenanceDateLabel,
  type MaintenanceDates,
} from "../lib/maintenanceDates"
import { useOperationalRefresh } from "../lib/useOperationalRefresh"
import { t } from "../lib/i18n"
export function EquipmentMaintenanceDates({
  equipmentId,
}: {
  equipmentId: string
}) {
  const [rows, setRows] = useState<MaintenanceDates[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    getMaintenanceDates(equipmentId)
      .then((items) => {
        if (active) {
          setRows(items)
          setError("")
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause?.message ||
              "No fue posible consultar las fechas de mantenimiento.",
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
    ["maintenances", "equipment_maintenance_programs"],
  )
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(new Date())
  return (
    <section className="detail-section equipment-maintenance-dates">
      <h3>
        <CalendarDays size={20} />
        {t("Calendarización de mantenimiento")}
      </h3>
      {loading ? (
        <p role="status">{t("Consultando fechas...")}</p>
      ) : error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : !rows.length ? (
        <p>{t("Sin fechas de mantenimiento registradas.")}</p>
      ) : (
        rows.map((row) => (
          <article key={row.program_id}>
            <h4>{row.program_name}</h4>
            <dl className="data-grid">
              <div>
                <dt>{t("Periodicidad")}</dt>
                <dd>{row.periodicity || t("Pendiente de confirmar")}</dd>
              </div>
              <div>
                <dt>{t("Último mantenimiento registrado")}</dt>
                <dd>{maintenanceDateLabel(row.last_on)}</dd>
              </div>
              <div>
                <dt>{t("Próximo mantenimiento previsto")}</dt>
                <dd>
                  {maintenanceDateLabel(row.next_on)}{" "}
                  {row.next_on && row.next_on < today && (
                    <span className="badge badge-warning">
                      {t("Fecha vencida")}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            {row.notes && <p>{row.notes}</p>}
            {row.reported_last_on &&
              row.last_on &&
              row.last_on > row.reported_last_on && (
                <p className="maintenance-date-reference">
                  {t(
                    "Se conserva el mantenimiento más reciente registrado en el sistema.",
                  )}{" "}
                  {t("Referencia anterior")}:{" "}
                  {maintenanceDateLabel(row.reported_last_on)} ·{" "}
                  {t("Fecha prevista anterior")}:{" "}
                  {maintenanceDateLabel(row.reported_next_on)}
                </p>
              )}
            <small>
              {t(
                "La fecha prevista aparece en el calendario general. El horario y responsable se confirman al programar la orden.",
              )}
            </small>
          </article>
        ))
      )}
    </section>
  )
}
