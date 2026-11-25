import {cleanup,render,screen,waitFor} from "@testing-library/react"
import {afterEach,expect,it,vi} from "vitest"
vi.mock("../lib/profilePhotos",()=>({profilePhotoUrl:vi.fn().mockResolvedValue("https://example.invalid/private-photo.webp")}))
import {ProfileAvatar} from "./ProfileAvatar"
afterEach(cleanup)
it("replaces initials with the signed private profile photo and restores them when removed",async()=>{
 const view=render(<ProfileAvatar profile={{full_name:"Cuenta Prueba",avatar_path:"profiles/user/photo.webp"}}/>)
 expect((await screen.findByAltText("Foto de perfil")).getAttribute("src")).toBe("https://example.invalid/private-photo.webp")
 view.rerender(<ProfileAvatar profile={{full_name:"Cuenta Prueba",avatar_path:null}}/>)
 await waitFor(()=>expect(screen.queryByRole("img")).toBeNull())
 expect(screen.getByText("CP")).toBeTruthy()
})
