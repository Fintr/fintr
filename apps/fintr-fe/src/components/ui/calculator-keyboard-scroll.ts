const SCROLL_PADDING_REGISTRY = new Map<
  HTMLElement,
  { count: number; originalPaddingBottom: string }
>();

const CALCULATOR_SCROLL_GAP_PX = 12;

export type CalculatorKeyboardLayout =
  | "below"
  | "above"
  | "bottom-sheet"
  | "floating";

export type CalculatorKeyboardPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  height?: number;
};

type ComputeKeyboardPlacementOptions = {
  isMobile: boolean;
  androidBottomInsetPx: number;
  mobileKeyboardViewportRatio: number;
  desktopKeyboardMinHeight: number;
  desktopKeyboardWidth: number;
  desktopFloatingBottomOffsetPx: number;
  keyboardGap: number;
  viewportPadding?: number;
};

export function computeKeyboardPlacement(
  input: HTMLElement,
  options: ComputeKeyboardPlacementOptions,
): {
  layout: CalculatorKeyboardLayout;
  position: CalculatorKeyboardPosition;
} {
  const padding = options.viewportPadding ?? 16;
  const rect = input.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const keyboardHeight = options.isMobile
    ? viewportHeight * options.mobileKeyboardViewportRatio
    : options.desktopKeyboardMinHeight;
  const desktopKeyboardWidth = Math.min(
    options.desktopKeyboardWidth,
    viewportWidth - padding * 2,
  );
  const keyboardWidth = options.isMobile ? viewportWidth : desktopKeyboardWidth;

  if (options.isMobile) {
    return {
      layout: "bottom-sheet",
      position: {
        top: 0,
        left: 0,
        width: keyboardWidth,
        height: keyboardHeight,
      },
    };
  }

  let left = rect.left;

  if (left + keyboardWidth > viewportWidth - padding) {
    left = rect.right - keyboardWidth;
  }

  if (left < padding) {
    left = padding;
  }

  const bottomInset = options.androidBottomInsetPx;
  const spaceBelow = viewportHeight - rect.bottom - padding - bottomInset;
  const spaceAbove = rect.top - padding;
  const minAnchoredHeight = options.desktopKeyboardMinHeight;

  if (spaceBelow >= minAnchoredHeight + options.keyboardGap) {
    return {
      layout: "below",
      position: {
        top: rect.bottom + options.keyboardGap,
        left,
        width: keyboardWidth,
      },
    };
  }

  if (spaceAbove >= minAnchoredHeight + options.keyboardGap) {
    return {
      layout: "above",
      position: {
        top: rect.top - minAnchoredHeight - options.keyboardGap,
        left,
        width: keyboardWidth,
      },
    };
  }

  return {
    layout: "floating",
    position: {
      bottom: options.desktopFloatingBottomOffsetPx + bottomInset,
      left: Math.max(padding, (viewportWidth - desktopKeyboardWidth) / 2),
      width: desktopKeyboardWidth,
    },
  };
}

export function findScrollableAncestor(element: HTMLElement | null): HTMLElement | null {
  let current = element?.parentElement ?? null;

  while (current) {
    if (current.classList.contains("overflow-y-auto")) {
      return current;
    }

    if (current.hasAttribute("data-modal-content")) {
      return current.querySelector<HTMLElement>(".overflow-y-auto");
    }

    const { overflowY } = window.getComputedStyle(current);
    const canScroll =
      overflowY === "auto"
      || overflowY === "scroll"
      || overflowY === "overlay";

    if (canScroll) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

export function acquireCalculatorScrollPadding(
  scrollParent: HTMLElement,
  paddingPx: number,
) {
  const existing = SCROLL_PADDING_REGISTRY.get(scrollParent);

  if (existing) {
    existing.count += 1;
    scrollParent.style.paddingBottom = `${paddingPx}px`;
    return;
  }

  SCROLL_PADDING_REGISTRY.set(scrollParent, {
    count: 1,
    originalPaddingBottom: scrollParent.style.paddingBottom,
  });
  scrollParent.style.paddingBottom = `${paddingPx}px`;
}

export function releaseCalculatorScrollPadding(scrollParent: HTMLElement) {
  const existing = SCROLL_PADDING_REGISTRY.get(scrollParent);

  if (!existing) {
    return;
  }

  existing.count -= 1;

  if (existing.count > 0) {
    return;
  }

  scrollParent.style.paddingBottom = existing.originalPaddingBottom;
  SCROLL_PADDING_REGISTRY.delete(scrollParent);
}

export function scrollInputClearOfKeyboard(
  input: HTMLElement,
  keyboardHeightPx: number,
  gapPx: number = CALCULATOR_SCROLL_GAP_PX,
  scrollBehavior: ScrollBehavior = "smooth",
) {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const visibleBottom = viewportHeight - keyboardHeightPx - gapPx;
  const inputRect = input.getBoundingClientRect();
  const scrollParent = findScrollableAncestor(input);

  if (inputRect.bottom > visibleBottom) {
    const delta = inputRect.bottom - visibleBottom;

    if (scrollParent) {
      scrollParent.scrollBy({ top: delta, behavior: scrollBehavior });
    } else {
      window.scrollBy({ top: delta, behavior: scrollBehavior });
    }
  }

  if (inputRect.top < gapPx) {
    const delta = inputRect.top - gapPx;

    if (scrollParent) {
      scrollParent.scrollBy({ top: delta, behavior: scrollBehavior });
    } else {
      window.scrollBy({ top: delta, behavior: scrollBehavior });
    }
  }
}

export function measureKeyboardOcclusionHeight(
  keyboardElement: HTMLElement | null,
  fallbackHeightPx: number,
): number {
  if (!keyboardElement) {
    return fallbackHeightPx;
  }

  return Math.ceil(keyboardElement.getBoundingClientRect().height);
}

export function keyboardLayoutReservesScrollSpace(
  layout: "below" | "above" | "bottom-sheet" | "floating",
): boolean {
  return layout === "bottom-sheet" || layout === "floating";
}
