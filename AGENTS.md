# Expo HAS CHANGED

Este proyecto corre **Expo SDK 58** (`expo` 58.0.21, `expo-router` 58.0.28,
React Native 0.88.1). Leé los docs de esa versión antes de escribir código:

- https://docs.expo.dev/versions/v58.0.0/
- Expo Router: https://docs.expo.dev/router/introduction/

Verificá la versión real antes de confiar en este archivo:

```bash
node -e "console.log(require('expo/package.json').version)"
```

Si no coincide con lo de arriba, actualizá este archivo: apuntar a los docs de
otra versión es peor que no tener la nota, porque manda a leer una API que acá no
existe.

## Cambios de SDK 57 → 58 que rompen código

Migrado el 30 de octubre de 2026, porque Expo Go para iOS se actualizó a 58 y
Apple no deja instalar una versión anterior.

- **Node 22.13 o más.** `engines` pide `>=22.13.0 <23`, alineado con
  `.nvmrc` y el CI (C-17, lo controla `nodeVersion.test.ts`). SDK 58 también
  acepta Node 24, y con ese se hizo la migración; el Node 20 de nvm no sirve.
- **El encabezado del stack es translúcido por defecto en iOS 26.** El
  contenido arranca debajo de él y queda tapado. El stack de `(app)` fija
  `headerTransparent: false` en `screenOptions`; un stack nuevo con
  encabezado visible necesita lo mismo.
- **`href: null` en una pestaña la vuelve inalcanzable.** Antes solo sacaba
  el botón de la barra; ahora expo-router la marca `hidden` y un `push` a esa
  ruta no hace nada. Para una pestaña que se navega pero no se ve (el detalle
  del reporte) se usa `tabBarItemStyle: { display: "none" }`. Lo cubre
  `reportDetailRoute.test.tsx`.
- **Sin sesión, `/` necesita su propia pantalla.** Con el guard de `(app)` en
  falso, expo-router 58 ya no manda `/` a la primera pantalla permitida: se ve
  "Unmatched Route", y es justo la URL con la que abre Expo Go.
  `app/(auth)/index.tsx` redirige al login.
- **Los refs de `ScrollView` y `TextInput` se tipan con la instancia:**
  `useRef<ScrollViewInstance>` y `useRef<TextInputInstance>`, importados como
  tipos de `react-native`. Los componentes pasaron a ser funciones y
  `useRef<ScrollView>` ya no tiene `scrollTo`.
- **`ColorValue` admite `number` y `null`.** `@expo/vector-icons` 15 todavía
  pide `string`, así que el color que llega a `tabBarIcon` se castea con
  `iconColor()` en `app/(app)/(tabs)/_layout.tsx`.
- **`ListEmptyComponent` y `ListFooterComponent` no aceptan `null`:** la rama
  vacía devuelve `undefined`.
- **`createBottomTabNavigator` no existe más.** Su reemplazo,
  `createStandardBottomTabNavigator`, devuelve un descriptor y no un
  navegador, y `NavigationContainer` ya no se exporta. Para probar un
  layout de pestañas se usa `renderRouter` de `expo-router/testing-library`
  (ver `floatingTabBar.test.tsx`).
- **Jest 30.** Sus tipos son más estrictos con `mockResolvedValue`: el valor
  tiene que coincidir con el tipo de retorno (`Linking.openURL` devuelve
  `void`, `Share.share` exige `activityType`).

## Cambios de SDK 54 → 57 que rompen código

Migrado el 3 de septiembre de 2026. Lo que hay que saber para no reintroducir
los errores:

- **react-navigation ya no es una dependencia.** expo-router 57 lo vendorizó y
  re-exporta la API vieja desde subpaths propios. No instales
  `@react-navigation/*`: `BottomTabBar` y `createBottomTabNavigator` salen de
  `expo-router/js-tabs`, `NavigationContainer` de `expo-router/react-navigation`.
  Los props del `tabBar` no cambiaron.
- **`import { Tabs } from "expo-router"` está deprecado** en favor de
  `expo-router/js-tabs`.
- **`StyleSheet.absoluteFillObject` no existe más**, ni en los tipos ni en
  runtime. Usá `StyleSheet.absoluteFill`, que ahora es un objeto plano y se
  puede spreadear.
- **TypeScript 6 dejó de incluir solo lo que hay en `node_modules/@types`.** Por
  eso `tsconfig.json` declara `"types": ["jest", "node"]`; sin eso los globals
  de la suite no tipan.
- **`jest-expo` ya no trae el preset de React Native**: viene de
  `@react-native/jest-preset`, que está como devDependency.
- **El `fetch` global es el de Expo, y no puede subir archivos.** Ver abajo.

## Subir archivos va por `XMLHttpRequest`, no por `fetch`

Síntoma si alguien lo revierte: **`Unsupported FormDataPart implementation`** al
crear un reporte, editarlo, cambiar el avatar, cerrar un trabajo como operario u
objetar un cierre. O sea, en los cinco lugares donde la app sube un archivo.

`expo/src/winter/runtime.native.ts` reemplaza el `fetch` global por el de Expo.
Ese arma el multipart en JavaScript (`winter/fetch/convertFormData.ts`) y solo
entiende `string`, `Blob` u objetos con `bytes`. La forma propia de React Native
para un archivo local —`{ uri, name, type }`, la que devuelven la cámara y la
galería— **no está contemplada** y cae en el `throw` del final.

**La solución es `upload()` en `src/api/client.ts`**: cuando el cuerpo es un
`FormData`, la petición va por `XMLHttpRequest`, que llega al módulo de red
nativo. Ese sí entiende las partes con `uri` y además transmite el archivo desde
el disco en lugar de cargarlo entero en memoria. Expo no reemplaza XHR.

Los dos transportes comparten `resolveResponse()`, así que una misma respuesta
del servidor produce el mismo error por los dos caminos: un 400 se ve igual haya
foto o no.

### Por qué la variable de entorno no alcanza

Existe `EXPO_PUBLIC_USE_RN_FETCH=1`, que le pide a Expo que no reemplace el
`fetch`. Está puesta en el `.env` y **sirve solo en un build de producción**, no
en Expo Go:

- En un export, Metro **incrusta** el valor y la rama se resuelve en tiempo de
  build. Verificado: `useRnFetch = true` y cero apariciones de `install('fetch'`.
- En **dev**, los valores del `.env` viven en un módulo aparte de Metro que se
  evalúa **después** del runtime de Expo. Cuando este lee
  `process.env.EXPO_PUBLIC_USE_RN_FETCH` todavía vale `undefined`, así que
  instala su `fetch` igual. Se comprobó sobre el bundle vivo: la definición
  aparece en el byte ~7.367.000 y la lectura en el ~3.778.000.

Se deja puesta porque en producción es correcta y es una defensa de más, pero
**el que sostiene la funcionalidad es el camino de XHR**.

**Callejón sin salida ya recorrido:** convertir cada archivo a `Blob` antes de
adjuntarlo. Funciona, pero hay que hacerlo en los cinco lugares y carga la foto
entera en memoria.

**Por qué costó encontrarlo:** `describeApiError` reportaba cualquier `Error`
como "sin conexión", así que el fallo se veía como un problema de red y se
buscaba en el túnel y en el backend, que estaban sanos. Ya está corregido: solo
los fallos de red reales dicen eso, el resto muestra el mensaje verdadero.

## node_modules y iCloud

El repo vive bajo `~/Documents`, que en esta Mac **es iCloud Drive**
(`~/Library/Mobile Documents/com~apple~CloudDocs/Documents` es un symlink a
`~/Documents`). iCloud sincroniza `node_modules`, y cuando entra en conflicto
crea directorios duplicados (`@babel 2`, `@expo 2`) y materializa archivos a
medias.

Los síntomas no se parecen a un problema de sincronización: bundles que fallan
con errores de codegen sobre archivos de React Native que están bien, o
`Cannot find module './utils/env'` desde el CLI de Expo. Antes de perseguir un
bug de versiones, revisá integridad:

```bash
find node_modules -maxdepth 2 -name '* 2' | wc -l      # tiene que dar 0
find node_modules -maxdepth 4 -type d -empty | grep -v '\.bin' | wc -l
```

Si da distinto de cero, no hay nada que depurar: `rm -rf node_modules && npm ci`.

La solución de fondo es mover el proyecto fuera de `~/Documents` (por ejemplo a
`~/dev/`), porque una reinstalación adentro de iCloud se vuelve a corromper.

## Expo Go 57 pide sesión en las dos puntas

"You need to be signed in to Expo Go and Expo CLI to open your project."

**No es config del proyecto.** Se verificó creando un proyecto Expo 57 en
blanco: falla igual. Tampoco es firma de manifiesto — se capturaron las
cabeceras reales del teléfono y Expo Go **no** manda `expo-expect-signature`,
así que el `scopeKey` sale `@anonymous/...` siempre y no hay nada que firmar.
Tampoco es red: el pedido llega y el servidor responde 200.

Lo que pide es literal: `npx expo login` en la Mac **y** sesión iniciada en
Expo Go con la misma cuenta. SDK 54 abría proyectos anónimos sin esto; 57 no.

Callejones sin salida ya recorridos, para no repetirlos:

- **`EXPO_OFFLINE=1` / `--offline`** apagan el túnel
  (`BundlerDevServer.js` chequea esa variable antes de levantarlo).
- **Sacar `owner` y `extra.eas` del manifiesto** vía `app.config.js` no cambia
  nada: se probó, el manifiesto quedaba anónimo y limpio, y Expo Go lo
  rechazaba igual.
- **Desloguear el CLI** empeora las cosas: el mensaje pasa de pedir una punta a
  pedir las dos.

## ESLint

`npm run lint` usa `eslint-config-expo` (configuración plana, en
`eslint.config.js`). Dos cosas para no tropezar:

- **ESLint 9, no 10.** `eslint-plugin-react`, que trae la configuración de Expo,
  todavía no anda con ESLint 10: se cae con
  `contextOrFilename.getFilename is not a function` antes de reportar nada.
- **Trae las reglas del React Compiler** (`react-hooks/refs`,
  `set-state-in-effect`, `purity`, `globals`). Los valores que tienen que
  existir una sola vez por pantalla (`Animated.Value`, `PanResponder`) se crean
  con `useState(() => ...)` y no con `useRef(...).current`. Los `setState`
  dentro de efectos que quedaron tienen un `eslint-disable-next-line` con el
  motivo al lado: cada uno es una sincronización con algo externo (red,
  permisos, teclado) o un reseteo al cambiar de reporte. Uno nuevo lleva su
  motivo o se reescribe.

## Ramas, PR y etiquetas

Es el flujo que se usa de verdad desde el Sprint 1, igual en los tres
repositorios (C-20):

- Cada sprint se trabaja en `feature/sprint-N`, que sale de `develop`.
  Correcciones puntuales sobre un sprint en curso pueden ir en ramas
  `fix/<id>` que salen de esa rama y vuelven a ella con merge.
- Al cerrar el sprint, PR de `feature/sprint-N` a `develop`, que se fusiona con
  merge commit (sin squash ni rebase) con el CI en verde.
- El merge a `develop` se etiqueta con una etiqueta anotada `sprint-N`. Las
  etiquetas se suben de a una (`git push origin sprint-N`), nunca con `--tags`.
- `main` solo recibe releases: `release/x.y.z` sale de `develop`, se fusiona en
  `main`, se etiqueta `vx.y.z` y vuelve a `develop`.
- No se reescribe historia publicada: nada de force push, rebase de ramas
  remotas ni amend de commits ya subidos.
- Commits con Conventional Commits (`feat(scope): ...`, `fix(scope): ...`).

## Gestor de paquetes

**npm.** Hubo un `bun.lock` conviviendo con `package-lock.json`; `expo install`
detectaba el primero e invocaba un `bun` que no está instalado. Si volvés a ver
`spawn bun ENOENT`, es que reapareció.
