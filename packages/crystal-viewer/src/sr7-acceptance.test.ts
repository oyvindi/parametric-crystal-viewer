import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene, PerspectiveCamera, Mesh, Group } from "three";
import { CrystalViewer, STATE_VERSION, type SurfaceProfileInfo } from "./index.js";

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

const NINE = ["albite", "anatase", "beryl", "calcite", "fluorite", "forsterite", "gypsum", "pyrite", "quartz"] as const;
const REVIEWED = new Map<string, string>([
    ["quartz", "quartz.m-prism-striations"],
    ["calcite", "calcite.0001-pearly"],
    ["pyrite", "pyrite.100-cube-striations"],
]);

describe("SR7 public API surface and stable controls", () => {
    it("getSurfaceDetail exposes only enabled and strength", async () => {
        const viewer = await loaded("quartz");
        viewer.setSurfaceDetail(true, 0.42);
        const detail = viewer.getSurfaceDetail();
        expect(Object.keys(detail).sort()).toEqual(["enabled", "strength"]);
        expect(detail).toEqual({ enabled: true, strength: 0.42 });
    });

    it("getSurfaceProfiles exposes only stable profile fields, never implementation constants", async () => {
        const viewer = await loaded("quartz");
        const profiles = viewer.getSurfaceProfiles();
        expect(profiles.length).toBeGreaterThan(0);
        const allowed = ["claimId", "description", "id", "kind", "matchedFaceCount"];
        for (const profile of profiles as readonly SurfaceProfileInfo[]) {
            expect(Object.keys(profile).sort()).toEqual(allowed);
            // No renderer constants (seeds, frequencies, amplitudes, uniforms) leak.
            for (const key of Object.keys(profile)) {
                expect(key).not.toMatch(/seed|frequency|amplitude|uniform|phase|spacing|wavelength/i);
            }
        }
    });

    it("rejects out-of-range strength and non-boolean enable without changing state", async () => {
        const viewer = await loaded("quartz");
        viewer.setSurfaceDetail(true, 0.5);
        expect(() => viewer.setSurfaceDetail(true as never, 1.01)).toThrow();
        expect(() => viewer.setSurfaceDetail(true, -0.01)).toThrow();
        expect(viewer.getSurfaceDetail()).toEqual({ enabled: true, strength: 0.5 });
    });
});

describe("SR7 all nine minerals load and report reviewed profiles", () => {
    it("every mineral loads with surface detail and reports reviewed profiles only where reviewed", async () => {
        for (const id of NINE) {
            const viewer = await loaded(id);
            viewer.setSurfaceDetail(true, 0.35);
            expect(viewer.getSurfaceDetail()).toEqual({ enabled: true, strength: 0.35 });
            const profiles = viewer.getSurfaceProfiles();
            if (REVIEWED.has(id)) {
                const expected = REVIEWED.get(id)!;
                const profile = profiles.find((p) => p.id === expected);
                expect(profile, `${id} should report its reviewed profile`).toBeDefined();
                expect(profile!.description).toContain("not specimen-measured");
            } else {
                // The six unreviewed minerals receive only common lighting and
                // optional generic microvariation; no form-specific profile.
                expect(profiles, `${id} must not invent a reviewed profile`).toEqual([]);
            }
        }
    });

    it("quartz and pyrite reviewed profiles match generated faces; calcite has no shipped {0001} face", async () => {
        const quartz = (await loaded("quartz")).getSurfaceProfiles().find((p) => p.id === "quartz.m-prism-striations")!;
        expect(quartz.matchedFaceCount).toBeGreaterThan(0);
        const pyrite = (await loaded("pyrite")).getSurfaceProfiles().find((p) => p.id === "pyrite.100-cube-striations")!;
        expect(pyrite.matchedFaceCount).toBeGreaterThan(0);
        const calcite = (await loaded("calcite")).getSurfaceProfiles().find((p) => p.id === "calcite.0001-pearly")!;
        expect(calcite.matchedFaceCount).toBe(0);
    });
});

describe("SR7 serialized surface state needs no migration", () => {
    it("surfaceDetail round-trips through setState", async () => {
        expect(STATE_VERSION).toBe(2);
        const viewer = await loaded("quartz");
        viewer.setSurfaceDetail(true, 0.6);
        const state = viewer.getState();
        expect(state.version).toBe(2);
        expect(state.surfaceDetail).toEqual({ enabled: true, strength: 0.6 });

        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        await fresh.loadMineral("quartz");
        fresh.setState(state);
        expect(fresh.getSurfaceDetail()).toEqual({ enabled: true, strength: 0.6 });
    });

    it("legacy version-1 state without surfaceDetail restores detail off", async () => {
        const viewer = await loaded("quartz");
        viewer.setSurfaceDetail(true, 0.9);
        const state = viewer.getState();
        // Simulate a pre-SR4 V1 state that omits the optional surfaceDetail member.
        const legacy = { ...state, surfaceDetail: undefined } as unknown as typeof state;
        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        await fresh.loadMineral("quartz");
        fresh.setState(legacy);
        expect(fresh.getSurfaceDetail()).toEqual({ enabled: false, strength: 0.35 });
    });
});

describe("SR7 geometry immutability under surface detail", () => {
    it("toggling surface detail does not move scientific vertices or normals", async () => {
        const viewer = await loaded("quartz");
        viewer.setSurfaceDetail(false, 0);
        const mesh = (viewer as unknown as { mesh: Mesh }).mesh;
        const positions = mesh.geometry.getAttribute("position");
        const before = new Float32Array(positions.array as Float32Array);
        const normals = new Float32Array((mesh.geometry.getAttribute("normal")?.array ?? new Float32Array()) as Float32Array);
        viewer.setSurfaceDetail(true, 1);
        viewer.setSurfaceDetail(false, 0);
        const after = new Float32Array(mesh.geometry.getAttribute("position").array as Float32Array);
        const afterNormals = new Float32Array((mesh.geometry.getAttribute("normal")?.array ?? new Float32Array()) as Float32Array);
        expect(after).toEqual(before);
        expect(afterNormals).toEqual(normals);
    });
});

describe("SR7 prefers-reduced-motion handling", () => {
    function groupOf(viewer: CrystalViewer): Group {
        return (viewer as unknown as { crystalGroup: Group }).crystalGroup;
    }

    it("suppresses auto-rotation when prefers-reduced-motion is reduce", async () => {
        const rafCallback = { fn: null as (() => void) | null };
        const raf = vi.fn((cb: () => void) => { rafCallback.fn = cb; return 1; });
        const cancel = vi.fn();
        const mql = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
        vi.stubGlobal("requestAnimationFrame", raf);
        vi.stubGlobal("cancelAnimationFrame", cancel);
        vi.stubGlobal("matchMedia", () => mql);
        try {
            const viewer = await loaded("quartz");
            const group = groupOf(viewer);
            expect(group.rotation.y).toBe(0);
            viewer.start();
            expect(raf).toHaveBeenCalledTimes(1);
            rafCallback.fn!(); // run one animation frame
            expect(group.rotation.y).toBe(0); // no motion under reduced-motion
            viewer.stop();
            expect(cancel).toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("advances auto-rotation when prefers-reduced-motion is not set", async () => {
        const rafCallback = { fn: null as (() => void) | null };
        const raf = vi.fn((cb: () => void) => { rafCallback.fn = cb; return 1; });
        const cancel = vi.fn();
        vi.stubGlobal("requestAnimationFrame", raf);
        vi.stubGlobal("cancelAnimationFrame", cancel);
        try {
            const viewer = await loaded("quartz");
            const group = groupOf(viewer);
            expect(group.rotation.y).toBe(0);
            viewer.start();
            rafCallback.fn!(); // run one animation frame
            expect(group.rotation.y).toBeGreaterThan(0); // rotation advances
            viewer.stop();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
