import { afterEach, describe, expect, it, vi } from "vitest";
import { PerspectiveCamera, Scene } from "three";
import { CrystalViewer } from "./index.js";

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

async function loaded(id: string): Promise<CrystalViewer> {
    const canvas = Object.assign(new EventTarget(), { clientWidth: 400, clientHeight: 300 }) as HTMLCanvasElement;
    const viewer = new CrystalViewer(canvas);
    viewers.push(viewer);
    await viewer.loadMineral(id);
    return viewer;
}

describe("SR5 effective surface profile API", () => {
    it("reports quartz and pyrite reviewed profiles on matched faces", async () => {
        for (const [mineral, id] of [["quartz", "quartz.m-prism-striations"], ["pyrite", "pyrite.100-cube-striations"]] as const) {
            const profile = (await loaded(mineral)).getSurfaceProfiles().find((item) => item.id === id)!;
            expect(profile.description).toContain("not specimen-measured");
            expect(profile.matchedFaceCount).toBeGreaterThan(0);
        }
    });

    it("reports calcite basal luster as reviewed but inactive without a shipped {0001} face", async () => {
        const profile = (await loaded("calcite")).getSurfaceProfiles().find((item) => item.id === "calcite.0001-pearly")!;
        expect(profile.claimId).toBe("surface.calcite.0001-pearly");
        expect(profile.matchedFaceCount).toBe(0);
    });
});
