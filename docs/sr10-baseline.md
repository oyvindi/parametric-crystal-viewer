# SR10 Display-Growth Baseline Workflow

This is a capture workflow, not an SR10 acceptance audit. It records a single
review scene for the optional **Terraced fluorite** display mode; owner visual review
is still required before SR10 acceptance documentation is updated.

Run:

```sh
npm run baseline:sr10
```

The command builds the demo, captures
`docs/baselines/sr10/fluorite-terraced.png`, and writes a manifest alongside it. The
capture pins a 960×720 output at device scale factor 1, cube habit, seed
`0x5f3759df`, the project-owned studio environment at intensity 1 and rotation
`[0, 0, 0]`, visible background at zoom 1, AgX tone mapping, exposure 1, and disabled
surface detail. It resets the camera deterministically and records its resolved
projection and position in the manifest, together with the browser and platform.

The display mesh remains a curated typical interpretation; it is not a
specimen reconstruction or scientific geometry.
