---
colors:
  surface: '#f8faf7'
  surface-dim: '#d8dbd8'
  surface-bright: '#f8faf7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f1'
  surface-container: '#eceeec'
  surface-container-high: '#e7e9e6'
  surface-container-highest: '#e1e3e0'
  on-surface: '#191c1b'
  on-surface-variant: '#3f4945'
  inverse-surface: '#2e3130'
  inverse-on-surface: '#eff1ef'
  outline: '#707975'
  outline-variant: '#bfc9c4'
  surface-tint: '#29695b'
  primary: '#00342b'
  on-primary: '#ffffff'
  primary-container: '#004d40'
  on-primary-container: '#7ebdac'
  inverse-primary: '#94d3c1'
  secondary: '#5b6300'
  on-secondary: '#ffffff'
  secondary-container: '#dded49'
  on-secondary-container: '#616a00'
  tertiary: '#705d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c8a900'
  on-tertiary-container: '#4b3e00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#afefdd'
  primary-fixed-dim: '#94d3c1'
  on-primary-fixed: '#00201a'
  on-primary-fixed-variant: '#065043'
  secondary-fixed: '#dded49'
  secondary-fixed-dim: '#c1d02c'
  on-secondary-fixed: '#1a1d00'
  on-secondary-fixed-variant: '#444b00'
  tertiary-fixed: '#ffe16d'
  tertiary-fixed-dim: '#e9c400'
  on-tertiary-fixed: '#221b00'
  on-tertiary-fixed-variant: '#544600'
  background: '#f8faf7'
  on-background: '#191c1b'
  surface-variant: '#e1e3e0'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1440px
  gutter: 20px
---

## Brand & Style

The design system is engineered for high-stakes enterprise environments where clarity and trust are paramount. It avoids the over-saturation of "SaaS Blue" in favor of a sophisticated deep teal and organic lime palette, signaling growth, stability, and ecological efficiency. 

The aesthetic is characterized by a "High-Density Premium" approach: maximizing information visibility without sacrificing white space or breathing room. By utilizing subtle depth and soft transitions, the system feels like a high-end physical dashboard—grounded, responsive, and meticulously organized. It evokes a sense of calm control over complex data ecosystems.

## Colors

The palette centers on **Deep Teal (#004D40)** to establish a professional, executive-level foundation. This is contrasted by **Lime (#CDDC39)** for primary actions and **Gold (#FFD700)** for highlighting critical status indicators or premium insights.

- **Primary:** Used for navigation bars, primary buttons, and active states.
- **Accents:** Lime is the primary "Go" color for CTAs; Gold is reserved for attention-based highlights and system alerts.
- **Backgrounds:** The off-white (#F8F9FA) reduces eye strain during long-form data management compared to pure white.
- **Typography:** Slate grays provide a softer contrast than pure black, maintaining a modern, accessible feel across high-density tables.

## Typography

The typography system uses a pairing of **Manrope** for structural headings and **Inter** for functional UI and body text. 

- **Headings:** Manrope provides a modern, slightly geometric warmth that differentiates the system from more sterile competitors.
- **Density:** We utilize a 13px base size for data-heavy views (body-sm) to ensure maximum information density without compromising legibility.
- **Data Display:** For IDs, serial numbers, and code-based logs, JetBrains Mono is used to ensure character distinction.
- **Hierarchy:** Strict use of `label-caps` for table headers and section overlines helps categorize information quickly in complex layouts.

## Layout & Spacing

This design system employs an **8px grid system** (with 4px increments for tight components) to maintain alignment across dense administrative consoles.

- **Grid:** A 12-column fluid grid is used for main dashboard views.
- **Margins:** Standard desktop margins are 32px; on tablet, these reduce to 20px. 
- **Density Management:** For tables and lists, vertical padding is reduced to 8px-12px to allow more rows "above the fold."
- **Breakpoints:**
  - Desktop: 1280px+
  - Tablet: 768px - 1279px
  - Mobile: Under 768px (Sidebars collapse into a hamburger menu; drawers become full-screen overlays).

## Elevation & Depth

Depth is communicated through **Tonal Layering** and **Subtle Shadows** rather than high-contrast borders.

- **Level 0 (Surface):** The #F8F9FA background.
- **Level 1 (Cards/Panels):** Pure white (#FFFFFF) with a 2px blur, 4% opacity shadow. This creates a "lifted" appearance for the main work area.
- **Level 2 (Drawers/Modals):** A more pronounced shadow (12px blur, 8% opacity) to indicate temporary interaction layers that sit above the main navigation.
- **Backdrop:** Use a 4px blur backdrop-filter on drawers to maintain context while focusing user attention on the form inputs.

## Shapes

The shape language is "Soft-Modern." We use a generous **14px radius** for main containers and cards to soften the data-heavy nature of the SaaS product.

- **Cards:** 14px radius creates a premium, approachable feel.
- **Interactive Elements:** Buttons and form inputs use a smaller radius (6px-8px) to feel more precise and clickable.
- **Tabs:** Top-level navigation tabs use a 4px top-only radius, while "Pill" styled sub-tabs use a fully rounded layout.

## Components

- **Cards:** Must contain a subtle border (#E2E8F0) and the Level 1 shadow. Header areas within cards should have a light gray bottom border.
- **Buttons:**
  - *Primary:* Lime (#CDDC39) with dark teal text for maximum visibility.
  - *Secondary:* Ghost style with a Dark Teal outline.
- **Drawers:** Slide in from the right for all creation and edit workflows. They must include a **Sticky Action Footer** with a glassmorphic background (blur: 10px) to ensure "Save" and "Cancel" are always accessible.
- **Data Tables:** High-density, no vertical borders. Use zebra striping (1% Teal tint) on hover.
- **Tabs:** Clean underline style for primary navigation; background-fill "Pill" style for secondary filters.
- **Sticky Footers:** Used in long forms and tables to house bulk actions, ensuring they remain visible while the user scrolls through data.