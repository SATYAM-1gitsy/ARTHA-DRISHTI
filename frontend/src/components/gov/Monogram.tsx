/**
 * The institutional mark.
 *
 * Deliberately an original monogram and not the State Emblem of India: the
 * Ashoka lions are restricted by the State Emblem of India (Prohibition of
 * Improper Use) Act, 2005, and a prototype has no business wearing them. The
 * mark is an aperture — the "drishti" — over three ascending bars, which is
 * what the product actually does: it looks at expenditure and ranks it.
 *
 * Drawn inline rather than shipped as an asset so it inherits the theme
 * tokens, including high-contrast mode.
 */

export default function Monogram({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Artha Drishti — original prototype monogram, not a government emblem"
      focusable="false"
    >
      <rect x="0" y="0" width="48" height="48" rx="7" fill="var(--gov-navy)" />
      {/* the aperture */}
      <path
        d="M9 24c4.6-6.6 9.6-9.9 15-9.9S34.4 17.4 39 24c-4.6 6.6-9.6 9.9-15 9.9S13.6 30.6 9 24Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      {/* the ranked bars inside it */}
      <rect x="19.4" y="24.6" width="2.6" height="5.2" fill="var(--saffron)" />
      <rect x="22.9" y="21.4" width="2.6" height="8.4" fill="#ffffff" />
      <rect x="26.4" y="18.6" width="2.6" height="11.2" fill="var(--india-green)" />
    </svg>
  );
}
