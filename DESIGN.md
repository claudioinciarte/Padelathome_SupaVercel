---
version: alpha
name: Padel@Home
description: >-
  Sistema de diseño de la web de Padel@Home — reserva de pistas. Azul primario
  (#2563EB) sobre superficies de slate, acento verde (#006e37) para "disponible",
  con modos claro y oscuro y tokens Material. Consistente en todas las páginas
  (login, dashboard, detalle de partida, perfil, admin, FAQ).
colors:
  primary: "#2563EB"
  primary-dark: "#1D4ED8"
  primary-hover: "#1D4ED8"
  on-primary: "#FFFFFF"
  primary-light-bg: "#EFF6FF"
  secondary: "#006e37"
  on-secondary: "#FFFFFF"
  background-light: "#F8FAFC"
  background-dark: "#0F172A"
  surface-light: "#FFFFFF"
  surface-dark: "#1E293B"
  surface-container-low: "#f1f4f5"
  surface-container-high: "#e5e9eb"
  on-surface: "#2d3335"
  on-surface-variant: "#5a6062"
  text-primary-light: "#1F2937"
  text-primary-dark: "#F3F4F6"
  text-muted-light: "#6B7280"
  text-muted-dark: "#9CA3AF"
  border-light: "#E5E7EB"
  border-dark: "#374151"
  success: "#16A34A"
  success-surface-light: "#D1FAE5"
  success-surface-dark: "#064E3B"
  warning: "#F59E0B"
  warning-surface-light: "#FEF3C7"
  warning-surface-dark: "#78350F"
  danger: "#DC2626"
  danger-surface-light: "#FFE4E6"
  danger-surface-dark: "#7F1D1D"
  error: "#a83836"
  slot-available: "#22C55E"
  slot-booked: "#EF4444"
  slot-open: "#F59E0B"
  slot-mine: "#2563EB"
  slot-blocked: "#64748B"
typography:
  display:
    fontFamily: Manrope
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.25
  title-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "0.02em"
rounded:
  DEFAULT: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  '2xl': 32px
  '3xl': 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.DEFAULT}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.DEFAULT}"
  card:
    backgroundColor: "{colors.surface-light}"
    rounded: "{rounded.xl}"
    padding: 24px
  card-dark:
    backgroundColor: "{colors.surface-dark}"
    rounded: "{rounded.xl}"
  input-field:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-primary-light}"
    rounded: "{rounded.DEFAULT}"
    padding: 10px
  chip-status:
    padding: 4px
    rounded: "{rounded.DEFAULT}"
  pill-available:
    backgroundColor: "{colors.slot-available}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  pill-booked:
    backgroundColor: "{colors.slot-booked}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  pill-open:
    backgroundColor: "{colors.slot-open}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  pill-mine:
    backgroundColor: "{colors.slot-mine}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  accordion-header:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-primary-light}"
    padding: 16px
    rounded: "{rounded.lg}"
  nav-link:
    textColor: "{colors.text-muted-light}"
    rounded: "{rounded.DEFAULT}"
  match-player-avatar:
    rounded: "{rounded.full}"
---

## Overview

Padel@Home es una web de reserva de pistas de pádel. El sistema se apoya en un
**azul primario (#2563EB)** como único color de acción, un **acento verde
(#006e37)** ligado al branding de la pista y al estado "disponible", y una
paleta de superficie **slate** con modos claro y oscuro. Todo el UI usa
**Tailwind CSS con darkMode class**, tokens CSS propios (`--pah-*`) y el
conjunto de iconos **Material Symbols Rounded**. La misma identidad se aplica
a todas las páginas para evitar divergencias de fuentes, colores y espaciado.

## Colors

- **Primario (#2563EB)**: único color de acción (botones, enlaces activos,
  "Mi Reserva"). Hover #1D4ED8. Fondo claro #EFF6FF.
- **Secundario (#006e37)**: branding y acento de la pista; indica éxito/"disponible".
- **Fondo/Superficie**: claro `#F8FAFC` / `#FFFFFF`; oscuro `#0F172A` / `#1E293B`.
- **Texto**: claro `#1F2937` (primario), `#6B7280` (muted); oscuro `#F3F4F6` / `#9CA3AF`.
- **Bordes**: claro `#E5E7EB`; oscuro `#374151`.
- **Estados de slot**: Disponible=verde #22C55E, Ocupado=rojo #EF4444,
  Partida Abierta=ámbar #F59E0B, Mi Reserva=azul #2563EB, Bloqueado=slate.
- **Semánticos**: success/warning/danger con variantes de superficie claro y oscuro.

## Typography

**Manrope** para títulos display (700) y **Inter** para el resto (headings,
body, etiquetas). Jerarquía consistente: display 2rem/700 → headline 1.25rem/700
→ title-lg 1.125rem/600 → body 1rem → body-sm 0.875rem → label 0.75rem/500.

## Layout & Spacing

Escala de espaciado: 4/8/12/16/24/32/48px. Radios: 8px (default), 12px (lg),
16px (xl), pill (9999px). Tarjetas con sombras suaves (0 1-4px rgba) y grid
responsive: escritorio en tabla, móvil en acordeón con tira de fechas
deslizable horizontal.

## Elevation & Depth

Sombras discretas tipo Material: `0 1px 2px rgba(0,0,0,0.05)` en slots,
`0 4px 6px -1px / 0 2px 4px -1px` en tarjetas. Sin elevación excesiva; las
interacciones se marcan con borde/hover (hover:border-green-500).

## Shapes

Radios consistentes. Modales, tarjetas y acordeones usan xl (16px); inputs y
botones DEFAULT (8px); pills y avatares full (9999px). La barra de estado del
slot es una franja vertical de 6px (`w-1.5`) en el borde izquierdo.

## Components

- **Button Primary**: fondo azul #2563EB, texto blanco, radius 8px, padding 12px.
  Hover #1D4ED8. Usado para reservar, guardar, acciones principales.
- **Card**: superficie, radius 16px, padding 24px, sombra suave. Variante dark
  con `surface-dark`.
- **Pill (estado de slot)**: chip con color semántico (disponible/ocupado/abierta/
  mi reserva/bloqueado) y radius full.
- **Accordion (móvil)**: header 16px con estado + hora + chevron; contenido
  colapsable con borde superior.
- **Match player avatar**: círculo (radius full) con iniciales del jugador; el
  dueño de la reserva se marca claramente.
- **Input**: superficie, border-ligero, radius 8px, padding 10px.

## Do's and Don'ts

- **Haz**: Usar #2563EB como único azul de acción; respetar los modos claro/oscuro
  via `--pah-*` / `dark:`; marcar siempre el estado del slot (disponible/ocupado/…);
  usar Inter/Manrope.
- **No hagas**: Introducir otros colores de botón, fuentes fuera de la familia,
  ni fijar colores en hex sin pasar por el token (romperían el modo oscuro y la
  consistencia entre páginas).