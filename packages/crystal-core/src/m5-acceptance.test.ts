import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createLattice, validateCrystallography, generateCrystal, derivePointOperations, equivalentPointOperationSets, expandEquivalentPlaneDirections, validateSpaceOperations, listPointOperationRegistryEntries, type Vec3, type Mat3, type Crystallography, type GeometryResult, type CrystalFormSetting, type SpaceOperation } from "./index.js";

// Test-only reader for seven pinned COD fixtures. Not a general CIF importer.
const M5_SOURCES = [
    { name: "calcite", cod: "9000095", sha256: "d8a1cf92866da8814ef104b1626117490d9d4fbad823ef5dbf1cd2954488da52", system: "trigonal", group: "-3m", setting: "hexagonal-standard", order: 12, volume: 367.916 },
    { name: "pyrite", cod: "9000594", sha256: "0caef0969b6bcc5697310ab6f4316cbd01daf5fbcb7cfb1b5d6036647548a9d8", system: "cubic", group: "m-3", setting: "cubic-standard", order: 24, volume: 158.921 },
    { name: "anatase", cod: "9015929", sha256: "9df468431a17fa7983e360aed53d9702ea53d7fa31a4a65012e54097daabcd0e", system: "tetragonal", group: "4/mmm", setting: "tetragonal-standard", order: 16, volume: 136.268 },
    { name: "beryl", cod: "9001551", sha256: "04fdde6aa7efdb73f1519426ce84758a90a0aedd3c5de91a5e9579e505ad0e0c", system: "hexagonal", group: "6/mmm", setting: "hexagonal-standard", order: 24, volume: 674.070 },
    { name: "forsterite", cod: "9000319", sha256: "550b8c89c617267d39e7cb6a07fe6f55cd2343453c1c45ec77738bf6fd25d9cd", system: "orthorhombic", group: "mmm", setting: "orthorhombic-standard", order: 8, volume: 290.296 },
    { name: "gypsum", cod: "9013164", sha256: "022d608c9299439dd5a36151d45e0f6753171c50e663fc858ce61cb340c77036", system: "monoclinic", group: "2/m", setting: "monoclinic-b", order: 4, volume: 493.340 },
    { name: "albite", cod: "9000993", sha256: "04850338d389d22973ed2cf32b91a9324e5aaec0e50f7e7a08f1f09bedcb8573", system: "triclinic", group: "-1", setting: "triclinic-standard", order: 2, volume: 659.829 },
] as const;

function readM5Fixture(source: typeof M5_SOURCES[number]): { crystallography: Crystallography; spaceOperations: SpaceOperation[] } {
    const bytes = readFileSync(new URL(`../test-fixtures/m5/${source.cod}.cif`, import.meta.url));
    if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw Error(`Changed COD fixture ${source.cod}`);
    const text = bytes.toString();
    const numeric = (tag: string) => {
        const value = text.match(new RegExp(`^${tag}\\s+([0-9.]+)$`, "m"))?.[1];
        if (!value) throw Error(`Missing numeric fixture tag ${tag}`);
        return Number(value);
    };
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex(line => /^_(space_group_symop_operation_xyz|symmetry_equiv_pos_as_xyz)$/.test(line));
    if (start < 0) throw Error("Missing fixture operations");
    const operations: SpaceOperation[] = [];
    for (const line of lines.slice(start + 1)) {
        if (line === "loop_" || line.startsWith("_")) break;
        if (!line.trim()) continue;
        const expressions = line.replace(/^\d+\s+/, "").split(",");
        if (expressions.length !== 3) throw Error(`Unexpected fixture expression ${line}`);
        const translation: number[] = [];
        const linear = expressions.map(expression => {
            const row = [0, 0, 0]; let offset = 0;
            const terms = expression.match(/[+-]?[^+-]+/g) ?? [];
            for (const term of terms) {
                const sign = term.startsWith("-") ? -1 : 1;
                const token = term.replace(/^[+-]/, "");
                const axis = ["x", "y", "z"].indexOf(token);
                if (axis >= 0) row[axis] = row[axis]! + sign;
                else if (/^\d+(\/\d+)?$/.test(token)) {
                    const [n, d = 1] = token.split("/").map(Number); offset += sign * n! / d;
                } else throw Error(`Unsupported fixture token ${term}`);
            }
            translation.push(offset); return row;
        });
        operations.push({ id: `cod-${source.cod}-${operations.length}`, linear: linear as unknown as Mat3, translation: translation as unknown as Vec3 });
    }
    return { crystallography: {
        crystalSystem: source.system, pointGroup: source.group, setting: source.setting,
        unitCell: { a: numeric("_cell_length_a"), b: numeric("_cell_length_b"), c: numeric("_cell_length_c"),
            alpha: numeric("_cell_angle_alpha"), beta: numeric("_cell_angle_beta"), gamma: numeric("_cell_angle_gamma") },
    }, spaceOperations: operations };
}

const multiply = (a: Mat3, b: Mat3): Mat3 => a.map(row => b[0].map((_,j) => row.reduce((s,v,k) => s+v*b[k]![j]!,0))) as unknown as Mat3;
const vector = (a: Mat3, v: Vec3): Vec3 => a.map(row => row.reduce((s,x,i) => s+x*v[i]!,0)) as unknown as Vec3;
const transpose = (a: Mat3): Mat3 => a[0].map((_,i) => a.map(row => row[i])) as unknown as Mat3;
const normalized = (v: Vec3): Vec3 => v.map(x => x/Math.hypot(...v)) as unknown as Vec3;
const closeVector = (a: readonly number[], b: readonly number[]) => a.forEach((x,i) => expect(x).toBeCloseTo(b[i]!,8));
const valid = (r: GeometryResult) => { expect(r.status,JSON.stringify(r.diagnostics)).toBe("valid"); if(r.status !== "valid") throw Error("fixture"); return r.geometry; };
const form = (h:number,k:number,l:number,id=`${h},${k},${l}`): CrystalFormSetting => ({id,indices:{notation:"miller",h,k,l},development:1});
const axes = [form(1,0,0),form(0,1,0),form(0,0,1)];

it("checks generated subset integrity and deep immutability", () => {
    const bytes=readFileSync(new URL("./registry/m5-operations.ts",import.meta.url));
    const hash=createHash("sha256").update(bytes).digest("hex");
    const entries=listPointOperationRegistryEntries().filter(e=>e.integrity.generator.endsWith("generate-m5-registry.mjs"));
    expect(entries).toHaveLength(8);
    for(const e of entries){
        expect(e.integrity.artifactSha256).toBe(hash);
        expect(Object.isFrozen(e) && Object.isFrozen(e.integrity) && Object.isFrozen(e.source)).toBe(true);
        expect(Object.isFrozen(e.operations)).toBe(true);
        for(const op of e.operations) expect(Object.isFrozen(op) && Object.isFrozen(op.linear) && op.linear.every(Object.isFrozen)).toBe(true);
    }
});

for(const source of M5_SOURCES) describe(`M5 sourced ${source.name}`,()=>{
    const {crystallography:c,spaceOperations}=readM5Fixture(source);
    const latticeResult=createLattice(c.unitCell); if(!latticeResult.ok) throw Error("cell");
    const lattice=latticeResult.value;
    it("reproduces the published volume and fractional metric",()=>{
        expect(Math.abs(lattice.volume-source.volume)).toBeLessThan(0.001);
        const v:Vec3=[0.2,-0.7,1.3], cart=vector(lattice.direct,v);
        expect(cart.reduce((s,x)=>s+x*x,0)).toBeCloseTo(v.reduce((s,x,i)=>s+x*vector(lattice.metric,v)[i]!,0),9);
        const eye=multiply(transpose(lattice.direct),lattice.reciprocal);
        eye.forEach((row,i)=>row.forEach((x,j)=>expect(x).toBeCloseTo(i===j?1:0,10)));
    });
    it("matches independently sourced CIF operations, group laws and metric",()=>{
        const full=validateSpaceOperations(spaceOperations,lattice);
        expect(full.ok,JSON.stringify(full.diagnostics)).toBe(true);
        const resolved=validateCrystallography(c); expect(resolved.ok).toBe(true);if(!resolved.ok)return;
        expect(resolved.value.operations).toHaveLength(source.order);
        expect(equivalentPointOperationSets(resolved.value.operations,derivePointOperations(spaceOperations))).toBe(true);
        const explicit=validateCrystallography({...c,spaceOperations});
        expect(explicit.ok,JSON.stringify(explicit.diagnostics)).toBe(true);
        const general=expandEquivalentPlaneDirections({notation:"miller",h:1,k:2,l:3},resolved.value.operations,lattice);
        expect(general.ok).toBe(true);if(general.ok)expect(general.value).toHaveLength(source.order);
    });
    it("generates enclosing forms with equal explicit/registry geometry and reciprocal normals",()=>{
        const forms=source.system==="tetragonal"?[form(1,0,1)]:source.system==="trigonal"?[form(1,0,4)]:axes;
        const g=valid(generateCrystal(c,{forms}));
        const explicit=valid(generateCrystal({...c,pointGroup:undefined,spaceOperations},{forms}));
        expect(explicit.vertices).toEqual(g.vertices);
        expect(g.faces).toHaveLength(source.system==="hexagonal"||source.system==="tetragonal"?8:6);
        for(const face of g.faces){
            const idx=face.contributors[0]!.indices!;
            closeVector(face.normal,normalized(vector(lattice.reciprocal,[idx.h,idx.k,idx.l])));
        }
        // CIF operation x -> -x is present for every selected centrosymmetric fixture.
        const inverse=spaceOperations.find(op=>op.linear.every((row,i)=>row.every((x,j)=>x===(i===j?-1:0))));
        expect(inverse).toBeDefined();
    });
});

describe("M5 paired calcite settings",()=>{
    const hex=readM5Fixture(M5_SOURCES[0]).crystallography;
    const {a,c}=hex.unitCell;
    const ar=Math.sqrt(3*a*a+c*c)/3;
    const angle=Math.acos((2*c*c-3*a*a)/(2*(c*c+3*a*a)))*180/Math.PI;
    const rhom:Crystallography={...hex,setting:"rhombohedral-standard",unitCell:{a:ar,b:ar,c:ar,alpha:angle,beta:angle,gamma:angle}};
    // L_R(aligned) = L_H P; columns are primitive obverse R translations.
    const P:Mat3=[[2/3,-1/3,-1/3],[1/3,1/3,-2/3],[1/3,1/3,1/3]];
    const Pinv:Mat3=[[1,0,1],[-1,1,1],[0,-1,1]];
    const hr=validateCrystallography(hex),rr=validateCrystallography(rhom);
    if(!hr.ok||!rr.ok)throw Error("paired fixture validation");
    const H=hr.value.lattice,R=rr.value.lattice;
    // Each cell receives its own canonical Cartesian frame. Q rotates R into H.
    const Q=multiply(multiply(H.direct,P),transpose(R.reciprocal));
    it("has equivalent metrics, operations, a proper frame rotation and 3:1 cell volume",()=>{
        expect(H.volume/R.volume).toBeCloseTo(3,10);
        multiply(transpose(P),multiply(H.metric,P)).forEach((row,i)=>closeVector(row,R.metric[i]!));
        multiply(transpose(Q),Q).forEach((row,i)=>closeVector(row,[i===0?1:0,i===1?1:0,i===2?1:0]));
        const converted=hr.value.operations.map(op=>({id:op.id,linear:multiply(Pinv,multiply(op.linear,P)).map(row=>row.map(Math.round)) as unknown as Mat3}));
        expect(equivalentPointOperationSets(converted,rr.value.operations)).toBe(true);
    });
    for(const h of [[1,0,4],[2,1,4]] as readonly [number,number,number][]) it(`matches ${h} plane directions, centered vertices and face areas`,()=>{
        const raw=vector(transpose(P),h); const r=raw.map(x=>Math.round(3*x)) as unknown as Vec3;
        closeVector(normalized(vector(H.reciprocal,h)),normalized(vector(Q,vector(R.reciprocal,r))));
        const hg=valid(generateCrystal(hex,{forms:[form(...h)]}));
        const rg=valid(generateCrystal(rhom,{forms:[form(...r)]}));
        expect(rg.faces.length).toBe(hg.faces.length);
        const centered=(g:typeof hg,L:typeof H) => Array.from({length:g.vertices.length/3},(_,i)=>g.vertices.slice(i*3,i*3+3).map((x,j)=>x-L.direct[j]!.reduce((s,v)=>s+v/2,0)) as unknown as Vec3);
        const hv=centered(hg,H),rv=centered(rg,R).map(v=>vector(Q,v));
        expect(hv.length).toBe(rv.length);
        for(const v of rv) expect(hv.some(w=>Math.hypot(...v.map((x,i)=>x-w[i]!))<1e-8)).toBe(true);
        for(const face of rg.faces){
            const n=vector(Q,face.normal);
            expect(hg.faces.some(f=>Math.hypot(...n.map((x,i)=>x-f.normal[i]!))<1e-8)).toBe(true);
        }
    });
    it("rejects four-index planes in primitive rhombohedral axes",()=>{
        const r=generateCrystal(rhom,{forms:[{id:"bad",indices:{notation:"miller-bravais",h:1,k:0,i:-1,l:4},development:1}]});
        expect(r.status).toBe("invalid");expect(r.diagnostics.some(d=>d.code==="core.input.invalid-miller-indices")).toBe(true);
    });
    it("rejects mismatched settings and explicit operations",()=>{
        expect(validateCrystallography({...hex,setting:"rhombohedral-standard"}).ok).toBe(false);
        expect(validateCrystallography({...hex,pointOperations:rr.value.operations}).ok).toBe(false);
        expect(validateCrystallography({...hex,setting:undefined}).ok).toBe(false);
    });
});
