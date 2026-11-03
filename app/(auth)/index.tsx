import { Redirect } from "expo-router";

/**
 * La raíz (`/`) sin sesión.
 *
 * Desde expo-router 58, cuando el guard de `(app)` está en falso, `/` ya no cae
 * en la primera pantalla permitida: queda como ruta inexistente y se ve
 * "Unmatched Route". Es justo la URL con la que abre Expo Go. Este índice le da
 * a `/` un destino dentro de `(auth)`; con sesión, el guard lo deja afuera y `/`
 * vuelve a ser el feed.
 */
export default function AuthIndex() {
  return <Redirect href="/(auth)/login" />;
}
