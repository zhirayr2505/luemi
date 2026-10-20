# LUEMI · «Блики» — future product discovery (not approved)

**Stage 03G:** only the user-visible empty state is in scope. The owner explicitly deferred the full feature, so the following are **questions**, not implementation decisions.

## Proposed concept to discuss later

“Блики” could be optional short moments or stories that express who a person is beyond their profile photos. Candidate surfaces: short caption with a photo, time-limited lightweight moment, pinning a few meaningful moments, small visual transitions. None of these formats, limits or lifetimes is approved.

Before engineering: separately approve media formats, size and quota; default privacy and audience; age gate and visibility; automatic expiry vs permanent storage; moderation/reporting and safety; archival/deletion; responses and contact consent; accessibility/reduced motion; server model and operational cost; gift/payment relationship (if any). Never add an implicit account activity score from Bliki without consent and an explicit product decision.

## Active Stage 03G rule

The ProfileMaster `bliki` tab shows an elegant **“Пока нет бликов / Функция готовится”** placeholder. It does not upload, publish, fake content, charge, notify, or infer account activity. Existing discovery and avatar animations remain unaffected.
