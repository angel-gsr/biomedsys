import { supabase } from "./supabase"
export const avatarLimit = 64 * 1024
export async function resizeProfilePhoto(file: File): Promise<File> {
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Selecciona una imagen JPG, PNG o WebP.")
 if(file.size>10*1024*1024)throw new Error("La imagen original no debe superar 10 MB.")
 const bitmap=await createImageBitmap(file)
 try {
  if(bitmap.width*bitmap.height>40000000)throw new Error("La imagen tiene demasiada resolución.")
  const canvas=document.createElement("canvas");canvas.width=192;canvas.height=192
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("No fue posible procesar la imagen.")
  const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,192,192)
  for(const format of ["image/webp","image/jpeg"]) {
   for(const quality of [.75,.55,.35]) {
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,format,quality))
    if(blob && blob.size<=avatarLimit && blob.type===format)return new File([blob],format==="image/webp"?"perfil.webp":"perfil.jpg",{type:blob.type})
   }
  }
  throw new Error("No fue posible reducir la imagen a 64 KB.")
 }finally{bitmap.close()}
}
export async function uploadProfilePhoto(file: File, profileId?: string) {
 if(!supabase)throw new Error("Supabase no está configurado.")
 if(file.size>avatarLimit || !["image/webp","image/jpeg"].includes(file.type))throw new Error("La foto debe procesarse antes de cargarla.")
 const {data}=await supabase.auth.getUser();if(!data.user)throw new Error("Sesión requerida")
 const path=`${profileId?`profiles/${profileId}`:`registrations/${data.user.id}`}/${crypto.randomUUID()}.${file.type==="image/webp"?"webp":"jpg"}`
 const {error}=await supabase.storage.from("profile-avatars").upload(path,file,{contentType:file.type,upsert:false})
 if(error)throw error
 return path
}
export async function removeProfilePhoto(path: string) {if(supabase)await supabase.storage.from("profile-avatars").remove([path])}
const signed=new Map<string,{url:string;until:number}>()
export async function profilePhotoUrl(path: string) {
 const cached=signed.get(path);if(cached && cached.until>Date.now())return cached.url
 if(!supabase)return null
 const {data,error}=await supabase.storage.from("profile-avatars").createSignedUrl(path,600)
 if(error)throw error
 signed.set(path,{url:data.signedUrl,until:Date.now()+480000});return data.signedUrl
}
