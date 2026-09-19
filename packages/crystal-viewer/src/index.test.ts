import { afterEach, describe, expect, it, vi } from "vitest";
import { Color, FrontSide, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from "three";
import { FLUORITE, QUARTZ } from "@crystal/data";
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
afterEach(() => { viewers.splice(0).forEach((viewer) => viewer.dispose()); render.mockClear(); });

async function setup(source: unknown = "quartz") {
    const canvas = Object.assign(new EventTarget(), { clientWidth: 400, clientHeight: 300 }) as HTMLCanvasElement;
    const viewer = new CrystalViewer(canvas);
    viewers.push(viewer);
    await viewer.loadMineral(source);
    const [scene, camera] = render.mock.lastCall!;
    const group = scene.children.find((child) => child instanceof Group) as Group;
    return { viewer, camera, group, canvas };
}

describe("M3 camera lifecycle through the viewer", () => {
    it("uses the initial habit view, preserves camera and rotation on edits, and resets explicitly", async () => {
        const { viewer, camera, group, canvas } = await setup();
        const preferred = QUARTZ.habits[0].preferredView!.cameraDirection;
        const direction = camera.position.clone().normalize();
        const length = Math.hypot(...preferred);
        preferred.forEach((value, i) => expect(direction.getComponent(i)).toBeCloseTo(value / length));
        camera.position.set(12, 4, 8);
        camera.lookAt(0, 0, 0);
        const original = camera.toJSON();
        canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 10 }));
        canvas.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 30 }));
        canvas.dispatchEvent(new Event("pointerup"));
        const rotation = group.rotation.y;
        expect(rotation).not.toBe(0);
        viewer.setHabit("cumberland");
        viewer.setFormDevelopment("m", 0.7);
        viewer.setVariant("left");
        expect(camera.toJSON()).toEqual(original);
        expect(group.rotation.y).toBe(rotation);
        viewer.resetCamera();
        const resetDirection = camera.position.clone().normalize();
        expect(resetDirection.x).toBeCloseTo(0);
        expect(resetDirection.y / resetDirection.z).toBeCloseTo(2);
        expect(group.rotation.y).toBe(0);
    });

    it("rotates the model around all three axes and persists that orientation", async () => {
        const { viewer, group, canvas } = await setup();
        canvas.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 10, clientY: 20 }));
        canvas.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 30, clientY: 50 }));
        canvas.dispatchEvent(new Event("pointerup"));
        expect(group.rotation.x).toBeCloseTo(0.3);
        expect(group.rotation.y).toBeCloseTo(0.2);

        viewer.rotateModel(0.1, -0.05, 0.25);
        expect(viewer.getState().camera.groupRotation).toEqual([
            group.rotation.x,
            group.rotation.y,
            group.rotation.z,
        ]);
        expect(group.rotation.z).toBeCloseTo(0.25);
    });

    it("frames the first valid geometry after an initially disabled record", async () => {
        const source: any = structuredClone(FLUORITE);
        source.habits[0].forms.forEach((form: any) => { form.enabled = false; });
        const { viewer, camera, group } = await setup(source);
        expect(viewer.getGeometryStatus().status).toBe("invalid");
        expect(group.children).toHaveLength(0);
        const before = camera.position.toArray();
        viewer.setFormEnabled("a", true);
        expect(viewer.getGeometryStatus().status).toBe("valid");
        expect(camera.position.toArray()).not.toEqual(before);
        expect(group.children.some((child) => child instanceof Mesh)).toBe(true);
    });

    it("creates face labels when enabled after geometry has loaded", async () => {
        const { viewer } = await setup();
        const labelGroup = (viewer as unknown as { labelGroup: Group }).labelGroup;
        expect(labelGroup.children).toHaveLength(0);
        vi.stubGlobal("document", {
            createElement: () => ({
                width: 0,
                height: 0,
                getContext: () => ({ fillStyle: "", font: "", textAlign: "", textBaseline: "", fillRect() {}, fillText() {} }),
            }),
        });
        try {
            viewer.showFaceLabels(true);

            expect(labelGroup.visible).toBe(true);
            expect(labelGroup.children).toHaveLength(viewer.getAllFaces().length);
            viewer.showFaceLabels(false);
            expect(labelGroup.children).toHaveLength(0);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe("environment presentation controls", () => {
    it("starts with the SR1 neutral presentation defaults", async () => {
        const { viewer } = await setup();
        const internals = viewer as unknown as { scene: Scene; renderer: { toneMapping: number; toneMappingExposure: number } };
        expect(internals.scene.children.filter(child => child.type === "AmbientLight")).toHaveLength(1);
        expect(internals.scene.children.filter(child => child.type === "DirectionalLight")).toHaveLength(3);
        expect(internals.renderer.toneMapping).not.toBe(0);
        expect(internals.renderer.toneMappingExposure).toBe(1.15);
    });

    it("applies validated environment settings without changing serialized state", async () => {
        const { viewer } = await setup();
        const before = viewer.getState();
        const facesBefore = structuredClone(viewer.getAllFaces());
        const trianglesBefore = Array.from((viewer as unknown as { triangleFaces: Uint32Array }).triangleFaces);
        const internals = viewer as unknown as { scene: Scene; backgroundScene: Scene; environmentBackgroundZoom: number };
        const scene = internals.scene;
        const renderer = (viewer as unknown as { renderer: { toneMapping: number; toneMappingExposure: number } }).renderer;

        viewer.setEnvironmentIntensity(1.75);
        viewer.setEnvironmentRotation(Math.PI / 3, Math.PI / 5, -Math.PI / 7);
        viewer.setEnvironmentBackgroundVisible(false);
        viewer.setEnvironmentBackgroundZoom(1.6);
        viewer.setToneMapping("agx");
        viewer.setExposure(0.8);

        expect(scene.environmentIntensity).toBe(1.75);
        expect(scene.environmentRotation.y).toBeCloseTo(Math.PI / 3);
        expect(scene.environmentRotation.x).toBeCloseTo(Math.PI / 5);
        expect(scene.environmentRotation.z).toBeCloseTo(-Math.PI / 7);
        expect(internals.backgroundScene.backgroundRotation.equals(scene.environmentRotation)).toBe(true);
        expect(internals.backgroundScene.background).toBeInstanceOf(Color);
        expect(internals.environmentBackgroundZoom).toBe(1.6);
        expect(renderer.toneMappingExposure).toBe(0.8);
        expect(renderer.toneMapping).not.toBe(0);
        expect(viewer.getState()).toEqual(before);
        expect(viewer.getAllFaces()).toEqual(facesBefore);
        expect(Array.from((viewer as unknown as { triangleFaces: Uint32Array }).triangleFaces)).toEqual(trianglesBefore);
    });

    it("rejects invalid environment settings with typed diagnostics", async () => {
        const { viewer } = await setup();
        expect(() => viewer.setEnvironmentIntensity(-1)).toThrow(ViewerOperationError);
        expect(() => viewer.setEnvironmentRotation(Number.NaN)).toThrow(ViewerOperationError);
        expect(() => viewer.setExposure(-0.1)).toThrow(ViewerOperationError);
        expect(() => viewer.setEnvironmentBackgroundZoom(0)).toThrow(ViewerOperationError);
        expect(() => viewer.setToneMapping("bogus" as never)).toThrow(ViewerOperationError);
        expect(() => viewer.loadHdrEnvironment(new ArrayBuffer(0))).toThrow(ViewerOperationError);
    });
});

describe("M4 viewer loading", () => {
    it("renders a caller-supplied provisional mineral through the exported viewer boundary", async () => {
        const source = { ...structuredClone(FLUORITE), id: "provisional", name: "Provisional", dataRevision: "test-1" };
        const { viewer, group } = await setup(source);
        expect(viewer.getMineralId()).toBe("provisional");
        expect(viewer.getAllFaces()).toHaveLength(6);
        expect(group.children.some((child) => child instanceof Mesh)).toBe(true);
    });

    it("embeds a caller-supplied mineral in state so a fresh viewer can restore it", async () => {
        const source = { ...structuredClone(FLUORITE), id: "portable-fluorite", dataRevision: "custom-1" };
        const { viewer } = await setup(source);
        const state = viewer.getState();
        expect(state.mineral?.definition).toMatchObject({ id: "portable-fluorite", dataRevision: "custom-1" });

        const freshCanvas = Object.assign(new EventTarget(), { clientWidth: 400, clientHeight: 300 }) as HTMLCanvasElement;
        const fresh = new CrystalViewer(freshCanvas);
        viewers.push(fresh);
        fresh.setState(state);
        expect(fresh.getMineralId()).toBe("portable-fluorite");
        expect(fresh.getState()).toEqual(state);
    });

    it("preserves configuration, mesh and camera when a load fails and emits diagnostics", async () => {
        const { viewer, camera, group } = await setup();
        viewer.setHabit("tessin");
        viewer.setFormDevelopment("m", 0.8);
        const forms = viewer.getForms();
        const mesh = group.children[0];
        const cameraState = camera.toJSON();
        const failed = vi.fn();
        const loaded = vi.fn();
        viewer.addEventListener("mineral-load-failed", failed);
        viewer.addEventListener("mineral-loaded", loaded);
        for (const source of ["missing", { ...FLUORITE, dataRevision: "" }]) {
            await expect(viewer.loadMineral(source)).rejects.toThrow(ViewerOperationError);
        }
        expect(failed).toHaveBeenCalledTimes(2);
        expect(loaded).not.toHaveBeenCalled();
        expect(viewer.getMineralId()).toBe("quartz");
        expect(viewer.getForms()).toEqual(forms);
        expect(camera.toJSON()).toEqual(cameraState);
        expect(group.children[0]).toBe(mesh);
    });

    it("retains a stale mesh for invalid edits, clears it for a new invalid definition, and recovers", async () => {
        const { viewer, group } = await setup("fluorite");
        const oldMesh = group.children[0];
        viewer.setFormEnabled("a", false);
        expect(viewer.getGeometryStatus()).toMatchObject({ status: "invalid", stale: true });
        expect(group.children[0]).toBe(oldMesh);
        const source: any = structuredClone(FLUORITE);
        source.id = "disabled-fixture";
        source.habits[0].forms.forEach((form: any) => { form.enabled = false; });
        await viewer.loadMineral(source);
        expect(viewer.getMineralId()).toBe("disabled-fixture");
        expect(viewer.getGeometryStatus()).toMatchObject({ status: "invalid", stale: false });
        expect(group.children).toHaveLength(0);
        viewer.setFormEnabled("a", true);
        expect(viewer.getGeometryStatus()).toMatchObject({ status: "valid", stale: false });
    });

    it("rejects invalid preferred-view metadata before replacing the current record", async () => {
        const { viewer } = await setup();
        const source: any = structuredClone(FLUORITE);
        source.habits[0].preferredView = { cameraDirection: [0, 0, 0] };
        await expect(viewer.loadMineral(source)).rejects.toThrow(ViewerOperationError);
        expect(viewer.getMineralId()).toBe("quartz");
    });
});

describe("form control metadata", () => {
    it("reports generic scale, shape, inactive and redundant control effects", async () => {
        const { viewer } = await setup("fluorite");
        const cube = viewer.getForms().find((form) => form.id === "a")!;
        expect(cube).toMatchObject({ effect: "scale-only", contributesToVisibleFaces: true });
        expect(viewer.getForms().find((form) => form.id === "o")).toMatchObject({ effect: "inactive", contributesToVisibleFaces: false });

        viewer.setHabit("cubo-octahedron");
        for (const form of viewer.getForms().filter((form) => form.enabled)) {
            expect(form).toMatchObject({ effect: "shape", contributesToVisibleFaces: true });
        }

        const source: any = structuredClone(FLUORITE);
        source.habits[0].forms.push({ ...source.habits[0].forms[0], id: "a-copy", label: "Cube copy" });
        const { viewer: shared } = await setup(source);
        shared.setFormDevelopment("a-copy", 0.5);
        expect(shared.getForms().find((form) => form.id === "a-copy")).toMatchObject({ effect: "redundant", contributesToVisibleFaces: false });
    });
});

describe("M7 contributor-specific face equivalence", () => {
    it("selects one contributing form's equivalence set on a shared face", async () => {
        const source: any = structuredClone(FLUORITE);
        const habit = source.habits[0];
        habit.forms.push({ ...habit.forms[0], id: "a-copy", label: "Cube copy" });
        const { viewer } = await setup(source);
        const sharedFace = viewer.getAllFaces().find((face) => face.contributors.some((c) => c.formId === "a-copy"));
        expect(sharedFace).toBeDefined();

        const copyEquivalent = viewer.getEquivalentFaces(sharedFace!.faceIndex, "a-copy");
        expect(copyEquivalent).toContain(sharedFace!.faceIndex);
        // A non-contributor must not silently select the union of all forms.
        expect(viewer.getEquivalentFaces(sharedFace!.faceIndex, "not-a-contributor")).toEqual([]);

        const selected = vi.fn();
        viewer.addEventListener("face-selected", selected);
        viewer.highlightEquivalentFaces(sharedFace!.faceIndex, "a-copy");
        expect(selected).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.objectContaining({ equivalentFormId: "a-copy", equivalentFaces: copyEquivalent }) }));
    });
});

describe("face selection presentation", () => {
    it("preserves camera state and uses a depth-safe translucent front-face tint", async () => {
        const { viewer, camera } = await setup("quartz");
        const cameraBefore = camera.toJSON();
        viewer.selectFace(0);
        const highlight = (viewer as unknown as { highlightMesh: Mesh | null }).highlightMesh!;
        const material = highlight.material as MeshBasicMaterial;
        expect(camera.toJSON()).toEqual(cameraBefore);
        expect(material.side).toBe(FrontSide);
        expect(material.transparent).toBe(true);
        expect(material.opacity).toBeLessThan(0.5);
        expect(material.depthWrite).toBe(false);
    });
});
