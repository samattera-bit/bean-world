// Bean, as one painted character (the same art the diary pictures are matched to).
// Two layers: eyes open, and eyes closed (used for sleeping and the slow blink).
export function beanSVG() {
  return `
<div class="bean-art" aria-hidden="true">
  <div class="bean-shadow"></div>
  <div class="bean-body">
    <img class="bean-img bean-open" src="assets/bean-open.webp?v=2" alt="" draggable="false" />
    <img class="bean-img bean-closed" src="assets/bean-closed.webp?v=2" alt="" draggable="false" />
  </div>
</div>`;
}
