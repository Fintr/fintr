export interface AppearancePlugin {
  setAppearance(options: { theme: "light" | "dark" }): Promise<void>;
}

const webFallback: AppearancePlugin = {
  setAppearance: async () => {},
};

let AppearanceExport: AppearancePlugin;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const capacitorCore = require("@capacitor/core");
  const registerPlugin = capacitorCore.registerPlugin as <T>(
    name: string,
    opts?: object,
  ) => T;
  AppearanceExport = registerPlugin<AppearancePlugin>("Appearance", {
    web: () => Promise.resolve(webFallback),
  });
} catch (error) {
  console.warn("[Appearance] Failed to register plugin:", error);
  AppearanceExport = webFallback;
}

export { AppearanceExport as Appearance };
