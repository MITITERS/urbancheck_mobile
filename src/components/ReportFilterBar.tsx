import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { ReportCategory, ReportStatus } from "../api/reports";
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  FILTERABLE_STATUS_VALUES,
  STATUS_LABEL,
} from "../reports/labels";

export interface ReportFilterState {
  search: string;
  categories: ReportCategory[];
  statuses: ReportStatus[];
}

export const EMPTY_FILTERS: ReportFilterState = {
  search: "",
  categories: [],
  statuses: [],
};

export function countActiveFilters(filters: ReportFilterState): number {
  return filters.categories.length + filters.statuses.length;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface Props {
  filters: ReportFilterState;
  onChange: (next: ReportFilterState) => void;
  /** Texto opcional bajo la barra, p.ej. el conteo de resultados. */
  resultLabel?: string;
}

/**
 * Barra de búsqueda + filtros por categoría y estado (US-006 y US-020).
 *
 * Compartida por el feed y el mapa para que ambos ofrezcan exactamente el mismo
 * criterio de filtrado. Los chips arrancan colapsados: la búsqueda es la acción
 * frecuente y las listas de chips ocupaban demasiado alto de pantalla.
 */
export default function ReportFilterBar({ filters, onChange, resultLabel }: Props) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActiveFilters(filters);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por palabra clave o zona…"
            placeholderTextColor="#9ca3af"
            value={filters.search}
            onChangeText={(search) => onChange({ ...filters, search })}
            returnKeyType="search"
            autoCorrect={false}
          />
          {filters.search.length > 0 && (
            <Pressable
              onPress={() => onChange({ ...filters, search: "" })}
              hitSlop={10}
              accessibilityLabel="Limpiar búsqueda"
            >
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.filterBtn, (expanded || activeCount > 0) && styles.filterBtnActive]}
          onPress={() => setExpanded((e) => !e)}
          accessibilityLabel="Mostrar filtros"
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={expanded || activeCount > 0 ? "#1a73e8" : "#6b7280"}
          />
          {activeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {expanded && (
        <View style={styles.panel}>
          <Text style={styles.groupLabel}>Categoría</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {CATEGORY_VALUES.map((value) => {
              const active = filters.categories.includes(value);
              return (
                <Pressable
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() =>
                    onChange({ ...filters, categories: toggle(filters.categories, value) })
                  }
                >
                  <Ionicons
                    name={CATEGORY_ICON[value] as never}
                    size={14}
                    color={active ? "#1a73e8" : "#4b5563"}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {CATEGORY_LABEL[value]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.groupLabel, { marginTop: 12 }]}>Estado</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {FILTERABLE_STATUS_VALUES.map((value) => {
              const active = filters.statuses.includes(value);
              return (
                <Pressable
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() =>
                    onChange({ ...filters, statuses: toggle(filters.statuses, value) })
                  }
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {STATUS_LABEL[value]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {activeCount > 0 && (
            <Pressable
              style={styles.clearBtn}
              onPress={() => onChange({ ...filters, categories: [], statuses: [] })}
            >
              <Ionicons name="close" size={14} color="#e53935" style={{ marginRight: 4 }} />
              <Text style={styles.clearBtnText}>Limpiar filtros</Text>
            </Pressable>
          )}
        </View>
      )}

      {resultLabel != null && <Text style={styles.resultLabel}>{resultLabel}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1f2937", padding: 0 },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: { backgroundColor: "#e8f0fe" },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: "#1a73e8",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  panel: { marginTop: 12 },
  groupLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", marginBottom: 6 },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  chipActive: { backgroundColor: "#e8f0fe", borderColor: "#1a73e8" },
  chipText: { fontSize: 12, color: "#4b5563", fontWeight: "500" },
  chipTextActive: { color: "#1a73e8", fontWeight: "700" },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#fce8e6",
  },
  clearBtnText: { color: "#e53935", fontSize: 12, fontWeight: "600" },
  resultLabel: { fontSize: 12, color: "#6b7280", marginTop: 8 },
});
