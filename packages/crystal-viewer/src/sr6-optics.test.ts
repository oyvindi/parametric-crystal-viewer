import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene, PerspectiveCamera, Mesh, MeshPhysicalMaterial } from "three";
import { QUARTZ, FLUORITE, PYRITE, GYPSUM, BERYL, FORSTERITE } from "@crystal/data";
import { CrystalViewer } from "./index.js";

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

function absorptionExponent(material: MeshPhysicalMaterial): number {
    return material.thickness / material.attenuationDistance;
}

describe("SR6 transmission and optical refinement", () => {
    it("keeps the absorption exponent invariant under morphology scale", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("amethyst");
        const density = QUARTZ.appearance!.find((a) => a.id === "amethyst")!.absorptionDensity!;
        const m1 = materialOf(viewer)!;
        const exponent1 = absorptionExponent(m1);
        expect(exponent1).toBeCloseTo(density);

        // Scale the whole model up; geometry and thickness grow, but the
        // Beer-Lambert exponent must not change with absolute scale.
        viewer.setMorphologyScale((viewer.getMorphologyScale() ?? 1) * 5);
        const m2 = materialOf(viewer)!;
        expect(m2.thickness).toBeGreaterThan(m1.thickness);
        expect(m2.attenuationDistance).toBeGreaterThan(m1.attenuationDistance);
        expect(absorptionExponent(m2)).toBeCloseTo(exponent1);
        expect(absorptionExponent(m2)).toBeCloseTo(density);
    });

    it("re-applies scale-invariant optics after an appearance density override", async () => {
        const viewer = await loaded("fluorite");
        viewer.setAppearance("violet");
        const m1 = materialOf(viewer)!;
        const originalDensity = FLUORITE.appearance!.find((a) => a.id === "violet")!.absorptionDensity!;
        expect(absorptionExponent(m1)).toBeCloseTo(originalDensity);

        viewer.setAppearanceField("absorptionDensity", 0.25);
        const m2 = materialOf(viewer)!;
        expect(absorptionExponent(m2)).toBeCloseTo(0.25);
        // Thickness still tracks geometry, not the density edit.
        expect(m2.thickness).toBe(m1.thickness);
    });

    it("bypasses transmission work for opaque and metallic minerals", async () => {
        const pyrite = await loaded("pyrite");
        pyrite.setAppearance("brass");
        const m = materialOf(pyrite)!;
        expect(m.transmission).toBe(0);
        expect(m.thickness).toBe(0);
        expect(m.attenuationDistance).toBe(Infinity);
        expect(m.transparent).toBe(false);
    });

    it("routes transmissive optics for the SR6 reference minerals", async () => {
        for (const [id, presetId] of [
            ["quartz", "amethyst"],
            ["fluorite", "violet"],
            ["beryl", "emerald"],
            ["gypsum", "selenite"],
            ["forsterite", "olive"],
        ] as const) {
            const viewer = await loaded(id);
            viewer.setAppearance(presetId);
            const m = materialOf(viewer)!;
            expect(m.transmission).toBeGreaterThan(0);
            expect(m.thickness).toBeGreaterThan(0);
            expect(m.transparent).toBe(true);
            // A finite, positive density yields a finite, scale-invariant attenuation distance.
            if (m.attenuationDistance !== Infinity) {
                expect(m.attenuationDistance).toBeGreaterThan(0);
                expect(m.thickness / m.attenuationDistance).toBeGreaterThan(0);
            }
        }
    });

    it("does not alter scientific geometry when applying transmission optics", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("amethyst");
        const mesh = (viewer as unknown as { mesh: Mesh }).mesh;
        const positions = mesh.geometry.getAttribute("position");
        const countBefore = positions.count;
        const arrayBefore = new Float32Array(positions.array as Float32Array);
        viewer.setAppearanceField("absorptionDensity", 0.9);
        viewer.setMorphologyScale((viewer.getMorphologyScale() ?? 1) * 2);
        // Optics never touch geometry; the geometry object is replaced only by
        // regeneration, never by an appearance edit.
        const positionsAfter = mesh.geometry.getAttribute("position");
        expect(positionsAfter.count).toBe(countBefore);
        expect(new Float32Array(positionsAfter.array as Float32Array)).toEqual(arrayBefore);
    });

    it("preserves SR5 surface profile routing alongside transmission optics", async () => {
        const viewer = await loaded("quartz");
        const profiles = viewer.getSurfaceProfiles();
        const quartzStriations = profiles.find((p) => p.id === "quartz.m-prism-striations");
        expect(quartzStriations).toBeDefined();
        expect(quartzStriations!.matchedFaceCount).toBeGreaterThan(0);
        // Transmission optics coexist with the surface-detail material.
        const m = materialOf(viewer)!;
        expect(m.transmission).toBeGreaterThan(0);
        expect(m.thickness).toBeGreaterThan(0);
    });

    it("keeps transparent minerals inspectable (face selection resolves a contributor)", async () => {
        const viewer = await loaded("gypsum");
        viewer.setAppearance("selenite");
        const m = materialOf(viewer)!;
        expect(m.transparent).toBe(true);
        const faces = viewer.getAllFaces();
        expect(faces.length).toBeGreaterThan(0);
        const first = faces[0]!;
        viewer.selectFace(first.faceIndex);
        const selected = viewer.getSelectedFace();
        expect(selected).not.toBeNull();
        expect(selected!.contributors.length).toBeGreaterThan(0);
    });

    it("keeps absorption scale-invariant when appearance is edited on a retained stale mesh", async () => {
        // Drive geometry invalid by disabling every form; the last valid mesh is
        // retained with a stale status. An appearance edit must still re-apply the
        // scale-invariant optics using the retained geometry's bounds, not revert
        // attenuationDistance to the non-scale-invariant 1 / density form.
        const viewer = await loaded("quartz");
        viewer.setAppearance("amethyst");

        for (const form of viewer.getForms()) viewer.setFormEnabled(form.id, false);
        const status = viewer.getGeometryStatus();
        expect(status.status).toBe("invalid");
        expect(status.stale).toBe(true);
        // The retained mesh is still present; capture its geometry-derived thickness.
        const retained = materialOf(viewer)!;
        expect(retained).not.toBeNull();
        const retainedThickness = retained.thickness;
        expect(retainedThickness).toBeGreaterThan(0);

        const density = 0.5;
        viewer.setAppearanceField("absorptionDensity", density);
        const m1 = materialOf(viewer)!;
        // Thickness tracks the retained geometry, not the density edit.
        expect(m1.thickness).toBe(retainedThickness);
        // Beer-Lambert exponent stays equal to density (scale-invariant), not
        // thickness * density (the pre-SR6 1 / distance form would give).
        expect(m1.thickness / m1.attenuationDistance).toBeCloseTo(density, 5);
    });

    it("uses GYPSUM, BERYL, and FORSTERITE curated constants, not measured optics", async () => {
        // Smoke check the reference minerals load and resolve a transmissive or
        // opaque path without implying measured optical constants.
        for (const mineral of [GYPSUM, BERYL, FORSTERITE, PYRITE]) {
            const viewer = await loaded(mineral.id);
            const m = materialOf(viewer)!;
            expect(Number.isFinite(m.ior)).toBe(true);
            expect(m.metalness).toBeGreaterThanOrEqual(0);
            expect(m.transmission).toBeGreaterThanOrEqual(0);
        }
    });
});
