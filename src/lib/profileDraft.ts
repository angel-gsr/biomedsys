import type {Profile} from "./supabase"
export function profileEditDraft(profile:Profile):Profile {
 if(profile.first_name && profile.last_name)return {...profile}
 const words=profile.full_name.trim().split(/\s+/).filter(Boolean)
 // Suggest a split only in the editable draft; never overwrite stored names automatically.
 const lastCount=words.length>=4?2:words.length>=2?1:0
 return {...profile,first_name:profile.first_name||words.slice(0,words.length-lastCount).join(" "),last_name:profile.last_name||(lastCount?words.slice(-lastCount).join(" "):"")}
}
