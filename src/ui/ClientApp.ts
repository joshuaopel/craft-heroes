import {
  defaultCampaign,
  defaultClassDefinitions,
  defaultEnvironmentMaterials,
  defaultEnvironmentSettings,
  defaultLevels,
  defaultPropDefinitions
} from "../game/content";
import type {
  CampaignData,
  ClassDefinition,
  EnvironmentMaterialDefinition,
  LevelData,
  PropDefinition,
  StoryBeat,
  TileCoord
} from "../game/schema";
import { LevelScene } from "../render/LevelScene";

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
        </div>
      </div>
      <div class="client-footer">
        <span>Awaiting orders</span>
        <button data-client-action="complete">Complete Mission</button>
      </div>
      <input class="visually-hidden" data-client-files type="file" accept=".json,application/json" multiple>
      <div class="story-layer" aria-live="polite"></div>
    `;
    this.canvas = this.root.querySelector(".world-canvas") as HTMLCanvasElement;
    this.levelName = this.root.querySelector("#client-level-name") as HTMLElement;
    this.objective = this.root.querySelector("#client-objective") as HTMLElement;
    this.progress = this.root.querySelector("#client-progress") as HTMLElement;
    this.storyLayer = this.root.querySelector(".story-layer") as HTMLElement;
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
    this.loadLevel(this.currentLevelId);
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
        } else if (action === "complete") {
          this.completeLevel();
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
      this.loadLevel(startId);
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

  restoreSave(save: ClientSaveData): boolean {
    if (
      save.version !== 1 ||
      save.campaignId !== this.campaign.id ||
      !this.levels.some((level) => level.id === save.currentLevelId)
    ) {
      return false;
    }
    this.storyQueue = [];
    this.shownStory = new Set(save.shownStory);
    this.started = true;
    this.loadLevel(save.currentLevelId);
    return true;
  }

  private currentLevel(): LevelData | undefined {
    return this.levels.find((level) => level.id === this.currentLevelId);
  }

  private loadLevel(levelId: string): void {
    const level = this.levels.find((candidate) => candidate.id === levelId) ?? this.levels[0];
    if (!level) {
      this.showError("No playable levels were found in those files.");
      return;
    }
    this.currentLevelId = level.id;
    this.advancingAfterStory = false;
    this.scene.setLevel(level, { frame: true });
    this.scene.setSelected(undefined);
    this.updateHud(level);
    this.enqueueStory(level.story.filter((beat) => beat.trigger === "levelStart"));
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
    this.progress.textContent = `MISSION ${campaignIndex + 1} / ${Math.max(1, this.campaign.levels.length)}`;
    this.levelName.textContent = level.name;
    this.objective.textContent = objectiveLabel(level);
  }

  private handleTile(coord: TileCoord): void {
    const level = this.currentLevel();
    if (!level || this.storyQueue.length > 0) {
      return;
    }
    this.scene.setSelected(coord);
    this.enqueueStory(
      level.story.filter(
        (beat) => beat.trigger === "tileEnter" && beat.x === coord.x && beat.z === coord.z
      )
    );
  }

  private completeLevel(): void {
    const level = this.currentLevel();
    if (!level || this.storyQueue.length > 0) {
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
    this.invokeHost("save", () => this.options.onProgress?.(this.exportSave()));
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
