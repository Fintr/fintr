import confetti from "canvas-confetti";

/**
 * Palette inspired by Mobbin celebration screens (Shop, Liven, Me+)
 * plus Fintr primary blue for brand cohesion.
 */
const INCOME_CONFETTI_COLORS = [
  "#0A3D62",
  "#3B82F6",
  "#22C55E",
  "#FBBF24",
  "#F59E0B",
  "#FB7185",
  "#14B8A6",
  "#F97316",
];

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") {
    return true;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/**
 * Fires a short full-viewport confetti burst when income is created.
 * Side cannons + a center pop, matching common Mobbin success patterns.
 */
export const celebrateIncomeCreated = (): void => {
  if (prefersReducedMotion()) {
    return;
  }

  const defaults = {
    colors: INCOME_CONFETTI_COLORS,
    disableForReducedMotion: true,
    zIndex: 9999,
  };

  confetti({
    ...defaults,
    particleCount: 55,
    spread: 70,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.55 },
  });

  confetti({
    ...defaults,
    particleCount: 40,
    angle: 60,
    spread: 55,
    startVelocity: 55,
    origin: { x: 0, y: 0.7 },
  });

  confetti({
    ...defaults,
    particleCount: 40,
    angle: 120,
    spread: 55,
    startVelocity: 55,
    origin: { x: 1, y: 0.7 },
  });

  const end = Date.now() + 600;

  const frame = () => {
    confetti({
      ...defaults,
      particleCount: 2,
      angle: 60,
      spread: 45,
      origin: { x: 0, y: 0.65 },
    });
    confetti({
      ...defaults,
      particleCount: 2,
      angle: 120,
      spread: 45,
      origin: { x: 1, y: 0.65 },
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  requestAnimationFrame(frame);
};
