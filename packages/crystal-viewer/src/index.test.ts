import { afterEach, describe, expect, it, vi } from "vitest";
import { Group, Mesh, PerspectiveCamera, Scene } from "three";
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
});

describe("M4 viewer loading", () => {
    it("renders a caller-supplied provisional mineral through the exported viewer boundary", async () => {
        const source = { ...structuredClone(FLUORITE), id: "provisional", name: "Provisional", dataRevision: "test-1" };
        const { viewer, group } = await setup(source);
        expect(viewer.getMineralId()).toBe("provisional");
        expect(viewer.getAllFaces()).toHaveLength(6);
        expect(group.children.some((child) => child instanceof Mesh)).toBe(true);
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
