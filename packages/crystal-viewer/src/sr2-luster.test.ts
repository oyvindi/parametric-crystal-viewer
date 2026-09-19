import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene, PerspectiveCamera, Mesh, MeshPhysicalMaterial } from "three";
import { CrystalViewer } from "./index.js";
import { GYPSUM } from "@crystal/data";

// Keep real scene, camera, geometry and data. Stub only the GPU/browser boundary.
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

const viewers: CrystalViewer[] = [];
afterEach(() => { viewers.splice(0).forEach((v) => v.dispose()); render.mockClear(); });

function canvas(): HTMLCanvasElement {
    return Object.assign(new EventTarget(), { clientWidth: 400, clientHeight: 300 }) as HTMLCanvasElement;
}

async function loaded(source: unknown = "gypsum"): Promise<CrystalViewer> {
    const v = new CrystalViewer(canvas());
    viewers.push(v);
    await v.loadMineral(source);
    return v;
}

function materialOf(viewer: CrystalViewer): MeshPhysicalMaterial | null {
    const mesh = (viewer as unknown as { mesh: Mesh | null }).mesh;
    return mesh ? (mesh.material as MeshPhysicalMaterial) : null;
}

describe("SR2 viewer reports effective resolved appearance", () => {
    it("getAppearance reports the luster category from the selected preset", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("amethyst");
        const a = viewer.getAppearance();
        expect(a.luster).toBe("vitreous");
        expect(a.sheen).toBe(0);
    });

    it("getAppearance reports pearly luster and non-zero sheen for a pearly fixture", async () => {
        const source = structuredClone(GYPSUM) as any;
        source.id = "pearly-fixture";
        source.appearance[1].luster = "pearly";
        const viewer = await loaded(source);
        viewer.setAppearance("selenite");
        const a = viewer.getAppearance();
        expect(a.luster).toBe("pearly");
        expect(a.sheen).toBeGreaterThan(0);
    });

    it("getAppearance reports metallic luster with sheen off for pyrite", async () => {
        const viewer = await loaded("pyrite");
        viewer.setAppearance("brass");
        const a = viewer.getAppearance();
        expect(a.luster).toBe("metallic");
        expect(a.sheen).toBe(0);
    });

    it("getAppearances exposes luster per preset", async () => {
        const source = structuredClone(GYPSUM) as any;
        source.id = "pearly-info-fixture";
        source.appearance[1].luster = "pearly";
        const viewer = await loaded(source);
        const infos = viewer.getAppearances();
        const selenite = infos.find((i) => i.id === "selenite")!;
        expect(selenite.luster).toBe("pearly");
        const colorless = infos.find((i) => i.id === "colorless")!;
        expect(colorless.luster).toBeUndefined();
    });

    it("the rendered material receives sheen from the pearly luster profile", async () => {
        const source = structuredClone(GYPSUM) as any;
        source.id = "pearly-material-fixture";
        source.appearance[1].luster = "pearly";
        const viewer = await loaded(source);
        viewer.setAppearance("selenite");
        const material = materialOf(viewer)!;
        expect(material.sheen).toBeGreaterThan(0);
    });

    it("the rendered material keeps sheen at zero for vitreous quartz", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("rock-crystal");
        const material = materialOf(viewer)!;
        expect(material.sheen).toBe(0);
    });
});

describe("SR2 luster is resolved through the preset, not serialized independently", () => {
    it("luster is not part of appearance overrides in serialized state", async () => {
        const viewer = await loaded("gypsum");
        viewer.setAppearance("selenite");
        viewer.setAppearanceField("roughness", 0.2);
        const state = viewer.getState();
        expect(state.appearance).toBeDefined();
        expect(state.appearance!.id).toBe("selenite");
        expect(state.appearance!.overrides).toEqual({ roughness: 0.2 });
        // Luster is not an override field.
        expect(state.appearance!.overrides).not.toHaveProperty("luster");
    });

    it("round-trips a pearly preset selection across a fresh viewer", async () => {
        const source = structuredClone(GYPSUM) as any;
        source.id = "pearly-state-fixture";
        source.appearance[1].luster = "pearly";
        const viewer = await loaded(source);
        viewer.setAppearance("selenite");
        const saved = viewer.getState();

        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        fresh.setState(saved);
        expect(fresh.getAppearanceId()).toBe("selenite");
        expect(fresh.getAppearance().luster).toBe("pearly");
        expect(fresh.getAppearance().sheen).toBeGreaterThan(0);
        expect(materialOf(fresh)!.sheen).toBeGreaterThan(0);
    });

    it("existing state without luster data is backward compatible", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("amethyst");
        const saved = viewer.getState();
        // Simulate a pre-SR2 state: no appearance field at all.
        const preSr2 = { ...saved, appearance: undefined };
        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        fresh.setState(preSr2);
        // Falls back to default luster (vitreous) via the auto-selected preset.
        expect(fresh.getAppearance().luster).toBe("vitreous");
        expect(fresh.getAppearance().sheen).toBe(0);
    });
});
