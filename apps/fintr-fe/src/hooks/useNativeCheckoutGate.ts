"use client";

import { useSyncExternalStore } from "react";

import {
  isNativeCapacitor,
  isNativeCapacitorAsync,
} from "@/lib/capacitor";

export type NativeCheckoutGate = "unknown" | "native" | "web";

let gate: NativeCheckoutGate = "unknown";
let generation = 0;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: NativeCheckoutGate) {
  if (gate === next) {
    return;
  }

  gate = next;
  listeners.forEach((listener) => listener());
}

function refresh() {
  if (typeof window === "undefined") {
    return;
  }

  if (isNativeCapacitor()) {
    publish("native");
    return;
  }

  if (pending) {
    return;
  }

  const currentGeneration = generation;
  pending = isNativeCapacitorAsync()
    .then((native) => {
      if (currentGeneration !== generation) {
        return;
      }

      publish(native ? "native" : "web");
    })
    .finally(() => {
      pending = null;
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  refresh();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): NativeCheckoutGate {
  if (typeof window !== "undefined" && isNativeCapacitor()) {
    return "native";
  }

  return gate;
}

export function useNativeCheckoutGate(): NativeCheckoutGate {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => "unknown",
  );
}

export function resetNativeCheckoutGateForTests() {
  generation += 1;
  gate = "unknown";
  pending = null;
  listeners.clear();
}
