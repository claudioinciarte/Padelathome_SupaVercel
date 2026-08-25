---
version: 4.0-volt-sport-dual
name: Padel@Home
description: >-
  Sistema de diseño de la web de Padel@Home — reserva de pistas.
  Estética deportiva "Volt" adaptada para Modos Claro y Oscuro.
  Acento amarillo neón (#CCFF00) como color central de acción, tipografía
  enérgica (Manrope ExtraBold) y alto contraste (WCAG) asegurando texto negro
  sobre el color primario en ambos modos.
colors:
  # VolT — constante en ambos modos
  primary: "#CCFF00"
  on-primary: "#000000"

  # Modo Claro
  background-light: "#F4F4F5"
  surface-light: "#FFFFFF"
  text-primary-light: "#09090B"
  text-muted-light: "#71717A"
  border-light: "#E4E4E7"
  status-available-light: "#16A34A"
  status-open-light: "#D97706"
  status-booked-light: "#A1A1AA"

  # Modo Oscuro (Fondo Carbón)
  background-dark: "#121212"
  surface-dark: "#1E1E24"
  text-primary-dark: "#FFFFFF"
  text-muted-dark: "#A1A1AA"
  border-dark: "#27272A"
  status-available-dark: "#4ADE80"
  status-open-dark: "#FBBF24"
  status-booked-dark: "#52525B"

  status-error: "#FF3333"
typography:
  display:
    fontFamily: Manrope
    fontWeight: 800
    textTransform: uppercase
    letterSpacing: "-0.04em"
  headline:
    fontFamily: Manrope
    fontWeight: 800
    letterSpacing: "-0.02em"
  body:
    fontFamily: Inter
    fontWeight: 400
  label:
    fontFamily: Inter
    fontWeight: 600
    textTransform: uppercase
    letterSpacing: "0.05em"
rounded:
  DEFAULT: 12px
  lg: 16px
  full: 9999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    fontWeight: 800
    textTransform: uppercase
    boxShadowDark: "0 4px 16px rgba(204, 255, 0, 0.2)"
  button-secondary:
    backgroundColor: "transparent"
    rounded: "{rounded.full}"
    textTransform: uppercase
  card:
    # claro: surface-light + border-light; oscuro: surface-dark + border-dark
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  status-indicator:
    backgroundColor: "transparent"
    fontWeight: 600
    textTransform: uppercase
    requiresIcon: true
---

## Overview: Estética Deportiva "Volt" (Dual Theme)

Sistema de diseño que unifica la agresividad deportiva en ambos ecosistemas
visuales (Claro y Oscuro). El color central, **Amarillo Neón / Volt
(#CCFF00)**, se mantiene inmutable en ambos modos como ancla de marca: la
acción principal ("Reservar") es siempre instintiva y el punto focal.

## Reglas Clave (WCAG)

* **Botón Principal Intocable:** sobre el fondo `#CCFF00`, el texto es
  **siempre negro `#000000`**. Ni gris, ni blanco.
* **Nada de Pastillas Sólidas (No Pills):** los estados de la pista no llevan
  color de fondo; solo un icono + texto coloreado.
* **Tipografía Estructural:** `Manrope` en ExtraBold (800) y mayúsculas en
  títulos y CTA para que la jerarquía soporte el estilo deportivo.
* **Glow:** el botón Volt y el día activo del calendario llevan `box-shadow`
  sutil color Volt (se extiende más en modo oscuro, más concentrado en claro).
* **Elevación vs Bordes:** en Claro las tarjetas usan borde sutil + sombra casi
  invisible; en Oscuro las sombras desaparecen y la estructura se apoya solo en
  bordes asfalto (`#27272A`).

## Implementación Técnica (Tailwind)

La fuente de verdad de los colores/fuentes/radios es `tailwind.config.js`;
el CSS se compila con `npm run css:build` a `public/tailwind.css` (no editar
ese archivo a mano). Lo que hay que mantener al editar páginas:

* **Ambos modos vía `dark:`:** cada fondo/borde/texto debe tener su par
  claro y oscuro (ej. `bg-surface-light dark:bg-surface-dark`,
  `text-status-available dark:text-status-available-dark`).
* **CTA primario:** usar `bg-primary text-on-primary rounded-full uppercase
  shadow-volt` (o la clase `.btn-volt` ya definida).
* **Escala neutra** slate/gray/zinc está remapeada a carbón, así que las
  utilidades heredadas (`bg-slate-800`, `text-gray-300`, etc.) ya apuntan a la
  estética Volt.
* **Estados**: Disponible verde, Abierta ámbar, Ocupado/Llena gris apagado,
  Mi reserva volt, Lista púrpura suave — solo texto + icono, sin fondo.