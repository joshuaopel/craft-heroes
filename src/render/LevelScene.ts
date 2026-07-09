import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  ClassDefinition,
  ClassId,
  EnvironmentMaterialDefinition,
  EnvironmentSurfaceEffect,
  EnvironmentSettings,
  LevelData,
  ObstacleData,
  PropDefinition,
  PropDefinitionId,
  SectionName,
  SurroundingPropData,
  TileCoord,
  UnitData
} from "../game/schema";

const tileSize = 1.08;
const heightStep = 0.28;
const baseTileHeight = 0.18;
const maxGrassVoxels = 2200;
const sectionNames: SectionName[] = ["head", "body", "legs"];
const dirOrder = ["S", "E", "N", "W"];

const sectionSpecs: Record<SectionName, { height: number; width: number }> = {
  legs: { height: 0.54, width: 0.62 },
  body: { height: 0.62, width: 0.72 },
  head: { height: 0.54, width: 0.62 }
};

const fallbackEnvironment: EnvironmentSettings = {
  skyColor: "#7bb6c5",
  fogColor: "#7bb6c5",
  groundColor: "#526553",
  groundTextureUrl: "",
  ambientIntensity: 1.2,
  sunIntensity: 2,
  backgroundModel: {
    modelUrl: "",
    modelFileName: "",
    fitToMap: true,
    scale: 1,
    rotation: 0,
    offsetY: 0
  }
};

const fallbackMaterial: EnvironmentMaterialDefinition = {
  id: "grass",
  name: "Grass",
  surfaceEffect: "grass",
  grassDensity: 6,
  topColor: "#8fc265",
  sideColor: "#5c6f48",
  sideCapColor: "#6f8f45",
  sideFullColor: "#6b4f35",
  sideHalfColor: "#4f3d2c",
  topImageUrl: "",
  sideImageUrl: "",
  sideCapImageUrl: "",
  sideFullImageUrl: "",
  sideHalfImageUrl: "",
  topRule: "Fallback playable ground.",
  sideRule: "Fallback exposed block side.",
  movementCost: 1,
  blocksLineOfSight: false
};

const fallbackProp: PropDefinition = {
  id: "wall",
  name: "Wall",
  role: "blocker",
  assetKind: "box",
  windEffect: false,
  color: "#6c716a",
  textureUrl: "",
  modelUrl: "",
  modelFileName: "",
  fitModelToTile: true,
  width: 0.75,
  height: 0.9,
  depth: 0.75,
  blocksMovement: true,
  blocksLineOfSight: true,
  coverBonus: 2,
  notes: []
};

type ClickHandler = (coord: TileCoord) => void;
type SetLevelOptions = {
  frame?: boolean;
};
type TerrainMaterialSet = {
  top: THREE.Material;
  sideCap: THREE.MeshStandardMaterial;
  sideFull: THREE.MeshStandardMaterial;
  sideHalf: THREE.MeshStandardMaterial;
};
const topUvRotations = [Math.PI / 2, -Math.PI / 2, Math.PI] as const;

export class LevelScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  private readonly controls: OrbitControls;
  private readonly root = new THREE.Group();
  private readonly hemiLight = new THREE.HemisphereLight("#e6fff2", "#405246", 1.2);
  private readonly sunLight = new THREE.DirectionalLight("#fff0ce", 2);
  private readonly fillLight = new THREE.DirectionalLight("#89d7ff", 0.65);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly clickable: THREE.Object3D[] = [];
  private readonly clock = new THREE.Clock();
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly gltfLoader = new GLTFLoader();
  private readonly glbCache = new Map<string, Promise<THREE.Group>>();
  private readonly waterMaterials = new Set<THREE.ShaderMaterial>();
  private readonly windMaterials = new Set<THREE.ShaderMaterial>();
  private readonly windObjects = new Set<THREE.Object3D>();
  private classDefinitions: ClassDefinition[] = [];
  private environmentMaterials: EnvironmentMaterialDefinition[] = [];
  private propDefinitions: PropDefinition[] = [];
  private classMaterials: Record<SectionName, Record<ClassId, THREE.MeshStandardMaterial>> = {
    head: {},
    body: {},
    legs: {}
  };
  private terrainMaterials: Record<string, TerrainMaterialSet> = {};
  private propMaterials: Record<PropDefinitionId, THREE.Material> = {};
  private level?: LevelData;
  private selected?: TileCoord;
  private mode: "editor" | "play" = "editor";
  private clickHandler?: ClickHandler;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    classDefinitions: ClassDefinition[] = [],
    environmentMaterials: EnvironmentMaterialDefinition[] = [],
    propDefinitions: PropDefinition[] = []
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color("#7bb6c5");
    this.scene.fog = new THREE.Fog("#7bb6c5", 13, 28);
    this.scene.add(this.root);
    this.scene.add(this.hemiLight);

    this.sunLight.position.set(-5, 8, 6);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(this.sunLight);

    this.fillLight.position.set(6, 4, -5);
    this.scene.add(this.fillLight);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI * 0.44;

    this.setClassDefinitions(classDefinitions);
    this.setEnvironmentMaterials(environmentMaterials);
    this.setPropDefinitions(propDefinitions);
    this.canvas.addEventListener("click", (event) => this.pick(event));
    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.animate();
  }

  onTileClick(handler: ClickHandler): void {
    this.clickHandler = handler;
  }

  setMode(mode: "editor" | "play"): void {
    this.mode = mode;
    this.renderLevel();
  }

  setInteractionEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
  }

  setSelected(coord?: TileCoord): void {
    this.selected = coord;
    this.renderLevel();
  }

  setLevel(level: LevelData, options: SetLevelOptions = {}): void {
    const shouldFrame = options.frame ?? (!this.level || this.level.id !== level.id);
    this.level = level;
    if (shouldFrame) {
      this.frameCamera(level);
    }
    this.renderLevel();
  }

  setClassDefinitions(classDefinitions: ClassDefinition[]): void {
    const previousMaterials = this.collectClassMaterials();
    this.classDefinitions = structuredClone(classDefinitions);
    this.classMaterials = this.createClassMaterials(this.classDefinitions);
    this.renderLevel();
    for (const material of previousMaterials) {
      this.disposeMaterial(material);
    }
  }

  setEnvironmentMaterials(environmentMaterials: EnvironmentMaterialDefinition[]): void {
    const previousMaterials = this.collectTerrainMaterials();
    this.environmentMaterials = structuredClone(environmentMaterials.length ? environmentMaterials : [fallbackMaterial]);
    this.terrainMaterials = this.createTerrainMaterials(this.environmentMaterials);
    this.renderLevel();
    for (const material of previousMaterials) {
      this.disposeMaterial(material);
    }
  }

  setPropDefinitions(propDefinitions: PropDefinition[]): void {
    const previousMaterials = this.collectPropMaterials();
    this.propDefinitions = structuredClone(propDefinitions.length ? propDefinitions : [fallbackProp]);
    this.glbCache.clear();
    this.propMaterials = this.createPropMaterials(this.propDefinitions);
    this.renderLevel();
    for (const material of previousMaterials) {
      this.disposeMaterial(material);
    }
  }

  frameCurrentLevel(): void {
    if (this.level) {
      this.frameCamera(this.level);
    }
  }

  dispose(): void {
    this.renderer.dispose();
  }

  private createClassMaterials(classDefinitions: ClassDefinition[]): Record<SectionName, Record<ClassId, THREE.MeshStandardMaterial>> {
    const materials: Record<SectionName, Record<ClassId, THREE.MeshStandardMaterial>> = {
      head: {},
      body: {},
      legs: {}
    };
    for (const section of sectionNames) {
      for (const classDefinition of classDefinitions) {
        materials[section][classDefinition.id] = this.createSectionMaterial(classDefinition, section);
      }
    }
    return materials;
  }

  private createTerrainMaterials(environmentMaterials: EnvironmentMaterialDefinition[]): Record<string, TerrainMaterialSet> {
    const materials: Record<string, TerrainMaterialSet> = {};
    for (const definition of environmentMaterials) {
      const surfaceEffect = this.resolveSurfaceEffect(definition);
      materials[definition.id] = {
        top:
          surfaceEffect === "water"
            ? this.createWaterMaterial(definition)
            : this.createMappedMaterial(definition.topColor, definition.topImageUrl, 0.72),
        sideCap: this.createMappedMaterial(definition.sideCapColor || definition.sideColor, definition.sideCapImageUrl || definition.sideImageUrl, 0.86),
        sideFull: this.createMappedMaterial(definition.sideFullColor || definition.sideColor, definition.sideFullImageUrl || definition.sideImageUrl, 0.88),
        sideHalf: this.createMappedMaterial(definition.sideHalfColor || definition.sideColor, definition.sideHalfImageUrl || definition.sideImageUrl, 0.9)
      };
    }
    return materials;
  }

  private createPropMaterials(propDefinitions: PropDefinition[]): Record<PropDefinitionId, THREE.Material> {
    const materials: Record<PropDefinitionId, THREE.Material> = {};
    for (const definition of propDefinitions) {
      materials[definition.id] = this.createMappedMaterial(definition.color, definition.textureUrl, 0.82);
    }
    return materials;
  }

  private createWaterMaterial(definition: EnvironmentMaterialDefinition): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uShallowColor: { value: new THREE.Color(definition.topColor || "#5198ba") },
        uDeepColor: { value: new THREE.Color(definition.sideFullColor || definition.sideColor || "#1f5366") },
        uMurkColor: { value: new THREE.Color("#14343a") }
      },
      vertexShader: `
        attribute float aDepth;
        varying vec2 vUv;
        varying float vDepth;

        void main() {
          vUv = uv;
          vDepth = aDepth;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uShallowColor;
        uniform vec3 uDeepColor;
        uniform vec3 uMurkColor;
        varying vec2 vUv;
        varying float vDepth;

        float softStripe(vec2 uv, float speed, float scale) {
          float lineA = sin((uv.x + uv.y * 0.42) * scale + uTime * speed);
          float lineB = sin((uv.y - uv.x * 0.28) * (scale * 0.72) - uTime * speed * 0.64);
          return smoothstep(0.38, 1.0, lineA * 0.5 + lineB * 0.5);
        }

        void main() {
          float depth = clamp(vDepth / 4.0, 0.0, 1.0);
          vec2 warpedUv = vUv + vec2(
            sin(vUv.y * 7.0 + uTime * 0.18),
            cos(vUv.x * 6.0 - uTime * 0.14)
          ) * 0.018;
          float murk = softStripe(warpedUv, 0.16, 14.0);
          float darkPocket = smoothstep(0.2, 0.9, sin((warpedUv.x * 17.0 + warpedUv.y * 9.0) + uTime * 0.08) * 0.5 + 0.5);
          vec3 color = mix(uShallowColor, uDeepColor, depth);
          color = mix(color, uMurkColor, (murk * 0.18 + darkPocket * 0.1) * (0.45 + depth));
          color += vec3(0.08, 0.15, 0.13) * softStripe(warpedUv + 0.21, 0.11, 23.0) * (1.0 - depth * 0.35);
          float edgeFade = smoothstep(0.0, 0.18, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
          float alpha = mix(0.5, 0.72, depth) * mix(0.7, 1.0, edgeFade);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.waterMaterials.add(material);
    return material;
  }

  private createMappedMaterial(color: string, imageUrl: string, roughness: number): THREE.MeshStandardMaterial {
    if (!imageUrl) {
      return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
    }
    const texture = this.textureLoader.load(imageUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: texture,
      roughness,
      metalness: 0.02
    });
  }

  private createSectionMaterial(classDefinition: ClassDefinition, section: SectionName): THREE.MeshStandardMaterial {
    const imageUrl = classDefinition.sections[section]?.imageUrl;
    if (!imageUrl) {
      return new THREE.MeshStandardMaterial({
        color: classDefinition.color || "#f4f0db",
        roughness: 0.66,
        metalness: 0.02
      });
    }
    const texture = this.textureLoader.load(imageUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: texture,
      roughness: 0.66,
      metalness: 0.02
    });
  }

  private collectClassMaterials(): THREE.MeshStandardMaterial[] {
    return sectionNames.flatMap((section) => Object.values(this.classMaterials[section]));
  }

  private collectTerrainMaterials(): THREE.Material[] {
    return Object.values(this.terrainMaterials).flatMap((materialSet) => [
      materialSet.top,
      materialSet.sideCap,
      materialSet.sideFull,
      materialSet.sideHalf
    ]);
  }

  private collectPropMaterials(): THREE.Material[] {
    return Object.values(this.propMaterials);
  }

  private terrainMaterialFor(materialId: string): TerrainMaterialSet {
    const existing = this.terrainMaterials[materialId];
    if (existing) {
      return existing;
    }
    const definition = this.environmentMaterials.find((material) => material.id === materialId) ?? fallbackMaterial;
    const surfaceEffect = this.resolveSurfaceEffect(definition);
    const fallback = {
      top:
        surfaceEffect === "water"
          ? this.createWaterMaterial(definition)
          : this.createMappedMaterial(definition.topColor, definition.topImageUrl, 0.72),
      sideCap: this.createMappedMaterial(definition.sideCapColor || definition.sideColor, definition.sideCapImageUrl || definition.sideImageUrl, 0.86),
      sideFull: this.createMappedMaterial(definition.sideFullColor || definition.sideColor, definition.sideFullImageUrl || definition.sideImageUrl, 0.88),
      sideHalf: this.createMappedMaterial(definition.sideHalfColor || definition.sideColor, definition.sideHalfImageUrl || definition.sideImageUrl, 0.9)
    };
    this.terrainMaterials[materialId] = fallback;
    return fallback;
  }

  private propDefinitionFor(propId: PropDefinitionId): PropDefinition {
    return this.propDefinitions.find((propDefinition) => propDefinition.id === propId) ?? fallbackProp;
  }

  private materialDefinitionFor(materialId: string): EnvironmentMaterialDefinition {
    return this.environmentMaterials.find((material) => material.id === materialId) ?? fallbackMaterial;
  }

  private resolveSurfaceEffect(definition: Partial<EnvironmentMaterialDefinition>): EnvironmentSurfaceEffect {
    if (definition.surfaceEffect === "grass" || definition.surfaceEffect === "water" || definition.surfaceEffect === "solid") {
      return definition.surfaceEffect;
    }
    const id = String(definition.id ?? "").toLowerCase();
    if (id.includes("water")) {
      return "water";
    }
    if (id.includes("grass") || id.includes("foliage")) {
      return "grass";
    }
    return "solid";
  }

  private surfaceEffectFor(materialId: string): EnvironmentSurfaceEffect {
    return this.resolveSurfaceEffect(this.materialDefinitionFor(materialId));
  }

  private propMaterialFor(propId: PropDefinitionId): THREE.Material {
    const existing = this.propMaterials[propId];
    if (existing) {
      return existing;
    }
    const definition = this.propDefinitionFor(propId);
    const fallback = this.createMappedMaterial(definition.color, definition.textureUrl, 0.82);
    this.propMaterials[propId] = fallback;
    return fallback;
  }

  private materialFor(section: SectionName, classId: ClassId): THREE.MeshStandardMaterial {
    const existing = this.classMaterials[section][classId];
    if (existing) {
      return existing;
    }
    const definition = this.classDefinitions.find((classDefinition) => classDefinition.id === classId);
    const fallback = definition
      ? this.createSectionMaterial(definition, section)
      : new THREE.MeshStandardMaterial({ color: "#f4f0db", roughness: 0.72, metalness: 0.02 });
    this.classMaterials[section][classId] = fallback;
    return fallback;
  }

  private renderLevel(): void {
    this.clearRoot();
    this.clickable.length = 0;
    if (!this.level) {
      return;
    }

    this.applyEnvironment(this.level.environment);
    this.addGroundSurface(this.level);
    this.addBackgroundModel(this.level);
    this.addTerrain(this.level);
    this.addWaterSeaweed(this.level);
    this.addGrassVoxels(this.level);
    for (const obstacle of this.level.obstacles) {
      this.addObstacle(this.level, obstacle);
    }
    for (const prop of this.level.surroundings ?? []) {
      this.addSurroundingProp(this.level, prop);
    }
    for (const unit of this.level.units) {
      this.addUnit(this.level, unit);
    }
    if (this.selected) {
      this.addHighlight(this.selected, this.mode === "editor" ? "#60d7e4" : "#f2bd55");
    }
  }

  private clearRoot(): void {
    this.windObjects.clear();
    while (this.root.children.length > 0) {
      const child = this.root.children.pop();
      if (child) {
        this.disposeObject(child);
      }
    }
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const item of material) {
          if (!this.isSharedMaterial(item)) {
            this.disposeMaterial(item);
          }
        }
      } else if (material && !this.isSharedMaterial(material)) {
        this.disposeMaterial(material);
      }
    });
  }

  private isSharedMaterial(material: THREE.Material): boolean {
    return (
      Object.values(this.classMaterials).some((section) => Object.values(section).includes(material as THREE.MeshStandardMaterial)) ||
      this.collectTerrainMaterials().includes(material) ||
      this.collectPropMaterials().includes(material)
    );
  }

  private disposeMaterial(material: THREE.Material): void {
    const mappedMaterial = material as THREE.MeshStandardMaterial;
    if (material instanceof THREE.ShaderMaterial) {
      this.waterMaterials.delete(material);
      this.windMaterials.delete(material);
    }
    mappedMaterial.map?.dispose();
    material.dispose();
  }

  private applyEnvironment(environment: EnvironmentSettings | undefined): void {
    const resolved = { ...fallbackEnvironment, ...(environment ?? {}) };
    this.scene.background = new THREE.Color(resolved.skyColor);
    this.scene.fog = new THREE.Fog(resolved.fogColor, 13, 32);
    this.hemiLight.intensity = resolved.ambientIntensity;
    this.sunLight.intensity = resolved.sunIntensity;
    this.fillLight.intensity = resolved.sunIntensity * 0.32;
  }

  private createGroundMaterial(environment: EnvironmentSettings | undefined): THREE.MeshStandardMaterial {
    const resolved = { ...fallbackEnvironment, ...(environment ?? {}) };
    if (!resolved.groundTextureUrl) {
      return new THREE.MeshStandardMaterial({ color: resolved.groundColor, roughness: 0.92 });
    }
    const texture = this.textureLoader.load(resolved.groundTextureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    return new THREE.MeshStandardMaterial({ color: "#ffffff", map: texture, roughness: 0.92 });
  }

  private addGroundSurface(level: LevelData): void {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry((level.width + 8) * tileSize, (level.depth + 8) * tileSize),
      this.createGroundMaterial(level.environment)
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.035;
    mesh.receiveShadow = true;
    this.root.add(mesh);
  }

  private addBackgroundModel(level: LevelData): void {
    const settings = level.environment?.backgroundModel;
    if (!settings?.modelUrl) {
      return;
    }

    const anchor = new THREE.Group();
    anchor.rotation.y = settings.rotation || 0;
    anchor.position.y = settings.offsetY || 0;
    this.root.add(anchor);

    void this.loadGlb(`background:${settings.modelUrl}`, settings.modelUrl)
      .then((source) => {
        if (!anchor.parent) {
          return;
        }
        const instance = source.clone(true);
        this.cloneModelResources(instance);
        instance.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(instance);
        if (box.isEmpty()) {
          return;
        }
        const size = box.getSize(new THREE.Vector3());
        const authoredScale = Math.max(0.01, settings.scale || 1);
        if (settings.fitToMap) {
          const sourceSpan = Math.max(size.x, size.z, 0.001);
          const mapSpan = Math.max(level.width, level.depth) * tileSize * 1.8;
          instance.scale.multiplyScalar((mapSpan / sourceSpan) * authoredScale);
        } else {
          instance.scale.multiplyScalar(authoredScale);
        }
        instance.updateMatrixWorld(true);
        const fittedBox = new THREE.Box3().setFromObject(instance);
        const center = fittedBox.getCenter(new THREE.Vector3());
        instance.position.set(-center.x, -fittedBox.min.y, -center.z);
        instance.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        anchor.add(instance);
      })
      .catch((error) => {
        console.warn(`Unable to load background model "${settings.modelFileName || "GLB"}".`, error);
      });
  }

  private addTerrain(level: LevelData): void {
    for (let z = 0; z < level.depth; z += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const tile = level.tiles[z][x];
        const surfaceEffect = this.surfaceEffectFor(tile.terrain);
        const totalHeight = baseTileHeight + tile.height * heightStep;
        const terrainMaterials = this.terrainMaterialFor(tile.terrain);
        const group = new THREE.Group();
        const width = tileSize * 0.96;
        const depth = tileSize * 0.96;

        const topMesh = new THREE.Mesh(this.createTerrainTopGeometry(width, depth, tile.terrain, tile.height, x, z), terrainMaterials.top);
        topMesh.position.y = totalHeight + 0.002;
        topMesh.rotation.x = -Math.PI / 2;
        topMesh.renderOrder = surfaceEffect === "water" ? 4 : 0;
        topMesh.receiveShadow = true;
        group.add(topMesh);

        if (surfaceEffect === "water") {
          this.addWaterFloor(group, width, depth, terrainMaterials.sideFull);
        }

        this.addTerrainSideBand(group, width, depth, 0, baseTileHeight, terrainMaterials.sideHalf);
        for (let step = 0; step < tile.height; step += 1) {
          const material = step === tile.height - 1 ? terrainMaterials.sideCap : terrainMaterials.sideFull;
          this.addTerrainSideBand(group, width, depth, baseTileHeight + step * heightStep, heightStep, material);
        }

        group.position.copy(this.worldPosition(level, x, z, 0));
        group.userData = { x, z };
        group.traverse((child) => {
          child.userData = { x, z };
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.clickable.push(mesh);
          }
        });
        this.root.add(group);
      }
    }
  }

  private addWaterFloor(group: THREE.Group, width: number, depth: number, material: THREE.MeshStandardMaterial): void {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.position.y = baseTileHeight + 0.004;
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    group.add(mesh);
  }

  private addWaterSeaweed(level: LevelData): void {
    const positions: number[] = [];
    const anchors: number[] = [];
    const sways: number[] = [];
    const colors: number[] = [];

    for (let z = 0; z < level.depth; z += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const tile = level.tiles[z][x];
        if (this.surfaceEffectFor(tile.terrain) !== "water") {
          continue;
        }

        const center = this.worldPosition(level, x, z, 0);
        const topY = this.tileTopY(level, x, z) - 0.035;
        const availableHeight = Math.max(0.08, topY - 0.045);
        const bladeCount = 3 + (this.hashTile(`${tile.terrain}:seaweed-count`, x, z) % 4);
        for (let blade = 0; blade < bladeCount; blade += 1) {
          const seed = this.hashTile(`${tile.terrain}:seaweed:${blade}`, x, z);
          const offsetX = (this.random01(seed) - 0.5) * tileSize * 0.62;
          const offsetZ = (this.random01(seed + 17) - 0.5) * tileSize * 0.62;
          const height = Math.min(availableHeight, 0.11 + this.random01(seed + 37) * 0.18);
          const baseY = Math.max(0.035, topY - height - this.random01(seed + 53) * availableHeight * 0.2);
          const width = 0.035 + this.random01(seed + 71) * 0.035;
          const angle = this.random01(seed + 97) * Math.PI * 2;
          const rightX = Math.cos(angle) * width;
          const rightZ = Math.sin(angle) * width;
          const centerX = center.x + offsetX;
          const centerZ = center.z + offsetZ;
          const tipLean = (this.random01(seed + 113) - 0.5) * 0.06;

          this.pushRibbon(
            positions,
            anchors,
            sways,
            colors,
            "seaweed",
            new THREE.Vector3(centerX - rightX, baseY, centerZ - rightZ),
            new THREE.Vector3(centerX + rightX, baseY, centerZ + rightZ),
            new THREE.Vector3(centerX + tipLean, baseY + height, centerZ - tipLean * 0.6),
            new THREE.Vector3(centerX + tipLean + rightX * 0.45, baseY + height * 0.78, centerZ - tipLean * 0.6 + rightZ * 0.45),
            seed
          );
        }
      }
    }

    if (positions.length === 0) {
      return;
    }

    const mesh = new THREE.Mesh(this.createBladeGeometry(positions, anchors, sways, colors), this.createSwayBladeMaterial("seaweed"));
    mesh.renderOrder = 3;
    this.root.add(mesh);
  }

  private addGrassVoxels(level: LevelData): void {
    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const dummy = new THREE.Object3D();

    for (let z = 0; z < level.depth; z += 1) {
      for (let x = 0; x < level.width; x += 1) {
        if (matrices.length >= maxGrassVoxels || this.tileHasObstacle(level, x, z) || this.tileHasUnit(level, x, z)) {
          continue;
        }
        const tile = level.tiles[z][x];
        const material = this.materialDefinitionFor(tile.terrain);
        const grassDensity = material.grassDensity ?? (this.resolveSurfaceEffect(material) === "grass" ? fallbackMaterial.grassDensity : 0);
        if (this.resolveSurfaceEffect(material) !== "grass" || grassDensity <= 0) {
          continue;
        }

        const voxelCount = Math.min(Math.max(0, Math.round(grassDensity * 0.65)), maxGrassVoxels - matrices.length);
        const center = this.worldPosition(level, x, z, this.tileTopY(level, x, z) + 0.012);
        for (let voxel = 0; voxel < voxelCount; voxel += 1) {
          const seed = this.hashTile(`${tile.terrain}:grass:${voxel}`, x, z);
          const offsetX = (this.random01(seed) - 0.5) * tileSize * 0.72;
          const offsetZ = (this.random01(seed + 19) - 0.5) * tileSize * 0.72;
          const width = 0.035 + this.random01(seed + 41) * 0.045;
          const height = 0.03 + this.random01(seed + 67) * 0.065;
          const depth = 0.035 + this.random01(seed + 89) * 0.045;
          dummy.position.set(center.x + offsetX, center.y + height / 2, center.z + offsetZ);
          dummy.rotation.set(0, this.random01(seed + 107) * Math.PI * 2, 0);
          dummy.scale.set(width, height, depth);
          dummy.updateMatrix();
          matrices.push(dummy.matrix.clone());
          colors.push(this.bladeColor(seed, "grass"));
        }
      }
    }

    if (matrices.length === 0) {
      return;
    }

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const colorBase = Array.from({ length: geometry.getAttribute("position").count * 3 }, () => 1);
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colorBase, 3));
    const material = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      toneMapped: false,
      vertexColors: true
    });
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    for (let index = 0; index < matrices.length; index += 1) {
      mesh.setMatrixAt(index, matrices[index]);
      mesh.setColorAt(index, colors[index]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    this.root.add(mesh);
  }

  private pushTriangleBlade(
    positions: number[],
    anchors: number[],
    sways: number[],
    colors: number[],
    kind: "grass" | "seaweed",
    leftBase: THREE.Vector3,
    rightBase: THREE.Vector3,
    tip: THREE.Vector3,
    seed: number
  ): void {
    const color = this.bladeColor(seed, kind);
    for (const [point, anchor] of [
      [leftBase, 0],
      [rightBase, 0],
      [tip, 1]
    ] as const) {
      positions.push(point.x, point.y, point.z);
      anchors.push(anchor);
      sways.push(this.random01(seed + positions.length) * Math.PI * 2);
      colors.push(color.r, color.g, color.b);
    }
  }

  private pushRibbon(
    positions: number[],
    anchors: number[],
    sways: number[],
    colors: number[],
    kind: "grass" | "seaweed",
    leftBase: THREE.Vector3,
    rightBase: THREE.Vector3,
    tip: THREE.Vector3,
    shoulder: THREE.Vector3,
    seed: number
  ): void {
    this.pushTriangleBlade(positions, anchors, sways, colors, kind, leftBase, rightBase, tip, seed);
    this.pushTriangleBlade(positions, anchors, sways, colors, kind, rightBase, shoulder, tip, seed + 11);
  }

  private bladeColor(seed: number, kind: "grass" | "seaweed"): THREE.Color {
    const base = kind === "grass" ? "#79b95a" : "#173f35";
    const highlight = kind === "grass" ? "#b1dc70" : "#3f7654";
    return new THREE.Color(base).lerp(new THREE.Color(highlight), this.random01(seed + 131) * 0.85);
  }

  private createBladeGeometry(positions: number[], anchors: number[], sways: number[], colors: number[]): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aAnchor", new THREE.Float32BufferAttribute(anchors, 1));
    geometry.setAttribute("aSway", new THREE.Float32BufferAttribute(sways, 1));
    geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }

  private createSwayBladeMaterial(kind: "grass" | "seaweed"): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uStrength: { value: kind === "grass" ? 0.035 : 0.025 },
        uSpeed: { value: kind === "grass" ? 1.2 : 0.55 },
        uOpacity: { value: kind === "grass" ? 1 : 0.74 }
      },
      vertexShader: `
        attribute float aAnchor;
        attribute float aSway;
        uniform float uTime;
        uniform float uStrength;
        uniform float uSpeed;
        attribute vec3 aColor;
        varying vec3 vColor;

        void main() {
          vec3 transformed = position;
          float wave = sin(uTime * uSpeed + aSway + position.x * 0.53 + position.z * 0.31);
          transformed.x += wave * uStrength * aAnchor;
          transformed.z += cos(uTime * uSpeed * 0.7 + aSway) * uStrength * 0.45 * aAnchor;
          vColor = aColor;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;

        void main() {
          gl_FragColor = vec4(vColor, uOpacity);
        }
      `,
      transparent: kind === "seaweed",
      depthWrite: kind !== "seaweed",
      side: THREE.DoubleSide
    });
    this.windMaterials.add(material);
    return material;
  }

  private createTerrainTopGeometry(width: number, depth: number, materialId: string, tileHeight: number, x: number, z: number): THREE.PlaneGeometry {
    const geometry = new THREE.PlaneGeometry(width, depth);
    this.rotateAllUvs(geometry, this.topUvRotationForTile(materialId, x, z));
    const position = geometry.getAttribute("position");
    const waterDepth = this.surfaceEffectFor(materialId) === "water" ? tileHeight : 0;
    geometry.setAttribute("aDepth", new THREE.Float32BufferAttribute(Array.from({ length: position.count }, () => waterDepth), 1));
    return geometry;
  }

  private addTerrainSideBand(group: THREE.Group, width: number, depth: number, y: number, height: number, material: THREE.MeshStandardMaterial): void {
    const faces = [
      { position: new THREE.Vector3(0, y + height / 2, depth / 2), rotationY: 0, width },
      { position: new THREE.Vector3(0, y + height / 2, -depth / 2), rotationY: Math.PI, width },
      { position: new THREE.Vector3(width / 2, y + height / 2, 0), rotationY: Math.PI / 2, width: depth },
      { position: new THREE.Vector3(-width / 2, y + height / 2, 0), rotationY: -Math.PI / 2, width: depth }
    ];
    for (const face of faces) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(face.width, height), material);
      mesh.position.copy(face.position);
      mesh.rotation.y = face.rotationY;
      group.add(mesh);
    }
  }

  private topUvRotationForTile(materialId: string, x: number, z: number): number {
    return topUvRotations[this.hashTile(materialId, x, z) % topUvRotations.length];
  }

  private tileHasObstacle(level: LevelData, x: number, z: number): boolean {
    return level.obstacles.some((obstacle) => obstacle.x === x && obstacle.z === z);
  }

  private tileHasUnit(level: LevelData, x: number, z: number): boolean {
    return level.units.some((unit) => unit.x === x && unit.z === z);
  }

  private random01(seed: number): number {
    let value = seed + 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  private hashTile(materialId: string, x: number, z: number): number {
    const key = `${materialId}:${x}:${z}`;
    let hash = 2166136261;
    for (let index = 0; index < key.length; index += 1) {
      hash ^= key.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private rotateAllUvs(geometry: THREE.BufferGeometry, rotation: number): void {
    const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
    if (!uv) {
      return;
    }

    const center = 0.5;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    for (let vertexIndex = 0; vertexIndex < uv.count; vertexIndex += 1) {
      const u = uv.getX(vertexIndex) - center;
      const v = uv.getY(vertexIndex) - center;
      uv.setXY(vertexIndex, u * cos - v * sin + center, u * sin + v * cos + center);
    }
    uv.needsUpdate = true;
  }

  private addObstacle(level: LevelData, obstacle: ObstacleData): void {
    const baseY = this.tileTopY(level, obstacle.x, obstacle.z);
    const group = this.createPropObject(obstacle.type, 1, true);
    group.position.copy(this.worldPosition(level, obstacle.x, obstacle.z, baseY));
    group.userData = { ...group.userData, x: obstacle.x, z: obstacle.z, windSeed: this.hashTile(`prop:${obstacle.type}`, obstacle.x, obstacle.z) };
    group.traverse((child) => {
      child.userData = { ...child.userData, x: obstacle.x, z: obstacle.z };
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && child.userData.clickProxy) {
        this.clickable.push(mesh);
      }
    });
    this.root.add(group);
  }

  private addSurroundingProp(level: LevelData, prop: SurroundingPropData): void {
    const group = this.createPropObject(prop.type, prop.scale, false);
    group.position.copy(this.worldPosition(level, prop.x, prop.z, 0));
    group.rotation.y = prop.rotation;
    group.userData.windSeed = this.hashTile(`prop:${prop.type}`, prop.x, prop.z);
    this.root.add(group);
  }

  private createPropObject(propId: PropDefinitionId, scale: number, includeClickProxy: boolean): THREE.Group {
    const definition = this.propDefinitionFor(propId);
    const resolvedScale = Math.max(0.2, Math.min(3, scale || 1));
    const height = Math.max(0.1, definition.height * resolvedScale);
    const group = new THREE.Group();
    group.userData = { propId: definition.id, height };
    if (this.shouldPropSway(definition)) {
      group.userData.windSeed = this.hashTile(`prop:${definition.id}`, Math.round(resolvedScale * 100), includeClickProxy ? 1 : 0);
      this.windObjects.add(group);
    }

    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(0.1, definition.width * resolvedScale),
        height,
        Math.max(0.1, definition.depth * resolvedScale)
      ),
      definition.assetKind === "glb" && definition.modelUrl
        ? new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: includeClickProxy ? 0.02 : 0, depthWrite: false })
        : this.propMaterialFor(definition.id)
    );
    proxy.position.y = height / 2;
    proxy.castShadow = definition.assetKind !== "glb";
    proxy.receiveShadow = definition.assetKind !== "glb";
    proxy.userData = { propId: definition.id, height, clickProxy: includeClickProxy };
    group.add(proxy);

    if (definition.assetKind === "glb" && definition.modelUrl) {
      void this.loadPropModel(definition).then((source) => {
        if (!group.parent) {
          return;
        }
        const instance = source.clone(true);
        this.prepareModelInstance(instance, definition, resolvedScale);
        group.add(instance);
      }).catch((error) => {
        console.warn(`Unable to load prop model "${definition.name}".`, error);
      });
    }
    return group;
  }

  private shouldPropSway(definition: PropDefinition): boolean {
    if (definition.windEffect) {
      return true;
    }
    const label = `${definition.id} ${definition.name}`.toLowerCase();
    return label.includes("tree") || label.includes("foliage") || label.includes("plant");
  }

  private loadPropModel(definition: PropDefinition): Promise<THREE.Group> {
    const cacheKey = `${definition.id}:${definition.modelUrl}`;
    return this.loadGlb(cacheKey, definition.modelUrl);
  }

  private loadGlb(cacheKey: string, modelUrl: string): Promise<THREE.Group> {
    const cached = this.glbCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const promise = new Promise<THREE.Group>((resolve, reject) => {
      this.gltfLoader.load(
        modelUrl,
        (gltf) => {
          const source = gltf.scene;
          source.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          resolve(source);
        },
        undefined,
        reject
      );
    });
    promise.catch(() => {
      if (this.glbCache.get(cacheKey) === promise) {
        this.glbCache.delete(cacheKey);
      }
    });
    this.glbCache.set(cacheKey, promise);
    return promise;
  }

  private prepareModelInstance(instance: THREE.Group, definition: PropDefinition, scale: number): void {
    this.cloneModelResources(instance);
    instance.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(instance);
    if (box.isEmpty()) {
      return;
    }
    const size = box.getSize(new THREE.Vector3());
    const target = new THREE.Vector3(
      Math.max(0.1, definition.width * scale),
      Math.max(0.1, definition.height * scale),
      Math.max(0.1, definition.depth * scale)
    );
    const fitScale = definition.fitModelToTile
      ? Math.min(
          size.x > 0 ? target.x / size.x : 1,
          size.y > 0 ? target.y / size.y : 1,
          size.z > 0 ? target.z / size.z : 1
        )
      : scale;
    instance.scale.multiplyScalar(Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1);
    instance.updateMatrixWorld(true);
    const fittedBox = new THREE.Box3().setFromObject(instance);
    if (fittedBox.isEmpty()) {
      return;
    }
    const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
    instance.position.x -= fittedCenter.x;
    instance.position.y -= fittedBox.min.y;
    instance.position.z -= fittedCenter.z;
  }

  private cloneModelResources(object: THREE.Object3D): void {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.geometry = mesh.geometry.clone();
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => this.cloneMaterial(material));
      } else {
        mesh.material = this.cloneMaterial(mesh.material);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }

  private cloneMaterial(material: THREE.Material): THREE.Material {
    const clone = material.clone();
    const mappedClone = clone as THREE.MeshStandardMaterial;
    const mappedSource = material as THREE.MeshStandardMaterial;
    if (mappedSource.map) {
      mappedClone.map = mappedSource.map.clone();
      mappedClone.map.needsUpdate = true;
    }
    return clone;
  }

  private addUnit(level: LevelData, unit: UnitData): void {
    const group = new THREE.Group();
    const gap = 0.025;
    let y = 0;
    for (const section of ["legs", "body", "head"] as SectionName[]) {
      const spec = sectionSpecs[section];
      const faces = unit.faces[section];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height, spec.width), [
        this.materialFor(section, faces[1]),
        this.materialFor(section, faces[3]),
        new THREE.MeshStandardMaterial({ color: "#f4f0db", roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: "#2b3130", roughness: 0.8 }),
        this.materialFor(section, faces[0]),
        this.materialFor(section, faces[2])
      ]);
      mesh.position.y = y + spec.height / 2;
      mesh.rotation.y = unit.rotations[section] * Math.PI / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      y += spec.height + gap;
    }

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.018, 8, 56),
      new THREE.MeshBasicMaterial({ color: unit.team === "player" ? "#60d7e4" : "#ff6d62", transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.025;
    group.add(ring);

    group.position.copy(this.worldPosition(level, unit.x, unit.z, this.tileTopY(level, unit.x, unit.z) + 0.02));
    group.userData = { x: unit.x, z: unit.z };
    group.traverse((child) => {
      child.userData = { x: unit.x, z: unit.z };
    });
    this.root.add(group);
    this.clickable.push(...group.children);
  }

  private addHighlight(coord: TileCoord, color: string): void {
    if (!this.level) {
      return;
    }
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(tileSize * 0.86, tileSize * 0.86),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false })
    );
    mesh.position.copy(this.worldPosition(this.level, coord.x, coord.z, this.tileTopY(this.level, coord.x, coord.z) + 0.04));
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 10;
    this.root.add(mesh);
  }

  private pick(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.clickable, true)[0];
    if (hit?.object.userData && Number.isInteger(hit.object.userData.x) && Number.isInteger(hit.object.userData.z)) {
      this.clickHandler?.({ x: hit.object.userData.x, z: hit.object.userData.z });
    }
  }

  private animate(): void {
    const elapsed = this.clock.getElapsedTime();
    this.updateAnimatedEnvironment(elapsed);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }

  private updateAnimatedEnvironment(elapsed: number): void {
    for (const material of this.waterMaterials) {
      material.uniforms.uTime.value = elapsed;
    }
    for (const material of this.windMaterials) {
      material.uniforms.uTime.value = elapsed;
    }
    for (const object of this.windObjects) {
      if (!object.parent) {
        this.windObjects.delete(object);
        continue;
      }
      const seed = Number(object.userData.windSeed ?? 0);
      const phase = this.random01(seed) * Math.PI * 2;
      object.rotation.x = Math.sin(elapsed * 0.9 + phase) * 0.025;
      object.rotation.z = Math.cos(elapsed * 0.75 + phase * 0.7) * 0.018;
    }
  }

  private resize(): void {
    const { clientWidth, clientHeight } = this.canvas;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / Math.max(1, clientHeight);
    this.camera.updateProjectionMatrix();
  }

  private frameCamera(level: LevelData): void {
    this.camera.position.set(level.width * 0.7, 6.2, level.depth * 1.05);
    this.controls.target.set(0, 0.7, 0);
    this.resize();
    this.controls.update();
  }

  private tileTopY(level: LevelData, x: number, z: number): number {
    return baseTileHeight + level.tiles[z][x].height * heightStep;
  }

  private worldPosition(level: LevelData, x: number, z: number, y = 0): THREE.Vector3 {
    return new THREE.Vector3((x - (level.width - 1) / 2) * tileSize, y, (z - (level.depth - 1) / 2) * tileSize);
  }
}
