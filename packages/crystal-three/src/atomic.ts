import { Color, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, LineSegments, Matrix4, MeshStandardMaterial, Mesh, SphereGeometry, Vector3, BufferGeometry, LineBasicMaterial } from "three";
import type { ExpandedAtom, Lattice, Mat3, PeriodicBond, Vec3 } from "@crystal/core";

export interface AtomicRenderOptions {
    /** Cells per axis; defaults to `[1, 1, 1]`. The grid is centred on the origin. */
    readonly repetition?: readonly [number, number, number];
    /** Render inferred/imported bonds when true; defaults to true. */
    readonly showBonds?: boolean;
    /** Render the unit-cell wireframe overlay; defaults to true. */
    readonly showUnitCell?: boolean;
}

/** CPK-style element colours and radii (Å) for a representative subset. */
const ELEMENT_STYLE: Readonly<Record<string, { color: number; radius: number }>> = {
    H: { color: 0xffffff, radius: 0.25 }, Li: { color: 0x7d40ff, radius: 0.45 }, Be: { color: 0x40c2a0, radius: 0.35 },
    B: { color: 0xffb5a0, radius: 0.35 }, C: { color: 0x404040, radius: 0.35 }, N: { color: 0x3050f8, radius: 0.35 },
    O: { color: 0xff2020, radius: 0.35 }, F: { color: 0x90e050, radius: 0.35 }, Na: { color: 0xab5cf0, radius: 0.5 },
    Mg: { color: 0x8aff00, radius: 0.5 }, Al: { color: 0xbfa6a6, radius: 0.5 }, Si: { color: 0xf0c8a0, radius: 0.4 },
    P: { color: 0xff8000, radius: 0.4 }, S: { color: 0xffc832, radius: 0.4 }, Cl: { color: 0x1ff01f, radius: 0.4 },
    K: { color: 0x8f40d4, radius: 0.5 }, Ca: { color: 0x3dff00, radius: 0.5 }, Ti: { color: 0xbfc2c7, radius: 0.45 },
    V: { color: 0xa6a6ab, radius: 0.45 }, Cr: { color: 0x8a99c7, radius: 0.45 }, Mn: { color: 0x9c7ac7, radius: 0.45 },
    Fe: { color: 0xe06633, radius: 0.45 }, Co: { color: 0xf090a0, radius: 0.45 }, Ni: { color: 0x50d050, radius: 0.45 },
    Cu: { color: 0xc88033, radius: 0.45 }, Zn: { color: 0x7d80b0, radius: 0.45 },
};
const DEFAULT_STYLE = { color: 0xff90ff, radius: 0.4 };

function style(element: string): { color: number; radius: number } {
    return ELEMENT_STYLE[element] ?? DEFAULT_STYLE;
}

function cartesian(direct: Mat3, frac: Vec3): Vector3 {
    return new Vector3(
        direct[0][0] * frac[0] + direct[0][1] * frac[1] + direct[0][2] * frac[2],
        direct[1][0] * frac[0] + direct[1][1] * frac[1] + direct[1][2] * frac[2],
        direct[2][0] * frac[0] + direct[2][1] * frac[1] + direct[2][2] * frac[2],
    );
}

function gridOffsets(repetition: readonly [number, number, number]): Vec3[] {
    const offsets: Vec3[] = [];
    for (let i = 0; i < repetition[0]; i++) for (let j = 0; j < repetition[1]; j++) for (let k = 0; k < repetition[2]; k++) {
        offsets.push([i, j, k]);
    }
    return offsets;
}

/**
 * Builds a Three.js group rendering expanded atoms, optional periodic bonds, and a
 * unit-cell wireframe. Atoms use instanced spheres coloured and sized by element.
 * Partial occupancies are rendered proportionally transparent, rather than as
 * visually full sites.
 * Positions are in crystal-local Cartesian coordinates; the caller centres the group.
 */
export function createAtomicStructure(
    atoms: readonly ExpandedAtom[],
    bonds: readonly PeriodicBond[],
    lattice: Lattice,
    options: AtomicRenderOptions = {},
): Group {
    const repetition = options.repetition ?? [1, 1, 1];
    const showBonds = options.showBonds ?? true;
    const showUnitCell = options.showUnitCell ?? true;
    const group = new Group();
    const offsets = gridOffsets(repetition);
    const direct = lattice.direct;

    // Atoms: one InstancedMesh per element-radius/occupancy bucket. Occupancy is
    // material opacity, so a partial site is visibly distinct from a full one.
    const positionsByStyle = new Map<string, { radius: number; occupancy: number; entries: { atom: ExpandedAtom; offset: Vec3; pos: Vector3 }[] }>();
    for (const offset of offsets) {
        for (const atom of atoms) {
            const frac = [atom.position[0] + offset[0], atom.position[1] + offset[1], atom.position[2] + offset[2]] as const;
            const pos = cartesian(direct, frac);
            const r = style(atom.element).radius;
            const occupancy = atom.occupancy ?? 1;
            const key = `${r}:${occupancy}`;
            const bucket = positionsByStyle.get(key) ?? { radius: r, occupancy, entries: [] };
            bucket.entries.push({ atom, offset, pos });
            positionsByStyle.set(key, bucket);
        }
    }
    for (const { radius, occupancy, entries } of positionsByStyle.values()) {
        const geometry = new SphereGeometry(Math.max(radius, 0.05), 16, 12);
        const material = new MeshStandardMaterial({ roughness: 0.45, metalness: 0.05, opacity: occupancy, transparent: occupancy < 1 });
        const mesh = new InstancedMesh(geometry, material, entries.length);
        const color = new Color();
        const matrix = new Matrix4();
        entries.forEach((entry, i) => {
            color.setHex(style(entry.atom.element).color);
            mesh.setColorAt(i, color);
            matrix.setPosition(entry.pos);
            mesh.setMatrixAt(i, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        group.add(mesh);
    }

    // Bonds: thin cylinders between endpoints across the periodic repetition grid.
    if (showBonds && bonds.length) {
        const bondGeometry = new CylinderGeometry(0.04, 0.04, 1, 8);
        const bondMaterial = new MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.6 });
        const bondMeshes: Mesh[] = [];
        for (const offset of offsets) {
            for (const bond of bonds) {
                const a = atoms.find((at) => at.id === bond.a.siteId);
                const b = atoms.find((at) => at.id === bond.b.siteId);
                if (!a || !b) continue;
                const start = cartesian(direct, [a.position[0] + bond.a.cellOffset[0] + offset[0], a.position[1] + bond.a.cellOffset[1] + offset[1], a.position[2] + bond.a.cellOffset[2] + offset[2]] as unknown as Vec3);
                const end = cartesian(direct, [b.position[0] + bond.b.cellOffset[0] + offset[0], b.position[1] + bond.b.cellOffset[1] + offset[1], b.position[2] + bond.b.cellOffset[2] + offset[2]] as unknown as Vec3);
                const mesh = new Mesh(bondGeometry, bondMaterial);
                positionBond(mesh, start, end);
                bondMeshes.push(mesh);
            }
        }
        bondMeshes.forEach((m) => group.add(m));
    }

    // Unit-cell wireframe (parallelepiped edges) at the base cell corner.
    if (showUnitCell) {
        const o = cartesian(direct, [0, 0, 0]);
        const ax = cartesian(direct, [1, 0, 0]);
        const ay = cartesian(direct, [0, 1, 0]);
        const az = cartesian(direct, [0, 0, 1]);
        const corners = [o, ax, ay, az, new Vector3().addVectors(ax, ay), new Vector3().addVectors(ax, az), new Vector3().addVectors(ay, az), new Vector3().addVectors(ax, ay).add(az)];
        const edges: number[] = [];
        const edge = (i: number, j: number) => edges.push(corners[i]!.x, corners[i]!.y, corners[i]!.z, corners[j]!.x, corners[j]!.y, corners[j]!.z);
        edge(0, 1); edge(0, 2); edge(0, 3); edge(1, 4); edge(1, 5); edge(2, 4); edge(2, 6); edge(3, 5); edge(3, 6); edge(4, 7); edge(5, 7); edge(6, 7);
        const geo = new BufferGeometry();
        geo.setAttribute("position", new Float32BufferAttribute(edges, 3));
        group.add(new LineSegments(geo, new LineBasicMaterial({ color: 0x66ccff })));
    }

    return group;
}

function positionBond(mesh: Mesh, start: Vector3, end: Vector3): void {
    const dir = new Vector3().subVectors(end, start);
    const length = dir.length();
    if (length < 1e-9) { mesh.visible = false; return; }
    mesh.scale.set(1, length, 1);
    mesh.position.copy(start).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
}

/** Computes the Cartesian bounds of an atomic structure over a repetition grid. */
export function atomicBounds(atoms: readonly ExpandedAtom[], lattice: Lattice, repetition: readonly [number, number, number]): { min: Vector3; max: Vector3 } {
    const direct = lattice.direct;
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < repetition[0]; i++) for (let j = 0; j < repetition[1]; j++) for (let k = 0; k < repetition[2]; k++) {
        for (const atom of atoms) {
            const p = cartesian(direct, [atom.position[0] + i, atom.position[1] + j, atom.position[2] + k] as unknown as Vec3);
            min.min(p); max.max(p);
        }
    }
    return { min, max };
}
