import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene, PerspectiveCamera, Mesh, MeshPhysicalMaterial } from "three";
import { QUARTZ, FLUORITE, PYRITE } from "@crystal/data";
import { CrystalViewer, ViewerOperationError } from "./index.js";

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

async function loaded(source: unknown = "quartz"): Promise<CrystalViewer> {
    const v = new CrystalViewer(canvas());
    viewers.push(v);
    await v.loadMineral(source);
    return v;
}

function materialOf(viewer: CrystalViewer): MeshPhysicalMaterial | null {
    const mesh = (viewer as unknown as { mesh: Mesh | null }).mesh;
    return mesh ? (mesh.material as MeshPhysicalMaterial) : null;
}

describe("M8 appearance parameter mapping", () => {
    it("maps a transmissive appearance preset to the rendered material", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("amethyst");
        const material = materialOf(viewer)!;
        const preset = QUARTZ.appearance!.find((a) => a.id === "amethyst")!;
        expect(material.color.getHexString()).toBe(preset.baseColor!.replace("#", ""));
        expect(material.roughness).toBe(preset.roughness);
        expect(material.metalness).toBe(preset.metalness);
        expect(material.transmission).toBe(preset.transmission);
        expect(material.ior).toBe(preset.ior);
        expect(material.attenuationColor.getHexString()).toBe(preset.absorptionColor!.replace("#", ""));
        expect(material.attenuationDistance).toBeCloseTo(1 / preset.absorptionDensity!);
        expect(material.transparent).toBe(true); // transmission > 0
        expect(material.thickness).toBeGreaterThan(0); // derived from geometry bounds
    });

    it("maps a metallic pyrite appearance with no transmission", async () => {
        const viewer = await loaded("pyrite");
        viewer.setAppearance("brass");
        const material = materialOf(viewer)!;
        const preset = PYRITE.appearance!.find((a) => a.id === "brass")!;
        expect(material.metalness).toBe(preset.metalness);
        expect(material.transmission).toBe(0);
        expect(material.transparent).toBe(false);
        expect(material.attenuationDistance).toBe(Infinity);
    });

    it("maps a fluorite transparent appearance", async () => {
        const viewer = await loaded("fluorite");
        viewer.setAppearance("violet");
        const material = materialOf(viewer)!;
        expect(material.transmission).toBe(0.8);
        expect(material.transparent).toBe(true);
        expect(material.ior).toBe(1.434);
    });

    it("applies user overrides on top of the preset without recreating geometry", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("rock-crystal");
        const mesh = (viewer as unknown as { mesh: Mesh }).mesh;
        const geometryBefore = mesh.geometry;
        const positionCountBefore = mesh.geometry.getAttribute("position").count;
        viewer.setAppearanceField("transmission", 0.1);
        viewer.setAppearanceField("roughness", 0.5);
        viewer.setAppearanceField("baseColor", "#ff0000");
        const material = materialOf(viewer)!;
        expect(material.transmission).toBe(0.1);
        expect(material.roughness).toBe(0.5);
        expect(material.color.getHexString()).toBe("ff0000");
        expect(material.transparent).toBe(true);
        // Geometry object and vertex count are unchanged — appearance never touches geometry.
        expect(mesh.geometry).toBe(geometryBefore);
        expect(mesh.geometry.getAttribute("position").count).toBe(positionCountBefore);
    });

    it("exposes the effective appearance merged from preset and overrides", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("amethyst");
        viewer.setAppearanceField("ior", 1.6);
        const a = viewer.getAppearance();
        expect(a.baseColor).toBe("#9b6dd4"); // from preset
        expect(a.ior).toBe(1.6); // overridden
        expect(a.transmission).toBe(0.5); // from preset
    });
});

describe("M8 appearance API and validation", () => {
    it("auto-selects the first appearance preset on load", async () => {
        const viewer = await loaded("quartz");
        expect(viewer.getAppearanceId()).toBe(QUARTZ.appearance![0]!.id);
        expect(viewer.getAppearances().map((a) => a.id)).toEqual(QUARTZ.appearance!.map((a) => a.id));
    });

    it("rejects unknown appearance ids and unknown fields with typed errors", async () => {
        const viewer = await loaded("quartz");
        expect(() => viewer.setAppearance("nope")).toThrow(ViewerOperationError);
        expect(() => viewer.setAppearanceField("opacity" as never, 0.5)).toThrow(ViewerOperationError);
        expect(() => viewer.setAppearanceField("roughness", 2)).toThrow(ViewerOperationError);
        expect(() => viewer.setAppearanceField("ior", -1)).toThrow(ViewerOperationError);
        expect(() => viewer.setAppearanceField("absorptionDensity", -0.1)).toThrow(ViewerOperationError);
        expect(() => viewer.setAppearanceField("roughness", "x")).toThrow(ViewerOperationError);
    });

    it("emits appearance-changed for preset selection and field overrides", async () => {
        const viewer = await loaded("quartz");
        const changed = vi.fn();
        viewer.addEventListener("appearance-changed", changed);
        viewer.setAppearance("citrine");
        expect(changed).toHaveBeenCalledTimes(1);
        expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { id: "citrine" } }));
        viewer.setAppearanceField("metalness", 0.2);
        expect(changed).toHaveBeenCalledTimes(2);
        expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { field: "metalness", value: 0.2 } }));
    });

    it("selecting a preset clears previous overrides", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("amethyst");
        viewer.setAppearanceField("roughness", 0.9);
        expect(viewer.getAppearance().roughness).toBe(0.9);
        viewer.setAppearance("amethyst"); // re-select clears overrides
        expect(viewer.getAppearance().roughness).toBe(0.1); // back to preset
    });
});

describe("M8 appearance state restoration", () => {
    it("round-trips appearance id and overrides across a fresh viewer", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("smoky");
        viewer.setAppearanceField("transmission", 0.45);
        viewer.setAppearanceField("absorptionColor", "#1a0a05");
        const saved = viewer.getState();
        expect(saved.appearance).toEqual({ id: "smoky", overrides: { transmission: 0.45, absorptionColor: "#1a0a05" } });

        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        fresh.setState(saved);
        expect(fresh.getAppearanceId()).toBe("smoky");
        expect(fresh.getAppearance().transmission).toBe(0.45);
        expect(fresh.getAppearance().absorptionColor).toBe("#1a0a05");
        expect(fresh.getState().appearance).toEqual(saved.appearance);
        // The restored material reflects the overrides.
        expect(materialOf(fresh)!.transmission).toBe(0.45);
    });

    it("rejects state referencing an unknown appearance without partial mutation", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("citrine");
        const before = viewer.getState();
        const bad = { ...before, appearance: { id: "nonexistent" } };
        expect(() => viewer.setState(bad)).toThrow(ViewerOperationError);
        expect(viewer.getAppearanceId()).toBe("citrine");
        expect(viewer.getState()).toEqual(before);
    });

    it("restores an appearance override that was the only serialized appearance state", async () => {
        const viewer = await loaded("quartz");
        // Override only, no explicit preset switch (id remains the default first preset).
        viewer.setAppearanceField("metalness", 0.3);
        const saved = viewer.getState();
        expect(saved.appearance!.id).toBe(QUARTZ.appearance![0]!.id);
        expect(saved.appearance!.overrides).toEqual({ metalness: 0.3 });
        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        fresh.setState(saved);
        expect(fresh.getAppearance().metalness).toBe(0.3);
    });
});

describe("M8 reference-scene readability (automated portion of visual review)", () => {
    // These checks assert the rendering conditions for the documented visual
    // review (quartz/fluorite/pyrite): flat shading is on for face/edge clarity,
    // geometry is valid, and the material's appearance is in the intended range.
    // The manual rotation/zoom review is recorded in docs/m8-acceptance.md.
    it.each([
        ["quartz", "rock-crystal", "amethyst"],
        ["fluorite", "violet", "green"],
        ["pyrite", "brass", "tarnished"],
    ] as const)("%s reference scenes produce valid geometry and readable materials", async (id, ...presets) => {
        const viewer = await loaded(id);
        for (const presetId of presets) {
            viewer.setAppearance(presetId);
            const status = viewer.getGeometryStatus();
            expect(status.status).toBe("valid"); // appearance never invalidates geometry
            const material = materialOf(viewer)!;
            expect(material.flatShading).toBe(true); // face/edge readability
            expect(material.side).toBeGreaterThan(0); // DoubleSide renders back faces
        }
    });
});
