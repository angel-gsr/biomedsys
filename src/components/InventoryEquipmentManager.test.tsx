import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const services=vi.hoisted(() => ({ equipmentAdminContext:vi.fn(),saveEquipmentAsset:vi.fn(),archiveEquipmentAsset:vi.fn(),listArchivedEquipment:vi.fn(),restoreEquipmentAsset:vi.fn() }))
vi.mock("../lib/equipmentControl",() => services)
import { InventoryEquipmentManager } from "./InventoryEquipmentManager"
const asset={id:"asset",inventory_code:"EQ-000001",equipment_type:"Monitor",manufacturer:"Marca",model:"Modelo",serial_number:"SER",manufacture_year:2020,acquisition_year:2021,hospital_area_id:1,location_id:null,custodian_location_text:null,status:"operativo"}
beforeEach(() => { vi.clearAllMocks();services.equipmentAdminContext.mockResolvedValue({asset:null,areas:[{id:1,name:"CEYE"}],locations:[]});services.saveEquipmentAsset.mockResolvedValue("new-asset") })
afterEach(() => {cleanup();vi.unstubAllGlobals()})
it("creates equipment with mandatory identity and reason",async() => {
 const changed=vi.fn();render(<InventoryEquipmentManager onChanged={changed} />)
 fireEvent.click(screen.getByRole("button",{name:"Agregar equipo"}))
 await screen.findByLabelText("Nombre / tipo de equipo")
 for(const [name,value] of [["Nombre / tipo de equipo","Monitor"],["Fabricante / marca","Marca"],["Modelo","Modelo"],["Motivo del alta, edición o retiro","Alta aprobada"]])fireEvent.change(screen.getByLabelText(name),{target:{value}})
 fireEvent.click(screen.getByRole("button",{name:"Guardar equipo"}))
 await waitFor(() => expect(services.saveEquipmentAsset).toHaveBeenCalledWith(null,expect.objectContaining({equipment_type:"Monitor",hospital_area_id:1}),"Alta aprobada"))
 expect(changed).toHaveBeenCalledWith("new-asset")
})
it("keeps the editor open when pending work prevents retirement",async() => {
 services.equipmentAdminContext.mockResolvedValue({asset,areas:[{id:1,name:"CEYE"}],locations:[]});services.archiveEquipmentAsset.mockRejectedValue(new Error("El equipo tiene mantenimientos pendientes"));vi.stubGlobal("confirm",vi.fn(() => true))
 const changed=vi.fn();render(<InventoryEquipmentManager equipmentId="asset" onChanged={changed} />)
 fireEvent.click(screen.getByRole("button",{name:"Editar / retirar"}));await screen.findByLabelText("Nombre / tipo de equipo")
 fireEvent.change(screen.getByLabelText("Motivo del alta, edición o retiro"),{target:{value:"Sustitución aprobada"}})
 fireEvent.click(screen.getByRole("button",{name:"Retirar del inventario"}))
 expect(await screen.findByRole("alert")).toHaveProperty("textContent","El equipo tiene mantenimientos pendientes")
 expect(changed).not.toHaveBeenCalled()
})
it("restores a retired equipment after recording the reason",async() => {
 services.listArchivedEquipment.mockResolvedValue([{id:"asset",inventory_code:"EQ-000001",equipment_type:"Monitor",archive_reason:"Sustitución"}]);services.restoreEquipmentAsset.mockResolvedValue(undefined)
 const changed=vi.fn();render(<InventoryEquipmentManager onChanged={changed} />)
 fireEvent.click(screen.getByRole("button",{name:"Equipos retirados"}));await screen.findByLabelText("Motivo de restauración")
 fireEvent.change(screen.getByLabelText("Motivo de restauración"),{target:{value:"Reingreso autorizado"}})
 fireEvent.click(screen.getByRole("button",{name:"Restaurar equipo"}))
 await waitFor(() => expect(services.restoreEquipmentAsset).toHaveBeenCalledWith("asset","Reingreso autorizado"))
})
