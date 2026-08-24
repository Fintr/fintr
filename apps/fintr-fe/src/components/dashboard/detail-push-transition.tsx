"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { shouldShowImmediateBackButton } from "@/lib/dashboard-back-button-routes";

export const DETAIL_PUSH_DURATION_SEC = 0.24;
export const DETAIL_PUSH_EASE = [0.32, 0.72, 0, 1] as const;

type DetailPushPhase = "enter" | "exit";

type DetailPushExitApi = {
  requestExit: (then: () => void) => void;
};

type DetailPushRegister = (api: DetailPushExitApi) => () => void;

const DetailPushRegisterContext = createContext<DetailPushRegister | null>(
  null,
);

const DetailPushExitContext = createContext<DetailPushExitApi>({
  requestExit: (then) => then(),
});

export const useDetailPushPhase = (reduceMotion: boolean | null) => {
  const [phase, setPhase] = useState<DetailPushPhase>("enter");
  const thenRef = useRef<(() => void) | null>(null);

  const requestExit = useCallback(
    (then: () => void) => {
      if (reduceMotion) {
        then();
        return;
      }

      thenRef.current = then;
      setPhase("exit");
    },
    [reduceMotion],
  );

  const handleAnimationComplete = useCallback((definition?: unknown) => {
    if (phase !== "exit") {
      return;
    }

    if (definition !== undefined) {
      const isExitTarget =
        typeof definition === "object"
        && definition !== null
        && "x" in definition
        && (definition as { x?: unknown }).x === "100%";

      if (!isExitTarget) {
        return;
      }
    }

    thenRef.current?.();
    thenRef.current = null;
  }, [phase]);

  return {
    phase,
    requestExit,
    handleAnimationComplete,
  };
};

export const useDetailPushExit = () => useContext(DetailPushExitContext);

export const DetailPushNavigationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const apiRef = useRef<DetailPushExitApi | null>(null);

  const register = useCallback<DetailPushRegister>((api) => {
    apiRef.current = api;
    return () => {
      if (apiRef.current === api) {
        apiRef.current = null;
      }
    };
  }, []);

  const requestExit = useCallback((then: () => void) => {
    if (apiRef.current) {
      apiRef.current.requestExit(then);
      return;
    }

    then();
  }, []);

  const exitApi = useMemo(() => ({ requestExit }), [requestExit]);

  return (
    <DetailPushRegisterContext.Provider value={register}>
      <DetailPushExitContext.Provider value={exitApi}>
        {children}
      </DetailPushExitContext.Provider>
    </DetailPushRegisterContext.Provider>
  );
};

export const DetailPushPanel = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const reduceMotion = useReducedMotion();
  const register = useContext(DetailPushRegisterContext);
  const { phase, requestExit, handleAnimationComplete } =
    useDetailPushPhase(reduceMotion);

  useEffect(() => {
    if (!register) {
      return;
    }

    return register({ requestExit });
  }, [register, requestExit]);

  const skipSlide = Boolean(reduceMotion);
  const hiddenOffscreen = !skipSlide && phase === "exit";

  return (
    <motion.div
      data-testid="detail-push-panel"
      data-detail-push={phase}
      className="min-h-0"
      initial={skipSlide ? false : { x: "100%" }}
      animate={{ x: hiddenOffscreen ? "100%" : 0 }}
      transition={
        skipSlide
          ? { duration: 0 }
          : {
              type: "tween",
              duration: DETAIL_PUSH_DURATION_SEC,
              ease: DETAIL_PUSH_EASE,
            }
      }
      onAnimationComplete={handleAnimationComplete}
    >
      {children}
    </motion.div>
  );
};

export const DashboardPushChildren = ({
  pathname,
  search: searchOverride,
  children,
}: {
  pathname: string;
  search?: string;
  children: React.ReactNode;
}) => {
  const liveSearchParams = useSearchParams();
  const search = searchOverride ?? liveSearchParams?.toString() ?? "";

  if (!shouldShowImmediateBackButton(pathname)) {
    return children;
  }

  return (
    <DetailPushPanel key={`${pathname}?${search}`}>
      {children}
    </DetailPushPanel>
  );
};

