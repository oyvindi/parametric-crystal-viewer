# SR1 Lighting and Presentation Acceptance

SR1 is complete. The built-in neutral environment now provides readable reflected
light shapes and balanced illumination without a remote runtime asset. Scientific
geometry, face metadata, triangle-to-face picking data, and serialized state are
unchanged.

## Delivery

| Area | Result |
|---|---|
| Built-in environment | A 512 × 256 project-owned equirectangular canvas supplies a neutral vertical field, broad warm key, cool opposing fill, and narrow rim strip. Three.js PMREM processing remains unchanged. |
| Default presentation | AgX tone mapping, exposure `1.15`, environment intensity `1`, identity rotation, visible background, and background zoom `1`. |
| Direct lighting | Neutral ambient light and warm-key/cool-fill directional lights were rebalanced to keep unreflected faces readable. |
| Existing controls | HDR/EXR loading, reset, intensity, three-axis rotation, background visibility/zoom, tone mapping, and exposure remain available with the same signatures and validation. |
| Asset provenance | The environment is generated entirely by project code at runtime. It has no external origin, download, license, or redistribution dependency. |

## Visual comparison

The fixed [SR0 scenes](baselines/sr0/manifest.json) are the before set. The
[SR1 scenes](baselines/sr1/manifest.json) use the same nine minerals, first habit and
appearance, viewport, camera policy, environment intensity, orientation, background
zoom, tone mapping, and comparison exposure.

Visual review of representative paths found:

* transmissive quartz changes from dark gray with a single dominant reflection to a
  lighter neutral body with more readable side and termination faces;
* metallic pyrite retains three distinct cube faces while avoiding near-black faces;
* opaque default-material anatase retains clear edges and gains brighter face
  separation; and
* the remaining six reference scenes retain readable silhouettes and face boundaries.

The baseline page deliberately fixes comparison exposure at `1`; the viewer's new
interactive default is `1.15`. Timing results are recorded for regression context but
headless SwiftShader values are not an interactive GPU performance target, especially
for transmissive materials.

## Automated verification

The viewer tests assert that the default uses AgX/exposure `1.15` and contains the
expected ambient plus three directional lights. Environment-control tests additionally
snapshot public face inspection data and the triangle-to-core-face picking map before
presentation edits and assert both are unchanged afterward.

```sh
npm run check
node scripts/check-docs.mjs
npm run baseline:sr1
```

Verification passed with 370 tests across 23 files, the TypeScript build, workspace
dependency checks, documentation checks, and nine SR1 screenshots plus manifest.
