---
name: frontend-design
description: "Design and implement distinctive, production-ready frontend interfaces with strong aesthetic direction. Use when asked to create or restyle web pages, components, or applications (HTML/CSS/JS, React, Vue, etc.)."
---

# Frontend Design Skill

Design and implement memorable frontend interfaces with a clear, intentional aesthetic. The output must be real, working code — not just mood boards. This skill is about **design thinking + execution**: every visual choice should be rooted in purpose and context.

## When to Use

Use this skill when the user wants to:
- Create a new web page, landing page, dashboard, or app UI
- Design or redesign frontend components or screens
- Improve typography, layout, color, motion, or overall visual polish
- Convert a concept or brief into a high-fidelity, coded interface

## Inputs to Gather (or Assume)

Before coding, identify:
- **Purpose & audience**: What problem does this UI solve? Who uses it?
- **Brand/voice**: Any reference brands, tone, or visual inspiration?
- **Technical constraints**: Framework, library, CSS strategy, accessibility, performance
- **Content constraints**: Required copy, assets, data, features

If the user did not provide this, ask **2–4 targeted questions**, or state reasonable assumptions in a short preface.

## 1. Baseline Configuration

These defaults drive design decisions across Sections 3–7. Adapt dynamically based on what the user explicitly requests.

| Parameter | Default | Scale |
|-----------|---------|-------|
| `DESIGN_VARIANCE` | 8 | 1 = Perfect Symmetry → 10 = Artsy Chaos |
| `MOTION_INTENSITY` | 6 | 1 = Static/No movement → 10 = Cinematic/Magic Physics |
| `VISUAL_DENSITY` | 4 | 1 = Art Gallery/Airy → 10 = Pilot Cockpit/Packed Data |

## 2. Design Thinking (Required)

Commit to a **single, bold aesthetic direction**. Name it and execute it consistently. Examples:
- Brutalist / raw / utilitarian
- Editorial / magazine / typographic
- Luxury / refined / minimal
- Retro-futuristic / cyber / neon
- Art-deco / geometric / ornamental
- Handcrafted / organic / textured

**Avoid generic AI aesthetics.** No "default" fonts, color schemes, or stock layouts.

Before writing code, define the system:
1. **Visual direction** — one sentence that describes the vibe
2. **Differentiator** — what should be memorable about this UI?
3. **Typography system** — display + body fonts, scale, weight, casing
4. **Color system** — dominant, accent, neutral; define as CSS variables
5. **Layout strategy** — grid rhythm, spacing scale, hierarchy plan
6. **Motion strategy** — 1–2 meaningful interaction moments

If the user wants code only, skip the explanation but still follow this internally.

## 3. Architecture & Conventions

### General (All Frameworks)
* **DEPENDENCY VERIFICATION [MANDATORY]:** Before importing ANY 3rd-party library, check `package.json` (or equivalent). If missing, output the install command before providing code. **Never** assume a library exists.
* **Styling Policy:** Use Tailwind CSS when available. Check `package.json` for version — do not use v4 syntax in v3 projects. For v4, use `@tailwindcss/postcss` or the Vite plugin (not the `tailwindcss` PostCSS plugin).
* **No-framework projects:** Vanilla CSS with custom properties is preferred. Tokenize colors, spacing, radii, shadows as CSS variables.
* **ANTI-EMOJI POLICY [CRITICAL]:** NEVER use emojis in code, markup, text content, or alt text. Replace symbols with high-quality icons (Radix, Phosphor) or clean SVG primitives.

### Responsiveness & Spacing
* Standardize breakpoints (`sm`, `md`, `lg`, `xl`).
* Contain page layouts using `max-w-[1400px] mx-auto` or `max-w-7xl`.
* **Viewport Stability [CRITICAL]:** NEVER use `h-screen` for full-height sections. Use `min-h-[100dvh]` to prevent layout jumping on mobile browsers (iOS Safari).
* **Grid over Flex-Math:** NEVER use complex flexbox percentage math (`w-[calc(33%-1rem)]`). Use CSS Grid (`grid grid-cols-1 md:grid-cols-3 gap-6`) for reliable structures.
* **Icons:** Use `@phosphor-icons/react` or `@radix-ui/react-icons`. Standardize `strokeWidth` globally (e.g., 1.5 or 2.0).

### React / Next.js Specific
* Default to Server Components (RSC). Global state works ONLY in Client Components.
* **RSC SAFETY:** Wrap providers in a `"use client"` component.
* **INTERACTIVITY ISOLATION:** Interactive UI components (motion, hover effects) MUST be extracted as isolated leaf components with `'use client'` at the top. Server Components render static layouts only.
* State: Use local `useState`/`useReducer` for isolated UI. Global state strictly for deep prop-drilling avoidance.
* `shadcn/ui` is allowed but NEVER in its generic default state — customize radii, colors, and shadows to match the project aesthetic.

## 4. Design Engineering Directives (Bias Correction)

LLMs have statistical biases toward specific UI clichés. Apply these rules to produce premium interfaces:

### Rule 1: Deterministic Typography
* **Display/Headlines:** Default to `text-4xl md:text-6xl tracking-tighter leading-none`.
* **ANTI-SLOP:** `Inter` is BANNED. Force unique character: `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`.
* **TECHNICAL UI RULE:** Serif fonts are BANNED for Dashboard/Software UIs. Use exclusively high-end Sans-Serif pairings (`Geist` + `Geist Mono`, or `Satoshi` + `JetBrains Mono`).
* **Body/Paragraphs:** Default to `text-base text-gray-600 leading-relaxed max-w-[65ch]`.
* Typography should define the voice of the design. Implement a clear hierarchy (size, weight, spacing, casing).

### Rule 2: Color Calibration
* Max 1 Accent Color. Saturation < 80%.
* **THE LILA BAN:** "AI Purple/Blue" is BANNED. No purple button glows, no neon gradients. Use neutral bases (Zinc/Slate) with high-contrast, singular accents (Emerald, Electric Blue, Deep Rose).
* **COLOR CONSISTENCY:** One palette for the entire output. Do not fluctuate between warm and cool grays.
* Commit to a palette with a strong point of view. Use contrast intentionally and check legibility.

### Rule 3: Layout Diversification
* **ANTI-CENTER BIAS:** Centered Hero/H1 sections are BANNED when `DESIGN_VARIANCE > 4`. Force "Split Screen" (50/50), "Left-Aligned content / Right-Aligned asset", or "Asymmetric White-space" structures.
* Encourage asymmetry, scale contrast, overlap, or grid breaks.
* Use negative space deliberately (or controlled density if maximalist).

### Rule 4: Materiality & Surfaces
* **DASHBOARD HARDENING:** For `VISUAL_DENSITY > 7`, generic card containers are BANNED. Use `border-t`, `divide-y`, or negative space. Data metrics breathe without boxes unless elevation is functionally required.
* Use cards ONLY when elevation communicates hierarchy. When a shadow is used, tint it to the background hue.
* Add texture or depth when appropriate (noise, grain, subtle patterns). Use shadows/glows only when they serve the concept.

### Rule 5: Interactive UI States
LLMs naturally generate "static" success states. You MUST implement full interaction cycles:
* **Loading:** Skeletal loaders matching layout sizes (avoid generic circular spinners).
* **Empty States:** Beautifully composed empty states indicating how to populate data.
* **Error States:** Clear, inline error reporting (e.g., forms).
* **Tactile Feedback:** On `:active`, use `-translate-y-[1px]` or `scale-[0.98]` to simulate a physical push.

### Rule 6: Data & Form Patterns
* Label MUST sit above input. Helper text optional. Error text below input. Use `gap-2` for input blocks.

## 5. Motion & Creative Implementation

### Motion by Intensity Level

| Level | Approach |
|-------|----------|
| 1–3 (Static) | No automatic animations. CSS `:hover` and `:active` states only. |
| 4–7 (Fluid CSS) | `transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)`. `animation-delay` cascades for load-ins. `transform` and `opacity` only. |
| 8–10 (Choreography) | Complex scroll-triggered reveals, parallax. Use Framer Motion hooks (React) or GSAP. NEVER use `window.addEventListener('scroll')`. |

### Motion Principles
* Use motion sparingly but meaningfully. Favor one standout interaction over many tiny ones.
* Honor `prefers-reduced-motion`.
* **Spring Physics:** No linear easing. Use `type: "spring", stiffness: 100, damping: 20` for a premium, weighty feel.
* **Staggered Orchestration:** Do not mount lists/grids instantly. Use `staggerChildren` (Framer) or CSS cascade (`animation-delay: calc(var(--index) * 100ms)`) for sequential reveals.
* **Layout Transitions (React):** Use Framer Motion's `layout` and `layoutId` props for smooth re-ordering and shared element transitions.

### Advanced Techniques (When `MOTION_INTENSITY > 5`)
* **"Liquid Glass" Refraction:** Beyond `backdrop-blur` — add `border-white/10` and `shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]` for physical edge refraction.
* **Magnetic Micro-physics:** Buttons that pull toward the cursor. **CRITICAL (React):** Use Framer Motion's `useMotionValue` / `useTransform` exclusively — NEVER `useState` for continuous animations.
* **Perpetual Micro-Interactions:** Embed infinite micro-animations (Pulse, Typewriter, Float, Shimmer) in standard components to make the UI feel "alive".

### Framework Boundaries
* **CRITICAL:** Never mix GSAP/ThreeJS with Framer Motion in the same component tree. Default to Framer Motion for UI interactions. Use GSAP/ThreeJS exclusively for isolated scrolltelling or canvas backgrounds, wrapped in strict `useEffect` cleanup blocks.

## 6. Performance Guardrails

* **DOM Cost:** Apply grain/noise filters exclusively to fixed, `pointer-events-none` pseudo-elements — NEVER to scrolling containers.
* **Hardware Acceleration:** Never animate `top`, `left`, `width`, or `height`. Animate exclusively via `transform` and `opacity`.
* **Z-Index Restraint:** Use z-indexes strictly for systemic layer contexts (Sticky Navbars, Modals, Overlays). No arbitrary `z-50` spam.
* **Perpetual Motion (React):** Any infinite loop MUST be memoized (`React.memo`) and isolated in its own Client Component. Never trigger re-renders in the parent layout.

## 7. The Forbidden Patterns (AI Tells)

To guarantee premium, non-generic output, strictly avoid these unless explicitly requested:

### Visual & CSS
* **NO Neon/Outer Glows.** Use inner borders or subtle tinted shadows instead.
* **NO Pure Black.** Never `#000000`. Use Off-Black, Zinc-950, or Charcoal.
* **NO Oversaturated Accents.** Desaturate accents to blend elegantly with neutrals.
* **NO Excessive Gradient Text** on large headers.
* **NO Custom Mouse Cursors.** Outdated, ruins performance/accessibility.
* **NO Cookie-cutter hero + 3-card layouts.**
* **NO Unmotivated decorative elements.**

### Typography
* **NO Inter Font.** Use `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`.
* **NO Oversized H1s** that scream. Control hierarchy with weight and color, not just massive scale.
* **Serif Constraints:** Serif ONLY for creative/editorial. NEVER on Dashboards.

### Layout
* **NO 3-Column Card Layouts.** The generic "3 equal cards horizontally" row is BANNED. Use 2-column Zig-Zag, asymmetric grid, or horizontal scrolling.
* Padding and margins must be mathematically perfect. No awkward gaps.

### Content & Data (The "Jane Doe" Effect)
* **NO Generic Names.** "John Doe", "Sarah Chan" are banned. Use creative, realistic names.
* **NO Generic Avatars.** No SVG "egg" icons. Use creative photo placeholders or specific styling.
* **NO Fake Round Numbers.** Not `99.99%` or `50%`. Use organic data (`47.2%`, `+1 (312) 847-1928`).
* **NO Startup Slop Names.** "Acme", "Nexus", "SmartFlow" are banned. Invent premium, contextual brand names.
* **NO Filler Words.** "Elevate", "Seamless", "Unleash", "Next-Gen" are banned. Use concrete verbs.

### External Resources
* **NO Unsplash Links.** Use `https://picsum.photos/seed/{random_string}/800/600` or SVG placeholders.
* **Production-Ready Cleanliness:** Code must be clean, visually striking, and meticulously refined.

## 8. Creative Arsenal (High-End Inspiration)

Pull from this library of advanced concepts for visually striking output:

### Hero Sections
* Stop doing centered text over a dark image. Try asymmetric layouts: text aligned left/right, background with stylistic fade into the base color.

### Navigation
* **Mac OS Dock Magnification** — icons scale fluidly on hover
* **Magnetic Button** — physically pulls toward cursor
* **Gooey Menu** — sub-items detach like viscous liquid
* **Dynamic Island** — pill-shaped component morphing to show status
* **Contextual Radial Menu** — circular menu at click coordinates
* **Mega Menu Reveal** — full-screen dropdowns with stagger-fade

### Layout & Grids
* **Bento Grid** — asymmetric tile grouping (Apple Control Center style)
* **Masonry Layout** — staggered grid without fixed row heights
* **Chroma Grid** — borders/tiles with continuously animating color gradients
* **Split Screen Scroll** — two halves sliding in opposite directions on scroll
* **Curtain Reveal** — hero parting in the middle like a curtain on scroll

### Cards & Containers
* **Parallax Tilt Card** — 3D tilt tracking mouse coordinates
* **Spotlight Border Card** — borders illuminate under cursor
* **Glassmorphism Panel** — true frosted glass with inner refraction borders
* **Holographic Foil Card** — iridescent rainbow reflections shifting on hover
* **Morphing Modal** — button that expands into its own full-screen dialog

### Scroll Animations
* **Sticky Scroll Stack** — cards stick and physically stack over each other
* **Horizontal Scroll Hijack** — vertical scroll → smooth horizontal gallery pan
* **Zoom Parallax** — central image zooming in/out on scroll
* **Scroll Progress Path** — SVG lines drawing themselves as user scrolls
* **Liquid Swipe Transition** — page transitions that wipe like viscous liquid

### Galleries & Media
* **Coverflow Carousel** — 3D carousel, center focused, edges angled back
* **Accordion Image Slider** — narrow strips expanding fully on hover
* **Hover Image Trail** — mouse leaves a trail of popping/fading images
* **Glitch Effect Image** — RGB-channel shifting distortion on hover

### Typography & Text
* **Kinetic Marquee** — endless text reversing/speeding on scroll
* **Text Mask Reveal** — large type as transparent window to video background
* **Text Scramble Effect** — Matrix-style character decoding on load/hover
* **Circular Text Path** — text curved along a spinning circular path
* **Gradient Stroke Animation** — outlined text with gradient running along stroke

### Micro-Interactions
* **Particle Explosion Button** — CTAs shatter into particles on success
* **Skeleton Shimmer** — shifting light across placeholder boxes
* **Directional Hover Button** — fill enters from the exact side the mouse entered
* **Ripple Click Effect** — waves rippling from click coordinates
* **Animated SVG Line Drawing** — vectors drawing their own contours in real-time
* **Mesh Gradient Background** — organic lava-lamp animated color blobs

## 9. Dial Reference (Detailed)

### DESIGN_VARIANCE (1–10)
* **1–3 (Predictable):** Centered layouts, strict 12-column symmetrical grids, equal paddings.
* **4–7 (Offset):** Overlapping margins, varied aspect ratios, left-aligned headers over center-aligned data.
* **8–10 (Asymmetric):** Masonry, CSS Grid with fractional units (`2fr 1fr 1fr`), massive empty zones.
* **MOBILE OVERRIDE (4–10):** Any asymmetric layout above `md:` MUST fall back to strict single-column (`w-full`, `px-4`, `py-8`) on viewports < 768px.

### MOTION_INTENSITY (1–10)
* **1–3:** No automatic animations. `:hover` / `:active` only.
* **4–7:** CSS transitions with cubic-bezier. `animation-delay` cascades. `transform` + `opacity` only. Sparing `will-change: transform`.
* **8–10:** Scroll-triggered reveals, parallax, Framer Motion hooks or GSAP. No raw scroll listeners.

### VISUAL_DENSITY (1–10)
* **1–3 (Art Gallery):** Generous white space, huge section gaps, expensive and clean.
* **4–7 (Daily App):** Standard web app spacing.
* **8–10 (Cockpit):** Tiny paddings, no card boxes — 1px lines to separate. Everything packed. **Mandatory:** `font-mono` for all numbers.

## 10. Deliverables

- Provide full code with file names or component boundaries
- Make customization easy with CSS variables or config objects
- If assets are needed, provide inline SVGs or generative CSS patterns
- Semantic & accessible: headings, labels, focus states, keyboard nav
- Responsive: fluid layouts, breakpoints, responsive typography

## 11. Pre-Flight Checklist

Before outputting, validate against this matrix:
- [ ] Aesthetic direction is unmistakable and consistently executed
- [ ] Typography feels intentional and expressive (no Inter, no defaults)
- [ ] Color palette is cohesive, legible, and has max 1 accent
- [ ] Layout and spacing are consistent and purposeful
- [ ] Mobile layout collapse is guaranteed for high-variance designs
- [ ] Full-height sections use `min-h-[100dvh]` not `h-screen`
- [ ] Loading, empty, and error states are provided
- [ ] Cards omitted in favor of spacing where possible
- [ ] Interactions enhance the experience without clutter
- [ ] `useEffect` animations contain strict cleanup functions (React)
- [ ] CPU-heavy perpetual animations are isolated in own components (React)
- [ ] Code runs as provided and is production-ready
- [ ] No forbidden patterns (Section 7) present
