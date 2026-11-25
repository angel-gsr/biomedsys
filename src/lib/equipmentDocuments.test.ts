import { expect, it } from "vitest"
import { validDocumentUrl } from "./equipmentDocuments"
it("accepts document links without allowing executable URLs or credentials", () => {
  expect(validDocumentUrl("https://example.com/manual.pdf")).toBe(
    "https://example.com/manual.pdf",
  )
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,x",
    "https://user:pass@example.com/file",
    "no-url",
  ])
    expect(validDocumentUrl(value)).toBeNull()
})
