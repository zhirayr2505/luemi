# LUEMI Profile: One-Photo Continuous Morph · 2026-10-19

## Root cause
In Motion V4, `ProfileMotion.tsx` rendered the gallery portrait inside
`.profile-morph-photo` and **another portrait** inside
`.profile-morph-avatar`. The CSS timeline faded the first image to zero before
the second image became fully visible. In the owner's Android screenshots this
appeared as an unrelated photo replacing the original, not a morph.

The compact info bar also used almost opaque fill (0.91–0.97 alpha), so it
looked like a regular card rather than LUEMI Liquid Glass.

## Implemented
- Removed **all** duplicate avatar photo markup, state and its CSS animation.
  Exactly one DOM photo gallery exists for the expanded and collapsed profile.
- The same image is scaled continuously from 1 to `56 / frameWidth`; the profile
  photo opacity stays 1 throughout the timeline. The face's crop does not jump.
- At 65–100% of collapse, its clipping rounds into a circle. This is the
  **only exception** to the project's transform/opacity preference: interpolating
  corner clipping is necessary to morph a single image from rounded rectangle
  to perfect circle. The expensive clipping change is delayed until the raster
  is small, unlike a whole-screen border-radius animation.
- A separate **border-only** 56px circular rim fades in at the end; it never
  contains photography. It keeps the perceived 1.5px Liquid Glass outline.
- Rebuilt the name/location capsule with translucent glass gradients, an
  independent stationary specular highlight, thin internal reflective border,
  light/dark variants. No moving mask/backdrop/mix-blend/SVG filters.
- Left native CSS snap (browser threshold), gallery gestures and other screens
  unchanged. Kept the single scroll-timeline animation owner.

## Verification
CI: Prettier, typecheck, unit tests, production build and smoke must pass before
release. Unit tests now assert that the expanded and collapsed profile share
one photo, the fallback scale remains continuous and the capsule's light
reflection layers exist.

**Not automatically proven:** 55–60 FPS or final appearance on the owner's
Galaxy A55 in Chrome/Telegram. Compare actual screen recording rather than
treating build green as acceptance.

## Scope
LUEMI only. No VEYRA, blotX, Supabase, payment, bot or «Блики» changes.
