import { expect,it,vi } from "vitest"
import type { MaintenanceSummary, ReportSummary } from "./supabase"
const pdf=vi.hoisted(()=>({setFontSize:vi.fn(),setFont:vi.fn(),text:vi.fn(),addPage:vi.fn(),splitTextToSize:(text:string)=>text.match(/.{1,70}/g)||[],output:vi.fn(()=>new Blob(["%PDF-demo"],{type:"application/pdf"}))}))
vi.mock("jspdf",()=>({jsPDF:class {constructor(){return pdf}}}))
import { serviceOrderPdf } from "../components/ServiceOrderDocument"
it("includes the linked incident, assignment and technical record in a paginated PDF",async()=>{
 const item={maintenance_number:"MC-77",status:"programado",priority:"alta",scheduled_at:"2026-11-25T12:00:00Z",assigned_to_name:"Ingeniero Demo",equipment_identifier:"EQ-1",record:{diagnosis:"Diagnóstico registrado"}} as MaintenanceSummary
 const report={report_number:"REP-10",description:"Incidente detallado ".repeat(250),location:"Quirófano 1"} as ReportSummary
 const blob=await serviceOrderPdf(item,report)
 expect(blob.type).toBe("application/pdf")
 const text=pdf.text.mock.calls.map(call=>call[0]).join(" ")
 for(const expected of ["MC-77","REP-10","Ingeniero Demo","Quirófano 1","Diagnóstico registrado"])expect(text).toContain(expected)
 expect(pdf.addPage).toHaveBeenCalled()
})
