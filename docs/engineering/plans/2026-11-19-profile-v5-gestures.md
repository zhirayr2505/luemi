# Profile V5 gesture corrections

Preserve the owner and visitor endpoint layouts and palette. Change the shared
OwnerProfileGeometry mask to switch shape at the medium diameter. Drive tracking
from displacement, with no hold interval. Reserve bounce for docking.

In OwnerPremiumProfile, clip the horizontal track at the stationary sheet edge.
Give each mounted page its own native vertical viewport so committing a selection
cannot reposition the incoming page. Retain the existing gesture arbiter.

Verify the geometry contract, touch pause and reversal, release, cancellation,
independent photo paging and scrolled-to-empty transitions on both routes.
Run the repository CI and browser checks, then verify the main deployment.
Record physical Telegram results separately from Chromium emulation.
