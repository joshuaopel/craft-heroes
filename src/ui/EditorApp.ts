import {
  defaultCampaign,
  defaultClassDefinitions,
  defaultEnvironmentMaterials,
  defaultEnvironmentSettings,
  defaultLevels,
  defaultPropDefinitions,
  unitTemplates
} from "../game/content";
import {
  changeHeight,
  cloneLevel,
  eraseTileOccupants,
  paintTerrain,
  placeObstacle,
  placeUnit,
  resizeLevel,
  saveCampaign,
  saveLevel,
  validateLevel
} from "../game/levelOps";
import type {
  CampaignData,
  ClassDefinition,
  ClassId,
  ClassSectionStats,
  EditorTool,
  EnvironmentMaterialDefinition,
  EnvironmentMaterialId,
  EnvironmentSettings,
  LevelData,
  ObstacleType,
  PropDefinition,
  PropDefinitionId,
  SectionName,
  Team,
  TerrainType,
  TileCoord,
  UnitTemplate
} from "../game/schema";
import { LevelScene } from "../render/LevelScene";

const directionLabels = ["S", "E", "N", "W"] as const;
const sectionNames: SectionName[] = ["head", "body", "legs"];
const statFields: Array<{ key: keyof ClassSectionStats; label: string }> = [
  { key: "attack", label: "ATK" },
  { key: "defense", label: "DEF" },
  { key: "move", label: "MOVE" },
  { key: "range", label: "RNG" },
  { key: "support", label: "SUP" }
];
const templatesStorageKey = "craft-heroes-unit-templates";
const classesStorageKey = "craft-heroes-class-definitions";
const materialsStorageKey = "craft-heroes-environment-materials";
const propsStorageKey = "craft-heroes-prop-definitions";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });
}

function templateIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `build-${Date.now()}`;
}

function classIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `class-${Date.now()}`;
}

function materialIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `material-${Date.now()}`;
}

function propIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `prop-${Date.now()}`;
}

function readStoredJson<T>(key: string): T | undefined {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : undefined;
  } catch {
    return undefined;
  }
}

function numberOrFallback(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStats(stats: Partial<ClassSectionStats> | undefined): ClassSectionStats {
  return {
    attack: Math.max(0, Math.min(12, numberOrFallback(stats?.attack, 0))),
    defense: Math.max(0, Math.min(12, numberOrFallback(stats?.defense, 0))),
    move: Math.max(0, Math.min(12, numberOrFallback(stats?.move, 0))),
    range: Math.max(0, Math.min(12, numberOrFallback(stats?.range, 0))),
    support: Math.max(0, Math.min(12, numberOrFallback(stats?.support, 0)))
  };
}

function normalizeClassDefinition(classDefinition: ClassDefinition): ClassDefinition {
  const fallback = defaultClassDefinitions[0];
  const id = classDefinition.id || classIdFromName(classDefinition.name || "class");
  const sections = {} as ClassDefinition["sections"];
  for (const section of sectionNames) {
    const sourceSection = classDefinition.sections?.[section] ?? fallback.sections[section];
    sections[section] = {
      imageUrl: typeof sourceSection.imageUrl === "string" ? sourceSection.imageUrl : "",
      stats: normalizeStats(sourceSection.stats),
      conditions: Array.isArray(sourceSection.conditions) ? sourceSection.conditions.map(String).filter(Boolean) : []
    };
  }
  return {
    id,
    name: classDefinition.name || id,
    color: classDefinition.color || fallback.color,
    sections
  };
}

function mergeClassDefinitions(...sets: ClassDefinition[][]): ClassDefinition[] {
  const byId = new Map<string, ClassDefinition>();
  for (const set of sets) {
    for (const classDefinition of set) {
      const normalized = normalizeClassDefinition(classDefinition);
      byId.set(normalized.id, normalized);
    }
  }
  return [...byId.values()];
}

function normalizeEnvironment(environment: Partial<EnvironmentSettings> | undefined): EnvironmentSettings {
  return {
    skyColor: environment?.skyColor || defaultEnvironmentSettings.skyColor,
    fogColor: environment?.fogColor || defaultEnvironmentSettings.fogColor,
    groundColor: environment?.groundColor || defaultEnvironmentSettings.groundColor,
    groundTextureUrl: environment?.groundTextureUrl || "",
    ambientIntensity: Math.max(0, Math.min(4, numberOrFallback(environment?.ambientIntensity, defaultEnvironmentSettings.ambientIntensity))),
    sunIntensity: Math.max(0, Math.min(6, numberOrFallback(environment?.sunIntensity, defaultEnvironmentSettings.sunIntensity)))
  };
}

function normalizeMaterialDefinition(material: Partial<EnvironmentMaterialDefinition>): EnvironmentMaterialDefinition {
  const fallback = defaultEnvironmentMaterials[0];
  const id = material.id || materialIdFromName(material.name || fallback.name);
  return {
    id,
    name: material.name || id,
    topColor: material.topColor || fallback.topColor,
    sideColor: material.sideColor || fallback.sideColor,
    topImageUrl: typeof material.topImageUrl === "string" ? material.topImageUrl : "",
    sideImageUrl: typeof material.sideImageUrl === "string" ? material.sideImageUrl : "",
    topRule: material.topRule || "",
    sideRule: material.sideRule || "",
    movementCost: Math.max(1, Math.min(9, numberOrFallback(material.movementCost, 1))),
    blocksLineOfSight: Boolean(material.blocksLineOfSight)
  };
}

function mergeMaterialDefinitions(...sets: EnvironmentMaterialDefinition[][]): EnvironmentMaterialDefinition[] {
  const byId = new Map<string, EnvironmentMaterialDefinition>();
  for (const set of sets) {
    for (const material of set) {
      const normalized = normalizeMaterialDefinition(material);
      byId.set(normalized.id, normalized);
    }
  }
  return [...byId.values()];
}

function normalizePropDefinition(prop: Partial<PropDefinition>): PropDefinition {
  const fallback = defaultPropDefinitions[0];
  const id = prop.id || propIdFromName(prop.name || fallback.name);
  const role = prop.role === "cover" || prop.role === "decor" || prop.role === "blocker" ? prop.role : fallback.role;
  return {
    id,
    name: prop.name || id,
    role,
    color: prop.color || fallback.color,
    textureUrl: typeof prop.textureUrl === "string" ? prop.textureUrl : "",
    width: Math.max(0.1, Math.min(3, numberOrFallback(prop.width, fallback.width))),
    height: Math.max(0.1, Math.min(4, numberOrFallback(prop.height, fallback.height))),
    depth: Math.max(0.1, Math.min(3, numberOrFallback(prop.depth, fallback.depth))),
    blocksMovement: prop.blocksMovement ?? role !== "decor",
    blocksLineOfSight: Boolean(prop.blocksLineOfSight),
    coverBonus: Math.max(0, Math.min(9, numberOrFallback(prop.coverBonus, role === "cover" ? 1 : 0))),
    notes: Array.isArray(prop.notes) ? prop.notes.map(String).filter(Boolean) : []
  };
}

function mergePropDefinitions(...sets: PropDefinition[][]): PropDefinition[] {
  const byId = new Map<string, PropDefinition>();
  for (const set of sets) {
    for (const prop of set) {
      const normalized = normalizePropDefinition(prop);
      byId.set(normalized.id, normalized);
    }
  }
  return [...byId.values()];
}

function normalizeLevelData(level: LevelData): LevelData {
  return {
    ...level,
    environment: normalizeEnvironment(level.environment),
    surroundings: Array.isArray(level.surroundings) ? level.surroundings : []
  };
}

function initialClassDefinitions(): ClassDefinition[] {
  const stored = readStoredJson<ClassDefinition[]>(classesStorageKey);
  return Array.isArray(stored) && stored.length > 0
    ? mergeClassDefinitions(defaultClassDefinitions, stored)
    : defaultClassDefinitions.map((classDefinition) => structuredClone(classDefinition));
}

function initialEnvironmentMaterials(): EnvironmentMaterialDefinition[] {
  const stored = readStoredJson<EnvironmentMaterialDefinition[]>(materialsStorageKey);
  return Array.isArray(stored) && stored.length > 0
    ? mergeMaterialDefinitions(defaultEnvironmentMaterials, stored)
    : defaultEnvironmentMaterials.map((material) => structuredClone(material));
}

function initialPropDefinitions(): PropDefinition[] {
  const stored = readStoredJson<PropDefinition[]>(propsStorageKey);
  return Array.isArray(stored) && stored.length > 0
    ? mergePropDefinitions(defaultPropDefinitions, stored)
    : defaultPropDefinitions.map((prop) => structuredClone(prop));
}

function initialTemplates(): UnitTemplate[] {
  const stored = readStoredJson<UnitTemplate[]>(templatesStorageKey);
  return Array.isArray(stored) && stored.length > 0
    ? stored.map((template) => structuredClone(template))
    : unitTemplates.map((template) => structuredClone(template));
}

function conditionsToText(conditions: string[]): string {
  return conditions.join("; ");
}

function textToConditions(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((condition) => condition.trim())
    .filter(Boolean);
}

interface EditorState {
  mode: "editor" | "play";
  tool: EditorTool;
  terrain: TerrainType;
  obstacle: ObstacleType;
  team: Team;
  templateId: string;
  classId: ClassId;
  levelId: string;
  selected?: TileCoord;
}

export class EditorApp {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene: LevelScene;
  private readonly panel: HTMLElement;
  private levels: LevelData[] = defaultLevels.map((level) => normalizeLevelData(cloneLevel(level)));
  private campaign: CampaignData = structuredClone(defaultCampaign);
  private templates: UnitTemplate[] = initialTemplates();
  private classDefinitions: ClassDefinition[] = initialClassDefinitions();
  private environmentMaterials: EnvironmentMaterialDefinition[] = initialEnvironmentMaterials();
  private propDefinitions: PropDefinition[] = initialPropDefinitions();
  private state: EditorState = {
    mode: "editor",
    tool: "select",
    terrain: this.environmentMaterials[0].id,
    obstacle: this.propDefinitions[0].id,
    team: "enemy",
    templateId: this.templates[1]?.id ?? this.templates[0].id,
    classId: this.classDefinitions[0].id,
    levelId: defaultCampaign.startLevel
  };

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = "app-shell";
    this.root.innerHTML = `
      <canvas class="world-canvas" aria-label="Craft Heroes level editor viewport"></canvas>
      <aside class="editor-panel"></aside>
      <div class="status-chip" id="status-chip"></div>
    `;
    this.canvas = this.root.querySelector(".world-canvas") as HTMLCanvasElement;
    this.panel = this.root.querySelector(".editor-panel") as HTMLElement;
    this.scene = new LevelScene(this.canvas, this.classDefinitions, this.environmentMaterials, this.propDefinitions);
    this.scene.onTileClick((coord) => this.handleTileClick(coord));
    this.render(true);
  }

  private currentLevel(): LevelData {
    return normalizeLevelData(this.levels.find((level) => level.id === this.state.levelId) ?? this.levels[0]);
  }

  private setCurrentLevel(level: LevelData): void {
    const normalized = normalizeLevelData(level);
    this.levels = this.levels.map((candidate) => (candidate.id === normalized.id ? normalized : candidate));
  }

  private selectedTemplate(): UnitTemplate {
    return this.templates.find((template) => template.id === this.state.templateId) ?? this.templates[0];
  }

  private selectedClass(): ClassDefinition {
    return this.classDefinitions.find((classDefinition) => classDefinition.id === this.state.classId) ?? this.classDefinitions[0];
  }

  private selectedMaterial(): EnvironmentMaterialDefinition {
    return this.environmentMaterials.find((material) => material.id === this.state.terrain) ?? this.environmentMaterials[0];
  }

  private selectedProp(): PropDefinition {
    return this.propDefinitions.find((prop) => prop.id === this.state.obstacle) ?? this.propDefinitions[0];
  }

  private uniqueTemplateId(name: string): string {
    const baseId = templateIdFromName(name);
    let id = baseId;
    let index = 2;
    while (this.templates.some((template) => template.id === id)) {
      id = `${baseId}-${index}`;
      index += 1;
    }
    return id;
  }

  private uniqueClassId(name: string): string {
    const baseId = classIdFromName(name);
    let id = baseId;
    let index = 2;
    while (this.classDefinitions.some((classDefinition) => classDefinition.id === id)) {
      id = `${baseId}-${index}`;
      index += 1;
    }
    return id;
  }

  private uniqueMaterialId(name: string): string {
    const baseId = materialIdFromName(name);
    let id = baseId;
    let index = 2;
    while (this.environmentMaterials.some((material) => material.id === id)) {
      id = `${baseId}-${index}`;
      index += 1;
    }
    return id;
  }

  private uniquePropId(name: string): string {
    const baseId = propIdFromName(name);
    let id = baseId;
    let index = 2;
    while (this.propDefinitions.some((prop) => prop.id === id)) {
      id = `${baseId}-${index}`;
      index += 1;
    }
    return id;
  }

  private classOptions(selectedId: ClassId): string {
    return this.classDefinitions
      .map(
        (classDefinition) =>
          `<option value="${escapeHtml(classDefinition.id)}" ${classDefinition.id === selectedId ? "selected" : ""}>${escapeHtml(classDefinition.name)}</option>`
      )
      .join("");
  }

  private materialOptions(selectedId: EnvironmentMaterialId): string {
    return this.environmentMaterials
      .map((material) => `<option value="${escapeHtml(material.id)}" ${material.id === selectedId ? "selected" : ""}>${escapeHtml(material.name)}</option>`)
      .join("");
  }

  private propOptions(selectedId: PropDefinitionId): string {
    return this.propDefinitions
      .map((prop) => `<option value="${escapeHtml(prop.id)}" ${prop.id === selectedId ? "selected" : ""}>${escapeHtml(prop.name)}</option>`)
      .join("");
  }

  private readBuildDraft(templateId = this.state.templateId): UnitTemplate {
    const fallback = this.selectedTemplate();
    const nameInput = this.panel.querySelector<HTMLInputElement>("[data-build='name']");
    const hpInput = this.panel.querySelector<HTMLInputElement>("[data-build='hp']");
    const faces = structuredClone(fallback.faces);
    for (const section of sectionNames) {
      for (let index = 0; index < directionLabels.length; index += 1) {
        const select = this.panel.querySelector<HTMLSelectElement>(`[data-face-section='${section}'][data-face-index='${index}']`);
        faces[section][index] = select?.value ?? faces[section][index];
      }
    }
    return {
      id: templateId,
      name: nameInput?.value.trim() || fallback.name,
      hp: Math.max(1, Math.min(99, Number(hpInput?.value || fallback.hp))),
      faces
    };
  }

  private readClassDraft(classId = this.state.classId): ClassDefinition {
    const fallback = this.selectedClass();
    const nameInput = this.panel.querySelector<HTMLInputElement>("[data-class='name']");
    const colorInput = this.panel.querySelector<HTMLInputElement>("[data-class='color']");
    const sections = structuredClone(fallback.sections);
    for (const section of sectionNames) {
      for (const stat of statFields) {
        const input = this.panel.querySelector<HTMLInputElement>(`[data-class-section='${section}'][data-stat='${stat.key}']`);
        const value = numberOrFallback(input?.value, sections[section].stats[stat.key]);
        sections[section].stats[stat.key] = Math.max(0, Math.min(12, value));
      }
      const conditionsInput = this.panel.querySelector<HTMLInputElement>(`[data-class-section='${section}'][data-condition]`);
      sections[section].conditions = textToConditions(conditionsInput?.value ?? conditionsToText(sections[section].conditions));
    }
    return normalizeClassDefinition({
      id: classId,
      name: nameInput?.value.trim() || fallback.name,
      color: colorInput?.value || fallback.color,
      sections
    });
  }

  private replaceClassDefinition(nextClass: ClassDefinition): void {
    this.classDefinitions = this.classDefinitions.map((classDefinition) => (classDefinition.id === nextClass.id ? nextClass : classDefinition));
    this.scene.setClassDefinitions(this.classDefinitions);
  }

  private readMaterialDraft(materialId = this.state.terrain): EnvironmentMaterialDefinition {
    const fallback = this.selectedMaterial();
    const nameInput = this.panel.querySelector<HTMLInputElement>("[data-material='name']");
    const topColorInput = this.panel.querySelector<HTMLInputElement>("[data-material='topColor']");
    const sideColorInput = this.panel.querySelector<HTMLInputElement>("[data-material='sideColor']");
    const movementInput = this.panel.querySelector<HTMLInputElement>("[data-material='movementCost']");
    const lineOfSightInput = this.panel.querySelector<HTMLInputElement>("[data-material='blocksLineOfSight']");
    const topRuleInput = this.panel.querySelector<HTMLInputElement>("[data-material='topRule']");
    const sideRuleInput = this.panel.querySelector<HTMLInputElement>("[data-material='sideRule']");
    return normalizeMaterialDefinition({
      ...fallback,
      id: materialId,
      name: nameInput?.value.trim() || fallback.name,
      topColor: topColorInput?.value || fallback.topColor,
      sideColor: sideColorInput?.value || fallback.sideColor,
      topRule: topRuleInput?.value.trim() || fallback.topRule,
      sideRule: sideRuleInput?.value.trim() || fallback.sideRule,
      movementCost: numberOrFallback(movementInput?.value, fallback.movementCost),
      blocksLineOfSight: Boolean(lineOfSightInput?.checked)
    });
  }

  private replaceMaterialDefinition(nextMaterial: EnvironmentMaterialDefinition): void {
    this.environmentMaterials = this.environmentMaterials.map((material) => (material.id === nextMaterial.id ? nextMaterial : material));
    this.scene.setEnvironmentMaterials(this.environmentMaterials);
  }

  private readPropDraft(propId = this.state.obstacle): PropDefinition {
    const fallback = this.selectedProp();
    const nameInput = this.panel.querySelector<HTMLInputElement>("[data-prop='name']");
    const roleInput = this.panel.querySelector<HTMLSelectElement>("[data-prop='role']");
    const colorInput = this.panel.querySelector<HTMLInputElement>("[data-prop='color']");
    const widthInput = this.panel.querySelector<HTMLInputElement>("[data-prop='width']");
    const heightInput = this.panel.querySelector<HTMLInputElement>("[data-prop='height']");
    const depthInput = this.panel.querySelector<HTMLInputElement>("[data-prop='depth']");
    const blocksMovementInput = this.panel.querySelector<HTMLInputElement>("[data-prop='blocksMovement']");
    const blocksLineOfSightInput = this.panel.querySelector<HTMLInputElement>("[data-prop='blocksLineOfSight']");
    const coverBonusInput = this.panel.querySelector<HTMLInputElement>("[data-prop='coverBonus']");
    const notesInput = this.panel.querySelector<HTMLInputElement>("[data-prop='notes']");
    return normalizePropDefinition({
      ...fallback,
      id: propId,
      name: nameInput?.value.trim() || fallback.name,
      role: (roleInput?.value as PropDefinition["role"] | undefined) ?? fallback.role,
      color: colorInput?.value || fallback.color,
      width: numberOrFallback(widthInput?.value, fallback.width),
      height: numberOrFallback(heightInput?.value, fallback.height),
      depth: numberOrFallback(depthInput?.value, fallback.depth),
      blocksMovement: Boolean(blocksMovementInput?.checked),
      blocksLineOfSight: Boolean(blocksLineOfSightInput?.checked),
      coverBonus: numberOrFallback(coverBonusInput?.value, fallback.coverBonus),
      notes: textToConditions(notesInput?.value ?? conditionsToText(fallback.notes))
    });
  }

  private replacePropDefinition(nextProp: PropDefinition): void {
    this.propDefinitions = this.propDefinitions.map((prop) => (prop.id === nextProp.id ? nextProp : prop));
    this.scene.setPropDefinitions(this.propDefinitions);
  }

  private readEnvironmentDraft(level: LevelData): EnvironmentSettings {
    const skyInput = this.panel.querySelector<HTMLInputElement>("[data-environment='skyColor']");
    const fogInput = this.panel.querySelector<HTMLInputElement>("[data-environment='fogColor']");
    const groundInput = this.panel.querySelector<HTMLInputElement>("[data-environment='groundColor']");
    const ambientInput = this.panel.querySelector<HTMLInputElement>("[data-environment='ambientIntensity']");
    const sunInput = this.panel.querySelector<HTMLInputElement>("[data-environment='sunIntensity']");
    return normalizeEnvironment({
      ...level.environment,
      skyColor: skyInput?.value || level.environment.skyColor,
      fogColor: fogInput?.value || level.environment.fogColor,
      groundColor: groundInput?.value || level.environment.groundColor,
      ambientIntensity: numberOrFallback(ambientInput?.value, level.environment.ambientIntensity),
      sunIntensity: numberOrFallback(sunInput?.value, level.environment.sunIntensity)
    });
  }

  private applyLevelSize(): void {
    const widthInput = this.panel.querySelector<HTMLInputElement>("[data-size='width']");
    const depthInput = this.panel.querySelector<HTMLInputElement>("[data-size='depth']");
    const width = Number(widthInput?.value || this.currentLevel().width);
    const depth = Number(depthInput?.value || this.currentLevel().depth);
    const next = resizeLevel(this.currentLevel(), width, depth, this.state.terrain);
    this.setCurrentLevel(next);
    if (this.state.selected && (this.state.selected.x >= next.width || this.state.selected.z >= next.depth)) {
      this.state.selected = undefined;
    }
    this.scene.setLevel(next);
    this.scene.setSelected(this.state.selected);
    this.updatePanel();
  }

  private handleTileClick(coord: TileCoord): void {
    this.state.selected = coord;
    if (this.state.mode === "play") {
      this.scene.setSelected(coord);
      this.updatePanel();
      return;
    }

    const level = this.currentLevel();
    let next = level;
    if (this.state.tool === "raise") {
      next = changeHeight(level, coord, 1);
    } else if (this.state.tool === "lower") {
      next = changeHeight(level, coord, -1);
    } else if (this.state.tool === "paint") {
      next = paintTerrain(level, coord, this.state.terrain);
    } else if (this.state.tool === "obstacle") {
      next = placeObstacle(level, coord, this.state.obstacle);
    } else if (this.state.tool === "unit") {
      const template = this.selectedTemplate();
      next = placeUnit(level, coord, this.state.team, template);
    } else if (this.state.tool === "erase") {
      next = eraseTileOccupants(level, coord);
    }
    this.setCurrentLevel(next);
    this.scene.setLevel(next);
    this.scene.setSelected(coord);
    this.updatePanel();
  }

  private render(frameScene = false): void {
    this.scene.setMode(this.state.mode);
    this.scene.setLevel(this.currentLevel(), { frame: frameScene });
    this.scene.setSelected(this.state.selected);
    this.updatePanel();
  }

  private updatePanel(): void {
    const level = this.currentLevel();
    const warnings = validateLevel(level);
    const currentTemplate = this.selectedTemplate();
    const currentClass = this.selectedClass();
    const currentMaterial = this.selectedMaterial();
    const currentProp = this.selectedProp();
    const json = JSON.stringify(
      {
        campaign: this.campaign,
        level,
        templates: this.templates,
        classes: this.classDefinitions,
        terrainMaterials: this.environmentMaterials,
        props: this.propDefinitions
      },
      null,
      2
    );
    this.panel.innerHTML = `
      <div class="panel-head">
        <div>
          <h1>Craft Heroes Editor</h1>
          <p>${this.state.mode === "editor" ? "Build voxel tactics levels." : "Play-test the current level data."}</p>
        </div>
        <button data-action="toggle-mode">${this.state.mode === "editor" ? "Play" : "Edit"}</button>
      </div>

      <label class="field">
        <span>Level</span>
        <select data-field="levelId">
          ${this.levels.map((candidate) => `<option value="${escapeHtml(candidate.id)}" ${candidate.id === this.state.levelId ? "selected" : ""}>${escapeHtml(candidate.name)}</option>`).join("")}
        </select>
      </label>

      <section class="control-section">
        <div class="section-title">
          <strong>Board Size</strong>
          <span>Grow the map without resetting the camera.</span>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Width</span>
            <input data-size="width" type="number" min="4" max="32" step="1" value="${level.width}">
          </label>
          <label class="field">
            <span>Depth</span>
            <input data-size="depth" type="number" min="4" max="32" step="1" value="${level.depth}">
          </label>
        </div>
        <div class="button-row two">
          <button data-action="apply-size">Apply Size</button>
          <button data-action="frame-board">Frame Board</button>
        </div>
      </section>

      <div class="tool-grid">
        ${(["select", "raise", "lower", "paint", "obstacle", "unit", "erase"] as EditorTool[])
          .map((tool) => `<button class="${this.state.tool === tool ? "active" : ""}" data-tool="${tool}">${tool}</button>`)
          .join("")}
      </div>

      <div class="compact-grid">
        <label class="field">
          <span>Terrain</span>
          <select data-field="terrain">
            ${this.materialOptions(this.state.terrain)}
          </select>
        </label>
        <label class="field">
          <span>Prop / Blocker</span>
          <select data-field="obstacle">
            ${this.propOptions(this.state.obstacle)}
          </select>
        </label>
        <label class="field">
          <span>Team</span>
          <select data-field="team">
            ${(["player", "enemy"] as Team[]).map((team) => `<option value="${team}" ${team === this.state.team ? "selected" : ""}>${team}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>Unit</span>
          <select data-field="templateId">
            ${this.templates.map((template) => `<option value="${escapeHtml(template.id)}" ${template.id === this.state.templateId ? "selected" : ""}>${escapeHtml(template.name)}</option>`).join("")}
          </select>
        </label>
      </div>

      <section class="control-section">
        <div class="section-title">
          <strong>Environment</strong>
          <span>Sky, fog, ground, and decorative props around the board.</span>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Sky</span>
            <input data-environment="skyColor" type="color" value="${escapeHtml(level.environment.skyColor)}">
          </label>
          <label class="field">
            <span>Fog</span>
            <input data-environment="fogColor" type="color" value="${escapeHtml(level.environment.fogColor)}">
          </label>
          <label class="field">
            <span>Ground</span>
            <input data-environment="groundColor" type="color" value="${escapeHtml(level.environment.groundColor)}">
          </label>
          <label class="field">
            <span>Ground Texture</span>
            <input data-ground-texture type="file" accept="image/*">
          </label>
          <label class="field">
            <span>Ambient</span>
            <input data-environment="ambientIntensity" type="number" min="0" max="4" step="0.1" value="${level.environment.ambientIntensity}">
          </label>
          <label class="field">
            <span>Sun</span>
            <input data-environment="sunIntensity" type="number" min="0" max="6" step="0.1" value="${level.environment.sunIntensity}">
          </label>
        </div>
        <div class="button-row two">
          <button data-action="update-environment">Update Environment</button>
          <button data-action="clear-ground-texture">Clear Ground Texture</button>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Surround X</span>
            <input data-surrounding="x" type="number" step="1" value="-2">
          </label>
          <label class="field">
            <span>Surround Z</span>
            <input data-surrounding="z" type="number" step="1" value="0">
          </label>
          <label class="field">
            <span>Rotation</span>
            <input data-surrounding="rotation" type="number" min="0" max="6.28" step="0.1" value="0">
          </label>
          <label class="field">
            <span>Scale</span>
            <input data-surrounding="scale" type="number" min="0.2" max="3" step="0.1" value="1">
          </label>
        </div>
        <div class="button-row two">
          <button data-action="add-surrounding">Add Surrounding Prop</button>
          <button data-action="clear-surroundings">Clear Surroundings</button>
        </div>
      </section>

      <section class="control-section">
        <div class="section-title">
          <strong>Terrain Materials</strong>
          <span>Define tile top art, side art, and placement rules.</span>
        </div>
        <label class="field">
          <span>Material</span>
          <select data-field="terrain">
            ${this.materialOptions(this.state.terrain)}
          </select>
        </label>
        <div class="compact-grid">
          <label class="field">
            <span>Name</span>
            <input data-material="name" type="text" value="${escapeHtml(currentMaterial.name)}">
          </label>
          <label class="field">
            <span>Move Cost</span>
            <input data-material="movementCost" type="number" min="1" max="9" step="1" value="${currentMaterial.movementCost}">
          </label>
          <label class="field">
            <span>Top Color</span>
            <input data-material="topColor" type="color" value="${escapeHtml(currentMaterial.topColor)}">
          </label>
          <label class="field">
            <span>Side Color</span>
            <input data-material="sideColor" type="color" value="${escapeHtml(currentMaterial.sideColor)}">
          </label>
        </div>
        <div class="asset-pair">
          <div class="asset-preview-head">
            <strong>Top</strong>
            <img src="${escapeHtml(currentMaterial.topImageUrl)}" alt="">
          </div>
          <div class="asset-preview-head">
            <strong>Sides</strong>
            <img src="${escapeHtml(currentMaterial.sideImageUrl)}" alt="">
          </div>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Top Texture</span>
            <input data-material-image="top" type="file" accept="image/*">
          </label>
          <label class="field">
            <span>Side Texture</span>
            <input data-material-image="side" type="file" accept="image/*">
          </label>
        </div>
        <label class="field">
          <span>Top Rule</span>
          <input data-material="topRule" type="text" value="${escapeHtml(currentMaterial.topRule)}">
        </label>
        <label class="field">
          <span>Side Rule</span>
          <input data-material="sideRule" type="text" value="${escapeHtml(currentMaterial.sideRule)}">
        </label>
        <label class="check-row">
          <input data-material="blocksLineOfSight" type="checkbox" ${currentMaterial.blocksLineOfSight ? "checked" : ""}>
          <span>Blocks line of sight when this material is raised.</span>
        </label>
        <div class="button-row two">
          <button data-action="update-material">Update Material</button>
          <button data-action="save-material-new">Save As New Material</button>
        </div>
      </section>

      <section class="control-section">
        <div class="section-title">
          <strong>Props / Blockers</strong>
          <span>Create placeable blockers, cover, and decorative environment props.</span>
        </div>
        <label class="field">
          <span>Prop</span>
          <select data-field="obstacle">
            ${this.propOptions(this.state.obstacle)}
          </select>
        </label>
        <div class="compact-grid">
          <label class="field">
            <span>Name</span>
            <input data-prop="name" type="text" value="${escapeHtml(currentProp.name)}">
          </label>
          <label class="field">
            <span>Role</span>
            <select data-prop="role">
              ${(["blocker", "cover", "decor"] as PropDefinition["role"][])
                .map((role) => `<option value="${role}" ${currentProp.role === role ? "selected" : ""}>${role}</option>`)
                .join("")}
            </select>
          </label>
          <label class="field">
            <span>Color</span>
            <input data-prop="color" type="color" value="${escapeHtml(currentProp.color)}">
          </label>
          <label class="field">
            <span>Texture</span>
            <input data-prop-image type="file" accept="image/*">
          </label>
        </div>
        <div class="asset-preview-head">
          <strong>Texture Preview</strong>
          <img src="${escapeHtml(currentProp.textureUrl)}" alt="">
        </div>
        <div class="stat-grid">
          <label>
            <span>W</span>
            <input data-prop="width" type="number" min="0.1" max="3" step="0.05" value="${currentProp.width}">
          </label>
          <label>
            <span>H</span>
            <input data-prop="height" type="number" min="0.1" max="4" step="0.05" value="${currentProp.height}">
          </label>
          <label>
            <span>D</span>
            <input data-prop="depth" type="number" min="0.1" max="3" step="0.05" value="${currentProp.depth}">
          </label>
          <label>
            <span>COV</span>
            <input data-prop="coverBonus" type="number" min="0" max="9" step="1" value="${currentProp.coverBonus}">
          </label>
        </div>
        <label class="check-row">
          <input data-prop="blocksMovement" type="checkbox" ${currentProp.blocksMovement ? "checked" : ""}>
          <span>Blocks movement.</span>
        </label>
        <label class="check-row">
          <input data-prop="blocksLineOfSight" type="checkbox" ${currentProp.blocksLineOfSight ? "checked" : ""}>
          <span>Blocks line of sight.</span>
        </label>
        <label class="field">
          <span>Notes</span>
          <input data-prop="notes" type="text" value="${escapeHtml(conditionsToText(currentProp.notes))}">
        </label>
        <div class="button-row two">
          <button data-action="update-prop">Update Prop</button>
          <button data-action="save-prop-new">Save As New Prop</button>
        </div>
      </section>

      <section class="control-section">
        <div class="section-title">
          <strong>Class Library</strong>
          <span>${this.classDefinitions.length} classes available.</span>
        </div>
        <label class="field">
          <span>Class</span>
          <select data-field="classId">
            ${this.classOptions(this.state.classId)}
          </select>
        </label>
        <div class="compact-grid">
          <label class="field">
            <span>Class Name</span>
            <input data-class="name" type="text" value="${escapeHtml(currentClass.name)}">
          </label>
          <label class="field">
            <span>Color</span>
            <input data-class="color" type="color" value="${escapeHtml(currentClass.color)}">
          </label>
        </div>
        <div class="class-section-list">
          ${sectionNames
            .map((section) => {
              const sectionDefinition = currentClass.sections[section];
              return `
                <div class="class-section-card">
                  <div class="class-section-head">
                    <strong>${section === "body" ? "body / arms" : section}</strong>
                    <img src="${escapeHtml(sectionDefinition.imageUrl)}" alt="">
                  </div>
                  <label class="field">
                    <span>Image</span>
                    <input data-class-image data-class-section="${section}" type="file" accept="image/*">
                  </label>
                  <div class="stat-grid">
                    ${statFields
                      .map(
                        (stat) => `
                          <label>
                            <span>${stat.label}</span>
                            <input data-class-section="${section}" data-stat="${stat.key}" type="number" min="0" max="12" step="1" value="${sectionDefinition.stats[stat.key]}">
                          </label>
                        `
                      )
                      .join("")}
                  </div>
                  <label class="field">
                    <span>Conditions</span>
                    <input data-class-section="${section}" data-condition type="text" value="${escapeHtml(conditionsToText(sectionDefinition.conditions))}">
                  </label>
                </div>
              `;
            })
            .join("")}
        </div>
        <div class="button-row two">
          <button data-action="update-class">Update Class</button>
          <button data-action="save-class-new">Save As New Class</button>
        </div>
      </section>

      <section class="control-section">
        <div class="section-title">
          <strong>Character Builds</strong>
          <span>Create reusable player or enemy cube layouts.</span>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Build Name</span>
            <input data-build="name" type="text" value="${escapeHtml(currentTemplate.name)}">
          </label>
          <label class="field">
            <span>HP</span>
            <input data-build="hp" type="number" min="1" max="99" step="1" value="${currentTemplate.hp}">
          </label>
        </div>
        <div class="face-builder">
          ${sectionNames
            .map(
              (section) => `
                <div class="face-row">
                  <b>${section === "body" ? "body / arms" : section}</b>
                  ${directionLabels
                    .map(
                      (direction, index) => `
                        <label>
                          <span>${direction}</span>
                          <select data-face-section="${section}" data-face-index="${index}">
                            ${this.classOptions(currentTemplate.faces[section][index])}
                          </select>
                        </label>
                      `
                    )
                    .join("")}
                </div>
              `
            )
            .join("")}
        </div>
        <div class="button-row two">
          <button data-action="update-build">Update Selected</button>
          <button data-action="save-build-new">Save As New Build</button>
        </div>
      </section>

      <div class="level-card">
        <strong>${level.name}</strong>
        <span>${level.width} x ${level.depth} board / ${level.units.length} units / ${level.obstacles.length} blockers / ${level.surroundings.length} surroundings</span>
        <span>Next: ${level.links.map((link) => link.to).join(", ") || "campaign end"}</span>
      </div>

      <div class="button-row">
        <button data-action="duplicate-level">Duplicate Level</button>
        <button data-action="save-local">Save Local</button>
        <button data-action="load-sample">Reset Samples</button>
      </div>

      <label class="field">
        <span>Export / Import Current Level + Campaign</span>
        <textarea data-json>${json}</textarea>
      </label>

      <div class="button-row">
        <button data-action="copy-json">Copy JSON</button>
        <button data-action="import-json">Import JSON</button>
        <button data-action="next-level">Load Next</button>
      </div>

      <ul class="warnings">
        ${(warnings.length ? warnings : ["Level validates for first-pass playtesting."]).map((warning) => `<li>${warning}</li>`).join("")}
      </ul>
    `;

    this.panel.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => {
        this.state.tool = button.dataset.tool as EditorTool;
        this.updatePanel();
      });
    });

    this.panel.querySelectorAll<HTMLSelectElement>("[data-field]").forEach((select) => {
      select.addEventListener("change", () => {
        const key = select.dataset.field as keyof EditorState;
        (this.state[key] as string) = select.value;
        if (key === "levelId") {
          this.state.selected = undefined;
          this.render(true);
          return;
        }
        if (key === "classId" || key === "templateId") {
          this.updatePanel();
          return;
        }
        this.render();
      });
    });

    this.panel.querySelectorAll<HTMLInputElement>("[data-class-image]").forEach((input) => {
      input.addEventListener("change", () => this.handleClassImageUpload(input));
    });

    this.panel.querySelectorAll<HTMLInputElement>("[data-material-image]").forEach((input) => {
      input.addEventListener("change", () => this.handleMaterialImageUpload(input));
    });

    this.panel.querySelectorAll<HTMLInputElement>("[data-prop-image]").forEach((input) => {
      input.addEventListener("change", () => this.handlePropImageUpload(input));
    });

    this.panel.querySelectorAll<HTMLInputElement>("[data-ground-texture]").forEach((input) => {
      input.addEventListener("change", () => this.handleGroundTextureUpload(input));
    });

    this.panel.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
      button.addEventListener("click", () => this.handleAction(button.dataset.action ?? ""));
    });

    const chip = this.root.querySelector("#status-chip");
    if (chip) {
      chip.textContent = this.state.selected
        ? `${this.state.mode.toUpperCase()} / ${this.state.tool} / tile ${this.state.selected.x}, ${this.state.selected.z}`
        : `${this.state.mode.toUpperCase()} / ${this.state.tool} / click a tile`;
    }
  }

  private handleClassImageUpload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    const section = input.dataset.classSection as SectionName | undefined;
    if (!file || !section || !sectionNames.includes(section)) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      this.flash("Class image upload needs an image file.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const dataUrl = String(reader.result ?? "");
      const draft = this.readClassDraft();
      draft.sections[section].imageUrl = dataUrl;
      this.replaceClassDefinition(draft);
      this.updatePanel();
      this.flash(`Updated ${draft.name} ${section} art.`);
    });
    reader.addEventListener("error", () => {
      this.flash("Class image upload failed.");
    });
    reader.readAsDataURL(file);
  }

  private handleMaterialImageUpload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    const target = input.dataset.materialImage;
    if (!file || (target !== "top" && target !== "side")) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      this.flash("Terrain texture upload needs an image file.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const draft = this.readMaterialDraft();
      if (target === "top") {
        draft.topImageUrl = String(reader.result ?? "");
      } else {
        draft.sideImageUrl = String(reader.result ?? "");
      }
      this.replaceMaterialDefinition(draft);
      this.updatePanel();
      this.flash(`Updated ${draft.name} ${target} texture.`);
    });
    reader.addEventListener("error", () => {
      this.flash("Terrain texture upload failed.");
    });
    reader.readAsDataURL(file);
  }

  private handlePropImageUpload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      this.flash("Prop texture upload needs an image file.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const draft = this.readPropDraft();
      draft.textureUrl = String(reader.result ?? "");
      this.replacePropDefinition(draft);
      this.updatePanel();
      this.flash(`Updated ${draft.name} texture.`);
    });
    reader.addEventListener("error", () => {
      this.flash("Prop texture upload failed.");
    });
    reader.readAsDataURL(file);
  }

  private handleGroundTextureUpload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      this.flash("Ground texture upload needs an image file.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const level = this.currentLevel();
      const next = {
        ...level,
        environment: {
          ...this.readEnvironmentDraft(level),
          groundTextureUrl: String(reader.result ?? "")
        }
      };
      this.setCurrentLevel(next);
      this.scene.setLevel(next);
      this.updatePanel();
      this.flash("Updated ground texture.");
    });
    reader.addEventListener("error", () => {
      this.flash("Ground texture upload failed.");
    });
    reader.readAsDataURL(file);
  }

  private handleAction(action: string): void {
    if (action === "toggle-mode") {
      this.state.mode = this.state.mode === "editor" ? "play" : "editor";
      this.scene.setMode(this.state.mode);
      this.updatePanel();
    } else if (action === "apply-size") {
      this.applyLevelSize();
    } else if (action === "frame-board") {
      this.scene.frameCurrentLevel();
      this.flash("Camera framed to the current board.");
    } else if (action === "update-build") {
      const draft = this.readBuildDraft();
      this.templates = this.templates.map((template) => (template.id === draft.id ? draft : template));
      this.updatePanel();
      this.flash(`Updated ${draft.name}.`);
    } else if (action === "save-build-new") {
      const draft = this.readBuildDraft();
      const nextTemplate = {
        ...draft,
        id: this.uniqueTemplateId(draft.name)
      };
      this.templates.push(nextTemplate);
      this.state.templateId = nextTemplate.id;
      this.updatePanel();
      this.flash(`Created ${nextTemplate.name}.`);
    } else if (action === "update-class") {
      const draft = this.readClassDraft();
      this.replaceClassDefinition(draft);
      this.updatePanel();
      this.flash(`Updated ${draft.name}.`);
    } else if (action === "save-class-new") {
      const draft = this.readClassDraft();
      const nextClass = {
        ...draft,
        id: this.uniqueClassId(draft.name)
      };
      this.classDefinitions.push(nextClass);
      this.state.classId = nextClass.id;
      this.scene.setClassDefinitions(this.classDefinitions);
      this.updatePanel();
      this.flash(`Created ${nextClass.name}.`);
    } else if (action === "update-material") {
      const draft = this.readMaterialDraft();
      this.replaceMaterialDefinition(draft);
      this.updatePanel();
      this.flash(`Updated ${draft.name}.`);
    } else if (action === "save-material-new") {
      const draft = this.readMaterialDraft();
      const nextMaterial = {
        ...draft,
        id: this.uniqueMaterialId(draft.name)
      };
      this.environmentMaterials.push(nextMaterial);
      this.state.terrain = nextMaterial.id;
      this.scene.setEnvironmentMaterials(this.environmentMaterials);
      this.updatePanel();
      this.flash(`Created ${nextMaterial.name}.`);
    } else if (action === "update-prop") {
      const draft = this.readPropDraft();
      this.replacePropDefinition(draft);
      this.updatePanel();
      this.flash(`Updated ${draft.name}.`);
    } else if (action === "save-prop-new") {
      const draft = this.readPropDraft();
      const nextProp = {
        ...draft,
        id: this.uniquePropId(draft.name)
      };
      this.propDefinitions.push(nextProp);
      this.state.obstacle = nextProp.id;
      this.scene.setPropDefinitions(this.propDefinitions);
      this.updatePanel();
      this.flash(`Created ${nextProp.name}.`);
    } else if (action === "update-environment") {
      const level = this.currentLevel();
      const next = {
        ...level,
        environment: this.readEnvironmentDraft(level)
      };
      this.setCurrentLevel(next);
      this.scene.setLevel(next);
      this.updatePanel();
      this.flash("Updated level environment.");
    } else if (action === "clear-ground-texture") {
      const level = this.currentLevel();
      const next = {
        ...level,
        environment: {
          ...this.readEnvironmentDraft(level),
          groundTextureUrl: ""
        }
      };
      this.setCurrentLevel(next);
      this.scene.setLevel(next);
      this.updatePanel();
      this.flash("Cleared ground texture.");
    } else if (action === "add-surrounding") {
      const level = this.currentLevel();
      const xInput = this.panel.querySelector<HTMLInputElement>("[data-surrounding='x']");
      const zInput = this.panel.querySelector<HTMLInputElement>("[data-surrounding='z']");
      const rotationInput = this.panel.querySelector<HTMLInputElement>("[data-surrounding='rotation']");
      const scaleInput = this.panel.querySelector<HTMLInputElement>("[data-surrounding='scale']");
      const next = {
        ...level,
        surroundings: [
          ...level.surroundings,
          {
            id: `sur-${this.state.obstacle}-${Date.now()}`,
            type: this.state.obstacle,
            x: Math.round(numberOrFallback(xInput?.value, -2)),
            z: Math.round(numberOrFallback(zInput?.value, 0)),
            rotation: numberOrFallback(rotationInput?.value, 0),
            scale: Math.max(0.2, Math.min(3, numberOrFallback(scaleInput?.value, 1)))
          }
        ]
      };
      this.setCurrentLevel(next);
      this.scene.setLevel(next);
      this.updatePanel();
      this.flash(`Added surrounding ${this.selectedProp().name}.`);
    } else if (action === "clear-surroundings") {
      const level = this.currentLevel();
      const next = {
        ...level,
        surroundings: []
      };
      this.setCurrentLevel(next);
      this.scene.setLevel(next);
      this.updatePanel();
      this.flash("Cleared surrounding props.");
    } else if (action === "duplicate-level") {
      const source = this.currentLevel();
      const copy = cloneLevel(source);
      copy.id = `${source.id}-copy-${this.levels.length + 1}`;
      copy.name = `${source.name} Copy`;
      copy.links = [];
      this.levels.push(copy);
      this.campaign.levels.push({ id: copy.id, file: `levels/${copy.id}.json`, next: [] });
      this.state.levelId = copy.id;
      this.state.selected = undefined;
      this.render(true);
    } else if (action === "save-local") {
      saveLevel(this.currentLevel());
      saveCampaign(this.campaign);
      localStorage.setItem(templatesStorageKey, JSON.stringify(this.templates, null, 2));
      localStorage.setItem(classesStorageKey, JSON.stringify(this.classDefinitions, null, 2));
      localStorage.setItem(materialsStorageKey, JSON.stringify(this.environmentMaterials, null, 2));
      localStorage.setItem(propsStorageKey, JSON.stringify(this.propDefinitions, null, 2));
      this.flash("Saved campaign, level, builds, classes, materials, and props.");
    } else if (action === "load-sample") {
      this.levels = defaultLevels.map((level) => normalizeLevelData(cloneLevel(level)));
      this.campaign = structuredClone(defaultCampaign);
      this.templates = unitTemplates.map((template) => structuredClone(template));
      this.classDefinitions = defaultClassDefinitions.map((classDefinition) => structuredClone(classDefinition));
      this.environmentMaterials = defaultEnvironmentMaterials.map((material) => structuredClone(material));
      this.propDefinitions = defaultPropDefinitions.map((prop) => structuredClone(prop));
      this.state.levelId = this.campaign.startLevel;
      this.state.templateId = this.templates[1]?.id ?? this.templates[0].id;
      this.state.classId = this.classDefinitions[0].id;
      this.state.terrain = this.environmentMaterials[0].id;
      this.state.obstacle = this.propDefinitions[0].id;
      this.state.selected = undefined;
      this.scene.setClassDefinitions(this.classDefinitions);
      this.scene.setEnvironmentMaterials(this.environmentMaterials);
      this.scene.setPropDefinitions(this.propDefinitions);
      this.render(true);
    } else if (action === "copy-json") {
      const textarea = this.panel.querySelector<HTMLTextAreaElement>("[data-json]");
      if (textarea) {
        void navigator.clipboard?.writeText(textarea.value);
        this.flash("Copied editor JSON.");
      }
    } else if (action === "import-json") {
      this.importJson();
    } else if (action === "next-level") {
      const nextId = this.currentLevel().links[0]?.to ?? this.campaign.levels.find((level) => level.id === this.state.levelId)?.next[0];
      if (nextId && this.levels.some((level) => level.id === nextId)) {
        this.state.levelId = nextId;
        this.state.selected = undefined;
        this.render(true);
      } else {
        this.flash("No next level is configured.");
      }
    }
  }

  private importJson(): void {
    const textarea = this.panel.querySelector<HTMLTextAreaElement>("[data-json]");
    if (!textarea) {
      return;
    }
    try {
      const parsed = JSON.parse(textarea.value) as {
        campaign?: CampaignData;
        level?: LevelData;
        templates?: UnitTemplate[];
        classes?: ClassDefinition[];
        classDefinitions?: ClassDefinition[];
        terrainMaterials?: EnvironmentMaterialDefinition[];
        environmentMaterials?: EnvironmentMaterialDefinition[];
        props?: PropDefinition[];
        propDefinitions?: PropDefinition[];
      };
      if (parsed.campaign) {
        this.campaign = parsed.campaign;
      }
      const incomingMaterials = parsed.terrainMaterials ?? parsed.environmentMaterials;
      if (incomingMaterials?.length) {
        this.environmentMaterials = mergeMaterialDefinitions(defaultEnvironmentMaterials, incomingMaterials);
        if (!this.environmentMaterials.some((material) => material.id === this.state.terrain)) {
          this.state.terrain = this.environmentMaterials[0].id;
        }
        this.scene.setEnvironmentMaterials(this.environmentMaterials);
      }
      const incomingProps = parsed.props ?? parsed.propDefinitions;
      if (incomingProps?.length) {
        this.propDefinitions = mergePropDefinitions(defaultPropDefinitions, incomingProps);
        if (!this.propDefinitions.some((prop) => prop.id === this.state.obstacle)) {
          this.state.obstacle = this.propDefinitions[0].id;
        }
        this.scene.setPropDefinitions(this.propDefinitions);
      }
      const incomingClasses = parsed.classes ?? parsed.classDefinitions;
      if (incomingClasses?.length) {
        this.classDefinitions = mergeClassDefinitions(defaultClassDefinitions, incomingClasses);
        if (!this.classDefinitions.some((classDefinition) => classDefinition.id === this.state.classId)) {
          this.state.classId = this.classDefinitions[0].id;
        }
        this.scene.setClassDefinitions(this.classDefinitions);
      }
      if (parsed.templates?.length) {
        this.templates = parsed.templates;
        if (!this.templates.some((template) => template.id === this.state.templateId)) {
          this.state.templateId = this.templates[0].id;
        }
      }
      if (parsed.level) {
        const normalizedLevel = normalizeLevelData(parsed.level);
        this.setCurrentLevel(normalizedLevel);
        if (!this.levels.some((level) => level.id === parsed.level?.id)) {
          this.levels.push(normalizedLevel);
        }
        this.state.levelId = normalizedLevel.id;
      }
      this.render(true);
      this.flash("Imported editor JSON.");
    } catch {
      this.flash("Import failed: invalid JSON.");
    }
  }

  private flash(message: string): void {
    const chip = this.root.querySelector("#status-chip");
    if (chip) {
      chip.textContent = message;
    }
  }
}
