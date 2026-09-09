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

### Abrir con Expo Go

Expo Go 57 exige que **el CLI y la app estén logueados con la misma cuenta**;
si no, muestra "You need to be signed in to Expo Go and Expo CLI". No depende
del proyecto: pasa igual con uno recién creado.

```bash
npx expo login          # en la Mac
```

Y en Expo Go, iniciar sesión con esa misma cuenta. Como `expo-dev-client` está
instalado, `expo start` arranca en modo development build; `s` pasa a Expo Go, o
`npm run go` lo fuerza y agrega el túnel.

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

> **Android:** `BottomTabBar` trae `elevation: 8` en su propio estilo. La
> elevación de Android dibuja la sombra con la forma del borde del elemento, y
> ese elemento es un rectángulo: se veía una sombra recta cruzando las esquinas
> redondeadas de la isla. Se apaga con `elevation: 0` en `tabBarStyle`, que se
> aplica último y gana. En iOS no se notaba: ahí `elevation` no hace nada.
>
> Los márgenes laterales salen de `useWindowDimensions()` y no de
> `Dimensions.get()`: aquel se lee una sola vez, así que al rotar o en pantalla
> dividida la isla se quedaba con la medida vieja.

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

### El cajón de comentarios va anclado abajo, fuera del scroll

Es el patrón del compositor de cualquier chat, y acá resuelve un problema
concreto: adentro del `ScrollView`, el teclado tapaba lo que se escribía, y
**cuanto más largo era el comentario, peor** —iOS lleva el campo a la vista una
sola vez, al enfocarlo, y después el campo crece hacia abajo con cada renglón—.
Anclado abajo crece hacia arriba, así que el cursor nunca se va debajo del
teclado.

Cuánto se levanta sale de `useKeyboardOffset()`, y **no se decide por
plataforma**. Ese fue el error de la primera versión: daba por sentado que
Android achica la ventana sola con `adjustResize`, y con el modo *edge-to-edge*
—el que Expo activa por defecto desde el SDK 54— eso dejó de ser cierto. La
ventana queda del mismo alto, el teclado se dibuja encima, y el cajón volvía a
quedar tapado.

El hook lo **mide** en vez de deducirlo: compara el alto de la ventana con el
teclado cerrado contra el actual, y descuenta lo que la ventana ya se achicó
sola. Sirve para los tres casos sin un solo `Platform.OS`:

| | La ventana | Se levanta |
| --- | --- | --- |
| iOS | no se achica | el alto del teclado |
| Android *edge-to-edge* | no se achica | el alto del teclado |
| Android `adjustResize` | se achica sola | nada |

Sin teclado, lo que se esquiva es la barra de pestañas flotante.

Al enfocar el campo, la lista se lleva al final: con el teclado abierto el alto
útil es la mitad, y sin eso uno escribe mirando la foto en vez de la
conversación que está respondiendo.

### «Email o contraseña incorrectos» solo cuando lo son

El login mostraba ese mensaje en **todos** los caminos de error: servidor
caído, túnel de desarrollo sin levantar, teléfono sin datos. Mandaba a revisar
la contraseña un problema que no tenía nada que ver.

Ahora se distingue: si el servidor contestó y rechazó las credenciales —el
sobre `errors` de allauth—, se dice eso. Cualquier otra cosa pasa por
`describeApiError()`, que responde «Sin conexión» cuando no se pudo llegar al
servidor. Lo mismo en el alta de cuenta, que además volcaba el error crudo con
`JSON.stringify`.

### La búsqueda de dirección se ancla solo mientras se escribe

En reposo, el campo de dirección es uno más del formulario y **scrollea con
él**. Al tocarlo se ancla sobre el teclado, se escribe ahí, y al cerrarse el
teclado vuelve a su lugar.

Anclarlo siempre —como el cajón de comentarios— tenía el problema opuesto al
que resolvía: un campo pegado abajo que nunca acompaña al formulario se lee
como si no fuera parte de él.

**Son dos elementos, no uno que se mueve.** En el formulario hay un `Pressable`
con la pinta exacta del input, que muestra la dirección elegida o el
placeholder; el `TextInput` de verdad solo existe mientras se escribe, anclado,
y nace con `autoFocus`. Mover un `TextInput` de lugar en el árbol lo desmonta y
le hace perder el foco a mitad de la palabra, así que no se lo mueve: se lo
reemplaza.

Mientras el anclado está abierto, el del formulario **queda vacío** —una caja
apagada, sin texto—. El valor vive en uno solo de los dos a la vez: repetirlo
hacía ver el mismo campo dos veces, uno detrás del otro. La caja se conserva
aunque esté vacía para que el formulario no salte de alto al abrir y cerrar.

El cierre lo maneja el `onBlur` del anclado, que cubre los tres caminos:
terminar de escribir, tocar afuera y el botón atrás de Android. Elegir una
sugerencia llama a `Keyboard.dismiss()`, así que cae por el mismo lado.

Dos detalles:

- **La lista de sugerencias va arriba del input** y crece hacia arriba: debajo
  quedaría tapada por el teclado.
- **El scroll le reserva el alto al anclado mientras está abierto**, medido con
  `onLayout` y no estimado, porque crece con las sugerencias.

### Teclado en los formularios largos

Los formularios con foto no entran en pantalla, y su campo de texto está abajo.
Al abrirse el teclado quedaba tapado y uno escribía a ciegas. Aplica a la
descripción de **crear**, **editar**, el **cierre del operario** (US-046) y el
motivo de la **objeción del vecino** (US-048); la dirección del alta se resolvió
anclándola (arriba).

`KeyboardAvoidingView` no lo resuelve, y era lo que había: hace lugar, pero **no
mueve el scroll hasta el campo enfocado**, así que el campo sigue debajo del
teclado. Encima estaba con `behavior={Platform.OS === "ios" ? "padding" :
undefined}`, o sea que en Android no hacía nada.

Lo reemplaza `useKeyboardAwareScroll()` (`src/components/`), que hace dos cosas:

1. **Le suma al `paddingBottom` del contenido lo que ocupa el teclado.** Sin ese
   espacio el scroll no tiene a dónde ir y el último campo no puede subir.
2. **Mide dónde quedó el campo enfocado y scrollea solo lo que falta.** Si ya se
   ve por encima del teclado, no lo mueve.

No tiene ninguna rama por plataforma: se apoya en `useKeyboardOffset()`, que
**mide** cuánto tapa el teclado en lugar de deducirlo de `Platform.OS`. Eso es
lo que hace que funcione igual en iOS y en Android, incluido el modo
*edge-to-edge* que Expo activa por defecto desde el SDK 54, donde la ventana no
se achica y suponer que sí dejaba el campo debajo del teclado.

La corrección se dispara cuando cambia el alto del teclado, no al enfocar: al
momento del `focus` el teclado todavía no ocupa nada. El salto de un campo a
otro con el teclado ya abierto se corrige aparte, porque ahí el alto no cambia.

**El hook son tres piezas y las tres son obligatorias**: `scrollViewProps` sobre
el `ScrollView`, el `keyboardOffset` sumado a su `paddingBottom`, y el par
`ref` + `onFocus={() => keyboard.focusField(ref)}` sobre el campo. Sin la
tercera el hook no tiene qué revelar y el teclado tapa igual —le pasó a la
edición de reporte, que tenía el `ref` declarado y nunca conectado, y como
TypeScript no marca una variable sin usar, no lo dijo nadie hasta que se
reportó desde la app—. Si agregás un formulario largo, revisá las tres.

### Teclado en los formularios de sesión

Login, registro, olvidé mi contraseña, restablecer y cambiar contraseña siguen
las mismas tres reglas, porque el teclado se quedaba arriba sin forma de
bajarlo:

1. **El formulario va dentro de un `ScrollView`**, aunque entre en pantalla. Es
   lo que da las dos formas de cerrar el teclado que uno espera:
   `keyboardDismissMode="on-drag"` para arrastrar, y
   `keyboardShouldPersistTaps="handled"` para que un toque fuera de los campos
   lo baje y aun así llegue al botón. Sin el scroll no hay dónde enganchar
   ninguna de las dos.
2. **`Keyboard.dismiss()` al enviar.** El teclado ya no tiene nada que hacer, y
   si queda abierto tapa los errores de validación, que se muestran justo debajo
   de cada campo.
3. **El último campo envía**, con `returnKeyType` (`go`, `send`) y
   `onSubmitEditing`: la tecla del teclado hace lo que promete en vez de dejarlo
   abierto.

### Teclado en el detalle del reporte

Dos intentos anteriores, anotados porque explican por qué el cajón terminó
anclado abajo (ver la sección anterior):

1. **`KeyboardAvoidingView`** calculaba de menos: mide su marco relativo al
   padre y lo compara contra coordenadas de pantalla, así que le faltaba el alto
   del header y dejaba el cajón parcialmente debajo del teclado.
2. **`automaticallyAdjustKeyboardInsets`** corregía eso, pero solo al enfocar el
   campo: el cajón seguía dentro del scroll y, al crecer con cada renglón, se
   iba metiendo debajo del teclado.

Lo que sí se conserva, para que el teclado se cierre cuando corresponde:
`keyboardDismissMode="on-drag"` —arrastrar la lista lo baja— y
`Keyboard.dismiss()` después de publicar el comentario. `keyboardShouldPersistTaps`
dejó de ser necesario para «Enviar» —el botón ya no vive dentro del scroll— pero
se mantiene para el resto del contenido tocable.

### Contraseña temporal

Mientras el backend informe `must_change_password: true`, el guard del layout
raíz deja accesible **solo** la pantalla de cambio de contraseña. Vive ahí y no
en cada pantalla para que no se pueda saltear navegando a una ruta directa.

### Las fotos y el túnel de desarrollo

`imageSource()` (en `src/api/client.ts`) es lo que va en el `source` de toda
imagen que sirve el backend. Existe por una trampa del túnel: **ngrok responde
su página de aviso en lugar del archivo** cuando el `User-Agent` parece un
navegador. La foto llega como HTML de 2 KB y no se ve, sin ningún error a la
vista. El header `ngrok-skip-browser-warning` lo saltea.

Solo se agrega cuando la URL de la API es de un túnel: en producción no hay
intermediario que interpretar y el header no viaja.

### La ficha del mapa no es un `Callout`

Tocar un marcador abre una tarjeta propia de la app, abajo, con la foto, el
estado, la dirección y el acceso al detalle. **No se usa el `Callout` de
`react-native-maps`**: en Android ese globo se dibuja como una captura de imagen
y no como vistas, así que el contenido salía en blanco y los toques no llegaban
a lo de adentro —no se podía abrir el reporte—. La tarjeta se comporta igual en
las dos plataformas, y de paso entra la foto, que en el globo no entraba.

La ficha va **última en el árbol**, así se dibuja por encima de la leyenda y de
los botones sin depender de que las medidas de cada uno no se toquen. Y mientras
está abierta, **la leyenda se esconde**: comparten el borde inferior y se
encimaban; con la ficha a la vista el estado del reporte ya está escrito al lado
de su color, así que la leyenda no aporta.

La dirección se muestra con `shortAddress()` —los tres primeros tramos—: el
geocodificador devuelve la jerarquía entera y en una ficha de un renglón esa
cola no informa y empuja el alto.

Tocar el mapa la cierra, con dos resguardos: se ignora el toque que viene
marcado como de un marcador —en Android el mismo gesto llega también al mapa— y
el que llega dentro de los 400 ms de haber elegido uno, porque en iOS el orden
de esos dos eventos no está garantizado y la ficha se abría y se cerraba en el
mismo toque.

Y la selección entra por **dos caminos**: el `onPress` del marcador y el
`onMarkerPress` del mapa. Cuál de los dos dispara depende de la plataforma y de
la versión de `react-native-maps` —en iOS la ficha no aparecía porque el primero
no llegaba—, así que los dos terminan en el mismo `selectMarker()`, que es
idempotente.

### El mapa vive en su propia pestaña

La pestaña **Mapa** muestra todos los reportes geolocalizados que la cuenta
puede ver, con un color por estado y una referencia: el «pendiente de
validación» es el que más importa distinguir, porque es el que hay que salir a
verificar.

La bandeja de validación es **solo una lista**, ordenada por cercanía. Tuvo una
vista de mapa propia y se quitó: era ofrecer dos veces lo mismo, y la pestaña
Mapa ya cumple ese rol para todos los roles por igual.

### Búsqueda y filtros: un solo componente para el feed y el mapa

`ReportFilterBar` la comparten las dos pantallas para que ofrezcan exactamente
el mismo criterio: búsqueda por palabra o zona, y chips de categoría y estado.
Los chips arrancan colapsados —ocupaban demasiado alto y la búsqueda es la
acción frecuente— con un contador de filtros activos sobre el botón.

La búsqueda va con `useDebouncedValue` (400 ms): sin eso habría una petición por
tecla. Los chips no, porque son un toque.

Todo se resuelve **en el servidor**, y se combina con el acotado por ubicación:
la cobertura decide qué municipio se ve y el filtro achica dentro de eso.

El vacío distingue los dos casos, que no significan lo mismo: «todavía no hay
reportes acá» y «ninguno coincide con lo que buscaste» —este último con el atajo
para limpiar la búsqueda—. En el mapa, además, filtrar cierra la ficha abierta
si su marcador ya no está entre los resultados.

> Estas dos pantallas se rehicieron sobre una versión anterior del feed que no
> tenía la barra. El componente venía de la rama de Sprint 2 y se recuperó de
> ahí; ver la nota sobre ramas divergentes al final de este archivo.

### El feed y el mapa muestran el municipio donde estás parado

El vecino ve **solo los reportes de la municipalidad cuya área de cobertura
contiene su ubicación actual**. La app manda la posición en cada carga y el
servidor resuelve la jurisdicción con el mismo criterio con el que le asigna
municipio a un reporte nuevo: así el vecino ve exactamente el municipio al que
le va a llegar lo que reporte.

La regla vale igual para las dos pantallas. Que el mapa se pueda desplazar y
hacer zoom no lo convierte en una ventana a los municipios vecinos: muestra lo
mismo que el feed, en otro formato.

El servidor pide las dos cosas —que el reporte sea de ese municipio y que esté
adentro del radio—, así que un reporte viejo mal asignado tampoco se cuela.

Fuera de toda cobertura el feed viene vacío **y lo dice**. Es una pantalla
propia y no el "no hay reportes aún" de siempre, porque son dos cosas distintas
y el servidor las distingue en la clave `coverage` de la respuesta:
`in_coverage: true` con cero resultados es "todavía no hay reportes en tu
municipio"; `false` es "no estás dentro del radio de ninguna municipalidad
adherida".

Dos cosas quedan **fuera** del acotado, a propósito:

- **"Mis reportes"**: son del autor, no del lugar donde abre la app. Se siguen
  viendo desde cualquier parte.
- **Las cuentas de trabajo**: el validador y el agente ya están atados a su
  municipalidad del lado del servidor, así que la app no les acota nada por
  ubicación. En el feed ni siquiera les pide el permiso; en el mapa sí, pero
  solo para centrar la vista donde están.

Sin permiso de ubicación no se muestran reportes: se explica para qué se
necesita y se ofrece concederlo. Mostrar los de todos los municipios sería
justamente lo contrario de lo que piden estas pantallas.

### El perfil público de otra persona

Tocar un nombre —el autor del reporte, o el de cualquier comentario— abre su
perfil (`app/(app)/user/[id]`). El nombre va en el color de acción, sin
subrayado: se nota que es tocable sin parecer un link de página web.

Qué se ve lo decide el servidor, no la pantalla (US-027). Si la persona tiene el
perfil **en privado**, `date_joined` y `report_count` vuelven nulos y su listado
de reportes vuelve vacío para cualquiera que no sea ella. La pantalla no infiere
nada de esa ausencia: mira `is_public` y lo dice —«Este perfil es privado»— en
lugar de mostrar un perfil a medias sin explicación.

El listado de reportes de un perfil **no se acota por ubicación**, a diferencia
del feed: es la obra de esa persona, no lo que pasa en el barrio de quien mira.

### Las secciones largas se pliegan

Dos por ahora, con el mismo comportamiento: **«Comentarios»** en el detalle del
reporte y **«Mis reportes»** en el perfil. Se toca el encabezado entero —no la
flecha sola, que es chica— y la flecha gira para indicar el estado. El contador
queda a la vista aunque esté plegada.

**Arrancan desplegadas** a propósito: plegada por defecto se lee como que no hay
nada, y el contador del encabezado no alcanza para desmentirlo. El desplegable
existe para achicar la sección cuando la lista se hace larga, no para
esconderla. Plegada tampoco se muestra el estado vacío: la lista está guardada,
no vacía.

### La sección de comentarios se pliega

El encabezado «Comentarios (N)» es un desplegable: se toca y la lista se guarda,
con la flecha girando para indicar el estado. El área tocable es la fila
completa, no la flecha sola.

**Arranca desplegada** a propósito: plegada por defecto se lee como que no hay
comentarios, y el contador del encabezado no alcanza para desmentirlo. El
desplegable existe para achicar la sección cuando la conversación se hace larga,
no para esconderla.

Publicar un comentario con la sección plegada la abre sola: es justo donde el
usuario lo está buscando.

### Borrar un comentario: dos derechos distintos

El tacho aparece en un comentario cuando el servidor manda `can_delete`, y eso
es cierto en dos casos que no son el mismo:

- **Lo escribiste vos**, esté donde esté. Uno se arrepiente de lo que escribió.
- **Está colgado de tu publicación**, aunque lo haya escrito otro. Quien publicó
  el reporte modera lo que le cuelgan.

El municipio no entra: no participa como vecino, y darle la tijera sobre lo que
dicen los vecinos en un reclamo que después va a resolver lo pondría de los dos
lados del mismo caso.

Al borrar, el comentario se saca de la lista en el momento y se descuenta del
contador, sin volver a pedir el reporte entero: lo único que cambió es que ese
comentario ya no está.

### Editar y eliminar: del autor, y con fecha de vencimiento

El detalle muestra **Editar** y **Eliminar** solo cuando el servidor manda
`can_edit: true`, que es a la vez «sos el autor» y «el reporte todavía está en
un estado editable». La app **no replica** esa regla de estados: la consulta.
Cuando deja de ser editable —el municipio tomó el reporte— los botones no
desaparecen sin más: al autor se le dice por qué.

La pantalla de edición toca solo lo que el servidor acepta: descripción,
categoría y foto. **La ubicación no se edita**, y se explica en la propia
pantalla: cambiarla convertiría el reporte en otro distinto y dejaría
inconsistente el historial de estados ya registrado. Si el lugar es otro, va un
reporte nuevo.

La foto solo viaja si se eligió una nueva; si no, no se re-sube el mismo archivo
en cada guardado. Y como en el alta, se re-codifica a JPEG: iOS entrega HEIC
desde la galería y el backend lo rechaza.

Vive fuera de las pestañas (`app/(app)/edit-report/[id]`), como editar perfil: es
una tarea que se abre, se termina y se cierra, no una sección de la app.

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

La mecánica del permiso vive en un solo lugar —`src/location/useCurrentLocation.ts`—
y la comparten la validación en terreno y el feed: lo único que cambia entre
las dos pantallas es el texto con el que explican para qué necesitan la
ubicación.

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

### La bandeja del operario y su alcance (US-044 y US-045)

El operario usa la app con un alcance deliberadamente acotado: ve los reportes
*En proceso* asignados **a su área** y nada más. No accede al feed comunitario,
al mapa general, a los avisos, ni a crear, comentar o dar me gusta.

**La navegación se resuelve por rol en el arranque de sesión**, en
`(tabs)/_layout.tsx`, y no pantalla por pantalla: `isOperator()` gatea con
`Tabs.Protected` el feed, el mapa, los avisos y el detalle del feed, de modo que
esas rutas no existen para él ni escribiéndolas a mano. `participatesAsCitizen()`
ya le sacaba los controles de aporte, porque el operario entra en `WORK_ROLES`.

El **perfil sí se conserva**: es de donde se cierra sesión y se cambia la
contraseña temporal, y sin él la cuenta quedaría encerrada en la app. En lugar
de «Mis reportes» muestra «Trabajos resueltos» (ver abajo); el resto de las
cuentas de trabajo sigue sin sección propia.

El detalle del trabajo es una pantalla propia (`work-report/[id].tsx`) y no la
del feed con condicionales: el operario necesita la foto, la descripción, la
categoría y cómo llegar, sin la mitad de la pantalla escondida. «Cómo llegar»
abre las coordenadas en la app de mapas del dispositivo — `maps:` en iOS,
`geo:` en Android, y Google Maps en el navegador si ninguno resuelve.

`src/api/operator.ts` **no recibe ningún identificador de área**: si lo
recibiera, la app estaría en condiciones de pedir el trabajo de otra. El área y
la municipalidad los resuelve el servidor desde la sesión.

La lista recarga por gesto y al volver a la pestaña, no solo al montarla: un
reporte que sale de *En proceso* tiene que desaparecer de inmediato.

Un `403` por cuenta o área desactivadas trae su propio motivo desde el backend y
se muestra tal cual, en vez de un texto genérico: el operario tiene que entender
por qué no entra.

### Respuestas oficiales: la voz del municipio (US-024)

El detalle del reporte muestra el hilo institucional **antes** del historial y
de los comentarios, con tratamiento visual propio —filete azul, fondo de la
marca, encabezado con el nombre del municipio—. Son tres bloques que no se
pueden confundir: la descripción del vecino, el compromiso del municipio y los
comentarios del vecindario.

Firma la **municipalidad**, no una persona: la identidad del agente que la
publicó no viaja en la respuesta del ciudadano, con el mismo criterio de
protección del personal que se aplica al validador. Solo se ve en el panel.

### El operario ve en su perfil lo que resolvió (US-046)

El vecino ve en su perfil lo que reportó; el operario, lo que cerró. Es la misma
idea —el registro de lo que hizo esta persona— así que comparte la sección
plegable, el resumen de tres cifras y la tarjeta de cada fila, en vez de tener
una pantalla aparte. `isOperator()` decide de cuál de los dos endpoints sale la
lista, y `ProfileReport` es el tipo de fila común: `Report` más un `resolved_at`
opcional, que es lo único que difiere entre las dos listas.

Lo que cambia por rol, y por qué:

- **El resumen cuenta cierres, no reportes**: «Cerrados», «A confirmar» y
  «Confirmados». Un cierre objetado por el vecino (US-048) volvió a *En proceso*
  y solo suma en el total — la acción sobre ese trabajo está en la bandeja, que
  es de donde se lo retoma, y no en el perfil.
- **La fecha de la fila es la del cierre**, no la del reporte: es la que le
  importa al operario y la que el servidor usa para ordenar. Va rotulada
  («Cerrado 05/09/2026») porque en la misma posición el vecino ve otra cosa.
- **Sin me gusta ni comentarios**: son la repercusión entre vecinos y en la fila
  del operario serían ruido.
- **La fila abre `work-report/[id]`** y no el detalle del feed, que la
  navegación le cierra por rol y que además no muestra el parte de cierre ya
  registrado.
- **El vacío lo manda a su bandeja**, no a crear un reporte.

### El cierre se saca con la cámara, no se elige de la galería (US-046)

`close-report/[id].tsx` es la única pantalla de carga de imagen que **no**
ofrece el selector de galería que sí ofrecen el alta y la edición de un reporte.
La evidencia tiene que corresponder al trabajo efectivamente ejecutado, y una
imagen de la galería puede ser de cualquier momento y de cualquier lugar. La
regla es de **esta** pantalla y no de toda foto de evidencia: la apelación de
US-048 sí acepta galería, y por qué está más abajo.

Foto, descripción y ubicación son las tres obligatorias, y por motivos
distintos: sin foto no hay evidencia de que el trabajo se hizo, sin descripción
no se sabe qué se hizo, y sin coordenadas no se puede verificar que quien cierra
estuvo en el lugar.

**La proximidad se verifica antes de subir la foto.** El backend la vuelve a
comprobar y es la fuente de verdad, pero hacer esperar una carga que después se
rechaza es maltratar a alguien que está parado en la calle. Se usa
`getFreshPosition()` y no la lectura de la entrada: es la que se compara contra
las coordenadas del reporte.

El detalle del trabajo recarga al enfocarse y no solo al montarse: se vuelve
desde el formulario de cierre, y el reporte tiene que reflejar que ya se cerró.

### Objetar el cierre: del autor, una sola vez (US-047 y US-048)

La acción aparece según `can_appeal`, que decide el servidor. Son tres
condiciones —ser el autor, estar en el estado correcto y no haber gastado la
única apelación— y replicarlas en la app era garantizar que se fueran
divergiendo con el backend.

El aviso de que es **una sola** está en pantalla antes de enviar, no después: el
segundo cierre del operario es definitivo, y quien objeta tiene que saberlo
mientras decide si le conviene hacerlo ahora.

El plazo restante se muestra junto a la evidencia. Durante esa ventana el
reporte **no** se oculta del feed ni del mapa: se ve con su estado diferenciado
y con la resolución publicada.

**La foto se puede sacar en el momento o elegir de la galería**, igual que en el
alta y en la edición de un reporte, y a diferencia del cierre del operario. Los
dos casos parecen el mismo —una foto que prueba el estado del problema— pero no
lo son: el operario certifica su **propio** trabajo, así que la foto del momento
es parte de esa certificación y va junto con la verificación de que está parado
en el lugar. Quien objeta es el vecino, que se entera del cierre por una
notificación y puede no estar frente al problema en ese momento; exigirle cámara
no agrega garantía y le pone un viaje entre él y su derecho a objetar.

Reemplazar la foto ya elegida ofrece **los dos** orígenes: quien se equivocó no
tiene por qué volver al que usó la primera vez.

### «En proceso (objetado)» no es un estado nuevo

Un reporte reabierto por una apelación vuelve a *En proceso*, el mismo estado
que uno que nunca se cerró. En el feed se veían idénticos, y no lo son: a este
ya lo dieron por resuelto una vez y el vecino no lo aceptó.

`reportStatusLabel()` (`src/reports/labels.ts`) agrega la aclaración cuando el
reporte está *En proceso* y tiene apelaciones. **La máquina de estados no se
tocó** —sigue teniendo siete estados—: la aclaración es el motivo por el que
está donde está, no un estado más.

Vive ahí y no en cada pantalla porque son **seis** las que pintan el estado de
un reporte concreto —feed, detalle, línea de tiempo, popup del mapa, perfil
propio y perfil de otra persona—, y repartida terminaría aclarándolo en unas y
en otras no. `STATUS_LABEL` a secas queda para lo que nombra un estado en
abstracto: la leyenda del mapa, los pasos de la línea de tiempo y los filtros.

De paso se borraron tres copias locales de `STATUS_LABEL` que vivían en el feed,
el perfil y el detalle. **La del feed nunca se había actualizado**, así que un
reporte pendiente de confirmación mostraba ahí el valor crudo del backend.

### Quién objetó: segunda persona solo para el autor

La objeción la ve cualquier vecino que abra el reporte, no solo quien la hizo.
El cartel decía *«Objetaste este cierre»* a todo el mundo, y el plazo decía
*«tenés tiempo de objetar»* a quien no podía hacerlo.

Ahora el autor lee la acción que puede tomar y el resto lee el estado del
trámite: *«El vecino que reportó objetó el cierre»*. Quien objeta es siempre el
autor —US-048 no habilita a nadie más—, así que para el resto alcanza con
nombrarlo sin exponer identidad.

### Tres bloques que no se pueden confundir

El detalle del reporte tiene ahora cuatro cosas que decir sobre el mismo caso, y
cada una con su tratamiento: la **descripción del vecino**, la **resolución del
municipio** (verde, firmada por el área operativa), la **objeción del autor**
(roja, colgando de la resolución que objeta) y las **respuestas oficiales**
(azules, firmadas por la municipalidad). Los comentarios van al final.

La identidad del operario **no** aparece en ninguna: ante el vecino responde el
área, con el mismo criterio de protección del personal municipal que se aplica
al validador y al agente. Quién fue se ve únicamente en el panel.

## Nota: `feature/sprint-3` no salió de `develop`

Esta rama arranca de un punto **anterior** al merge de Sprint 2 en `develop`, así
que hay trabajo que existe en `develop` y no acá. Se descubrió al notar que la
barra de búsqueda del feed «había desaparecido»: nunca estuvo en esta rama.

Lo que quedó del otro lado, en `origin/develop`:

| Commit | Qué trae |
| --- | --- |
| `89104c0` | Búsqueda y filtros del feed y el mapa (`ReportFilterBar`) |
| `ce3aefb` | Marcadores por categoría y ubicación actual en el mapa |
| `e7fb9b1` | Editar y eliminar el reporte propio, y borrar comentarios |
| `c53f8ed` | Perfil público de otro usuario y control de privacidad |
| `1baeb4a` | Bandeja de avisos con badge de no leídos |
| `2e949f1` | Reencuadrar el mapa sobre los resultados al filtrar |
| `3215a09` | Cerrar el teclado al arrastrar la lista |
| `9622628` | Alto fijo del botón Enviar en comentarios |

Varias de esas funciones **se reimplementaron acá desde cero** sin saber que ya
existían. La barra de filtros, en cambio, se recuperó de `89104c0` y se adaptó.

Antes de seguir sumando trabajo a esta rama conviene decidir qué pasa con la
otra: un merge de `develop` va a chocar en los mismos archivos, y cuanto más
tiempo pase, peor. Comparar `git log --oneline origin/develop ^HEAD` da la lista
completa.
