import {expect,it} from "vitest"
import {equipmentLoanPdf,loanFolio,type EquipmentLoan} from "./equipmentLoanPdf"
const loan:EquipmentLoan={id:42,created_at:"2026-11-25T12:00:00Z",starts_at:"2026-11-26T15:00:00Z",ends_at:"2026-11-26T17:00:00Z",destination:"Quirófano 2",status:"programado",legacy:false,snapshot:{institution:"Hospital de prueba",timezone:"America/Mexico_City",equipment:{inventory_code:"EQ-000014",equipment_type:"Monitor multiparámetro",manufacturer:"Fabricante",model:"M1",serial_number:null,hospital_area:"Urgencias",location:"Sala 1"},requester:{full_name:"María García López",institutional_id:"02181001",department:"Enfermería"}}}
it("creates an actual printable PDF with the server folio, missing data and blank signature spaces",async()=>{
 expect(loanFolio(loan)).toBe("VP-2026-000042")
 const blob=await equipmentLoanPdf(loan)
 expect(blob.type).toBe("application/pdf")
 const text=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(blob)})
 for(const value of ["%PDF-","VP-2026-000042","EQ-000014","02181001","No registrado","ENTREGA EL EQUIPO","RECIBE / SOLICITA"])expect(text).toContain(value)
 expect(text).not.toContain("IMSS")
})
it("marks cancelled vouchers and still paginates unusually long recorded fields",async()=>{
 const long={...loan,status:"cancelado",snapshot:{...loan.snapshot,equipment:{...loan.snapshot.equipment,hospital_area:"Área extensa ".repeat(60)},requester:{...loan.snapshot.requester,full_name:"Nombre extenso ".repeat(20)}}}
 const blob=await equipmentLoanPdf(long)
 const text=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.readAsText(blob)})
 expect(text).toContain("RESERVA CANCELADA")
 expect(text).toContain("/Count 2")
})
