import { Scene, PerspectiveCamera, WebGLRenderer, MeshPhysicalMaterial, Mesh, MeshBasicMaterial, Color, DirectionalLight, AmbientLight, Group, DoubleSide, Raycaster, Vector2, Vector3, Sprite, SpriteMaterial, CanvasTexture, BufferGeometry, Float32BufferAttribute, LineSegments, LineBasicMaterial, PMREMGenerator, EquirectangularReflectionMapping, AgXToneMapping, ACESFilmicToneMapping, NoToneMapping, type Texture, type WebGLRenderTarget } from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { createLattice, expandAtomicStructure, generateCrystal, generateCrystalFromFaces, inferBonds, validatePeriodicBonds, type Diagnostic, type GeometryResult, type CrystalGeometry, type CrystalFace, type ExpandedAtom, type Lattice, type PeriodicBond } from "@crystal/core";
import { loadMineral as loadMineralData, createCrystalInput, resolveHabit, resolveCrystallography, importCif, getMineral, validateMineral, MineralDataError, type Mineral, type MineralCrystallography, type StructuralDefinition } from "@crystal/data";
import { createThreeGeometryWithPicking, createAtomicStructure, atomicBounds, createCrystalMaterial, applyAppearance, resolveAppearance, APPEARANCE_FIELDS, type AppearanceParams, type AppearanceField, type ResolvedAppearance, type LusterCategory } from "@crystal/three";
import { cameraBasis } from "./camera.js";
import { STATE_VERSION, validateStateShape, type ViewerState, type ViewMode, type FormState, type MineralRefState, type AppearanceState, type AppearanceOverride } from "./state.js";

export type { ViewerState, ViewMode, AppearanceState, AppearanceOverride } from "./state.js";
export { STATE_VERSION } from "./state.js";
export { listMinerals, getMineral } from "@crystal/data";
export type { Mineral } from "@crystal/data";
export type { LusterCategory } from "@crystal/three";

export class ViewerOperationError extends Error {
    constructor(readonly diagnostics: readonly Diagnostic[]) {
        super(diagnostics.map((d) => d.message).join(" "));
        this.name = "ViewerOperationError";
    }
}

export type GeometryStatus = "valid" | "invalid";

/**
 * The current geometric role of a form-development control. This is derived
 * from the active generic constraints and face contributors, independent of
 * mineral species or crystal system.
 */
export type FormControlEffect = "inactive" | "scale-only" | "shape" | "redundant" | "geometry-invalid";

export interface FormInfo {
    readonly id: string;
    readonly label: string;
    readonly development: number;
    readonly enabled: boolean;
    readonly effect: FormControlEffect;
    /** Whether this form contributes to at least one current visible face. */
    readonly contributesToVisibleFaces: boolean;
}

export interface HabitInfo {
    readonly id: string;
    readonly name: string;
}

export interface VariantInfo {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
}

export interface AppearanceInfo {
    readonly id: string;
    readonly name: string;
    readonly luster?: LusterCategory;
}

export interface AppearanceValues extends ResolvedAppearance {}

/** Display transform used for high-dynamic-range environment lighting. */
export type ViewerToneMapping = "none" | "agx" | "aces-filmic";
export type ViewerEnvironmentFormat = "hdr" | "exr";

export interface FaceContributorInfo {
    readonly formId: string;
    readonly indices: { readonly notation: string; readonly h: number; readonly k: number; readonly i?: number; readonly l: number };
    readonly operationIds: readonly string[];
}

export interface FaceInfo {
    readonly faceIndex: number;
    readonly normal: readonly [number, number, number];
    readonly contributors: readonly FaceContributorInfo[];
    readonly symmetryGroup?: string;
}

export interface StructureInfo {
    readonly id: string;
    readonly name: string;
    readonly crystalSystem: string;
    readonly pointGroup?: string;
    readonly setting?: string;
    readonly spaceGroup?: string;
    readonly siteRepresentation: string;
    readonly atomCount: number;
    readonly bondCount: number;
    readonly bondsDerived: boolean;
    readonly authors?: readonly string[];
    readonly publicationTitle?: string;
    readonly mineralName?: string;
    readonly formula?: string;
}

function bfdhForms(crystallography: MineralCrystallography): readonly { id: string; indices: { notation: "miller"; h: number; k: number; l: number }; development: number; enabled: true }[] {
    const lattice = createLattice(crystallography.unitCell);
    if (!lattice.ok) return [];
    const candidates: { h: number; k: number; l: number; d: number }[] = [];
    const seen = new Set<string>();
    for (let h = -2; h <= 2; h++) for (let k = -2; k <= 2; k++) for (let l = -2; l <= 2; l++) {
        if (h === 0 && k === 0 && l === 0) continue;
        const gcd = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd(b, a % b);
        const divisor = gcd(gcd(h, k), l) || 1;
        const reduced = [h / divisor, k / divisor, l / divisor];
        const key = reduced.join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        const n: [number, number, number] = [
            lattice.value.reciprocal[0][0] * reduced[0] + lattice.value.reciprocal[0][1] * reduced[1] + lattice.value.reciprocal[0][2] * reduced[2],
            lattice.value.reciprocal[1][0] * reduced[0] + lattice.value.reciprocal[1][1] * reduced[1] + lattice.value.reciprocal[1][2] * reduced[2],
            lattice.value.reciprocal[2][0] * reduced[0] + lattice.value.reciprocal[2][1] * reduced[1] + lattice.value.reciprocal[2][2] * reduced[2],
        ];
        const length = Math.hypot(...n);
        if (length > 0 && Number.isFinite(length)) candidates.push({ h: reduced[0], k: reduced[1], l: reduced[2], d: 1 / length });
    }
    const maxD = Math.max(...candidates.map((c) => c.d));
    return candidates.map((c) => ({ id: `bfdh-${c.h}-${c.k}-${c.l}`, indices: { notation: "miller", h: c.h, k: c.k, l: c.l }, development: Math.max(0.05, Math.min(1, c.d / maxD)), enabled: true as const }));
}

/** Stabilized public viewer API (M7). Owns loading, orchestration, lifecycle, and state serialization. */
export class CrystalViewer extends EventTarget {
    private readonly renderer: WebGLRenderer;
    private readonly scene: Scene;
    private readonly backgroundScene: Scene;
    private readonly backgroundCamera: PerspectiveCamera;
    private readonly camera: PerspectiveCamera;
    private readonly cameraTarget = new Vector3(0, 0, 0);
    private readonly crystalGroup: Group;
    private readonly labelGroup: Group;
    private mesh: Mesh<BufferGeometry, MeshPhysicalMaterial> | null = null;
    private highlightMesh: Mesh<BufferGeometry, MeshBasicMaterial> | null = null;
    private mineral: Mineral | null = null;
    /** A caller-supplied mineral needs embedding in state for portable restoration. */
    private embeddedMineral = false;
    private habitId: string | undefined;
    private variantId: string | undefined;
    private formDevelopment: Record<string, number> = {};
    private formEnabled: Record<string, boolean> = {};
    private lastValidGeometry: GeometryResult | null = null;
    private currentResult: GeometryResult | null = null;
    private currentGeometry: CrystalGeometry | null = null;
    private triangleFaces: Uint32Array | null = null;
    private disposed = false;
    private disconnected = false;
    private wasRunning = false;
    private loadGeneration = 0;
    private morphologyScale: number | undefined = undefined;
    private needsInitialFrame = true;
    private animationHandle: number | null = null;
    private rotationY = 0;
    private readonly rotationSpeed = 0.005;
    private isDragging = false;
    private lastMouseX = 0;
    private lastMouseY = 0;
    private showLabels = false;
    private selectedFaceIndex: number | null = null;
    private viewMode: ViewMode = "morphology";
    private structure: StructuralDefinition | null = null;
    private expandedAtoms: readonly ExpandedAtom[] | null = null;
    private structureBonds: readonly PeriodicBond[] | null = null;
    private structureLattice: Lattice | null = null;
    private atomicGroup: Group | null = null;
    private cellOverlay: Group | null = null;
    private latticeRepetition: [number, number, number] = [1, 1, 1];
    private showUnitCell = false;
    private showBonds = true;
    private showAxes = false;
    private showWireframe = false;
    private appearanceId: string | undefined;
    private appearanceOverrides: Partial<AppearanceParams> = {};
    private importDiagnostics: readonly Diagnostic[] = [];
    private explicitFaceGeometry = false;
    private environmentSource: Texture | null = null;
    private environmentTarget: WebGLRenderTarget | null = null;
    private environmentBackgroundVisible = true;
    private environmentBackgroundZoom = 1;
    private readonly raycaster = new Raycaster();
    private readonly canvas: HTMLCanvasElement;
    private readonly onPointerDownBound: (e: PointerEvent) => void;
    private readonly onPointerMoveBound: (e: PointerEvent) => void;
    private readonly onPointerUpBound: (e: PointerEvent) => void;
    private readonly onClickBound: (e: PointerEvent) => void;

    constructor(canvas: HTMLCanvasElement) {
        super();
        this.canvas = canvas;
        this.renderer = new WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.clientWidth || 400, canvas.clientHeight || 300);
        this.renderer.toneMapping = AgXToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.scene = new Scene();
        this.backgroundScene = new Scene();
        this.backgroundScene.background = new Color(0x2a2e33); // neutral fallback; replaced by a gradient when WebGL is available
        this.camera = new PerspectiveCamera(45, 1, 0.01, 1000);
        this.backgroundCamera = new PerspectiveCamera(45, 1, 0.01, 1000);
        this.camera.position.set(8, 6, 8);
        this.camera.lookAt(this.cameraTarget);
        this.crystalGroup = new Group();
        this.scene.add(this.crystalGroup);
        this.labelGroup = new Group();
        this.labelGroup.visible = false;
        this.scene.add(this.labelGroup);
        this.scene.add(new AmbientLight(0xffffff, 0.65));
        const dir = new DirectionalLight(0xfff7ed, 0.9);
        dir.position.set(5, 10, 7);
        this.scene.add(dir);
        const fill = new DirectionalLight(0xddeaff, 0.45);
        fill.position.set(-5, -3, -5);
        this.scene.add(fill);
        // Frontal key light near the camera so camera-facing polygons receive a
        // specular highlight even on metals (which derive color from reflections,
        // not diffuse). Without this, front faces reflect only the dark floor.
        const key = new DirectionalLight(0xffffff, 0.35);
        key.position.set(6, 5, 8);
        this.scene.add(key);
        this.onPointerDownBound = this.onPointerDown.bind(this);
        this.onPointerMoveBound = this.onPointerMove.bind(this);
        this.onPointerUpBound = this.onPointerUp.bind(this);
        this.onClickBound = this.onCanvasClick.bind(this);
        this.attachCanvasListeners();
        this.setupEnvironment();
    }

    /**
     * Replaces the procedural studio environment with an in-memory Radiance
     * RGBE (.hdr) panorama. Uploaded environments are presentation resources
     * and are deliberately not included in serialized viewer state.
     */
    loadEnvironment(data: ArrayBuffer, format: ViewerEnvironmentFormat): void {
        this.assertNotDisposed();
        const anyRenderer = this.renderer as unknown as { getContext?: () => unknown };
        if (typeof anyRenderer.getContext !== "function") {
            throw new ViewerOperationError([{ code: "viewer.environment.unavailable", severity: "error", message: "HDR environments require an active WebGL renderer." }]);
        }
        if (format !== "hdr" && format !== "exr") {
            throw new ViewerOperationError([{ code: "viewer.environment.unsupported-format", severity: "error", message: `Unsupported environment format "${format}".` }]);
        }
        if (format === "hdr") {
            const header = new TextDecoder("ascii").decode(new Uint8Array(data, 0, Math.min(data.byteLength, 16_384)));
            const dimensions = header.match(/(?:^|\n)-Y\s+(\d+)\s+\+X\s+(\d+)(?:\r?\n|$)/);
            const height = Number(dimensions?.[1]);
            const width = Number(dimensions?.[2]);
            if (!dimensions || !this.validEnvironmentDimensions(width, height)) {
                throw new ViewerOperationError([{ code: "viewer.environment.invalid-hdr", severity: "error", message: "The HDR panorama header is invalid or its decoded dimensions exceed 32 megapixels." }]);
            }
        }

        let source: Texture | null = null;
        let target: WebGLRenderTarget | null = null;
        let pmrem: PMREMGenerator | null = null;
        try {
            source = format === "hdr"
                ? new HDRLoader().createDataTexture(data)
                : new EXRLoader().createDataTexture(data);
            const image = source.image as { width?: number; height?: number } | undefined;
            if (!this.validEnvironmentDimensions(Number(image?.width), Number(image?.height))) {
                throw new Error("Decoded dimensions exceed 32 megapixels.");
            }
            source.mapping = EquirectangularReflectionMapping;
            pmrem = new PMREMGenerator(this.renderer);
            target = pmrem.fromEquirectangular(source);
        } catch (error) {
            source?.dispose();
            target?.dispose();
            throw new ViewerOperationError([{
                code: `viewer.environment.invalid-${format}`,
                severity: "error",
                message: error instanceof Error ? `Could not decode ${format.toUpperCase()} environment: ${error.message}` : `Could not decode ${format.toUpperCase()} environment.`,
            }]);
        } finally { pmrem?.dispose(); }

        this.disposeEnvironment();
        this.environmentSource = source;
        this.environmentTarget = target;
        this.scene.environment = target.texture;
        this.updateEnvironmentBackground();
        this.renderOnce();
    }

    /** Backward-compatible convenience method for a Radiance RGBE environment. */
    loadHdrEnvironment(data: ArrayBuffer): void {
        this.loadEnvironment(data, "hdr");
    }

    /** Convenience method for an OpenEXR environment. */
    loadExrEnvironment(data: ArrayBuffer): void {
        this.loadEnvironment(data, "exr");
    }

    /** Restores the built-in studio gradient environment. */
    resetEnvironment(): void {
        this.assertNotDisposed();
        this.setupEnvironment();
        this.renderOnce();
    }

    setEnvironmentIntensity(intensity: number): void {
        this.assertNotDisposed();
        if (!Number.isFinite(intensity) || intensity < 0) throw new ViewerOperationError([{ code: "viewer.environment.invalid-intensity", severity: "error", message: "Environment intensity must be a finite non-negative number." }]);
        this.scene.environmentIntensity = intensity;
        this.renderOnce();
    }

    /** Rotates environment lighting and its visible background using yaw, pitch, and roll. */
    setEnvironmentRotation(yaw: number, pitch = 0, roll = 0): void {
        this.assertNotDisposed();
        if (![yaw, pitch, roll].every(Number.isFinite)) throw new ViewerOperationError([{ code: "viewer.environment.invalid-rotation", severity: "error", message: "Environment rotation must contain finite yaw, pitch, and roll values." }]);
        this.scene.environmentRotation.set(pitch, yaw, roll);
        this.backgroundScene.backgroundRotation.set(pitch, yaw, roll);
        this.renderOnce();
    }

    /** Applies a relative model rotation around the viewer's X, Y, and Z axes. */
    rotateModel(deltaX: number, deltaY: number, deltaZ = 0): void {
        this.assertNotDisposed();
        if (![deltaX, deltaY, deltaZ].every(Number.isFinite)) throw new ViewerOperationError([{ code: "viewer.camera.invalid-rotation", severity: "error", message: "Model rotation deltas must be finite." }]);
        this.crystalGroup.rotation.x += deltaX;
        this.crystalGroup.rotation.y += deltaY;
        this.crystalGroup.rotation.z += deltaZ;
        this.labelGroup.rotation.copy(this.crystalGroup.rotation);
        this.rotationY = this.crystalGroup.rotation.y;
        this.renderOnce();
    }

    setEnvironmentBackgroundVisible(visible: boolean): void {
        this.assertNotDisposed();
        this.environmentBackgroundVisible = visible;
        this.updateEnvironmentBackground();
        this.renderOnce();
    }

    /** Magnifies only the visible environment; image-based lighting is unchanged. */
    setEnvironmentBackgroundZoom(zoom: number): void {
        this.assertNotDisposed();
        if (!Number.isFinite(zoom) || zoom <= 0) throw new ViewerOperationError([{ code: "viewer.environment.invalid-background-zoom", severity: "error", message: "Environment background zoom must be a positive finite number." }]);
        this.environmentBackgroundZoom = zoom;
        this.renderOnce();
    }

    setToneMapping(mode: ViewerToneMapping): void {
        this.assertNotDisposed();
        const mappings = { none: NoToneMapping, agx: AgXToneMapping, "aces-filmic": ACESFilmicToneMapping } as const;
        if (!(mode in mappings)) throw new ViewerOperationError([{ code: "viewer.environment.invalid-tone-mapping", severity: "error", message: `Unknown tone mapping mode "${mode}".` }]);
        this.renderer.toneMapping = mappings[mode];
        this.renderOnce();
    }

    setExposure(exposure: number): void {
        this.assertNotDisposed();
        if (!Number.isFinite(exposure) || exposure < 0) throw new ViewerOperationError([{ code: "viewer.environment.invalid-exposure", severity: "error", message: "Exposure must be a finite non-negative number." }]);
        this.renderer.toneMappingExposure = exposure;
        this.renderOnce();
    }

    private attachCanvasListeners(): void {
        const canvas = this.canvas;
        canvas.addEventListener("pointerdown", this.onPointerDownBound);
        canvas.addEventListener("pointermove", this.onPointerMoveBound);
        canvas.addEventListener("pointerup", this.onPointerUpBound);
        canvas.addEventListener("pointerleave", this.onPointerUpBound);
        canvas.addEventListener("click", this.onClickBound);
    }

    private detachCanvasListeners(): void {
        const canvas = this.canvas;
        canvas.removeEventListener("pointerdown", this.onPointerDownBound);
        canvas.removeEventListener("pointermove", this.onPointerMoveBound);
        canvas.removeEventListener("pointerup", this.onPointerUpBound);
        canvas.removeEventListener("pointerleave", this.onPointerUpBound);
        canvas.removeEventListener("click", this.onClickBound);
    }

    /**
     * Loads a bundled mineral ID or a caller-supplied record. Loading is
     * transactional: the definition is resolved and validated before the
     * current configuration is replaced. A failed load leaves the current
     * configuration and geometry unchanged and emits `mineral-load-failed`.
     * When loads overlap, only the newest request commits; superseded
     * completions emit `load-superseded` and do not mutate state, including
     * when the newest request fails.
     */
    async loadMineral(source: unknown): Promise<void> {
        this.assertNotDisposed();
        const generation = ++this.loadGeneration;
        let mineral: Mineral;
        try {
            mineral = loadMineralData(source);
        } catch (error) {
            if (!(error instanceof MineralDataError)) throw error;
            const diagnostics: Diagnostic[] = [{ code: "viewer.load.invalid-mineral", severity: "error", message: "Mineral loading failed; the previous definition is unchanged." }, ...error.diagnostics];
            if (generation === this.loadGeneration) this.dispatchEvent(new CustomEvent("mineral-load-failed", { detail: { diagnostics } }));
            throw new ViewerOperationError(diagnostics);
        }
        // Yield so overlapping loads interleave: only the newest request commits.
        await Promise.resolve();
        // Disposal is terminal: pending work may finish, but must not mutate a
        // released viewer or emit a completion event.
        if (this.disposed) return;
        if (generation !== this.loadGeneration) {
            this.dispatchEvent(new CustomEvent("load-superseded", { detail: { generation } }));
            return;
        }
        this.commitMineral(mineral, typeof source !== "string");
        this.dispatchEvent(new CustomEvent("mineral-loaded", { detail: { mineralId: mineral.id, dataRevision: mineral.dataRevision } }));
    }

    private commitMineral(mineral: Mineral, embedded = false): void {
        // A separate imported structure has its own declared cell and basis. It
        // cannot remain attached to a newly loaded mineral without an explicit
        // basis transformation.
        this.structure = null;
        this.structureLattice = null;
        this.expandedAtoms = null;
        this.structureBonds = null;
        this.importDiagnostics = [];
        this.explicitFaceGeometry = false;
        this.clearAtomic();
        this.mineral = mineral;
        this.embeddedMineral = embedded;
        this.habitId = undefined;
        this.variantId = undefined;
        this.formDevelopment = {};
        this.formEnabled = {};
        this.morphologyScale = undefined;
        this.appearanceId = mineral.appearance?.[0]?.id;
        this.appearanceOverrides = {};
        this.lastValidGeometry = null;
        this.needsInitialFrame = true;
        this.selectedFaceIndex = null;
        this.viewMode = "morphology";
        this.clearMesh();
        this.clearLabels();
        this.updateCellOverlay();
        this.updateViewVisibility();
        this.regenerate();
    }

    setHabit(habitId: string): void {
        this.assertNotDisposed();
        if (!this.mineral) throw new Error("No mineral loaded.");
        resolveHabit(this.mineral, habitId);
        this.habitId = habitId;
        this.formDevelopment = {};
        this.formEnabled = {};
        this.selectedFaceIndex = null;
        this.regenerate();
        this.dispatchEvent(new CustomEvent("habit-changed", { detail: { habitId } }));
    }

    setVariant(variantId: string): void {
        this.assertNotDisposed();
        if (!this.mineral) throw new Error("No mineral loaded.");
        resolveCrystallography(this.mineral, variantId);
        this.variantId = variantId;
        this.selectedFaceIndex = null;
        this.regenerate();
        this.dispatchEvent(new CustomEvent("variant-changed", { detail: { variantId } }));
    }

    setFormDevelopment(formId: string, value: number): void {
        this.assertNotDisposed();
        if (!this.mineral) throw new Error("No mineral loaded.");
        this.assertForm(formId);
        this.formDevelopment[formId] = value;
        if (!this.formEnabled[formId]) this.formEnabled[formId] = true;
        this.regenerate();
        this.dispatchEvent(new CustomEvent("form-changed", { detail: { formId, development: value } }));
    }

    setFormEnabled(formId: string, enabled: boolean): void {
        this.assertNotDisposed();
        if (!this.mineral) throw new Error("No mineral loaded.");
        this.assertForm(formId);
        this.formEnabled[formId] = enabled;
        this.regenerate();
        this.dispatchEvent(new CustomEvent("form-changed", { detail: { formId, enabled } }));
    }

    /** Sets the morphology scale applied to generated geometry (1 = native). */
    setMorphologyScale(scale: number): void {
        this.assertNotDisposed();
        if (!Number.isFinite(scale) || scale <= 0) throw new ViewerOperationError([{ code: "viewer.request.invalid-scale", severity: "error", message: "morphologyScale must be a positive finite number." }]);
        this.morphologyScale = scale;
        if (this.mineral) this.regenerate();
    }

    getMorphologyScale(): number | null {
        return this.morphologyScale ?? null;
    }

    getForms(): FormInfo[] {
        if (!this.mineral) return [];
        const habit = resolveHabit(this.mineral, this.habitId);
        const settings = habit.forms.map((form) => {
            const dev = this.formDevelopment[form.id] ?? form.development;
            const en = this.formEnabled[form.id] ?? form.enabled ?? true;
            return { form, development: dev, enabled: en };
        });
        const active = settings.filter(({ development, enabled }) => enabled && development > 0);
        const contributingForms = new Set(this.currentGeometry?.faces.flatMap((face) => face.contributors.map((contributor) => contributor.formId)) ?? []);
        const geometryValid = this.currentResult?.status === "valid";
        return settings.map(({ form, development, enabled }) => {
            const contributesToVisibleFaces = contributingForms.has(form.id);
            const effect: FormControlEffect = !enabled || development === 0
                ? "inactive"
                : !geometryValid
                    ? "geometry-invalid"
                    : active.length === 1
                        ? "scale-only"
                        : contributesToVisibleFaces
                            ? "shape"
                            : "redundant";
            return { id: form.id, label: form.label ?? form.id, development, enabled, effect, contributesToVisibleFaces };
        });
    }

    getHabits(): HabitInfo[] {
        if (!this.mineral) return [];
        return this.mineral.habits.map((h) => ({ id: h.id, name: h.name }));
    }

    getVariants(): VariantInfo[] {
        if (!this.mineral?.variants) return [];
        return this.mineral.variants.map((v) => ({ id: v.id, name: v.name, ...(v.description ? { description: v.description } : {}) }));
    }

    getVariantId(): string | null {
        return this.variantId ?? null;
    }

    // --- Appearance (M8) ---

    /** Lists the loaded mineral's appearance presets. */
    getAppearances(): AppearanceInfo[] {
        if (!this.mineral?.appearance) return [];
        return this.mineral.appearance.map((a) => ({ id: a.id, name: a.name, ...(a.luster ? { luster: a.luster } : {}) }));
    }

    /** Returns the selected appearance preset id, or null when none is selected. */
    getAppearanceId(): string | null {
        return this.appearanceId ?? null;
    }

    /** Returns the effective resolved appearance: preset merged with user overrides,
     * resolved against defaults, including the luster category and derived sheen. */
    getAppearance(): AppearanceValues {
        return resolveAppearance(this.effectiveAppearance());
    }

    /** Selects an appearance preset and clears user overrides. */
    setAppearance(id: string): void {
        this.assertNotDisposed();
        if (!this.mineral?.appearance) throw new ViewerOperationError([{ code: "viewer.request.unknown-appearance", severity: "error", message: "The loaded mineral defines no appearance presets." }]);
        if (!this.mineral.appearance.some((a) => a.id === id)) throw new ViewerOperationError([{ code: "viewer.request.unknown-appearance", severity: "error", message: `Unknown appearance "${id}" for mineral "${this.mineral.id}".` }]);
        this.appearanceId = id;
        this.appearanceOverrides = {};
        this.applyAppearanceToMesh();
        this.dispatchEvent(new CustomEvent("appearance-changed", { detail: { id } }));
    }

    /** Sets a single appearance field as a user override on top of the selected preset. */
    setAppearanceField(field: AppearanceField, value: string | number): void {
        this.assertNotDisposed();
        if (!APPEARANCE_FIELDS.includes(field)) throw new ViewerOperationError([{ code: "viewer.request.unknown-appearance-field", severity: "error", message: `Unknown appearance field "${field}".` }]);
        if (field === "baseColor" || field === "absorptionColor") {
            if (typeof value !== "string") throw new ViewerOperationError([{ code: "viewer.request.invalid-appearance", severity: "error", message: `${field} must be a string.` }]);
        } else {
            if (typeof value !== "number" || !Number.isFinite(value)) throw new ViewerOperationError([{ code: "viewer.request.invalid-appearance", severity: "error", message: `${field} must be a finite number.` }]);
            if (field === "roughness" || field === "metalness" || field === "transmission") {
                if (value < 0 || value > 1) throw new ViewerOperationError([{ code: "viewer.request.invalid-appearance", severity: "error", message: `${field} must be in [0, 1].` }]);
            } else if (field === "ior") {
                if (value <= 0) throw new ViewerOperationError([{ code: "viewer.request.invalid-appearance", severity: "error", message: "ior must be strictly positive." }]);
            } else if (field === "absorptionDensity") {
                if (value < 0) throw new ViewerOperationError([{ code: "viewer.request.invalid-appearance", severity: "error", message: "absorptionDensity must be non-negative." }]);
            }
        }
        this.appearanceOverrides = { ...this.appearanceOverrides, [field]: value };
        this.applyAppearanceToMesh();
        this.dispatchEvent(new CustomEvent("appearance-changed", { detail: { field, value } }));
    }

    private effectiveAppearance(): AppearanceParams {
        const preset = this.mineral?.appearance?.find((a) => a.id === this.appearanceId);
        const base: AppearanceParams = preset
            ? {
                ...(preset.baseColor !== undefined ? { baseColor: preset.baseColor } : {}),
                ...(preset.roughness !== undefined ? { roughness: preset.roughness } : {}),
                ...(preset.metalness !== undefined ? { metalness: preset.metalness } : {}),
                ...(preset.transmission !== undefined ? { transmission: preset.transmission } : {}),
                ...(preset.ior !== undefined ? { ior: preset.ior } : {}),
                ...(preset.absorptionColor !== undefined ? { absorptionColor: preset.absorptionColor } : {}),
                ...(preset.absorptionDensity !== undefined ? { absorptionDensity: preset.absorptionDensity } : {}),
                ...(preset.luster !== undefined ? { luster: preset.luster } : {}),
            }
            : {};
        return { ...base, ...this.appearanceOverrides };
    }

    private applyAppearanceToMesh(): void {
        if (this.mesh) {
            applyAppearance(this.mesh.material, this.effectiveAppearance());
            this.renderOnce();
        }
    }

    // --- Atomic structure view (M6) ---

    /** Imports a CIF and loads the resulting structural definition for atomic view. */
    loadCif(text: string, options: { blockId?: string } = {}): readonly Diagnostic[] {
        this.assertNotDisposed();
        const result = importCif(text, options);
        this.importDiagnostics = result.diagnostics;
        if (!result.ok) {
            this.dispatchEvent(new CustomEvent("structure-load-failed", { detail: { diagnostics: result.diagnostics } }));
            return result.diagnostics;
        }
        const failure = this.prepareStructure(result.value);
        if (failure) {
            const diagnostics = [...result.diagnostics, ...failure];
            this.importDiagnostics = diagnostics;
            this.dispatchEvent(new CustomEvent("structure-load-failed", { detail: { diagnostics } }));
            return diagnostics;
        }
        this.importDiagnostics = result.diagnostics;
        this.dispatchEvent(new CustomEvent("structure-loaded", { detail: { id: result.value.id, warnings: result.diagnostics } }));
        return result.diagnostics;
    }

    /** Imports CIF crystal-face measurements and displays their faceted morphology. */
    loadCifMorphology(text: string, options: { blockId?: string } = {}): readonly Diagnostic[] {
        this.assertNotDisposed();
        const result = importCif(text, options);
        if (!result.ok) { this.dispatchEvent(new CustomEvent("structure-load-failed", { detail: { diagnostics: result.diagnostics } })); return result.diagnostics; }
        const fallback = !result.value.crystalFaces?.length;
        const diagnostics: Diagnostic[] = [...result.diagnostics, ...(fallback ? [{ code: "viewer.morphology.bfdh-fallback", severity: "warning" as const, message: "No measured crystal faces were supplied; showing a theoretical BFDH morphology derived from the unit cell and symmetry." }] : [])];
        const geometry = fallback
            ? generateCrystal(result.value.crystallography, { forms: bfdhForms(result.value.crystallography) })
            : generateCrystalFromFaces(result.value.crystallography, result.value.crystalFaces!.map((face, i) => ({ ...face.indices, perpendicularDistance: face.perpendicularDistance, id: face.name ?? `face-${i + 1}` })));
        if (geometry.status !== "valid") { this.dispatchEvent(new CustomEvent("geometry-invalid", { detail: { diagnostics: geometry.diagnostics } })); return geometry.diagnostics; }
        this.loadGeneration++;
        this.mineral = null;
        this.structure = result.value;
        this.explicitFaceGeometry = true;
        this.currentResult = geometry;
        this.lastValidGeometry = geometry;
        this.currentGeometry = geometry.geometry;
        this.viewMode = "morphology";
        this.clearAtomic();
        this.updateMesh(geometry);
        this.frameCamera(geometry.geometry.bounds.min, geometry.geometry.bounds.max);
        this.updateViewVisibility();
        this.renderOnce();
        this.dispatchEvent(new CustomEvent("structure-loaded", { detail: { id: result.value.id, warnings: diagnostics } }));
        return diagnostics;
    }

    /** Loads a structural definition (e.g. from `importCif`) for the atomic structure view. */
    loadStructure(definition: StructuralDefinition): void {
        this.assertNotDisposed();
        const failure = this.prepareStructure(definition);
        if (failure) {
            this.importDiagnostics = failure;
            this.dispatchEvent(new CustomEvent("structure-load-failed", { detail: { diagnostics: failure } }));
            return;
        }
        this.importDiagnostics = [];
        this.dispatchEvent(new CustomEvent("structure-loaded", { detail: { id: definition.id, warnings: [] } }));
    }

    /** Validates and commits a structure; returns diagnostics without emitting events on failure. */
    private prepareStructure(definition: StructuralDefinition): readonly Diagnostic[] | null {
        const latticeResult = createLattice(definition.crystallography.unitCell);
        if (!latticeResult.ok) {
            return latticeResult.diagnostics;
        }
        const operations = definition.crystallography.spaceOperations ?? [];
        const expanded = expandAtomicStructure(definition.atomicStructure, operations, latticeResult.value);
        if (!expanded.ok) {
            return expanded.diagnostics;
        }
        const suppliedBonds = definition.atomicStructure.bonds;
        if (suppliedBonds) {
            const bonds = validatePeriodicBonds(suppliedBonds, expanded.value);
            if (!bonds.ok) {
                return bonds.diagnostics;
            }
        }
        // Only a validated structural commit supersedes a pending mineral load.
        this.loadGeneration++;
        // The imported structural definition is authoritative for its cell,
        // symmetry and atomic positions. Do not retain an unrelated mineral
        // morphology alongside it.
        this.mineral = null;
        this.explicitFaceGeometry = false;
        this.embeddedMineral = false;
        this.habitId = undefined;
        this.variantId = undefined;
        this.formDevelopment = {};
        this.formEnabled = {};
        this.morphologyScale = undefined;
        this.appearanceId = undefined;
        this.appearanceOverrides = {};
        this.lastValidGeometry = null;
        this.currentResult = null;
        this.currentGeometry = null;
        this.triangleFaces = null;
        this.selectedFaceIndex = null;
        this.clearMesh();
        this.clearLabels();
        this.structure = definition;
        this.structureLattice = latticeResult.value;
        this.expandedAtoms = expanded.value;
        this.structureBonds = suppliedBonds ?? inferBonds(expanded.value, latticeResult.value);
        this.viewMode = "atomic";
        this.updateAtomicRender();
        this.updateCellOverlay();
        this.updateViewVisibility();
        this.frameAtomic();
        this.renderOnce();
        this.dispatchEvent(new CustomEvent("view-mode-changed", { detail: { mode: "atomic" } }));
        return null;
    }

    setViewMode(mode: ViewMode): void {
        this.assertNotDisposed();
        this.viewMode = mode;
        this.updateCellOverlay();
        this.updateViewVisibility();
        if (mode === "atomic") this.frameAtomic();
        else if (this.lastValidGeometry?.status === "valid") this.frameCamera(this.lastValidGeometry.geometry.bounds.min, this.lastValidGeometry.geometry.bounds.max);
        this.renderOnce();
        this.dispatchEvent(new CustomEvent("view-mode-changed", { detail: { mode } }));
    }

    getViewMode(): ViewMode {
        return this.viewMode;
    }

    setLatticeRepetition(na: number, nb: number, nc: number): void {
        this.assertNotDisposed();
        this.latticeRepetition = [Math.max(1, Math.min(6, Math.round(na))), Math.max(1, Math.min(6, Math.round(nb))), Math.max(1, Math.min(6, Math.round(nc)))];
        if (this.viewMode === "atomic") {
            this.updateAtomicRender();
            this.frameAtomic();
            this.renderOnce();
        }
        this.dispatchEvent(new CustomEvent("lattice-repetition-changed", { detail: { repetition: this.latticeRepetition } }));
    }

    getLatticeRepetition(): readonly [number, number, number] {
        return this.latticeRepetition;
    }

    setShowUnitCell(show: boolean): void {
        this.assertNotDisposed();
        this.showUnitCell = show;
        if (this.viewMode === "atomic") this.updateAtomicRender();
        this.updateCellOverlay();
        this.updateViewVisibility();
        this.renderOnce();
    }

    setShowBonds(show: boolean): void {
        this.assertNotDisposed();
        this.showBonds = show;
        if (this.viewMode === "atomic") this.updateAtomicRender();
        this.renderOnce();
    }

    setShowAxes(show: boolean): void {
        this.assertNotDisposed();
        this.showAxes = show;
        this.updateCellOverlay();
        this.renderOnce();
    }

    setShowWireframe(show: boolean): void {
        this.assertNotDisposed();
        this.showWireframe = show;
        if (this.mesh) this.mesh.material.wireframe = show;
        this.renderOnce();
    }

    getShowWireframe(): boolean {
        return this.showWireframe;
    }

    getStructureInfo(): StructureInfo | null {
        if (!this.structure) return null;
        const c = this.structure.crystallography;
        const bonds = this.structureBonds ?? [];
        return {
            id: this.structure.id,
            name: this.structure.name,
            crystalSystem: c.crystalSystem,
            ...(c.pointGroup ? { pointGroup: c.pointGroup } : {}),
            ...(c.setting ? { setting: c.setting } : {}),
            ...(c.spaceGroup ? { spaceGroup: c.spaceGroup } : {}),
            siteRepresentation: this.structure.atomicStructure.siteRepresentation,
            atomCount: this.expandedAtoms?.length ?? 0,
            bondCount: bonds.length,
            bondsDerived: bonds.length > 0 && bonds.every((b) => b.derived),
            ...(this.structure.authors ? { authors: this.structure.authors } : {}),
            ...(this.structure.publicationTitle ? { publicationTitle: this.structure.publicationTitle } : {}),
            ...(this.structure.mineralName ? { mineralName: this.structure.mineralName } : {}),
            ...(this.structure.formula ? { formula: this.structure.formula } : {}),
        };
    }

    getImportDiagnostics(): readonly Diagnostic[] {
        return this.importDiagnostics;
    }

    getGeometryStatus(): { status: GeometryStatus; diagnostics: readonly Diagnostic[]; stale: boolean } {
        const result = this.currentResult;
        if (!result) return { status: "invalid", diagnostics: [], stale: false };
        return {
            status: result.status,
            diagnostics: result.diagnostics,
            stale: result.status === "invalid" && this.lastValidGeometry !== null,
        };
    }

    getMineralId(): string | null {
        return this.mineral?.id ?? null;
    }

    getHabitId(): string | null {
        if (!this.mineral) return null;
        return this.habitId ?? this.mineral.habits[0]?.id ?? null;
    }

    // --- State serialization (M7) ---

    /** Serializes the persistent viewer configuration as JSON-compatible state. */
    getState(): ViewerState {
        const forms: Record<string, FormState> = {};
        if (this.mineral) {
            const habit = resolveHabit(this.mineral, this.habitId);
            for (const form of habit.forms) {
                const dev = this.formDevelopment[form.id] ?? form.development;
                const en = this.formEnabled[form.id] ?? form.enabled ?? true;
                forms[form.id] = { development: dev, enabled: en };
            }
        }
        const mineralRef: MineralRefState | undefined = this.mineral
            ? {
                id: this.mineral.id,
                dataRevision: this.mineral.dataRevision,
                ...(this.variantId ? { variant: this.variantId } : {}),
                ...(this.embeddedMineral ? { definition: this.mineral } : {}),
            }
            : undefined;
        return {
            version: STATE_VERSION,
            ...(mineralRef ? { mineral: mineralRef } : {}),
            ...(this.habitId ? { habit: this.habitId } : {}),
            forms,
            ...(this.morphologyScale !== undefined ? { morphologyScale: this.morphologyScale } : {}),
            ...(this.appearanceId !== undefined || Object.keys(this.appearanceOverrides).length > 0 ? {
                appearance: {
                    ...(this.appearanceId !== undefined ? { id: this.appearanceId } : {}),
                    ...(Object.keys(this.appearanceOverrides).length > 0 ? { overrides: this.appearanceOverrides } : {}),
                },
            } : {}),
            display: {
                axes: this.showAxes,
                labels: this.showLabels,
                unitCell: this.showUnitCell,
                bonds: this.showBonds,
                wireframe: this.showWireframe,
            },
            camera: {
                projection: "perspective",
                position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
                up: [this.camera.up.x, this.camera.up.y, this.camera.up.z],
                target: [this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z],
                zoom: this.camera.zoom,
                near: this.camera.near,
                far: this.camera.far,
                groupRotation: [this.crystalGroup.rotation.x, this.crystalGroup.rotation.y, this.crystalGroup.rotation.z],
            },
            atomic: {
                viewMode: this.viewMode,
                latticeRepetition: [this.latticeRepetition[0], this.latticeRepetition[1], this.latticeRepetition[2]],
            },
            ...(this.structure ? { structure: { definition: this.structure } } : {}),
        };
    }

    /**
     * Restores persistent viewer configuration from serialized state. The
     * payload is parsed and its referenced data resolved before any mutation
     * (transactional). Malformed state, unsupported versions, and unresolved
     * or incompatible references reject with a diagnostic and leave the
     * previous state unchanged (`state-rejected`). A valid state whose forms
     * produce invalid geometry is accepted as a requested configuration and
     * follows Invalid Geometry and Recovery. On success emits `state-restored`.
     */
    setState(state: unknown): void {
        this.assertNotDisposed();
        const shape = validateStateShape(state);
        if (!shape.ok) {
            this.dispatchEvent(new CustomEvent("state-rejected", { detail: { diagnostics: shape.diagnostics } }));
            throw new ViewerOperationError(shape.diagnostics);
        }
        const s = shape.value;
        const diagnostics: Diagnostic[] = [];

        // Resolve referenced mineral data before any mutation.
        let mineral: Mineral | null = null;
        if (s.mineral) {
            if (s.mineral.definition) {
                const validated = validateMineral(s.mineral.definition);
                if (!validated.ok) diagnostics.push(...validated.diagnostics.map((d) => ({ ...d, code: "viewer.state.malformed", path: `/mineral/definition${d.path ?? ""}` })));
                else if (validated.value.id !== s.mineral.id || validated.value.dataRevision !== s.mineral.dataRevision) diagnostics.push({ code: "viewer.state.incompatible-data", severity: "error", message: "Embedded mineral identity does not match its state reference.", path: "/mineral" });
                else mineral = validated.value;
            } else {
                const record = getMineral(s.mineral.id);
                if (!record) diagnostics.push({ code: "viewer.state.unknown-mineral", severity: "error", message: `Unknown mineral "${s.mineral.id}"; referenced data is unavailable.`, path: "/mineral/id" });
                else if (record.dataRevision !== s.mineral.dataRevision) diagnostics.push({ code: "viewer.state.incompatible-data", severity: "error", message: `Mineral "${s.mineral.id}" data revision mismatch: state has "${s.mineral.dataRevision}" but bundled data is "${record.dataRevision}".`, path: "/mineral/dataRevision" });
                else mineral = record;
            }
        }
        if (mineral) {
            if (s.habit !== undefined) {
                try { resolveHabit(mineral, s.habit); } catch { diagnostics.push({ code: "viewer.state.unknown-habit", severity: "error", message: `Unknown habit "${s.habit}" for mineral "${mineral.id}".`, path: "/habit" }); }
            }
            if (s.mineral!.variant !== undefined) {
                try { resolveCrystallography(mineral, s.mineral!.variant); } catch { diagnostics.push({ code: "viewer.state.unknown-variant", severity: "error", message: `Unknown variant "${s.mineral!.variant}" for mineral "${mineral.id}".`, path: "/mineral/variant" }); }
            }
            const habit = resolveHabit(mineral, s.habit);
            for (const id of Object.keys(s.forms)) {
                if (!habit.forms.some((f) => f.id === id)) diagnostics.push({ code: "viewer.state.unknown-form", severity: "error", message: `Unknown form "${id}" for habit "${habit.id}".`, path: `/forms/${id}` });
            }
            if (s.appearance?.id !== undefined && !mineral.appearance?.some((a) => a.id === s.appearance!.id)) {
                diagnostics.push({ code: "viewer.state.unknown-appearance", severity: "error", message: `Unknown appearance "${s.appearance!.id}" for mineral "${mineral.id}".`, path: "/appearance/id" });
            }
        }

        // Resolve imported structure: re-expand to verify compatibility (portable).
        let structureDef: StructuralDefinition | null = null;
        let structureLattice: Lattice | null = null;
        let expandedAtoms: readonly ExpandedAtom[] | null = null;
        let structureBonds: readonly PeriodicBond[] | null = null;
        if (s.structure) {
            try {
                const def = s.structure.definition;
                const latticeResult = createLattice(def.crystallography.unitCell);
                if (!latticeResult.ok) diagnostics.push(...latticeResult.diagnostics.map((d) => ({ ...d, path: "/structure/definition/crystallography/unitCell" })));
                else {
                    const ops = def.crystallography.spaceOperations ?? [];
                    const exp = expandAtomicStructure(def.atomicStructure, ops, latticeResult.value);
                    if (!exp.ok) diagnostics.push(...exp.diagnostics.map((d) => ({ ...d, path: "/structure/definition/atomicStructure" })));
                    else {
                        const bonds = def.atomicStructure.bonds ? validatePeriodicBonds(def.atomicStructure.bonds, exp.value) : null;
                        if (bonds && !bonds.ok) diagnostics.push(...bonds.diagnostics.map((d) => ({ ...d, path: `/structure/definition/atomicStructure${d.path ?? ""}` })));
                        else { structureDef = def; structureLattice = latticeResult.value; expandedAtoms = exp.value; structureBonds = def.atomicStructure.bonds ?? inferBonds(exp.value, latticeResult.value); }
                    }
                }
            } catch {
                diagnostics.push({ code: "viewer.state.malformed", severity: "error", message: "Embedded structural definition is malformed.", path: "/structure/definition" });
            }
        }

        if (diagnostics.length > 0) {
            this.dispatchEvent(new CustomEvent("state-rejected", { detail: { diagnostics } }));
            throw new ViewerOperationError(diagnostics);
        }

        // ---- Commit as one operation (supersedes pending loads) ----
        this.loadGeneration++;
        const sameMineral = !s.mineral?.definition && !!mineral && !this.embeddedMineral && !!this.mineral && mineral.id === this.mineral.id && mineral.dataRevision === this.mineral.dataRevision && (s.mineral?.variant ?? undefined) === (this.variantId ?? undefined);

        if (mineral) {
            this.mineral = mineral;
            this.embeddedMineral = s.mineral!.definition !== undefined;
            this.variantId = s.mineral!.variant;
            this.habitId = s.habit;
            this.formDevelopment = {};
            this.formEnabled = {};
            for (const [id, fs] of Object.entries(s.forms)) {
                this.formDevelopment[id] = fs.development;
                this.formEnabled[id] = fs.enabled;
            }
            this.morphologyScale = s.morphologyScale;
            this.appearanceId = s.appearance?.id ?? mineral.appearance?.[0]?.id;
            this.appearanceOverrides = { ...(s.appearance?.overrides ?? {}) };
            this.needsInitialFrame = false; // restored camera takes precedence over preferred view
            if (!sameMineral) {
                this.clearMesh();
                this.clearLabels();
                this.lastValidGeometry = null;
                this.selectedFaceIndex = null;
            }
            this.regenerate();
        } else {
            this.mineral = null;
            this.embeddedMineral = false;
            this.habitId = undefined;
            this.variantId = undefined;
            this.formDevelopment = {};
            this.formEnabled = {};
            this.morphologyScale = undefined;
            this.appearanceId = undefined;
            this.appearanceOverrides = {};
            this.clearMesh();
            this.clearLabels();
            this.lastValidGeometry = null;
            this.currentResult = null;
            this.currentGeometry = null;
            this.triangleFaces = null;
            this.selectedFaceIndex = null;
        }

        // Structure: restore embedded definition or clear if the state omits it.
        if (structureDef) {
            this.structure = structureDef;
            this.structureLattice = structureLattice;
            this.expandedAtoms = expandedAtoms;
            this.structureBonds = structureBonds;
            this.importDiagnostics = [];
        } else if (!s.structure) {
            this.structure = null;
            this.structureLattice = null;
            this.expandedAtoms = null;
            this.structureBonds = null;
            this.importDiagnostics = [];
            this.clearAtomic();
        }

        // Display settings.
        this.showAxes = s.display.axes;
        this.showLabels = s.display.labels;
        this.showUnitCell = s.display.unitCell;
        this.showBonds = s.display.bonds;
        this.showWireframe = s.display.wireframe;
        if (this.mesh) this.mesh.material.wireframe = this.showWireframe;

        // Atomic view mode + lattice repetition.
        this.viewMode = s.atomic.viewMode;
        this.latticeRepetition = [
            Math.max(1, Math.min(6, Math.round(s.atomic.latticeRepetition[0]))),
            Math.max(1, Math.min(6, Math.round(s.atomic.latticeRepetition[1]))),
            Math.max(1, Math.min(6, Math.round(s.atomic.latticeRepetition[2]))),
        ];

        // Restored camera takes precedence over preferred views.
        this.camera.position.set(s.camera.position[0], s.camera.position[1], s.camera.position[2]);
        this.camera.up.set(s.camera.up[0], s.camera.up[1], s.camera.up[2]);
        this.cameraTarget.set(...(s.camera.target ?? [0, 0, 0]));
        this.camera.zoom = s.camera.zoom ?? 1;
        this.camera.near = s.camera.near;
        this.camera.far = s.camera.far;
        this.camera.lookAt(this.cameraTarget);
        this.camera.updateProjectionMatrix();
        this.crystalGroup.rotation.set(s.camera.groupRotation[0], s.camera.groupRotation[1], s.camera.groupRotation[2]);
        this.labelGroup.rotation.copy(this.crystalGroup.rotation);
        this.rotationY = this.crystalGroup.rotation.y;

        this.updateCellOverlay();
        if (structureDef) this.updateAtomicRender();
        this.updateViewVisibility();
        this.renderOnce();
        this.dispatchEvent(new CustomEvent("state-restored", { detail: {} }));
    }

    /** Returns info about the currently selected face, or null. */
    getSelectedFace(): FaceInfo | null {
        if (this.selectedFaceIndex === null || !this.currentGeometry) return null;
        return this.faceInfo(this.selectedFaceIndex);
    }

    /** Returns info about all faces on the current geometry. */
    getAllFaces(): FaceInfo[] {
        if (!this.currentGeometry) return [];
        return this.currentGeometry.faces.map((_, i) => this.faceInfo(i)!);
    }

    /**
     * Returns faces equivalent under one contributor of the selected face. When
     * a face has several contributors, pass its form ID to choose the relevant
     * equivalence set; otherwise the deterministic first contributor is used.
     */
    getEquivalentFaces(faceIndex: number, formId?: string): number[] {
        if (!this.currentGeometry) return [];
        const face = this.currentGeometry.faces[faceIndex];
        if (!face) return [];
        const selectedFormId = formId ?? face.contributors[0]?.formId;
        if (!selectedFormId || !face.contributors.some((c) => c.formId === selectedFormId)) return [];
        return this.currentGeometry.faces
            .map((f, i) => ({ f, i }))
            .filter(({ f }) => f.contributors.some((c) => c.formId === selectedFormId))
            .map(({ i }) => i);
    }

    /** Selects a single face, highlights it, and emits a face-selected event. */
    selectFace(faceIndex: number): void {
        this.assertNotDisposed();
        if (!this.currentGeometry || !this.currentGeometry.faces[faceIndex]) return;
        this.selectedFaceIndex = faceIndex;
        this.updateHighlight([faceIndex]);
        const info = this.faceInfo(faceIndex);
        this.dispatchEvent(new CustomEvent("face-selected", { detail: { faceIndex, ...info } }));
    }

    /** Clears the current face selection and highlight. */
    clearSelection(): void {
        this.assertNotDisposed();
        this.selectedFaceIndex = null;
        this.clearHighlight();
        this.dispatchEvent(new CustomEvent("face-selected", { detail: { faceIndex: null } }));
    }

    /** Highlights all symmetry-equivalent faces for one contributor of the given face. */
    highlightEquivalentFaces(faceIndex: number, formId?: string): void {
        this.assertNotDisposed();
        if (!this.currentGeometry || !this.currentGeometry.faces[faceIndex]) return;
        this.selectedFaceIndex = faceIndex;
        const selectedFormId = formId ?? this.currentGeometry.faces[faceIndex]!.contributors[0]?.formId;
        const equivalent = this.getEquivalentFaces(faceIndex, selectedFormId);
        this.updateHighlight(equivalent);
        const info = this.faceInfo(faceIndex);
        this.dispatchEvent(new CustomEvent("face-selected", { detail: { faceIndex, equivalentFaces: equivalent, equivalentFormId: selectedFormId, ...info } }));
    }

    showFaceLabels(show: boolean): void {
        this.assertNotDisposed();
        this.showLabels = show;
        this.clearLabels();
        if (show && this.currentGeometry) this.createLabels(this.currentGeometry);
        this.labelGroup.visible = show;
        this.renderOnce();
    }

    resize(width: number, height: number): void {
        this.assertNotDisposed();
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.backgroundCamera.aspect = width / height;
        this.backgroundCamera.updateProjectionMatrix();
    }

    render(): void {
        this.assertNotDisposed();
        this.renderOnce();
    }

    /** Apply the current habit's preferred view to the displayed geometry. */
    resetCamera(): void {
        this.assertNotDisposed();
        if (this.viewMode === "atomic") {
            this.frameAtomic();
            this.renderOnce();
            return;
        }
        if (this.lastValidGeometry?.status !== "valid") return;
        const { bounds } = this.lastValidGeometry.geometry;
        this.frameCamera(bounds.min, bounds.max);
        this.renderOnce();
    }

    start(): void {
        this.assertNotDisposed();
        if (this.disconnected || this.animationHandle !== null) return;
        const loop = () => {
            if (this.disposed || this.disconnected) return;
            this.rotationY += this.rotationSpeed;
            this.crystalGroup.rotation.y = this.rotationY;
            this.labelGroup.rotation.y = this.rotationY;
            this.renderFrame();
            this.animationHandle = requestAnimationFrame(loop);
        };
        this.animationHandle = requestAnimationFrame(loop);
    }

    stop(): void {
        if (this.animationHandle !== null && typeof cancelAnimationFrame === "function") {
            cancelAnimationFrame(this.animationHandle);
            this.animationHandle = null;
        } else if (this.animationHandle !== null) {
            this.animationHandle = null;
        }
    }

    /** Whether the viewer has been permanently disposed. */
    isDisposed(): boolean {
        return this.disposed;
    }

    /**
     * Pauses rendering and detaches external (canvas) listeners while
     * preserving configuration. A running animation loop is paused and
     * resumed on {@link reconnect}; a stopped viewer remains stopped.
     */
    disconnect(): void {
        if (this.disposed || this.disconnected) return;
        this.wasRunning = this.animationHandle !== null;
        this.stop();
        this.detachCanvasListeners();
        this.disconnected = true;
    }

    /** Reattaches listeners and resumes the previous rendering mode. */
    reconnect(): void {
        if (this.disposed) return; // a disposed component does not reactivate
        if (!this.disconnected) return;
        this.disconnected = false;
        this.attachCanvasListeners();
        if (this.wasRunning) this.start();
        this.wasRunning = false;
        this.renderOnce();
    }

    /** Whether the viewer is currently disconnected (rendering paused). */
    isDisconnected(): boolean {
        return this.disconnected;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        // Invalidate work that has resolved data but has not committed yet.
        this.loadGeneration++;
        this.disconnected = true;
        this.stop();
        this.detachCanvasListeners();
        this.clearMesh();
        this.clearLabels();
        this.clearAtomic();
        if (this.cellOverlay) { this.crystalGroup.remove(this.cellOverlay); this.cellOverlay = null; }
        this.disposeEnvironment();
        this.renderer.dispose();
    }

    private regenerate(): void {
        if (!this.mineral || this.explicitFaceGeometry) return;
        const input = createCrystalInput(this.mineral, {
            habitId: this.habitId,
            variantId: this.variantId,
            formDevelopment: this.formDevelopment,
            formEnabled: this.formEnabled,
            ...(this.morphologyScale !== undefined ? { morphologyScale: this.morphologyScale } : {}),
        });
        const result = generateCrystal(input.crystallography, input.morphology);
        this.currentResult = result;
        if (result.status === "valid") {
            this.lastValidGeometry = result;
            this.currentGeometry = result.geometry;
            this.updateMesh(result);
            if (this.selectedFaceIndex !== null && this.currentGeometry.faces[this.selectedFaceIndex]) {
                this.updateHighlight([this.selectedFaceIndex]);
            } else {
                this.selectedFaceIndex = null;
            }
            this.dispatchEvent(new CustomEvent("geometry-changed", { detail: { status: "valid" } }));
        } else {
            this.currentGeometry = null;
            this.triangleFaces = null;
            this.selectedFaceIndex = null;
            this.dispatchEvent(new CustomEvent("geometry-invalid", { detail: { diagnostics: result.diagnostics } }));
        }
        this.renderOnce();
    }

    /** Renders a single frame unless the loop is running or the viewer is disconnected. */
    private renderOnce(): void {
        if (!this.disconnected && this.animationHandle === null) this.renderFrame();
    }

    private renderFrame(): void {
        const renderer = this.renderer as WebGLRenderer & { clearDepth?: () => void };
        if (typeof renderer.clearDepth !== "function") {
            renderer.render(this.scene, this.camera);
            return;
        }

        this.backgroundCamera.position.copy(this.camera.position);
        this.backgroundCamera.quaternion.copy(this.camera.quaternion);
        this.backgroundCamera.up.copy(this.camera.up);
        this.backgroundCamera.aspect = this.camera.aspect;
        this.backgroundCamera.fov = 2 * Math.atan(Math.tan(this.camera.fov * Math.PI / 360) / this.environmentBackgroundZoom) * 180 / Math.PI;
        this.backgroundCamera.updateProjectionMatrix();

        renderer.autoClear = true;
        renderer.render(this.backgroundScene, this.backgroundCamera);
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(this.scene, this.camera);
        renderer.autoClear = true;
    }

    /**
     * Builds the project-owned neutral studio environment used as both backdrop
     * and image-based lighting. Broad key, fill and rim shapes make curved or
     * faceted reflections legible across dielectric, metallic and transmissive
     * materials without a remote runtime asset. PMREM generation is skipped in
     * non-WebGL tests, where the renderer is stubbed.
     */
    private setupEnvironment(): void {
        const anyRenderer = this.renderer as unknown as { getContext?: () => unknown };
        if (typeof anyRenderer.getContext !== "function") return;
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext("2d")!;
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, "#9da8b5");
        grad.addColorStop(0.42, "#c8cbd0");
        grad.addColorStop(0.58, "#b7afa5");
        grad.addColorStop(1, "#555a63");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const softbox = (x: number, y: number, radius: number, scaleX: number, color: string, strength: number): void => {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scaleX, 1);
            const light = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            light.addColorStop(0, `rgb(${color} / ${strength})`);
            light.addColorStop(0.62, `rgb(${color} / ${strength * 0.72})`);
            light.addColorStop(1, `rgb(${color} / 0)`);
            ctx.fillStyle = light;
            ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
            ctx.restore();
        };
        softbox(350, 72, 68, 1.8, "255 248 235", 0.92); // broad warm key
        softbox(105, 104, 76, 1.35, "220 235 255", 0.62); // cool opposing fill
        softbox(475, 124, 48, 0.34, "255 255 255", 0.72); // narrow rim strip

        const tex = new CanvasTexture(canvas);
        tex.mapping = EquirectangularReflectionMapping;
        tex.needsUpdate = true;
        const pmrem = new PMREMGenerator(this.renderer);
        const target = pmrem.fromEquirectangular(tex);
        this.disposeEnvironment();
        this.environmentSource = tex;
        this.environmentTarget = target;
        // The same gradient serves as the visible backdrop (so transmission has
        // contrast) and as the PMREM-processed reflection environment.
        this.scene.environment = target.texture;
        this.updateEnvironmentBackground();
        pmrem.dispose();
    }

    private updateEnvironmentBackground(): void {
        this.scene.background = null;
        this.backgroundScene.background = this.environmentBackgroundVisible && this.environmentSource
            ? this.environmentSource
            : new Color(0x2a2e33);
    }

    private validEnvironmentDimensions(width: number, height: number): boolean {
        return Number.isInteger(width) && Number.isInteger(height)
            && width > 0 && height > 0
            && width <= 16_384 && height <= 16_384
            && width * height <= 33_554_432;
    }

    private disposeEnvironment(): void {
        this.scene.environment = null;
        this.scene.background = null;
        this.backgroundScene.background = null;
        this.environmentTarget?.dispose();
        this.environmentSource?.dispose();
        this.environmentTarget = null;
        this.environmentSource = null;
    }

    private updateMesh(result: Extract<GeometryResult, { status: "valid" }>): void {
        this.clearMesh();
        this.clearLabels();
        const { buffer, triangleFaces } = createThreeGeometryWithPicking(result.geometry);
        this.triangleFaces = triangleFaces;
        buffer.center();
        const material = createCrystalMaterial(this.effectiveAppearance(), {
            side: DoubleSide,
            flatShading: true,
            wireframe: this.showWireframe,
        });
        // Volumetric absorption scales with the displayed crystal depth.
        const { min, max } = result.geometry.bounds;
        material.thickness = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
        this.mesh = new Mesh(buffer, material);
        this.crystalGroup.add(this.mesh);
        if (this.showLabels) this.createLabels(result.geometry);
        if (this.needsInitialFrame) {
            this.frameCamera(result.geometry.bounds.min, result.geometry.bounds.max);
            this.needsInitialFrame = false;
        }
    }

    private clearMesh(): void {
        this.clearHighlight();
        if (this.mesh) {
            this.crystalGroup.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
    }

    private clearHighlight(): void {
        if (this.highlightMesh) {
            this.crystalGroup.remove(this.highlightMesh);
            this.highlightMesh.geometry.dispose();
            this.highlightMesh.material.dispose();
            this.highlightMesh = null;
        }
    }

    private updateHighlight(faceIndices: readonly number[]): void {
        this.clearHighlight();
        if (!this.mesh || !this.triangleFaces || !this.currentGeometry || faceIndices.length === 0) return;
        const faceSet = new Set(faceIndices);
        const positions = this.mesh.geometry.getAttribute("position");
        const index = this.mesh.geometry.getIndex();
        if (!index) return;
        const highlightIndices: number[] = [];
        const triCount = this.triangleFaces.length;
        for (let i = 0; i < triCount; i++) {
            if (faceSet.has(this.triangleFaces[i]!)) {
                highlightIndices.push(index.getX(i * 3), index.getX(i * 3 + 1), index.getX(i * 3 + 2));
            }
        }
        if (highlightIndices.length === 0) return;
        const geo = new BufferGeometry();
        geo.setAttribute("position", positions);
        geo.setIndex(highlightIndices);
        const material = new MeshBasicMaterial({
            color: 0xffff00,
            side: DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
        });
        this.highlightMesh = new Mesh(geo, material);
        this.crystalGroup.add(this.highlightMesh);
    }

    private clearLabels(): void {
        while (this.labelGroup.children.length > 0) {
            const child = this.labelGroup.children[0]!;
            this.labelGroup.remove(child);
            if (child instanceof Sprite) {
                child.material.map?.dispose();
                child.material.dispose();
            }
        }
    }

    private createLabels(geometry: CrystalGeometry): void {
        const vertices = geometry.vertices;
        for (const face of geometry.faces) {
            const centroid = this.faceCentroid(face, vertices);
            const label = face.contributors[0]?.formId ?? "?";
            const sprite = this.createTextSprite(label);
            sprite.position.set(centroid[0], centroid[1], centroid[2]);
            this.labelGroup.add(sprite);
        }
    }

    private faceCentroid(face: CrystalFace, vertices: Float64Array): [number, number, number] {
        let x = 0, y = 0, z = 0;
        for (const idx of face.vertexIndices) {
            x += vertices[idx * 3]!;
            y += vertices[idx * 3 + 1]!;
            z += vertices[idx * 3 + 2]!;
        }
        const n = face.vertexIndices.length;
        return [x / n, y / n, z / n];
    }

    private createTextSprite(text: string): Sprite {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 36px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 32, 32);
        const texture = new CanvasTexture(canvas);
        const material = new SpriteMaterial({ map: texture, depthTest: false });
        const sprite = new Sprite(material);
        sprite.scale.set(1.5, 1.5, 1);
        return sprite;
    }

    private clearAtomic(): void {
        if (this.atomicGroup) {
            this.crystalGroup.remove(this.atomicGroup);
            this.atomicGroup.traverse((child) => {
                const obj = child as { geometry?: { dispose(): void }; material?: { dispose(): void } };
                obj.geometry?.dispose();
                obj.material?.dispose();
            });
            this.atomicGroup = null;
        }
    }

    private updateAtomicRender(): void {
        this.clearAtomic();
        if (!this.expandedAtoms || !this.structureLattice) return;
        const group = createAtomicStructure(this.expandedAtoms, this.showBonds ? (this.structureBonds ?? []) : [], this.structureLattice, {
            repetition: this.latticeRepetition, showBonds: this.showBonds, showUnitCell: this.showUnitCell,
        });
        // Centre the atomic group at the displayed-cell bounding-box centre so it
        // shares the morphology view's crystal-local orientation and origin.
        const { min, max } = atomicBounds(this.expandedAtoms, this.structureLattice, this.latticeRepetition);
        const center = new Vector3().addVectors(min, max).multiplyScalar(0.5);
        group.position.sub(center);
        this.atomicGroup = group;
        this.crystalGroup.add(group);
    }

    private updateCellOverlay(): void {
        if (this.cellOverlay) {
            this.crystalGroup.remove(this.cellOverlay);
            this.cellOverlay = null;
        }
        const mineralCrystallography = this.mineral ? resolveCrystallography(this.mineral, this.variantId) : null;
        const mineralLattice = mineralCrystallography ? createLattice(mineralCrystallography.unitCell) : null;
        const lattice = this.structureLattice ?? (mineralLattice?.ok ? mineralLattice.value : null);
        const crystallography = this.structure?.crystallography ?? mineralCrystallography;
        if (!lattice || !crystallography || (!this.showUnitCell && !this.showAxes)) return;
        this.cellOverlay = this.buildCellOverlay(lattice, crystallography);
        this.crystalGroup.add(this.cellOverlay);
    }

    private buildCellOverlay(lattice: Lattice, crystallography: MineralCrystallography): Group {
        const group = new Group();
        const direct = lattice.direct;
        const corner = new Vector3(0, 0, 0);
        const ax = new Vector3(direct[0][0], direct[1][0], direct[2][0]);
        const ay = new Vector3(direct[0][1], direct[1][1], direct[2][1]);
        const az = new Vector3(direct[0][2], direct[1][2], direct[2][2]);
        // Unit-cell wireframe centred at the origin (matches morphology centring).
        const c = corner.clone().add(ax).add(ay).add(az).multiplyScalar(-0.5);
        const corners = [c.clone(), c.clone().add(ax), c.clone().add(ay), c.clone().add(az), c.clone().add(ax).add(ay), c.clone().add(ax).add(az), c.clone().add(ay).add(az), c.clone().add(ax).add(ay).add(az)];
        if (this.showUnitCell) {
            const edges: number[] = [];
            const edge = (i: number, j: number) => edges.push(corners[i]!.x, corners[i]!.y, corners[i]!.z, corners[j]!.x, corners[j]!.y, corners[j]!.z);
            edge(0, 1); edge(0, 2); edge(0, 3); edge(1, 4); edge(1, 5); edge(2, 4); edge(2, 6); edge(3, 5); edge(3, 6); edge(4, 7); edge(5, 7); edge(6, 7);
            const geo = new BufferGeometry();
            geo.setAttribute("position", new Float32BufferAttribute(edges, 3));
            group.add(new LineSegments(geo, new LineBasicMaterial({ color: 0x66ccff })));
        }
        // Derive axes from the declared lattice setting, not decorative XYZ.
        if (this.showAxes) {
            const axis = (v: Vector3, color: number) => {
                const g = new BufferGeometry();
                g.setAttribute("position", new Float32BufferAttribute([c.x, c.y, c.z, c.x + v.x, c.y + v.y, c.z + v.z], 3));
                group.add(new LineSegments(g, new LineBasicMaterial({ color })));
            };
            const hexagonalAxes = crystallography.crystalSystem === "hexagonal"
                || (crystallography.crystalSystem === "trigonal" && crystallography.setting === "hexagonal-standard");
            axis(ax, 0xff4040);
            axis(ay, 0x40ff40);
            if (hexagonalAxes) axis(ax.clone().add(ay).negate(), 0x4080ff); // a3 = -(a1 + a2)
            axis(az, hexagonalAxes ? 0xffd040 : 0x4080ff);
        }
        return group;
    }

    private updateViewVisibility(): void {
        const morphVisible = this.viewMode === "morphology";
        if (this.mesh) this.mesh.visible = morphVisible;
        this.labelGroup.visible = morphVisible && this.showLabels;
        if (this.atomicGroup) this.atomicGroup.visible = this.viewMode === "atomic";
        if (this.cellOverlay) this.cellOverlay.visible = this.viewMode === "morphology"
            ? this.showUnitCell || this.showAxes
            : this.showAxes;
    }

    private frameAtomic(): void {
        if (!this.expandedAtoms || !this.structureLattice) return;
        const { min, max } = atomicBounds(this.expandedAtoms, this.structureLattice, this.latticeRepetition);
        const size = Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
        const distance = (size || 10) * 2.5;
        this.rotationY = 0;
        this.crystalGroup.rotation.set(0, 0, 0);
        // Default oblique view preserves the crystal-local frame consistently with morphology.
        const dir = new Vector3(1, 0.7, 1).normalize();
        this.camera.position.copy(dir.multiplyScalar(distance));
        this.camera.up.set(0, 1, 0);
        this.cameraTarget.set(0, 0, 0);
        this.camera.zoom = 1;
        this.camera.lookAt(this.cameraTarget);
        this.camera.near = distance / 100;
        this.camera.far = distance * 100;
        this.camera.updateProjectionMatrix();
    }

    private frameCamera(min: readonly number[], max: readonly number[]): void {
        if (!this.mineral) return;
        const habit = this.mineral ? resolveHabit(this.mineral, this.habitId) : null;
        const { direction, up } = cameraBasis(resolveCrystallography(this.mineral, this.variantId), habit?.preferredView);
        const size = Math.max(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!);
        const distance = size * 2.5 || 10;
        this.rotationY = 0;
        this.crystalGroup.rotation.set(0, 0, 0);
        this.labelGroup.rotation.set(0, 0, 0);
        this.camera.position.set(direction[0] * distance, direction[1] * distance, direction[2] * distance);
        this.camera.up.set(...up);
        this.cameraTarget.set(0, 0, 0);
        this.camera.zoom = 1;
        this.camera.lookAt(this.cameraTarget);
        this.camera.near = distance / 100;
        this.camera.far = distance * 100;
        this.camera.updateProjectionMatrix();
    }

    private onPointerDown(e: PointerEvent): void {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY ?? 0;
        this.stop();
    }

    private onPointerMove(e: PointerEvent): void {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastMouseX;
        const dy = (e.clientY ?? 0) - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY ?? 0;
        this.crystalGroup.rotation.x += dy * 0.01;
        this.crystalGroup.rotation.y += dx * 0.01;
        this.labelGroup.rotation.copy(this.crystalGroup.rotation);
        this.rotationY = this.crystalGroup.rotation.y;
        this.renderFrame();
    }

    private onPointerUp(): void {
        this.isDragging = false;
    }

    private onCanvasClick(e: PointerEvent): void {
        if (!this.mesh || !this.triangleFaces || !this.currentGeometry) return;
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        const ndc = new Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        this.raycaster.setFromCamera(ndc, this.camera);
        const intersects = this.raycaster.intersectObject(this.mesh);
        if (intersects.length === 0) {
            this.selectedFaceIndex = null;
            this.clearHighlight();
            this.dispatchEvent(new CustomEvent("face-selected", { detail: { faceIndex: null } }));
        } else {
            const triIndex = intersects[0]!.faceIndex!;
            const faceIndex = this.triangleFaces[triIndex]!;
            this.selectedFaceIndex = faceIndex;
            this.updateHighlight([faceIndex]);
            const info = this.faceInfo(faceIndex);
            this.dispatchEvent(new CustomEvent("face-selected", { detail: { faceIndex, ...info } }));
        }
        if (this.animationHandle === null) {
            this.renderFrame();
        }
    }

    private faceInfo(faceIndex: number): FaceInfo | null {
        if (!this.currentGeometry) return null;
        const face = this.currentGeometry.faces[faceIndex];
        if (!face) return null;
        return {
            faceIndex,
            normal: [face.normal[0], face.normal[1], face.normal[2]],
            contributors: face.contributors.map((c) => ({
                formId: c.formId,
                indices: c.indices
                    ? c.indices.notation === "miller-bravais"
                        ? { notation: "miller-bravais", h: c.indices.h, k: c.indices.k, i: c.indices.i, l: c.indices.l }
                        : { notation: "miller", h: c.indices.h, k: c.indices.k, l: c.indices.l }
                    : { notation: "miller", h: 0, k: 0, l: 0 },
                operationIds: c.operationIds,
            })),
            ...(face.symmetryGroup ? { symmetryGroup: face.symmetryGroup } : {}),
        };
    }

    private assertNotDisposed(): void {
        if (this.disposed) throw new ViewerOperationError([{ code: "viewer.lifecycle.disposed", severity: "error", message: "Viewer is disposed." }]);
    }

    private assertForm(id: string): void {
        if (!this.getForms().some((form) => form.id === id)) throw new ViewerOperationError([{ code: "viewer.request.unknown-form", severity: "error", message: `Unknown form "${id}".`, formIds: [id] }]);
    }
}
