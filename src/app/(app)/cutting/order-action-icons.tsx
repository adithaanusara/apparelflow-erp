// Icons for the order actions, drawn on a 24px grid with round 2px strokes.
// `size-4 shrink-0` keeps them the same size as the cap height of the label
// beside them, so icon and text sit on one centre line.

const iconProps = {
  "aria-hidden": true,
  viewBox: "0 0 24 24",
  className: "size-4 shrink-0",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function PencilIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 20h4.2L19.3 8.9a1.5 1.5 0 0 0 0-2.1l-2.1-2.1a1.5 1.5 0 0 0-2.1 0L4 15.8V20Z" />
      <path d="m13.5 6.3 4.2 4.2" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8V7" />
      <path d="m6 7 .9 12.1a1.5 1.5 0 0 0 1.5 1.4h7.2a1.5 1.5 0 0 0 1.5-1.4L18 7" />
      <path d="M10 11v5.5M14 11v5.5" />
    </svg>
  );
}
