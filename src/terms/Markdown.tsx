import { marked, type Token, type Tokens } from "marked";
import { Fragment, useMemo, type ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

/**
 * Markdown de los términos y la política de privacidad (RN-10).
 *
 * `marked` solo parsea; el dibujo es propio, con `Text` y `View`, para no sumar
 * dependencias nativas que Expo Go no trae. Cubre lo que usan los documentos:
 * títulos, párrafos, negritas, itálicas, listas, tablas, citas, separadores y
 * enlaces. Un elemento que no está acá se muestra como texto plano, nunca se
 * pierde.
 */
export function Markdown({ children }: { children: string }) {
  const tokens = useMemo(() => marked.lexer(children), [children]);
  return <View>{renderBlocks(tokens)}</View>;
}

function renderBlocks(tokens: Token[]): ReactNode[] {
  return tokens.map((token, i) => <Fragment key={i}>{renderBlock(token)}</Fragment>);
}

function renderBlock(token: Token): ReactNode {
  switch (token.type) {
    case "heading": {
      const { depth, tokens } = token as Tokens.Heading;
      const style = depth === 1 ? styles.h1 : depth === 2 ? styles.h2 : styles.h3;
      return (
        <Text style={style} accessibilityRole="header">
          {renderInline(tokens)}
        </Text>
      );
    }
    case "paragraph":
      return <Text style={styles.paragraph}>{renderInline((token as Tokens.Paragraph).tokens)}</Text>;
    case "text": {
      // Texto suelto de bloque: el contenido de un ítem de lista "apretada".
      const { tokens, text } = token as Tokens.Text;
      return <Text style={styles.paragraph}>{tokens ? renderInline(tokens) : text}</Text>;
    }
    case "list": {
      const { ordered, start, items } = token as Tokens.List;
      const first = typeof start === "number" ? start : 1;
      return (
        <View style={styles.list}>
          {items.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>{ordered ? `${first + i}.` : "•"}</Text>
              <View style={styles.listBody}>{renderBlocks(item.tokens)}</View>
            </View>
          ))}
        </View>
      );
    }
    case "table": {
      const { header, rows } = token as Tokens.Table;
      return (
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            {header.map((cell, i) => (
              <Text key={i} style={[styles.cell, styles.headerCell]}>
                {renderInline(cell.tokens)}
              </Text>
            ))}
          </View>
          {rows.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((cell, i) => (
                <Text key={i} style={styles.cell}>
                  {renderInline(cell.tokens)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    }
    case "blockquote":
      return (
        <View style={styles.quote}>{renderBlocks((token as Tokens.Blockquote).tokens)}</View>
      );
    case "hr":
      return <View style={styles.hr} />;
    case "code":
      return <Text style={[styles.paragraph, styles.code]}>{(token as Tokens.Code).text}</Text>;
    case "space":
      return null;
    default:
      return "text" in token ? <Text style={styles.paragraph}>{String(token.text)}</Text> : null;
  }
}

function renderInline(tokens: Token[] | undefined): ReactNode[] {
  return (tokens ?? []).map((token, i) => <Fragment key={i}>{renderSpan(token)}</Fragment>);
}

function renderSpan(token: Token): ReactNode {
  switch (token.type) {
    case "strong":
      return <Text style={styles.strong}>{renderInline((token as Tokens.Strong).tokens)}</Text>;
    case "em":
      return <Text style={styles.em}>{renderInline((token as Tokens.Em).tokens)}</Text>;
    case "codespan":
      return <Text style={styles.code}>{(token as Tokens.Codespan).text}</Text>;
    case "link": {
      const { href, tokens } = token as Tokens.Link;
      return (
        <Text
          style={styles.link}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(href).catch(() => {})}
        >
          {renderInline(tokens)}
        </Text>
      );
    }
    case "br":
      return "\n";
    case "text": {
      const { tokens, text } = token as Tokens.Text;
      return tokens ? renderInline(tokens) : text;
    }
    default:
      return "text" in token ? String(token.text) : "";
  }
}

const BODY = "#374151";

const styles = StyleSheet.create({
  h1: { fontSize: 20, fontWeight: "bold", color: "#111827", marginBottom: 8 },
  h2: { fontSize: 17, fontWeight: "bold", color: "#111827", marginTop: 16, marginBottom: 6 },
  h3: { fontSize: 15, fontWeight: "bold", color: "#111827", marginTop: 12, marginBottom: 4 },
  paragraph: { fontSize: 15, color: BODY, lineHeight: 22, marginBottom: 8 },
  strong: { fontWeight: "bold" },
  em: { fontStyle: "italic" },
  code: { fontFamily: "Courier" },
  link: { color: "#1a73e8", textDecorationLine: "underline" },
  list: { marginBottom: 8 },
  listItem: { flexDirection: "row" },
  bullet: { width: 22, fontSize: 15, color: BODY, lineHeight: 22 },
  listBody: { flexShrink: 1 },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#d1d5db",
    borderRadius: 6,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#d1d5db",
  },
  headerRow: { backgroundColor: "#f3f4f6" },
  cell: { flex: 1, padding: 8, fontSize: 13, color: BODY, lineHeight: 18 },
  headerCell: { fontWeight: "bold", color: "#111827" },
  quote: {
    borderLeftWidth: 3,
    borderColor: "#1a73e8",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingTop: 8,
    marginBottom: 12,
    borderRadius: 4,
  },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: "#d1d5db", marginVertical: 16 },
});
