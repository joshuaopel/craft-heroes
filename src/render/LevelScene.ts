import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type {
  ClassDefinition,
  ClassId,
  EnvironmentMaterialDefinition,
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
  sunIntensity: 2
};

const fallbackMaterial: EnvironmentMaterialDefinition = {
  id: "grass",
  name: "Grass",
  topColor: "#8fc265",
  sideColor: "#5c6f48",
  topImageUrl: "",
  sideImageUrl: "",
  topRule: "Fallback playable ground.",
  sideRule: "Fallback exposed block side.",
  movementCost: 1,
  blocksLineOfSight: false
};

const fallbackProp: PropDefinition = {
  id: "wall",
  name: "Wall",
  role: "blocker",
  color: "#6c716a",
  textureUrl: "",
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
  private readonly textureLoader = new THREE.TextureLoader();
  private classDefinitions: ClassDefinition[] = [];
  private environmentMaterials: EnvironmentMaterialDefinition[] = [];
  private propDefinitions: PropDefinition[] = [];
  private classMaterials: Record<SectionName, Record<ClassId, THREE.MeshStandardMaterial>> = {
    head: {},
    body: {},
    legs: {}
  };
  private terrainMaterials: Record<string, { top: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial }> = {};
  private propMaterials: Record<PropDefinitionId, THREE.MeshStandardMaterial> = {};
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

  private createTerrainMaterials(
    environmentMaterials: EnvironmentMaterialDefinition[]
  ): Record<string, { top: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial }> {
    const materials: Record<string, { top: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial }> = {};
    for (const definition of environmentMaterials) {
      materials[definition.id] = {
        top: this.createMappedMaterial(definition.topColor, definition.topImageUrl, 0.72),
        side: this.createMappedMaterial(definition.sideColor, definition.sideImageUrl, 0.86)
      };
    }
    return materials;
  }

  private createPropMaterials(propDefinitions: PropDefinition[]): Record<PropDefinitionId, THREE.MeshStandardMaterial> {
    const materials: Record<PropDefinitionId, THREE.MeshStandardMaterial> = {};
    for (const definition of propDefinitions) {
      materials[definition.id] = this.createMappedMaterial(definition.color, definition.textureUrl, 0.82);
    }
    return materials;
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

  private collectTerrainMaterials(): THREE.MeshStandardMaterial[] {
    return Object.values(this.terrainMaterials).flatMap((materialSet) => [materialSet.top, materialSet.side]);
  }

  private collectPropMaterials(): THREE.MeshStandardMaterial[] {
    return Object.values(this.propMaterials);
  }

  private terrainMaterialFor(materialId: string): { top: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial } {
    const existing = this.terrainMaterials[materialId];
    if (existing) {
      return existing;
    }
    const definition = this.environmentMaterials.find((material) => material.id === materialId) ?? fallbackMaterial;
    const fallback = {
      top: this.createMappedMaterial(definition.topColor, definition.topImageUrl, 0.72),
      side: this.createMappedMaterial(definition.sideColor, definition.sideImageUrl, 0.86)
    };
    this.terrainMaterials[materialId] = fallback;
    return fallback;
  }

  private propDefinitionFor(propId: PropDefinitionId): PropDefinition {
    return this.propDefinitions.find((propDefinition) => propDefinition.id === propId) ?? fallbackProp;
  }

  private propMaterialFor(propId: PropDefinitionId): THREE.MeshStandardMaterial {
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
    this.addTerrain(this.level);
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
      this.collectTerrainMaterials().includes(material as THREE.MeshStandardMaterial) ||
      this.collectPropMaterials().includes(material as THREE.MeshStandardMaterial)
    );
  }

  private disposeMaterial(material: THREE.Material): void {
    const mappedMaterial = material as THREE.MeshStandardMaterial;
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

  private addTerrain(level: LevelData): void {
    for (let z = 0; z < level.depth; z += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const tile = level.tiles[z][x];
        const height = baseTileHeight + tile.height * heightStep;
        const terrainMaterials = this.terrainMaterialFor(tile.terrain);
        const materials = [
          terrainMaterials.side,
          terrainMaterials.side,
          terrainMaterials.top,
          new THREE.MeshStandardMaterial({ color: "#49392c", roughness: 0.96 }),
          terrainMaterials.side,
          terrainMaterials.side
        ];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(tileSize * 0.96, height, tileSize * 0.96), materials);
        mesh.position.copy(this.worldPosition(level, x, z, height / 2));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { x, z };
        this.root.add(mesh);
        this.clickable.push(mesh);
      }
    }
  }

  private addObstacle(level: LevelData, obstacle: ObstacleData): void {
    const baseY = this.tileTopY(level, obstacle.x, obstacle.z);
    const mesh = this.createPropMesh(obstacle.type, 1);
    mesh.position.copy(this.worldPosition(level, obstacle.x, obstacle.z, baseY + mesh.userData.height / 2));
    mesh.userData = { ...mesh.userData, x: obstacle.x, z: obstacle.z };
    this.root.add(mesh);
    this.clickable.push(mesh);
  }

  private addSurroundingProp(level: LevelData, prop: SurroundingPropData): void {
    const mesh = this.createPropMesh(prop.type, prop.scale);
    mesh.position.copy(this.worldPosition(level, prop.x, prop.z, mesh.userData.height / 2));
    mesh.rotation.y = prop.rotation;
    this.root.add(mesh);
  }

  private createPropMesh(propId: PropDefinitionId, scale: number): THREE.Mesh {
    const definition = this.propDefinitionFor(propId);
    const resolvedScale = Math.max(0.2, Math.min(3, scale || 1));
    const height = Math.max(0.1, definition.height * resolvedScale);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(0.1, definition.width * resolvedScale),
        height,
        Math.max(0.1, definition.depth * resolvedScale)
      ),
      this.propMaterialFor(definition.id)
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { propId: definition.id, height };
    return mesh;
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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
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
