import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react"
import {afterEach,expect,it,vi} from "vitest"
const services=vi.hoisted(()=>({save:vi.fn().mockResolvedValue("mantenimiento:12")}))
vi.mock("../lib/generalCalendar",()=>({generalCalendarOptions:vi.fn().mockResolvedValue({locations:[],equipment:[],programs:[{id:4,equipment_id:"asset",name:"Inspección"}],technicians:[{id:"tech",name:"Ingeniero"}]}),saveGeneralCalendarEvent:services.save}))
vi.mock("./EquipmentReportSelector",()=>({EquipmentReportSelector:()=>null}))
vi.mock("./EquipmentQrScanner",()=>({EquipmentQrScanner:({onSelect}:{onSelect:(item:unknown)=>void})=><button onClick={()=>onSelect({id:"asset",inventory_code:"EQ-1",equipment_type:"Monitor",model:"M1"})}>Escanear QR simulado</button>}))
import {MaintenancePlanner} from "./MaintenancePlanner"
afterEach(()=>{cleanup();vi.clearAllMocks()})
async function fillSchedule(){
 fireEvent.click(screen.getByText("Escanear QR simulado"))
 await screen.findByRole("option",{name:"Inspección"})
 fireEvent.change(screen.getByLabelText("Rutina preventiva"),{target:{value:"4"}})
 fireEvent.change(screen.getByLabelText("Técnico asignado"),{target:{value:"tech"}})
 fireEvent.change(screen.getByLabelText("Inicio"),{target:{value:"2030-01-01T10:00"}})
 fireEvent.change(screen.getByLabelText("Fin"),{target:{value:"2030-01-01T11:00"}})
}
it("shows a plain PostgREST conflict with its folio and opens the exact blocking order",async()=>{
 const message="Conflicto de horario con MT-2026-MC-0007 · EQ-000001 (mantenimiento:7). Selecciona otra fecha, sala o equipo. Si falta una hora de fin, complétala primero."
 services.save.mockRejectedValueOnce({code:"P0001",message})
 const open=vi.fn(),saved=vi.fn();render(<MaintenancePlanner onClose={vi.fn()} onSaved={saved} onOpenOrder={open}/>)
 await fillSchedule();fireEvent.click(screen.getByRole("button",{name:"Programar mantenimiento"}))
 const alert=(await screen.findByRole("alert")).textContent
 expect(alert).toContain("MT-2026-MC-0007 · EQ-000001")
 expect(alert).toContain("Si falta una hora de fin, complétala primero.")
 expect(alert).not.toContain("mantenimiento:7")
 expect(saved).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole("button",{name:"Ver orden que bloquea el horario"}))
 expect(open).toHaveBeenCalledWith(7)
 // A successful retry clears the previous failure and does not bypass the server.
 fireEvent.click(screen.getByRole("button",{name:"Programar mantenimiento"}))
 await waitFor(()=>expect(saved).toHaveBeenCalledOnce())
 expect(services.save).toHaveBeenCalledTimes(2)
 expect(screen.queryByRole("alert")).toBeNull()
})
it("preserves other server validation messages without offering an unrelated order",async()=>{
 services.save.mockRejectedValueOnce({code:"P0001",message:"Programa un horario futuro"})
 render(<MaintenancePlanner onClose={vi.fn()} onSaved={vi.fn()} onOpenOrder={vi.fn()}/>)
 await fillSchedule();fireEvent.click(screen.getByRole("button",{name:"Programar mantenimiento"}))
 expect((await screen.findByRole("alert")).textContent).toContain("Programa un horario futuro")
 expect(screen.queryByRole("button",{name:"Ver orden que bloquea el horario"})).toBeNull()
})
it("creates a real preventive order for the scanned equipment with an assigned engineer and interval",async()=>{
 const saved=vi.fn();render(<MaintenancePlanner onClose={vi.fn()} onSaved={saved}/>)
 fireEvent.click(screen.getByText("Escanear QR simulado"))
 await screen.findByRole("option",{name:"Inspección"})
 fireEvent.change(screen.getByLabelText("Rutina preventiva"),{target:{value:"4"}})
 fireEvent.change(screen.getByLabelText("Técnico asignado"),{target:{value:"tech"}})
 fireEvent.change(screen.getByLabelText("Inicio"),{target:{value:"2030-01-01T10:00"}})
 fireEvent.change(screen.getByLabelText("Fin"),{target:{value:"2030-01-01T11:00"}})
 fireEvent.click(screen.getByRole("button",{name:"Programar mantenimiento"}))
 await waitFor(()=>expect(services.save).toHaveBeenCalledWith(expect.objectContaining({kind:"mantenimiento",key:null,equipmentIds:["asset"],programId:4,assigneeId:"tech"})))
 expect(saved).toHaveBeenCalledOnce()
})
