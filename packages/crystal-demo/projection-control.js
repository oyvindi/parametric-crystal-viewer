/**
 * Adds the shared projection selector used by the standalone viewer demos.
 * Paired comparison demos pass both viewers so their framing stays comparable.
 */
import "bootstrap/dist/css/bootstrap.css";

export function installProjectionControl(viewers) {
  document.body.classList.add("has-projection-control");
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
