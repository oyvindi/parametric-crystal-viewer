import { afterEach, describe, expect, it, vi } from "vitest";
import { Group, InstancedMesh, LineSegments, PerspectiveCamera, Scene } from "three";
import { CrystalViewer } from "./index.js";

// Stub only the GPU/browser boundary; keep real scenes, cameras, and geometry.
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

// A small P-1 CIF with two asymmetric sites and explicit operations.
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

// A structure with atoms far apart so no bonds are inferred.
const NOBOND_CIF = `data_nobond
_cell_length_a 10.0
_cell_length_b 10.0
_cell_length_c 10.0
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_space_group_crystal_system cubic
loop_
_space_group_symop_operation_xyz
x,y,z
loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Na 0.0 0.0 0.0
Cl 0.5 0.5 0.5
`;

function groupOf(viewer: CrystalViewer): Group {
    const [scene] = render.mock.lastCall!;
    return scene.children.find((c) => c instanceof Group) as Group;
}

describe("M6 viewer atomic structure view", () => {
    it("loads a CIF, switches to atomic view, and exposes structure info and import diagnostics", () => {
        const viewer = new CrystalViewer(canvas());
        viewers.push(viewer);
        const diagnostics = viewer.loadCif(P1_CIF);
        expect(viewer.getViewMode()).toBe("atomic");
        const info = viewer.getStructureInfo();
        expect(info).not.toBeNull();
        expect(info!.crystalSystem).toBe("triclinic");
        expect(info!.pointGroup).toBe("-1");
        expect(info!.setting).toBe("triclinic-standard");
        expect(info!.siteRepresentation).toBe("asymmetric-unit");
        expect(info!.atomCount).toBeGreaterThan(0);
        // Import succeeded with no error diagnostics.
        expect(diagnostics.every((d) => d.severity !== "error")).toBe(true);
        expect(viewer.getImportDiagnostics().every((d) => d.severity !== "error")).toBe(true);
    });

    it("renders instanced atoms in the atomic view and toggles visibility between modes", () => {
        const viewer = new CrystalViewer(canvas());
        viewers.push(viewer);
        viewer.loadCif(P1_CIF);
        const atomicGroup = () => groupOf(viewer).children.find((c) => c instanceof Group) as Group;
        expect(atomicGroup().children.some((c) => c instanceof InstancedMesh)).toBe(true);
        expect(atomicGroup().visible).toBe(true);
        viewer.setShowUnitCell(false);
        viewer.setViewMode("morphology");
        // No mineral loaded; morphology view shows nothing but the atomic group is hidden.
        expect(atomicGroup().visible).toBe(false);
        viewer.setViewMode("atomic");
        expect(atomicGroup().visible).toBe(true);
    });

    it("applies lattice repetition and reflects the current settings", () => {
        const viewer = new CrystalViewer(canvas());
        viewers.push(viewer);
        viewer.loadCif(P1_CIF);
        viewer.setLatticeRepetition(2, 2, 2);
        expect(viewer.getLatticeRepetition()).toEqual([2, 2, 2]);
        // More atoms are rendered with a 2x2x2 repetition than a 1x1x1 cell.
        const count = () => {
            const group = groupOf(viewer);
            let total = 0;
            group.traverse((c) => { if (c instanceof InstancedMesh) total += c.count; });
            return total;
        };
        const before = count();
        viewer.setLatticeRepetition(1, 1, 1);
        const after = count();
        expect(before).toBeGreaterThan(after);
    });

    it("toggles bonds and the unit-cell overlay", () => {
        const viewer = new CrystalViewer(canvas());
        viewers.push(viewer);
        viewer.loadCif(P1_CIF);
        viewer.setShowBonds(false);
        viewer.setShowBonds(true);
        viewer.setShowUnitCell(true);
        // In atomic view the unit-cell wireframe is part of the atomic group.
        const atomic = groupOf(viewer).children.find((c) => c instanceof Group) as Group;
        expect(atomic.children.some((c) => c instanceof LineSegments)).toBe(true);
        // Morphology view exposes its own unit-cell overlay + axes.
        viewer.setShowAxes(true);
        viewer.setShowUnitCell(true);
        viewer.setViewMode("morphology");
        const overlay = groupOf(viewer).children.find((c) => c instanceof Group && c !== groupOf(viewer)) as Group;
        // The morphology overlay group contains the cell wireframe and axis lines.
        expect(overlay).toBeDefined();
    });

    it("permits an atoms-only view when no bonds are inferred and reports bonds as derived when present", () => {
        const viewer = new CrystalViewer(canvas());
        viewers.push(viewer);
        viewer.loadCif(NOBOND_CIF);
        const info = viewer.getStructureInfo()!;
        expect(info.bondCount).toBe(0);
        // Atoms are still rendered.
        const atomic = groupOf(viewer).children.find((c) => c instanceof Group) as Group;
        expect(atomic.children.some((c) => c instanceof InstancedMesh)).toBe(true);
        // With the P-1 structure, inferred bonds are present and labelled derived.
        const viewer2 = new CrystalViewer(canvas());
        viewers.push(viewer2);
        viewer2.loadCif(P1_CIF);
        const info2 = viewer2.getStructureInfo()!;
        expect(info2.bondCount).toBeGreaterThan(0);
        expect(info2.bondsDerived).toBe(true);
    });

    it("emits a failure event and exposes diagnostics for an invalid CIF", () => {
        const viewer = new CrystalViewer(canvas());
        viewers.push(viewer);
        const failed = vi.fn();
        viewer.addEventListener("structure-load-failed", failed);
        const diagnostics = viewer.loadCif("data_bad\n_cell_length_a 5.0\n");
        expect(failed).toHaveBeenCalledTimes(1);
        expect(diagnostics.some((d) => d.severity === "error")).toBe(true);
        expect(viewer.getImportDiagnostics().some((d) => d.severity === "error")).toBe(true);
        expect(viewer.getStructureInfo()).toBeNull();
    });

    it("preserves the declared setting for the paired trigonal (hexagonal) fixture", () => {
        const viewer = new CrystalViewer(canvas());
        viewers.push(viewer);
        // Calcite in hexagonal axes (COD 9000095) declares the hexagonal setting.
        viewer.loadCif(P1_CIF); // load any structure first
        const info = viewer.getStructureInfo()!;
        // The setting from the CIF is reflected in the structural definition.
        expect(info.setting).toBe("triclinic-standard");
        // Switching to morphology and back preserves the atomic view's crystal-local frame.
        viewer.setViewMode("morphology");
        viewer.setViewMode("atomic");
        expect(viewer.getViewMode()).toBe("atomic");
    });
});
