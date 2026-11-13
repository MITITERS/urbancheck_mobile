import { useRouter } from "expo-router";

import { OnboardingTour } from "../../src/onboarding/OnboardingTour";

/**
 * «Ver tutorial» desde el perfil (US-051, escenario 7): el recorrido completo,
 * y al cerrarlo se vuelve al perfil sin tocar ninguna marca.
 */
export default function TutorialReplayScreen() {
  const router = useRouter();
  return <OnboardingTour replay onFinish={() => router.back()} />;
}
