import { useEffect, useState } from "react"
import { ClipboardCheck, RefreshCw } from "lucide-react"
import {
  claimCorrectiveOrder,
  listAvailableCorrectiveOrders,
  type AvailableCorrectiveOrder,
} from "../lib/correctiveQueue"
import { useOperationalRefresh } from "../lib/useOperationalRefresh"
import { type Role } from "../lib/supabase"
import { t } from "../lib/i18n"
import { Button } from "./ui"
export function CorrectiveOrderQueue({
  role,
  onOpenOrder,
  onAssignReport,
  onChanged,
}: {
  role: Role
  onOpenOrder?: (id: number) => void
  onAssignReport?: (id: number) => void
  onChanged?: () => void
}) {
  const [rows, setRows] = useState<AvailableCorrectiveOrder[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<number | null>(null),
    [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    listAvailableCorrectiveOrders()
      .then((items) => {
        if (active) setRows(items)
      })
      .catch((cause) => {
        if (active)
          setError(
            cause && typeof cause === "object" && "message" in cause
              ? String(cause.message)
              : "No fue posible consultar las órdenes disponibles.",
          )
      })
    return () => {
      active = false
    }
  }, [reload])
  useOperationalRefresh(
    () => setReload((n) => n + 1),
    ["maintenances", "reports"],
  )
  async function take(id: number) {
    if (busy !== null) return
    setBusy(id)
    setError("")
    try {
      const order = await claimCorrectiveOrder(id)
      setRows((items) => items.filter((item) => item.id !== id))
      window.dispatchEvent(new Event("biomedgest:reports-changed"))
      window.dispatchEvent(new Event("biomedgest:operations-changed"))
      onChanged?.()
      onOpenOrder?.(order.id)
    } catch (cause) {
      setError(
        cause && typeof cause === "object" && "message" in cause
          ? String(cause.message)
          : "No fue posible tomar la orden.",
      )
      setReload((n) => n + 1)
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="panel corrective-queue">
      <div className="panel-head">
        <div>
          <h3>{t("Órdenes correctivas disponibles")}</h3>
          <p>
            {t(
              "Cada falla genera una orden. Solo un biomédico puede tomarla; el jefe también puede asignarla.",
            )}
          </p>
        </div>
        <ClipboardCheck size={22} />
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
          <Button
            icon={RefreshCw}
            variant="secondary"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("Actualizar")}
          </Button>
        </div>
      )}
      {!rows.length ? (
        <p className="calendar-help">
          {t("No hay órdenes correctivas pendientes de asignación.")}
        </p>
      ) : (
        <div className="corrective-queue-list">
          {rows.map((order) => (
            <article key={order.id}>
              <div>
                <strong>
                  {order.maintenance_number} · {order.equipment_identifier}
                </strong>
                <p>{order.description}</p>
                <small>
                  {order.report_number} · {order.service} ·{" "}
                  {order.location || t("Sin ubicación registrada")}
                </small>
              </div>
              <span
                className={`badge badge-${
                  order.priority === "critica"
                    ? "danger"
                    : order.priority === "alta"
                      ? "warning"
                      : "success"
                }`}
              >
                {t(
                  order.priority === "critica"
                    ? "Crítica"
                    : order.priority === "alta"
                      ? "Alta"
                      : "Ordinaria",
                )}
              </span>
              {role === "tecnico" ? (
                <Button
                  disabled={busy !== null}
                  onClick={() => void take(order.id)}
                >
                  {busy === order.id ? t("Tomando orden...") : t("Tomar orden")}
                </Button>
              ) : onAssignReport ? (
                <Button
                  variant="secondary"
                  onClick={() => onAssignReport(order.source_report_id)}
                >
                  {t("Asignar ingeniero")}
                </Button>
              ) : (
                <span className="badge badge-neutral">
                  {t("Asignar desde Mesa de ayuda")}
                </span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
