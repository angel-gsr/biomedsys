import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react"
import {afterEach,expect,it,vi} from "vitest"
const services=vi.hoisted(()=>({save:vi.fn().mockResolvedValue("mantenimiento:12")}))
vi.mock("../lib/generalCalendar",()=>({generalCalendarOptions:vi.fn().mockResolvedValue({locations:[],equipment:[],programs:[{id:4,equipment_id:"asset",name:"Inspección"}],technicians:[{id:"tech",name:"Ingeniero"}]}),saveGeneralCalendarEvent:services.save}))
vi.mock("./EquipmentReportSelector",()=>({EquipmentReportSelector:()=>null}))
vi.mock("./EquipmentQrScanner",()=>({EquipmentQrScanner:({onSelect}:{onSelect:(item:unknown)=>void})=><button onClick={()=>onSelect({id:"asset",inventory_code:"EQ-1",equipment_type:"Monitor",model:"M1"})}>Escanear QR simulado</button>}))
import {MaintenancePlanner} from "./MaintenancePlanner"
afterEach(()=>{cleanup();vi.clearAllMocks()})
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
