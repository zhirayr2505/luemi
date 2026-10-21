# Archived historical profile QA scripts

The exact historical Stage03G3/G4/G5/G6 visual scripts are preserved byte-for-byte here for forensic reference. They check removed selectors, renderer assumptions and obsolete visual behavior; **none is run by the current QA workflow or silently reported as passing**.

The required active Android-UA browser behavioral scenario is `scripts/stage03g7-android-visual-qa.mjs`, implemented by `scripts/rem-00c-browser-behavior.mjs` and run by the `Browser profile QA (REM-00C behavioral)` GitHub Actions job. The CI script asserts both real DOM interactions and absence of runtime errors. It uses deterministic local QA images, a labeled Telegram mock for App-level bootstrap and a negative missing-selector fixture. Results from Chromium emulation are not real Samsung A55/iOS measurements.

Never run these legacy scripts by branch-name auto-selection. React/DOM behavior changed between stages; to reinstate an old assertion, review against current source and explicitly make it a current CI test.
