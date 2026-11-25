import { expect, it } from "vitest"
import { tabAuthOptions } from "./tabSession"
it("stores sessions in tab storage instead of shared local storage", () => {
  sessionStorage.clear(); localStorage.clear()
  tabAuthOptions.storage.setItem("sdk-key", "test-session")
  expect(tabAuthOptions.storage.getItem("sdk-key")).toBe("test-session")
  expect(localStorage.length).toBe(0)
  tabAuthOptions.storage.setItem("sdk-key-user", "user-data")
  expect(tabAuthOptions.storage.getItem("sdk-key")).toBe("test-session")
  tabAuthOptions.storage.removeItem("sdk-key-user")
  expect(tabAuthOptions.storage.getItem("sdk-key")).toBe("test-session")
  tabAuthOptions.storage.removeItem("sdk-key")
  expect(tabAuthOptions.storage.getItem("sdk-key")).toBeNull()
})
