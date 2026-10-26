# Profile Morph V3 architecture decision

## Directed audit at main c8c3399

| Source | DOM / animated properties | Writer | Gesture owner / cleanup |
| --- | --- | --- | --- |
| `ProfileMorphA2.tsx` + `profile-morph-a2-motion.ts` | `.pm-a2-sheet` transform; `.pm-a2-face` translate and nonuniform scale; inner viewport counter `scaleY`; compact/expanded text and backdrop opacity; dots | `paint()` via A2 RAF engine | handle pointer candidate/claim; effect disposes engine, observer, viewport listeners |
| `profile-morph-a2-geometry.ts` | sheet span and photo transform factors | pure calculation used by A2 paint | none |
| `ProfileMorphBackground.tsx` + A2 CSS | two bounded photo slots, opacity transition, `scale(6)` with blur | React decode effects and CSS | effects cancel RAF/timer; potential raster cost |
| `ProfileMorphA2.tsx` photo and tab tracks | horizontal transform and CSS transition; ink width/transform | `choosePhoto`, `chooseTab`, slide handlers | `GestureArbiter`; native scroll inside `.pm-a2-page` |
| `VisitorProfileRoute.tsx` + `discovery.css` | route translateX, CSS transition; modal backing | route `MotionController` / authority | route pointer claim, deferred touch suppression; route timer cleanup |
| `DiscoveryApp.tsx` + `GlobalHeader.tsx` | browse tracks, header contrast and route entrance | browse controller and header ref | browse / route gestures; do not connect prototype |
| `PhotoViewer.tsx` | viewer track, source morph, pan/pinch | viewer controller and DOM handlers | own modal capture and cleanup; do not connect prototype |

The A2 combination of a nonuniformly scaled clipping ancestor, inner counter scale, overflow, dynamic border radius, and separately translated photo track has no single simple pixel mapping. Android device evidence reports missing/clipped media and portrait rectangles. PR #87 removes one risky transform but remains experimental and is not merged. A2 also applies a scaled blurred background image. Route and sheet each have distinct owners yet share gesture candidates at the profile boundary. In V3 the foreground properties have one imperative painter; React only changes decorative selected tab state in the prototype.

## Choice

1. **One persistent IMG, independent rectangular mask:** use intrinsic cover dimensions calculated once from supplied source width/height and expanded hero geometry. The IMG receives translation only; the mask receives explicit rect and radius. Its width and height maintain the source aspect ratio. The photograph does not switch `src` during progress, and the backdrop is a static gradient.
2. **Prepared compact and expanded surfaces:** can keep fixed rasters and translate or crossfade them, but costs two decoded surfaces and risks visible duplication or a seam at intermediate progress. It also needs coordinated source identity and decode gates. Deferred until actual device evidence demands it.

Choose 1 for simpler ownership and one decoded image. This removes the A2 nested nonuniform transform and per-frame blur. Changing mask bounds causes layout/paint work; [Chrome's performance guidance](https://developer.chrome.com/blog/performant-expand-and-collapse) warns that animating width/height can miss frames. This is an explicit unresolved A55 performance risk, not a claim of hardware smoothness.

The image's explicit rendered size is proportional to its intrinsic dimensions. The CSS `object-fit: fill` is harmless only because both dimensions retain the same scale, unlike arbitrary fill dimensions. The cover equation and intermediate crops are tested. On integration, obtain intrinsic dimensions from authorized media metadata or decoded IMG before enabling interaction; unknown/failed dimensions need a placeholder, never a guessed aspect.

## Layers and writers

| z | Layer | Frame changes |
| --- | --- | --- |
| 0 | opaque root/backing | none |
| 1 | static gradient ambient | none |
| 2 | clipped hero: mask bounds/radius, IMG translation, two identity opacities | one surface painter |
| 3 | white sheet, tabs and native content scroll | sheet translateY by same painter; tab selection in React |
| later | modal PhotoViewer | outside V3 foundation |

`p ∈ [0,1]` is owned by one `ProfileMotionEngine`. State: COMPACT → DRAGGING → SETTLING_TO_EXPANDED → EXPANDED, reversible in either direction; SUSPENDED and DISPOSED are lifecycle states. Each interruption samples current progress, increments generation, cancels RAF and repaints before continuing. Viewport rebase preserves the physical panel Y while active. The root remains opaque; no transparent path to Discovery is part of this prototype.

Gesture coordinator yields one owner from candidate movement: handle vertical → SHEET; photo horizontal → PHOTO; tab/content horizontal → TABS; content vertical → NATIVE_SCROLL; route horizontal → ROUTE_BACK. The prototype actually wires only SHEET. The other decisions are typed reservations for integration, not implemented galleries or route navigation. Capture is requested only after vertical sheet claim. No global touch action is disabled.

## Reference and fallback

The attached A2 image is a visual target; this synthetic prototype is not pixel accepted. There is no per-frame expensive blur and no universal `will-change`. If the measured Android mask repaint is too slow, the later integration must test a simpler photo composition with intact foreground and sheet before replacing the renderer. Avoid hiding/replacing the IMG as a fallback without device evidence.
