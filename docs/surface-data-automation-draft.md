# Draft: Automated Mineral Surface Data Workflow

**Status: exploratory and non-binding.** This is a design handoff for a possible
separate repository. It does not authorize bulk acquisition, establish source rights,
select a model, or define a production interface for the crystal viewer.

## Purpose

Create reviewed, machine-readable claims about mineral surface character from species
sheets, open literature, public-domain books, and approved web pages. The system should
reduce reading and transcription work; it must not publish model guesses as scientific
facts.

The output is an evidence package that can be reviewed and transformed into curated
viewer records. It is not a generated texture library and does not infer a specimen's
surface from a structural CIF.

## Principles

* Extract claims, not renderer parameters.
* Preserve the exact source location for every claim.
* Keep source wording separate from normalized terminology.
* Treat crystallographic typography as image content when text extraction loses it.
* Prefer deterministic parsers and validators to model inference where possible.
* Record uncertainty and conflicts; never fill an absent fact with a plausible value.
* Require human approval for published mineral-form rules.
* Respect access terms, copyright, privacy, and redistribution restrictions.

## Repository Boundary

The future repository would own:

* source manifests and acquisition policy;
* permitted local document storage;
* PDF/HTML layout extraction and OCR;
* local model execution and prompt/schema versions;
* candidate claims, evidence locations, validation, conflict detection, and review;
* export of approved factual records in a versioned interchange format; and
* evaluation fixtures and extraction metrics.

It would not own crystallographic geometry, Three.js shaders, viewer state, or visual
parameter mappings. This repository would import only reviewed outputs under an
explicit version and license/provenance record.

## Source Admission

Every source must enter through a manifest rather than an unconstrained crawler:

```ts
interface SourceManifestEntry {
    sourceId: string;
    canonicalUrl?: string;
    localPath?: string;
    title: string;
    publisher?: string;
    accessDate: string;
    contentHash: string;
    mediaType: "pdf" | "html" | "text" | "image";
    accessStatus: "open" | "licensed" | "public-domain" | "unknown";
    redistribution:
        | "allowed"
        | "metadata-only"
        | "internal-evidence-only"
        | "unknown";
    termsUrl?: string;
}
```

Unknown rights block publication and redistribution. Paywall circumvention is out of
scope. Robots, rate limits, authentication, collection terms, and jurisdiction-specific
text/data-mining rules must be decided before web acquisition is built.

## Candidate Claim Model

The interchange schema should represent source facts independently of rendering:

```ts
interface SurfaceClaimCandidate {
    candidateId: string;
    mineral: {
        sourceName: string;
        normalizedId?: string;
        variety?: string;
        phase?: string;
    };
    selector:
        | { kind: "all-surfaces" }
        | {
              kind: "form";
              sourceNotation: string;
              normalizedIndices?: string;
          }
        | {
              kind: "face-class";
              value: "basal" | "prism" | "termination";
          }
        | {
              kind: "surface-origin";
              value: "growth" | "cleavage" | "fracture" | "manufactured";
          };
    property:
        | "luster"
        | "striations"
        | "growth-steps"
        | "etching"
        | "pitting"
        | "roughness-description"
        | "coating";
    value: string;
    direction?: {
        relation: "parallel" | "perpendicular" | "at-angle";
        sourceReference: string;
        normalizedReference?: string;
    };
    typicality?:
        | "general"
        | "common"
        | "occasional"
        | "rare"
        | "specimen-specific";
    evidence: {
        sourceId: string;
        page?: number;
        section?: string;
        excerpt: string;
        boundingBox?: readonly [number, number, number, number];
        pageImageHash?: string;
    };
    extraction: {
        method: string;
        model?: string;
        modelDigest?: string;
        promptVersion?: string;
        confidence?: number;
    };
    flags: readonly string[];
    reviewStatus: "candidate" | "accepted" | "rejected" | "needs-source";
}
```

The exact vocabulary, identifiers, and export schema remain open. Source notation must
survive normalization so reviewers can detect incorrect overbars or basis assumptions.

## Processing Pipeline

### 1. Acquire and fingerprint

Accept only manifest-approved documents. Store a cryptographic content hash, retrieval
metadata, media type, and rights. Deduplicate identical artifacts without merging their
bibliographic identities.

### 2. Extract document structure

For digital PDFs and HTML, extract text, tables, headings, page coordinates, and font
information. For scans, run OCR while retaining page images and bounding boxes. Do not
discard the original page coordinate system.

### 3. Detect notation hazards

Flag regions containing Miller indices, space groups, point groups, equations,
subscripts, superscripts, overbars, unusual fonts, or extraction disagreement. Render
these regions to images and route them through a local vision-capable model or manual
review. Text-only recovery is insufficient when extraction has erased a bar.

### 4. Extract constrained candidates

Give the model only the relevant page region and require strict-schema output. Require
an evidence excerpt and bounding box for every candidate. A model may emit `unknown` or
no candidate; it may not synthesize missing direction, form, or typicality.

Use separate prompts or deterministic extractors for:

* mineral identity and synonyms;
* crystallographic forms and axes;
* luster and diaphaneity;
* surface patterns and direction;
* growth, cleavage, fracture, and manufactured-surface context; and
* bibliographic references.

### 5. Normalize deterministically

Resolve mineral names against a pinned taxonomy. Parse Miller and Miller-Bravais
indices with crystallographic code, not language-model arithmetic. Validate axes and
forms against the declared setting where enough data exists. Preserve unresolved
notation and block automatic acceptance.

### 6. Validate and compare

Run schema, terminology, and crystallographic validation. Compare claims for the same
mineral and selector. Agreement can raise review priority but must not turn dependent
sources into independent corroboration. Preserve conflicts with their contexts.

Hold or reject candidates when they have:

* no evidence location;
* evidence that does not support the normalized claim;
* malformed or ambiguous indices;
* a likely missing overbar;
* cleavage converted into a growth-face rule;
* a variety- or specimen-only property assigned to a species;
* unresolved source rights or identity; or
* a model value absent from the supplied source region.

### 7. Human review

The review UI should show the rendered source crop, extracted text, normalized claim,
validation results, related claims, and a minimal viewer preview where useful.
Reviewers must be able to correct notation without losing the original extraction.

Acceptance records reviewer identity, timestamp, decision, rationale, and taxonomy and
validation-rule versions. Re-review is required when the source, normalization rules,
or materially relevant extraction behavior changes.

### 8. Export approved claims

Export factual claims and provenance separately from renderer mappings. Produce a
signed or hashed release manifest so the viewer can pin an immutable data version.
Exclude source documents and restricted excerpts from public artifacts unless
redistribution is permitted.

## Model Strategy

A local language model is appropriate for prose classification and linking statements
to candidate forms. A local vision-language model is needed for notation and layout
cases. Model selection is deferred because quality, hardware, licenses, and supported
context lengths change quickly.

Benchmark models on a project-owned evaluation set. A smaller constrained model may
outperform a larger general model when paired with good segmentation, a strict schema,
and deterministic validation.

Record for each run:

* model and immutable weight digest;
* runtime and quantization;
* system and extraction prompt versions;
* schema and taxonomy versions;
* generation parameters and random seed where applicable; and
* input artifact and page-region hashes.

## Security and Reliability

Documents are untrusted input. Embedded instructions, links, attachments, scripts, and
prompt-like text are content, not commands. Extraction workers should have no
credentials, no write access to approved datasets, and no unrestricted network access.
Acquisition, extraction, review, and publication should use separate permissions.

Validate model output before storage. Limit document size, page count, image
resolution, decompression, and processing time. Preserve logs without copying
restricted source content into an unauthorized system.

## Evaluation

Build a hand-labeled set containing digital PDFs, scans, tables, multi-column layouts,
and deliberate notation hazards. Include positive and negative cases for growth faces,
cleavage, fracture, varieties, and specimen-specific observations.

Track at least:

* claim precision and recall by property;
* evidence-location accuracy;
* mineral and variety resolution accuracy;
* Miller-index and overbar exact match;
* surface-origin classification accuracy;
* unsupported-value or hallucination rate;
* reviewer correction and rejection rates; and
* processing time and hardware cost per page and accepted claim.

Publication thresholds should emphasize precision over recall. Missing a candidate is
preferable to publishing an incorrect face rule.

## Initial Pilot

Use a small, rights-reviewed corpus for the nine minerals currently in the viewer.
Use the viewer repository's
[surface-rendering acquisition record](sources/surface-rendering-acquisition.md) as the
initial source queue and as a human-readable precursor to the proposed source manifest.
Its entries must still be normalized into the future repository's versioned manifest;
the Markdown table is not the production interchange format.

Seed the evaluation with the PDF failure modes found in the calcite and callaghanite
species sheets. Limit the first pass to categorical luster, growth-face/cleavage
distinction, explicit striation presence, affected form, and direction.

The pilot succeeds when it reproduces a manually reviewed gold set, surfaces notation
uncertainty instead of concealing it, and exports records requiring only minor reviewer
correction. It does not need autonomous publication or comprehensive coverage.

## Decisions Deferred to the Future Repository

Before implementation, decide and document:

* project license and governance;
* permitted sources and jurisdiction-specific text/data-mining policy;
* source storage, excerpt retention, and public export policy;
* mineral taxonomy and stable identifier authority;
* exact claim vocabulary and interchange schema;
* OCR, layout, language, and vision models plus their licenses;
* supported languages and historical notation;
* hardware, quantization, throughput, and reproducibility requirements;
* reviewer roles, disagreement resolution, and audit retention;
* confidence calibration and publication thresholds;
* dependency/citation graph handling for non-independent sources;
* API or file-based handoff to this repository;
* release signing, versioning, correction, and withdrawal procedures; and
* whether crawling is needed at all after manifest-based ingestion.

None of these choices should be encoded prematurely in the viewer's scientific or
rendering contracts.
