import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

import { onboardingMessages } from "../messages/onboarding";

export interface OnboardingStep {
  key: string;
  /** La ilustración del paso: un ícono grande sobre un círculo de color. */
  icon: ComponentProps<typeof Ionicons>["name"];
  tint: string;
  title: string;
  body: string;
}

/**
 * Los pasos del tutorial de bienvenida (US-051), como datos.
 *
 * Una idea por pantalla. Agregar, quitar o reordenar un paso es editar esta
 * lista: el componente del recorrido no sabe cuántos hay ni qué dicen.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    key: "welcome",
    icon: "business-outline",
    tint: "#1a73e8",
    ...onboardingMessages.steps.welcome,
  },
  {
    key: "report",
    icon: "camera-outline",
    tint: "#f59e0b",
    ...onboardingMessages.steps.report,
  },
  {
    key: "community",
    icon: "heart-outline",
    tint: "#e53935",
    ...onboardingMessages.steps.community,
  },
  {
    key: "follow",
    icon: "notifications-outline",
    tint: "#16a34a",
    ...onboardingMessages.steps.follow,
  },
];
