import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ClassName, LevelData, ObstacleData, SectionName, TerrainType, TileCoord, UnitData } from "../game/schema";

const tileSize = 1.08;
const heightStep = 0.28;
const baseTileHeight = 0.18;
const sectionNames: SectionName[] = ["head", "body", "legs"];
const dirOrder = ["S", "E", "N", "W"];

const terrainColors: Record<TerrainType, string> = {
  grass: "#8fc265",
  stone: "#8f958d",
  sand: "#d0b66b",
  water: "#5198ba"
};

const classColors: Record<ClassName, string> = {
  Warrior: "#e05c4f",
  Healer: "#45d483",
  Ranger: "#f2bd55",
  Mage: "#9b79f2"
};

const sectionSpecs: Record<SectionName, { height: number; width: number }> = {
  legs: { height: 0.54, width: 0.62 },
  body: { height: 0.62, width: 0.72 },
  head: { height: 0.54, width: 0.62 }
};

type ClickHandler = (coord: TileCoord) => void;

export class LevelScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  private readonly controls: OrbitControls;
  private readonly root = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly clickable: THREE.Object3D[] = [];
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly classMaterials: Record<SectionName, Record<ClassName, THREE.MeshStandardMaterial>>;
  private level?: LevelData;
  private selected?: TileCoord;
  private mode: "editor" | "play" = "editor";
  private clickHandler?: ClickHandler;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color("#7bb6c5");
    this.scene.fog = new THREE.Fog("#7bb6c5", 13, 28);
    this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight("#e6fff2", "#405246", 1.2));

    const sun = new THREE.DirectionalLight("#fff0ce", 2);
    sun.position.set(-5, 8, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight("#89d7ff", 0.65);
    fill.position.set(6, 4, -5);
    this.scene.add(fill);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI * 0.44;

    this.classMaterials = this.createClassMaterials();
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

  setLevel(level: LevelData): void {
    this.level = level;
    this.frameCamera(level);
    this.renderLevel();
  }

  dispose(): void {
    this.renderer.dispose();
  }

  private createClassMaterials(): Record<SectionName, Record<ClassName, THREE.MeshStandardMaterial>> {
    const materials = {} as Record<SectionName, Record<ClassName, THREE.MeshStandardMaterial>>;
    for (const section of sectionNames) {
      materials[section] = {} as Record<ClassName, THREE.MeshStandardMaterial>;
      for (const className of Object.keys(classColors) as ClassName[]) {
        const texture = this.textureLoader.load(`/assets/classes/${className.toLowerCase()}-${section}.png`);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestMipmapNearestFilter;
        materials[section][className] = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          map: texture,
          roughness: 0.66,
          metalness: 0.02
        });
      }
    }
    return materials;
  }

  private renderLevel(): void {
    this.clearRoot();
    this.clickable.length = 0;
    if (!this.level) {
      return;
    }

    this.addTerrain(this.level);
    for (const obstacle of this.level.obstacles) {
      this.addObstacle(this.level, obstacle);
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
            item.dispose();
          }
        }
      } else if (material && !this.isSharedMaterial(material)) {
        material.dispose();
      }
    });
  }

  private isSharedMaterial(material: THREE.Material): boolean {
    return Object.values(this.classMaterials).some((section) => Object.values(section).includes(material as THREE.MeshStandardMaterial));
  }

  private addTerrain(level: LevelData): void {
    for (let z = 0; z < level.depth; z += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const tile = level.tiles[z][x];
        const height = baseTileHeight + tile.height * heightStep;
        const materials = [
          new THREE.MeshStandardMaterial({ color: "#6f765d", roughness: 0.86 }),
          new THREE.MeshStandardMaterial({ color: "#6f765d", roughness: 0.86 }),
          new THREE.MeshStandardMaterial({ color: terrainColors[tile.terrain], roughness: 0.72 }),
          new THREE.MeshStandardMaterial({ color: "#49392c", roughness: 0.96 }),
          new THREE.MeshStandardMaterial({ color: "#6f765d", roughness: 0.86 }),
          new THREE.MeshStandardMaterial({ color: "#6f765d", roughness: 0.86 })
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
    const height = obstacle.type === "tower" ? 1.2 : obstacle.type === "wall" ? 0.9 : 0.62;
    const color = obstacle.type === "tree" ? "#3e8a58" : obstacle.type === "cover" ? "#776a50" : "#6c716a";
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(obstacle.type === "cover" ? 0.9 : 0.75, height, obstacle.type === "cover" ? 0.35 : 0.75),
      new THREE.MeshStandardMaterial({ color, roughness: 0.82 })
    );
    mesh.position.copy(this.worldPosition(level, obstacle.x, obstacle.z, baseY + height / 2));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { x: obstacle.x, z: obstacle.z };
    this.root.add(mesh);
    this.clickable.push(mesh);
  }

  private addUnit(level: LevelData, unit: UnitData): void {
    const group = new THREE.Group();
    const gap = 0.025;
    let y = 0;
    for (const section of ["legs", "body", "head"] as SectionName[]) {
      const spec = sectionSpecs[section];
      const faces = unit.faces[section];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height, spec.width), [
        this.classMaterials[section][faces[1]],
        this.classMaterials[section][faces[3]],
        new THREE.MeshStandardMaterial({ color: "#f4f0db", roughness: 0.7 }),
        new THREE.MeshStandardMaterial({ color: "#2b3130", roughness: 0.8 }),
        this.classMaterials[section][faces[0]],
        this.classMaterials[section][faces[2]]
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
