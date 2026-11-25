import { t } from "../lib/i18n"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MonitorCog,
  Plus,
  RefreshCw,
  Wrench,
} from "lucide-react"
import {
  loadDashboardData,
  type DashboardData,
  type Profile,
  type ReportSummary,
  type Role,
} from "../lib/supabase"
import { Button, PageIntro } from "./ui"

type DashboardView = "reportes" | "inventario" | "calendario"

const reportStatusClosed = new Set(["Resuelto", "Cerrado"])
const maintenanceStatusLabels: Record<string, string> = {
  programado: "Programado",
  en_proceso: "En proceso",
  completado: "Completado",
  cancelado: "Cancelado",
}

function currentDateLabel() {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode
  tone?: string
}) {
  return <span className={`badge badge-${tone}`}>{typeof children === "string" ? t(children) : children}</span>
}

function KpiCard({
  icon: Icon,
  label,
  value,
  note,
  tone = "blue",
}: {
  icon: React.ElementType
  label: string
  value: number
  note: string
  tone?: string
}) {
  return (
    <article className="kpi-card">
      <div className={`kpi-icon tone-${tone}`}>
        <Icon size={21} />
      </div>
      <div>
        <span>{t(label!)}</span>
        <strong>{value.toLocaleString("es-MX")}</strong>
        <small>{t(note)}</small>
      </div>
    </article>
  )
}

function priorityTone(priority: string | null) {
  if (priority === "Crítica" || priority === "critica") return "danger"
  if (priority === "Alta" || priority === "alta") return "warning"
  return "success"
}

function ManagerContent({
  data,
  profile,
  setView,
}: {
  data: DashboardData
  profile: Profile
  setView: (view: DashboardView) => void
}) {
  const activeReports = data.reports.filter(
    (report) => !reportStatusClosed.has(report.status),
  )
  const now = new Date()
  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 7)
  const upcomingMaintenances = data.maintenances.filter((item) => {
    const date = new Date(item.scheduled_at)
    return item.status !== "cancelado" && date >= now && date <= nextWeek
  })
  const statusCounts = data.equipment.reduce<Record<string, number>>(
    (counts, item) => {
      counts[item.status] = (counts[item.status] || 0) + 1
      return counts
    },
    {},
  )
  const last30Days = new Date(now)
  last30Days.setDate(last30Days.getDate() - 30)
  const reportsByService = Array.from(
    data.reports
      .filter((report) => new Date(report.created_at) >= last30Days)
      .reduce<Map<string, number>>((counts, report) => {
        counts.set(
          report.service || "Sin servicio",
          (counts.get(report.service || "Sin servicio") || 0) + 1,
        )
        return counts
      }, new Map()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
  const maxFailures = Math.max(1, ...reportsByService.map(([, count]) => count))
  const priorityCounts = ["Crítica", "Alta", "Ordinaria"].map((priority) => ({
    priority,
    count: activeReports.filter((report) => report.priority === priority)
      .length,
  }))

  return (
    <>
      <PageIntro
        eyebrow={currentDateLabel()}
        title={`Hola, ${profile.full_name.split(" ")[0] || profile.full_name}`}
        description={t("Estado actual calculado con la información disponible en BioMedGest.")}
        action={
          <Button icon={Plus} onClick={() => setView("reportes")}>{"Nuevo reporte"}</Button>
        }
      />
      <div className="kpi-grid">
        <KpiCard
          icon={MonitorCog}
          label={t("Total de equipos")}
          value={data.equipment.length}
          note="Activos visibles en inventario"
        />
        <KpiCard
          icon={CheckCircle2}
          label={t("Operativos")}
          value={statusCounts.operativo || 0}
          note="Estado confirmado"
          tone="green"
        />
        <KpiCard
          icon={Wrench}
          label={t("En reparación")}
          value={statusCounts.en_reparacion || 0}
          note="Estado confirmado"
          tone="amber"
        />
        <KpiCard
          icon={AlertTriangle}
          label={t("Fuera de servicio")}
          value={statusCounts.fuera_de_servicio || 0}
          note="No incluye equipos dados de baja"
          tone="red"
        />
        <KpiCard
          icon={CalendarDays}
          label={t("Mant. próximos")}
          value={upcomingMaintenances.length}
          note="Siguientes 7 días"
          tone="violet"
        />
        <KpiCard
          icon={Clock3}
          label={t("Reportes pendientes")}
          value={activeReports.length}
          note="No resueltos ni cerrados"
          tone="amber"
        />
      </div>
      {(statusCounts.desconocido || 0) > 0 && (
        <div className="inventory-access-note" role="status">
          <AlertTriangle size={20} />
          <div>
            <strong>
              {statusCounts.desconocido}{" "}{t("equipos con estado desconocido")}</strong>
            <span>{t("BioMedGest no supone que estén operativos hasta que su estado sea confirmado.")}</span>
          </div>
        </div>
      )}
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-head">
            <div>
              <h3>{t("Reportes por servicio")}</h3>
              <p>{t("Últimos 30 días")}</p>
            </div>
          </div>
          {reportsByService.length === 0 ? (
            <div className="empty-state">
              <h3>{t("Sin reportes en el periodo")}</h3>
              <p>{t("La gráfica se mostrará cuando existan registros.")}</p>
            </div>
          ) : (
            <div className="bar-chart">
              {reportsByService.map(([service, count]) => (
                <div className="bar-col" key={service}>
                  <span>{count}</span>
                  <div className="bar-track">
                    <i
                      style={{
                        height: `${Math.max(8, (count / maxFailures) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>{service}</small>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel priority-panel">
          <div className="panel-head">
            <div>
              <h3>{t("Semáforo de atención")}</h3>
              <p>{t("Reportes activos")}</p>
            </div>
          </div>
          {priorityCounts.map(({ priority, count }) => (
            <div className="priority-row" key={priority}>
              <i className={`signal signal-${priorityTone(priority)}`} />
              <div>
                <strong>{priority}</strong>
                <span>{t("Prioridad registrada")}</span>
              </div>
              <b>{count}</b>
            </div>
          ))}
          <div className="sla">
            <Clock3 size={17} />
            <span>{t("Los objetivos SLA aún no están modelados en la base de datos.")}</span>
          </div>
        </section>
      </div>
      <RealOrdersTable data={data} setView={setView} />
    </>
  )
}

function RealOrdersTable({
  data,
  setView,
}: {
  data: DashboardData
  setView: (view: DashboardView) => void
}) {
  const active = data.maintenances
    .filter(
      (item) => item.status !== "completado" && item.status !== "cancelado",
    )
    .slice(0, 6)
  return (
    <section className="panel orders-panel">
      <div className="panel-head">
        <div>
          <h3>{t("Órdenes de mantenimiento")}</h3>
          <p>{t("Registros abiertos visibles para tu sesión")}</p>
        </div>
        <Button variant="ghost" onClick={() => setView("calendario")}>{t("Ver mantenimiento")}{" "}<ChevronRight size={16} />
        </Button>
      </div>
      {active.length === 0 ? (
        <div className="empty-state">
          <h3>{t("No hay órdenes abiertas")}</h3>
          <p>{t("No se muestran órdenes de demostración.")}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Orden")}</th>
                <th>{t("Equipo")}</th>
                <th>{t("Tipo")}</th>
                <th>{t("Prioridad")}</th>
                <th>{t("Estado")}</th>
                <th>{t("Programación")}</th>
              </tr>
            </thead>
            <tbody>
              {active.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong className="order-id">
                      {item.maintenance_number}
                    </strong>
                  </td>
                  <td>
                    {item.equipment_identifier ||
                      "Equipo vinculado sin etiqueta heredada"}
                  </td>
                  <td>{item.maintenance_code}</td>
                  <td>
                    <Badge tone={priorityTone(item.priority)}>
                      {item.priority || "Sin registrar"}
                    </Badge>
                  </td>
                  <td>{maintenanceStatusLabels[item.status] || item.status}</td>
                  <td>{formatDateTime(item.scheduled_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function RoleContent({
  data,
  profile,
  role,
  setView,
}: {
  data: DashboardData
  profile: Profile
  role: Exclude<Role, "jefe">
  setView: (view: DashboardView) => void
}) {
  const activeReports = data.reports.filter(
    (report) => !reportStatusClosed.has(report.status),
  )
  const openMaintenances = data.maintenances.filter(
    (item) => item.status === "programado" || item.status === "en_proceso",
  )
  const resolved = data.reports.filter(
    (report) => report.status === "Resuelto" || report.status === "Cerrado",
  )
  return (
    <>
      <PageIntro
        eyebrow={currentDateLabel()}
        title={`Hola, ${profile.full_name.split(" ")[0] || profile.full_name}`}
        description={t("La información mostrada corresponde a los registros visibles para tu cuenta.")}
        action={
          <Button onClick={() => setView("inventario")}>{"Consultar inventario"}</Button>
        }
      />
      <div className="tech-summary">
        <div>
          <span className="summary-icon amber">
            <Clock3 size={19} />
          </span>
          <span>
            <strong>{activeReports.length}{" "}{t("reportes activos")}</strong>
            <small>{t("Visibles por tus permisos")}</small>
          </span>
        </div>
        <div>
          <span className="summary-icon blue">
            <CalendarDays size={19} />
          </span>
          <span>
            <strong>{openMaintenances.length}{" "}{t("mantenimientos")}</strong>
            <small>{t("Programados o en proceso")}</small>
          </span>
        </div>
        <div>
          <span className="summary-icon green">
            <CheckCircle2 size={19} />
          </span>
          <span>
            <strong>{resolved.length}{" "}{t("reportes resueltos")}</strong>
            <small>{t("Histórico visible")}</small>
          </span>
        </div>
      </div>
      {role === "tecnico" ? (
        <RealOrdersTable data={data} setView={setView} />
      ) : (
        <section className="panel orders-panel">
          <div className="panel-head">
            <div>
              <h3>{t("Mis reportes recientes")}</h3>
              <p>{t("Seguimiento real de reportes visibles")}</p>
            </div>
            <Button variant="ghost" onClick={() => setView("reportes")}>{t("Ver todos")}</Button>
          </div>
          <ReportList reports={data.reports.slice(0, 5)} />
        </section>
      )}
    </>
  )
}

function ReportList({ reports }: { reports: ReportSummary[] }) {
  if (reports.length === 0)
    return (
      <div className="empty-state">
        <h3>{t("No hay reportes registrados")}</h3>
        <p>{t("Los nuevos reportes aparecerán aquí.")}</p>
      </div>
    )
  return (
    <div className="ticket-list">
      {reports.map((report) => (
        <article key={report.report_number}>
          <i
            className={`ticket-signal ${
              report.priority === "Crítica"
                ? "red"
                : report.priority === "Alta"
                  ? "amber"
                  : "green"
            }`}
          />
          <div className="ticket-main">
            <span>
              {report.report_number} · {formatDateTime(report.created_at)}
            </span>
            <strong>{report.description}</strong>
            <small>
              {report.equipment_identifier} · {report.service}
            </small>
          </div>
          <Badge tone={priorityTone(report.priority)}>{report.priority}</Badge>
          <Badge>{report.status}</Badge>
        </article>
      ))}
    </div>
  )
}

export function Dashboard({
  profile,
  setView,
}: {
  profile: Profile
  setView: (view: DashboardView) => void
}) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState("")
  const [reloadToken, setReloadToken] = useState(0)
  const role = profile.role

  useEffect(() => {
    let active = true
    setError("")
    setData(null)
    loadDashboardData(role)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No fue posible cargar el dashboard.",
          )
      })
    return () => {
      active = false
    }
  }, [reloadToken, role])

  const loadingLabel = useMemo(
    () =>
      role === "jefe"
        ? "Calculando indicadores reales..."
        : "Cargando tu actividad...",
    [role],
  )
  if (error)
    return (
      <section className="panel empty-state" role="alert">
        <AlertTriangle size={34} />
        <h3>{t("No fue posible cargar el panel")}</h3>
        <p>{error}</p>
        <Button
          icon={RefreshCw}
          variant="secondary"
          onClick={() => setReloadToken((value) => value + 1)}
        >{t("Reintentar")}</Button>
      </section>
    )
  if (!data)
    return (
      <section className="panel empty-state" aria-busy="true">
        <RefreshCw className="spin" size={34} />
        <h3>{loadingLabel}</h3>
        <p>{t("No se utilizarán valores de demostración si la consulta falla.")}</p>
      </section>
    )
  return role === "jefe" ? (
    <ManagerContent data={data} profile={profile} setView={setView} />
  ) : (
    <RoleContent data={data} profile={profile} role={role} setView={setView} />
  )
}
