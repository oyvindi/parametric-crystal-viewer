import { Scene, PerspectiveCamera, WebGLRenderer, MeshStandardMaterial, Mesh, Color, DirectionalLight, AmbientLight, Group, DoubleSide, type BufferGeometry } from "three";
import { generateCrystal, type Diagnostic, type GeometryResult } from "@crystal/core";
import { getMineral, createCrystalInput, resolveHabit, type Mineral } from "@crystal/data";
import { createThreeGeometry } from "@crystal/three";

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

/** Provisional viewer API for M2. Exact signatures remain deferred to M7. */
export class CrystalViewer extends EventTarget {
    private readonly renderer: WebGLRenderer;
    private readonly scene: Scene;
    private readonly camera: PerspectiveCamera;
    private readonly crystalGroup: Group;
    private mesh: Mesh<BufferGeometry, MeshStandardMaterial> | null = null;
    private mineral: Mineral | null = null;
    private habitId: string | undefined;
    private formDevelopment: Record<string, number> = {};
    private formEnabled: Record<string, boolean> = {};
    private lastValidGeometry: GeometryResult | null = null;
    private currentResult: GeometryResult | null = null;
    private disposed = false;
    private animationHandle: number | null = null;
    private rotationY = 0;
    private readonly rotationSpeed = 0.005;
    private isDragging = false;
    private lastMouseX = 0;
    private readonly onPointerDownBound: (e: PointerEvent) => void;
    private readonly onPointerMoveBound: (e: PointerEvent) => void;
    private readonly onPointerUpBound: () => void;

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
        canvas.addEventListener("pointerdown", this.onPointerDownBound);
        canvas.addEventListener("pointermove", this.onPointerMoveBound);
        canvas.addEventListener("pointerup", this.onPointerUpBound);
        canvas.addEventListener("pointerleave", this.onPointerUpBound);
    }

    /** Loads a mineral from the catalog and generates initial geometry. */
    loadMineral(id: string): void {
        this.assertNotDisposed();
        const mineral = getMineral(id);
        if (!mineral) throw new Error(`Unknown mineral "${id}".`);
        this.mineral = mineral;
        this.habitId = undefined;
        this.formDevelopment = {};
        this.formEnabled = {};
        this.lastValidGeometry = null;
        this.clearMesh();
        this.regenerate();
    }

    /** Selects a habit preset, resetting form overrides. */
    setHabit(habitId: string): void {
        this.assertNotDisposed();
        if (!this.mineral) throw new Error("No mineral loaded.");
        resolveHabit(this.mineral, habitId);
        this.habitId = habitId;
        this.formDevelopment = {};
        this.formEnabled = {};
        this.regenerate();
    }

    /** Sets the development value for a form, regenerating geometry. */
    setFormDevelopment(formId: string, value: number): void {
        this.assertNotDisposed();
        if (!this.mineral) throw new Error("No mineral loaded.");
        this.formDevelopment[formId] = value;
        if (!this.formEnabled[formId]) this.formEnabled[formId] = true;
        this.regenerate();
    }

    /** Returns the current forms with their effective development and enabled state. */
    getForms(): FormInfo[] {
        if (!this.mineral) return [];
        const habit = resolveHabit(this.mineral, this.habitId);
        return habit.forms.map((form) => {
            const dev = this.formDevelopment[form.id] ?? form.development;
            const en = this.formEnabled[form.id] ?? form.enabled ?? true;
            return { id: form.id, label: form.label ?? form.id, development: dev, enabled: en };
        });
    }

    /** Returns the habits available for the loaded mineral. */
    getHabits(): HabitInfo[] {
        if (!this.mineral) return [];
        return this.mineral.habits.map((h) => ({ id: h.id, name: h.name }));
    }

    /** Returns the current geometry status, diagnostics, and stale-mesh flag. */
    getGeometryStatus(): { status: GeometryStatus; diagnostics: readonly Diagnostic[]; stale: boolean } {
        const result = this.currentResult;
        if (!result) return { status: "invalid", diagnostics: [], stale: false };
        return {
            status: result.status,
            diagnostics: result.diagnostics,
            stale: result.status === "invalid" && this.lastValidGeometry !== null,
        };
    }

    /** Returns the currently loaded mineral ID, or null. */
    getMineralId(): string | null {
        return this.mineral?.id ?? null;
    }

    /** Returns the currently selected habit ID, or null. */
    getHabitId(): string | null {
        if (!this.mineral) return null;
        return this.habitId ?? this.mineral.habits[0]?.id ?? null;
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

    start(): void {
        this.assertNotDisposed();
        if (this.animationHandle !== null) return;
        const loop = () => {
            if (this.disposed) return;
            this.rotationY += this.rotationSpeed;
            this.crystalGroup.rotation.y = this.rotationY;
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
        this.renderer.dispose();
    }

    private regenerate(): void {
        if (!this.mineral) return;
        const input = createCrystalInput(this.mineral, {
            habitId: this.habitId,
            formDevelopment: this.formDevelopment,
            formEnabled: this.formEnabled,
        });
        const result = generateCrystal(input.crystallography, input.morphology);
        this.currentResult = result;
        if (result.status === "valid") {
            this.lastValidGeometry = result;
            this.updateMesh(result);
            this.dispatchEvent(new CustomEvent("geometry-changed", { detail: { status: "valid" } }));
        } else {
            this.dispatchEvent(new CustomEvent("geometry-invalid", { detail: { diagnostics: result.diagnostics } }));
        }
    }

    private updateMesh(result: Extract<GeometryResult, { status: "valid" }>): void {
        this.clearMesh();
        const geometry = createThreeGeometry(result.geometry);
        geometry.center();
        const material = new MeshStandardMaterial({
            color: 0x6fb7d4,
            metalness: 0.1,
            roughness: 0.3,
            side: DoubleSide,
        });
        this.mesh = new Mesh(geometry, material);
        this.crystalGroup.add(this.mesh);
        this.frameCamera(result.geometry.bounds.min, result.geometry.bounds.max);
    }

    private clearMesh(): void {
        if (this.mesh) {
            this.crystalGroup.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
    }

    private frameCamera(min: readonly number[], max: readonly number[]): void {
        const size = Math.max(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!);
        const distance = size * 2.5 || 10;
        this.camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
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
        this.renderer.render(this.scene, this.camera);
    }

    private onPointerUp(): void {
        this.isDragging = false;
    }

    private assertNotDisposed(): void {
        if (this.disposed) throw new Error("Viewer is disposed.");
    }
}
