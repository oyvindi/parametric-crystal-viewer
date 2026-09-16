import type { CrystalGeometry } from "@crystal/core";
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from "three";

/** Deterministic convex-polygon triangulation; triangleFaces resolves core provenance. */
export function triangulateCrystal(geometry: CrystalGeometry): {
    readonly indices: Uint32Array;
    readonly triangleFaces: Uint32Array;
} {
    const indices: number[] = [];
    const triangleFaces: number[] = [];
    geometry.faces.forEach((face, faceIndex) => {
        for (let i = 1; i < face.vertexIndices.length - 1; i++) {
            indices.push(face.vertexIndices[0]!, face.vertexIndices[i]!, face.vertexIndices[i + 1]!);
            triangleFaces.push(faceIndex);
        }
    });
    return { indices: new Uint32Array(indices), triangleFaces: new Uint32Array(triangleFaces) };
}

/**
 * Converts core geometry into a Three.js BufferGeometry. Core vertices are
 * Float64; this layer performs the explicit conversion to Float32 for the GPU.
 * Triangulation is deterministic and each triangle retains its originating
 * core face index via the returned `triangleFaces` array.
 */
export function createThreeGeometry(geometry: CrystalGeometry): BufferGeometry {
    const { indices } = triangulateCrystal(geometry);
    const buffer = new BufferGeometry();
    buffer.setAttribute("position", new Float32BufferAttribute(geometry.vertices, 3));
    buffer.setIndex(new Uint32BufferAttribute(indices, 1));
    buffer.computeVertexNormals();
    return buffer;
}

/**
 * Converts core geometry into a Three.js BufferGeometry and returns the
 * triangle-to-core-face mapping needed for picking and face inspection.
 */
export function createThreeGeometryWithPicking(geometry: CrystalGeometry): {
    readonly buffer: BufferGeometry;
    readonly triangleFaces: Uint32Array;
} {
    const { indices, triangleFaces } = triangulateCrystal(geometry);
    const buffer = new BufferGeometry();
    buffer.setAttribute("position", new Float32BufferAttribute(geometry.vertices, 3));
    buffer.setIndex(new Uint32BufferAttribute(indices, 1));
    buffer.computeVertexNormals();
    return { buffer, triangleFaces };
}
