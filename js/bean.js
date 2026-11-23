// Pinto, as one painted character (the same art the diary pictures are matched to).
// Four layers: front open, front closed (blink/sleep), 3/4 left turn (showing back-left cutout), and back view.
export function beanSVG() {
  return `
<div class="bean-art" aria-hidden="true">
  <div class="bean-shadow"></div>
  <div class="bean-body">
    <img class="bean-img bean-open" src="assets/bean-open.webp?v=4" alt="" draggable="false" />
    <img class="bean-img bean-closed" src="assets/bean-closed.webp?v=4" alt="" draggable="false" />
    <img class="bean-img bean-turn" src="assets/bean-turn.webp?v=4" alt="" draggable="false" />
    <img class="bean-img bean-back" src="assets/bean-back.webp?v=4" alt="" draggable="false" />
  </div>
</div>`;
}
