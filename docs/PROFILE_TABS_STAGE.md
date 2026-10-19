# LUEMI · Profile Tabs · v5

## Approved navigation

The five tabs remain directly below the expanded photo: **О себе**, **Блики**, **Фото**, **Аккаунт**, **Подарки**. The rail uses five equal-width cells and stays within the profile width. The selected tab keeps its existing accessible name and keyboard behavior (Left/Right/Home/End).

## Motion ownership

- The profile still has one native vertical scroller and one continuous hero photo. Its scroll-snap anchors and CSS photo morph remain independent from horizontal tab navigation.
- The tab panels use native horizontal overflow and mandatory scroll snap. The browser follows a finger and settles on a panel. IntersectionObserver updates the selected tab after a marker is visible; a pending click target prevents intermediate panels from taking selection during a programmatic tab change.
- The viewport stretches every panel to the tallest panel. It has no active-panel ResizeObserver height writes. The vertical page scroll position is not changed when a tab is activated.
- When a stranger profile has a fixed bottom action bar, the tab root receives matching trailing padding. That keeps its existing end snap area beyond the last card, so the CTA does not cover the final gallery row.
- A single glass indicator sits in the rail. The horizontal viewport publishes the `--luemi-tabs-x` scroll timeline and CSS translates the indicator between the five cells. Reduced motion keeps its position movement but removes the elastic width stretch. Browsers without scroll-timeline support retain the static active-tab treatment.
- The rail is opaque over its painted gradient and uses the profile background as its base. Its sticky offset accounts for the scroller's existing hero top padding, keeping it close to the compact photo header. The tab root's existing snap anchor uses a dynamic scroll margin so it aligns with the closed-photo marker; this removes the competing stop while retaining the existing anchor and mandatory snap model.
- No pointer handlers, timers, animation frames, scrollTo calls, backdrop blur, blend modes, masks, or will-change declarations are used by the tab system.

## Content and photo preview

- **О себе** shows real profile facts, biography, interests, goal, shared interests when available, and up to three real photo thumbnails.
- **Блики** and **Подарки** remain honest empty collections; no publication, gift inventory, purchase, or Stars action is enabled.
- **Фото** opens the shared full-screen native-dialog viewer. The viewer has its own horizontal native snap strip, image counter, keyboard navigation, pinch/double-tap zoom, pan, downward dismiss gesture, and photo action sheet. Reports and blocks reuse the existing app dialogs.
- The account tab only displays permitted public profile facts. It does not expose the birth date or service identifiers.

## Verification and limits

The repository checks cover formatting, types, source architecture, tests, build and API smoke. The profile browser workflow runs at 393×852 with mobile touch emulation. These checks do not prove actual finger tracking, scroll chaining, FPS, or optical finish on a Galaxy A55 in Chrome or Telegram WebView. Those need physical-device review.

The existing vertical snap anchors and mandatory snap mode were retained; the tab-root snap area now aligns with the closed marker. Further changes to those anchors should wait for a physical-device recording if it shows a pause or jump.

## Boundaries

No new data model, database, dependency, secret, payment, Stars action, or server-side moderation behavior is introduced. Existing approved brand assets and the profile photo morph algorithm are retained. VEYRA and blotX are outside this work.
