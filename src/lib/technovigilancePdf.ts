import type { MaintenanceSummary } from "./supabase"
import type { TechnovigilanceDocumentData } from "./technovigilance"
export async function technovigilancePdf(data: TechnovigilanceDocumentData) {
  const { buildServiceOrderPdf } = await import("./serviceOrderPdf")
  const { report: r, review: v, reviewer: a } = data,
    date = (value?: string | null) =>
      value
        ? new Date(
            value.length === 10 ? value + "T12:00:00" : value,
          ).toLocaleString("es-MX")
        : "Pendiente / no registrado"
  const labels: Record<string, string> = {
    incidente_adverso: "Incidente adverso",
    incidente_adverso_potencial: "Incidente adverso potencial",
    paciente: "Paciente",
    operador: "Operador",
    ambos: "Paciente y operador",
    catastrofico: "Catastrófico",
    alto: "Alto",
    medio: "Medio",
    bajo: "Bajo",
    pendiente: "Pendiente de evaluación",
    amenaza_publica: "Amenaza grave de salud pública",
    muerte_deterioro_grave: "Muerte / deterioro grave",
    otro_notificable: "Otro incidente notificable",
    no_notificable: "No notificable",
  }
  return buildServiceOrderPdf(
    { maintenance_number: "TV-" + r.report_number } as MaintenanceSummary,
    [
      {
        title: "Reporte de origen y equipo",
        fields: [
          ["Reporte", r.report_number],
          ["Inventario", r.equipment_identifier],
          ["Fecha del evento", r.event_date],
          ["Equipo", r.equipment_snapshot?.equipment_type],
          ["Fabricante", r.manufacturer],
          ["Modelo / serie", r.model_serial],
          ["Área", r.service],
          ["Ubicación al reportar", r.location],
          ["Incidente", r.incident_label || r.description],
          ["Prioridad de atención", r.priority],
        ],
      },
      {
        title: "Evaluación de seguridad",
        fields: [
          [
            "Clasificación",
            labels[v.event_classification || ""] || v.event_classification,
          ],
          [
            "Persona afectada o en riesgo",
            labels[v.affected_person || ""] || v.affected_person,
          ],
          ["Resultado para el paciente", r.patient_outcome],
          ["Resultado para el operador", r.operator_outcome || "No aplica"],
          ["Daño potencial moderado o grave", r.potential_harm ? "Sí" : "No"],
          ["Daño ocurrido o consecuencias potenciales", v.impact_description],
          ["Medidas de seguridad y acciones preventivas", v.safety_actions],
        ],
      },
      {
        title: "Seguimiento de Tecnovigilancia",
        fields: [
          ["Tipo de falla / incidente", v.failure_type],
          ["Riesgo para meta interna", labels[v.internal_risk]],
          ["Fecha de confirmación", date(v.confirmed_on)],
          ["Supuesto de notificación", labels[v.regulatory_case]],
          ["Fecha meta interna", v.internal_due_on],
          ["Fecha límite normativa registrada", v.regulatory_due_on],
          ["Folio del acta interna", v.legal_record_reference],
          ["Acta completada el", v.legal_record_completed_on],
          ["Referencia / acuse de notificación", v.notification_reference],
          ["Notificado el", v.notified_on],
          ["Notas y justificación", v.notes],
        ],
      },
      {
        title: "Responsable del registro",
        fields: [
          ["Nombre", a.full_name],
          ["ID institucional", a.institutional_id],
          ["Departamento", a.department],
          ["Última actualización", date(v.updated_at)],
        ],
      },
    ],
    {
      title: "REPORTE INTERNO DE TECNOVIGILANCIA",
      subtitle: "Caso especial derivado del reporte de falla",
      issuedAt: data.generated_at,
      compact:true,
      footerNote:
        "Documento interno. Guardar o generar este PDF no envía una notificación a COFEPRIS.",
    },
  )
}
