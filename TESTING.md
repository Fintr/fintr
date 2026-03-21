# Testing Guide for Fintr Mobile Layouts

This document describes the testing setup for ensuring consistent safe area padding and system navigation handling across Android, iOS, and browser mobile.

## Overview

The testing suite addresses the specific issue where padding for system navigation buttons (3-button navigation on Android) becomes excessively large when behaviors change.

## Testing Stack

- **Vitest** - Unit tests for platform detection logic and calculations
- **Playwright** - E2E tests for visual rendering across mobile viewports
- **@testing-library/react** - Component testing utilities

## Running Tests

### Unit Tests (Vitest)

```bash
# Run all unit tests
pnpm test

# Run with UI for debugging
pnpm test:ui

# Run with coverage report
pnpm test:coverage
```

### E2E Tests (Playwright)

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI for debugging
pnpm test:e2e:ui

# Run only mobile viewport tests
pnpm test:mobile

# Debug a specific test
pnpm test:e2e:debug
```

### All Tests

```bash
# Run both unit and E2E tests
pnpm test:all
```

## Test Coverage

### Unit Tests (`src/lib/platform-detection.test.ts`)

Tests the core platform detection logic:

- **Android Native Detection**
  - Detection via `FintrNativeApp` in user agent
  - Detection via WebView pattern (`; wv)`)
  - Detection via CSS class
  - Excludes Android browser from native detection

- **iOS Native Detection**
  - Detection via `FintrNativeApp` in user agent
  - Detection via CSS class
  - Excludes iOS browser from native detection

- **Desktop Detection**
  - Correctly identifies non-mobile platforms

- **Safe Area Calculations**
  - `calculateBottomPadding()` - Android 3-button nav (48px min), iOS home indicator, browser fallback
  - `calculateNavBottomOffset()` - Navigation positioning for Android
  - `calculateHeaderSpacerHeight()` - Header spacer with safe area
  - `getSafeAreaInsets()` - CSS environment variable parsing

### Hook Tests (`src/hooks/usePlatformDetection.test.tsx`)

Tests the React hook:

- SSR-safe initial values
- Platform detection on mount
- Safe area inset reading from CSS
- Window resize and orientation change handling

### E2E Tests (`e2e/safe-area-padding.spec.ts`)

Tests actual rendering across platforms:

- **Android Native**
  - 3-button navigation padding (48px minimum)
  - Gesture navigation handling
  - White spacer visibility
  - Bottom navigation positioning

- **iOS Native**
  - Home indicator area padding (34px typical)
  - Notch area handling (status bar)
  - Header spacer calculation
  - Bottom nav with safe area

- **Mobile Browser**
  - Standard 80px padding fallback
  - No native-specific spacers
  - Consistent behavior across browsers

- **Responsive Behavior**
  - Orientation changes
  - Scrollability with padding
  - Viewport resizing

- **Edge Cases**
  - Zero safe area insets
  - Very large safe areas
  - WebView detection

### Dynamic Behavior Tests (`e2e/dynamic-behavior.spec.ts`)

Tests specifically for the "padding explosion" issue:

- Safe area changes (gesture → 3-button nav)
- Rapid consecutive changes
- Orientation + safe area combination changes
- Home indicator visibility changes
- **Regression tests** ensuring padding never exceeds 300px

## Platform Detection Logic

The platform detection uses multiple signals:

1. **User Agent** - `FintrNativeApp` string for both iOS and Android
2. **WebView Pattern** - `; wv)` in Android user agent
3. **CSS Classes** - `fintr-native-android` or `fintr-native-ios` on document element
4. **Capacitor Bridge** - `window.Capacitor` object (checked in other utilities)

## Safe Area Calculation Rules

### Android Native

- **3-button navigation**: `calc(64px + max(safeAreaBottom, 48px))`
- **Gesture navigation**: `calc(64px + max(safeAreaBottom, 48px))` (48px is minimum)
- **Nav position**: `max(safeAreaBottom, 48px)` from bottom
- **White spacer**: Fixed at bottom, `max(safeAreaBottom, 48px)` height

### iOS Native

- **Bottom padding**: `calc(64px + max(safeAreaBottom, 16px))`
- **Nav position**: 0 (sits at bottom with padding inside)
- **Header spacer**: `calc(44px + safeAreaTop)`

### Mobile Browser

- **Bottom padding**: Fixed `80px`
- **Header spacer**: Uses `env(safe-area-inset-top)` CSS function

## Architecture

### Files

```
src/
├── lib/
│   ├── platform-detection.ts          # Core detection & calculations
│   └── platform-detection.test.ts     # Unit tests
├── hooks/
│   ├── usePlatformDetection.ts        # React hook
│   └── usePlatformDetection.test.tsx  # Hook tests
└── test/
    ├── setup.ts                        # Vitest setup & mocks
    └── mocks/
        └── platform.ts                 # Test fixtures & helpers

e2e/
├── safe-area-padding.spec.ts           # Platform rendering tests
└── dynamic-behavior.spec.ts           # Dynamic change tests
```

### Usage in Components

```tsx
// Use the hook for platform detection
const {
  isAndroidNative,
  isIOSNative,
  safeAreaInsetBottom,
  safeAreaInsetTop,
} = usePlatformDetection();

// Use calculation functions for styling
const bottomPadding = calculateBottomPadding(
  isAndroidNative,
  isIOSNative,
  safeAreaInsetBottom
);

const headerSpacerHeight = calculateHeaderSpacerHeight(
  isAndroidNative,
  isIOSNative,
  safeAreaInsetTop
);
```

## CI/CD Integration

The tests are configured to run in CI environments:

- Vitest runs with coverage reporting
- Playwright runs headless in CI mode
- Tests retry on failure in CI (2 retries)
- Screenshots captured on E2E test failures

## Adding New Tests

### Unit Test Example

```ts
import { describe, it, expect } from "vitest"
import { detectPlatform } from "@/lib/platform-detection"

describe("My new feature", () => {
  it("detects new platform correctly", () => {
    const result = detectPlatform("MyNewUserAgent/1.0")
    expect(result.isNative).toBe(true)
  })
})
```

### E2E Test Example

```ts
import { test, expect } from "@playwright/test"

test("my new scenario", async ({ page }) => {
  await page.goto("/dashboard/")

  const element = page.locator("[data-testid='my-element']")
  await expect(element).toBeVisible()

  const style = await element.evaluate((el) =>
    window.getComputedStyle(el).paddingBottom
  )
  expect(parseFloat(style)).toBeGreaterThan(0)
})
```

## Debugging Tips

1. **Use `test:ui`** - The Vitest UI shows real-time test results and filtering
2. **Playwright Trace Viewer** - Run with `--trace on` to capture detailed traces
3. **Screenshots** - E2E tests capture screenshots on failure automatically
4. **CSS Inspection** - Use Playwright's `--debug` mode to inspect computed styles

## Known Limitations

1. **Safe area simulation** - CSS environment variables (`env(safe-area-inset-*)`) are mocked in tests
2. **Real device testing** - Playwright simulates viewports but doesn't replace real device testing
3. **Platform detection** - Some edge cases (hybrid apps, custom WebViews) may need additional handling
