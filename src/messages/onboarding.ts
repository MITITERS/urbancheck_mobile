/**
 * Textos del tutorial de bienvenida (US-051).
 *
 * Es el primer archivo de mensajes centralizado de la app: los textos al
 * usuario de pantallas nuevas van acá, en español y sin nombres internos de
 * estados, en vez de quedar sueltos en cada componente.
 */
export const onboardingMessages = {
  steps: {
    welcome: {
      title: "Bienvenido a UrbanCheck",
      body: "Reportá problemas de tu barrio y seguí su resolución junto al municipio.",
    },
    report: {
      title: "Cómo reportar",
      body: "Sacá una foto, elegí la categoría y la ubicación se toma sola.",
    },
    community: {
      title: "La comunidad valida",
      body: "Mirá los reportes en el feed y en el mapa, y sumá tu me gusta a los que conocés.",
    },
    follow: {
      title: "Seguí tu reclamo",
      body: "Te avisamos cada vez que tu reporte cambia de estado.",
    },
  },
  progress: (current: number, total: number) => `Paso ${current} de ${total}`,
  skip: "Omitir",
  next: "Siguiente",
  back: "Anterior",
  start: "Empezar",
  close: "Cerrar",
  profileEntry: "Ver tutorial",
} as const;
