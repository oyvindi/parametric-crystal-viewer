/**
 * Adds the shared projection selector used by the standalone viewer demos.
 * Paired comparison demos pass both viewers so their framing stays comparable.
 */
export function installProjectionControl(viewers) {
  const control = document.createElement("div");
  control.className = "projection-topbar";
  control.innerHTML = `
    <label for="projection-select">Projection
      <select id="projection-select">
        <option value="perspective">Perspective</option>
        <option value="orthographic">Orthographic</option>
      </select>
    </label>`;
  document.body.append(control);

  const select = control.querySelector("select");
  const sync = () => { select.value = viewers[0].getProjection(); };
  select.addEventListener("change", () => {
    for (const viewer of viewers) viewer.setProjection(select.value);
    sync();
  });
  for (const viewer of viewers) viewer.addEventListener("state-restored", sync);
  sync();
}

const style = document.createElement("style");
style.textContent = `
  .projection-topbar {
    position: fixed;
    inset: 0 0 auto;
    z-index: 20;
    display: flex;
    justify-content: flex-end;
    min-height: 44px;
    padding: 8px 18px;
    pointer-events: none;
    background: linear-gradient(to bottom, rgb(20 22 25 / 52%), transparent);
  }
  .projection-topbar label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #eee;
    font: 0.85rem system-ui, sans-serif;
    pointer-events: auto;
  }
  .projection-topbar select {
    min-width: 130px;
    padding: 4px 8px;
    color: #eee;
    background: #30343a;
    border: 1px solid #777;
    border-radius: 4px;
    font: inherit;
  }
`;
document.head.append(style);
