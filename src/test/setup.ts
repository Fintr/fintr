import "@testing-library/jest-dom"
import { vi } from "vitest"

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock CSS environment variables for safe area tests
const mockCSSStyleDeclaration = {
  getPropertyValue: vi.fn((property: string) => {
    const safeAreaVars: Record<string, string> = {
      "--safe-area-inset-bottom": "0px",
      "--safe-area-inset-top": "0px",
      "--safe-area-inset-left": "0px",
      "--safe-area-inset-right": "0px",
    }
    return safeAreaVars[property] || ""
  }),
}

Object.defineProperty(window, "getComputedStyle", {
  writable: true,
  value: vi.fn(() => mockCSSStyleDeclaration),
})

// Mock document.documentElement for classList tests
Object.defineProperty(document, "documentElement", {
  writable: true,
  value: {
    classList: {
      contains: vi.fn(() => false),
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
    },
    style: {},
  },
})

// Mock navigator.userAgent for platform detection tests
Object.defineProperty(navigator, "userAgent", {
  writable: true,
  value: "",
  configurable: true,
})

// Suppress console errors during tests
const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === "string" &&
    (args[0].includes("ReactDOMTestUtils.act") ||
      args[0].includes("Warning: ReactDOM.render"))
  ) {
    return
  }
  originalConsoleError.apply(console, args)
}
