import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { M5_SOURCES, readM5Fixture } from "./fixtures/m5.js";
import { createLattice, validateCrystallography, generateCrystal, derivePointOperations, equivalentPointOperationSets, expandEquivalentPlaneDirections, validateSpaceOperations, listPointOperationRegistryEntries, type Vec3, type Mat3, type Crystallography, type GeometryResult, type CrystalFormSetting } from "./index.js";

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
