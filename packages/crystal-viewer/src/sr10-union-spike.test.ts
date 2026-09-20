import { expect, it, vi } from "vitest";
import { CrystalViewer } from "./index.js";
import { createCornerGrowthOperands } from "../../crystal-three/src/experimental/corner-growth.js";
import { unionTerracedCube } from "../../crystal-three/src/experimental/box-union.js";

const experiment = vi.hoisted(() => ({ corners: false }));

// Test-only substitution. Production dispatch and the public API are unchanged.
vi.mock("@crystal/three", async importOriginal => {
    const original = await importOriginal<typeof import("@crystal/three")>();
    return { ...original, createTerracedFluoriteDisplayGeometry: (...args: Parameters<typeof original.createTerracedFluoriteDisplayGeometry>) => {
        const accepted = original.createTerracedFluoriteDisplayGeometry(...args);
        const result = unionTerracedCube(args[0], accepted, experiment.corners ? createCornerGrowthOperands(args[0], accepted, args[1]) : []);
        if (result.status !== "valid") throw new Error(result.diagnostic.message);
        return result.geometry;
    } };
});
vi.mock("three", async importOriginal => {
    const actual = await importOriginal<typeof import("three")>();
    return { ...actual, WebGLRenderer: class {
        domElement: HTMLCanvasElement;
        constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas; }
        setSize() {} render() {} dispose() {}
    } };
});

it.each([false, true])("disposes experimental buffers on seed, mode, mineral and viewer replacement and retains core inspection (corners=%s)", async corners => {
    experiment.corners = corners;
    const canvas = Object.assign(new EventTarget(), { clientWidth: 400, clientHeight: 300 }) as HTMLCanvasElement;
    const viewer = new CrystalViewer(canvas);
    const internal = viewer as unknown as { currentGeometry: unknown; triangleFaces: Uint32Array; mesh: { geometry: { dispose: () => void }; material: { dispose: () => void } } };
    const resources: ReturnType<typeof vi.spyOn>[] = [];
    const watch = () => { resources.push(vi.spyOn(internal.mesh.geometry, "dispose"), vi.spyOn(internal.mesh.material, "dispose")); };
    try {
        await viewer.loadMineral("fluorite"); viewer.setHabit("cube");
        const faces = viewer.getAllFaces();
        const core = structuredClone(internal.currentGeometry); const state = structuredClone(viewer.getState());
        viewer.setDisplayGrowth("terraced-fluorite"); watch();
        expect(viewer.getAllFaces()).toEqual(faces);
        viewer.selectFace(0);
        expect(viewer.getSelectedFace()).toEqual(faces[0]);
        expect([...internal.triangleFaces].every(face => face < 6)).toBe(true);
        viewer.setDisplayGrowthSeed(1); watch();
        viewer.setDisplayGrowth("idealized");
        expect(internal.currentGeometry).toEqual(core);
        expect(viewer.getState()).toEqual({ ...state, displayGrowthSeed: 1 });
        viewer.setDisplayGrowth("terraced-fluorite"); watch();
        await viewer.loadMineral("quartz");
        await viewer.loadMineral("fluorite"); viewer.setHabit("cube");
        viewer.setDisplayGrowth("terraced-fluorite"); watch();
        viewer.dispose(); viewer.dispose();
        resources.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
    } finally { viewer.dispose(); }
}, 20_000);
