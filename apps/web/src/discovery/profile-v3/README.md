# Profile Morph V3 foundation

An isolated prototype at `/profile-v3-preview.html` under the web Vite dev server. It uses an embedded synthetic SVG and does not enter LUEMI routes or access user media. This is a motion and geometry foundation, not the accepted A2 UI or a production profile.

Run `node scripts/profile-v3-foundation.test.mjs` and `npm run build -w @luemi/contracts && npm run typecheck -w @luemi/web`. Start `npm run dev -w @luemi/web` for the prototype. Run `node scripts/profile-v3-browser-smoke.mjs` when Playwright Chromium is installed.

Interfaces: `createProfileLayout(viewport)`, `photoMask(layout,p)`, `photoOffset(layout,p,w,h)`, `ProfileMotionEngine`, `ProfileGestureCoordinator`, and `ProfileMorphSurfaceProps`. The surface consumes only synthetic `ProfileSurfaceData` here. Real data must first pass through `ProfileModel.projectProfile` in the later integration stage.
