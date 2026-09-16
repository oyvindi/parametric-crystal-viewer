/** Dimensionless thresholds; length comparisons have an absolute floor of one normalized unit. */
export const TOLERANCES = Object.freeze({
    matrix: 1e-12,
    symmetry: 1e-10,
    normal: 1e-10,
    plane: 1e-9,
    vertex: 1e-8,
    collinear: 1e-10,
    volume: 1e-12,
    cellVolume: 1e-12,
});
export const relativeTolerance = (epsilon: number, ...values: number[]): number =>
    epsilon * Math.max(1, ...values.map(Math.abs));
