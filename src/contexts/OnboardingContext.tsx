"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUniversalAddModals } from "@/contexts/UniversalAddContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useToast } from "@/hooks/useToast";

type OnboardingContextValue = {
  step: 1 | 2 | 3;
  completed: boolean;
  isLoading: boolean;
  reportAction: (action: "zone_set" | "seed_added" | "task_added") => Promise<void>;
  dismiss: () => Promise<void>;
  /** When set, NewTaskModal should use this as initial title (e.g. "Observe Hillside") and clear it after use. */
  initialTaskTitle: string | null;
  clearInitialTaskTitle: () => void;
  /** Opens task modal with "Observe Hillside" pre-filled for onboarding Step 3. */
  openTaskForOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const ONBOARDING_TASK_TITLE = "Observe Hillside";

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { openTask } = useUniversalAddModals();
  const { toast, showToast } = useToast();
  const onboarding = useOnboarding(user ?? null);
  const [initialTaskTitle, setInitialTaskTitle] = useState<string | null>(null);
  const prevCompletedRef = useRef<boolean>(false);

  useEffect(() => {
    if (onboarding.completed && !prevCompletedRef.current) {
      prevCompletedRef.current = true;
      showToast("Your garden is ready!", { icon: "🌱" });
    }
    if (!onboarding.completed) prevCompletedRef.current = false;
  }, [onboarding.completed, showToast]);

  const openTaskForOnboarding = useCallback(() => {
    setInitialTaskTitle(ONBOARDING_TASK_TITLE);
    openTask();
  }, [openTask]);

  const clearInitialTaskTitle = useCallback(() => setInitialTaskTitle(null), []);

  const value: OnboardingContextValue = {
    step: onboarding.step,
    completed: onboarding.completed,
    isLoading: onboarding.isLoading,
    reportAction: onboarding.reportAction,
    dismiss: onboarding.dismiss,
    initialTaskTitle,
    clearInitialTaskTitle,
    openTaskForOnboarding,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {toast}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingContext(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (ctx === undefined) {
    throw new Error("useOnboardingContext must be used within OnboardingProvider");
  }
  return ctx;
}

/** Optional hook — returns undefined when outside provider (e.g. auth pages). */
export function useOnboardingContextOptional(): OnboardingContextValue | undefined {
  return useContext(OnboardingContext);
}
