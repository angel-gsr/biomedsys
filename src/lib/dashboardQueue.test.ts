import{expect,it}from"vitest"
import{dashboardQueue}from"./dashboardQueue"
import type{DashboardData,MaintenanceSummary,ReportSummary}from"./supabase"
const order=(id:number,priority:string,status="programado",date="2026-11-25T10:00:00Z")=>({id,maintenance_number:`MC-${id}`,priority,status,scheduled_at:date,equipment_identifier:`EQ-${id}`,maintenance_code:"MC",completed_at:status==="completado"?date:null})as MaintenanceSummary
it("prioritizes urgent work and unassigned incidents without duplicating linked reports",()=>{
 const data={equipment:[],maintenances:[order(1,"ordinaria"),order(2,"alta"),order(3,"critica"),order(4,"alta","cancelado"),order(5,"alta","completado")],reports:[{id:6,report_number:"REP-6",priority:"Crítica",status:"Recibido",created_at:"2026-11-24T10:00:00Z",equipment_identifier:"EQ-6"},{id:7,priority:"Crítica",status:"Asignado",maintenance_id:3}]}as unknown as DashboardData
 const queue=dashboardQueue(data)
 expect(queue.pending.map(item=>item.key)).toEqual(["report-6","order-3","order-2","order-1"])
 expect(queue.recent.map(item=>item.id)).toEqual([5])
})
it("keeps a short overview and sorts recent completed work by completion date",()=>{
 const data={equipment:[],reports:[]as ReportSummary[],maintenances:[...Array.from({length:8},(_,i)=>order(i+1,"alta")),order(20,"alta","completado","2026-11-24T10:00:00Z"),order(21,"alta","completado","2026-11-25T10:00:00Z")]}as DashboardData
 const queue=dashboardQueue(data);expect(queue.pending).toHaveLength(6);expect(queue.pendingTotal).toBe(8);expect(queue.recent.map(item=>item.id)).toEqual([21,20])
})
