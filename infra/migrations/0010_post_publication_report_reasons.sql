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
COMMIT;
