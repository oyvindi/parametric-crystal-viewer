/**
 * Framework-agnostic Web Component wrapper for {@link CrystalViewer} (M7).
 *
 * The component is embeddable in plain HTML and supports multiple independent
 * instances on one page. Connection pauses rendering and detaches listeners
 * without disposing; reconnection resumes the previous rendering mode. Disposal
 * is permanent and reconnection does not reactivate a disposed component.
 *
 * Plain-HTML usage:
 *
 * ```html
 * <script type="module">
 *   import { defineCrystalViewerElement } from "@crystal/viewer";
 *   defineCrystalViewerElement();
 * </script>
 * <crystal-viewer mineral="quartz" style="width:600px;height:400px"></crystal-viewer>
 * ```
 */
import { CrystalViewer } from "./index.js";

const TAG = "crystal-viewer";

export class CrystalViewerElement extends HTMLElement {
    private viewer: CrystalViewer | null = null;
    private connectedFlag = false;

    static get observedAttributes(): readonly string[] {
        return ["mineral"];
    }

    connectedCallback(): void {
        this.connectedFlag = true;
        // A disposed component does not reactivate on reconnection.
        if (this.viewer?.isDisposed()) return;
        if (!this.viewer) {
            const canvas = document.createElement("canvas");
            canvas.style.display = "block";
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            this.appendChild(canvas);
            this.viewer = new CrystalViewer(canvas);
            const mineral = this.getAttribute("mineral");
            if (mineral) void this.viewer.loadMineral(mineral);
        } else {
            this.viewer.reconnect();
        }
        this.dispatchEvent(new CustomEvent("viewer-ready", { detail: { viewer: this.viewer } }));
    }

    disconnectedCallback(): void {
        this.connectedFlag = false;
        this.viewer?.disconnect();
    }

    attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
        if (name !== "mineral" || !this.connectedFlag) return;
        if (value && this.viewer && !this.viewer.isDisposed()) void this.viewer.loadMineral(value);
    }

    /** The underlying viewer instance, or null before connection. */
    getViewer(): CrystalViewer | null {
        return this.viewer;
    }

    /** Permanently releases viewer-owned resources. Repeated calls are harmless. */
    dispose(): void {
        this.viewer?.dispose();
    }

    /** Whether the underlying viewer has been disposed. */
    isDisposed(): boolean {
        return this.viewer?.isDisposed() ?? false;
    }
}

/** Registers the `<crystal-viewer>` custom element. Idempotent. */
export function defineCrystalViewerElement(): void {
    if (!customElements.get(TAG)) customElements.define(TAG, CrystalViewerElement);
}
