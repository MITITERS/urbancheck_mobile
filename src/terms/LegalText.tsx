import { StyleSheet, View } from "react-native";

import type { TermsOfService } from "../api/users";
import { Markdown } from "./Markdown";

/**
 * Los dos documentos de una versión, uno debajo del otro (RN-10).
 *
 * Van juntos porque se aceptan juntos: quien marca la casilla tiene que haber
 * tenido a la vista también la política de privacidad. Cada archivo trae su
 * propio título, así que acá solo se los separa.
 */
export function LegalText({ terms }: { terms: TermsOfService }) {
  return (
    <View>
      <Markdown>{terms.terms}</Markdown>
      <View style={styles.divider} />
      <Markdown>{terms.privacy}</Markdown>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { height: 2, backgroundColor: "#e5e7eb", marginVertical: 24 },
});
