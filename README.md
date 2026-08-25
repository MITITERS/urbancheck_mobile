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

La cuenta de validador es una **cuenta de trabajo**: solo ve reportes de la
municipalidad que se le asignó, también en el feed y en el mapa. Un reporte de
otra jurisdicción directamente no existe para esa cuenta. Quien además quiera
usar UrbanCheck como vecino se crea una cuenta personal aparte.

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
