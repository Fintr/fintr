import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getMaintenanceMessage,
  getMaintenanceTitle,
  isMaintenanceModeEnabled,
} from "./maintenance-mode";

describe("maintenance-mode", () => {
  const originalMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE;
  const originalMaintenanceMessage = process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE;
  const originalMaintenanceTitle = process.env.NEXT_PUBLIC_MAINTENANCE_TITLE;

  afterEach(() => {
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE = originalMaintenanceMode;
    process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE = originalMaintenanceMessage;
    process.env.NEXT_PUBLIC_MAINTENANCE_TITLE = originalMaintenanceTitle;
  });

  describe("isMaintenanceModeEnabled", () => {
    it("returns true only when env is exactly true", () => {
      process.env.NEXT_PUBLIC_MAINTENANCE_MODE = "true";
      expect(isMaintenanceModeEnabled()).toBe(true);
    });

    it("returns false when unset or other values", () => {
      delete process.env.NEXT_PUBLIC_MAINTENANCE_MODE;
      expect(isMaintenanceModeEnabled()).toBe(false);

      process.env.NEXT_PUBLIC_MAINTENANCE_MODE = "false";
      expect(isMaintenanceModeEnabled()).toBe(false);
    });
  });

  describe("getMaintenanceMessage", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE;
    });

    it("returns default copy when env is unset", () => {
      expect(getMaintenanceMessage()).toMatch(/scheduled maintenance/i);
    });

    it("returns custom copy when env is set", () => {
      process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE = "GCP migration in progress.";
      expect(getMaintenanceMessage()).toBe("GCP migration in progress.");
    });
  });

  describe("getMaintenanceTitle", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_MAINTENANCE_TITLE;
    });

    it("returns default title when env is unset", () => {
      expect(getMaintenanceTitle()).toBe("We'll be right back");
    });

    it("returns custom title when env is set", () => {
      process.env.NEXT_PUBLIC_MAINTENANCE_TITLE = "Maintenance";
      expect(getMaintenanceTitle()).toBe("Maintenance");
    });
  });
});
