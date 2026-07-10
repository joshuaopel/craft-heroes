import {
  defaultCampaign,
  defaultClassDefinitions,
  defaultEnvironmentMaterials,
  defaultEnvironmentSettings,
  defaultGameplayRules,
  defaultLevels,
  defaultPropDefinitions
} from "../game/content";
import type {
  AbilityDefinition,
  AIBehavior,
  CampaignData,
  ClassDefinition,
  ClassSectionStats,
  ConditionDefinition,
  EnvironmentMaterialDefinition,
  GameplayRules,
  LevelData,
  PropDefinition,
  SectionName,
  StoryBeat,
  TitleScreenSettings,
  TileCoord,
  UnitConditionState,
  UnitData
} from "../game/schema";
import { clientSaveStorageKey } from "../game/storage";
import { LevelScene } from "../render/LevelScene";

const sectionNames: SectionName[] = ["head", "body", "legs"];
const directionLabels = ["S", "E", "N", "W"] as const;
const maxTwistsPerTurn = 2;
type ClientCommand = "select" | "move" | "attack" | "support" | "inspect";
type AIActionStep = "attack" | "defend" | "avoid";
const aiBehaviorLabels: Record<AIBehavior, string> = {
  "straight-offense": "Straight Offense",
  "cautionary-cycle": "Cautionary Cycle",
  "avoidance-cycle": "Avoidance Cycle"
};
const aiBehaviorSequences: Record<AIBehavior, AIActionStep[]> = {
  "straight-offense": ["attack"],
  "cautionary-cycle": ["attack", "defend", "attack"],
  "avoidance-cycle": ["avoid", "attack", "defend", "avoid"]
};

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

function numberOrFallback(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAIBehavior(value: unknown): AIBehavior {
  return value === "cautionary-cycle" || value === "avoidance-cycle" ? value : "straight-offense";
}

function normalizeInitiativeOrder(units: UnitData[], order: unknown): string[] {
  const unitIds = units.map((unit) => unit.id);
  const existing = Array.isArray(order) ? order.map(String).filter((unitId) => unitIds.includes(unitId)) : [];
  return [...existing, ...unitIds.filter((unitId) => !existing.includes(unitId))];
}

function gameplayRules(campaign: CampaignData): GameplayRules {
  const incoming = campaign.gameplay;
  const fallback = defaultGameplayRules;
  const tieBreaker = incoming?.initiative?.tieBreaker;
  const conditions = Array.isArray(incoming?.conditions) && incoming.conditions.length > 0
    ? incoming.conditions
    : fallback.conditions;
  return {
    initiative: {
      base: numberOrFallback(incoming?.initiative?.base, fallback.initiative.base),
      headWeight: numberOrFallback(incoming?.initiative?.headWeight, fallback.initiative.headWeight),
      bodyWeight: numberOrFallback(incoming?.initiative?.bodyWeight, fallback.initiative.bodyWeight),
      legsWeight: numberOrFallback(incoming?.initiative?.legsWeight, fallback.initiative.legsWeight),
      heightWeight: numberOrFallback(incoming?.initiative?.heightWeight, fallback.initiative.heightWeight),
      conditionWeight: numberOrFallback(incoming?.initiative?.conditionWeight, fallback.initiative.conditionWeight),
      random: Math.max(0, numberOrFallback(incoming?.initiative?.random, fallback.initiative.random)),
      tieBreaker: tieBreaker === "enemy" || tieBreaker === "higherHp" ? tieBreaker : "player"
    },
    conditions: conditions.map((condition, index) => {
      const baseline = fallback.conditions[index] ?? fallback.conditions[0];
      return {
        ...baseline,
        ...condition,
        modifiers: {
          ...(baseline.modifiers ?? {}),
          ...(condition.modifiers ?? {})
        }
      };
    })
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
  version: 1 | 2 | 3 | 4;
  campaignId: string;
  currentLevelId: string;
  shownStory: string[];
  contentStamp?: string;
  round?: number;
  levels?: LevelData[];
  selectedUnitId?: string;
  turnStates?: ClientTurnState[];
  activeInitiativeIndex?: number;
  aiStepStates?: AIStepState[];
}

interface ClientTurnState {
  unitId: string;
  moved: boolean;
  acted: boolean;
  twists: number;
}

interface AIStepState {
  unitId: string;
  stepIndex: number;
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

export interface ClientLoadOptions {
  startLevelId?: string;
  clearSave?: boolean;
  titleMessage?: string;
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
  const width = Math.max(1, numberOrFallback(level.width, 1));
  const depth = Math.max(1, numberOrFallback(level.depth, 1));
  const units = Array.isArray(level.units)
    ? level.units.map((unit) => ({
        ...unit,
        aiBehavior: unit.team === "enemy" ? normalizeAIBehavior(unit.aiBehavior) : undefined,
        conditions: Array.isArray(unit.conditions)
          ? unit.conditions
              .map((condition) => ({
                id: String(condition.id ?? ""),
                turns: Math.max(0, numberOrFallback(condition.turns, 0)),
                stacks: Math.max(1, numberOrFallback(condition.stacks, 1)),
                source: condition.source
              }))
              .filter((condition) => condition.id)
          : []
      }))
    : [];
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
    units,
    initiativeOrder: normalizeInitiativeOrder(units, level.initiativeOrder),
    objectives: Array.isArray(level.objectives) ? level.objectives : [],
    links: Array.isArray(level.links) ? level.links : [],
    story: Array.isArray(level.story)
      ? level.story.map((beat, index) => {
          const trigger = beat.trigger === "tileEnter" || beat.trigger === "levelComplete" ? beat.trigger : "levelStart";
          return {
            id: String(beat.id || `story-${index + 1}`),
            trigger,
            presentation: beat.presentation === "screen" ? "screen" : "dialog",
            title: String(beat.title ?? ""),
            speaker: String(beat.speaker ?? ""),
            text: String(beat.text || "New story beat"),
            avatarUrl: typeof beat.avatarUrl === "string" ? beat.avatarUrl : "",
            ...(trigger === "tileEnter"
              ? {
                  x: Math.max(0, Math.min(width - 1, Math.round(numberOrFallback(beat.x, 0)))),
                  z: Math.max(0, Math.min(depth - 1, Math.round(numberOrFallback(beat.z, 0))))
                }
              : {})
          };
        })
      : []
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

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function contentStampFor(campaign: CampaignData, levels: LevelData[]): string {
  const payload = {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      startLevel: campaign.startLevel,
      levels: campaign.levels.map((level) => ({
        id: level.id,
        next: level.next
      }))
    },
    levels: levels.map((level) => ({
      id: level.id,
      name: level.name,
      width: level.width,
      depth: level.depth,
      objectives: level.objectives,
      links: level.links,
      initiativeOrder: normalizeInitiativeOrder(level.units, level.initiativeOrder),
      units: level.units.map((unit) => ({
        id: unit.id,
        team: unit.team,
        templateId: unit.templateId,
        aiBehavior: unit.aiBehavior,
        x: unit.x,
        z: unit.z,
        hp: unit.hp,
        faces: unit.faces
      })),
      story: level.story.map((beat) => ({
        id: beat.id,
        trigger: beat.trigger,
        presentation: beat.presentation,
        title: beat.title,
        speaker: beat.speaker,
        text: beat.text,
        avatar: beat.avatarUrl ? hashString(beat.avatarUrl) : "",
        x: beat.x,
        z: beat.z
      }))
    }))
  };
  return hashString(JSON.stringify(payload));
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
  private contentStamp = contentStampFor(this.campaign, this.levels);
  private storyQueue: StoryBeat[] = [];
  private shownStory = new Set<string>();
  private advancingAfterStory = false;
  private started = false;
  private titleOpen = false;
  private titleDemoTimer?: number;
  private titleDemoIndex = 0;
  private titlePreviewLevel?: LevelData;
  private selectedUnitId?: string;
  private inspectedCoord?: TileCoord;
  private command: ClientCommand = "select";
  private turnStates = new Map<string, ClientTurnState>();
  private aiStepStates = new Map<string, AIStepState>();
  private activeInitiativeIndex = 0;
  private resolvingEnemyTurn = false;
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
      <div class="combat-panel" id="client-ability-strip"></div>
      <div class="client-footer">
        <span id="client-footer-label">Awaiting orders</span>
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
    this.root.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-client-action]");
      if (!button || !this.root.contains(button) || button.disabled) {
        return;
      }
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
      } else if (action === "guard") {
        this.guardSelected();
      } else if (action === "select" || action === "move" || action === "attack" || action === "support" || action === "inspect") {
        this.setCommand(action);
      } else if (action?.startsWith("rotate-")) {
        const parts = action.replace("rotate-", "").split("-");
        const section = parts[0] as SectionName;
        const direction = parts[1] === "left" ? -1 : 1;
        if (sectionNames.includes(section)) {
          this.rotateSelectedSection(section, direction);
        }
      } else if (action === "wait") {
        this.endPlayerTurn();
      }
    });
    this.fileInput.addEventListener("change", () => void this.loadFiles(this.fileInput.files));
  }

  loadContent(content: unknown | unknown[], options: ClientLoadOptions = {}): boolean {
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
        gameplay: structuredClone(defaultGameplayRules),
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
      const requestedStartId = options.startLevelId;
      const startId = requestedStartId && this.levels.some((level) => level.id === requestedStartId)
        ? requestedStartId
        : this.levels.some((level) => level.id === this.campaign.startLevel)
          ? this.campaign.startLevel
          : this.levels[0].id;
      this.campaign = {
        ...this.campaign,
        startLevel: startId,
        titleScreen: {
          ...titleScreenSettings(this.campaign),
          ...(this.campaign.titleScreen ?? {}),
          backgroundLevelId: this.levels.some((level) => level.id === this.campaign.titleScreen?.backgroundLevelId)
            ? this.campaign.titleScreen!.backgroundLevelId
            : startId
        }
      };
      this.contentStamp = contentStampFor(this.campaign, this.levels);
      if (options.clearSave) {
        this.clearLocalSave();
      }
      this.storyQueue = [];
      this.shownStory.clear();
      this.turnStates.clear();
      this.aiStepStates.clear();
      this.activeInitiativeIndex = 0;
      this.resolvingEnemyTurn = false;
      this.round = 1;
      this.inspectedCoord = undefined;
      this.started = true;
      this.currentLevelId = startId;
      this.loadLevel(startId, { showStory: false });
      this.showTitleScreen(options.titleMessage);
      return true;
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "Unable to read campaign data.");
      return false;
    }
  }

  exportSave(): ClientSaveData {
    return {
      version: 4,
      campaignId: this.campaign.id,
      currentLevelId: this.currentLevelId,
      shownStory: [...this.shownStory],
      contentStamp: this.contentStamp,
      round: this.round,
      levels: this.levels.map((level) => structuredClone(level)),
      selectedUnitId: this.selectedUnitId,
      turnStates: [...this.turnStates.values()].map((state) => ({ ...state })),
      activeInitiativeIndex: this.activeInitiativeIndex,
      aiStepStates: [...this.aiStepStates.values()].map((state) => ({ ...state }))
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
    this.resolvingEnemyTurn = false;
    this.started = true;
    this.writeLocalSave(save);
    this.closeTitleScreen();
    if (save.levels?.every(isLevel)) {
      this.levels = save.levels.map((level) => normalizeLevel(structuredClone(level)));
    }
    this.loadLevel(save.currentLevelId, { showStory: false, resolveEnemy: false });
    this.round = Math.max(1, Math.round(numberOrFallback(save.round, 1)));
    this.aiStepStates = new Map((save.aiStepStates ?? []).map((state) => [
      state.unitId,
      {
        unitId: state.unitId,
        stepIndex: Math.max(0, Math.round(numberOrFallback(state.stepIndex, 0)))
      }
    ]));
    const level = this.currentLevel();
    if (level) {
      this.hydrateTurnStates(level, save.turnStates);
      this.activeInitiativeIndex = this.clampInitiativeIndex(level, save.activeInitiativeIndex ?? 0);
      this.selectedUnitId = this.activeInitiativeUnit(level)?.id ?? save.selectedUnitId ?? this.firstPlayerUnit(level)?.id;
      const unit = this.selectedUnit(level);
      this.scene.setSelected(unit ? { x: unit.x, z: unit.z } : undefined);
      this.updateHud(level);
      this.resolveEnemyTurnsIfNeeded();
    }
    return true;
  }

  private isCompatibleSave(save: ClientSaveData): boolean {
    const isKnownVersion = save.version === 1 || save.version === 2 || save.version === 3 || save.version === 4;
    const savedLevelsContainCurrent = save.levels?.some((level) => isLevel(level) && level.id === save.currentLevelId) ?? false;
    return (
      isKnownVersion &&
      save.campaignId === this.campaign.id &&
      save.contentStamp === this.contentStamp &&
      (savedLevelsContainCurrent || this.levels.some((level) => level.id === save.currentLevelId))
    );
  }

  private saveSlotKey(): string {
    return clientSaveStorageKey(this.campaign.id);
  }

  private readLocalSave(): ClientSaveData | undefined {
    try {
      const raw = localStorage.getItem(this.saveSlotKey());
      if (!raw) {
        return undefined;
      }
      const parsed = JSON.parse(raw) as ClientSaveData;
      return this.isCompatibleSave(parsed) ? parsed : undefined;
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
    this.turnStates.clear();
    this.aiStepStates.clear();
    this.activeInitiativeIndex = 0;
    this.resolvingEnemyTurn = false;
    this.inspectedCoord = undefined;
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
    this.scene.setRangeOverlay();
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

  private loadLevel(levelId: string, options: { showStory?: boolean; resolveEnemy?: boolean } = {}): void {
    const level = this.levels.find((candidate) => candidate.id === levelId) ?? this.levels[0];
    if (!level) {
      this.showError("No playable levels were found in those files.");
      return;
    }
    this.currentLevelId = level.id;
    this.advancingAfterStory = false;
    this.round = 1;
    this.activeInitiativeIndex = 0;
    this.aiStepStates.clear();
    this.scene.setTitleOrbit(false);
    this.stopTitleDemoLoop();
    this.titlePreviewLevel = undefined;
    this.command = "select";
    this.inspectedCoord = undefined;
    this.selectedUnitId = this.activeInitiativeUnit(level)?.id ?? this.firstPlayerUnit(level)?.id ?? level.units[0]?.id;
    this.resetTurnStates(level);
    this.scene.setRangeOverlay();
    this.scene.setLevel(level, { frame: true });
    this.scene.setSelected(this.selectedUnit(level) ? { x: this.selectedUnit(level)!.x, z: this.selectedUnit(level)!.z } : undefined);
    this.updateHud(level);
    if (options.showStory ?? true) {
      this.enqueueStory(level.story.filter((beat) => beat.trigger === "levelStart"));
    } else {
      this.storyLayer.className = "story-layer";
      this.storyLayer.innerHTML = "";
    }
    if (options.resolveEnemy ?? true) {
      this.resolveEnemyTurnsIfNeeded();
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
    const active = this.activeInitiativeUnit(level);
    const activeIndex = this.clampInitiativeIndex(level, this.activeInitiativeIndex);
    const activeLabel = active ? ` / TURN ${activeIndex + 1}: ${active.name}` : "";
    this.progress.textContent = `MISSION ${campaignIndex + 1} / ${Math.max(1, this.campaign.levels.length)} / ROUND ${this.round}${activeLabel}`;
    this.levelName.textContent = level.name;
    this.objective.textContent = objectiveLabel(level);
    this.renderAbilityStrip(level);
    this.updateCommandButtons();
    this.updateFooterStatus(level);
  }

  private firstPlayerUnit(level: LevelData): UnitData | undefined {
    return level.units.find((unit) => unit.team === "player") ?? level.units[0];
  }

  private initiativeOrder(level: LevelData): UnitData[] {
    const order = normalizeInitiativeOrder(level.units, level.initiativeOrder);
    return order
      .map((unitId) => level.units.find((unit) => unit.id === unitId))
      .filter((unit): unit is UnitData => Boolean(unit));
  }

  private clampInitiativeIndex(level: LevelData, index: number): number {
    const count = Math.max(1, this.initiativeOrder(level).length);
    return Math.max(0, Math.min(count - 1, Math.round(numberOrFallback(index, 0))));
  }

  private activeInitiativeUnit(level = this.currentLevel()): UnitData | undefined {
    if (!level) {
      return undefined;
    }
    const order = this.initiativeOrder(level);
    if (order.length === 0) {
      return undefined;
    }
    this.activeInitiativeIndex = this.clampInitiativeIndex(level, this.activeInitiativeIndex);
    return order[this.activeInitiativeIndex];
  }

  private isActivePlayerUnit(level: LevelData, unit: UnitData | undefined): boolean {
    const active = this.activeInitiativeUnit(level);
    return Boolean(unit && active && unit.team === "player" && unit.id === active.id);
  }

  private selectedUnit(level = this.currentLevel()): UnitData | undefined {
    if (!level) {
      return undefined;
    }
    const active = this.activeInitiativeUnit(level);
    return level.units.find((unit) => unit.id === this.selectedUnitId) ?? active ?? this.firstPlayerUnit(level);
  }

  private turnStateFor(unit: UnitData): ClientTurnState {
    const existing = this.turnStates.get(unit.id);
    if (existing) {
      return existing;
    }
    const state: ClientTurnState = {
      unitId: unit.id,
      moved: false,
      acted: false,
      twists: 0
    };
    this.turnStates.set(unit.id, state);
    return state;
  }

  private resetTurnStates(level: LevelData): void {
    this.hydrateTurnStates(level);
  }

  private hydrateTurnStates(level: LevelData, incoming: ClientTurnState[] = []): void {
    const incomingByUnit = new Map(incoming.map((state) => [state.unitId, state]));
    this.turnStates = new Map(
      level.units.map((unit) => {
        const saved = incomingByUnit.get(unit.id);
        return [
          unit.id,
          {
            unitId: unit.id,
            moved: saved?.moved ?? false,
            acted: saved?.acted ?? false,
            twists: Math.max(0, Math.min(maxTwistsPerTurn, Math.round(numberOrFallback(saved?.twists, 0))))
          }
        ];
      })
    );
  }

  private repairRuntimeInitiative(level: LevelData): void {
    level.initiativeOrder = normalizeInitiativeOrder(level.units, level.initiativeOrder);
    this.activeInitiativeIndex = this.clampInitiativeIndex(level, this.activeInitiativeIndex);
    const validUnitIds = new Set(level.units.map((unit) => unit.id));
    for (const unitId of [...this.aiStepStates.keys()]) {
      if (!validUnitIds.has(unitId)) {
        this.aiStepStates.delete(unitId);
      }
    }
    for (const unitId of [...this.turnStates.keys()]) {
      if (!validUnitIds.has(unitId)) {
        this.turnStates.delete(unitId);
      }
    }
  }

  private advanceInitiative(message = ""): void {
    const level = this.currentLevel();
    if (!level) {
      return;
    }
    this.repairRuntimeInitiative(level);
    const order = this.initiativeOrder(level);
    if (order.length === 0) {
      this.updateHud(level);
      return;
    }
    const active = this.activeInitiativeUnit(level);
    const currentIndex = active ? order.findIndex((unit) => unit.id === active.id) : this.activeInitiativeIndex;
    const messages = message ? [message] : [];
    let nextIndex = currentIndex + 1;
    if (nextIndex >= order.length) {
      messages.push(...this.resolveRoundEffects(level));
      this.round += 1;
      this.resetTurnStates(level);
      this.repairRuntimeInitiative(level);
      nextIndex = 0;
    }
    this.activeInitiativeIndex = this.clampInitiativeIndex(level, nextIndex);
    const nextUnit = this.activeInitiativeUnit(level);
    this.selectedUnitId = nextUnit?.id;
    this.command = "select";
    this.inspectedCoord = undefined;
    this.scene.setRangeOverlay();
    this.scene.setLevel(level);
    this.scene.setSelected(nextUnit ? { x: nextUnit.x, z: nextUnit.z } : undefined);
    this.updateHud(level);
    if (messages.length > 0) {
      this.footerLabel.textContent = messages.slice(0, 2).join(" ");
    }
    this.notifyProgress();
    if (this.isObjectiveComplete(level)) {
      this.completeLevel();
      return;
    }
    this.resolveEnemyTurnsIfNeeded();
  }

  private resolveEnemyTurnsIfNeeded(): void {
    const level = this.currentLevel();
    if (!level || this.titleOpen || this.storyQueue.length > 0 || this.resolvingEnemyTurn) {
      return;
    }
    const active = this.activeInitiativeUnit(level);
    if (!active || active.team !== "enemy") {
      this.scene.setInteractionEnabled(true);
      return;
    }
    this.resolvingEnemyTurn = true;
    this.scene.setInteractionEnabled(false);
    this.selectedUnitId = active.id;
    this.scene.setSelected({ x: active.x, z: active.z });
    this.updateHud(level);
    this.footerLabel.textContent = `${active.name} considers ${aiBehaviorLabels[normalizeAIBehavior(active.aiBehavior)]}.`;
    window.setTimeout(() => {
      const current = this.currentLevel();
      if (!current || this.titleOpen || this.storyQueue.length > 0) {
        this.resolvingEnemyTurn = false;
        return;
      }
      const unit = current?.units.find((candidate) => candidate.id === active.id);
      const message = current && unit ? this.resolveEnemyTurn(current, unit) : "";
      this.resolvingEnemyTurn = false;
      this.advanceInitiative(message);
    }, 450);
  }

  private activeConditionLabel(unit: UnitData, conditionId: string, fallback: string): string {
    const state = this.unitConditions(unit).find((condition) => condition.id === conditionId);
    if (!state) {
      return fallback;
    }
    return this.conditionDefinition(state.id)?.name ?? state.id;
  }

  private unitActionStateLabel(unit: UnitData): { move: string; action: string; guard: string; twists: string } {
    const state = this.turnStateFor(unit);
    return {
      move: state.moved ? "Spent" : "Ready",
      action: state.acted ? "Spent" : "Ready",
      guard: this.activeConditionLabel(unit, "braced", "Open"),
      twists: `${state.twists} / ${maxTwistsPerTurn}`
    };
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

  private tileHeight(level: LevelData, coord: TileCoord): number {
    return level.tiles[coord.z]?.[coord.x]?.height ?? 0;
  }

  private lineTilesBetween(a: TileCoord, b: TileCoord): TileCoord[] {
    const tiles: TileCoord[] = [];
    let x = a.x;
    let z = a.z;
    const dx = Math.abs(b.x - a.x);
    const dz = Math.abs(b.z - a.z);
    const stepX = a.x < b.x ? 1 : -1;
    const stepZ = a.z < b.z ? 1 : -1;
    let error = dx - dz;

    while (x !== b.x || z !== b.z) {
      const error2 = error * 2;
      if (error2 > -dz) {
        error -= dz;
        x += stepX;
      }
      if (error2 < dx) {
        error += dx;
        z += stepZ;
      }
      if (x !== b.x || z !== b.z) {
        tiles.push({ x, z });
      }
    }

    return tiles;
  }

  private tileBlocksLineOfSight(level: LevelData, coord: TileCoord, sightCeiling: number): boolean {
    const tile = level.tiles[coord.z]?.[coord.x];
    if (!tile) {
      return true;
    }
    const material = this.environmentMaterials.find((candidate) => candidate.id === tile.terrain);
    if (material?.blocksLineOfSight) {
      return true;
    }
    const obstacle = level.obstacles.find((item) => item.x === coord.x && item.z === coord.z);
    const prop = obstacle ? this.propDefinitions.find((definition) => definition.id === obstacle.type) : undefined;
    if (prop?.blocksLineOfSight) {
      return true;
    }
    return tile.height > sightCeiling;
  }

  private hasLineOfSight(level: LevelData, source: TileCoord, target: TileCoord): boolean {
    if (source.x === target.x && source.z === target.z) {
      return true;
    }
    const sightCeiling = Math.max(this.tileHeight(level, source), this.tileHeight(level, target)) + 1;
    return this.lineTilesBetween(source, target).every((coord) => !this.tileBlocksLineOfSight(level, coord, sightCeiling));
  }

  private directionBetween(source: TileCoord, target: TileCoord): string {
    const dx = target.x - source.x;
    const dz = target.z - source.z;
    if (Math.abs(dx) >= Math.abs(dz)) {
      return dx >= 0 ? "E" : "W";
    }
    return dz >= 0 ? "S" : "N";
  }

  private rules(): GameplayRules {
    return gameplayRules(this.campaign);
  }

  private conditionDefinition(id: string): ConditionDefinition | undefined {
    return this.rules().conditions.find((condition) => condition.id === id || condition.name === id);
  }

  private unitConditions(unit: UnitData): UnitConditionState[] {
    if (!Array.isArray(unit.conditions)) {
      unit.conditions = [];
    }
    return unit.conditions;
  }

  private conditionModifierTotal(unit: UnitData): ConditionDefinition["modifiers"] {
    const totals: ConditionDefinition["modifiers"] = {
      attack: 0,
      defense: 0,
      move: 0,
      range: 0,
      support: 0,
      initiative: 0
    };
    const keys: Array<keyof ConditionDefinition["modifiers"]> = ["attack", "defense", "move", "range", "support", "initiative"];
    for (const state of this.unitConditions(unit)) {
      const definition = this.conditionDefinition(state.id);
      if (!definition) {
        continue;
      }
      const stacks = definition.stackable ? Math.max(1, state.stacks) : 1;
      for (const key of keys) {
        totals[key] = numberOrFallback(totals[key], 0) + numberOrFallback(definition.modifiers[key], 0) * stacks;
      }
    }
    return totals;
  }

  private sectionStats(level: LevelData, section: SectionName, unit = this.selectedUnit(level)): ClassSectionStats {
    const classDefinition = this.frontClassForSection(level, section, unit);
    const base = classDefinition.sections[section].stats;
    const modifiers: ConditionDefinition["modifiers"] = unit ? this.conditionModifierTotal(unit) : {};
    return {
      attack: Math.max(0, base.attack + numberOrFallback(modifiers.attack, 0)),
      defense: Math.max(0, base.defense + numberOrFallback(modifiers.defense, 0)),
      move: Math.max(0, base.move + numberOrFallback(modifiers.move, 0)),
      range: Math.max(0, base.range + numberOrFallback(modifiers.range, 0)),
      support: Math.max(0, base.support + numberOrFallback(modifiers.support, 0))
    };
  }

  private sectionStatsForRotation(section: SectionName, unit: UnitData, rotation: number): ClassSectionStats {
    const classId = unit.faces[section][((rotation % 4) + 4) % 4] ?? this.classDefinitions[0].id;
    const base = this.classForId(classId).sections[section].stats;
    const modifiers: ConditionDefinition["modifiers"] = this.conditionModifierTotal(unit);
    return {
      attack: Math.max(0, base.attack + numberOrFallback(modifiers.attack, 0)),
      defense: Math.max(0, base.defense + numberOrFallback(modifiers.defense, 0)),
      move: Math.max(0, base.move + numberOrFallback(modifiers.move, 0)),
      range: Math.max(0, base.range + numberOrFallback(modifiers.range, 0)),
      support: Math.max(0, base.support + numberOrFallback(modifiers.support, 0))
    };
  }

  private classForId(classId: string): ClassDefinition {
    return this.classDefinitions.find((classDefinition) => classDefinition.id === classId) ?? this.classDefinitions[0];
  }

  private frontClassForSection(level: LevelData, section: SectionName, unit = this.playerUnit(level)): ClassDefinition {
    const rotation = unit ? ((unit.rotations[section] % 4) + 4) % 4 : 0;
    return this.classForId(unit?.faces[section][rotation] ?? this.classDefinitions[0].id);
  }

  private primaryAbilityForSection(level: LevelData, section: SectionName, unit = this.playerUnit(level)): AbilityDefinition | undefined {
    const classDefinition = this.frontClassForSection(level, section, unit);
    return classDefinition.sections[section].abilities[0];
  }

  private initiativeScore(level: LevelData, unit: UnitData): number {
    const settings = this.rules().initiative;
    const head = this.sectionStats(level, "head", unit);
    const body = this.sectionStats(level, "body", unit);
    const legs = this.sectionStats(level, "legs", unit);
    const conditionInitiative = numberOrFallback(this.conditionModifierTotal(unit).initiative, 0);
    const randomCap = Math.floor(settings.random);
    const randomBonus = randomCap > 0 ? this.stableInitiativeRoll(unit, randomCap) : 0;
    const score =
      settings.base +
      (head.range + head.support) * settings.headWeight +
      (body.attack + body.defense) * settings.bodyWeight +
      legs.move * settings.legsWeight +
      this.tileHeight(level, unit) * settings.heightWeight +
      conditionInitiative * settings.conditionWeight +
      randomBonus;
    return Math.round(score * 10) / 10;
  }

  private stableInitiativeRoll(unit: UnitData, max: number): number {
    const hash = [...unit.id].reduce((total, character) => total + character.charCodeAt(0), 0);
    return (hash + this.round * 7) % (max + 1);
  }

  private effectValues(effect: string | undefined, key: string): string[] {
    if (!effect) {
      return [];
    }
    return effect
      .split(/[;\n]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .flatMap((part) => {
        const [name, rawValue = "1"] = part.split(":").map((value) => value.trim());
        return name === key ? [rawValue] : [];
      });
  }

  private effectNumber(effect: string | undefined, key: string): number {
    return this.effectValues(effect, key).reduce((total, value) => total + numberOrFallback(value, 0), 0);
  }

  private applyCondition(target: UnitData, conditionId: string, source?: UnitData): string | undefined {
    const definition = this.conditionDefinition(conditionId);
    if (!definition) {
      return undefined;
    }
    const conditions = this.unitConditions(target);
    const existing = conditions.find((condition) => condition.id === definition.id);
    if (existing) {
      existing.turns = Math.max(existing.turns, definition.duration);
      existing.source = source?.id ?? existing.source;
      existing.stacks = definition.stackable ? Math.min(9, existing.stacks + 1) : 1;
    } else {
      conditions.push({
        id: definition.id,
        turns: definition.duration,
        stacks: 1,
        source: source?.id
      });
    }
    return definition.name;
  }

  private applyConditionsFromEffect(source: UnitData, target: UnitData, effect: string | undefined, key = "apply"): string[] {
    return this.effectValues(effect, key)
      .map((conditionId) => this.applyCondition(target, conditionId, source))
      .filter((name): name is string => Boolean(name));
  }

  private cleanseUnit(target: UnitData): string | undefined {
    const conditions = this.unitConditions(target);
    const index = conditions.findIndex((state) => {
      const definition = this.conditionDefinition(state.id);
      return definition?.kind === "debuff" || definition?.kind === "trap";
    });
    if (index < 0) {
      return undefined;
    }
    const [removed] = conditions.splice(index, 1);
    return this.conditionDefinition(removed.id)?.name ?? removed.id;
  }

  private resolveRoundEffects(level: LevelData): string[] {
    const messages: string[] = [];
    for (const unit of level.units) {
      const nextConditions: UnitConditionState[] = [];
      for (const state of this.unitConditions(unit)) {
        const definition = this.conditionDefinition(state.id);
        if (!definition) {
          continue;
        }
        const stacks = definition.stackable ? Math.max(1, state.stacks) : 1;
        const damage = this.effectNumber(definition.effect, "damagePerRound") * stacks;
        const healing = this.effectNumber(definition.effect, "healPerRound") * stacks;
        if (damage > 0) {
          unit.hp -= damage;
          messages.push(`${unit.name} suffers ${damage} from ${definition.name}.`);
        }
        if (healing > 0) {
          unit.hp = Math.min(99, unit.hp + healing);
          messages.push(`${unit.name} recovers ${healing} from ${definition.name}.`);
        }
        const turns = state.turns - 1;
        if (turns > 0 && unit.hp > 0) {
          nextConditions.push({ ...state, turns });
        }
      }
      unit.conditions = nextConditions;
    }
    const defeated = level.units.filter((unit) => unit.hp <= 0);
    level.units = level.units.filter((unit) => unit.hp > 0);
    messages.push(...defeated.map((unit) => `${unit.name} falls to ongoing effects.`));
    return messages;
  }

  private sectionLabel(section: SectionName): string {
    return section === "body" ? "Body / Arms" : section[0].toUpperCase() + section.slice(1);
  }

  private sectionRoleLabel(section: SectionName): string {
    if (section === "head") {
      return "focus side";
    }
    if (section === "body") {
      return "attack side";
    }
    return "move side";
  }

  private sectionGainText(section: SectionName, stats: ClassSectionStats): string {
    if (section === "head") {
      return `Sight ${Math.max(1, stats.range)}, support ${stats.support}, initiative read`;
    }
    if (section === "body") {
      return `Attack ${Math.max(1, stats.attack)}, range ${Math.max(1, stats.range)}, guard ${stats.defense}`;
    }
    return `Move ${Math.max(1, stats.move)}, defense ${stats.defense}, terrain posture`;
  }

  private sectionMetricHtml(section: SectionName, stats: ClassSectionStats): string {
    const metrics =
      section === "head"
        ? [
            ["Sight", Math.max(1, stats.range)],
            ["Support", stats.support]
          ]
        : section === "body"
          ? [
              ["Attack", Math.max(1, stats.attack)],
              ["Range", Math.max(1, stats.range)],
              ["Defense", stats.defense]
            ]
          : [
              ["Move", Math.max(1, stats.move)],
              ["Defense", stats.defense]
            ];
    return metrics
      .map(([label, value]) => `<span class="metric-pill"><b>${escapeHtml(String(value))}</b>${escapeHtml(String(label))}</span>`)
      .join("");
  }

  private supportActionLabel(level: LevelData, unit: UnitData): string {
    const head = this.primaryAbilityForSection(level, "head", unit);
    const body = this.primaryAbilityForSection(level, "body", unit);
    const headStats = this.sectionStats(level, "head", unit);
    const bodyStats = this.sectionStats(level, "body", unit);
    const ability = bodyStats.support > headStats.support ? body : head ?? body;
    return ability?.name ?? "Support";
  }

  private actionButton(label: string, action: string, disabled = false): string {
    return `<button data-client-action="${escapeHtml(action)}" ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
  }

  private sectionPanelHtml(level: LevelData, unit: UnitData, section: SectionName, turn: ClientTurnState): string {
    const stats = this.sectionStats(level, section, unit);
    const activeIndex = ((unit.rotations[section] % 4) + 4) % 4;
    const activeClass = this.frontClassForSection(level, section, unit);
    const ability = this.primaryAbilityForSection(level, section, unit);
    const twistDisabled = turn.twists >= maxTwistsPerTurn || turn.acted;
    const faces = unit.faces[section]
      .map((classId, index) => {
        const classDefinition = this.classForId(classId);
        const active = index === activeIndex;
        return `
          <div class="face-card ${active ? "active" : ""}" style="--face-color: ${escapeHtml(classDefinition.color)}">
            <span>${escapeHtml(directionLabels[index] ?? String(index + 1))}</span>
            <strong>${escapeHtml(classDefinition.name)}</strong>
          </div>
        `;
      })
      .join("");
    return `
      <section class="combat-section" style="--section-color: ${escapeHtml(activeClass.color)}">
        <div class="combat-section-head">
          <div>
            <strong>${escapeHtml(this.sectionLabel(section))}</strong>
            <span>${escapeHtml(this.sectionRoleLabel(section))}</span>
          </div>
          <div class="twist-controls" aria-label="${escapeHtml(this.sectionLabel(section))} rotation controls">
            <button data-client-action="rotate-${section}-left" ${twistDisabled ? "disabled" : ""} title="Rotate ${escapeHtml(this.sectionLabel(section))} left">&lt;</button>
            <button data-client-action="rotate-${section}" ${twistDisabled ? "disabled" : ""} title="Rotate ${escapeHtml(this.sectionLabel(section))} right">&gt;</button>
          </div>
        </div>
        <div class="face-grid">${faces}</div>
        <div class="section-gains">
          <div class="metric-row">${this.sectionMetricHtml(section, stats)}</div>
          <b>${escapeHtml(ability ? `${ability.icon} ${ability.name}` : activeClass.name)}</b>
          <span>${escapeHtml(this.sectionGainText(section, stats))}</span>
          ${ability?.description ? `<em>${escapeHtml(ability.description)}</em>` : ""}
        </div>
      </section>
    `;
  }

  private visibleConditionHtml(unit: UnitData): string {
    const conditions = this.unitConditions(unit)
      .map((state) => ({ state, definition: this.conditionDefinition(state.id) }))
      .filter(({ definition }) => definition && (!definition.hidden || unit.team === "player"));
    if (conditions.length === 0) {
      return `<span class="empty-note">No active conditions.</span>`;
    }
    return conditions
      .map(({ state, definition }) => `
        <div class="condition-row" style="--condition-color: ${escapeHtml(definition?.color ?? "#60d7e4")}">
          <i></i>
          <div>
            <strong>${escapeHtml(definition ? `${definition.name}${state.stacks > 1 ? ` x${state.stacks}` : ""}` : state.id)}</strong>
            <span>${escapeHtml(`${definition?.icon ?? "FX"} / ${definition?.kind ?? "status"} / ${state.turns} round${state.turns === 1 ? "" : "s"}`)}</span>
          </div>
        </div>
      `)
      .join("");
  }

  private classStatsHtml(): string {
    return this.classDefinitions
      .map((classDefinition) => {
        const body = classDefinition.sections.body.stats;
        const legs = classDefinition.sections.legs.stats;
        const head = classDefinition.sections.head.stats;
        return `
          <div class="class-stat-row" style="--class-color: ${escapeHtml(classDefinition.color)}">
            <i></i>
            <span><b>${escapeHtml(classDefinition.name)}:</b> head sight ${Math.max(1, head.range)}, support ${head.support}; body attack ${Math.max(1, body.attack)}, range ${Math.max(1, body.range)}, defense ${body.defense}; legs move ${Math.max(1, legs.move)}, defense ${legs.defense}.</span>
          </div>
        `;
      })
      .join("");
  }

  private targetLineHtml(level: LevelData, unit: UnitData): string {
    const inspected = this.inspectedCoord;
    const inspectedUnit = inspected ? this.unitAt(level, inspected) : undefined;
    const fallbackEnemy = level.units
      .filter((candidate) => candidate.team !== unit.team)
      .sort((a, b) => this.distance(unit, a) - this.distance(unit, b))[0];
    const target = inspected ? inspectedUnit : fallbackEnemy;
    const targetCoord = inspected ?? target;
    const headStats = this.sectionStats(level, "head", unit);
    const bodyStats = this.sectionStats(level, "body", unit);
    const legsStats = this.sectionStats(level, "legs", unit);
    const los = targetCoord ? this.hasLineOfSight(level, unit, targetCoord) : true;
    const terrain = targetCoord ? this.tileHeight(level, targetCoord) : this.tileHeight(level, unit);
    const line =
      target && target.team !== unit.team
        ? `${unit.name} aims ${this.directionBetween(unit, target)}; ${target.name} defends with ${directionLabels[((target.rotations.body % 4) + 4) % 4]}.`
        : targetCoord
          ? `${unit.name} inspects tile ${targetCoord.x}, ${targetCoord.z}${target ? ` occupied by ${target.name}` : ""}.`
          : `${unit.name} is ready. Pick a command or inspect a tile.`;
    return `
      <div class="target-line">
        <strong>Target Line</strong>
        <span>${escapeHtml(line)}</span>
        <div class="target-grid">
          <div>
            <b style="color:${escapeHtml(this.frontClassForSection(level, "head", unit).color)}">${escapeHtml(this.frontClassForSection(level, "head", unit).name)} head</b>
            <span>Sight ${Math.max(1, headStats.range)}, support ${headStats.support}</span>
          </div>
          <div>
            <b style="color:${escapeHtml(this.frontClassForSection(level, "body", unit).color)}">${escapeHtml(this.frontClassForSection(level, "body", unit).name)} body</b>
            <span>Attack ${Math.max(1, bodyStats.attack)}, range ${Math.max(1, bodyStats.range)}, defense ${bodyStats.defense}</span>
          </div>
          <div>
            <b style="color:${escapeHtml(this.frontClassForSection(level, "legs", unit).color)}">${escapeHtml(this.frontClassForSection(level, "legs", unit).name)} legs</b>
            <span>Move ${Math.max(1, legsStats.move)}, defense ${legsStats.defense}</span>
          </div>
          <div>
            <b>Terrain</b>
            <span>Height ${terrain}; LOS ${los ? "clear" : "blocked"}</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderAbilityStrip(level: LevelData): void {
    const active = this.activeInitiativeUnit(level);
    const unit = this.selectedUnit(level);
    if (!unit) {
      this.abilityStrip.innerHTML = `
        <div class="combat-empty">
          <strong>No Unit Selected</strong>
          <span>Select a player cube to view turn controls.</span>
        </div>
      `;
      return;
    }
    if (!this.isActivePlayerUnit(level, unit)) {
      const behavior = unit.team === "enemy" ? normalizeAIBehavior(unit.aiBehavior) : "straight-offense";
      this.abilityStrip.innerHTML = `
        <div class="combat-panel-head">
          <div>
            <strong>${escapeHtml(unit.name)}</strong>
            <span>${escapeHtml(`${unit.team} cube at ${unit.x}, ${unit.z}`)}</span>
          </div>
          <span class="turn-badge">${unit.team === "enemy" ? "Enemy AI" : "Waiting"}</span>
        </div>
        <div class="combat-stat-grid">
          <div><span>HP</span><strong>${unit.hp}</strong></div>
          <div><span>Height</span><strong>${this.tileHeight(level, unit)}</strong></div>
          <div><span>Turn</span><strong>${this.clampInitiativeIndex(level, this.activeInitiativeIndex) + 1}</strong></div>
        </div>
        <div class="combat-empty">
          <strong>${unit.team === "enemy" ? escapeHtml(aiBehaviorLabels[behavior]) : "Not Active"}</strong>
          <span>${unit.team === "enemy" ? "The enemy will resolve automatically." : `${escapeHtml(active?.name ?? "Another unit")} is active now.`}</span>
        </div>
      `;
      return;
    }

    const turn = this.turnStateFor(unit);
    const labels = this.unitActionStateLabel(unit);
    const height = this.tileHeight(level, unit);
    const actionSpent = turn.acted;
    const moveSpent = turn.moved;
    const supportStats = this.sectionStats(level, "head", unit).support + this.sectionStats(level, "body", unit).support;
    const supportDisabled = actionSpent || supportStats <= 0;
    const canComplete = this.isObjectiveComplete(level);
    const sectionPanels = sectionNames.map((section) => this.sectionPanelHtml(level, unit, section, turn)).join("");

    this.abilityStrip.innerHTML = `
      <div class="combat-panel-head">
        <div>
          <strong>${escapeHtml(unit.name)}</strong>
          <span>${escapeHtml(`${unit.team} cube at ${unit.x}, ${unit.z}`)}</span>
        </div>
        ${this.actionButton("Reset", "select")}
      </div>
      <div class="combat-stat-grid">
        <div><span>HP</span><strong>${unit.hp}</strong></div>
        <div><span>Height</span><strong>${height}</strong></div>
        <div><span>Twists</span><strong>${escapeHtml(labels.twists)}</strong></div>
        <div><span>Move</span><strong>${escapeHtml(labels.move)}</strong></div>
        <div><span>Action</span><strong>${escapeHtml(labels.action)}</strong></div>
        <div><span>Guard</span><strong>${escapeHtml(labels.guard)}</strong></div>
      </div>
      ${sectionPanels}
      <div class="combat-actions-grid">
        ${this.actionButton("Move", "move", moveSpent)}
        ${this.actionButton("Attack", "attack", actionSpent)}
        ${this.actionButton(this.supportActionLabel(level, unit), "support", supportDisabled)}
        ${this.actionButton("Guard", "guard", actionSpent)}
        ${this.actionButton("End Turn", "wait")}
        ${this.actionButton("Inspect", "inspect")}
        ${this.actionButton("Resolve", "complete", !canComplete)}
      </div>
      ${this.targetLineHtml(level, unit)}
      <details class="class-stats" open>
        <summary>Class stats</summary>
        <div class="class-stat-list">${this.classStatsHtml()}</div>
      </details>
      <details class="class-stats">
        <summary>Conditions</summary>
        <div class="condition-list">${this.visibleConditionHtml(unit)}</div>
      </details>
    `;
  }

  private updateCommandButtons(): void {
    const level = this.currentLevel();
    const unit = this.selectedUnit(level);
    const turn = unit ? this.turnStateFor(unit) : undefined;
    const canAct = Boolean(level && unit && this.isActivePlayerUnit(level, unit));
    this.root.querySelectorAll<HTMLButtonElement>("[data-client-action]").forEach((button) => {
      const action = button.dataset.clientAction;
      button.classList.toggle("active", action === this.command);
      if (!action || action === "load" || action === "editor" || action === "menu") {
        return;
      }
      if (!level || !unit || !turn || !canAct) {
        button.disabled = true;
        return;
      }
      if (action === "move") {
        button.disabled = turn.moved;
      } else if (action === "attack" || action === "guard") {
        button.disabled = turn.acted;
      } else if (action === "support") {
        const support = this.sectionStats(level, "head", unit).support + this.sectionStats(level, "body", unit).support;
        button.disabled = turn.acted || support <= 0;
      } else if (action === "complete") {
        button.disabled = !this.isObjectiveComplete(level);
      } else if (action.startsWith("rotate-")) {
        button.disabled = turn.twists >= maxTwistsPerTurn || turn.acted;
      } else {
        button.disabled = false;
      }
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
    if (!this.isActivePlayerUnit(level, unit)) {
      this.footerLabel.textContent =
        unit.team === "enemy"
          ? `${unit.name} / ${aiBehaviorLabels[normalizeAIBehavior(unit.aiBehavior)]} / resolving`
          : `${unit.name} is waiting for initiative.`;
      return;
    }
    const move = this.sectionStats(level, "legs", unit).move;
    const bodyStats = this.sectionStats(level, "body", unit);
    const headStats = this.sectionStats(level, "head", unit);
    const range = Math.max(1, bodyStats.range);
    const supportRange = Math.max(1, headStats.range, bodyStats.range);
    const attack = bodyStats.attack;
    const support = headStats.support + bodyStats.support;
    const initiative = this.initiativeScore(level, unit);
    const labels = this.unitActionStateLabel(unit);
    if (this.command === "move") {
      this.footerLabel.textContent = `${unit.name} / move ${move} / ${labels.move} / init ${initiative}`;
    } else if (this.command === "attack") {
      this.footerLabel.textContent = `${unit.name} / attack ${attack} / range ${range} / ${labels.action} / init ${initiative}`;
    } else if (this.command === "support") {
      this.footerLabel.textContent = `${unit.name} / support ${support} / range ${supportRange} / ${labels.action} / init ${initiative}`;
    } else if (this.command === "inspect") {
      this.footerLabel.textContent = `${unit.name} / sight ${Math.max(1, headStats.range)} / LOS preview / init ${initiative}`;
    } else {
      this.footerLabel.textContent = `${unit.name} / HP ${unit.hp} / move ${labels.move} / action ${labels.action} / twists ${labels.twists}`;
    }
  }

  private rangeForCommand(level: LevelData, unit: UnitData, command = this.command): number {
    if (command === "move") {
      return Math.max(1, this.sectionStats(level, "legs", unit).move);
    }
    if (command === "attack") {
      return Math.max(1, this.sectionStats(level, "body", unit).range);
    }
    if (command === "support") {
      const headStats = this.sectionStats(level, "head", unit);
      const bodyStats = this.sectionStats(level, "body", unit);
      return Math.max(1, headStats.range, bodyStats.range);
    }
    if (command === "inspect") {
      return Math.max(1, this.sectionStats(level, "head", unit).range);
    }
    return 0;
  }

  private updateRangeOverlay(level = this.currentLevel()): void {
    const unit = this.selectedUnit(level);
    if (!level || !unit) {
      this.scene.setRangeOverlay();
      return;
    }
    if (!this.isActivePlayerUnit(level, unit)) {
      this.scene.setRangeOverlay();
      return;
    }
    const range = this.rangeForCommand(level, unit);
    if (this.command === "move") {
      this.scene.setRangeOverlay(unit, range, "move");
    } else if (this.command === "attack") {
      this.scene.setRangeOverlay(unit, range, "attack");
    } else if (this.command === "support") {
      this.scene.setRangeOverlay(unit, range, "support");
    } else if (this.command === "inspect") {
      this.scene.setRangeOverlay(unit, range, "sight");
    } else {
      this.scene.setRangeOverlay();
    }
  }

  private setCommand(command: ClientCommand): void {
    if (this.titleOpen || this.storyQueue.length > 0) {
      return;
    }
    const level = this.currentLevel();
    const unit = this.selectedUnit(level);
    if (level && unit) {
      if (!this.isActivePlayerUnit(level, unit)) {
        this.footerLabel.textContent = `${unit.name} is not ready for player orders.`;
        return;
      }
      const turn = this.turnStateFor(unit);
      if (command === "move" && turn.moved) {
        this.footerLabel.textContent = "Move already spent this turn.";
        return;
      }
      if ((command === "attack" || command === "support") && turn.acted) {
        this.footerLabel.textContent = "Action already spent this turn.";
        return;
      }
      if (command === "support") {
        const support = this.sectionStats(level, "head", unit).support + this.sectionStats(level, "body", unit).support;
        if (support <= 0) {
          this.footerLabel.textContent = "No support value on the current faces.";
          return;
        }
      }
    }
    this.command = command;
    if (command === "select") {
      this.inspectedCoord = undefined;
    }
    if (level) {
      this.scene.setSelected(unit ? { x: unit.x, z: unit.z } : undefined);
      this.updateRangeOverlay(level);
      this.updateHud(level);
    }
  }

  private abilityForAction(action: "move" | "attack" | "support" | "rotate" | "guard", sourceLevel = this.currentLevel()): AbilityDefinition | undefined {
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
    if (action === "support") {
      return this.primaryAbilityForSection(level, "head") ?? this.primaryAbilityForSection(level, "body");
    }
    if (action === "guard") {
      return this.primaryAbilityForSection(level, "body") ?? this.primaryAbilityForSection(level, "head");
    }
    return this.primaryAbilityForSection(level, "head");
  }

  private showActionFx(action: "move" | "attack" | "support" | "rotate" | "guard", sourceLevel = this.currentLevel(), options: { allowDuringTitle?: boolean } = {}): void {
    if ((!options.allowDuringTitle && this.titleOpen) || this.storyQueue.length > 0) {
      return;
    }
    const ability = this.abilityForAction(action, sourceLevel);
    const fallback = action === "move" ? "MV" : action === "attack" ? "AT" : action === "support" ? "SP" : action === "guard" ? "GD" : "RT";
    const label =
      action === "move"
        ? "Movement preview"
        : action === "attack"
          ? "Attack preview"
          : action === "support"
            ? "Support preview"
            : action === "guard"
              ? "Guard stance"
              : "Face rotation preview";
    const color = ability?.color ?? (action === "attack" ? "#ff6d62" : action === "support" ? "#46a65c" : action === "move" ? "#60d7e4" : action === "guard" ? "#f2bd55" : "#f2bd55");
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

  private rotateSelectedSection(section: SectionName, direction = 1): void {
    const level = this.currentLevel();
    const unit = this.selectedUnit(level);
    if (!level || !unit || this.titleOpen || this.storyQueue.length > 0) {
      return;
    }
    if (!this.isActivePlayerUnit(level, unit)) {
      this.footerLabel.textContent = `${unit.name} is not the active player unit.`;
      return;
    }
    const turn = this.turnStateFor(unit);
    if (turn.acted) {
      this.footerLabel.textContent = "Rotations are locked after spending the action.";
      return;
    }
    if (turn.twists >= maxTwistsPerTurn) {
      this.footerLabel.textContent = `Rotation limit reached (${maxTwistsPerTurn} twists per turn).`;
      return;
    }
    unit.rotations[section] = (unit.rotations[section] + direction + 4) % 4;
    turn.twists += 1;
    this.scene.setLevel(level);
    this.scene.setSelected({ x: unit.x, z: unit.z });
    this.updateRangeOverlay(level);
    this.showActionFx("rotate");
    this.updateHud(level);
    this.notifyProgress();
  }

  private guardSelected(): void {
    const level = this.currentLevel();
    const unit = this.selectedUnit(level);
    if (!level || !unit || this.titleOpen || this.storyQueue.length > 0) {
      return;
    }
    if (!this.isActivePlayerUnit(level, unit)) {
      this.footerLabel.textContent = `${unit.name} is not the active player unit.`;
      return;
    }
    const turn = this.turnStateFor(unit);
    if (turn.acted) {
      this.footerLabel.textContent = "Action already spent this turn.";
      return;
    }
    const applied = this.applyCondition(unit, "braced", unit);
    turn.acted = true;
    this.command = "select";
    this.scene.setRangeOverlay();
    this.scene.setLevel(level);
    this.scene.setSelected({ x: unit.x, z: unit.z });
    this.showActionFx("guard");
    this.updateHud(level);
    this.footerLabel.textContent = `${unit.name} guards${applied ? ` and gains ${applied}` : ""}.`;
    this.notifyProgress();
  }

  private tryMoveSelected(coord: TileCoord): void {
    const level = this.currentLevel();
    const unit = this.selectedUnit(level);
    if (!level || !unit) {
      return;
    }
    if (!this.isActivePlayerUnit(level, unit)) {
      this.footerLabel.textContent = `${unit.name} is not the active player unit.`;
      return;
    }
    const turn = this.turnStateFor(unit);
    if (turn.moved) {
      this.footerLabel.textContent = "Move already spent this turn.";
      return;
    }
    const moveRange = Math.max(1, this.sectionStats(level, "legs", unit).move);
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
    const legAbility = this.primaryAbilityForSection(level, "legs", unit);
    unit.x = coord.x;
    unit.z = coord.z;
    turn.moved = true;
    const applied = this.applyConditionsFromEffect(unit, unit, legAbility?.effect);
    this.command = "select";
    this.scene.setRangeOverlay();
    this.scene.setLevel(level);
    this.scene.setSelected({ x: unit.x, z: unit.z });
    this.showActionFx("move");
    this.enqueueStory(
      level.story.filter(
        (beat) => beat.trigger === "tileEnter" && beat.x === coord.x && beat.z === coord.z
      )
    );
    this.updateHud(level);
    if (applied.length > 0) {
      this.footerLabel.textContent = `${unit.name} gains ${applied.join(", ")}.`;
    }
    this.notifyProgress();
  }

  private tryAttackTarget(coord: TileCoord): void {
    const level = this.currentLevel();
    const unit = this.selectedUnit(level);
    if (!level || !unit) {
      return;
    }
    if (!this.isActivePlayerUnit(level, unit)) {
      this.footerLabel.textContent = `${unit.name} is not the active player unit.`;
      return;
    }
    const target = this.unitAt(level, coord);
    if (!target || target.team === unit.team) {
      this.footerLabel.textContent = "No enemy target.";
      return;
    }
    const turn = this.turnStateFor(unit);
    if (turn.acted) {
      this.footerLabel.textContent = "Action already spent this turn.";
      return;
    }
    const attackerBody = this.sectionStats(level, "body", unit);
    const range = Math.max(1, attackerBody.range);
    if (this.distance(unit, target) > range) {
      this.footerLabel.textContent = `Attack range ${range}.`;
      return;
    }
    if (!this.hasLineOfSight(level, unit, target)) {
      this.footerLabel.textContent = "Line of sight blocked.";
      return;
    }
    const defenderBody = this.sectionStats(level, "body", target);
    const attack = Math.max(1, attackerBody.attack);
    const defense = Math.max(0, defenderBody.defense);
    const heightBonus = Math.max(0, this.tileHeight(level, unit) - this.tileHeight(level, target));
    const damage = Math.max(1, attack + heightBonus - Math.floor(defense / 2));
    target.hp -= damage;
    turn.acted = true;
    const bodyAbility = this.primaryAbilityForSection(level, "body", unit);
    const headAbility = this.primaryAbilityForSection(level, "head", unit);
    const applied = target.hp > 0
      ? [
          ...this.applyConditionsFromEffect(unit, target, bodyAbility?.effect),
          ...this.applyConditionsFromEffect(unit, target, headAbility?.effect, "applyOnAttack")
        ]
      : [];
    const resultMessage = target.hp <= 0
      ? `${target.name} defeated.`
      : `${target.name} takes ${damage}; HP ${target.hp}${applied.length ? ` / ${applied.join(", ")}` : ""}.`;
    if (target.hp <= 0) {
      level.units = level.units.filter((candidate) => candidate.id !== target.id);
      this.repairRuntimeInitiative(level);
    }
    this.command = "select";
    this.scene.setRangeOverlay();
    this.scene.setLevel(level);
    this.scene.setSelected({ x: unit.x, z: unit.z });
    this.showActionFx("attack");
    this.updateHud(level);
    this.footerLabel.textContent = resultMessage;
    this.notifyProgress();
    if (this.isObjectiveComplete(level)) {
      window.setTimeout(() => this.completeLevel(), 550);
    }
  }

  private trySupportTarget(coord: TileCoord): void {
    const level = this.currentLevel();
    const unit = this.selectedUnit(level);
    if (!level || !unit) {
      return;
    }
    if (!this.isActivePlayerUnit(level, unit)) {
      this.footerLabel.textContent = `${unit.name} is not the active player unit.`;
      return;
    }
    const target = this.unitAt(level, coord);
    if (!target || target.team !== unit.team) {
      this.footerLabel.textContent = "No ally target.";
      return;
    }
    const turn = this.turnStateFor(unit);
    if (turn.acted) {
      this.footerLabel.textContent = "Action already spent this turn.";
      return;
    }
    const headStats = this.sectionStats(level, "head", unit);
    const bodyStats = this.sectionStats(level, "body", unit);
    const range = Math.max(1, headStats.range, bodyStats.range);
    if (this.distance(unit, target) > range) {
      this.footerLabel.textContent = `Support range ${range}.`;
      return;
    }
    if (!this.hasLineOfSight(level, unit, target)) {
      this.footerLabel.textContent = "Line of sight blocked.";
      return;
    }
    const headAbility = this.primaryAbilityForSection(level, "head", unit);
    const bodyAbility = this.primaryAbilityForSection(level, "body", unit);
    const messages: string[] = [];
    const effects = [headAbility?.effect, bodyAbility?.effect];
    for (const effect of effects) {
      const cleanseCount = this.effectNumber(effect, "cleanse");
      for (let index = 0; index < cleanseCount; index += 1) {
        const removed = this.cleanseUnit(target);
        if (removed) {
          messages.push(`cleansed ${removed}`);
        }
      }
      const adjacentHeal = this.effectNumber(effect, "healAdjacent");
      if (adjacentHeal > 0 && this.distance(unit, target) <= 1) {
        target.hp = Math.min(99, target.hp + adjacentHeal);
        messages.push(`healed ${adjacentHeal}`);
      }
      const rangedHeal = this.effectNumber(effect, "heal");
      if (rangedHeal > 0) {
        target.hp = Math.min(99, target.hp + rangedHeal);
        messages.push(`healed ${rangedHeal}`);
      }
      messages.push(...this.applyConditionsFromEffect(unit, target, effect).map((name) => `applied ${name}`));
    }
    if (messages.length === 0) {
      this.footerLabel.textContent = "No support effect on this face.";
      return;
    }
    turn.acted = true;
    this.command = "select";
    this.scene.setRangeOverlay();
    this.scene.setLevel(level);
    this.scene.setSelected({ x: unit.x, z: unit.z });
    this.showActionFx("support");
    this.updateHud(level);
    this.footerLabel.textContent = `${target.name}: ${messages.join(", ")}.`;
    this.notifyProgress();
  }

  private aiStepStateFor(unit: UnitData): AIStepState {
    const existing = this.aiStepStates.get(unit.id);
    if (existing) {
      return existing;
    }
    const state: AIStepState = {
      unitId: unit.id,
      stepIndex: 0
    };
    this.aiStepStates.set(unit.id, state);
    return state;
  }

  private consumeAIActionStep(unit: UnitData): AIActionStep {
    const behavior = normalizeAIBehavior(unit.aiBehavior);
    const sequence = aiBehaviorSequences[behavior];
    const state = this.aiStepStateFor(unit);
    const step = sequence[state.stepIndex % sequence.length] ?? "attack";
    state.stepIndex = (state.stepIndex + 1) % sequence.length;
    return step;
  }

  private rotateAISectionForBestStats(unit: UnitData, section: SectionName, score: (stats: ClassSectionStats) => number): boolean {
    const turn = this.turnStateFor(unit);
    const current = ((unit.rotations[section] % 4) + 4) % 4;
    let bestIndex = current;
    let bestScore = score(this.sectionStatsForRotation(section, unit, current));
    for (let index = 0; index < 4; index += 1) {
      const candidateScore = score(this.sectionStatsForRotation(section, unit, index));
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestIndex = index;
      }
    }
    const distance = Math.abs(bestIndex - current);
    const twistCost = Math.min(distance, 4 - distance);
    if (bestIndex === current || twistCost <= 0 || turn.twists + twistCost > maxTwistsPerTurn) {
      return false;
    }
    unit.rotations[section] = bestIndex;
    turn.twists += twistCost;
    return true;
  }

  private livingPlayers(level: LevelData): UnitData[] {
    return level.units.filter((unit) => unit.team === "player" && unit.hp > 0);
  }

  private nearestPlayer(level: LevelData, unit: UnitData): UnitData | undefined {
    return this.livingPlayers(level).sort((a, b) => this.distance(unit, a) - this.distance(unit, b) || a.hp - b.hp)[0];
  }

  private validMoveTiles(level: LevelData, unit: UnitData, range: number, includeCurrent = false): TileCoord[] {
    const tiles: TileCoord[] = [];
    for (let z = 0; z < level.depth; z += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const coord = { x, z };
        const isCurrent = coord.x === unit.x && coord.z === unit.z;
        if (!includeCurrent && isCurrent) {
          continue;
        }
        if (this.distance(unit, coord) > range) {
          continue;
        }
        const occupant = this.unitAt(level, coord);
        if (occupant && occupant.id !== unit.id) {
          continue;
        }
        if (this.isBlocked(level, coord)) {
          continue;
        }
        tiles.push(coord);
      }
    }
    return tiles;
  }

  private moveUnitForAI(level: LevelData, unit: UnitData, coord: TileCoord): string[] {
    if (coord.x === unit.x && coord.z === unit.z) {
      return [];
    }
    const turn = this.turnStateFor(unit);
    unit.x = coord.x;
    unit.z = coord.z;
    turn.moved = true;
    const legAbility = this.primaryAbilityForSection(level, "legs", unit);
    return this.applyConditionsFromEffect(unit, unit, legAbility?.effect);
  }

  private findVisibleAttackTarget(level: LevelData, unit: UnitData): UnitData | undefined {
    const body = this.sectionStats(level, "body", unit);
    const range = Math.max(1, body.range);
    return this.livingPlayers(level)
      .filter((target) => this.distance(unit, target) <= range && this.hasLineOfSight(level, unit, target))
      .sort((a, b) => a.hp - b.hp || this.distance(unit, a) - this.distance(unit, b))[0];
  }

  private attackUnitForAI(level: LevelData, attacker: UnitData, target: UnitData): string {
    const turn = this.turnStateFor(attacker);
    const attackerBody = this.sectionStats(level, "body", attacker);
    const defenderBody = this.sectionStats(level, "body", target);
    const attack = Math.max(1, attackerBody.attack);
    const defense = Math.max(0, defenderBody.defense);
    const heightBonus = Math.max(0, this.tileHeight(level, attacker) - this.tileHeight(level, target));
    const damage = Math.max(1, attack + heightBonus - Math.floor(defense / 2));
    target.hp -= damage;
    turn.acted = true;
    const bodyAbility = this.primaryAbilityForSection(level, "body", attacker);
    const headAbility = this.primaryAbilityForSection(level, "head", attacker);
    const applied = target.hp > 0
      ? [
          ...this.applyConditionsFromEffect(attacker, target, bodyAbility?.effect),
          ...this.applyConditionsFromEffect(attacker, target, headAbility?.effect, "applyOnAttack")
        ]
      : [];
    const message = target.hp <= 0
      ? `${attacker.name} defeats ${target.name}.`
      : `${attacker.name} hits ${target.name} for ${damage}${applied.length ? ` / ${applied.join(", ")}` : ""}.`;
    if (target.hp <= 0) {
      level.units = level.units.filter((candidate) => candidate.id !== target.id);
      this.repairRuntimeInitiative(level);
    }
    this.scene.setLevel(level);
    this.scene.setSelected({ x: attacker.x, z: attacker.z });
    this.showActionFx("attack");
    return message;
  }

  private guardUnitForAI(level: LevelData, unit: UnitData): string {
    const turn = this.turnStateFor(unit);
    turn.acted = true;
    const applied = this.applyCondition(unit, "braced", unit);
    this.scene.setLevel(level);
    this.scene.setSelected({ x: unit.x, z: unit.z });
    this.showActionFx("guard");
    return `${unit.name} defends${applied ? ` and gains ${applied}` : ""}.`;
  }

  private moveTowardNearestPlayer(level: LevelData, unit: UnitData): string | undefined {
    const target = this.nearestPlayer(level, unit);
    if (!target) {
      return undefined;
    }
    this.rotateAISectionForBestStats(unit, "legs", (stats) => stats.move);
    const moveRange = Math.max(1, this.sectionStats(level, "legs", unit).move);
    const destination = this.validMoveTiles(level, unit, moveRange)
      .sort((a, b) =>
        this.distance(a, target) - this.distance(b, target) ||
        this.tileHeight(level, b) - this.tileHeight(level, a) ||
        this.distance(unit, b) - this.distance(unit, a)
      )[0];
    if (!destination) {
      return undefined;
    }
    const applied = this.moveUnitForAI(level, unit, destination);
    this.scene.setLevel(level);
    this.scene.setSelected({ x: unit.x, z: unit.z });
    this.showActionFx("move");
    return `${unit.name} advances to ${destination.x}, ${destination.z}${applied.length ? ` and gains ${applied.join(", ")}` : ""}.`;
  }

  private resolveAIAttack(level: LevelData, unit: UnitData): string {
    this.rotateAISectionForBestStats(unit, "body", (stats) => stats.attack * 2 + stats.range);
    let target = this.findVisibleAttackTarget(level, unit);
    if (target) {
      return this.attackUnitForAI(level, unit, target);
    }
    const moveMessage = this.moveTowardNearestPlayer(level, unit);
    this.rotateAISectionForBestStats(unit, "body", (stats) => stats.attack * 2 + stats.range);
    target = this.findVisibleAttackTarget(level, unit);
    if (target) {
      return `${moveMessage ?? `${unit.name} repositions.`} ${this.attackUnitForAI(level, unit, target)}`;
    }
    return moveMessage ? `${moveMessage} ${this.guardUnitForAI(level, unit)}` : this.guardUnitForAI(level, unit);
  }

  private resolveAIAvoid(level: LevelData, unit: UnitData): string {
    const players = this.livingPlayers(level);
    if (players.length === 0) {
      return this.guardUnitForAI(level, unit);
    }
    this.rotateAISectionForBestStats(unit, "legs", (stats) => stats.move);
    this.rotateAISectionForBestStats(unit, "body", (stats) => stats.range);
    const moveRange = Math.max(1, this.sectionStats(level, "legs", unit).move);
    const destination = this.validMoveTiles(level, unit, moveRange)
      .sort((a, b) => {
        const distanceA = Math.min(...players.map((player) => this.distance(a, player)));
        const distanceB = Math.min(...players.map((player) => this.distance(b, player)));
        const losA = players.some((player) => this.hasLineOfSight(level, a, player)) ? 1 : 0;
        const losB = players.some((player) => this.hasLineOfSight(level, b, player)) ? 1 : 0;
        return distanceB - distanceA || this.tileHeight(level, b) - this.tileHeight(level, a) || losB - losA;
      })[0];
    if (!destination) {
      return this.guardUnitForAI(level, unit);
    }
    const applied = this.moveUnitForAI(level, unit, destination);
    this.turnStateFor(unit).acted = true;
    this.scene.setLevel(level);
    this.scene.setSelected({ x: unit.x, z: unit.z });
    this.showActionFx("move");
    return `${unit.name} avoids to ${destination.x}, ${destination.z}${applied.length ? ` and gains ${applied.join(", ")}` : ""}.`;
  }

  private resolveEnemyTurn(level: LevelData, unit: UnitData): string {
    if (unit.hp <= 0) {
      return "";
    }
    const step = this.consumeAIActionStep(unit);
    if (step === "defend") {
      return this.guardUnitForAI(level, unit);
    }
    if (step === "avoid") {
      return this.resolveAIAvoid(level, unit);
    }
    return this.resolveAIAttack(level, unit);
  }

  private endPlayerTurn(): void {
    const level = this.currentLevel();
    if (!level || this.titleOpen || this.storyQueue.length > 0) {
      return;
    }
    const unit = this.selectedUnit(level);
    if (!this.isActivePlayerUnit(level, unit)) {
      this.footerLabel.textContent = "Only the active player unit can end its turn.";
      return;
    }
    this.command = "select";
    this.inspectedCoord = undefined;
    this.scene.setRangeOverlay();
    this.advanceInitiative(`${unit?.name ?? "Player"} ends turn.`);
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
    if (this.command === "support") {
      this.trySupportTarget(coord);
      return;
    }
    if (unit?.team === "player") {
      if (!this.isActivePlayerUnit(level, unit)) {
        this.inspectedCoord = coord;
        this.scene.setSelected(coord);
        this.renderAbilityStrip(level);
        this.updateCommandButtons();
        this.footerLabel.textContent = `${unit.name} is waiting for initiative.`;
        return;
      }
      this.selectedUnitId = unit.id;
      this.command = "select";
      this.inspectedCoord = undefined;
      this.scene.setRangeOverlay();
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
    if (this.command === "inspect") {
      this.inspectedCoord = coord;
      this.scene.setSelected(coord);
      this.updateRangeOverlay(level);
      this.renderAbilityStrip(level);
      this.updateCommandButtons();
      const selected = this.selectedUnit(level);
      const range = selected ? this.rangeForCommand(level, selected, "inspect") : 0;
      const los = selected ? this.hasLineOfSight(level, selected, coord) : true;
      this.footerLabel.textContent = `Tile ${coord.x}, ${coord.z} / height ${this.tileHeight(level, coord)} / sight ${range} / LOS ${los ? "clear" : "blocked"}`;
      return;
    }
    this.inspectedCoord = coord;
    this.scene.setSelected(coord);
    this.renderAbilityStrip(level);
    this.updateCommandButtons();
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
      } else {
        this.resolveEnemyTurnsIfNeeded();
      }
      return;
    }

    const isScreen = beat.presentation === "screen";
    this.storyLayer.className = `story-layer open ${isScreen ? "story-screen" : "story-dialog"}`;
    this.storyLayer.innerHTML = `
      <div class="story-panel ${beat.avatarUrl ? "story-panel-with-avatar" : ""}">
        ${beat.avatarUrl ? `<img class="story-avatar" src="${escapeHtml(beat.avatarUrl)}" alt="${escapeHtml(beat.speaker || beat.title || "Story speaker")}">` : ""}
        <div class="story-copy">
          ${beat.speaker ? `<span class="story-speaker">${escapeHtml(beat.speaker)}</span>` : ""}
          ${beat.title ? `<h2>${escapeHtml(beat.title)}</h2>` : ""}
          <p>${escapeHtml(beat.text)}</p>
          <button data-story-continue>Continue</button>
        </div>
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
