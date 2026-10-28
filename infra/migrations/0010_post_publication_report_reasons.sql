-- Post-publication report reasons for real LUEMI adult users.
-- Expand the accepted taxonomy without changing rows, private Storage or RLS.
BEGIN;
ALTER TABLE luemi_private.reports
 DROP CONSTRAINT reports_reason_code_check;
ALTER TABLE luemi_private.reports
 ADD CONSTRAINT reports_reason_code_check CHECK (
  reason_code IN ('spam','harassment','impersonation','unsafe_media',
   'minor_suspected','nonconsensual_photo')
 );
-- Retain actual post-publication report triage and suspension capability.
-- Existing human_report_reviews and account_enforcements rows are preserved.
ALTER TABLE luemi_private.human_report_reviews
 DROP CONSTRAINT human_report_reviews_reason_code_check;
ALTER TABLE luemi_private.human_report_reviews
 ADD CONSTRAINT human_report_reviews_reason_code_check CHECK (
  reason_code IN ('spam','harassment','impersonation','unsafe_media',
   'minor_suspected','nonconsensual_photo','no_violation')
 );
ALTER TABLE luemi_private.account_enforcements
 DROP CONSTRAINT account_enforcements_reason_code_check;
ALTER TABLE luemi_private.account_enforcements
 ADD CONSTRAINT account_enforcements_reason_code_check CHECK (
  reason_code IN ('spam','harassment','impersonation','unsafe_media',
   'minor_suspected','nonconsensual_photo')
 );
COMMIT;
