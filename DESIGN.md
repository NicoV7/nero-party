# Design System: Nero Party

## 1. Visual Theme & Atmosphere
Nero Party is a lively, sunlit social music interface: warm, candid, tactile, and built around group participation. The atmosphere should feel like a daytime apartment gathering where people are laughing, passing phones, and debating songs together.

Density is Daily App Balanced (5/10): enough structure for hosting and joining, but never dense or dashboard-like. Variance is Offset Asymmetric (7/10): left-led editorial hero layouts, uneven but controlled grids, and large breathable zones. Motion is Fluid CSS with selective scroll choreography (6/10): springy, responsive, and playful without becoming cinematic spectacle.

The product story is create a room, invite friends, build a shared queue, vote, and crown a winning song. Any secondary utility should stay behind that core flow.

## 2. Color Palette & Roles
- **Sunlit Canvas** (#FFF7EC) — Primary page background; warm, lively, and bright without becoming beige-heavy.
- **Porcelain Surface** (#FFFDF8) — Forms, panels, raised cards, and modal-like containers.
- **Charcoal Ink** (#29231E) — Primary text and structural contrast; never use pure black.
- **Warm Ash** (#756A60) — Secondary text, descriptions, helper copy, and inactive navigation.
- **Soft Clay Border** (rgba(41,35,30,0.12)) — Structural 1px borders, field outlines, dividers, and card edges.
- **Party Coral** (#E85D3D) — The single accent color for primary CTAs, active states, focus rings, and meaningful status badges.

Maximum one accent color. Avoid purple, blue neon, dark nightclub palettes, and heavy black surfaces. Pale yellow or green may appear inside photography, but interface chrome should remain neutral plus Party Coral.

## 3. Typography Rules
- **Display:** Geist Sans — bold, track-tight, controlled scale. Headlines use clamp sizing and must not exceed 3 lines in the hero.
- **Body:** Geist Sans — relaxed line-height, max 65 characters per line, Warm Ash for secondary copy.
- **Mono:** Geist Mono — room codes, timestamps, compact numeric metadata, and codes only.
- **Banned:** Inter, pure system-font defaults for premium contexts, generic serif fonts, dark-dashboard typography, and oversized shouting H1s.

## 4. Component Stylings
* **Buttons:** Rounded-full, tactile, and obvious. Primary buttons use Party Coral with white text. Secondary buttons are Porcelain Surface with Charcoal Ink and a Soft Clay Border. Active state uses a subtle scale or translate push. No neon glows.
* **Cards:** Use cards only for actual grouped experiences: hero image panels, create/join panels, feature tiles, and testimonial blocks. Cards have large radii, soft clay borders, and diffused warm shadows.
* **Inputs:** Label above the input, helper text below, error text below the group. Focus ring uses Party Coral at low opacity. No floating labels.
* **Loaders:** Skeletal shimmer matching the real button or content dimensions. No circular spinners.
* **Empty States:** Composed and action-oriented. Explain how to invite friends or add songs, not simply "No data".
* **Errors:** Inline, warm coral-tinted, clear language, and placed near the failed action.

## 5. Layout Principles
Use grid-first responsive architecture. The hero should be asymmetric: copy on one side, human-centered imagery on the other. Centered hero layouts are banned for the landing page.

Avoid generic three-equal-card feature rows. Use asymmetric bento grids, split editorial sections, or vertically sequenced flow panels. Keep max-width containment around 1400px. Full-height sections must use `min-h-[100dvh]`, never `h-screen`.

Every element must occupy a clean spatial zone. Text must never overlap images or other text. On small screens, all multi-column layouts collapse to a single column and horizontal overflow is a critical failure.

## 6. Motion & Interaction
Use spring-like easing and hardware-accelerated properties only: transform and opacity. Stagger lists and cards into view. Scroll text reveals may be used for editorial emphasis, but they should support the social music story rather than distract from it.

Interactive cards and images can scale gently on hover inside overflow-hidden containers. Avoid animating width, height, top, or left. Respect reduced-motion preferences.

## 7. Anti-Patterns (Banned)
No emojis. No Inter. No pure black. No dark nightclub default theme. No purple/blue neon glow. No excessive gradient text. No custom mouse cursors. No overlapping elements. No 3-column equal card feature rows. No generic names like John Doe or Acme. No fake perfect numbers like 99.99%. No empty copywriting cliches like Elevate, Seamless, Unleash, or Next-Gen. No filler UI text such as "Scroll to explore". No broken Unsplash links.
