import {
  FINTR_LOGO_DARK_SRC,
  FINTR_LOGO_LIGHT_SRC,
  FINTR_LOGO_NAVY_SRC,
  FINTR_LOGO_SPLASH_SRC,
} from "./fintr-logo";

describe("Fintr logo sources", () => {
  it("uses bundled public paths so logos work offline in Capacitor", () => {
    expect(FINTR_LOGO_LIGHT_SRC).toBe("/fintr-logo.png");
    expect(FINTR_LOGO_NAVY_SRC).toBe("/fintr-logo-dark.png");
    expect(FINTR_LOGO_DARK_SRC).toBe("/fintr-logo-white-transparent.svg");
    expect(FINTR_LOGO_SPLASH_SRC).toBe("/fintr-logo-splash.png");

    for (const src of [
      FINTR_LOGO_LIGHT_SRC,
      FINTR_LOGO_NAVY_SRC,
      FINTR_LOGO_DARK_SRC,
      FINTR_LOGO_SPLASH_SRC,
    ]) {
      expect(src.startsWith("/")).toBe(true);
      expect(src.includes("http")).toBe(false);
    }
  });
});
