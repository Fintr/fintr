---
name: frontend-tdd
description: Test Driven Development (TDD) for React/Next.js frontend. Guides through writing tests first, then implementing features. Use when adding new features, fixing bugs, refactoring, or when tests are failing. Follows Red-Green-Refactor cycle with specific patterns for mobile/Capacitor apps.
---

# Frontend Test Driven Development (TDD)

Guides through TDD workflow for the Next.js + Capacitor mobile app (`fintr-fe`).

## TDD Cycle: Red → Green → Refactor

1. **Red**: Write a failing test that defines expected behavior
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Optimize code without changing behavior

## When to Use This Skill

- Adding new features or components
- Fixing bugs (write regression test first)
- Refactoring existing code
- Tests are failing and need fixing
- Writing tests for platform-specific behavior (Android/iOS)

## Quick Start: TDD Workflow

### Step 1: Write the Test First (Red)

```typescript
// src/lib/myFeature.test.ts
import { describe, it, expect } from "vitest"
import { myFeature } from "./myFeature"

describe("myFeature", () => {
  it("does what the user expects", () => {
    // Arrange
    const input = { test: "data" }

    // Act
    const result = myFeature(input)

    // Assert - this will fail initially (RED)
    expect(result).toEqual({ expected: "output" })
  })
})
```

Run test to confirm it fails:
```bash
pnpm test src/lib/myFeature.test.ts
# Expected: FAIL - function doesn't exist or returns wrong value
```

### Step 2: Implement Minimal Code (Green)

```typescript
// src/lib/myFeature.ts
export const myFeature = (input: { test: string }) => {
  // Minimal implementation to make test pass
  return { expected: "output" }
}
```

Run test to confirm it passes:
```bash
pnpm test src/lib/myFeature.test.ts
# Expected: PASS
```

### Step 3: Refactor

Improve the code while keeping tests green:
```typescript
// src/lib/myFeature.ts
export const myFeature = (input: { test: string }) => {
  // Better variable names, comments, optimization
  const processed = input.test.toUpperCase()
  return { expected: processed.toLowerCase() }
}
```

Verify tests still pass after refactoring.

## Testing Patterns by Type

### Pattern 1: Pure Functions/Utilities

```typescript
// src/lib/calculatePadding.ts
export const calculatePadding = (
  isAndroid: boolean,
  safeArea: number
): string => {
  if (isAndroid) {
    return `calc(64px + ${Math.max(safeArea, 48)}px)`
  }
  return "80px"
}

// src/lib/calculatePadding.test.ts
describe("calculatePadding", () => {
  it("calculates Android padding with 3-button nav", () => {
    expect(calculatePadding(true, 48)).toBe("calc(64px + 48px)")
  })

  it("calculates Android padding with gesture nav", () => {
    expect(calculatePadding(true, 16)).toBe("calc(64px + 48px)")
  })

  it("returns default for non-Android", () => {
    expect(calculatePadding(false, 0)).toBe("80px")
  })
})
```

### Pattern 2: React Hooks

```typescript
// src/hooks/usePlatformDetection.ts
export const usePlatformDetection = () => {
  const [platform, setPlatform] = useState<Platform>(defaultPlatform)

  useEffect(() => {
    const detect = () => {
      // detection logic
      setPlatform(detected)
    }

    detect()
    window.addEventListener("resize", detect)
    return () => window.removeEventListener("resize", detect)
  }, [])

  return platform
}

// src/hooks/usePlatformDetection.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

describe("usePlatformDetection", () => {
  // CRITICAL: Don't use fake timers with waitFor - causes timeout
  beforeEach(() => {
    vi.useRealTimers()
  })

  it("returns initial SSR-safe values", () => {
    const { result } = renderHook(() => usePlatformDetection())
    expect(result.current.isAndroidNative).toBe(false)
  })

  it("detects Android from user agent", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "...Android...FintrNativeApp",
      configurable: true,
    })

    const { result } = renderHook(() => usePlatformDetection())

    // Use act() instead of waitFor() - avoid fake timers
    await act(async () => {
      window.dispatchEvent(new Event("resize"))
      await Promise.resolve()
    })

    expect(result.current.isAndroidNative).toBe(true)
  })
})
```

### Pattern 3: Components (User Perspective)

```tsx
// Component test - test what user sees/does, not implementation
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

describe("BottomNavigation", () => {
  it("shows all navigation items", () => {
    render(<BottomNavigation />)

    // Use getByRole for accessibility + testing
    expect(screen.getByRole("link", { name: /transactions/i })).toBeVisible()
    expect(screen.getByRole("link", { name: /budget/i })).toBeVisible()
  })

  it("navigates when clicking items", async () => {
    const user = userEvent.setup()
    render(<BottomNavigation />)

    await user.click(screen.getByRole("link", { name: /transactions/i }))

    expect(window.location.pathname).toBe("/dashboard/")
  })
})
```

## Bugs We Encountered (Lessons Learned)

### Bug #1: Fake Timers + waitFor = Timeout

**Problem**: Hook tests timing out with `waitFor`

```typescript
// ❌ BAD - causes timeout
beforeEach(() => {
  vi.useFakeTimers()
})

it("detects something", async () => {
  await waitFor(() => {  // Times out!
    expect(result.current.isAndroid).toBe(true)
  })
})
```

**Root Cause**: `waitFor` uses real timers internally. Fake timers break its polling.

**Solution**: Use `act()` instead

```typescript
// ✅ GOOD
beforeEach(() => {
  vi.useRealTimers()  // or just remove fake timers
})

it("detects something", async () => {
  await act(async () => {
    window.dispatchEvent(new Event("resize"))
    await Promise.resolve()
  })

  expect(result.current.isAndroid).toBe(true)
})
```

### Bug #2: Platform Detection Not Triggering

**Problem**: Hook doesn't detect platform changes

**Root Cause**: Platform detection runs once on mount but doesn't re-run on resize/orientation change.

**Solution**: Test that event listeners trigger updates

```typescript
it("updates on window resize", async () => {
  const { result } = renderHook(() => usePlatformDetection())

  // Change user agent (simulate platform switch)
  Object.defineProperty(navigator, "userAgent", {
    value: "...new platform...",
    configurable: true,
  })

  // Trigger resize
  await act(async () => {
    window.dispatchEvent(new Event("resize"))
    await Promise.resolve()
  })

  expect(result.current.platform).toBe("new")
})
```

### Bug #3: CSS Variable Mocking

**Problem**: `getComputedStyle` for safe area insets returns empty

**Solution**: Properly mock `getComputedStyle`

```typescript
beforeEach(() => {
  window.getComputedStyle = vi.fn(() => ({
    getPropertyValue: (property: string) => {
      const values: Record<string, string> = {
        "--safe-area-inset-bottom": "48px",
        "--safe-area-inset-top": "47px",
      }
      return values[property] || ""
    },
  })) as any
})
```

## Testing Mobile-Specific Behavior

### Safe Area Insets

```typescript
describe("Mobile Layout", () => {
  it("applies correct padding for Android 3-button nav", () => {
    const insets = { bottom: 48, top: 0 }
    const padding = calculateBottomPadding(true, false, insets.bottom)

    expect(padding).toBe("calc(64px + 48px)")
  })

  it("never applies excessive padding", () => {
    const extremeInsets = [0, 16, 48, 100, 200]

    extremeInsets.forEach((inset) => {
      const padding = calculateBottomPadding(true, false, inset)
      const paddingValue = parseFloat(padding.replace(/[^0-9.]/g, ""))

      // Critical: padding should never exceed 300px
      expect(paddingValue).toBeLessThan(300)
    })
  })
})
```

### Platform Detection

```typescript
describe("Platform Detection", () => {
  const userAgents = {
    androidNative: "...Android...FintrNativeApp",
    iosNative: "...iPhone...FintrNativeApp",
    androidBrowser: "...Android...Chrome...",
    desktop: "...Macintosh...",
  }

  it.each([
    [userAgents.androidNative, true, false],
    [userAgents.iosNative, false, true],
    [userAgents.androidBrowser, false, false],
  ])("detects platform from user agent", (ua, isAndroid, isIOS) => {
    const result = detectPlatform(ua)
    expect(result.isAndroidNative).toBe(isAndroid)
    expect(result.isIOSNative).toBe(isIOS)
  })
})
```

## Common Mistakes to Avoid

1. **Testing implementation details**
   ```typescript
   // ❌ Don't test internal state
   expect(component.state.isOpen).toBe(true)

   // ✅ Test what user sees
   expect(screen.getByText("Open")).toBeVisible()
   ```

2. **Using test IDs excessively**
   ```typescript
   // ❌ Avoid when possible
   screen.getByTestId("submit-button")

   // ✅ Prefer role-based queries
   screen.getByRole("button", { name: /submit/i })
   ```

3. **Over-using act()**
   ```typescript
   // ❌ RTL helpers already wrap in act()
   await act(async () => {
     await user.click(button)
   })

   // ✅ Just use userEvent
   await user.click(button)
   ```

4. **Not testing error cases**
   ```typescript
   // Always test failure paths
   it("handles errors gracefully", () => {
     const result = calculatePadding(null, null)
     expect(result).toBe("80px")  // Default fallback
   })
   ```

## E2E Testing with Playwright

For mobile viewport testing:

```typescript
// e2e/mobile-layout.spec.ts
import { test, expect } from "@playwright/test"

test.describe("Mobile Layout", () => {
  test("bottom nav is visible on Android", async ({ page }) => {
    // Set Android user agent
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", {
        value: "...Android...FintrNativeApp",
      })
    })

    await page.goto("/dashboard/")
    await page.setViewportSize({ width: 393, height: 851 })

    const bottomNav = page.locator("nav.fixed")
    await expect(bottomNav).toBeVisible()

    // Verify position
    const box = await bottomNav.boundingBox()
    expect(box?.y).toBeGreaterThan(700)  // Near bottom
  })
})
```

## Running Tests

```bash
# Unit tests (fast feedback)
pnpm test --run

# Watch mode (during development)
pnpm test

# UI mode (debugging)
pnpm test:ui

# Coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e

# Specific test file
pnpm test src/lib/myFeature.test.ts
```

## Verification Checklist

After writing tests, verify:

- [ ] Tests fail before implementation (Red)
- [ ] Tests pass after implementation (Green)
- [ ] Code is refactored and clean
- [ ] All edge cases covered
- [ ] Error cases tested
- [ ] No fake timers with `waitFor`
- [ ] Using `act()` for state changes
- [ ] Tests run in under 1 second each
- [ ] No `allow_any_instance_of` equivalent

## Related Files

- Testing docs: `fintr-fe/TESTING.md`
- Vitest config: `fintr-fe/vitest.config.ts`
- Playwright config: `fintr-fe/playwright.config.ts`
- Test setup: `fintr-fe/src/test/setup.ts`
