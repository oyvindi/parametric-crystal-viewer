// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene, PerspectiveCamera } from "three";
import { CrystalViewerElement, defineCrystalViewerElement } from "./component.js";

// Stub only the GPU/browser boundary; keep real scenes, cameras, and geometry.
const { render } = vi.hoisted(() => ({ render: vi.fn<(scene: Scene, camera: PerspectiveCamera) => void>() }));
vi.mock("three", async (importOriginal) => {
    const actual = await importOriginal<typeof import("three")>();
    return {
        ...actual,
        WebGLRenderer: class {
            domElement: HTMLCanvasElement;
            constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas; }
            setSize() {}
            render = render;
            dispose() {}
        },
    };
});

const elements: CrystalViewerElement[] = [];
afterEach(() => {
    for (const el of elements) {
        el.dispose();
        el.remove();
    }
    elements.splice(0);
    render.mockClear();
});

function mount(mineral?: string): CrystalViewerElement {
    defineCrystalViewerElement();
    const el = document.createElement("crystal-viewer") as CrystalViewerElement;
    el.style.width = "400px";
    el.style.height = "300px";
    if (mineral) el.setAttribute("mineral", mineral);
    document.body.appendChild(el);
    elements.push(el);
    return el;
}

describe("M7 Web Component embedding", () => {
    it("embeds in plain HTML and loads a mineral declared as an attribute", async () => {
        const el = mount("quartz");
        await vi.waitFor(() => expect(el.getViewer()?.getMineralId()).toBe("quartz"));
        expect(el.getViewer()!.getViewMode()).toBe("morphology");
        // The component created a canvas child.
        expect(el.querySelector("canvas")).not.toBeNull();
    });

    it("reloads when the mineral attribute changes", async () => {
        const el = mount("quartz");
        await vi.waitFor(() => expect(el.getViewer()?.getMineralId()).toBe("quartz"));
        el.setAttribute("mineral", "fluorite");
        await vi.waitFor(() => expect(el.getViewer()?.getMineralId()).toBe("fluorite"));
    });
});

describe("M7 two-instance isolation", () => {
    it("keeps configuration, selection, and lifecycle independent across instances", async () => {
        const a = mount("quartz");
        const b = mount("calcite");
        await vi.waitFor(() => expect(a.getViewer()?.getMineralId()).toBe("quartz"));
        await vi.waitFor(() => expect(b.getViewer()?.getMineralId()).toBe("calcite"));
        expect(a.getViewer()).not.toBe(b.getViewer());

        // Mutating instance a does not affect instance b.
        await a.getViewer()!.loadMineral("fluorite");
        expect(a.getViewer()!.getMineralId()).toBe("fluorite");
        expect(b.getViewer()!.getMineralId()).toBe("calcite");

        // A state snapshot from a does not reproduce on b.
        const stateA = a.getViewer()!.getState();
        expect(stateA.mineral!.id).toBe("fluorite");
        expect(b.getViewer()!.getState().mineral!.id).toBe("calcite");
    });
});

describe("M7 Web Component lifecycle", () => {
    it("disconnect preserves configuration and reconnect restores it without reactivating a disposed component", async () => {
        const el = mount("quartz");
        await vi.waitFor(() => expect(el.getViewer()?.getMineralId()).toBe("quartz"));
        el.getViewer()!.setHabit("tessin");
        const before = el.getViewer()!.getState();

        el.remove(); // disconnectedCallback
        expect(el.getViewer()!.isDisconnected()).toBe(true);

        document.body.appendChild(el); // connectedCallback → reconnect
        expect(el.getViewer()!.isDisconnected()).toBe(false);
        expect(el.getViewer()!.getState()).toEqual(before);

        // Disposal is permanent; reconnecting a disposed component does not reactivate.
        el.dispose();
        expect(el.isDisposed()).toBe(true);
        el.remove();
        document.body.appendChild(el);
        expect(el.isDisposed()).toBe(true);
        expect(el.getViewer()!.isDisposed()).toBe(true);
    });

    it("exposes a viewer-ready event on connection", async () => {
        const el = document.createElement("crystal-viewer") as CrystalViewerElement;
        elements.push(el);
        let ready = false;
        el.addEventListener("viewer-ready", () => { ready = true; });
        document.body.appendChild(el);
        expect(ready).toBe(true);
        expect(el.getViewer()).not.toBeNull();
    });
});
