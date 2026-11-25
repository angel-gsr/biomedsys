import { readFileSync } from "node:fs"
import ts from "typescript"
import { expect, it, vi } from "vitest"

// Execute the actual Edge handler with isolated Auth/DB adapters; never contacts Supabase.
function backend(role = "jefe") {
  const profileInsert = vi.fn().mockResolvedValue({ error: null })
  const createUser = vi.fn().mockResolvedValue({ data: { user: { id: "new-user" } }, error: null })
  const updateUser = vi.fn().mockResolvedValue({ error: null })
  const caller = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "caller" } }, error: null }), updateUser },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role, active: true } }) }) }) }),
    rpc: vi.fn().mockResolvedValue({ data: { must_change_password: false }, error: null }),
  }
  const registration = { institutional_id: "02181000", full_name: "Ángel García", first_name: "Ángel", last_name: "García", age: 28, phone: null, department: "Urgencias", role: "usuario", status: "pendiente" }
  const service = {
    auth: { admin: { createUser, deleteUser: vi.fn() } },
    from: (table: string) => table === "profiles" ? { insert: profileInsert } : {
      select: () => ({ eq: () => ({ single: async () => ({ data: registration, error: null }) }) }),
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    },
  }
  let handler!: (request: Request) => Promise<Response>
  const source = readFileSync("supabase/functions/admin-users/index.ts", "utf8").replace(/^import .*$/gm, "")
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  new Function("Deno", "createClient", "corsHeaders", "json", "requiredEnvironment", compiled)(
    { serve: (fn: typeof handler) => { handler = fn } },
    (_url: string, key: string) => key === "service" ? service : caller,
    () => ({}), (_request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
    () => ({ url: "https://example.invalid", anon: "anon", service: "service" }),
  )
  return { createUser, profileInsert, updateUser, invoke: (body: unknown) => handler(new Request("https://example.invalid", { method: "POST", headers: { authorization: "Bearer mock" }, body: JSON.stringify(body) })) }
}

it("ignores tampered identity/role and provisions only validated registration data", async () => {
  const api = backend()
  const response = await api.invoke({ action: "provision", accessRequestId: 1, institutionalId: "00999999", fullName: "Injected", role: "jefe", temporaryPassword: "Aa1234" })
  expect(response.status).toBe(201)
  expect(api.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: "02181000@biomedgest.local", password: "Aa1234" }))
  expect(api.profileInsert).toHaveBeenCalledWith(expect.objectContaining({ institutional_id: "02181000", first_name: "Ángel", last_name: "García", age: 28, role: "usuario", department: "Urgencias", must_change_password: true }))
})
it.each(["usuario", "tecnico"])("prevents %s from creating users", async role => {
  const api = backend(role)
  expect((await api.invoke({ action: "provision", accessRequestId: 1, temporaryPassword: "Aa1234" })).status).toBe(403)
  expect(api.createUser).not.toHaveBeenCalled()
})
it.each(["Aa123", "Aa12345678901X", "123456"])("rejects invalid temporary password %s on the server", async temporaryPassword => {
  const api = backend()
  expect((await api.invoke({ action: "provision", accessRequestId: 1, temporaryPassword })).status).toBe(400)
  expect(api.createUser).not.toHaveBeenCalled()
})
it.each(["jefe", "tecnico", "usuario"])("allows own password change for %s", async role => {
  const api = backend(role)
  expect((await api.invoke({ action: "change-password", password: "Aa1234" })).status).toBe(200)
  expect(api.updateUser).toHaveBeenCalledWith({ password: "Aa1234" })
})
it("rejects normal passwords over the maximum before changing Auth", async () => {
  const api = backend("usuario")
  expect((await api.invoke({ action: "change-password", password: "Aa12345678901X" })).status).toBe(400)
  expect(api.updateUser).not.toHaveBeenCalled()
})
