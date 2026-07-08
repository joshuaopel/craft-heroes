import { defaultCampaign, defaultClassDefinitions, defaultLevels, unitTemplates } from "../game/content";
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
  LevelData,
  ObstacleType,
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

function initialClassDefinitions(): ClassDefinition[] {
  const stored = readStoredJson<ClassDefinition[]>(classesStorageKey);
  return Array.isArray(stored) && stored.length > 0
    ? mergeClassDefinitions(defaultClassDefinitions, stored)
    : defaultClassDefinitions.map((classDefinition) => structuredClone(classDefinition));
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
  private levels: LevelData[] = defaultLevels.map(cloneLevel);
  private campaign: CampaignData = structuredClone(defaultCampaign);
  private templates: UnitTemplate[] = initialTemplates();
  private classDefinitions: ClassDefinition[] = initialClassDefinitions();
  private state: EditorState = {
    mode: "editor",
    tool: "select",
    terrain: "grass",
    obstacle: "wall",
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
    this.scene = new LevelScene(this.canvas, this.classDefinitions);
    this.scene.onTileClick((coord) => this.handleTileClick(coord));
    this.render(true);
  }

  private currentLevel(): LevelData {
    return this.levels.find((level) => level.id === this.state.levelId) ?? this.levels[0];
  }

  private setCurrentLevel(level: LevelData): void {
    this.levels = this.levels.map((candidate) => (candidate.id === level.id ? level : candidate));
  }

  private selectedTemplate(): UnitTemplate {
    return this.templates.find((template) => template.id === this.state.templateId) ?? this.templates[0];
  }

  private selectedClass(): ClassDefinition {
    return this.classDefinitions.find((classDefinition) => classDefinition.id === this.state.classId) ?? this.classDefinitions[0];
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

  private classOptions(selectedId: ClassId): string {
    return this.classDefinitions
      .map(
        (classDefinition) =>
          `<option value="${escapeHtml(classDefinition.id)}" ${classDefinition.id === selectedId ? "selected" : ""}>${escapeHtml(classDefinition.name)}</option>`
      )
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
    const json = JSON.stringify({ campaign: this.campaign, level, templates: this.templates, classes: this.classDefinitions }, null, 2);
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
            ${(["grass", "stone", "sand", "water"] as TerrainType[])
              .map((terrain) => `<option value="${terrain}" ${terrain === this.state.terrain ? "selected" : ""}>${terrain}</option>`)
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Obstacle</span>
          <select data-field="obstacle">
            ${(["wall", "tower", "tree", "cover"] as ObstacleType[])
              .map((obstacle) => `<option value="${obstacle}" ${obstacle === this.state.obstacle ? "selected" : ""}>${obstacle}</option>`)
              .join("")}
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
        <span>${level.width} x ${level.depth} board / ${level.units.length} units / ${level.obstacles.length} obstacles</span>
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
      this.flash("Saved campaign, level, builds, and classes to browser storage.");
    } else if (action === "load-sample") {
      this.levels = defaultLevels.map(cloneLevel);
      this.campaign = structuredClone(defaultCampaign);
      this.templates = unitTemplates.map((template) => structuredClone(template));
      this.classDefinitions = defaultClassDefinitions.map((classDefinition) => structuredClone(classDefinition));
      this.state.levelId = this.campaign.startLevel;
      this.state.templateId = this.templates[1]?.id ?? this.templates[0].id;
      this.state.classId = this.classDefinitions[0].id;
      this.state.selected = undefined;
      this.scene.setClassDefinitions(this.classDefinitions);
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
      };
      if (parsed.campaign) {
        this.campaign = parsed.campaign;
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
        this.setCurrentLevel(parsed.level);
        if (!this.levels.some((level) => level.id === parsed.level?.id)) {
          this.levels.push(parsed.level);
        }
        this.state.levelId = parsed.level.id;
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
