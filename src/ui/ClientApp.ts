import {
  defaultCampaign,
  defaultClassDefinitions,
  defaultEnvironmentMaterials,
  defaultEnvironmentSettings,
  defaultLevels,
  defaultPropDefinitions
} from "../game/content";
import type {
  AbilityDefinition,
  CampaignData,
  ClassDefinition,
  EnvironmentMaterialDefinition,
  LevelData,
  PropDefinition,
  SectionName,
  StoryBeat,
  TitleScreenSettings,
  TileCoord,
  UnitData
} from "../game/schema";
import { LevelScene } from "../render/LevelScene";

const sectionNames: SectionName[] = ["head", "body", "legs"];
type ClientCommand = "select" | "move" | "attack";

function titleScreenSettings(campaign: CampaignData): TitleScreenSettings {
  const fallback = defaultCampaign.titleScreen;
  return {
    kicker: campaign.titleScreen?.kicker || fallback?.kicker || "Voxel tactics prototype",
    headline: campaign.titleScreen?.headline || fallback?.headline || "Craft Heroes",
    subhead:
      campaign.titleScreen?.subhead ||
      fallback?.subhead ||
      "Rotate class faces, chain handmade levels, and test the build language for a Steam-ready tactics pitch.",
    backgroundLevelId: campaign.titleScreen?.backgroundLevelId || fallback?.backgroundLevelId || campaign.startLevel,
    cameraOrbit: campaign.titleScreen?.cameraOrbit ?? fallback?.cameraOrbit ?? true,
    orbitSpeed: Math.max(0.01, Math.min(0.4, Number(campaign.titleScreen?.orbitSpeed ?? fallback?.orbitSpeed ?? 0.08))),
    mockBattle: campaign.titleScreen?.mockBattle ?? fallback?.mockBattle ?? true
  };
}

export interface ClientBundle {
  campaign?: CampaignData;
  levels?: LevelData[];
  level?: LevelData;
  classes?: ClassDefinition[];
  classDefinitions?: ClassDefinition[];
  terrainMaterials?: EnvironmentMaterialDefinition[];
  environmentMaterials?: EnvironmentMaterialDefinition[];
  props?: PropDefinition[];
  propDefinitions?: PropDefinition[];
}

export interface ClientSaveData {
  version: 1;
  campaignId: string;
  currentLevelId: string;
  shownStory: string[];
}

export interface ClientPresence {
  campaignId: string;
  campaignTitle: string;
  levelId: string;
  levelName: string;
}

export interface ClientAppOptions {
  showContentLoader?: boolean;
  showEditorLink?: boolean;
  requestContent?: () => Promise<unknown | unknown[] | undefined>;
  onProgress?: (save: ClientSaveData) => void | Promise<void>;
  onPresence?: (presence: ClientPresence) => void | Promise<void>;
  onAchievement?: (achievementId: string) => void | Promise<void>;
}

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

function normalizeLevel(level: LevelData): LevelData {
  return {
    ...level,
    environment: {
      ...defaultEnvironmentSettings,
      ...(level.environment ?? {}),
      backgroundModel: {
        ...defaultEnvironmentSettings.backgroundModel,
        ...(level.environment?.backgroundModel ?? {})
      }
    },
    obstacles: Array.isArray(level.obstacles)
      ? level.obstacles.map((obstacle) => ({
          ...obstacle,
          rotation: Number.isFinite(obstacle.rotation) ? obstacle.rotation : 0
        }))
      : [],
    surroundings: Array.isArray(level.surroundings) ? level.surroundings : [],
    units: Array.isArray(level.units) ? level.units : [],
    objectives: Array.isArray(level.objectives) ? level.objectives : [],
    links: Array.isArray(level.links) ? level.links : [],
    story: Array.isArray(level.story) ? level.story : []
  };
}

function isLevel(value: unknown): value is LevelData {
  const candidate = value as Partial<LevelData> | undefined;
  return Boolean(candidate && typeof candidate.id === "string" && Array.isArray(candidate.tiles));
}

function isCampaign(value: unknown): value is CampaignData {
  const candidate = value as Partial<CampaignData> | undefined;
  return Boolean(candidate && typeof candidate.id === "string" && typeof candidate.startLevel === "string" && Array.isArray(candidate.levels));
}

function objectiveLabel(level: LevelData): string {
  const objective = level.objectives[0];
  if (!objective) {
    return "Explore the battlefield";
  }
  if (objective.type === "defeatTeam") {
    return `Defeat the ${objective.team ?? "enemy"} team`;
  }
  if (objective.type === "reachTile") {
    return `Reach tile ${objective.x ?? 0}, ${objective.z ?? 0}`;
  }
  return `Survive ${objective.rounds ?? 1} rounds`;
}

export class ClientApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly scene: LevelScene;
  private readonly levelName: HTMLElement;
  private readonly objective: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly storyLayer: HTMLElement;
  private readonly titleLayer: HTMLElement;
  private readonly abilityStrip: HTMLElement;
  private readonly fxLayer: HTMLElement;
  private readonly footerLabel: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private campaign: CampaignData = structuredClone(defaultCampaign);
  private levels: LevelData[] = defaultLevels.map((level) => normalizeLevel(structuredClone(level)));
  private classDefinitions: ClassDefinition[] = structuredClone(defaultClassDefinitions);
  private environmentMaterials: EnvironmentMaterialDefinition[] = structuredClone(defaultEnvironmentMaterials);
  private propDefinitions: PropDefinition[] = structuredClone(defaultPropDefinitions);
  private currentLevelId = this.campaign.startLevel;
  private storyQueue: StoryBeat[] = [];
  private shownStory = new Set<string>();
  private advancingAfterStory = false;
  private started = false;
  private titleOpen = false;
  private titleDemoTimer?: number;
  private titleDemoIndex = 0;
  private titlePreviewLevel?: LevelData;
  private selectedUnitId?: string;
  private command: ClientCommand = "select";
  private round = 1;

  constructor(
    private readonly root: HTMLElement,
    private readonly options: ClientAppOptions = {}
  ) {
    const showContentLoader = options.showContentLoader ?? true;
    const showEditorLink = options.showEditorLink ?? false;
    this.root.className = "app-shell client-shell";
    this.root.innerHTML = `
      <canvas class="world-canvas" aria-label="Craft Heroes game board"></canvas>
      <div class="client-hud">
        <div class="mission-chip">
          <span id="client-progress"></span>
          <strong id="client-level-name"></strong>
          <span id="client-objective"></span>
        </div>
        <div class="client-actions">
          ${showContentLoader ? `<button data-client-action="load">Load Game</button>` : ""}
          ${showEditorLink ? `<button data-client-action="editor">Editor</button>` : ""}
          <button data-client-action="menu">Menu</button>
        </div>
      </div>
      <div class="ability-strip" id="client-ability-strip"></div>
      <div class="client-footer">
        <span id="client-footer-label">Awaiting orders</span>
        <button data-client-action="select">Select</button>
        <button data-client-action="move">Move</button>
        <button data-client-action="attack">Attack</button>
        <button data-client-action="rotate-head">Head</button>
        <button data-client-action="rotate-body">Body</button>
        <button data-client-action="rotate-legs">Legs</button>
        <button data-client-action="wait">Wait</button>
        <button data-client-action="complete">Resolve</button>
      </div>
      <input class="visually-hidden" data-client-files type="file" accept=".json,application/json" multiple>
      <div class="story-layer" aria-live="polite"></div>
      <div class="fx-layer" aria-hidden="true"></div>
      <div class="title-layer open" aria-live="polite"></div>
    `;
    this.canvas = this.root.querySelector(".world-canvas") as HTMLCanvasElement;
    this.levelName = this.root.querySelector("#client-level-name") as HTMLElement;
    this.objective = this.root.querySelector("#client-objective") as HTMLElement;
    this.progress = this.root.querySelector("#client-progress") as HTMLElement;
    this.storyLayer = this.root.querySelector(".story-layer") as HTMLElement;
    this.titleLayer = this.root.querySelector(".title-layer") as HTMLElement;
    this.abilityStrip = this.root.querySelector("#client-ability-strip") as HTMLElement;
    this.fxLayer = this.root.querySelector(".fx-layer") as HTMLElement;
    this.footerLabel = this.root.querySelector("#client-footer-label") as HTMLElement;
    this.fileInput = this.root.querySelector("[data-client-files]") as HTMLInputElement;
    this.scene = new LevelScene(this.canvas, this.classDefinitions, this.environmentMaterials, this.propDefinitions);
    this.scene.setMode("play");
    this.scene.onTileClick((coord) => this.handleTile(coord));
    this.bindEvents();
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.loadLevel(this.currentLevelId, { showStory: false });
    this.showTitleScreen();
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-client-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.clientAction;
        if (action === "load") {
          if (this.options.requestContent) {
            void this.options.requestContent().then((content) => {
              if (content !== undefined) {
                this.loadContent(content);
              }
            }).catch((error) => {
              this.showError(error instanceof Error ? error.message : "Unable to load game content.");
            });
          } else {
            this.fileInput.click();
          }
        } else if (action === "editor") {
          window.location.href = window.location.pathname;
        } else if (action === "menu") {
          this.showTitleScreen("", { useTitleBackdrop: false });
        } else if (action === "complete") {
          this.completeLevel();
        } else if (action === "select" || action === "move" || action === "attack") {
          this.setCommand(action);
        } else if (action === "rotate-head" || action === "rotate-body" || action === "rotate-legs") {
          this.rotateSelectedSection(action.replace("rotate-", "") as SectionName);
        } else if (action === "wait") {
          this.endPlayerTurn();
        }
      });
    });
    this.fileInput.addEventListener("change", () => void this.loadFiles(this.fileInput.files));
  }

  loadContent(content: unknown | unknown[]): boolean {
    try {
      const documents = Array.isArray(content) && content.every(isLevel) ? content : Array.isArray(content) ? content : [content];
      const incomingLevels: LevelData[] = [];
      let incomingCampaign: CampaignData | undefined;
      let bundleDefinitions: ClientBundle = {};

      for (const parsed of documents) {
        if (isLevel(parsed)) {
          incomingLevels.push(parsed);
          continue;
        }
        if (isCampaign(parsed)) {
          incomingCampaign = parsed;
          continue;
        }
        const bundle = parsed as ClientBundle;
        bundleDefinitions = { ...bundleDefinitions, ...bundle };
        if (bundle.campaign) {
          incomingCampaign = bundle.campaign;
        }
        if (bundle.levels?.every(isLevel)) {
          incomingLevels.push(...bundle.levels);
        }
        if (bundle.level && isLevel(bundle.level)) {
          incomingLevels.push(bundle.level);
        }
      }

      if (incomingLevels.length === 0) {
        throw new Error("No level data found.");
      }
      const byId = new Map(incomingLevels.map((level) => [level.id, normalizeLevel(level)]));
      this.levels = [...byId.values()];
      this.campaign = incomingCampaign ?? {
        id: "loaded-campaign",
        title: "Loaded Craft Heroes Campaign",
        startLevel: this.levels[0].id,
        titleScreen: {
          ...titleScreenSettings(defaultCampaign),
          backgroundLevelId: this.levels[0].id
        },
        levels: this.levels.map((level, index) => ({
          id: level.id,
          file: "",
          next: this.levels[index + 1] ? [this.levels[index + 1].id] : []
        }))
      };
      this.classDefinitions = bundleDefinitions.classes ?? bundleDefinitions.classDefinitions ?? structuredClone(defaultClassDefinitions);
      this.environmentMaterials =
        bundleDefinitions.terrainMaterials ??
        bundleDefinitions.environmentMaterials ??
        structuredClone(defaultEnvironmentMaterials);
      this.propDefinitions = bundleDefinitions.props ?? bundleDefinitions.propDefinitions ?? structuredClone(defaultPropDefinitions);
      this.scene.setClassDefinitions(this.classDefinitions);
      this.scene.setEnvironmentMaterials(this.environmentMaterials);
      this.scene.setPropDefinitions(this.propDefinitions);
      this.storyQueue = [];
      this.shownStory.clear();
      const startId = this.levels.some((level) => level.id === this.campaign.startLevel)
        ? this.campaign.startLevel
        : this.levels[0].id;
      this.started = true;
      this.currentLevelId = startId;
      this.loadLevel(startId, { showStory: false });
      this.showTitleScreen();
      return true;
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "Unable to read campaign data.");
      return false;
    }
  }

  exportSave(): ClientSaveData {
    return {
      version: 1,
      campaignId: this.campaign.id,
      currentLevelId: this.currentLevelId,
      shownStory: [...this.shownStory]
    };
  }

  registerSave(save: ClientSaveData): boolean {
    if (!this.isCompatibleSave(save)) {
      return false;
    }
    this.writeLocalSave(save);
    if (this.titleOpen) {
      this.showTitleScreen();
    }
    return true;
  }

  restoreSave(save: ClientSaveData): boolean {
    if (!this.isCompatibleSave(save)) {
      return false;
    }
    this.storyQueue = [];
    this.shownStory = new Set(save.shownStory);
    this.started = true;
    this.writeLocalSave(save);
    this.closeTitleScreen();
    this.loadLevel(save.currentLevelId);
    return true;
  }

  private isCompatibleSave(save: ClientSaveData): boolean {
    return save.version === 1 && save.campaignId === this.campaign.id && this.levels.some((level) => level.id === save.currentLevelId);
  }

  private saveSlotKey(): string {
    return `craft-heroes-client-save:${this.campaign.id}`;
  }

  private readLocalSave(): ClientSaveData | undefined {
    try {
      const raw = localStorage.getItem(this.saveSlotKey());
      if (!raw) {
        return undefined;
      }
      const parsed = JSON.parse(raw) as ClientSaveData;
      return parsed.version === 1 && parsed.campaignId === this.campaign.id ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  private writeLocalSave(save: ClientSaveData): void {
    try {
      localStorage.setItem(this.saveSlotKey(), JSON.stringify(save));
    } catch {
      // Local browser storage is best-effort; host saves still run below.
    }
  }

  private clearLocalSave(): void {
    try {
      localStorage.removeItem(this.saveSlotKey());
    } catch {
      // Ignore storage failures.
    }
  }

  private newGame(): void {
    this.storyQueue = [];
    this.shownStory.clear();
    this.advancingAfterStory = false;
    this.round = 1;
    this.clearLocalSave();
    this.closeTitleScreen();
    this.loadLevel(this.campaign.startLevel);
    this.notifyProgress();
  }

  private continueGame(): void {
    const save = this.readLocalSave();
    if (!save || !this.restoreSave(save)) {
      this.showTitleScreen("No compatible save exists for this campaign yet.");
    }
  }

  private showTitleScreen(message = "", options: { useTitleBackdrop?: boolean } = {}): void {
    const save = this.readLocalSave();
    const settings = titleScreenSettings(this.campaign);
    if (options.useTitleBackdrop ?? true) {
      this.activateTitleBackdrop(settings);
    } else {
      this.scene.setTitleOrbit(false);
      this.stopTitleDemoLoop();
    }
    this.titleOpen = true;
    this.scene.setInteractionEnabled(false);
    this.storyLayer.className = "story-layer";
    this.storyLayer.innerHTML = "";
    this.titleLayer.className = "title-layer open";
    this.titleLayer.innerHTML = `
      <div class="title-panel">
        <span class="title-kicker">${escapeHtml(settings.kicker)}</span>
        <h1>${escapeHtml(settings.headline)}</h1>
        <p>${escapeHtml(settings.subhead)}</p>
        ${message ? `<div class="title-message">${escapeHtml(message)}</div>` : ""}
        <div class="title-actions">
          <button data-title-action="new">New Game</button>
          <button data-title-action="continue" ${save ? "" : "disabled"}>Continue</button>
          <button data-title-action="options">Options</button>
          ${this.options.showContentLoader ?? true ? `<button data-title-action="load">Load Content</button>` : ""}
        </div>
        <div class="title-save">
          <strong>${save ? "Save Found" : "No Save Yet"}</strong>
          <span>${save ? `Continue from ${escapeHtml(save.currentLevelId)}` : "Start a new campaign to create a local save."}</span>
        </div>
      </div>
    `;
    this.bindTitleEvents();
  }

  private activateTitleBackdrop(settings: TitleScreenSettings): void {
    const level =
      this.levels.find((candidate) => candidate.id === settings.backgroundLevelId) ??
      this.levels.find((candidate) => candidate.id === this.campaign.startLevel) ??
      this.levels[0];
    if (!level) {
      return;
    }
    this.titlePreviewLevel = level;
    this.scene.setLevel(level, { frame: true });
    this.scene.setSelected(undefined);
    this.updateHud(level);
    this.scene.setInteractionEnabled(false);
    this.scene.setTitleOrbit(settings.cameraOrbit, settings.orbitSpeed);
    if (settings.mockBattle) {
      this.startTitleDemoLoop(level);
    } else {
      this.stopTitleDemoLoop();
    }
  }

  private startTitleDemoLoop(level: LevelData): void {
    this.stopTitleDemoLoop();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const actions = ["attack", "move", "rotate"] as const;
    const tick = () => {
      if (!this.titleOpen) {
        return;
      }
      this.showActionFx(actions[this.titleDemoIndex % actions.length], level, { allowDuringTitle: true });
      this.titleDemoIndex += 1;
    };
    window.setTimeout(tick, 650);
    this.titleDemoTimer = window.setInterval(tick, 2100);
  }

  private stopTitleDemoLoop(): void {
    if (this.titleDemoTimer !== undefined) {
      window.clearInterval(this.titleDemoTimer);
      this.titleDemoTimer = undefined;
    }
  }

  private showOptionsScreen(): void {
    this.titleOpen = true;
    this.scene.setInteractionEnabled(false);
    this.titleLayer.className = "title-layer open";
    this.titleLayer.innerHTML = `
      <div class="title-panel options-panel">
        <span class="title-kicker">Options</span>
        <h1>Preview Settings</h1>
        <div class="options-grid">
          <label class="check-row">
            <input data-option-reduced-motion type="checkbox" ${window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "checked" : ""}>
            <span>Respect reduced motion for menu and FX animation.</span>
          </label>
          <label class="check-row">
            <input data-option-camera type="checkbox" checked>
            <span>Enable orbit camera while playing.</span>
          </label>
        </div>
        <div class="title-actions">
          <button data-title-action="back">Back</button>
        </div>
      </div>
    `;
    this.bindTitleEvents();
  }

  private bindTitleEvents(): void {
    this.titleLayer.querySelectorAll<HTMLButtonElement>("[data-title-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.titleAction;
        if (action === "new") {
          this.newGame();
        } else if (action === "continue") {
          this.continueGame();
        } else if (action === "options") {
          this.showOptionsScreen();
        } else if (action === "back") {
          this.showTitleScreen();
        } else if (action === "load") {
          if (this.options.requestContent) {
            void this.options.requestContent().then((content) => {
              if (content !== undefined) {
                this.loadContent(content);
              }
            });
          } else {
            this.fileInput.click();
          }
        }
      });
    });
  }

  private closeTitleScreen(): void {
    this.titleOpen = false;
    this.stopTitleDemoLoop();
    this.scene.setTitleOrbit(false);
    this.titlePreviewLevel = undefined;
    this.titleLayer.className = "title-layer";
    this.titleLayer.innerHTML = "";
    this.scene.setInteractionEnabled(true);
  }

  private currentLevel(): LevelData | undefined {
    return this.levels.find((level) => level.id === this.currentLevelId);
  }

  private loadLevel(levelId: string, options: { showStory?: boolean } = {}): void {
    const level = this.levels.find((candidate) => candidate.id === levelId) ?? this.levels[0];
    if (!level) {
      this.showError("No playable levels were found in those files.");
      return;
    }
    this.currentLevelId = level.id;
    this.advancingAfterStory = false;
    this.scene.setTitleOrbit(false);
    this.stopTitleDemoLoop();
    this.titlePreviewLevel = undefined;
    this.command = "select";
    this.selectedUnitId = this.firstPlayerUnit(level)?.id ?? level.units[0]?.id;
    this.scene.setLevel(level, { frame: true });
    this.scene.setSelected(this.selectedUnit(level) ? { x: this.selectedUnit(level)!.x, z: this.selectedUnit(level)!.z } : undefined);
    this.updateHud(level);
    if (options.showStory ?? true) {
      this.enqueueStory(level.story.filter((beat) => beat.trigger === "levelStart"));
    } else {
      this.storyLayer.className = "story-layer";
      this.storyLayer.innerHTML = "";
    }
    this.invokeHost("presence", () =>
      this.options.onPresence?.({
        campaignId: this.campaign.id,
        campaignTitle: this.campaign.title,
        levelId: level.id,
        levelName: level.name
      })
    );
  }

  private updateHud(level: LevelData): void {
    const campaignIndex = Math.max(0, this.campaign.levels.findIndex((entry) => entry.id === level.id));
    this.progress.textContent = `MISSION ${campaignIndex + 1} / ${Math.max(1, this.campaign.levels.length)} / ROUND ${this.round}`;
    this.levelName.textContent = level.name;
    this.objective.textContent = objectiveLabel(level);
    this.renderAbilityStrip(level);
    this.updateCommandButtons();
    this.updateFooterStatus(level);
  }

  private firstPlayerUnit(level: LevelData): UnitData | undefined {
    return level.units.find((unit) => unit.team === "player") ?? level.units[0];
  }

  private selectedUnit(level = this.currentLevel()): UnitData | undefined {
    if (!level) {
      return undefined;
    }
    return level.units.find((unit) => unit.id === this.selectedUnitId) ?? this.firstPlayerUnit(level);
  }

  private playerUnit(level: LevelData): UnitData | undefined {
    return this.selectedUnit(level) ?? this.firstPlayerUnit(level);
  }

  private unitAt(level: LevelData, coord: TileCoord): UnitData | undefined {
    return level.units.find((unit) => unit.x === coord.x && unit.z === coord.z);
  }

  private isBlocked(level: LevelData, coord: TileCoord): boolean {
    const obstacle = level.obstacles.find((item) => item.x === coord.x && item.z === coord.z);
    const prop = obstacle ? this.propDefinitions.find((definition) => definition.id === obstacle.type) : undefined;
    return Boolean(prop?.blocksMovement);
  }

  private isInsideLevel(level: LevelData, coord: TileCoord): boolean {
    return coord.x >= 0 && coord.z >= 0 && coord.x < level.width && coord.z < level.depth;
  }

  private distance(a: TileCoord, b: TileCoord): number {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }

  private sectionStats(level: LevelData, section: SectionName) {
    const classDefinition = this.frontClassForSection(level, section);
    return classDefinition.sections[section].stats;
  }

  private classForId(classId: string): ClassDefinition {
    return this.classDefinitions.find((classDefinition) => classDefinition.id === classId) ?? this.classDefinitions[0];
  }

  private frontClassForSection(level: LevelData, section: SectionName): ClassDefinition {
    const unit = this.playerUnit(level);
    const rotation = unit ? ((unit.rotations[section] % 4) + 4) % 4 : 0;
    return this.classForId(unit?.faces[section][rotation] ?? this.classDefinitions[0].id);
  }

  private primaryAbilityForSection(level: LevelData, section: SectionName): AbilityDefinition | undefined {
    const classDefinition = this.frontClassForSection(level, section);
    return classDefinition.sections[section].abilities[0];
  }

  private renderAbilityStrip(level: LevelData): void {
    this.abilityStrip.innerHTML = sectionNames
      .map((section) => {
        const classDefinition = this.frontClassForSection(level, section);
        const ability = this.primaryAbilityForSection(level, section);
        const label = section === "body" ? "Body / Arms" : section[0].toUpperCase() + section.slice(1);
        return `
          <div class="ability-chip" style="--ability-color: ${escapeHtml(ability?.color ?? classDefinition.color)}">
            <b>${escapeHtml(label)}</b>
            <span>${escapeHtml(classDefinition.name)}</span>
            <em>${escapeHtml(ability ? `${ability.icon} ${ability.name}` : "No ability")}</em>
          </div>
        `;
      })
      .join("");
  }

  private updateCommandButtons(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-client-action]").forEach((button) => {
      const action = button.dataset.clientAction;
      button.classList.toggle("active", action === this.command);
    });
  }

  private updateFooterStatus(level = this.currentLevel()): void {
    if (!level) {
      this.footerLabel.textContent = "No active level";
      return;
    }
    const unit = this.selectedUnit(level);
    if (!unit) {
      this.footerLabel.textContent = "No player unit";
      return;
    }
    const move = this.sectionStats(level, "legs").move;
    const range = Math.max(1, this.sectionStats(level, "body").range);
    const attack = this.sectionStats(level, "body").attack;
    if (this.command === "move") {
      this.footerLabel.textContent = `${unit.name} / move ${move}`;
    } else if (this.command === "attack") {
      this.footerLabel.textContent = `${unit.name} / attack ${attack} / range ${range}`;
    } else {
      this.footerLabel.textContent = `${unit.name} / HP ${unit.hp}`;
    }
  }

  private setCommand(command: ClientCommand): void {
    if (this.titleOpen || this.storyQueue.length > 0) {
      return;
    }
    this.command = command;
    const level = this.currentLevel();
    if (level) {
      const unit = this.selectedUnit(level);
      this.scene.setSelected(unit ? { x: unit.x, z: unit.z } : undefined);
      this.updateHud(level);
    }
  }

  private abilityForAction(action: "move" | "attack" | "rotate", sourceLevel = this.currentLevel()): AbilityDefinition | undefined {
    const level = sourceLevel;
    if (!level) {
      return undefined;
    }
    if (action === "move") {
      return this.primaryAbilityForSection(level, "legs");
    }
    if (action === "attack") {
      return this.primaryAbilityForSection(level, "body");
    }
    return this.primaryAbilityForSection(level, "head");
  }

  private showActionFx(action: "move" | "attack" | "rotate", sourceLevel = this.currentLevel(), options: { allowDuringTitle?: boolean } = {}): void {
    if ((!options.allowDuringTitle && this.titleOpen) || this.storyQueue.length > 0) {
      return;
    }
    const ability = this.abilityForAction(action, sourceLevel);
    const fallback = action === "move" ? "MV" : action === "attack" ? "AT" : "RT";
    const label = action === "move" ? "Movement preview" : action === "attack" ? "Attack preview" : "Face rotation preview";
    const color = ability?.color ?? (action === "attack" ? "#ff6d62" : action === "move" ? "#60d7e4" : "#f2bd55");
    const chip = document.createElement("div");
    chip.className = `action-fx action-fx-${action}`;
    chip.style.setProperty("--fx-color", color);
    chip.innerHTML = `
      <strong>${escapeHtml(ability?.icon ?? fallback)}</strong>
      <span>${escapeHtml(ability?.name ?? label)}</span>
    `;
    this.fxLayer.appendChild(chip);
    this.canvas.classList.remove("fx-wobble");
    void this.canvas.offsetWidth;
    this.canvas.classList.add("fx-wobble");
    this.footerLabel.textContent = ability?.description || label;
    window.setTimeout(() => {
      chip.remove();
      this.canvas.classList.remove("fx-wobble");
    }, 950);
  }

  private rotateSelectedSection(section: SectionName): void {
    const level = this.currentLevel();
    const unit = this.selectedUnit(level);
    if (!level || !unit || this.titleOpen || this.storyQueue.length > 0) {
      return;
    }
    unit.rotations[section] = (unit.rotations[section] + 1) % 4;
    this.scene.setLevel(level);
    this.scene.setSelected({ x: unit.x, z: unit.z });
    this.renderAbilityStrip(level);
    this.showActionFx("rotate");
    this.updateHud(level);
    this.notifyProgress();
  }

  private tryMoveSelected(coord: TileCoord): void {
    const level = this.currentLevel();
    const unit = this.selectedUnit(level);
    if (!level || !unit) {
      return;
    }
    const moveRange = Math.max(1, this.sectionStats(level, "legs").move);
    if (!this.isInsideLevel(level, coord)) {
      this.footerLabel.textContent = "Out of bounds.";
      return;
    }
    if (this.unitAt(level, coord) && this.unitAt(level, coord)?.id !== unit.id) {
      this.footerLabel.textContent = "Tile occupied.";
      return;
    }
    if (this.isBlocked(level, coord)) {
      this.footerLabel.textContent = "Path blocked.";
      return;
    }
    if (this.distance(unit, coord) > moveRange) {
      this.footerLabel.textContent = `Move range ${moveRange}.`;
      return;
    }
    unit.x = coord.x;
    unit.z = coord.z;
    this.command = "select";
    this.scene.setLevel(level);
    this.scene.setSelected({ x: unit.x, z: unit.z });
    this.showActionFx("move");
    this.enqueueStory(
      level.story.filter(
        (beat) => beat.trigger === "tileEnter" && beat.x === coord.x && beat.z === coord.z
      )
    );
    this.updateHud(level);
    this.notifyProgress();
  }

  private tryAttackTarget(coord: TileCoord): void {
    const level = this.currentLevel();
    const unit = this.selectedUnit(level);
    if (!level || !unit) {
      return;
    }
    const target = this.unitAt(level, coord);
    if (!target || target.team === unit.team) {
      this.footerLabel.textContent = "No enemy target.";
      return;
    }
    const range = Math.max(1, this.sectionStats(level, "body").range);
    if (this.distance(unit, target) > range) {
      this.footerLabel.textContent = `Attack range ${range}.`;
      return;
    }
    const attack = Math.max(1, this.sectionStats(level, "body").attack);
    target.hp -= attack;
    if (target.hp <= 0) {
      level.units = level.units.filter((candidate) => candidate.id !== target.id);
      this.footerLabel.textContent = `${target.name} defeated.`;
    } else {
      this.footerLabel.textContent = `${target.name} HP ${target.hp}.`;
    }
    this.command = "select";
    this.scene.setLevel(level);
    this.scene.setSelected({ x: unit.x, z: unit.z });
    this.showActionFx("attack");
    this.updateHud(level);
    this.notifyProgress();
    if (this.isObjectiveComplete(level)) {
      window.setTimeout(() => this.completeLevel(), 550);
    }
  }

  private endPlayerTurn(): void {
    const level = this.currentLevel();
    if (!level || this.titleOpen || this.storyQueue.length > 0) {
      return;
    }
    this.round += 1;
    this.command = "select";
    this.footerLabel.textContent = "Enemy turn resolved.";
    this.updateHud(level);
    this.notifyProgress();
    if (this.isObjectiveComplete(level)) {
      this.completeLevel();
    }
  }

  private isObjectiveComplete(level: LevelData): boolean {
    const objective = level.objectives[0];
    if (!objective) {
      return false;
    }
    if (objective.type === "defeatTeam") {
      const targetTeam = objective.team ?? "enemy";
      return !level.units.some((unit) => unit.team === targetTeam);
    }
    if (objective.type === "reachTile") {
      return level.units.some((unit) => unit.team === "player" && unit.x === objective.x && unit.z === objective.z);
    }
    if (objective.type === "surviveRounds") {
      return this.round >= (objective.rounds ?? 1);
    }
    return false;
  }

  private handleTile(coord: TileCoord): void {
    const level = this.currentLevel();
    if (!level || this.titleOpen || this.storyQueue.length > 0) {
      return;
    }
    const unit = this.unitAt(level, coord);
    if (unit?.team === "player") {
      this.selectedUnitId = unit.id;
      this.command = "select";
      this.scene.setSelected({ x: unit.x, z: unit.z });
      this.updateHud(level);
      return;
    }
    if (this.command === "move") {
      this.tryMoveSelected(coord);
      return;
    }
    if (this.command === "attack") {
      this.tryAttackTarget(coord);
      return;
    }
    this.scene.setSelected(coord);
    this.footerLabel.textContent = unit ? `${unit.name} / HP ${unit.hp}` : `Tile ${coord.x}, ${coord.z}`;
  }

  private completeLevel(): void {
    const level = this.currentLevel();
    if (!level || this.titleOpen || this.storyQueue.length > 0) {
      return;
    }
    if (!this.isObjectiveComplete(level)) {
      this.footerLabel.textContent = "Objective still active.";
      return;
    }
    this.advancingAfterStory = true;
    const completionBeats = level.story.filter((beat) => beat.trigger === "levelComplete");
    this.enqueueStory(completionBeats);
  }

  private enqueueStory(beats: StoryBeat[]): void {
    const fresh = beats.filter((beat) => {
      const key = `${this.currentLevelId}:${beat.id}`;
      if (this.shownStory.has(key)) {
        return false;
      }
      this.shownStory.add(key);
      return true;
    });
    this.storyQueue.push(...fresh);
    this.renderStory();
  }

  private renderStory(): void {
    const beat = this.storyQueue[0];
    this.scene.setInteractionEnabled(!beat);
    if (!beat) {
      this.storyLayer.innerHTML = "";
      this.storyLayer.className = "story-layer";
      if (this.advancingAfterStory) {
        this.advanceLevel();
      }
      return;
    }

    const isScreen = beat.presentation === "screen";
    this.storyLayer.className = `story-layer open ${isScreen ? "story-screen" : "story-dialog"}`;
    this.storyLayer.innerHTML = `
      <div class="story-panel">
        ${beat.speaker ? `<span class="story-speaker">${escapeHtml(beat.speaker)}</span>` : ""}
        ${beat.title ? `<h2>${escapeHtml(beat.title)}</h2>` : ""}
        <p>${escapeHtml(beat.text)}</p>
        <button data-story-continue>Continue</button>
      </div>
    `;
    this.storyLayer.querySelector<HTMLButtonElement>("[data-story-continue]")?.addEventListener("click", () => {
      this.storyQueue.shift();
      this.renderStory();
      this.notifyProgress();
    });
  }

  private advanceLevel(): void {
    this.advancingAfterStory = false;
    const current = this.currentLevel();
    if (!current) {
      return;
    }
    const campaignEntry = this.campaign.levels.find((entry) => entry.id === current.id);
    const currentIndex = this.campaign.levels.findIndex((entry) => entry.id === current.id);
    const nextId =
      current.links[0]?.to ??
      campaignEntry?.next[0] ??
      this.campaign.levels[currentIndex + 1]?.id;
    if (nextId && this.levels.some((level) => level.id === nextId)) {
      this.loadLevel(nextId);
      this.notifyProgress();
      return;
    }
    this.scene.setInteractionEnabled(false);
    this.storyLayer.className = "story-layer open story-screen";
    this.storyLayer.innerHTML = `
      <div class="story-panel">
        <span class="story-speaker">CAMPAIGN COMPLETE</span>
        <h2>${escapeHtml(this.campaign.title)}</h2>
        <p>The current chain has reached its final level.</p>
        <button data-restart-campaign>Play Again</button>
      </div>
    `;
    this.storyLayer.querySelector<HTMLButtonElement>("[data-restart-campaign]")?.addEventListener("click", () => {
      this.shownStory.clear();
      this.loadLevel(this.campaign.startLevel);
      this.notifyProgress();
    });
    this.invokeHost("achievement", () =>
      this.options.onAchievement?.(`campaign.${this.campaign.id}.complete`)
    );
  }

  private async loadFiles(files: FileList | null): Promise<void> {
    if (!files?.length) {
      return;
    }
    try {
      const parsedFiles = await Promise.all([...files].map(async (file) => JSON.parse(await file.text()) as unknown));
      this.loadContent(parsedFiles);
      this.fileInput.value = "";
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "Unable to read campaign JSON.");
    }
  }

  private notifyProgress(): void {
    const save = this.exportSave();
    this.writeLocalSave(save);
    this.invokeHost("save", () => this.options.onProgress?.(save));
  }

  private invokeHost(label: string, callback: () => void | Promise<void> | undefined): void {
    try {
      void Promise.resolve(callback()).catch((error) => {
        console.warn(`Desktop host ${label} callback failed.`, error);
      });
    } catch (error) {
      console.warn(`Desktop host ${label} callback failed.`, error);
    }
  }

  private showError(message: string): void {
    this.scene.setInteractionEnabled(false);
    this.storyLayer.className = "story-layer open story-dialog";
    this.storyLayer.innerHTML = `
      <div class="story-panel">
        <span class="story-speaker">LOAD FAILED</span>
        <p>${escapeHtml(message)}</p>
        <button data-error-close>Close</button>
      </div>
    `;
    this.storyLayer.querySelector<HTMLButtonElement>("[data-error-close]")?.addEventListener("click", () => {
      this.storyLayer.className = "story-layer";
      this.storyLayer.innerHTML = "";
      this.scene.setInteractionEnabled(true);
    });
  }
}
