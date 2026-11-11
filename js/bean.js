// Bean, drawn as a small inline SVG. Purely visual.
export function beanSVG() {
  return `
<svg class="bean-svg" viewBox="0 0 100 120" aria-hidden="true" focusable="false">
  <ellipse class="bean-shadow" cx="50" cy="113" rx="30" ry="5" />
  <g class="bean-feet">
    <ellipse class="foot foot-l" cx="38" cy="108" rx="9" ry="5" />
    <ellipse class="foot foot-r" cx="62" cy="108" rx="9" ry="5" />
  </g>
  <g class="bean-body">
    <path class="sprout-stem" d="M51 20 C51 14 52 10 54 6" />
    <path class="sprout-leaf" d="M54 7 C60 1 70 2 72 6 C66 11 59 11 54 7 Z" />
    <path class="body" d="M52 18 C79 18 90 40 89 64 C88 91 72 106 50 106 C27 106 12 92 12 68 C12 52 21 47 23 37 C26 25 36 18 52 18 Z" />
    <path class="belly" d="M50 58 C66 58 75 70 74 84 C73 96 62 101 50 101 C38 101 28 95 28 83 C28 70 36 58 50 58 Z" />
    <g class="eyes open">
      <circle cx="40" cy="55" r="3.8" />
      <circle cx="62" cy="55" r="3.8" />
      <circle class="glint" cx="41.2" cy="53.6" r="1.1" />
      <circle class="glint" cx="63.2" cy="53.6" r="1.1" />
    </g>
    <g class="eyes closed">
      <path d="M35.5 56 Q40 59.5 44.5 56" />
      <path d="M57.5 56 Q62 59.5 66.5 56" />
    </g>
    <ellipse class="cheek" cx="32" cy="65" rx="6" ry="3.6" />
    <ellipse class="cheek" cx="70" cy="65" rx="6" ry="3.6" />
    <path class="smile" d="M46 64 Q51 68.5 56 64" />
  </g>
</svg>`;
}
