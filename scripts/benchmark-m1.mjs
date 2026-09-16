import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { intersectHalfSpaces, generateCrystal } from '../packages/crystal-core/dist/index.js';
const gcd = (a,b) => b ? gcd(b,a % b) : Math.abs(a);
const planes = (radius) => {
    const result = [];
    for (let x = -radius; x <= radius; x++) for (let y = -radius; y <= radius; y++) for (let z = -radius; z <= radius; z++) {
        if (gcd(gcd(x,y),z) !== 1) continue;
        const norm = Math.hypot(x,y,z);
        result.push({ id: `${x},${y},${z}`, normal: [x/norm,y/norm,z/norm], distance: 1 });
    }
    return result;
};
const crystal = { crystalSystem: 'cubic', unitCell: { a:4,b:4,c:4,alpha:90,beta:90,gamma:90 }, pointGroup: 'm-3m', setting: 'cubic-standard' };
const forms = [[1,0,0],[1,1,1],[1,1,0]].map(([h,k,l],i) => ({ id:`f${i}`, indices:{notation:'miller',h,k,l}, development:1 }));
const cases = [
    ['cube public pipeline (6 planes)', () => generateCrystal(crystal,{forms:forms.slice(0,1)})],
    ['cube + octahedron public pipeline (14 planes)', () => generateCrystal(crystal,{forms:forms.slice(0,2)})],
    ['three cubic forms public pipeline (26 planes)', () => generateCrystal(crystal,{forms})],
    ...[1,2,3].map((r) => { const input = planes(r); return [`intersection (${input.length} planes)`, () => intersectHalfSpaces(input)]; }),
];
console.log(JSON.stringify({ node:process.version, cpu:cpus()[0].model, platform:process.platform, architecture:process.arch, warmups:3, samples:9 }));
for (const [name, run] of cases) {
    for (let i=0;i<3;i++) run();
    const times=[]; let result;
    for (let i=0;i<9;i++) { const start=performance.now(); result=run(); times.push(performance.now()-start); }
    if (result.status !== 'valid') throw Error(JSON.stringify(result));
    times.sort((a,b)=>a-b);
    console.log(JSON.stringify({ name, medianMs:+times[4].toFixed(3), maxMs:+times[8].toFixed(3), vertices:result.geometry.vertices.length/3, faces:result.geometry.faces.length }));
}
