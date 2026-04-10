---
name: aware-brand
description: Apply AWARE™ brand guidelines when building any interface, component, or visual output for the AWARE™ platform or marketing surfaces. Use this skill whenever building anything for AWARE™ — web UI, dashboards, marketing pages, email templates, presentations, or any other visual output. Ensures all output is consistent with the AWARE™ visual identity.
---

This skill defines the AWARE™ brand system. Apply it precisely and completely whenever producing visual output for AWARE™. Do not interpret loosely or blend with other aesthetic directions — the AWARE™ brand is deliberate and specific.

---

## Brand identity

**Mission:** Build trust in supply chains.

**Personality:** Daring, open-minded, approachable. All three simultaneously — never one at the expense of another.

**Aesthetic direction:** Minimalist, clean, confident. High contrast. Generous whitespace. No decoration for its own sake. Every element earns its place.

---

## Colour system

Four colours. Use nothing else.

| Name | Hex | Role |
|---|---|---|
| Scarlet | `#FF3300` | Brand primary. CTAs, active states, key highlights, logo. |
| Earth | `#290800` | Dark text, headings, logo on light backgrounds, dark surfaces. |
| Snow | `#F5F5F5` | Primary background. The dominant surface — 75% of visual space. |
| White | `#FFFFFF` | Card surfaces, input backgrounds, elevated elements. |

**Colour rules:**
- Snow is the default background. White sits on top of Snow for cards and inputs.
- Earth is the default text colour on Snow or White backgrounds.
- Scarlet is used sparingly as an accent — primary buttons, active states, logo, key highlights.
- Never place Earth directly on Scarlet or Scarlet on Earth. Only Snow or White on Scarlet.
- No other colours. No greys, blues, greens, or purples. No gradients. No tints or transparency effects.
- The 75/12.5/12.5 split: approximately 75% Snow, the remainder split between Earth and Scarlet.

---

## Typography

Two weights only: regular (400) and medium (500). Never bold (600+).

| Element | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Display / Hero | Inter Display | 40px+ | 500 | Letter spacing: -2% (-0.02em) |
| Headings (h1) | Inter Display | 28-36px | 500 | Letter spacing: -2% |
| Headings (h2-h3) | Inter | 18-22px | 500 | Letter spacing: -1% |
| Body | Inter | 15-16px | 400 | Line height: 1.7 |
| Labels / Caps | Inter | 11-12px | 500 | Uppercase, letter spacing: +6% (0.06em) |
| Small / Meta | Inter | 12-13px | 400 | colour: Earth at 60% opacity or similar muted treatment |

**Typography rules:**
- Sentence case everywhere. Never title case. Never all caps except for UI labels (field labels, tags, status indicators).
- Inter Display for headings and display text. Inter for everything else.
- The -2% letter spacing on display text is non-negotiable — it is part of the visual identity.
- Never use system fonts, Arial, Roboto, or any other typeface.

**Loading Inter:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Inter+Display:wght@500&display=swap" rel="stylesheet">
```

```css
font-family: 'Inter', sans-serif;
/* Display headings: */
font-family: 'Inter Display', 'Inter', sans-serif;
```

---

## Spacing and layout

- Base unit: 8px. All spacing in multiples of 8 (8, 16, 24, 32, 48, 64).
- Generous whitespace. When in doubt, add more space not less.
- Max content width: 1200px. Centre-aligned on wider viewports.
- Section padding: minimum 64px vertical on desktop, 40px on mobile.
- Component internal padding: 16px (compact), 24px (default), 32px (spacious).

---

## Component patterns

### Buttons

```css
/* Primary button */
background: #FF3300;
color: #FFFFFF;
border: none;
border-radius: 8px;
padding: 10px 20px;
font-family: 'Inter', sans-serif;
font-size: 14px;
font-weight: 500;
cursor: pointer;
transition: opacity 0.15s;

/* Primary hover */
opacity: 0.9;

/* Secondary button */
background: transparent;
color: #290800;
border: 0.5px solid #290800;
/* same other properties as primary */

/* Secondary hover */
background: #F5F5F5;
```

- One primary action per view. Everything else is secondary or tertiary.
- Never use Scarlet for destructive actions — use Earth with appropriate labelling.

### Inputs and form fields

```css
input, textarea, select {
  background: #FFFFFF;
  border: 0.5px solid rgba(41, 8, 0, 0.3);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: #290800;
  outline: none;
  transition: border-color 0.15s;
}

input:focus, textarea:focus, select:focus {
  border-color: #FF3300;
}

::placeholder {
  color: rgba(41, 8, 0, 0.35);
}
```

### Cards

```css
.card {
  background: #FFFFFF;
  border: 0.5px solid rgba(41, 8, 0, 0.15);
  border-radius: 12px;
  padding: 20px 24px;
}
```

- No drop shadows on cards. Border only.
- Cards sit on Snow (#F5F5F5), not on white.

### Dividers and borders

```css
border: 0.5px solid rgba(41, 8, 0, 0.15); /* default */
border: 0.5px solid rgba(41, 8, 0, 0.3);  /* emphasis */
border: 0.5px solid #FF3300;              /* active / selected */
```

- Always 0.5px. Never 1px or thicker for decorative borders.
- Use Scarlet borders only for active, selected, or focused states.

### Border radius

| Context | Value |
|---|---|
| Buttons, inputs, tags, small components | 8px |
| Cards, panels, modals | 12px |
| Large containers or feature cards | 16px |
| Fully round (avatars, icons) | 50% |

---

## Logo and brand mark

- Always written as **AWARE™** — never "Aware", "aware", or without the ™.
- The ™ symbol is part of the brand name. Never omit it in headings, navigation, or first mentions on a page.
- On Snow or White backgrounds: use Earth (`#290800`) logo.
- On Scarlet backgrounds: use White (`#FFFFFF`) logo.
- On Earth backgrounds: use White (`#FFFFFF`) logo.
- Never place the Earth logo on a Scarlet background or vice versa.
- Do not modify, recolour, stretch, or add effects to the logo.

---

## Visual motif

The AWARE™ visual motif is a set of concentric arcs — partial circles rendered as thin lines. They appear as background decoration, section dividers, or structural elements.

**Implementation:**
- Render as SVG paths or CSS border arcs.
- Stroke only, no fill.
- Colour: Scarlet (`#FF3300`) as a solid line, or as a dashed line (`stroke-dasharray`).
- Stroke weight: 1px solid or 1px dashed.
- Always partial arcs (quarter to three-quarter circle), never full circles.
- Used at large scale in the background or as a framing device — never as small decorative elements.
- Opacity can be reduced (0.3-0.6) when used as a background element behind content.

```html
<!-- Example arc motif -->
<svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M 600 300 A 300 300 0 0 0 300 0" stroke="#FF3300" stroke-width="1" fill="none"/>
  <path d="M 600 300 A 250 250 0 0 0 350 50" stroke="#FF3300" stroke-width="1" stroke-dasharray="4 4" fill="none"/>
</svg>
```

---

## Logo SVG files

Four logo variants and one favicon. Use the correct variant for each background. Never modify fill colours — use the appropriate file instead.

**Variant selection:**

| Background | Logo variant | Fill colour |
|---|---|---|
| Snow (#F5F5F5) | Earth logo | #290800 |
| White (#FFFFFF) | Earth logo | #290800 |
| Earth (#290800) | White logo or Snow logo | #FFFFFF / #F5F5F5 |
| Scarlet (#FF3300) | White logo | #FFFFFF |

The Snow and White logos are visually identical — both render at #F5F5F5 and #FFFFFF respectively. Use Snow on Earth backgrounds, White on Scarlet backgrounds.

The Scarlet logo (all paths filled #FF3300) is for use as a standalone brand mark on neutral backgrounds where colour emphasis is needed — not as the default wordmark.

**Natural dimensions:** 134 × 24px. Scale proportionally. Never distort.

**Minimum size:** Do not render the wordmark below 80px wide. Use the favicon mark instead at small sizes.

---

### Earth logo (default — use on Snow and White backgrounds)

```svg
<svg width="134" height="24" viewBox="0 0 134 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M17.0882 17.0087C19.4968 14.1407 21.3964 10.9889 21.3964 7.02353C21.3964 3.5703 19.2337 0 15.6136 0C14.1563 0 12.1468 0.573589 10.6982 3.25131C9.24962 0.573589 7.24009 0 5.78282 0C2.16277 0 0 3.5703 0 7.02353C0 10.9889 1.90544 14.1349 4.31109 16.9999L1.8852 22.2412H4.4412L5.99389 18.8904C6.45362 19.3879 6.92203 19.8795 7.38755 20.3712C8.20582 21.2345 9.053 22.1271 9.83657 23.0196L10.6982 24L11.5627 23.0226C12.3348 22.1505 13.1646 21.2755 13.9713 20.4297C14.4513 19.9234 14.937 19.4142 15.4141 18.9021L16.961 22.2441H19.517L17.094 17.0116L17.0882 17.0087ZM5.39826 14.6558C3.59113 12.3468 2.31313 9.91489 2.31313 7.02353C2.31313 4.72333 3.61137 2.34118 5.78282 2.34118C7.0666 2.34118 8.02366 3.06109 8.78988 4.60627L9.42021 5.97L5.39826 14.6558ZM12.3001 18.8055C11.7709 19.3615 11.2302 19.9293 10.6982 20.5058C10.1517 19.9117 9.59369 19.3235 9.05011 18.7499C8.36774 18.03 7.69115 17.3189 7.04636 16.6048L10.6953 8.72674L14.3472 16.6107C13.6879 17.3393 12.9969 18.068 12.2972 18.8026L12.3001 18.8055ZM16.0011 14.6646L11.9762 5.97L12.6065 4.60627C13.3728 3.06109 14.3298 2.34118 15.6136 2.34118C17.7851 2.34118 19.0833 4.72333 19.0833 7.02353C19.0833 9.91782 17.8082 12.3526 16.0011 14.6646Z" fill="#290800"/>
<g clip-path="url(#clip0_earth)">
<path d="M129.738 1.59816H130.386V3.51208H130.817V1.59816H131.464V1.1709H129.738V1.59816Z" fill="#290800"/>
<path d="M133.395 1.1709L132.878 2.8068L132.375 1.21772L132.36 1.1709H131.762V3.51208H132.187V1.95227L132.681 3.51208H133.077L133.575 1.95227V3.51208H133.997V1.1709H133.395Z" fill="#290800"/>
<path d="M70.4367 1.1709L64.8794 13.2894L61.2825 1.1709H56.5146L52.8888 13.2894L47.3633 1.1709H42.4219L51.0498 22.2415H54.4415L58.8884 7.59158L63.3643 22.2415H66.756L75.3839 1.1709H70.4396H70.4367Z" fill="#290800"/>
<path d="M33.973 1.1709L25.0703 22.2415H29.9655L31.8796 17.6938L33.6202 13.5616L36.2138 7.44233L38.7814 13.5616L40.5191 17.6938L42.4361 22.2415H47.3313L38.4315 1.1709H33.9759H33.973Z" fill="#290800"/>
<path d="M79.3675 1.1709L70.4648 22.2415H75.36L77.2741 17.6938L79.0147 13.5616L81.6112 7.44233L84.1759 13.5616L85.9136 17.6938L87.8335 22.2415H92.7258L83.8203 1.1709H79.3646H79.3675Z" fill="#290800"/>
<path d="M106.62 14.6853C109.223 13.705 110.524 11.5277 110.524 8.15639V8.15053C110.524 5.69815 109.844 3.92178 108.485 2.82143C107.124 1.72108 104.851 1.1709 101.662 1.1709H93.8867V22.2415H98.513V15.4989H101.639L106.181 22.2122H111.813L106.623 14.6824L106.62 14.6853ZM105.007 10.6556C104.44 11.1765 103.373 11.4399 101.806 11.4399H98.5101V5.2065H101.89C103.359 5.2065 104.385 5.41721 104.972 5.84155C105.556 6.26296 105.848 7.0414 105.848 8.17394C105.848 9.30649 105.568 10.1347 105.001 10.6585H105.007V10.6556Z" fill="#290800"/>
<path d="M129.16 5.85325V1.1709H118.173H113.547V5.85325V9.65767V13.7547V17.5591V22.2415H118.173H129.16V17.5591H118.173V13.7547H127.426V9.65767H118.173V5.85325H129.16Z" fill="#290800"/>
</g>
<defs>
<clipPath id="clip0_earth">
<rect width="108.931" height="23.8627" fill="white" transform="translate(25.0703)"/>
</clipPath>
</defs>
</svg>
```

---

### White logo (use on Scarlet and Earth backgrounds)

Same paths as above with all `fill` values replaced with `"white"`. File: `awareWhiteLogo.svg`.

```svg
<svg width="134" height="24" viewBox="0 0 134 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M17.0882 17.0087C19.4968 14.1407 21.3964 10.9889 21.3964 7.02353C21.3964 3.5703 19.2337 0 15.6136 0C14.1563 0 12.1468 0.573589 10.6982 3.25131C9.24962 0.573589 7.24009 0 5.78282 0C2.16277 0 0 3.5703 0 7.02353C0 10.9889 1.90544 14.1349 4.31109 16.9999L1.8852 22.2412H4.4412L5.99389 18.8904C6.45362 19.3879 6.92203 19.8795 7.38755 20.3712C8.20582 21.2345 9.053 22.1271 9.83657 23.0196L10.6982 24L11.5627 23.0226C12.3348 22.1505 13.1646 21.2755 13.9713 20.4297C14.4513 19.9234 14.937 19.4142 15.4141 18.9021L16.961 22.2441H19.517L17.094 17.0116L17.0882 17.0087ZM5.39826 14.6558C3.59113 12.3468 2.31313 9.91489 2.31313 7.02353C2.31313 4.72333 3.61137 2.34118 5.78282 2.34118C7.0666 2.34118 8.02366 3.06109 8.78988 4.60627L9.42021 5.97L5.39826 14.6558ZM12.3001 18.8055C11.7709 19.3615 11.2302 19.9293 10.6982 20.5058C10.1517 19.9117 9.59369 19.3235 9.05011 18.7499C8.36774 18.03 7.69115 17.3189 7.04636 16.6048L10.6953 8.72674L14.3472 16.6107C13.6879 17.3393 12.9969 18.068 12.2972 18.8026L12.3001 18.8055ZM16.0011 14.6646L11.9762 5.97L12.6065 4.60627C13.3728 3.06109 14.3298 2.34118 15.6136 2.34118C17.7851 2.34118 19.0833 4.72333 19.0833 7.02353C19.0833 9.91782 17.8082 12.3526 16.0011 14.6646Z" fill="white"/>
<g clip-path="url(#clip0_white)">
<path d="M129.738 1.59816H130.386V3.51208H130.817V1.59816H131.464V1.1709H129.738V1.59816Z" fill="white"/>
<path d="M133.395 1.1709L132.878 2.8068L132.375 1.21772L132.36 1.1709H131.762V3.51208H132.187V1.95227L132.681 3.51208H133.077L133.575 1.95227V3.51208H133.997V1.1709H133.395Z" fill="white"/>
<path d="M70.4367 1.1709L64.8794 13.2894L61.2825 1.1709H56.5146L52.8888 13.2894L47.3633 1.1709H42.4219L51.0498 22.2415H54.4415L58.8884 7.59158L63.3643 22.2415H66.756L75.3839 1.1709H70.4396H70.4367Z" fill="white"/>
<path d="M33.973 1.1709L25.0703 22.2415H29.9655L31.8796 17.6938L33.6202 13.5616L36.2138 7.44233L38.7814 13.5616L40.5191 17.6938L42.4361 22.2415H47.3313L38.4315 1.1709H33.9759H33.973Z" fill="white"/>
<path d="M79.3675 1.1709L70.4648 22.2415H75.36L77.2741 17.6938L79.0147 13.5616L81.6112 7.44233L84.1759 13.5616L85.9136 17.6938L87.8335 22.2415H92.7258L83.8203 1.1709H79.3646H79.3675Z" fill="white"/>
<path d="M106.62 14.6853C109.223 13.705 110.524 11.5277 110.524 8.15639V8.15053C110.524 5.69815 109.844 3.92178 108.485 2.82143C107.124 1.72108 104.851 1.1709 101.662 1.1709H93.8867V22.2415H98.513V15.4989H101.639L106.181 22.2122H111.813L106.623 14.6824L106.62 14.6853ZM105.007 10.6556C104.44 11.1765 103.373 11.4399 101.806 11.4399H98.5101V5.2065H101.89C103.359 5.2065 104.385 5.41721 104.972 5.84155C105.556 6.26296 105.848 7.0414 105.848 8.17394C105.848 9.30649 105.568 10.1347 105.001 10.6585H105.007V10.6556Z" fill="white"/>
<path d="M129.16 5.85325V1.1709H118.173H113.547V5.85325V9.65767V13.7547V17.5591V22.2415H118.173H129.16V17.5591H118.173V13.7547H127.426V9.65767H118.173V5.85325H129.16Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_white">
<rect width="108.931" height="23.8627" fill="white" transform="translate(25.0703)"/>
</clipPath>
</defs>
</svg>
```

---

### Scarlet logo (brand mark emphasis — use on Snow or White backgrounds only)

Same paths with all fills set to `"#FF3300"`. File: `awareScarletLogo.svg`. Use sparingly — this is a statement variant, not the default wordmark.

---

### Snow logo (use on Earth backgrounds)

Same paths with all fills set to `"#F5F5F5"`. File: `awareSnowLogo.svg`.

---

### Favicon / icon mark (use at small sizes, browser tabs, app icons)

The standalone diamond-A mark. Rendered in Scarlet. Natural dimensions: 24 × 26px.

```svg
<svg width="24" height="26" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M19.1676 18.426C21.8692 15.3191 24 11.9046 24 7.60883C24 3.86782 21.5741 0 17.5135 0C15.8789 0 13.6249 0.621388 12 3.52225C10.3751 0.621388 8.12108 0 6.48649 0C2.42595 0 0 3.86782 0 7.60883C0 11.9046 2.1373 15.3128 4.83568 18.4165L2.11459 24.0946H4.98162L6.72324 20.4646C7.23892 21.0035 7.76432 21.5362 8.28649 22.0688C9.20432 23.004 10.1546 23.971 11.0335 24.9379L12 26L12.9697 24.9411C13.8357 23.9963 14.7665 23.0484 15.6714 22.1322C16.2097 21.5837 16.7546 21.0321 17.2897 20.4773L19.0249 24.0978H21.8919L19.1741 18.4292L19.1676 18.426ZM6.05514 15.8771C4.02811 13.3757 2.59459 10.7411 2.59459 7.60883C2.59459 5.11694 4.05081 2.53628 6.48649 2.53628C7.92649 2.53628 9 3.31618 9.85946 4.99012L10.5665 6.4675L6.05514 15.8771ZM13.7968 20.3726C13.2032 20.975 12.5968 21.59 12 22.2146C11.387 21.571 10.7611 20.9338 10.1514 20.3124C9.38595 19.5325 8.62703 18.7621 7.90378 17.9885L11.9968 9.45397L16.093 17.9949C15.3535 18.7843 14.5784 19.5737 13.7935 20.3695L13.7968 20.3726ZM17.9481 15.8866L13.4335 6.4675L14.1405 4.99012C15 3.31618 16.0735 2.53628 17.5135 2.53628C19.9492 2.53628 21.4054 5.11694 21.4054 7.60883C21.4054 10.7443 19.9751 13.382 17.9481 15.8866Z" fill="#FF3300"/>
</svg>
```

**Favicon usage in HTML:**
```html
<link rel="icon" type="image/svg+xml" href="/awareFavicon.svg">
```

**Inline logo usage pattern (React/HTML):**
```jsx
// Import and use the correct variant based on background
import { ReactComponent as LogoEarth } from './awareEarthLogo.svg';
import { ReactComponent as LogoWhite } from './awareWhiteLogo.svg';

// On light backgrounds
<LogoEarth width={134} height={24} />

// On dark or Scarlet backgrounds
<LogoWhite width={134} height={24} />
```

---

## What to avoid

- Gradients of any kind — linear, radial, mesh.
- Drop shadows or box shadows (except functional focus rings).
- Colours outside the four-colour palette.
- Rounded corners larger than 16px (except 50% for avatars).
- Font weights above 500.
- Title case headings.
- Decorative icons or illustration styles that do not match the clean, minimal aesthetic.
- Corporate stock photography or generic sustainability imagery (green leaves, globes, handshakes).
- Any typeface other than Inter and Inter Display.
- Busy layouts — if it feels crowded, remove elements rather than shrinking them.

---

## CSS custom properties (recommended setup)

```css
:root {
  --color-scarlet: #FF3300;
  --color-earth: #290800;
  --color-snow: #F5F5F5;
  --color-white: #FFFFFF;

  --color-text-primary: #290800;
  --color-text-muted: rgba(41, 8, 0, 0.55);
  --color-text-placeholder: rgba(41, 8, 0, 0.35);

  --color-border-default: rgba(41, 8, 0, 0.15);
  --color-border-emphasis: rgba(41, 8, 0, 0.3);
  --color-border-active: #FF3300;

  --font-display: 'Inter Display', 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;

  --letter-spacing-display: -0.02em;
  --letter-spacing-heading: -0.01em;
  --letter-spacing-label: 0.06em;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --transition-base: 0.15s ease;
}
```
