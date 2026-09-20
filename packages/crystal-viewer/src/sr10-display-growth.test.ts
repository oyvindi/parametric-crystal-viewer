import { afterEach, expect, it, vi } from "vitest";
import { Scene, PerspectiveCamera } from "three";
import { CrystalViewer } from "./index.js";

const { render } = vi.hoisted(() => ({ render: vi.fn<(scene: Scene, camera: PerspectiveCamera) => void>() }));
vi.mock("three", async (importOriginal) => {
    const actual = await importOriginal<typeof import("three")>();
    return { ...actual, WebGLRenderer: class { domElement: HTMLCanvasElement; constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas; } setSize() {} render = render; dispose() {} } };
});
const viewers: CrystalViewer[] = [];
afterEach(() => viewers.splice(0).forEach((viewer) => viewer.dispose()));
const canvas = (): HTMLCanvasElement => Object.assign(new EventTarget(), { clientWidth: 400, clientHeight: 300 }) as HTMLCanvasElement;

it("keeps the core state idealized by default and serializes Terraced fluorite", async () => {
    const viewer = new CrystalViewer(canvas()); viewers.push(viewer);
    await viewer.loadMineral("fluorite");
    expect(viewer.getDisplayGrowth()).toBe("idealized");
    const before = structuredClone(viewer.getState());
    viewer.setDisplayGrowth("terraced-fluorite");
    expect(viewer.getDisplayGrowth()).toBe("terraced-fluorite");
    expect(viewer.getState().displayGrowth).toBe("terraced-fluorite");
    // State values that define the scientific core are unchanged by display selection.
    expect({ ...before, displayGrowth: "terraced-fluorite" }).toEqual(viewer.getState());
    viewer.setDisplayGrowth("idealized");
    expect(viewer.getState()).toEqual(before);
});

it("does not make Terraced fluorite available on a different mineral", async () => {
    const viewer = new CrystalViewer(canvas()); viewers.push(viewer);
    await viewer.loadMineral("quartz");
    expect(() => viewer.setDisplayGrowth("terraced-fluorite")).toThrow(/only for fluorite/i);
});

it("replaces and disposes derived GPU resources on mode and seed changes without changing the core", async () => {
    const viewer = new CrystalViewer(canvas()); viewers.push(viewer);
    await viewer.loadMineral("fluorite");
    const coreBefore = structuredClone((viewer as unknown as { currentGeometry: unknown }).currentGeometry);
    const idealMesh = (viewer as unknown as { mesh: { geometry: { dispose: () => void } } }).mesh;
    const idealDispose = vi.spyOn(idealMesh.geometry, "dispose");

    viewer.setDisplayGrowth("terraced-fluorite");
    expect(idealDispose).toHaveBeenCalledOnce();
    const firstDisplayMesh = (viewer as unknown as { mesh: { geometry: { dispose: () => void } } }).mesh;
    const firstDisplayDispose = vi.spyOn(firstDisplayMesh.geometry, "dispose");

    viewer.setDisplayGrowthSeed(0x1234_5678);
    expect(firstDisplayDispose).toHaveBeenCalledOnce();
    const secondDisplayMesh = (viewer as unknown as { mesh: { geometry: { dispose: () => void } } }).mesh;
    const secondDisplayDispose = vi.spyOn(secondDisplayMesh.geometry, "dispose");

    viewer.setDisplayGrowth("idealized");
    expect(secondDisplayDispose).toHaveBeenCalledOnce();
    expect((viewer as unknown as { currentGeometry: unknown }).currentGeometry).toEqual(coreBefore);
});

it("disposes display geometry on mineral replacement and attributes only core faces", async () => {
    const viewer = new CrystalViewer(canvas()); viewers.push(viewer);
    await viewer.loadMineral("fluorite");
    viewer.setHabit("cube");
    viewer.setDisplayGrowth("terraced-fluorite");
    const internal = viewer as unknown as { currentGeometry: unknown; triangleFaces: Uint32Array; mesh: { geometry: { dispose: () => void }; material: { dispose: () => void } } };
    expect([...internal.triangleFaces].every(face => face < 6)).toBe(true);
    const displayDispose = vi.spyOn(internal.mesh.geometry, "dispose");
    const materialDispose = vi.spyOn(internal.mesh.material, "dispose");
    await viewer.loadMineral("quartz");
    expect(displayDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    // Double dispose is safe.
    viewer.dispose(); viewer.dispose();
});
