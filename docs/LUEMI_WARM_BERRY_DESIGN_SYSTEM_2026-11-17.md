# LUEMI Warm Berry — approved design system

Status: **APPROVED**  
Approved by: LUEMI project owner  
Date: 2026-11-17

## Design identity

Official name: **LUEMI Warm Berry**.

Warm Berry is the approved warm plum / berry evolution of LUEMI's Badoo Purple direction. It replaces the previous gray-lilac, low-saturation appearance with deeper plum surfaces, richer violet glass and warmer blush/rose accents.

## Core palette

| Semantic role | Hex / value |
| --- | --- |
| Deep Plum background | `#1A0A2A` |
| Main background | `#26103E` |
| Top background | `#351451` |
| Surface | `#421B6B` |
| Raised surface | `#54247F` |
| Glass | `#613090` |
| Primary Badoo Purple | `#6E3EFF` |
| Lavender | `#BCA8F2` |
| Blush / rose | `#FFBBD0` |
| Main text | `#FFF8FF` |
| Secondary text | `#F3E8FC` |
| Muted text | `#D4BBDD` |

## Application

Warm Berry is the single visual source of truth for the Telegram Mini App, including:
- App shell and Telegram browser theme color
- Discovery feed, profile cards, Profile Morph V3 surfaces and bottom navigation
- Chats list, conversation bubbles, composer and action states
- Registration, interest chips, profile preview and publication journey
- Liquid Glass panels, outlines, shadows, focus and loading states

## Visual rules

1. No neon, acid colors, excessive glow or gray as a dominant surface/text color.
2. Use plum and violet for depth; reserve blush, rose and coral for selective warmth and meaningful accents.
3. Keep warm-white and lilac text readable against its actual surface; normal text requires WCAG AA contrast of at least 4.5:1.
4. Color is never the only carrier of a status; keep text/icons/semantics.
5. Keep the original raster LUEMI wordmark. Never recreate or recolor the logo.
6. Do not use color work as a reason to alter layout geometry, typography, motion, gestures, safe areas, keyboard behavior, or Profile Morph V3.
7. Use semantic CSS tokens wherever possible; avoid introducing one-off hardcoded brand colors.

## Preserved product constraints

- Single dark appearance remains the product default.
- Profile Morph V3 and discovery gestures remain unchanged.
- Existing Telegram authentication, API, database, RLS, media privacy and server contracts are unchanged.
- The design is intended to render consistently in Android Telegram WebView and iOS Telegram WKWebView.

## Implementation references

- `apps/web/src/ui/luemi-v5.css` — semantic palette and shared surfaces.
- `apps/web/src/ui/liquid-glass.css` — shared optical material.
- `apps/web/src/discovery/moonstone-discovery.css` — Discovery and bottom navigation.
- `apps/web/src/discovery/profile-v3/rendering/ProfileMorphSurface.css` — Profile Morph surface tokens.
- `apps/web/src/chats/chats.css` — chats and conversation surfaces.
- `apps/web/src/registration/v2/runtime.css` and `preview.css` — registration and profile preview.
- `apps/web/src/registration/publication-journey.css` — post-registration publication journey.
- `apps/web/index.html` — Telegram browser theme color.

Warm Berry supersedes the previous gray-lilac V5 color treatment. It does not supersede the approved layout, logo, motion or interaction specifications.
