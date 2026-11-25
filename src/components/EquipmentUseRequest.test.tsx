import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react"
import {afterEach,expect,it,vi} from "vitest"
const service=vi.hoisted(()=>({request:vi.fn().mockResolvedValue(99)}))
vi.mock("./LoanVoucher",()=>({LoanVoucher:({bookingId}:{bookingId:number})=><p>Vale automático {bookingId}</p>}))
vi.mock("../lib/generalCalendar",()=>({requestEquipmentUse:service.request}))
vi.mock("./EquipmentReportSelector",()=>({EquipmentReportSelector:()=>null}))
vi.mock("./EquipmentQrScanner",()=>({EquipmentQrScanner:({onSelect}:{onSelect:(item:unknown)=>void})=><button type="button" onClick={()=>onSelect({id:"asset",inventory_code:"EQ-1",status:"operativo"})}>QR de prueba</button>}))
import {EquipmentUseRequest} from "./EquipmentUseRequest"
afterEach(()=>{cleanup();vi.clearAllMocks()})
function fill(){fireEvent.click(screen.getByRole("button",{name:"Solicitar equipo"}));fireEvent.click(screen.getByText("QR de prueba"));fireEvent.change(screen.getByLabelText("Inicio"),{target:{value:"2030-01-01T10:00"}});fireEvent.change(screen.getByLabelText("Fin"),{target:{value:"2030-01-01T11:00"}});fireEvent.change(screen.getByLabelText("Ubicación de uso"),{target:{value:"Quirófano 1"}})}
it("reserves the selected equipment without accepting a requester supplied by the browser",async()=>{
 render(<EquipmentUseRequest/>);fill();fireEvent.click(screen.getByRole("button",{name:"Registrar solicitud"}))
 await screen.findByRole("status")
 expect(service.request).toHaveBeenCalledWith({equipmentId:"asset",start:new Date("2030-01-01T10:00").toISOString(),end:new Date("2030-01-01T11:00").toISOString(),location:"Quirófano 1"})
 expect(screen.getByRole("dialog",{name:"Vale de préstamo"})).toBeTruthy()
 expect(screen.getByText("Vale automático 99")).toBeTruthy()
 expect(screen.getByRole("status").textContent).toContain("Calendario → Uso de equipo")
})
it("keeps the request open and displays the server conflict when the slot is occupied",async()=>{
 service.request.mockRejectedValueOnce({message:"Conflicto de horario con MT-2026-MC-0007"})
 render(<EquipmentUseRequest/>);fill();fireEvent.click(screen.getByRole("button",{name:"Registrar solicitud"}))
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("MT-2026-MC-0007"))
 expect(screen.getByRole("dialog")).toBeTruthy()
 expect((screen.getByLabelText("Ubicación de uso") as HTMLInputElement).value).toBe("Quirófano 1")
})
