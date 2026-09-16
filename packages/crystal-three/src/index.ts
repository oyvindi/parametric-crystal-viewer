import type { CrystalGeometry } from "@crystal/core";

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
