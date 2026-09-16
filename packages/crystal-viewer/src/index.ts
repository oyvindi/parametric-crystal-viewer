import { Scene, PerspectiveCamera, WebGLRenderer, MeshStandardMaterial, Mesh, MeshBasicMaterial, Color, DirectionalLight, AmbientLight, Group, DoubleSide, Raycaster, Vector2, Sprite, SpriteMaterial, CanvasTexture, BufferGeometry } from "three";
import { generateCrystal, type Diagnostic, type GeometryResult, type CrystalGeometry, type CrystalFace } from "@crystal/core";
import { loadMineral as loadMineralData, createCrystalInput, resolveHabit, resolveCrystallography, MineralDataError, type Mineral } from "@crystal/data";
import { createThreeGeometryWithPicking } from "@crystal/three";
import { cameraBasis } from "./camera.js";

export class ViewerOperationError extends Error {
    constructor(readonly diagnostics: readonly Diagnostic[]) {
        super(diagnostics.map((d) => d.message).join(" "));
        this.name = "ViewerOperationError";
    }
}

export type GeometryStatus = "valid" | "invalid";

export interface FormInfo {
    readonly id: string;
    readonly label: string;
    readonly development: number;
    readonly enabled: boolean;
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

/** Provisional viewer API for M4. Exact signatures remain deferred to M7. */
export class CrystalViewer extends EventTarget {
    private readonly renderer: WebGLRenderer;
    private readonly scene: Scene;
    private readonly camera: PerspectiveCamera;
    private readonly crystalGroup: Group;
    private readonly labelGroup: Group;
    private mesh: Mesh<BufferGeometry, MeshStandardMaterial> | null = null;
    private highlightMesh: Mesh<BufferGeometry, MeshBasicMaterial> | null = null;
    private mineral: Mineral | null = null;
    private habitId: string | undefined;
    private variantId: string | undefined;
    private formDevelopment: Record<string, number> = {};
    private formEnabled: Record<string, boolean> = {};
    private lastValidGeometry: GeometryResult | null = null;
    private currentResult: GeometryResult | null = null;
    private currentGeometry: CrystalGeometry | null = null;
    private triangleFaces: Uint32Array | null = null;
    private disposed = false;
    private needsInitialFrame = true;
    private animationHandle: number | null = null;
    private rotationY = 0;
    private readonly rotationSpeed = 0.005;
    private isDragging = false;
    private lastMouseX = 0;
    private showLabels = false;
    private selectedFaceIndex: number | null = null;
    private readonly raycaster = new Raycaster();
    private readonly onPointerDownBound: (e: PointerEvent) => void;
    private readonly onPointerMoveBound: (e: PointerEvent) => void;
    private readonly onPointerUpBound: (e: PointerEvent) => void;
    private readonly onClickBound: (e: PointerEvent) => void;

    constructor(canvas: HTMLCanvasElement) {
        super();
        this.renderer = new WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.clientWidth || 400, canvas.clientHeight || 300);
        this.scene = new Scene();
        this.scene.background = new Color(0x222222);
        this.camera = new PerspectiveCamera(45, 1, 0.01, 1000);
        this.camera.position.set(8, 6, 8);
        this.camera.lookAt(0, 0, 0);
        this.crystalGroup = new Group();
        this.scene.add(this.crystalGroup);
        this.labelGroup = new Group();
        this.labelGroup.visible = false;
        this.scene.add(this.labelGroup);
        this.scene.add(new AmbientLight(0xffffff, 0.5));
        const dir = new DirectionalLight(0xffffff, 0.8);
        dir.position.set(5, 10, 7);
        this.scene.add(dir);
        const fill = new DirectionalLight(0xffffff, 0.3);
        fill.position.set(-5, -3, -5);
        this.scene.add(fill);
        this.onPointerDownBound = this.onPointerDown.bind(this);
        this.onPointerMoveBound = this.onPointerMove.bind(this);
        this.onPointerUpBound = this.onPointerUp.bind(this);
        this.onClickBound = this.onCanvasClick.bind(this);
        canvas.addEventListener("pointerdown", this.onPointerDownBound);
        canvas.addEventListener("pointermove", this.onPointerMoveBound);
        canvas.addEventListener("pointerup", this.onPointerUpBound);
        canvas.addEventListener("pointerleave", this.onPointerUpBound);
        canvas.addEventListener("click", this.onClickBound);
    }

    /** Accepts a bundled ID or a caller-supplied record; rejects before committing. */
    loadMineral(source: unknown): void {
        this.assertNotDisposed();
        let mineral: Mineral;
        try {
            mineral = loadMineralData(source);
        } catch (error) {
            if (!(error instanceof MineralDataError)) throw error;
            const diagnostics: Diagnostic[] = [{ code: "viewer.load.invalid-mineral", severity: "error", message: "Mineral loading failed; the previous definition is unchanged." }, ...error.diagnostics];
            this.dispatchEvent(new CustomEvent("mineral-load-failed", { detail: { diagnostics } }));
            throw new ViewerOperationError(diagnostics);
        }
        this.mineral = mineral;
        this.habitId = undefined;
        this.variantId = undefined;
        this.formDevelopment = {};
        this.formEnabled = {};
        this.lastValidGeometry = null;
        this.needsInitialFrame = true;
        this.selectedFaceIndex = null;
        this.clearMesh();
        this.clearLabels();
        this.regenerate();
        this.dispatchEvent(new CustomEvent("mineral-loaded", { detail: { mineralId: mineral.id, dataRevision: mineral.dataRevision } }));
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
    }

    setVariant(variantId: string): void {
        this.assertNotDisposed();
        if (!this.mineral) throw new Error("No mineral loaded.");
        resolveCrystallography(this.mineral, variantId);
        this.variantId = variantId;
        this.selectedFaceIndex = null;
        this.regenerate();
    }

    setFormDevelopment(formId: string, value: number): void {
        this.assertNotDisposed();
        if (!this.mineral) throw new Error("No mineral loaded.");
        this.assertForm(formId);
        this.formDevelopment[formId] = value;
        if (!this.formEnabled[formId]) this.formEnabled[formId] = true;
        this.regenerate();
    }

    setFormEnabled(formId: string, enabled: boolean): void {
        this.assertNotDisposed();
        if (!this.mineral) throw new Error("No mineral loaded.");
        this.assertForm(formId);
        this.formEnabled[formId] = enabled;
        this.regenerate();
    }

    getForms(): FormInfo[] {
        if (!this.mineral) return [];
        const habit = resolveHabit(this.mineral, this.habitId);
        return habit.forms.map((form) => {
            const dev = this.formDevelopment[form.id] ?? form.development;
            const en = this.formEnabled[form.id] ?? form.enabled ?? true;
            return { id: form.id, label: form.label ?? form.id, development: dev, enabled: en };
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

    /** Returns face indices that share a form with the given face index (equivalent faces). */
    getEquivalentFaces(faceIndex: number): number[] {
        if (!this.currentGeometry) return [];
        const face = this.currentGeometry.faces[faceIndex];
        if (!face) return [];
        const formIds = new Set(face.contributors.map((c) => c.formId));
        return this.currentGeometry.faces
            .map((f, i) => ({ f, i }))
            .filter(({ f }) => f.contributors.some((c) => formIds.has(c.formId)))
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

    /** Highlights all symmetry-equivalent faces sharing a form with the given face. */
    highlightEquivalentFaces(faceIndex: number): void {
        this.assertNotDisposed();
        if (!this.currentGeometry || !this.currentGeometry.faces[faceIndex]) return;
        this.selectedFaceIndex = faceIndex;
        const equivalent = this.getEquivalentFaces(faceIndex);
        this.updateHighlight(equivalent);
        const info = this.faceInfo(faceIndex);
        this.dispatchEvent(new CustomEvent("face-selected", { detail: { faceIndex, equivalentFaces: equivalent, ...info } }));
    }

    showFaceLabels(show: boolean): void {
        this.assertNotDisposed();
        this.showLabels = show;
        this.labelGroup.visible = show;
        this.renderer.render(this.scene, this.camera);
    }

    resize(width: number, height: number): void {
        this.assertNotDisposed();
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    render(): void {
        this.assertNotDisposed();
        this.renderer.render(this.scene, this.camera);
    }

    /** Apply the current habit's preferred view to the displayed geometry. */
    resetCamera(): void {
        this.assertNotDisposed();
        if (this.lastValidGeometry?.status !== "valid") return;
        const { bounds } = this.lastValidGeometry.geometry;
        this.frameCamera(bounds.min, bounds.max);
        this.renderer.render(this.scene, this.camera);
    }

    start(): void {
        this.assertNotDisposed();
        if (this.animationHandle !== null) return;
        const loop = () => {
            if (this.disposed) return;
            this.rotationY += this.rotationSpeed;
            this.crystalGroup.rotation.y = this.rotationY;
            this.labelGroup.rotation.y = this.rotationY;
            this.renderer.render(this.scene, this.camera);
            this.animationHandle = requestAnimationFrame(loop);
        };
        this.animationHandle = requestAnimationFrame(loop);
    }

    stop(): void {
        if (this.animationHandle !== null) {
            cancelAnimationFrame(this.animationHandle);
            this.animationHandle = null;
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.stop();
        this.clearMesh();
        this.clearLabels();
        this.renderer.dispose();
    }

    private regenerate(): void {
        if (!this.mineral) return;
        const input = createCrystalInput(this.mineral, {
            habitId: this.habitId,
            variantId: this.variantId,
            formDevelopment: this.formDevelopment,
            formEnabled: this.formEnabled,
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
        if (this.animationHandle === null) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    private updateMesh(result: Extract<GeometryResult, { status: "valid" }>): void {
        this.clearMesh();
        this.clearLabels();
        const { buffer, triangleFaces } = createThreeGeometryWithPicking(result.geometry);
        this.triangleFaces = triangleFaces;
        buffer.center();
        const material = new MeshStandardMaterial({
            color: 0x6fb7d4,
            metalness: 0.1,
            roughness: 0.3,
            side: DoubleSide,
            flatShading: true,
        });
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
        this.camera.lookAt(0, 0, 0);
        this.camera.near = distance / 100;
        this.camera.far = distance * 100;
        this.camera.updateProjectionMatrix();
    }

    private onPointerDown(e: PointerEvent): void {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.stop();
    }

    private onPointerMove(e: PointerEvent): void {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastMouseX;
        this.lastMouseX = e.clientX;
        this.crystalGroup.rotation.y += dx * 0.01;
        this.labelGroup.rotation.y = this.crystalGroup.rotation.y;
        this.renderer.render(this.scene, this.camera);
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
            this.renderer.render(this.scene, this.camera);
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
