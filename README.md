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

### Teclado en los formularios largos: crear y editar reporte

Los formularios de reporte no entran en pantalla, y sus campos de texto están
abajo. Al abrirse el teclado quedaban tapados y uno escribía a ciegas. Aplica a
la descripción de crear y de editar; la dirección se resolvió anclándola (arriba).

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
