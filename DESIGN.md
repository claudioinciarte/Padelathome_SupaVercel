---
version: vercel-aligned-dual
name: Padel@Home
description: >-
  Sistema de diseño de la web de Padel@Home — reserva de pistas.
  Alineado con Vercel Web Interface Guidelines (excepto tipografía).
  Foco en accesibilidad extrema, gestión del teclado, animaciones rápidas (150ms)
  y minimalismo funcional (Geist-like UI). Soporte definido para modos Claro y Oscuro.
colors:
  primary: "#2563EB"
  primary-dark: "#60A5FA"
  primary-hover: "#1D4ED8"
  on-primary: "#FFFFFF"
  on-primary-dark: "#000000"
  brand: "#006E37"
  background-light: "#FAFAFA"
  background-dark: "#000000"
  surface-light: "#FFFFFF"
  surface-dark: "#0A0A0A"
  text-primary-light: "#111827"
  text-primary-dark: "#EDEDED"
  text-muted-light: "#666666"
  text-muted-dark: "#888888"
  border-light: "#EAEAEA"
  border-dark: "#333333"
  success-available: "#16A34A"
  success-available-dark: "#4ADE80"
  warning-open: "#F59E0B"
  warning-open-dark: "#FBBF24"
  danger-error: "#E00"
  blocked: "#888888"
typography:
  display:
    fontFamily: Manrope
    fontWeight: 700
    letterSpacing: "-0.04em"
  body:
    fontFamily: Inter
    fontWeight: 400
transitions:
  default: "150ms ease-out"
  motion-reduce: "0ms"
components:
  focus-ring:
    boxShadow: "0 0 0 2px {colors.background-light}, 0 0 0 4px {colors.primary}"
    outline: "none"
  button-primary:
    backgroundColorLight: "{colors.primary}"
    backgroundColorDark: "{colors.primary-dark}"
    textColorLight: "{colors.on-primary}"
    textColorDark: "{colors.on-primary-dark}"
    rounded: "6px"
    transition: "{transitions.default}"
  button-secondary:
    backgroundColor: "transparent"
    borderColorLight: "{colors.border-light}"
    borderColorDark: "{colors.border-dark}"
    textColorLight: "{colors.text-primary-light}"
    textColorDark: "{colors.text-primary-dark}"
    rounded: "6px"
  card:
    backgroundColorLight: "{colors.surface-light}"
    backgroundColorDark: "{colors.surface-dark}"
    borderColorLight: "{colors.border-light}"
    borderColorDark: "{colors.border-dark}"
    borderWidth: "1px"
    rounded: "12px"
    boxShadowLight: "0 2px 4px rgba(0,0,0,0.02)"
    boxShadowDark: "none"
---

## Overview: Vercel Best Practices (Dual Mode)

Sistema que aplica los principios de diseño de Vercel manteniendo las
tipografías originales (Manrope/Inter) con soporte explícito para temas claro
y oscuro. Prioriza la interfaz como herramienta de ingeniería: elimina ruido
visual y apuesta por rendimiento, accesibilidad y control por teclado.

## Reglas Clave (WCAG / Vercel)

* **Focus Management**: todo elemento interactivo tiene estado `:focus-visible`
  con doble anillo de alto contraste (offset + ring) que no interfiere con el
  ratón pero es evidente al tabular.
* **Transiciones rápidas**: 150ms `ease-out`; con `prefers-reduced-motion` se
  reducen a 0ms.
* **Estados deshabilitados**: contraste bajo (`#888`), `cursor: not-allowed`,
  `aria-disabled="true"`. Errores con borde rojo puro `#E00` + icono.
* **Geist-like**: radios reducidos (6px botones, 12px tarjetas), sombras casi
  imperceptibles en claro y nulas en oscuro, bordes definidos (`#EAEAEA`/`#333`).

## Implementación Técnica (Tailwind)

La fuente de verdad de colores/fuentes/radios es `tailwind.config.js`; el CSS
se compila con `npm run css:build` a `public/tailwind.css` (no editar a mano).

* **Ambos modos vía `dark:`** (ej. `bg-surface-light dark:bg-surface-dark`,
  `text-status-available dark:text-status-available-dark`).
* **CTA primario**: `bg-primary text-on-primary rounded-lg` (azul `#2563EB`
  + texto blanco; en oscuro el component. CSS opcional usa `#60A5FA` + negro).
* **Estados**: Disponible verde, Abierta ámbar, Ocupada/Llena gris apagado,
  Mi reserva azul — solo texto + icono, sin pills (fondo transparente).
* **Escala neutra** slate/gray/zinc remapeada a neutros Vercel
  (claro `#FAFAFA`, oscuro `#000`).