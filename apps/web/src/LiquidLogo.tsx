/** Static W06 approved image, rim rendered into the asset once. */
const WORDMARK = '/assets/brand/derivatives/wordmark_static_rim_W06.webp';

export function LiquidLogo() {
  return (
    <span className="logo-island" role="img" aria-label="luemi">
      <img className="logo-island-wordmark" src={WORDMARK} alt="" draggable="false" />
    </span>
  );
}