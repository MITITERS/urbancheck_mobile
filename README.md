# UrbanCheck — App móvil

Aplicación de ciudadanos y validadores de UrbanCheck (Expo + React Native +
TypeScript). El panel municipal es otro repositorio (`urbancheck_frontend`) y la
API vive en `urbancheck_backend`.

## Levantar el proyecto

```bash
npm install
npx expo start
```

`EXPO_PUBLIC_API_URL` define el backend (por defecto `http://localhost:8000`).

```bash
npm test          # jest-expo
npx tsc --noEmit  # typecheck
```

## Roles

La plataforma tiene cuatro roles: `ciudadano`, `validador`, `agente_municipal` y
`admin_plataforma`. **Esta app es para los dos primeros**; los municipales
trabajan desde el panel web.

Las cuentas de **validador** y de **agente municipal** son **cuentas de
trabajo**: solo ven reportes de la municipalidad que se les asignó, también en el
feed y en el mapa. Un reporte de otra jurisdicción directamente no existe para
esas cuentas. Quien además quiera usar UrbanCheck como vecino se crea una cuenta
personal aparte.

El filtro lo aplica el backend, así que la app no tiene que saber nada: pide el
feed como siempre y recibe solo lo que corresponde.

## Decisiones técnicas

### Capacidad de validar: una sola regla

`canValidate()` (`src/api/users.ts`) y `canValidateReport()`
(`src/validation/canValidateReport.ts`) son los dos únicos lugares donde se
decide si se muestran las acciones de validación. **El backend vuelve a
verificarlo en cada request y es la fuente de verdad**; estas funciones solo
deciden qué se dibuja.

La baja lógica del validador (`is_validator_active`) no viaja en el perfil, así
que un validador desactivado ve la opción y recibe un `403` al usarla. Por eso
las pantallas manejan ese error en vez de confiar en el cálculo local.

### Solo el vecino participa: reportar, comentar y dar me gusta

Las cuentas de trabajo operan el circuito en vez de usarlo: el validador
verifica en terreno, el agente gestiona desde el panel y el administrador opera
la plataforma. Un aporte propio las pondría de los dos lados del mismo caso.

`participatesAsCitizen()` (`src/api/users.ts`) es la única regla del lado del
cliente, y la consumen tres lugares:

| Dónde | Qué se esconde |
|---|---|
| `(tabs)/_layout.tsx` | la pestaña **Reportar**, con `Tabs.Protected` |
| `report/[id].tsx` | el botón de me gusta y el cajón de comentarios |
| `(tabs)/profile.tsx` | la sección **Mis reportes** |

**Leer no está alcanzado.** Lo que se esconde son los controles de aporte, no el
contenido: el personal municipal sigue viendo el feed, el mapa, el detalle y los
comentarios de los vecinos. En el detalle el contador de me gusta se sigue
mostrando —es información del reporte—; lo que se saca es poder tocarlo.

En el perfil no se oculta una lista vacía: se oculta la sección entera, porque
«Mis reportes» pertenece a la cuenta de vecino y mostrarla vacía es prometer algo
que esa cuenta no va a poder llenar. Tampoco se piden los reportes, que es una
request menos en cada entrada.

A diferencia de validar, acá **alcanza con el rol**: el estado de la cuenta no la
habilita de vuelta, porque sigue siendo de trabajo. Como el rol sí viaja en el
perfil, cliente y backend deciden lo mismo y no hay una pantalla que muestre la
opción para después fallar.

`WORK_ROLES` en `src/api/users.ts` es el espejo de `User.WORK_ROLES` del backend.
Si allá se agrega un rol, hay que agregarlo acá o la app va a ofrecer una opción
que después falla con `403`.

### El badge de la campana

El número de avisos sin leer vive en un contexto
(`src/notifications/UnreadContext.tsx`) montado en el layout del área
autenticada, no en la pantalla de avisos: el badge tiene que poder mostrarse
justamente cuando esa pantalla no está montada.

El número lo da `/api/notifications/unread_count/` y **no** la lista cargada. La
bandeja está paginada, así que contar lo que hay en pantalla daría de menos en
cuanto haya más de una página.

Como todavía no hay push (`send_push()` es un stub en el backend), la única
forma de enterarse de un aviso nuevo sin abrir la bandeja es preguntar cada
tanto: se refresca al montar, cada `UNREAD_POLL_INTERVAL_MS` mientras la app
está en primer plano, al volver del segundo plano y cada vez que la pestaña de
avisos toma el foco. Cuando haya push, esto se reemplaza por el evento.

Dos detalles que no son evidentes:

- `formatUnreadBadge()` devuelve `undefined` sin avisos pendientes. Con `0` o
  `""` react-navigation dibuja el globo igual, vacío, y queda un punto rojo
  permanente sobre la campana.
- Marcar un aviso leído ajusta el contador de forma optimista y descarta las
  respuestas de `refresh` que quedaron en vuelo. Sin eso, un refresh viejo
  contestando tarde devuelve el badge al número anterior con el aviso ya leído.

### La barra de pestañas flota: el espacio se reserva a mano

La «isla» inferior está posicionada en absoluto sobre el contenido, así que no
le quita alto a las pantallas: cada una tiene que reservarse ese espacio o su
último elemento queda tapado. La isla y sus medidas viven juntas en
`src/components/floatingTabBar.tsx`, y las consume tanto el layout que dibuja la
barra como las pantallas que se corren, para que no puedan divergir en silencio.

Una pantalla scrolleable usa `useFloatingTabBarInset()` como `paddingBottom` de
su `contentContainerStyle`.

Dos reglas de la isla que no se pueden romper sin borrar el badge de la campana:

- **El safe area se cuenta una sola vez.** La isla ya se levanta por encima del
  home indicator, pero `BottomTabBar` agrega además su propio
  `paddingBottom: insets.bottom`. Con el `height` y el `paddingTop` que fija
  `tabBarStyle`, esos ~34px de más dejaban 23px de alto útil para íconos de 28.
  Por eso se le pasan los insets con el `bottom` en cero.
- **Nada de `overflow: "hidden"`.** El badge se dibuja en `top: -3` respecto del
  ícono, o sea deliberadamente fuera de su caja: recortar el contenedor lo borra.
  Las esquinas redondeadas y el fondo los pinta la isla, y la barra va
  transparente encima.

Los tests de `src/components/__tests__/floatingTabBar.test.tsx` miran el estilo
efectivo de los contenedores, no si el badge está en el árbol: estando recortado
igual aparece en el árbol, que es lo que hizo que el bug pasara desapercibido.

### Teclado en el detalle del reporte

El cajón de comentarios está al final de un `ScrollView` con header arriba. Ahí
`KeyboardAvoidingView` calcula de menos —mide su marco relativo al padre y lo
compara contra coordenadas de pantalla, así que le falta el alto del header— y
dejaba el cajón parcialmente debajo del teclado. Se reemplazó por
`automaticallyAdjustKeyboardInsets` (iOS ajusta el inset solo, sin que haya que
pasarle el alto del header); en Android lo resuelve el `adjustResize` de la
ventana.

Para que el teclado se cierre cuando corresponde: `keyboardDismissMode="on-drag"`
—arrastrar la lista lo baja—, `keyboardShouldPersistTaps="handled"` —sin esto el
primer toque sobre «Enviar» solo cierra el teclado y hay que tocar dos veces— y
`Keyboard.dismiss()` después de publicar el comentario.

Mientras el teclado está abierto el espacio de la barra deja de reservarse: la
barra ya está tapada y, si se mantuviera, el cajón flotaría lejos del teclado.

### Contraseña temporal

Mientras el backend informe `must_change_password: true`, el guard del layout
raíz deja accesible **solo** la pantalla de cambio de contraseña. Vive ahí y no
en cada pantalla para que no se pueda saltear navegando a una ruta directa.

### El mapa vive en su propia pestaña

La pestaña **Mapa** muestra todos los reportes geolocalizados que la cuenta
puede ver, con un color por estado y una referencia: el «pendiente de
validación» es el que más importa distinguir, porque es el que hay que salir a
verificar.

La bandeja de validación es **solo una lista**, ordenada por cercanía. Tuvo una
vista de mapa propia y se quitó: era ofrecer dos veces lo mismo, y la pestaña
Mapa ya cumple ese rol para todos los roles por igual.

### Ubicación

La bandeja de pendientes pide la ubicación **una vez** al entrar y la usa para
que el backend ordene por cercanía; sin permiso, la pantalla funciona igual y se
ordena por fecha.

La acción de validar, en cambio, toma una posición **fresca y de alta
precisión** en el momento de ejecutarse: una posición cacheada de hace minutos
no prueba que el validador esté en el lugar.

Los tres estados del permiso —concedido, denegado y denegado de forma
permanente— se manejan explícitamente, y sin ubicación las acciones se muestran
**deshabilitadas con su razón**, no ocultas: esconderlas dejaría al validador
sin saber por qué no puede trabajar.

### Limitación conocida: ubicación simulada

**La verificación por GPS es falsificable** con aplicaciones de ubicación
simulada. En esta iteración no se implementa detección de ubicación falsa.

El control es disuasivo y se apoya en dos cosas: los validadores son personal
designado por el municipio, y cada validación queda registrada con su autor en
el historial del reporte, que es auditable. La distancia se verifica siempre en
el backend contra las coordenadas del reporte —nunca se confía en un cálculo
hecho en el dispositivo—, pero eso protege contra un cliente modificado, no
contra un GPS falsificado.

### Notificaciones

La bandeja muestra los avisos sociales (comentarios y likes) y los de cambio de
estado del reporte, con ícono propio por tipo y un contador de no leídos que
incluye ambos.

Las preferencias (`app/(app)/notification-preferences.tsx`) recorren el catálogo
de tipos que devuelve el backend, así que **un tipo nuevo aparece en la pantalla
solo**, sin tocar el código de la app. Desactivar un tipo **suprime el push,
no la bandeja**: el aviso igual queda para consultar, que es el comportamiento
menos sorpresivo y el que menos riesgo tiene de que el vecino se pierda
información de su propio reclamo.
