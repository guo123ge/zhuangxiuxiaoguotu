---
name: Architectural Intelligence System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#6b38d4'
  on-secondary: '#ffffff'
  secondary-container: '#8455ef'
  on-secondary-container: '#fffbff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#001a42'
  on-tertiary-container: '#3980f4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  container-max: 1440px
  gutter: 24px
  sidebar-width: 280px
---

## Brand & Style
The brand personality is **Sophisticated, Innovative, and Premium**. This design system bridges the gap between high-end architectural artistry and cutting-edge spatial computing. It is designed for an audience that values precision, reliability, and the seamless integration of AI into professional workflows.

The visual style is **Modern Enterprise SaaS** with a focus on high-fidelity clarity. It utilizes a **Minimalist** foundation characterized by generous whitespace and structured layouts, combined with subtle **Glassmorphism** in floating AI panels to evoke a "high-tech" feel. The overall aesthetic should feel as stable as a structural blueprint yet as fluid as a digital simulation.

## Colors
The palette is anchored by **Deep Midnight Blue (#0F172A)**, providing a stable, high-end foundation that signals institutional trust and authority. 

- **Primary Action & AI Indicators**: Use **Innovation Purple (#8B5CF6)** for core AI interactions, generative triggers, and primary CTA buttons. Use **Innovation Blue (#3B82F6)** for secondary functional highlights and system-level navigation.
- **Backgrounds & Surfaces**: The interface defaults to a light mode with **Slate-50 (#F8FAFC)** for main canvas areas. **Slate-100 (#F1F5F9)** is reserved for subtle borders and structural dividers.
- **Semantic Feedback**: **Emerald Green (#10B981)** is used exclusively for success states, such as "Published" renderings or completed VR synchronizations.
- **Contrast Strategy**: Employ deep dark sidebars or headers using the Primary color to create a premium, "pro-tool" visual weight.

## Typography
The system uses **Inter** exclusively to maintain a utilitarian yet refined aesthetic. The hierarchy is strictly enforced:
- **Display & Headings**: Utilize tight letter spacing and bold weights to project confidence. 
- **Metadata**: Labels should frequently use uppercase with increased tracking (letter-spacing) to differentiate data points from body narrative.
- **Reading Comfort**: Body text maintains a 1.5x line-height ratio to ensure legibility during complex project management tasks.

## Layout & Spacing
The design system employs a **Fixed Grid** philosophy for management views and a **Fluid Canvas** for the VR viewport. 

- **Desktop (1440px+)**: A 12-column grid with 24px gutters. The sidebar is fixed at 280px to accommodate complex project nesting.
- **Tablet (768px - 1439px)**: Columns reduce to 8. The sidebar collapses into an icon-rail to prioritize the visual canvas.
- **Mobile (<767px)**: A 4-column fluid grid. Internal margins shrink from 24px to 16px.
- **Spacing Rhythm**: All increments follow a 4px baseline, but generous "Macro-spacing" (40px+) should be used between major UI sections to prevent cognitive overload in data-heavy environments.

## Elevation & Depth
Depth is used to denote functional priority and the "z-index" of generative AI layers.
- **Surface Layer**: The main background is flat (#F8FAFC).
- **Component Layer (Low Elevation)**: Cards and containers use a subtle 1px border (#E2E8F0) and a soft, diffused shadow (0px 4px 6px rgba(15, 23, 42, 0.05)) to appear slightly raised.
- **Interactive Layer (Mid Elevation)**: Hover states on cards and dropdown menus use a more pronounced shadow with a hint of the secondary color in the blur to suggest interactivity.
- **AI Overlay (High Elevation)**: Floating AI toolbars and VR property panels use **Backdrop Blur (20px)** with a 60% transparent white fill, creating a "Glassmorphism" effect that feels futuristic and lightweight.

## Shapes
The system uses a **Rounded (0.5rem)** corner radius for standard components like buttons, input fields, and small cards. This balances the professional "rigidity" of architectural software with a modern, approachable feel.
- **Large Containers**: Use `rounded-lg` (1rem) for image gallery cards and main dashboard sections.
- **Status Pills**: Use fully rounded (pill-shaped) corners for status indicators (e.g., "In Progress") to contrast against the more geometric layout.

## Components
- **Buttons**: Primary buttons are solid Innovation Purple (#8B5CF6) with white text. Secondary buttons use a ghost style with a Slate-200 border.
- **Progress Steppers**: Vertical or horizontal lines with 32px circular nodes. Active steps are Innovation Blue; completed steps show a Success Emerald checkmark.
- **Cards**: Project cards feature a top-heavy image aspect ratio (16:9). The footer of the card should contain refined metadata in `label-sm` style.
- **Inputs**: Text fields use a 1px Slate-200 border that transitions to a 2px Innovation Blue border on focus. Labels sit above the field in `label-md` weight.
- **Image Gallery**: A masonry or strict square grid with 16px gaps. Each image should have a subtle inner glow on hover to indicate VR "enterability."
- **AI Tooltips**: Specialized "Sparkle" icon indicators in Innovation Purple to mark fields or features that are AI-augmented.