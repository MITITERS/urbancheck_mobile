import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { onboardingMessages as t } from "../messages/onboarding";
import { ONBOARDING_STEPS, type OnboardingStep } from "./steps";

interface Props {
  /**
   * Se llama al presionar Empezar u Omitir. Las dos salidas son la misma: el
   * tutorial queda visto igual (escenarios 3 y 4).
   */
  onFinish: () => void | Promise<void>;
  /**
   * Volver a verlo desde el perfil (escenario 7): sin Omitir —no hay nada que
   * omitir—, con una salida que solo cierra y no toca ninguna marca.
   */
  replay?: boolean;
  steps?: readonly OnboardingStep[];
}

/**
 * El recorrido de bienvenida (US-051): una idea por pantalla, deslizando o con
 * los botones.
 *
 * Usa un `ScrollView` horizontal con `pagingEnabled`, el mismo patrón que la
 * galería del detalle del reporte, en vez de sumar una dependencia nativa de
 * paginado. No pide permisos de cámara ni de ubicación: esos se piden donde se
 * usan, al crear el reporte, donde el vecino entiende para qué son.
 */
export function OnboardingTour({ onFinish, replay = false, steps = ONBOARDING_STEPS }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const isLast = index === steps.length - 1;

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(steps.length - 1, next));
    setIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
  }

  function handleSwipeEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    if (page !== index) setIndex(Math.max(0, Math.min(steps.length - 1, page)));
  }

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    try {
      await onFinish();
    } finally {
      setFinishing(false);
    }
  }

  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
      testID="onboarding-tour"
    >
      <View style={styles.topBar}>
        {replay ? (
          <Pressable
            onPress={finish}
            accessibilityRole="button"
            accessibilityLabel={t.close}
            hitSlop={12}
          >
            <Ionicons name="close" size={26} color="#4b5563" />
          </Pressable>
        ) : !isLast ? (
          <Pressable onPress={finish} accessibilityRole="button" hitSlop={12}>
            <Text style={styles.skip}>{t.skip}</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleSwipeEnd}
        testID="onboarding-pager"
        style={styles.pager}
      >
        {steps.map((step) => (
          <View key={step.key} style={[styles.page, { width }]}>
            <View style={[styles.illustration, { backgroundColor: `${step.tint}1a` }]}>
              <Ionicons name={step.icon} size={84} color={step.tint} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {step.title}
            </Text>
            <Text style={styles.body}>{step.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={styles.dots}
        accessible
        accessibilityLabel={t.progress(index + 1, steps.length)}
      >
        {steps.map((step, i) => (
          <View key={step.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
      <Text style={styles.progress}>{t.progress(index + 1, steps.length)}</Text>

      <View style={styles.actions}>
        {index > 0 ? (
          <Pressable
            style={[styles.button, styles.secondary]}
            onPress={() => goTo(index - 1)}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>{t.back}</Text>
          </Pressable>
        ) : (
          <View style={styles.buttonSpacer} />
        )}
        {isLast ? (
          <Pressable
            style={[styles.button, styles.primary]}
            onPress={finish}
            disabled={finishing}
            accessibilityRole="button"
            accessibilityState={{ disabled: finishing, busy: finishing }}
          >
            {finishing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>{replay ? t.close : t.start}</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, styles.primary]}
            onPress={() => goTo(index + 1)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{t.next}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  topBar: {
    height: 32,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  skip: { fontSize: 15, fontWeight: "600", color: "#6b7280" },
  pager: { flex: 1 },
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  illustration: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 12,
  },
  body: { fontSize: 16, lineHeight: 23, color: "#4b5563", textAlign: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#d1d5db" },
  dotActive: { width: 22, backgroundColor: "#1a73e8" },
  progress: { textAlign: "center", color: "#9ca3af", fontSize: 13, marginTop: 8 },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSpacer: { flex: 1 },
  primary: { backgroundColor: "#1a73e8" },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondary: { backgroundColor: "#f3f4f6" },
  secondaryText: { color: "#374151", fontSize: 16, fontWeight: "600" },
});
