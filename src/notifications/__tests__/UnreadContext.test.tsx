import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AppState } from "react-native";

import { getUnreadCount } from "../../api/notifications";
import {
  UNREAD_BADGE_CAP,
  UnreadProvider,
  formatUnreadBadge,
  useUnread,
} from "../UnreadContext";

jest.mock("../../api/notifications", () => ({
  getUnreadCount: jest.fn(),
}));

const mockedGetUnreadCount = getUnreadCount as jest.MockedFunction<
  typeof getUnreadCount
>;

function wrapper({ children }: { children: ReactNode }) {
  return <UnreadProvider>{children}</UnreadProvider>;
}

function renderUnread() {
  return renderHook(useUnread, { wrapper });
}

beforeEach(() => {
  mockedGetUnreadCount.mockResolvedValue({ unread: 0 });
});

describe("formatUnreadBadge", () => {
  it("no dibuja badge sin avisos pendientes", () => {
    // `0` o `""` alcanzan para que react-navigation dibuje el globo vacío: para
    // que no haya badge tiene que ser `undefined`.
    expect(formatUnreadBadge(0)).toBeUndefined();
  });

  it("muestra el número tal cual mientras entra", () => {
    expect(formatUnreadBadge(1)).toBe("1");
    expect(formatUnreadBadge(UNREAD_BADGE_CAP)).toBe(String(UNREAD_BADGE_CAP));
  });

  it("corta en 99+ cuando no entra", () => {
    expect(formatUnreadBadge(UNREAD_BADGE_CAP + 1)).toBe(
      `${UNREAD_BADGE_CAP}+`,
    );
    expect(formatUnreadBadge(4321)).toBe(`${UNREAD_BADGE_CAP}+`);
  });
});

describe("UnreadProvider", () => {
  it("le pregunta el contador al backend al montarse", async () => {
    mockedGetUnreadCount.mockResolvedValue({ unread: 7 });

    const { result } = renderUnread();

    await waitFor(() => expect(result.current.unread).toBe(7));
  });

  it("no rompe si el pedido falla: deja el contador como estaba", async () => {
    mockedGetUnreadCount.mockRejectedValue(new Error("sin red"));

    const { result } = renderUnread();

    await waitFor(() => expect(mockedGetUnreadCount).toHaveBeenCalled());
    expect(result.current.unread).toBe(0);
  });

  it("descuenta de a uno al abrir un aviso, sin esperar al servidor", async () => {
    mockedGetUnreadCount.mockResolvedValue({ unread: 3 });
    const { result } = renderUnread();
    await waitFor(() => expect(result.current.unread).toBe(3));

    act(() => result.current.applyUnreadDelta(-1));

    expect(result.current.unread).toBe(2);
  });

  it("nunca baja de cero", async () => {
    const { result } = renderUnread();
    await waitFor(() => expect(mockedGetUnreadCount).toHaveBeenCalled());

    act(() => result.current.applyUnreadDelta(-5));

    expect(result.current.unread).toBe(0);
  });

  it("lo pone en cero al marcar todo", async () => {
    mockedGetUnreadCount.mockResolvedValue({ unread: 12 });
    const { result } = renderUnread();
    await waitFor(() => expect(result.current.unread).toBe(12));

    act(() => result.current.clearUnread());

    expect(result.current.unread).toBe(0);
  });

  it("una respuesta en vuelo no pisa un ajuste posterior", async () => {
    // El caso real: el badge dice 3, el usuario abre un aviso y queda en 2, y
    // recién ahí contesta un `refresh` que había salido antes y traía 3. Sin
    // descartarla, el badge volvería a 3 con el aviso ya leído.
    let resolvePending: (value: { unread: number }) => void = () => {};
    mockedGetUnreadCount.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePending = resolve;
      }),
    );

    const { result } = renderUnread();
    act(() => result.current.applyUnreadDelta(2));
    act(() => resolvePending({ unread: 3 }));

    await waitFor(() => expect(result.current.unread).toBe(2));
  });

  it("vuelve a preguntar cuando la app pasa a primer plano", async () => {
    const listeners: ((state: string) => void)[] = [];
    const spy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, handler) => {
        listeners.push(handler as (state: string) => void);
        return { remove: jest.fn() } as never;
      });

    mockedGetUnreadCount.mockResolvedValue({ unread: 1 });
    const { result } = renderUnread();
    await waitFor(() => expect(result.current.unread).toBe(1));

    mockedGetUnreadCount.mockResolvedValue({ unread: 4 });
    act(() => listeners.forEach((listener) => listener("active")));

    await waitFor(() => expect(result.current.unread).toBe(4));
    spy.mockRestore();
  });

  it("no pregunta al pasar a segundo plano", async () => {
    const listeners: ((state: string) => void)[] = [];
    const spy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, handler) => {
        listeners.push(handler as (state: string) => void);
        return { remove: jest.fn() } as never;
      });

    const { result } = renderUnread();
    await waitFor(() => expect(mockedGetUnreadCount).toHaveBeenCalledTimes(1));

    act(() => listeners.forEach((listener) => listener("background")));

    expect(mockedGetUnreadCount).toHaveBeenCalledTimes(1);
    expect(result.current.unread).toBe(0);
    spy.mockRestore();
  });
});
