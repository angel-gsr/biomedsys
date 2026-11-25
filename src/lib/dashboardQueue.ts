import type {DashboardData} from "./supabase"
export type DashboardQueueItem={key:string;orderId?:number;reportId?:number;folio:string;equipment:string;kind:string;priority:string|null;status:string;date:string}
export function dashboardQueue(data:DashboardData){
 const rank=(priority:string|null)=>priority?.toLowerCase().startsWith("cr")?0:priority?.toLowerCase()==="alta"?1:2
 const pending:DashboardQueueItem[]=data.maintenances.filter(order=>["programado","en_proceso"].includes(order.status)).map(order=>({key:`order-${order.id}`,orderId:order.id,reportId:order.source_report_id||undefined,folio:order.maintenance_number,equipment:order.equipment_identifier||"Equipo vinculado",kind:order.maintenance_code,priority:order.priority,status:order.status,date:order.scheduled_at}))
 for(const report of data.reports.filter(report=>!report.maintenance_id&&!["Resuelto","Cerrado"].includes(report.status)))pending.push({key:`report-${report.id}`,reportId:report.id,folio:report.report_number,equipment:report.equipment_identifier,kind:"Incidente sin asignar",priority:report.priority,status:report.status,date:report.created_at})
 pending.sort((a,b)=>rank(a.priority)-rank(b.priority)||Date.parse(a.date)-Date.parse(b.date)||a.key.localeCompare(b.key))
 const recent=data.maintenances.filter(order=>order.status==="completado").sort((a,b)=>Date.parse(b.completed_at||b.scheduled_at)-Date.parse(a.completed_at||a.scheduled_at)).slice(0,3)
 return {pending:pending.slice(0,6),pendingTotal:pending.length,recent}
}
