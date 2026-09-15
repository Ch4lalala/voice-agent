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
  primary-dark: "#0D4F55"
  primary-soft: "#E4F1EF"
  border: "#C8D8D5"
  warning: "#805A00"
  warning-soft: "#FFF6DA"
  danger: "#9A3F32"
  danger-soft: "#FFF0ED"
  success: "#2A7155"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "3.2rem"
    lineHeight: "1.02"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "1rem"
    lineHeight: "1.65"
rounded:
  card: "1rem"
  control: "0.75rem"
  pill: "999px"
spacing:
  page-min: "0.75rem"
  page-max: "3rem"
  section-gap: "2rem"
components:
  application:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  screen-preview:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.card}"
    padding: "{spacing.section-gap}"
  secondary-copy:
    textColor: "{colors.muted}"
    typography: "{typography.body}"
  divider:
    backgroundColor: "{colors.border}"
    size: "1px"
  primary-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
  voice-guide:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.control}"
  warning-notice:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.control}"
  error-status:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
  active-status:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.success}"
    rounded: "{rounded.pill}"
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
- **Memorable signature:** A narrow teal guidance rail and simple waveform mark identify the current focal area without imitating an official service.
- **Restraint:** Forms, instructions, and state changes remain quiet and familiar.
- **Anti-references:** Do not copy BPJS Kesehatan or Mobile JKN trade dress; avoid dense dashboards, detached chat panels, tiny controls, and decorative motion.
- **Token ownership/runtime mapping:** Hand-authored CSS variables in `src/app/globals.css` are the runtime source. This file mirrors their accepted values and explains their roles. Shared components consume the semantic variables rather than repeat raw values.

## Colors

The canvas and white surface create a quiet reading field. Ink and muted colors provide text hierarchy. Primary identifies guidance and active focus without implying official BPJS branding. Dark and soft primary variants support readable embedded guidance surfaces. Warning, danger, and success tokens always appear with text labels or symbols, so status never depends on color alone. Every documented color maps to a root CSS variable in `src/app/globals.css`.

## Typography

The interface uses a local Arial/Helvetica/system sans-serif stack so builds do not depend on a font network request. Display type is compact but reserved for short headings. Body copy stays at or above a 16-pixel baseline, while secondary labels never carry the primary instruction. Interface copy uses sentence case and plain English.

## Layout

Content uses natural document scrolling and a responsive page gutter from 0.75rem to 3rem. At wide viewports the task and Voice Guide share one bordered workflow card; below 832 pixels the guide moves beneath the task while remaining inside the same card. Form grids become one column and action groups stack when needed on narrow screens. No content region relies on a fixed viewport height or fixed content width.

## Elevation & Depth

White surfaces, borders, and one restrained shadow distinguish the primary workflow region. The Voice Guide uses a subtle tonal shift rather than a detached floating treatment. High-contrast mode retains explicit boundaries.

## Shapes

Containers use the 1rem card radius. Controls use 0.75rem corners. Pill geometry is reserved for small status indicators. The asymmetric brand and microphone shapes provide an independent AksesSuara signature without borrowing official logos.

## Components

### Visual states

Voice states are labeled **Off**, **Connecting**, **Listening**, **Thinking**, **Speaking**, or **Error** beside a visible status dot. Teal, amber, and coral support the labels but never replace them. Phase 3 derives these states from connection and voice events; it does not use timers or simulated fixtures. Live caption cards stay in the same workflow surface as the active step and explicitly state that their content is not saved.

### Buttons and actions

Product actions are semantic buttons with a minimum effective height of 44 pixels. Manual workflow actions use teal for forward progress and quiet outlined treatment for Previous or cancellation. Hover, active, and visible two-color focus states do not change control geometry. **Start Voice Guidance**, **End Guidance**, and **Retry Connection** follow the live session state. Repeat and slower-speech controls remain disabled with nearby explanatory copy because they are outside Phase 3.

### Navigation and data display

The five-step enrollment progress uses an ordered list, numbered circles, text labels, and `aria-current="step"`. Screen changes move focus to the new heading, while blocked progress moves focus to the first invalid control. Review data uses description lists, wraps long values safely, and exposes a text-labeled edit action for every section.

### Forms and overlays

Forms use visible labels, persistent hints, semantic field types, and dummy data only. The date remains a typed `YYYY-MM-DD` field and relationship remains a native platform select. Application-owned validation appears beside each field and uses the shared danger treatment. Sensitive controls carry a **Type only** label, retain their raw value only in React memory, and render only the allowed trailing digits while blurred. Facility candidates use full-row radio targets followed by an explicit inline confirmation. Reset confirmation is also inline; Phase 2 introduces no overlays or dialogs.

### Iconography

No external icon set is required. Small CSS-drawn marks and text characters are decorative or paired with explicit labels; non-universal icon-only actions are not used.

### Motion

The only animation is a restrained waveform response during real Listening, Thinking, and Speaking states. `prefers-reduced-motion` removes it completely. Natural scrolling keeps all content reachable at short viewport heights.

### Content and data visualization

The product voice is patient, concise, and direct. Labels describe what the user can control. Fictional data is marked locally and globally. No analytics or measured-impact claims appear in the MVP.

## Do's and Don'ts

- **Do:** Use calm hierarchy and generous reading space to make the next task obvious.
- **Do:** Keep visual tokens mapped through root CSS variables and accessible in forced-colors mode.
- **Do:** Keep the Voice Guide within the same bordered workflow surface as the active form.
- **Do:** Keep validation adjacent, deterministic, and paired with first-invalid-field focus.
- **Do:** Mask sensitive values outside active editing and on Review.
- **Don't:** Resemble an official BPJS Kesehatan product or imply official integration.
- **Don't:** Imply that local completion submits information or that voice can read, validate, or control enrollment fields.
