import { classNames, defaultCampaign, defaultLevels, unitTemplates } from "../game/content";
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
import type { CampaignData, ClassName, EditorTool, LevelData, ObstacleType, SectionName, Team, TerrainType, TileCoord, UnitTemplate } from "../game/schema";
import { LevelScene } from "../render/LevelScene";

const directionLabels = ["S", "E", "N", "W"] as const;
const sectionNames: SectionName[] = ["head", "body", "legs"];

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

interface EditorState {
  mode: "editor" | "play";
  tool: EditorTool;
  terrain: TerrainType;
  obstacle: ObstacleType;
  team: Team;
  templateId: string;
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
  private templates: UnitTemplate[] = unitTemplates.map((template) => structuredClone(template));
  private state: EditorState = {
    mode: "editor",
    tool: "select",
    terrain: "grass",
    obstacle: "wall",
    team: "enemy",
    templateId: unitTemplates[1].id,
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
    this.scene = new LevelScene(this.canvas);
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

  private readBuildDraft(templateId = this.state.templateId): UnitTemplate {
    const fallback = this.selectedTemplate();
    const nameInput = this.panel.querySelector<HTMLInputElement>("[data-build='name']");
    const hpInput = this.panel.querySelector<HTMLInputElement>("[data-build='hp']");
    const faces = structuredClone(fallback.faces);
    for (const section of sectionNames) {
      for (let index = 0; index < directionLabels.length; index += 1) {
        const select = this.panel.querySelector<HTMLSelectElement>(`[data-face-section='${section}'][data-face-index='${index}']`);
        faces[section][index] = (select?.value as ClassName | undefined) ?? faces[section][index];
      }
    }
    return {
      id: templateId,
      name: nameInput?.value.trim() || fallback.name,
      hp: Math.max(1, Math.min(99, Number(hpInput?.value || fallback.hp))),
      faces
    };
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
    const json = JSON.stringify({ campaign: this.campaign, level, templates: this.templates }, null, 2);
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
                            ${classNames
                              .map(
                                (className) =>
                                  `<option value="${className}" ${currentTemplate.faces[section][index] === className ? "selected" : ""}>${className}</option>`
                              )
                              .join("")}
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
        this.render();
      });
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
      localStorage.setItem("craft-heroes-unit-templates", JSON.stringify(this.templates, null, 2));
      this.flash("Saved campaign and level to browser storage.");
    } else if (action === "load-sample") {
      this.levels = defaultLevels.map(cloneLevel);
      this.campaign = structuredClone(defaultCampaign);
      this.templates = unitTemplates.map((template) => structuredClone(template));
      this.state.levelId = this.campaign.startLevel;
      this.state.templateId = this.templates[1]?.id ?? this.templates[0].id;
      this.state.selected = undefined;
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
      const parsed = JSON.parse(textarea.value) as { campaign?: CampaignData; level?: LevelData; templates?: UnitTemplate[] };
      if (parsed.campaign) {
        this.campaign = parsed.campaign;
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
