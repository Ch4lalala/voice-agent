---
version: alpha
name: "AksesSuara"
description: "An accessible public-service guide with the calm clarity of a well-organized assistance desk."
colors:
  canvas: "#F4F8F7"
  surface: "#FFFFFF"
  ink: "#17324D"
  muted: "#53697C"
  primary: "#176B72"
  border: "#C8D8D5"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "4.75rem"
    lineHeight: "0.95"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1rem"
    lineHeight: "1.65"
rounded:
  card: "1rem"
  pill: "999px"
spacing:
  page-min: "1rem"
  page-max: "4rem"
  section-gap: "2rem"
components:
  application:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  foundation-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "{spacing.section-gap}"
  foundation-copy:
    textColor: "{colors.muted}"
    typography: "{typography.body}"
  foundation-divider:
    backgroundColor: "{colors.border}"
    size: "1px"
---

# AksesSuara Design System

## Overview

### Creative North Star

A well-organized public assistance desk: calm, legible, clearly labeled, and reassuring without looking institutional or official. The interface is for older adults and people with low digital confidence completing a simulated public-service workflow.

### Product context and register

- **Audience and primary job:** Elderly and low-digital-literacy users need one clear enrollment instruction at a time.
- **Target market and evidence:** The Indonesian public-service context is defined by `AksesSuara-PRD.md`; the hackathon UI remains English-only.
- **Locale and language policy:** English for the MVP. Future localization is outside the current MVP scope.
- **Usage scene:** Mobile and desktop browsers, potentially under time pressure and with limited digital confidence.
- **Register:** Product. Clarity and trust take precedence over marketing expression.
- **Memorable signature:** A narrow teal guidance rail can mark the current focal area without imitating any official service.
- **Restraint:** Forms, instructions, and state changes must remain quiet and familiar.
- **Anti-references:** Do not copy BPJS Kesehatan or Mobile JKN trade dress; avoid dense dashboards, detached chat panels, tiny controls, and decorative motion.
- **Token ownership/runtime mapping:** Hand-authored CSS variables in `src/app/globals.css` are the runtime source. This file mirrors their accepted values and explains their roles. Future shared components must consume the semantic variables rather than repeat raw values.

## Colors

The canvas and white surface create a quiet reading field. Ink and muted colors provide text hierarchy. Primary identifies guidance and primary focus without implying official BPJS branding. Future focus treatment must remain visually distinct and must not depend on color alone. The Phase 0 placeholder maps every documented color directly to a root CSS variable.

## Typography

The foundation uses a local Arial/Helvetica/system sans-serif stack so builds do not depend on a font network request. Display type is compact but reserved for short headings. Body copy stays at or above a 16-pixel baseline with generous line height. Interface copy uses sentence case and plain English.

## Layout

Content uses natural document scrolling and a responsive page gutter from 1rem to 4rem. The Phase 0 placeholder is a single centered status card; it is not a preview of the enrollment screens. Later product layouts must remain usable at 320 pixels without fixed-width content.

## Elevation & Depth

Use white surfaces, borders, and one restrained shadow for primary contained regions. Do not stack decorative shadows or blur effects. High-contrast mode must retain visible boundaries.

## Shapes

Containers use the 1rem card radius. Pill geometry is reserved for small status indicators, never for large content containers. The guidance rail is a straight vertical accent inside the card edge.

## Components

### Foundational visual states

Interactive states are intentionally absent from the Phase 0 placeholder. Future controls require visible hover, focus-visible, pressed, disabled, busy, success, warning, and error treatments that do not rely on color alone.

### Buttons and actions

No product action is implemented in Phase 0. Future actions must use semantic buttons or links, preserve a minimum effective target of approximately 44 by 44 pixels, and keep one primary action per screen.

### Navigation and data display

No product navigation or data display is implemented in Phase 0. Future progress and review structures must use semantic text alongside visual indicators.

### Forms and overlays

No forms or overlays are implemented in Phase 0. Future form controls must use visible labels, app-owned validation, and privacy-safe handling defined in the PRD.

### Iconography

No icon set is selected in Phase 0. Future icons must be simple, consistently stroked, and paired with text whenever meaning is not universal.

### Motion

No animation is used in Phase 0. Future motion must communicate voice or focus state, be interruptible, and respect `prefers-reduced-motion`.

### Content and data visualization

The product voice is patient, concise, and direct. Labels describe what the user can control. No analytics or measured-impact claims appear in the MVP.

## Do's and Don'ts

- **Do:** Use calm hierarchy and generous reading space to make the next task obvious.
- **Do:** Keep visual tokens mapped through the root CSS variables and accessible in forced-colors mode.
- **Don't:** Resemble an official BPJS Kesehatan product or imply official integration.
- **Don't:** introduce product screens, controls, or workflow behavior before their approved implementation phase.
