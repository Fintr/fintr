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
// Use a real DOMTokenList-like object that can be manipulated in tests
const createMockClassList = () => {
  const classes = new Set<string>()
  return {
    contains: (className: string) => classes.has(className),
    add: (className: string) => classes.add(className),
    remove: (className: string) => classes.delete(className),
    toggle: (className: string) => {
      if (classes.has(className)) {
        classes.delete(className)
        return false
      }
      classes.add(className)
      return true
    },
    _reset: () => classes.clear(),
    _getClasses: () => Array.from(classes),
  }
}

const mockClassList = createMockClassList()

Object.defineProperty(document, "documentElement", {
  writable: true,
  value: {
    classList: mockClassList,
    style: {
      getPropertyValue: vi.fn(() => ""),
      setProperty: vi.fn(),
    },
  },
})

// Export for test access
;(global as any).resetDocumentClassList = mockClassList._reset
;(global as any).getDocumentClasses = mockClassList._getClasses

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
