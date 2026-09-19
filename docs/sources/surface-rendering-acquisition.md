# Surface Rendering Source Acquisition

This record identifies where to obtain evidence for the
[surface-rendering implementation plan](../surface-rendering-plan.md). It follows the
project's [acquisition and licensing](../data-model.md#acquisition-and-licensing) and
[provenance](../data-model.md#scientific-confidence--provenance) requirements.

**Status:** SR0 review complete for the quartz, calcite, and pyrite delivery cases.
The remaining-mineral queue is still candidate research.

## Use Policy

Freely accessible means that a reviewer can read the source without payment or project
credentials. It does not mean that the source is freely licensed.

The Handbook of Mineralogy PDFs listed below are publicly readable but carry an
all-rights-reserved notice. Treat them as citation and fact-checking sources only:

* do not commit or redistribute the PDFs;
* do not copy their prose, tables, or figures into project data or documentation;
* store concise factual paraphrases, bibliographic metadata, provenance, and the source
  URL;
* retain only a minimal evidence excerpt in a non-public review system if the project
  owner confirms that use is permitted; and
* obtain permission before any broader reproduction.

Public-domain historical sources may be downloaded for review, but committed copies
still require an explicit acquisition decision, stable origin, integrity hash, and a
demonstrated need. Runtime code must not fetch any of these sources.

## Initial Source Queue

All URLs were accessible without authentication on 2026-09-19.

| Mineral | Source | Candidate coverage | Access and reuse | SR0 action |
|---|---|---|---|---|
| Quartz | [Handbook of Mineralogy: Quartz](https://www.handbookofmineralogy.org/pdfs/quartz.pdf) | Prismatic forms; striation relative to `[0001]`; vitreous luster for crystals | Publicly readable; all rights reserved; cite and paraphrase facts only | Visually verify the perpendicular symbol and barred indices; map the affected statement to the shipped `m` form |
| Quartz | [The Quartz Page: Crystal Forms](https://www.quartzpage.de/crs_forms.html) | Secondary corroboration that the `m` face is commonly striated perpendicular to the c-axis | Publicly readable; reuse terms not yet recorded; link and paraphrase only | Record publisher/author and terms; use only as corroboration unless reuse status is clarified |
| Quartz | [Van Praagh & Willis (1952), DOI 10.1038/169623b0](https://doi.org/10.1038/169623b0) | Research context for prism-face striations and their orientation | Abstract publicly readable; full article may require subscription; supplementary only | Do not make acceptance depend on paywalled text; check for an authorized open copy |
| Calcite | [Handbook of Mineralogy: Calcite](https://www.handbookofmineralogy.org/pdfs/calcite.pdf) | Vitreous general luster; pearly luster on `{0001}` and cleavage surfaces | Publicly readable; all rights reserved; cite and paraphrase facts only | Visually verify barred notation; separate basal growth-face evidence from cleavage appearance |
| Pyrite | [Handbook of Mineralogy: Pyrite](https://www.handbookofmineralogy.org/pdfs/pyrite.pdf) | Metallic/splendent luster; striation conforming to pyritohedral symmetry | Publicly readable; all rights reserved; cite and paraphrase facts only | Verify point-group typography; insufficient alone for an exact cube-face tangent direction |
| Pyrite | [1911 Encyclopaedia Britannica: Pyrites](https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Pyrites) | Cube-face striations parallel to cube/pyritohedron intersection edges and perpendicular between adjoining faces | Historical article is public domain; Wikisource transcription metadata/license must be retained if copied | Verify the transcription against the page scan and normalize the cube `{100}` / pyritohedron `{210}` relationship |
| Albite | [Handbook of Mineralogy: Albite](https://www.handbookofmineralogy.org/pdfs/albite.pdf) | Vitreous luster; pearly cleavage appearance; polysynthetic twinning striae on specified forms | Publicly readable; all rights reserved; cite and paraphrase facts only | Treat twinning striae as blocked until twinning and surface-origin semantics can represent them; do not use cleavage luster on growth faces |
| Anatase | [Handbook of Mineralogy: Anatase](https://www.handbookofmineralogy.org/pdfs/anatase.pdf) | Adamantine-to-splendent/metallic luster range; common forms | Publicly readable; all rights reserved; cite and paraphrase facts only | Determine whether luster variation belongs to named appearance presets; no form-specific texture claim yet |
| Beryl | [Handbook of Mineralogy: Beryl](https://www.handbookofmineralogy.org/pdfs/beryl.pdf) | Vitreous/resinous luster range; transparency and common forms | Publicly readable; all rights reserved; cite and paraphrase facts only | Use for categorical luster review; locate a separate reliable source before adding prism striations |
| Fluorite | [Handbook of Mineralogy: Fluorite](https://www.handbookofmineralogy.org/pdfs/fluorite.pdf) | Vitreous crystal luster; rounded or stepped morphology | Publicly readable; all rights reserved; cite and paraphrase facts only | Decide whether “stepped” is representable as shading-only detail; do not imply a form, direction, or scale absent from the source |
| Forsterite | [Handbook of Mineralogy: Forsterite](https://www.handbookofmineralogy.org/pdfs/forsterite.pdf) | Vitreous luster; striations parallel to elongation | Publicly readable; all rights reserved; cite and paraphrase facts only | Identify the crystallographic elongation direction for each shipped habit from another source or record; block shader direction until resolved |
| Gypsum | [Handbook of Mineralogy: Gypsum](https://www.handbookofmineralogy.org/pdfs/gypsum.pdf) | Coarse striations parallel to `[001]`; subvitreous luster; pearly `{010}` cleavage and silky fibrous material | Publicly readable; all rights reserved; cite and paraphrase facts only | Determine which growth forms carry the stated striation; keep cleavage and fibrous appearances out of ordinary growth-face rules |

## Source Decisions by Delivery Case

The stable claim IDs below are evidence records, not renderer profiles. They state the
reported observation and its scope; later renderer parameters remain curated and must
cite these IDs without treating procedural values as measurements.

| Claim ID | Review | Surface origin | Selector and reported claim | Evidence |
|---|---|---|---|---|
| `surface.quartz.m-striation` | accepted 2026-09-19 | growth face | Quartz prism `m {10−10}` is commonly striated perpendicular to `[0001]` (the c-axis). It is typical, not universal. | `handbook-quartz-v1.2`, Crystal Data; visual PDF review confirmed the perpendicular symbol and barred index. |
| `surface.calcite.0001-pearly` | accepted 2026-09-19 | growth face | Calcite basal `{0001}` faces may be pearly. No shipped calcite habit currently contains this form, so the accepted claim does not yet match a rendered face. | `handbook-calcite-v1`, Crystal Data and Optical Properties; visual PDF review confirmed `{0001}` and barred crystallographic notation. |
| `surface.calcite.cleavage-pearly` | accepted, renderer-ineligible 2026-09-19 | cleavage | Calcite cleavage surfaces may be pearly. This must not select ordinary generated growth faces. | `handbook-calcite-v1`, Physical and Optical Properties. |
| `surface.pyrite.100-striation` | accepted 2026-09-19 | growth face / oscillatory combination | Pyrite cube `{100}` faces may be striated parallel to their intersection edges with pyritohedron `{210}`; directions on adjacent cube faces are perpendicular. | `eb1911-pyrites`, article text and source scan; corroborated at mineral level by `handbook-pyrite-v1`. |

### Stable references

| Reference ID | Bibliographic and access record | Rights / use decision |
|---|---|---|
| `handbook-quartz-v1.2` | Mineral Data Publishing (2001), *Quartz*, version 1.2, [PDF](https://www.handbookofmineralogy.org/pdfs/quartz.pdf), accessed 2026-09-19. | Publicly readable, all rights reserved; facts paraphrased, no source artifact distributed. |
| `handbook-calcite-v1` | Mineral Data Publishing (2001–2005), *Calcite*, version 1, [PDF](https://www.handbookofmineralogy.org/pdfs/calcite.pdf), accessed 2026-09-19. | Publicly readable, all rights reserved; facts paraphrased, no source artifact distributed. |
| `handbook-pyrite-v1` | Mineral Data Publishing (2001–2005), *Pyrite*, version 1, [PDF](https://www.handbookofmineralogy.org/pdfs/pyrite.pdf), accessed 2026-09-19. | Publicly readable, all rights reserved; facts paraphrased, no source artifact distributed. |
| `handbook-albite-v1` | Mineral Data Publishing, *Albite*, version 1, [PDF](https://www.handbookofmineralogy.org/pdfs/albite.pdf), accessed 2026-09-19. | Publicly readable, all rights reserved; facts paraphrased, no source artifact distributed. |
| `handbook-beryl-v1` | Mineral Data Publishing, *Beryl*, version 1, [PDF](https://www.handbookofmineralogy.org/pdfs/beryl.pdf), accessed 2026-09-19. | Publicly readable, all rights reserved; facts paraphrased, no source artifact distributed. |
| `handbook-fluorite-v1` | Mineral Data Publishing, *Fluorite*, version 1, [PDF](https://www.handbookofmineralogy.org/pdfs/fluorite.pdf), accessed 2026-09-19. | Publicly readable, all rights reserved; facts paraphrased, no source artifact distributed. |
| `handbook-forsterite-v1` | Mineral Data Publishing, *Forsterite*, version 1, [PDF](https://www.handbookofmineralogy.org/pdfs/forsterite.pdf), accessed 2026-09-19. | Publicly readable, all rights reserved; facts paraphrased, no source artifact distributed. |
| `eb1911-pyrites` | L. J. Spencer (1911), “Pyrites,” *Encyclopædia Britannica*, vol. 22, pp. 696–697, [transcription and scan link](https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Pyrites), accessed 2026-09-19. | Original is public domain. No prose or figure is copied into distributable data. |

### Quartz prism striations

The Handbook sheet is the initial freely readable evidence source. Its extracted text
corrupts mathematical symbols, so acceptance requires visual comparison with the PDF.
The Quartz Page may corroborate the form and direction after its authorship and terms
are recorded. The Nature paper is useful context but must remain supplementary unless
an authorized open full text is found.

SR0 accepted the factual rule after confirming:

* the affected shipped form is the `m` prism `{10-10}` in the declared setting;
* the source direction is perpendicular to `[0001]` / the c-axis; and
* the rule describes a common growth feature rather than a universal surface.

### Calcite basal luster

The Handbook sheet directly distinguishes general vitreous luster from pearly luster
on `{0001}` and on cleavage surfaces. SR0 must create separate claims for the basal
growth face and cleavage. Only the basal growth-face claim is eligible for the current
morphology renderer.

The PDF's barred point/space-group and Miller notation were visually reviewed rather
than inferred from its corrupt extracted text. These values are not part of the
luster claim, but the check prevents a transcription error from entering its selector.

### Pyrite cube striations

Use the Handbook sheet for mineral-level occurrence and metallic luster. Use the
public-domain Britannica article for the more precise geometric relationship between
cube and pyritohedron faces. SR0 records that edge relationship for later translation
into each oriented cube face's local tangent frame. SR3/SR5 must test the alternating
direction across adjacent faces.

Do not reduce the rule to a world-axis pattern or apply it to every pyrite form. If the
historical notation or scan cannot be normalized unambiguously, defer this profile and
seek a modern open source.

## Remaining Research Queue

The Handbook sheets establish a common starting point for all current minerals but do
not finish the evidence work. Research proceeds in this order:

1. Resolve the explicit gypsum and forsterite striation selectors and directions.
2. Find an accessible, reliable source for any proposed beryl prism striation.
3. Determine whether fluorite growth steps can be represented without inventing scale
   or face assignment.
4. Separate albite twinning striae from growth-face rendering; wait for twinning support
   where required.
5. Decide appearance-preset coverage for anatase's broad luster description.
6. Search for form-specific evidence for the remaining minerals only after the common
   luster and microvariation work is validated.

For each new source, add its exact URL or DOI, access date, rights status, relevant
page/section, intended claim, notation risks, and acceptance action to this file.

## Integrity and Local Storage

The first pass uses stable URLs and access dates without committing source artifacts.
If reproducible review later requires local copies, create a source manifest containing
the original filename, retrieval timestamp, byte size, SHA-256 digest, origin URL, and
redistribution status. Store restricted artifacts outside Git and add their location or
filename pattern to `.gitignore` before downloading them into the workspace.

## Owner Input Gates

No owner input is required to begin SR0 using links and factual paraphrases.

Request owner input before:

* purchasing or requesting institutional access to a paywalled source;
* contacting a publisher or author for reproduction permission;
* committing any downloaded source document, scan, figure, or substantial excerpt;
* selecting a source whose terms or authorship remain unclear as the sole authority for
  a shipped claim; or
* accepting a renderer behavior when sources conflict and scientific review cannot
  resolve the conflict.

When a gate is reached, report the exact source, requested action, expected claim
coverage, cost or license implication if known, and the available fallback.
