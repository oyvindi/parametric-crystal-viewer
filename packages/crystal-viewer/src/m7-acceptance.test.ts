import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Group, Mesh, Scene, PerspectiveCamera } from "three";
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
afterEach(() => { viewers.splice(0).forEach((v) => v.dispose()); render.mockClear(); });

function canvas(): HTMLCanvasElement {
    return Object.assign(new EventTarget(), { clientWidth: 400, clientHeight: 300 }) as HTMLCanvasElement;
}

function drag(c: HTMLCanvasElement): void {
    c.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 0 }));
    c.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 12 }));
    c.dispatchEvent(new Event("pointerup"));
}

async function loaded(source: unknown = "quartz"): Promise<CrystalViewer> {
    const v = new CrystalViewer(canvas());
    viewers.push(v);
    await v.loadMineral(source);
    return v;
}

// Calcite trigonal-setting fixtures (paired hexagonal / rhombohedral).
const CALCITE_HEX_CIF = readFileSync(new URL("../../crystal-core/test-fixtures/m5/9000095.cif", import.meta.url), "utf8");
const CALCITE_RHOM_CIF = readFileSync(new URL("../../crystal-data/test-fixtures/m6/calcite-rhombohedral.cif", import.meta.url), "utf8");
const P1_CIF = `data_p1
_cell_length_a 5.0
_cell_length_b 5.0
_cell_length_c 5.0
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_space_group_name_H-M 'P -1'
loop_
_space_group_symop_operation_xyz
x,y,z
-x,-y,-z
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
C1 C 0.1 0.2 0.3
C2 C 0.25 0.25 0.25
`;

describe("M7 loading contracts", () => {
    it("overlapping loads commit only the newest request; superseded completions emit load-superseded", async () => {
        const viewer = new CrystalViewer(canvas());
        viewers.push(viewer);
        const superseded = vi.fn();
        const loaded = vi.fn();
        viewer.addEventListener("load-superseded", superseded);
        viewer.addEventListener("mineral-loaded", loaded);
        const p1 = viewer.loadMineral("quartz");
        const p2 = viewer.loadMineral("fluorite");
        await Promise.all([p1, p2]);
        expect(viewer.getMineralId()).toBe("fluorite");
        expect(loaded).toHaveBeenCalledTimes(1);
        expect(loaded).toHaveBeenCalledWith(expect.objectContaining({ detail: { mineralId: "fluorite", dataRevision: FLUORITE.dataRevision } }));
        expect(superseded).toHaveBeenCalledTimes(1);
    });

    it("a superseded load does not commit even when the newest request fails; state is preserved", async () => {
        const viewer = await loaded("quartz");
        const baseline = viewer.getState();
        const superseded = vi.fn();
        const loadedEvent = vi.fn();
        const failed = vi.fn();
        viewer.addEventListener("load-superseded", superseded);
        viewer.addEventListener("mineral-loaded", loadedEvent);
        viewer.addEventListener("mineral-load-failed", failed);
        const p1 = viewer.loadMineral("fluorite"); // superseded
        const p2 = viewer.loadMineral("missing"); // newest, fails
        await Promise.allSettled([p1, p2]);
        expect(viewer.getMineralId()).toBe("quartz");
        expect(loadedEvent).not.toHaveBeenCalled();
        expect(failed).toHaveBeenCalledTimes(1);
        expect(superseded).toHaveBeenCalledTimes(1);
        expect(viewer.getState()).toEqual(baseline);
    });

    it("committing a different mineral clears the previous morphology mesh; an invalid new definition shows no mesh", async () => {
        const viewer = await loaded("quartz");
        const group = render.mock.lastCall![0] as unknown as Scene;
        const crystalGroup = group.children.find((c) => c instanceof Group) as unknown as { children: unknown[] };
        expect(crystalGroup.children.some((c) => c instanceof Mesh)).toBe(true);
        const source: any = structuredClone(FLUORITE);
        source.id = "all-disabled";
        source.habits[0].forms.forEach((f: any) => { f.enabled = false; });
        await viewer.loadMineral(source);
        expect(viewer.getMineralId()).toBe("all-disabled");
        expect(viewer.getGeometryStatus()).toMatchObject({ status: "invalid", stale: false });
        expect(crystalGroup.children.some((c) => c instanceof Mesh)).toBe(false);
    });
});

describe("M7 lifecycle (disconnect, reconnect, disposal)", () => {
    it("pauses rendering and detaches listeners on disconnect; reconnect reattaches without duplicates", async () => {
        const c = canvas();
        const viewer = new CrystalViewer(c);
        viewers.push(viewer);
        await viewer.loadMineral("quartz");
        render.mockClear();
        drag(c);
        expect(render).toHaveBeenCalled();
        viewer.disconnect();
        expect(viewer.isDisconnected()).toBe(true);
        render.mockClear();
        drag(c);
        expect(render).not.toHaveBeenCalled();
        viewer.reconnect();
        expect(viewer.isDisconnected()).toBe(false);
        render.mockClear();
        c.dispatchEvent(Object.assign(new Event("pointerdown"), { clientX: 0 }));
        c.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: 12 }));
        expect(render).toHaveBeenCalledTimes(1); // exactly one → no duplicate listener
        c.dispatchEvent(new Event("pointerup"));
    });

    it("a running viewer resumes on reconnect; a stopped viewer remains stopped", async () => {
        const raf = vi.fn(() => 1);
        const cancel = vi.fn();
        vi.stubGlobal("requestAnimationFrame", raf);
        vi.stubGlobal("cancelAnimationFrame", cancel);
        try {
            // Running case: start → disconnect → reconnect resumes.
            const v = new CrystalViewer(canvas());
            viewers.push(v);
            await v.loadMineral("quartz");
            raf.mockClear();
            v.start();
            expect(raf).toHaveBeenCalledTimes(1);
            v.disconnect();
            expect(cancel).toHaveBeenCalled();
            raf.mockClear();
            v.reconnect();
            expect(raf).toHaveBeenCalledTimes(1); // start called again → resumed

            // Stopped case: never started → disconnect → reconnect stays stopped.
            const raf2 = vi.fn(() => 2);
            vi.stubGlobal("requestAnimationFrame", raf2);
            const w = new CrystalViewer(canvas());
            viewers.push(w);
            await w.loadMineral("fluorite");
            raf2.mockClear();
            w.disconnect();
            w.reconnect();
            expect(raf2).not.toHaveBeenCalled(); // stayed stopped
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("disposal is idempotent; later mutating calls report disposal; reconnect does not reactivate", async () => {
        const viewer = await loaded("quartz");
        viewer.dispose();
        expect(viewer.isDisposed()).toBe(true);
        expect(() => viewer.dispose()).not.toThrow(); // repeated harmless
        expect(() => viewer.setFormDevelopment("m", 0.5)).toThrow(ViewerOperationError);
        viewer.reconnect();
        expect(viewer.isDisposed()).toBe(true); // not reactivated
        await expect(viewer.loadMineral("fluorite")).rejects.toThrow(ViewerOperationError);
    });
});

describe("M7 state serialization", () => {
    it("getState → setState → getState preserves equivalent persistent configuration", async () => {
        const viewer = await loaded("quartz");
        viewer.setHabit("tessin");
        viewer.setFormDevelopment("m", 0.72);
        viewer.setFormDevelopment("M", 0.86);
        viewer.setFormEnabled("psi", false);
        viewer.setMorphologyScale(1.5);
        viewer.setShowAxes(true);
        viewer.setShowUnitCell(true);
        viewer.setShowWireframe(true);
        viewer.setLatticeRepetition(2, 3, 4);
        drag(canvasFor(viewer));
        const state1 = viewer.getState();

        // Same viewer round-trip.
        viewer.setState(state1);
        expect(viewer.getState()).toEqual(state1);

        // Fresh viewer round-trip (portability).
        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        fresh.setState(state1);
        expect(fresh.getState()).toEqual(state1);
    });

    it("saved effective settings take precedence over preset defaults", async () => {
        const viewer = await loaded("quartz");
        viewer.setHabit("tessin");
        viewer.setFormDevelopment("m", 0.3);
        const saved = viewer.getState();
        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        await fresh.loadMineral("quartz");
        fresh.setHabit("tessin"); // applies preset defaults
        fresh.setState(saved);
        expect(fresh.getForms().find((f) => f.id === "m")!.development).toBe(0.3);
    });

    it("restores camera, persistent display settings, atomic view mode, and lattice repetition", async () => {
        const viewer = await loaded("quartz");
        viewer.setShowAxes(true);
        viewer.setShowUnitCell(true);
        viewer.setShowBonds(false);
        viewer.setShowWireframe(true);
        viewer.setLatticeRepetition(2, 2, 2);
        const saved = viewer.getState();
        expect(saved.display).toMatchObject({ axes: true, unitCell: true, bonds: false, wireframe: true });
        expect(saved.atomic.latticeRepetition).toEqual([2, 2, 2]);
        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        fresh.setState(saved);
        const restored = fresh.getState();
        expect(restored.display).toEqual(saved.display);
        expect(restored.atomic.latticeRepetition).toEqual([2, 2, 2]);
        expect(restored.camera).toEqual(saved.camera);
    });

    it("restores an imported structure in a fresh viewer without the original import session and preserves provenance", async () => {
        const viewer = new CrystalViewer(canvas());
        viewers.push(viewer);
        viewer.loadCif(P1_CIF);
        const saved = viewer.getState();
        expect(saved.structure).toBeDefined();
        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        fresh.setState(saved);
        const info = fresh.getStructureInfo();
        expect(info).not.toBeNull();
        expect(info!.crystalSystem).toBe("triclinic");
        expect(info!.pointGroup).toBe("-1");
        expect(fresh.getViewMode()).toBe("atomic");
        // Provenance and source metadata travel with the embedded definition.
        expect(fresh.getState().structure!.definition).toEqual(saved.structure!.definition);
    });

    it("rejects malformed state, unsupported versions, and incompatible references without partial mutation", async () => {
        const viewer = await loaded("quartz");
        viewer.setHabit("tessin");
        const before = viewer.getState();
        const rejected = vi.fn();
        viewer.addEventListener("state-rejected", rejected);

        const bad: unknown[] = [
            "not-an-object",
            {},
            { ...before, version: 2 },
            { ...before, mineral: { id: "nope", dataRevision: "x" } },
            { ...before, mineral: { id: "quartz", dataRevision: "wrong" } },
            { ...before, forms: { ...before.forms, noform: { development: 0.5, enabled: true } } },
            { ...before, camera: { ...before.camera, position: [1, 2] } },
        ];
        for (const state of bad) {
            expect(() => viewer.setState(state)).toThrow(ViewerOperationError);
        }
        expect(rejected).toHaveBeenCalledTimes(bad.length);
        expect(viewer.getState()).toEqual(before); // no partial mutation
    });

    it("accepts structurally valid state that produces invalid geometry; fresh and retained-mesh behavior and recovery", async () => {
        const viewer = await loaded("quartz");
        const valid = viewer.getState();
        const invalidForms = Object.fromEntries(Object.keys(valid.forms).map((k) => [k, { development: 0, enabled: true }]));
        const invalidState = { ...valid, forms: invalidForms };

        // Fresh viewer restoring an invalid request shows no mesh.
        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        fresh.setState(invalidState);
        expect(fresh.getGeometryStatus()).toMatchObject({ status: "invalid", stale: false });

        // Existing viewer with a valid mesh retains it as stale.
        viewer.setState(invalidState);
        expect(viewer.getGeometryStatus()).toMatchObject({ status: "invalid", stale: true });

        // Subsequent valid restoration recovers.
        viewer.setState(valid);
        expect(viewer.getGeometryStatus().status).toBe("valid");
    });

    it("restores each representation of the paired trigonal-setting fixture and preserves its declared setting", async () => {
        // Hexagonal calcite.
        const vh = new CrystalViewer(canvas());
        viewers.push(vh);
        vh.loadCif(CALCITE_HEX_CIF);
        const sh = vh.getState();
        const fh = new CrystalViewer(canvas());
        viewers.push(fh);
        fh.setState(sh);
        expect(fh.getStructureInfo()!.crystalSystem).toBe("trigonal");
        expect(fh.getStructureInfo()!.setting).toBe("hexagonal-standard");

        // Rhombohedral calcite.
        const vr = new CrystalViewer(canvas());
        viewers.push(vr);
        vr.loadCif(CALCITE_RHOM_CIF);
        const sr = vr.getState();
        const fr = new CrystalViewer(canvas());
        viewers.push(fr);
        fr.setState(sr);
        expect(fr.getStructureInfo()!.crystalSystem).toBe("trigonal");
        expect(fr.getState().structure!.definition).toEqual(sr.structure!.definition);
    });

    // M8 appearance-state round trip: the placeholder is now verified. See
    // m8-acceptance.test.ts for parameter-mapping and visual-review evidence.
    it("appearance state and user-override round trips", async () => {
        const viewer = await loaded("quartz");
        viewer.setAppearance("amethyst");
        viewer.setAppearanceField("roughness", 0.2);
        const saved = viewer.getState();
        expect(saved.appearance).toMatchObject({ id: "amethyst", overrides: { roughness: 0.2 } });

        // Same viewer.
        viewer.setState(saved);
        expect(viewer.getAppearanceId()).toBe("amethyst");
        expect(viewer.getAppearance().roughness).toBe(0.2);
        expect(viewer.getState().appearance).toEqual(saved.appearance);

        // Fresh viewer (portability).
        const fresh = new CrystalViewer(canvas());
        viewers.push(fresh);
        fresh.setState(saved);
        expect(fresh.getAppearanceId()).toBe("amethyst");
        expect(fresh.getAppearance().roughness).toBe(0.2);
        expect(fresh.getState().appearance).toEqual(saved.appearance);
    });
});

describe("M7 demo synchronization through events", () => {
    it("emits events for programmatic changes and state restoration so controls can resync", async () => {
        const viewer = await loaded("quartz");
        const habitChanged = vi.fn();
        const formChanged = vi.fn();
        const restored = vi.fn();
        viewer.addEventListener("habit-changed", habitChanged);
        viewer.addEventListener("form-changed", formChanged);
        viewer.addEventListener("state-restored", restored);
        viewer.setHabit("tessin");
        expect(habitChanged).toHaveBeenCalledTimes(1);
        viewer.setFormDevelopment("m", 0.4);
        expect(formChanged).toHaveBeenCalledTimes(1);
        viewer.setState(viewer.getState());
        expect(restored).toHaveBeenCalledTimes(1);
    });
});

function canvasFor(viewer: CrystalViewer): HTMLCanvasElement {
    // The viewer stored its canvas privately; reuse the stubbed EventTarget via the
    // pointer surface by dispatching on a fresh canvas is not possible. Instead,
    // mutate rotation through the public drag path using the viewer's own canvas.
    return (viewer as unknown as { canvas: HTMLCanvasElement }).canvas;
}
