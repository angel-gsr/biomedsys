import {afterEach,expect,it,vi} from "vitest"
vi.mock("./supabase",()=>({supabase:null}))
import {resizeProfilePhoto,avatarLimit} from "./profilePhotos"
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()})
it("crops and resizes photos to 192px, strips original bytes and produces a small WebP",async()=>{
 const bitmap={width:800,height:400,close:vi.fn()},drawImage=vi.fn()
 vi.stubGlobal("createImageBitmap",vi.fn().mockResolvedValue(bitmap))
 vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({drawImage} as unknown as CanvasRenderingContext2D)
 vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation(callback=>callback(new Blob([new Uint8Array(4000)],{type:"image/webp"})))
 const image=await resizeProfilePhoto(new File([new Uint8Array(900000)],"large.png",{type:"image/png"}))
 expect(drawImage).toHaveBeenCalledWith(bitmap,200,0,400,400,0,0,192,192)
 expect(image.type).toBe("image/webp");expect(image.size).toBeLessThanOrEqual(avatarLimit);expect(bitmap.close).toHaveBeenCalledOnce()
})
it("rejects active image formats and oversized originals before decoding",async()=>{
 const decode=vi.fn();vi.stubGlobal("createImageBitmap",decode)
 await expect(resizeProfilePhoto(new File(["<svg/>"],"active.svg",{type:"image/svg+xml"}))).rejects.toThrow("JPG, PNG o WebP")
 await expect(resizeProfilePhoto(new File([new Uint8Array(10*1024*1024+1)],"big.jpg",{type:"image/jpeg"}))).rejects.toThrow("10 MB")
 expect(decode).not.toHaveBeenCalled()
})
