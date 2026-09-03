# Expo HAS CHANGED

Este proyecto corre **Expo SDK 57** (`expo` 57.0.19, `expo-router` 57.0.18,
React Native 0.86.3). Leé los docs de esa versión antes de escribir código:

- https://docs.expo.dev/versions/v57.0.0/
- Expo Router: https://docs.expo.dev/router/introduction/

Verificá la versión real antes de confiar en este archivo:

```bash
node -e "console.log(require('expo/package.json').version)"
```

Si no coincide con lo de arriba, actualizá este archivo: apuntar a los docs de
otra versión es peor que no tener la nota, porque manda a leer una API que acá no
existe.

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

## Gestor de paquetes

**npm.** Hubo un `bun.lock` conviviendo con `package-lock.json`; `expo install`
detectaba el primero e invocaba un `bun` que no está instalado. Si volvés a ver
`spawn bun ENOENT`, es que reapareció.
