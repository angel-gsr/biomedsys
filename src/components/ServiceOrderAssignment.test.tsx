import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const services=vi.hoisted(()=>({create:vi.fn().mockResolvedValue({id:77})}))
vi.mock("../lib/supabase",()=>({
  listReports:vi.fn().mockResolvedValue([{id:10,report_number:"REP-10",priority:"Alta",equipment_identifier:"EQ-1",description:"No enciende",service:"CEYE",location:"Sala 1"}]),
  listActiveTechnicians:vi.fn().mockResolvedValue([{id:"tech",full_name:"Ingeniero Demo"}]),
  createCorrectiveOrderFromReport:services.create,
}))
import { ServiceOrderAssignment } from "./ServiceOrderAssignment"
afterEach(()=>{cleanup();vi.clearAllMocks()})
it("does not create an order when opening or returning from the draft",async()=>{
 const back=vi.fn();render(<ServiceOrderAssignment reportId={10} onBack={back} onConfirmed={vi.fn()} />)
 await screen.findByText("REP-10 · EQ-1")
 expect(services.create).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole("button",{name:"Volver a Mesa de ayuda"}));expect(back).toHaveBeenCalledOnce()
})
it("confirms the assignment once and opens the exact returned order",async()=>{
 const confirmed=vi.fn();render(<ServiceOrderAssignment reportId={10} onBack={vi.fn()} onConfirmed={confirmed} />)
 await screen.findByRole("option",{name:"Ingeniero Demo"})
 expect((screen.getByLabelText("Prioridad *") as HTMLSelectElement).value).toBe("alta")
 fireEvent.change(screen.getByLabelText("Ingeniero biomédico *"),{target:{value:"tech"}})
 fireEvent.change(screen.getByLabelText("Fecha de atención *"),{target:{value:"2026-11-25T10:00"}})
 fireEvent.click(screen.getByRole("button",{name:"Confirmar asignación y crear orden"}))
 await waitFor(()=>expect(confirmed).toHaveBeenCalledWith(77))
 expect(services.create).toHaveBeenCalledWith(10,"tech","alta",expect.any(String))
})
