import { createClient } from "npm:@supabase/supabase-js@2"
import { corsHeaders, json, requiredEnvironment } from "../_shared/http.ts"

type ProvisionBody = {
  action: "provision"
  institutionalId: string
  fullName: string
  role: "usuario" | "tecnico" | "jefe"
  department?: string
  temporaryPassword: string
  accessRequestId?: number
}
type AuthStatusBody = { action: "set-auth-status"; profileId: string; active: boolean }
type DeleteBody = { action: "delete-user"; profileId: string }
type PasswordBody = { action: "change-password"; password: string }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== "POST") return json(request, { error: "Método no permitido" }, 405)
  try {
    const { url, anon, service } = requiredEnvironment()
    const authorization = request.headers.get("authorization") || ""
    if (!authorization.startsWith("Bearer ")) return json(request, { error: "Sesión requerida" }, 401)
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
    const serviceClient = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: userResult, error: userError } = await caller.auth.getUser()
    if (userError || !userResult.user) return json(request, { error: "Sesión inválida" }, 401)
    const { data: profile } = await caller.from("profiles").select("role, active").eq("id", userResult.user.id).single()
    if (!profile?.active) return json(request, { error: "Perfil activo requerido" }, 403)
    const body = await request.json() as ProvisionBody | AuthStatusBody | PasswordBody | DeleteBody
    if (body.action === "change-password") {
      if (typeof body.password !== "string" || body.password.length < 6 || body.password.length > 12 || !/[A-Z]/.test(body.password) || !/[a-z]/.test(body.password) || !/\d/.test(body.password))
        return json(request, { error: "La contraseña debe tener entre 6 y 12 caracteres, con mayúscula, minúscula y número" }, 400)
      // getUser above verifies the JWT; never accept the target user from the body.
      const { error: passwordError } = await serviceClient.auth.admin.updateUserById(userResult.user.id, { password: body.password })
      if (passwordError) return json(request, { error: passwordError.message }, 400)
      const { data: updated, error: completionError } = await caller.rpc("complete_password_change")
      if (completionError) return json(request, { error: completionError.message }, 400)
      return json(request, updated)
    }
    if (profile.role !== "jefe") return json(request, { error: "Operación reservada para el rol jefe" }, 403)
    if (body.action === "delete-user") {
      if (!/^[0-9a-f-]{36}$/i.test(body.profileId) || body.profileId === userResult.user.id) return json(request, { error: "No puedes eliminar esta cuenta" }, 400)
      const { data: target } = await serviceClient.from("profiles").select("id,active").eq("id", body.profileId).single()
      if (!target || target.active) return json(request, { error: "Desactiva primero la cuenta" }, 409)
      const { error: banError } = await serviceClient.auth.admin.updateUserById(body.profileId, { ban_duration: "876000h" })
      if (banError) return json(request, { error: banError.message }, 400)
      const { error: deletionError } = await caller.rpc("delete_inactive_user", { target_profile_id: body.profileId })
      if (deletionError) return json(request, { error: deletionError.message }, 400)
      return json(request, { deleted: true })
    }
    if (body.action === "set-auth-status") {
      if (!/^[0-9a-f-]{36}$/i.test(body.profileId)) return json(request, { error: "Perfil inválido" }, 400)
      if (body.profileId === userResult.user.id && !body.active) return json(request, { error: "No puedes bloquear tu propia cuenta" }, 400)
      const { data: target } = await serviceClient.from("profiles").select("id, active").eq("id", body.profileId).single()
      if (!target || target.active !== body.active) return json(request, { error: "El estado del perfil debe actualizarse primero mediante la RPC auditada" }, 409)
      const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(body.profileId, { ban_duration: body.active ? "none" : "876000h" })
      if (authUpdateError) return json(request, { error: authUpdateError.message }, 400)
      return json(request, { id: body.profileId, active: body.active })
    }
    if (body.action !== "provision") return json(request, { error: "Acción no soportada" }, 400)
    if (!Number.isSafeInteger(body.accessRequestId)) return json(request, { error: "Selecciona una solicitud registrada" }, 400)
    const { data: registration, error: registrationError } = await serviceClient.from("user_access_requests").select("*").eq("id", body.accessRequestId).single()
    if (registrationError || !registration || registration.status !== "pendiente") return json(request, { error: "Solicitud no disponible" }, 409)
    if (!registration.first_name || !registration.last_name || !registration.age) return json(request, { error: "Registra una nueva solicitud con los datos personales completos" }, 400)
    if (typeof body.temporaryPassword !== "string" || body.temporaryPassword.length < 6 || body.temporaryPassword.length > 12 || !/[A-Z]/.test(body.temporaryPassword) || !/[a-z]/.test(body.temporaryPassword) || !/\d/.test(body.temporaryPassword))
      return json(request, { error: "La contraseña temporal debe tener entre 6 y 12 caracteres, con mayúscula, minúscula y número" }, 400)
    // Identity, role and department come exclusively from the validated database record.
    body.institutionalId = registration.institutional_id
    body.fullName = registration.full_name
    body.role = registration.role
    body.department = registration.department
    const email = `${body.institutionalId}@biomedgest.local`
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email, password: body.temporaryPassword, email_confirm: true,
      user_metadata: { institutional_id: body.institutionalId },
    })
    if (createError || !created.user) return json(request, { error: createError?.message || "No fue posible crear Auth" }, 400)
    const { error: profileError } = await serviceClient.from("profiles").insert({
      id: created.user.id, institutional_id: body.institutionalId, full_name: body.fullName.trim(),
      avatar_path: registration.avatar_path || null, first_name: registration.first_name, last_name: registration.last_name, age: registration.age, phone: registration.phone,
      role: body.role, department: body.department?.trim() || null, active: true, must_change_password: true,
    })
    if (profileError) {
      await serviceClient.auth.admin.deleteUser(created.user.id)
      return json(request, { error: "No fue posible asociar el perfil; la cuenta Auth fue revertida" }, 409)
    }
    if (body.accessRequestId) await serviceClient.from("user_access_requests").update({ status: "creado" }).eq("id", body.accessRequestId).eq("status", "pendiente")
    return json(request, { id: created.user.id, institutionalId: body.institutionalId, mustChangePassword: true }, 201)
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : "Error no identificado" }, 500)
  }
})
