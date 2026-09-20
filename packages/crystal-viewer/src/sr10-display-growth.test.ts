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
