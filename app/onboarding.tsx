import { useAuth } from "../src/auth/AuthContext";
import { markOnboardingSeen } from "../src/onboarding/mark";
import { OnboardingTour } from "../src/onboarding/OnboardingTour";

/**
 * Tutorial de bienvenida en el primer ingreso de un vecino (US-051).
 *
 * El guard del layout raíz es quien decide mostrarlo, en el mismo punto que
 * resuelve la contraseña temporal y la navegación por rol: no la pantalla del
 * feed. Al terminar u omitir, se marca la cuenta y el perfil en memoria cambia;
 * el guard deja de cubrir esta ruta y la navegación entra sola al feed.
 *
 * Si la app se cierra a mitad del recorrido no se marcó nada, así que en el
 * próximo ingreso arranca otra vez desde el primer paso (escenario 6).
 */
export default function OnboardingScreen() {
  const { user, setUser } = useAuth();

  async function handleFinish() {
    if (!user) return;
    setUser(await markOnboardingSeen(user));
  }

  return <OnboardingTour onFinish={handleFinish} />;
}
