# LUEMI — approved-asset import, phase 1

Source: original LUEMI W05 SVG icons preserved in LUEMI_SOURCE_2026-10-18.zip.

## Imported in this commit
12 functional W05 vector icons × 2 themes (Light/Dark), **24 actual independent SVG files**. Stroke, fill, geometry and theme colors follow the approved files. Consumed by main navigation and discovery actions. These assets are not new designs.

## Still to import
- Canonical W04 brand logo: `LUEMI_LOGO_SELECTED_01_ORIGINAL.png`, SHA-256 `4600f49935f180d44adee7a2dfe327ea45dece1760d60ac4d1f40456ef0debcc`.
- Full-resolution production derivative `wordmark_original_raster_alpha_W06.webp` still awaits an exact-byte transfer into the repository. A 256×89 transparent WebP preview now renders in both brand locations; source is the approved W06 raster alpha derivative, resized/compressed, **not** the untouched original, and is named `wordmark_W06_preview.webp`. Preview SHA-256: `f6347ecc35cc668e24d429d6ca028de6ea0e223ee67f9e191076d4c1b722343d`.
- Approved reference screens, W06–W12 UI, empty states, illustrations, premium LUME, motion SVG/CSS.

Never silently replace the original logo with a newly drawn vector. Before using each binary asset, compare against SHA-256 from the immutable source package.

Design pixel QA / mobile runtime visual acceptance remain pending. CI compilation does not equal design approval.

## Validation
The Stage 01 CI asserts that all 24 W05 SVGs exist and contain safe SVG roots, that the transparent preview WebP is byte-identical to the imported compressed asset, and that no source links use missing icon paths. This is structural asset QA, not pixel-perfect visual sign-off.
