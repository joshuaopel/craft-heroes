import {
  defaultCampaign,
  defaultClassDefinitions,
  defaultEnvironmentMaterials,
  defaultEnvironmentSettings,
  defaultGameplayRules,
  defaultLevels,
  defaultPropDefinitions,
  makeTiles,
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
  AbilityDefinition,
  AbilityTrigger,
  CampaignData,
  ClassDefinition,
  ClassId,
  ClassSectionStats,
  ConditionDefinition,
  ConditionKind,
  EditorTool,
  EnvironmentMaterialDefinition,
  EnvironmentMaterialId,
  EnvironmentSurfaceEffect,
  EnvironmentSettings,
  GameplayRules,
  LevelData,
  ObstacleType,
  PropDefinition,
  PropDefinitionId,
  SectionName,
  StoryBeat,
  StoryPresentation,
  StoryTrigger,
  Team,
  TerrainType,
  TitleScreenSettings,
  TileCoord,
  UnitTemplate
} from "../game/schema";
import {
  clientPreviewStorageKey,
  clientSaveStorageKey,
  editorProjectStorageKey,
  type ClientPreviewHandoff
} from "../game/storage";
import { LevelScene } from "../render/LevelScene";

const directionLabels = ["S", "E", "N", "W"] as const;
const sectionNames: SectionName[] = ["head", "body", "legs"];
const abilityTriggers: AbilityTrigger[] = ["active", "passive", "onMove", "onAttack", "onDefend", "onSupport"];
const conditionKinds: ConditionKind[] = ["buff", "debuff", "trap", "status"];
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

type EditorProjectBundle = {
  campaign?: CampaignData;
  levels?: LevelData[];
  level?: LevelData;
  templates?: UnitTemplate[];
  classes?: ClassDefinition[];
  classDefinitions?: ClassDefinition[];
  terrainMaterials?: EnvironmentMaterialDefinition[];
  environmentMaterials?: EnvironmentMaterialDefinition[];
  props?: PropDefinition[];
  propDefinitions?: PropDefinition[];
};

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

function assetPreviewImage(imageUrl: string): string {
  return imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="">` : "";
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

function levelIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `level-${Date.now()}`;
}

function safeFileName(name: string): string {
  const slug = levelIdFromName(name);
  return slug.endsWith(".json") ? slug : `${slug}.json`;
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

function normalizeStatModifier(modifiers: Partial<ConditionDefinition["modifiers"]> | undefined): ConditionDefinition["modifiers"] {
  return {
    attack: Math.max(-12, Math.min(12, numberOrFallback(modifiers?.attack, 0))),
    defense: Math.max(-12, Math.min(12, numberOrFallback(modifiers?.defense, 0))),
    move: Math.max(-12, Math.min(12, numberOrFallback(modifiers?.move, 0))),
    range: Math.max(-12, Math.min(12, numberOrFallback(modifiers?.range, 0))),
    support: Math.max(-12, Math.min(12, numberOrFallback(modifiers?.support, 0))),
    initiative: Math.max(-12, Math.min(12, numberOrFallback(modifiers?.initiative, 0)))
  };
}

function modifierToText(modifiers: ConditionDefinition["modifiers"]): string {
  return Object.entries(modifiers)
    .filter(([, value]) => Number(value) !== 0)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

function textToModifier(value: string): ConditionDefinition["modifiers"] {
  const modifier: ConditionDefinition["modifiers"] = {};
  for (const part of value.split(";").map((item) => item.trim()).filter(Boolean)) {
    const [key, rawValue] = part.split(":").map((item) => item.trim());
    if (!key) {
      continue;
    }
    const parsed = numberOrFallback(rawValue, 0);
    if (["attack", "defense", "move", "range", "support", "initiative"].includes(key)) {
      modifier[key as keyof ConditionDefinition["modifiers"]] = Math.max(-12, Math.min(12, parsed));
    }
  }
  return normalizeStatModifier(modifier);
}

function idFromLabel(label: string, fallbackPrefix: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `${fallbackPrefix}-${Date.now()}`;
}

function normalizeAbility(ability: Partial<AbilityDefinition>, index: number): AbilityDefinition {
  const name = ability.name || ability.description || `Ability ${index + 1}`;
  const trigger = abilityTriggers.includes(ability.trigger as AbilityTrigger) ? (ability.trigger as AbilityTrigger) : "passive";
  return {
    id: ability.id || idFromLabel(name, "ability"),
    name,
    trigger,
    icon: (ability.icon || name.slice(0, 2) || "FX").toUpperCase().slice(0, 3),
    color: isHexColor(ability.color) ? ability.color : "#60d7e4",
    description: ability.description || "",
    effect: ability.effect || ""
  };
}

function normalizeAbilities(value: unknown): AbilityDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((ability, index) => normalizeAbility(ability as Partial<AbilityDefinition>, index));
}

function normalizeSurfaceEffect(value: unknown): EnvironmentSurfaceEffect {
  return value === "grass" || value === "water" || value === "solid" ? value : "solid";
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function normalizeGrassColors(value: unknown, fallback: string[]): string[] {
  const colors = Array.isArray(value) ? value.filter(isHexColor) : [];
  const merged = [...colors, ...fallback.filter(isHexColor), "#79b95a", "#94c866", "#b1dc70"];
  return merged.slice(0, 3);
}

function normalizeQuarterTurn(value: unknown): number {
  const angle = numberOrFallback(value, 0);
  const quarterTurn = Math.PI / 2;
  const normalizedSteps = ((Math.round(angle / quarterTurn) % 4) + 4) % 4;
  return normalizedSteps * quarterTurn;
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
      abilities: normalizeAbilities(sourceSection.abilities),
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
  const background = environment?.backgroundModel;
  return {
    skyColor: environment?.skyColor || defaultEnvironmentSettings.skyColor,
    fogColor: environment?.fogColor || defaultEnvironmentSettings.fogColor,
    groundColor: environment?.groundColor || defaultEnvironmentSettings.groundColor,
    groundTextureUrl: environment?.groundTextureUrl || "",
    ambientIntensity: Math.max(0, Math.min(4, numberOrFallback(environment?.ambientIntensity, defaultEnvironmentSettings.ambientIntensity))),
    sunIntensity: Math.max(0, Math.min(6, numberOrFallback(environment?.sunIntensity, defaultEnvironmentSettings.sunIntensity))),
    windStrength: Math.max(0, Math.min(3, numberOrFallback(environment?.windStrength, defaultEnvironmentSettings.windStrength))),
    windSpeed: Math.max(0, Math.min(4, numberOrFallback(environment?.windSpeed, defaultEnvironmentSettings.windSpeed))),
    backgroundModel: {
      modelUrl: typeof background?.modelUrl === "string" ? background.modelUrl : "",
      modelFileName: typeof background?.modelFileName === "string" ? background.modelFileName : "",
      fitToMap: background?.fitToMap ?? true,
      scale: Math.max(0.01, Math.min(20, numberOrFallback(background?.scale, 1))),
      rotation: numberOrFallback(background?.rotation, 0),
      offsetY: Math.max(-20, Math.min(20, numberOrFallback(background?.offsetY, 0)))
    }
  };
}

function normalizeMaterialDefinition(material: Partial<EnvironmentMaterialDefinition>): EnvironmentMaterialDefinition {
  const fallback = defaultEnvironmentMaterials[0];
  const id = material.id || materialIdFromName(material.name || fallback.name);
  return {
    id,
    name: material.name || id,
    surfaceEffect: normalizeSurfaceEffect(material.surfaceEffect ?? fallback.surfaceEffect),
    grassDensity: Math.max(0, Math.min(30, numberOrFallback(material.grassDensity, fallback.grassDensity ?? 0))),
    grassHeightMin: Math.max(0.01, Math.min(0.3, numberOrFallback(material.grassHeightMin, fallback.grassHeightMin ?? 0.03))),
    grassHeightMax: Math.max(0.01, Math.min(0.35, numberOrFallback(material.grassHeightMax, fallback.grassHeightMax ?? 0.095))),
    grassColors: normalizeGrassColors(material.grassColors, fallback.grassColors ?? []),
    topColor: material.topColor || fallback.topColor,
    sideColor: material.sideColor || fallback.sideColor,
    sideCapColor: material.sideCapColor || material.sideColor || fallback.sideCapColor,
    sideFullColor: material.sideFullColor || material.sideColor || fallback.sideFullColor,
    sideHalfColor: material.sideHalfColor || material.sideColor || fallback.sideHalfColor,
    topImageUrl: typeof material.topImageUrl === "string" ? material.topImageUrl : "",
    sideImageUrl: typeof material.sideImageUrl === "string" ? material.sideImageUrl : "",
    sideCapImageUrl: typeof material.sideCapImageUrl === "string" ? material.sideCapImageUrl : typeof material.sideImageUrl === "string" ? material.sideImageUrl : "",
    sideFullImageUrl: typeof material.sideFullImageUrl === "string" ? material.sideFullImageUrl : typeof material.sideImageUrl === "string" ? material.sideImageUrl : "",
    sideHalfImageUrl: typeof material.sideHalfImageUrl === "string" ? material.sideHalfImageUrl : typeof material.sideImageUrl === "string" ? material.sideImageUrl : "",
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
    assetKind: prop.assetKind === "glb" ? "glb" : "box",
    windEffect: Boolean(prop.windEffect ?? fallback.windEffect),
    emitsLight: Boolean(prop.emitsLight ?? fallback.emitsLight),
    lightColor: isHexColor(prop.lightColor) ? prop.lightColor : fallback.lightColor || "#ffb85c",
    lightIntensity: Math.max(0, Math.min(8, numberOrFallback(prop.lightIntensity, fallback.lightIntensity ?? 1.4))),
    lightRange: Math.max(0.5, Math.min(16, numberOrFallback(prop.lightRange, fallback.lightRange ?? 4))),
    lightOffsetY: Math.max(0, Math.min(5, numberOrFallback(prop.lightOffsetY, fallback.lightOffsetY ?? fallback.height))),
    color: prop.color || fallback.color,
    textureUrl: typeof prop.textureUrl === "string" ? prop.textureUrl : "",
    modelUrl: typeof prop.modelUrl === "string" ? prop.modelUrl : "",
    modelFileName: typeof prop.modelFileName === "string" ? prop.modelFileName : "",
    fitModelToTile: prop.fitModelToTile ?? true,
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

function normalizeStoryBeat(beat: Partial<StoryBeat>, index: number, width: number, depth: number): StoryBeat {
  const trigger = beat.trigger === "tileEnter" || beat.trigger === "levelComplete" ? beat.trigger : "levelStart";
  const presentation = beat.presentation === "screen" ? "screen" : "dialog";
  const normalized: StoryBeat = {
    id: String(beat.id || `story-${index + 1}`),
    trigger,
    presentation,
    title: String(beat.title ?? ""),
    speaker: String(beat.speaker ?? ""),
    text: String(beat.text || "New story beat"),
    avatarUrl: typeof beat.avatarUrl === "string" ? beat.avatarUrl : ""
  };
  if (trigger === "tileEnter") {
    normalized.x = Math.max(0, Math.min(Math.max(0, width - 1), Math.round(numberOrFallback(beat.x, 0))));
    normalized.z = Math.max(0, Math.min(Math.max(0, depth - 1), Math.round(numberOrFallback(beat.z, 0))));
  }
  return normalized;
}

function normalizeLevelData(level: LevelData): LevelData {
  return {
    ...level,
    environment: normalizeEnvironment(level.environment),
    obstacles: Array.isArray(level.obstacles)
      ? level.obstacles.map((obstacle) => ({
          ...obstacle,
          rotation: normalizeQuarterTurn(obstacle.rotation)
        }))
      : [],
    surroundings: Array.isArray(level.surroundings) ? level.surroundings : [],
    units: Array.isArray(level.units)
      ? level.units.map((unit) => ({
          ...unit,
          conditions: Array.isArray(unit.conditions)
            ? unit.conditions.map((condition) => ({
                id: String(condition.id ?? ""),
                turns: Math.max(0, Math.min(12, numberOrFallback(condition.turns, 0))),
                stacks: Math.max(1, Math.min(9, numberOrFallback(condition.stacks, 1))),
                source: condition.source
              })).filter((condition) => condition.id)
            : []
        }))
      : [],
    story: Array.isArray(level.story)
      ? level.story.map((beat, index) => normalizeStoryBeat(beat, index, level.width, level.depth))
      : []
  };
}

function normalizeTitleScreenSettings(settings: Partial<TitleScreenSettings> | undefined, fallbackLevelId: string): TitleScreenSettings {
  const fallback = defaultCampaign.titleScreen;
  return {
    kicker: settings?.kicker || fallback?.kicker || "Voxel tactics prototype",
    headline: settings?.headline || fallback?.headline || "Craft Heroes",
    subhead:
      settings?.subhead ||
      fallback?.subhead ||
      "Rotate class faces, chain handmade levels, and test the build language for a Steam-ready tactics pitch.",
    backgroundLevelId: settings?.backgroundLevelId || fallback?.backgroundLevelId || fallbackLevelId,
    cameraOrbit: settings?.cameraOrbit ?? fallback?.cameraOrbit ?? true,
    orbitSpeed: Math.max(0.01, Math.min(0.4, numberOrFallback(settings?.orbitSpeed, fallback?.orbitSpeed ?? 0.08))),
    mockBattle: settings?.mockBattle ?? fallback?.mockBattle ?? true
  };
}

function normalizeConditionDefinition(condition: Partial<ConditionDefinition>, index: number): ConditionDefinition {
  const fallback = defaultGameplayRules.conditions[index] ?? defaultGameplayRules.conditions[0];
  const name = condition.name || fallback.name || `Condition ${index + 1}`;
  const kind = conditionKinds.includes(condition.kind as ConditionKind) ? (condition.kind as ConditionKind) : fallback.kind;
  return {
    id: condition.id || idFromLabel(name, "condition"),
    name,
    kind,
    icon: (condition.icon || name.slice(0, 2) || "FX").toUpperCase().slice(0, 3),
    color: isHexColor(condition.color) ? condition.color : fallback.color,
    duration: Math.max(0, Math.min(12, numberOrFallback(condition.duration, fallback.duration))),
    stackable: Boolean(condition.stackable ?? fallback.stackable),
    hidden: Boolean(condition.hidden ?? fallback.hidden),
    description: condition.description || fallback.description || "",
    modifiers: normalizeStatModifier(condition.modifiers ?? fallback.modifiers),
    effect: condition.effect || ""
  };
}

function normalizeGameplayRules(rules: Partial<GameplayRules> | undefined): GameplayRules {
  const incomingConditions = Array.isArray(rules?.conditions) ? rules.conditions : defaultGameplayRules.conditions;
  return {
    initiative: {
      base: Math.max(0, Math.min(50, numberOrFallback(rules?.initiative?.base, defaultGameplayRules.initiative.base))),
      headWeight: Math.max(0, Math.min(5, numberOrFallback(rules?.initiative?.headWeight, defaultGameplayRules.initiative.headWeight))),
      bodyWeight: Math.max(0, Math.min(5, numberOrFallback(rules?.initiative?.bodyWeight, defaultGameplayRules.initiative.bodyWeight))),
      legsWeight: Math.max(0, Math.min(5, numberOrFallback(rules?.initiative?.legsWeight, defaultGameplayRules.initiative.legsWeight))),
      heightWeight: Math.max(0, Math.min(5, numberOrFallback(rules?.initiative?.heightWeight, defaultGameplayRules.initiative.heightWeight))),
      conditionWeight: Math.max(0, Math.min(5, numberOrFallback(rules?.initiative?.conditionWeight, defaultGameplayRules.initiative.conditionWeight))),
      random: Math.max(0, Math.min(10, numberOrFallback(rules?.initiative?.random, defaultGameplayRules.initiative.random))),
      tieBreaker:
        rules?.initiative?.tieBreaker === "enemy" || rules?.initiative?.tieBreaker === "higherHp"
          ? rules.initiative.tieBreaker
          : defaultGameplayRules.initiative.tieBreaker
    },
    conditions: incomingConditions.map((condition, index) => normalizeConditionDefinition(condition, index))
  };
}

function normalizeCampaignData(campaign: CampaignData, levels: LevelData[]): CampaignData {
  const levelIds = new Set(levels.map((level) => level.id));
  const refs = Array.isArray(campaign.levels) && campaign.levels.length > 0
    ? campaign.levels
        .filter((entry) => typeof entry.id === "string" && entry.id)
        .map((entry) => ({
          id: entry.id,
          file: entry.file || `levels/${entry.id}.json`,
          next: Array.isArray(entry.next) ? entry.next.filter((id) => typeof id === "string" && id) : []
        }))
    : levels.map((level, index) => ({
        id: level.id,
        file: `levels/${level.id}.json`,
        next: levels[index + 1] ? [levels[index + 1].id] : []
      }));
  const seen = new Set(refs.map((entry) => entry.id));
  for (const level of levels) {
    if (!seen.has(level.id)) {
      refs.push({ id: level.id, file: `levels/${level.id}.json`, next: level.links[0]?.to ? [level.links[0].to] : [] });
    }
  }
  const fallbackStart = levels[0]?.id ?? defaultCampaign.startLevel;
  const startLevel = levelIds.has(campaign.startLevel) ? campaign.startLevel : refs[0]?.id ?? fallbackStart;
  return {
    ...campaign,
    id: campaign.id || defaultCampaign.id,
    title: campaign.title || defaultCampaign.title,
    startLevel,
    titleScreen: normalizeTitleScreenSettings(campaign.titleScreen, startLevel),
    gameplay: normalizeGameplayRules(campaign.gameplay),
    levels: refs
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

function abilitiesToText(abilities: AbilityDefinition[]): string {
  return abilities
    .map((ability) =>
      [ability.name, ability.trigger, ability.icon, ability.color, ability.description, ability.effect]
        .map((part) => part.trim())
        .join(" | ")
    )
    .join("\n");
}

function textToAbilities(value: string, fallback: AbilityDefinition[] = []): AbilityDefinition[] {
  const entries = value
    .split(/[;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) {
    return fallback;
  }
  return entries.map((entry, index) => {
    const [name = `Ability ${index + 1}`, trigger = "passive", icon = "", color = "#60d7e4", description = "", effect = ""] = entry
      .split("|")
      .map((part) => part.trim());
    return normalizeAbility(
      {
        id: idFromLabel(name, "ability"),
        name,
        trigger: abilityTriggers.includes(trigger as AbilityTrigger) ? (trigger as AbilityTrigger) : "passive",
        icon,
        color,
        description,
        effect
      },
      index
    );
  });
}

function textToConditions(value: string): string[] {
  return value
    .split(/[,;\n]+/)
    .map((condition) => condition.trim())
    .filter(Boolean);
}

function ruleConditionsToText(conditions: ConditionDefinition[]): string {
  return conditions
    .map((condition) =>
      [
        condition.name,
        condition.kind,
        condition.icon,
        condition.color,
        String(condition.duration),
        condition.stackable ? "stack" : "single",
        condition.hidden ? "hidden" : "shown",
        modifierToText(condition.modifiers),
        condition.effect,
        condition.description
      ]
        .map((part) => part.trim())
        .join(" | ")
    )
    .join("\n");
}

function textToRuleConditions(value: string, fallback: ConditionDefinition[]): ConditionDefinition[] {
  const rows = value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);
  if (rows.length === 0) {
    return fallback;
  }
  return rows.map((row, index) => {
    const [
      name = `Condition ${index + 1}`,
      kind = "status",
      icon = "",
      color = "#60d7e4",
      duration = "1",
      stackMode = "single",
      visibility = "shown",
      modifiers = "",
      effect = "",
      description = ""
    ] = row.split("|").map((part) => part.trim());
    return normalizeConditionDefinition(
      {
        id: idFromLabel(name, "condition"),
        name,
        kind: conditionKinds.includes(kind as ConditionKind) ? (kind as ConditionKind) : "status",
        icon,
        color,
        duration: numberOrFallback(duration, 1),
        stackable: /^stack/i.test(stackMode),
        hidden: /^hidden/i.test(visibility),
        modifiers: textToModifier(modifiers),
        effect,
        description
      },
      index
    );
  });
}

interface StoryDraft {
  editingId?: string;
  trigger: StoryTrigger;
  presentation: StoryPresentation;
  title: string;
  speaker: string;
  text: string;
  avatarUrl: string;
  x: number;
  z: number;
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
  propRotationSteps: number;
  storyDraft: StoryDraft;
  selected?: TileCoord;
}

export class EditorApp {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene: LevelScene;
  private readonly panel: HTMLElement;
  private readonly utility: HTMLElement;
  private levels: LevelData[] = defaultLevels.map((level) => normalizeLevelData(cloneLevel(level)));
  private campaign: CampaignData = normalizeCampaignData(structuredClone(defaultCampaign), this.levels);
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
    levelId: defaultCampaign.startLevel,
    propRotationSteps: 0,
    storyDraft: {
      trigger: "levelStart",
      presentation: "dialog",
      title: "",
      speaker: "",
      text: "",
      avatarUrl: "",
      x: 0,
      z: 0
    }
  };

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = "app-shell";
    this.root.innerHTML = `
      <canvas class="world-canvas" aria-label="Craft Heroes level editor viewport"></canvas>
      <aside class="editor-panel"></aside>
      <div class="utility-layer"></div>
      <div class="status-chip" id="status-chip"></div>
    `;
    this.canvas = this.root.querySelector(".world-canvas") as HTMLCanvasElement;
    this.panel = this.root.querySelector(".editor-panel") as HTMLElement;
    this.utility = this.root.querySelector(".utility-layer") as HTMLElement;
    this.loadStoredProject();
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

  private loadStoredProject(): void {
    const stored = readStoredJson<EditorProjectBundle>(editorProjectStorageKey);
    if (!stored) {
      return;
    }
    if (stored.levels?.length) {
      this.levels = stored.levels.map((level) => normalizeLevelData(level));
    } else if (stored.level) {
      this.levels = [normalizeLevelData(stored.level)];
    }
    if (stored.campaign) {
      this.campaign = normalizeCampaignData(stored.campaign, this.levels);
    }
    const incomingMaterials = stored.terrainMaterials ?? stored.environmentMaterials;
    if (incomingMaterials?.length) {
      this.environmentMaterials = mergeMaterialDefinitions(defaultEnvironmentMaterials, incomingMaterials);
    }
    const incomingProps = stored.props ?? stored.propDefinitions;
    if (incomingProps?.length) {
      this.propDefinitions = mergePropDefinitions(defaultPropDefinitions, incomingProps);
    }
    const incomingClasses = stored.classes ?? stored.classDefinitions;
    if (incomingClasses?.length) {
      this.classDefinitions = mergeClassDefinitions(defaultClassDefinitions, incomingClasses);
    }
    if (stored.templates?.length) {
      this.templates = stored.templates.map((template) => structuredClone(template));
    }
    this.state.levelId = this.levels.find((level) => level.id === this.campaign.startLevel)?.id ?? this.levels[0]?.id ?? this.state.levelId;
    this.state.templateId = this.templates[1]?.id ?? this.templates[0]?.id ?? this.state.templateId;
    this.state.classId = this.classDefinitions[0]?.id ?? this.state.classId;
    this.state.terrain = this.environmentMaterials[0]?.id ?? this.state.terrain;
    this.state.obstacle = this.propDefinitions[0]?.id ?? this.state.obstacle;
  }

  private editorBundle(): EditorProjectBundle {
    return {
      campaign: this.campaign,
      levels: this.levels,
      level: this.currentLevel(),
      templates: this.templates,
      classes: this.classDefinitions,
      terrainMaterials: this.environmentMaterials,
      props: this.propDefinitions
    };
  }

  private editorJson(): string {
    return JSON.stringify(this.editorBundle(), null, 2);
  }

  private emptyStoryDraft(): StoryDraft {
    return {
      trigger: "levelStart",
      presentation: "dialog",
      title: "",
      speaker: "",
      text: "",
      avatarUrl: "",
      x: 0,
      z: 0
    };
  }

  private storyDraftFromBeat(beat: StoryBeat): StoryDraft {
    return {
      editingId: beat.id,
      trigger: beat.trigger,
      presentation: beat.presentation,
      title: beat.title,
      speaker: beat.speaker,
      text: beat.text,
      avatarUrl: beat.avatarUrl ?? "",
      x: Math.max(0, Math.round(numberOrFallback(beat.x, 0))),
      z: Math.max(0, Math.round(numberOrFallback(beat.z, 0)))
    };
  }

  private editorPreviewBundle(): EditorProjectBundle {
    return {
      ...this.editorBundle(),
      campaign: {
        ...this.campaign,
        startLevel: this.state.levelId,
        titleScreen: {
          ...normalizeTitleScreenSettings(this.campaign.titleScreen, this.state.levelId),
          backgroundLevelId: this.state.levelId
        }
      }
    };
  }

  private openClientPreview(): void {
    this.syncStoryDraftFromPanel();
    const handoff: ClientPreviewHandoff = {
      version: 1,
      source: "editor",
      timestamp: Date.now(),
      campaignId: this.campaign.id,
      startLevelId: this.state.levelId,
      content: this.editorPreviewBundle()
    };
    localStorage.setItem(editorProjectStorageKey, this.editorJson());
    localStorage.setItem(clientPreviewStorageKey, JSON.stringify(handoff));
    localStorage.removeItem(clientSaveStorageKey(this.campaign.id));
    const url = new URL("client.html", window.location.href);
    url.searchParams.set("preview", "editor");
    url.searchParams.set("level", this.state.levelId);
    url.searchParams.set("t", String(handoff.timestamp));
    window.location.href = url.href;
  }

  private levelOptions(selectedId: string, includeEnd = false): string {
    return `${includeEnd ? `<option value="">Campaign End</option>` : ""}${this.levels
      .map((level) => `<option value="${escapeHtml(level.id)}" ${level.id === selectedId ? "selected" : ""}>${escapeHtml(level.name)}</option>`)
      .join("")}`;
  }

  private downloadJsonFile(filename: string, json: string): void {
    const blob = new Blob([json], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  private openUtility(html: string): void {
    this.utility.className = "utility-layer open";
    this.utility.innerHTML = html;
    this.utility.querySelectorAll<HTMLButtonElement>("[data-utility-action]").forEach((button) => {
      button.addEventListener("click", () => this.handleUtilityAction(button.dataset.utilityAction ?? "", button.dataset.levelId));
    });
    this.utility.onclick = (event) => {
      if (event.target === this.utility) {
        this.closeUtility();
      }
    };
  }

  private closeUtility(): void {
    this.utility.className = "utility-layer";
    this.utility.innerHTML = "";
  }

  private openLevelFlowEditor(): void {
    const startLevel = this.levels.some((level) => level.id === this.campaign.startLevel) ? this.campaign.startLevel : this.levels[0].id;
    this.openUtility(`
      <div class="utility-modal flow-modal" role="dialog" aria-modal="true" aria-label="Level flow editor">
        <div class="utility-head">
          <div>
            <span>Campaign Utility</span>
            <h2>Level Flow</h2>
          </div>
          <button data-utility-action="close">Close</button>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Campaign ID</span>
            <input data-flow-campaign="id" type="text" value="${escapeHtml(this.campaign.id)}">
          </label>
          <label class="field">
            <span>Campaign Title</span>
            <input data-flow-campaign="title" type="text" value="${escapeHtml(this.campaign.title)}">
          </label>
          <label class="field">
            <span>Start Level</span>
            <select data-flow-campaign="startLevel">${this.levelOptions(startLevel)}</select>
          </label>
          <label class="field">
            <span>Total Missions</span>
            <input type="text" value="${this.levels.length}" disabled>
          </label>
        </div>
        <div class="flow-list">
          ${this.levels
            .map((level, index) => {
              const refNext = this.campaign.levels.find((entry) => entry.id === level.id)?.next[0] ?? "";
              const nextId = level.links[0]?.to ?? refNext;
              return `
                <div class="flow-row" data-flow-row data-level-id="${escapeHtml(level.id)}">
                  <strong>${index + 1}</strong>
                  <label>
                    <span>Name</span>
                    <input data-flow-field="name" type="text" value="${escapeHtml(level.name)}">
                  </label>
                  <label>
                    <span>ID</span>
                    <input data-flow-field="id" type="text" value="${escapeHtml(level.id)}">
                  </label>
                  <label>
                    <span>Next</span>
                    <select data-flow-field="next">${this.levelOptions(nextId, true)}</select>
                  </label>
                  <button data-utility-action="open-level" data-level-id="${escapeHtml(level.id)}">Open</button>
                </div>
              `;
            })
            .join("")}
        </div>
        <div class="utility-actions">
          <button data-utility-action="add-flow-level">Add Blank Level</button>
          <button data-utility-action="apply-flow">Apply Flow</button>
        </div>
      </div>
    `);
  }

  private openTitleEditor(): void {
    const settings = normalizeTitleScreenSettings(this.campaign.titleScreen, this.campaign.startLevel);
    this.openUtility(`
      <div class="utility-modal title-editor-modal" role="dialog" aria-modal="true" aria-label="Title screen editor">
        <div class="utility-head">
          <div>
            <span>Client Utility</span>
            <h2>Title Screen</h2>
          </div>
          <button data-utility-action="close">Close</button>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Kicker</span>
            <input data-title-field="kicker" type="text" value="${escapeHtml(settings.kicker)}">
          </label>
          <label class="field">
            <span>Headline</span>
            <input data-title-field="headline" type="text" value="${escapeHtml(settings.headline)}">
          </label>
          <label class="field title-wide">
            <span>Subtitle</span>
            <textarea class="story-textarea" data-title-field="subhead">${escapeHtml(settings.subhead)}</textarea>
          </label>
          <label class="field">
            <span>Backdrop Level</span>
            <select data-title-field="backgroundLevelId">${this.levelOptions(settings.backgroundLevelId)}</select>
          </label>
          <label class="field">
            <span>Orbit Speed</span>
            <input data-title-field="orbitSpeed" type="number" min="0.01" max="0.4" step="0.01" value="${settings.orbitSpeed}">
          </label>
        </div>
        <label class="check-row">
          <input data-title-field="cameraOrbit" type="checkbox" ${settings.cameraOrbit ? "checked" : ""}>
          <span>Slowly orbit the selected backdrop level while the title menu is open.</span>
        </label>
        <label class="check-row">
          <input data-title-field="mockBattle" type="checkbox" ${settings.mockBattle ? "checked" : ""}>
          <span>Loop class-based move, attack, and rotate callouts over the title scene.</span>
        </label>
        <div class="title-preview-note">
          <strong>Visual editing loop</strong>
          <span>Open the backdrop level here, edit it with the normal terrain, unit, prop, and story tools, then export the campaign JSON.</span>
        </div>
        <div class="utility-actions">
          <button data-utility-action="preview-title-level">Open Backdrop Level</button>
          <button data-utility-action="apply-title">Apply Title Screen</button>
        </div>
      </div>
    `);
  }

  private openGameplayRulesEditor(): void {
    const rules = normalizeGameplayRules(this.campaign.gameplay);
    const tieBreakerOptions = (["player", "enemy", "higherHp"] as const)
      .map((option) => `<option value="${option}" ${rules.initiative.tieBreaker === option ? "selected" : ""}>${option}</option>`)
      .join("");
    this.openUtility(`
      <div class="utility-modal rules-editor-modal" role="dialog" aria-modal="true" aria-label="Gameplay rules editor">
        <div class="utility-head">
          <div>
            <span>Gameplay Utility</span>
            <h2>Gameplay Rules</h2>
          </div>
          <button data-utility-action="close">Close</button>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Initiative Base</span>
            <input data-rules-field="base" type="number" min="0" max="50" step="1" value="${rules.initiative.base}">
          </label>
          <label class="field">
            <span>Head Weight</span>
            <input data-rules-field="headWeight" type="number" min="0" max="5" step="0.05" value="${rules.initiative.headWeight}">
          </label>
          <label class="field">
            <span>Body Weight</span>
            <input data-rules-field="bodyWeight" type="number" min="0" max="5" step="0.05" value="${rules.initiative.bodyWeight}">
          </label>
          <label class="field">
            <span>Legs Weight</span>
            <input data-rules-field="legsWeight" type="number" min="0" max="5" step="0.05" value="${rules.initiative.legsWeight}">
          </label>
          <label class="field">
            <span>Height Weight</span>
            <input data-rules-field="heightWeight" type="number" min="0" max="5" step="0.05" value="${rules.initiative.heightWeight}">
          </label>
          <label class="field">
            <span>Condition Weight</span>
            <input data-rules-field="conditionWeight" type="number" min="0" max="5" step="0.05" value="${rules.initiative.conditionWeight}">
          </label>
          <label class="field">
            <span>Random Bonus</span>
            <input data-rules-field="random" type="number" min="0" max="10" step="1" value="${rules.initiative.random}">
          </label>
          <label class="field">
            <span>Tie Breaker</span>
            <select data-rules-field="tieBreaker">${tieBreakerOptions}</select>
          </label>
          <label class="field title-wide">
            <span>Condition Library</span>
            <textarea class="story-textarea rules-textarea" data-rules-field="conditions">${escapeHtml(ruleConditionsToText(rules.conditions))}</textarea>
          </label>
        </div>
        <div class="title-preview-note">
          <strong>Condition row format</strong>
          <span>Name | kind | icon | color | duration | stack/single | hidden/shown | attack:1;defense:-1;initiative:2 | effectKey:1 | Description</span>
        </div>
        <div class="utility-actions">
          <button data-utility-action="apply-rules">Apply Rules</button>
        </div>
      </div>
    `);
  }

  private handleUtilityAction(action: string, levelId?: string): void {
    if (action === "close") {
      this.closeUtility();
    } else if (action === "open-level" && levelId) {
      this.state.levelId = levelId;
      this.state.selected = undefined;
      this.render(true);
      this.flash(`Opened ${this.currentLevel().name}.`);
    } else if (action === "add-flow-level") {
      this.addBlankLevel();
      this.openLevelFlowEditor();
      this.flash("Added a blank level to the flow.");
    } else if (action === "apply-flow") {
      this.applyLevelFlowEditor();
    } else if (action === "apply-title") {
      this.applyTitleEditor();
    } else if (action === "apply-rules") {
      this.applyGameplayRulesEditor();
    } else if (action === "preview-title-level") {
      const levelSelect = this.utility.querySelector<HTMLSelectElement>("[data-title-field='backgroundLevelId']");
      const nextLevelId = levelSelect?.value;
      if (nextLevelId && this.levels.some((level) => level.id === nextLevelId)) {
        this.state.levelId = nextLevelId;
        this.state.selected = undefined;
        this.render(true);
        this.flash("Opened the title backdrop level for visual editing.");
      }
    }
  }

  private addBlankLevel(): void {
    const id = this.uniqueLevelId(`level-${this.levels.length + 1}`);
    const name = `New Level ${this.levels.length + 1}`;
    const level = normalizeLevelData({
      id,
      name,
      width: 10,
      depth: 8,
      environment: structuredClone(defaultEnvironmentSettings),
      tiles: makeTiles(10, 8),
      obstacles: [],
      surroundings: [],
      units: [],
      objectives: [{ type: "defeatTeam", team: "enemy" }],
      links: [],
      story: []
    });
    const previous = this.levels[this.levels.length - 1];
    if (previous && previous.links.length === 0) {
      previous.links = [{ id: `${previous.id}-next`, label: `Continue to ${name}`, to: id }];
    }
    this.levels.push(level);
    const previousRef = this.campaign.levels[this.campaign.levels.length - 1];
    if (previousRef && previousRef.next.length === 0) {
      previousRef.next = [id];
    }
    this.campaign.levels.push({ id, file: `levels/${id}.json`, next: [] });
    this.state.levelId = id;
    this.state.selected = undefined;
    this.render(true);
  }

  private applyLevelFlowEditor(): void {
    const rows = [...this.utility.querySelectorAll<HTMLElement>("[data-flow-row]")];
    if (rows.length === 0) {
      return;
    }

    const oldToNew = new Map<string, string>();
    const usedIds = new Set<string>();
    for (const row of rows) {
      const oldId = row.dataset.levelId ?? "";
      const name = row.querySelector<HTMLInputElement>("[data-flow-field='name']")?.value.trim() || "Level";
      const requestedId = row.querySelector<HTMLInputElement>("[data-flow-field='id']")?.value.trim() || name;
      const baseId = levelIdFromName(requestedId);
      let nextId = baseId;
      let suffix = 2;
      while (usedIds.has(nextId)) {
        nextId = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(nextId);
      oldToNew.set(oldId, nextId);
    }

    const updatedLevels = rows.map((row) => {
      const oldId = row.dataset.levelId ?? "";
      const source = this.levels.find((level) => level.id === oldId) ?? this.currentLevel();
      const name = row.querySelector<HTMLInputElement>("[data-flow-field='name']")?.value.trim() || source.name;
      const id = oldToNew.get(oldId) ?? source.id;
      const nextOldId = row.querySelector<HTMLSelectElement>("[data-flow-field='next']")?.value ?? "";
      const nextId = nextOldId ? oldToNew.get(nextOldId) ?? nextOldId : "";
      return normalizeLevelData({
        ...source,
        id,
        name,
        links: nextId ? [{ id: `${id}-next`, label: `Continue to ${nextId}`, to: nextId }] : []
      });
    });

    const nameById = new Map(updatedLevels.map((level) => [level.id, level.name]));
    const polishedLevels = updatedLevels.map((level) => ({
      ...level,
      links: level.links.map((link) => ({
        ...link,
        label: `Continue to ${nameById.get(link.to) ?? link.to}`
      }))
    }));

    const campaignIdInput = this.utility.querySelector<HTMLInputElement>("[data-flow-campaign='id']");
    const campaignTitleInput = this.utility.querySelector<HTMLInputElement>("[data-flow-campaign='title']");
    const startInput = this.utility.querySelector<HTMLSelectElement>("[data-flow-campaign='startLevel']");
    const startLevel = oldToNew.get(startInput?.value ?? "") ?? updatedLevels[0].id;
    const titleScreen = normalizeTitleScreenSettings(this.campaign.titleScreen, startLevel);
    titleScreen.backgroundLevelId = oldToNew.get(titleScreen.backgroundLevelId) ?? titleScreen.backgroundLevelId;
    if (!polishedLevels.some((level) => level.id === titleScreen.backgroundLevelId)) {
      titleScreen.backgroundLevelId = startLevel;
    }

    this.levels = polishedLevels;
    this.campaign = {
      ...this.campaign,
      id: levelIdFromName(campaignIdInput?.value || this.campaign.id),
      title: campaignTitleInput?.value.trim() || this.campaign.title,
      startLevel,
      titleScreen,
      levels: polishedLevels.map((level) => ({
        id: level.id,
        file: `levels/${level.id}.json`,
        next: level.links[0]?.to ? [level.links[0].to] : []
      }))
    };
    this.state.levelId = oldToNew.get(this.state.levelId) ?? startLevel;
    this.state.selected = undefined;
    this.closeUtility();
    this.render(true);
    this.flash("Updated campaign flow.");
  }

  private applyTitleEditor(): void {
    const field = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(name: string) =>
      this.utility.querySelector<T>(`[data-title-field='${name}']`);
    const backgroundLevelId = field<HTMLSelectElement>("backgroundLevelId")?.value || this.campaign.startLevel;
    this.campaign = {
      ...this.campaign,
      titleScreen: {
        kicker: field<HTMLInputElement>("kicker")?.value.trim() || "Voxel tactics prototype",
        headline: field<HTMLInputElement>("headline")?.value.trim() || "Craft Heroes",
        subhead:
          field<HTMLTextAreaElement>("subhead")?.value.trim() ||
          "Rotate class faces, chain handmade levels, and test the build language for a Steam-ready tactics pitch.",
        backgroundLevelId,
        cameraOrbit: field<HTMLInputElement>("cameraOrbit")?.checked ?? true,
        orbitSpeed: Math.max(0.01, Math.min(0.4, numberOrFallback(field<HTMLInputElement>("orbitSpeed")?.value, 0.08))),
        mockBattle: field<HTMLInputElement>("mockBattle")?.checked ?? true
      }
    };
    this.closeUtility();
    this.updatePanel();
    this.flash("Updated title screen settings.");
  }

  private applyGameplayRulesEditor(): void {
    const field = <T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(name: string) =>
      this.utility.querySelector<T>(`[data-rules-field='${name}']`);
    const fallback = normalizeGameplayRules(this.campaign.gameplay);
    const tieBreakerValue = field<HTMLSelectElement>("tieBreaker")?.value;
    const tieBreaker =
      tieBreakerValue === "enemy" || tieBreakerValue === "higherHp" || tieBreakerValue === "player"
        ? tieBreakerValue
        : fallback.initiative.tieBreaker;
    const conditionsText = field<HTMLTextAreaElement>("conditions")?.value ?? ruleConditionsToText(fallback.conditions);
    this.campaign = {
      ...this.campaign,
      gameplay: normalizeGameplayRules({
        initiative: {
          base: numberOrFallback(field<HTMLInputElement>("base")?.value, fallback.initiative.base),
          headWeight: numberOrFallback(field<HTMLInputElement>("headWeight")?.value, fallback.initiative.headWeight),
          bodyWeight: numberOrFallback(field<HTMLInputElement>("bodyWeight")?.value, fallback.initiative.bodyWeight),
          legsWeight: numberOrFallback(field<HTMLInputElement>("legsWeight")?.value, fallback.initiative.legsWeight),
          heightWeight: numberOrFallback(field<HTMLInputElement>("heightWeight")?.value, fallback.initiative.heightWeight),
          conditionWeight: numberOrFallback(field<HTMLInputElement>("conditionWeight")?.value, fallback.initiative.conditionWeight),
          random: numberOrFallback(field<HTMLInputElement>("random")?.value, fallback.initiative.random),
          tieBreaker
        },
        conditions: textToRuleConditions(conditionsText, fallback.conditions)
      })
    };
    this.closeUtility();
    this.updatePanel();
    this.flash("Updated gameplay rules.");
  }

  private propRotationAngle(): number {
    return this.state.propRotationSteps * (Math.PI / 2);
  }

  private propRotationLabel(): string {
    return `${this.state.propRotationSteps * 90} deg`;
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

  private uniqueLevelId(name: string): string {
    const baseId = levelIdFromName(name);
    let id = baseId;
    let index = 2;
    while (this.levels.some((level) => level.id === id)) {
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
      const abilitiesInput = this.panel.querySelector<HTMLTextAreaElement>(`[data-class-section='${section}'][data-ability]`);
      const conditionsInput = this.panel.querySelector<HTMLInputElement>(`[data-class-section='${section}'][data-condition]`);
      sections[section].abilities = textToAbilities(abilitiesInput?.value ?? abilitiesToText(sections[section].abilities), sections[section].abilities);
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
    const sideCapColorInput = this.panel.querySelector<HTMLInputElement>("[data-material='sideCapColor']");
    const sideFullColorInput = this.panel.querySelector<HTMLInputElement>("[data-material='sideFullColor']");
    const sideHalfColorInput = this.panel.querySelector<HTMLInputElement>("[data-material='sideHalfColor']");
    const surfaceEffectInput = this.panel.querySelector<HTMLSelectElement>("[data-material='surfaceEffect']");
    const grassDensityInput = this.panel.querySelector<HTMLInputElement>("[data-material='grassDensity']");
    const grassHeightMinInput = this.panel.querySelector<HTMLInputElement>("[data-material='grassHeightMin']");
    const grassHeightMaxInput = this.panel.querySelector<HTMLInputElement>("[data-material='grassHeightMax']");
    const grassColorInputs = [...this.panel.querySelectorAll<HTMLInputElement>("[data-material-grass-color]")];
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
      sideCapColor: sideCapColorInput?.value || fallback.sideCapColor,
      sideFullColor: sideFullColorInput?.value || fallback.sideFullColor,
      sideHalfColor: sideHalfColorInput?.value || fallback.sideHalfColor,
      surfaceEffect: normalizeSurfaceEffect(surfaceEffectInput?.value ?? fallback.surfaceEffect),
      grassDensity: numberOrFallback(grassDensityInput?.value, fallback.grassDensity),
      grassHeightMin: numberOrFallback(grassHeightMinInput?.value, fallback.grassHeightMin),
      grassHeightMax: numberOrFallback(grassHeightMaxInput?.value, fallback.grassHeightMax),
      grassColors: normalizeGrassColors(grassColorInputs.map((input) => input.value), fallback.grassColors),
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
    const assetKindInput = this.panel.querySelector<HTMLSelectElement>("[data-prop='assetKind']");
    const colorInput = this.panel.querySelector<HTMLInputElement>("[data-prop='color']");
    const widthInput = this.panel.querySelector<HTMLInputElement>("[data-prop='width']");
    const heightInput = this.panel.querySelector<HTMLInputElement>("[data-prop='height']");
    const depthInput = this.panel.querySelector<HTMLInputElement>("[data-prop='depth']");
    const blocksMovementInput = this.panel.querySelector<HTMLInputElement>("[data-prop='blocksMovement']");
    const blocksLineOfSightInput = this.panel.querySelector<HTMLInputElement>("[data-prop='blocksLineOfSight']");
    const coverBonusInput = this.panel.querySelector<HTMLInputElement>("[data-prop='coverBonus']");
    const fitModelInput = this.panel.querySelector<HTMLInputElement>("[data-prop='fitModelToTile']");
    const windEffectInput = this.panel.querySelector<HTMLInputElement>("[data-prop='windEffect']");
    const emitsLightInput = this.panel.querySelector<HTMLInputElement>("[data-prop='emitsLight']");
    const lightColorInput = this.panel.querySelector<HTMLInputElement>("[data-prop='lightColor']");
    const lightIntensityInput = this.panel.querySelector<HTMLInputElement>("[data-prop='lightIntensity']");
    const lightRangeInput = this.panel.querySelector<HTMLInputElement>("[data-prop='lightRange']");
    const lightOffsetYInput = this.panel.querySelector<HTMLInputElement>("[data-prop='lightOffsetY']");
    const notesInput = this.panel.querySelector<HTMLInputElement>("[data-prop='notes']");
    return normalizePropDefinition({
      ...fallback,
      id: propId,
      name: nameInput?.value.trim() || fallback.name,
      role: (roleInput?.value as PropDefinition["role"] | undefined) ?? fallback.role,
      assetKind: (assetKindInput?.value as PropDefinition["assetKind"] | undefined) ?? fallback.assetKind,
      color: colorInput?.value || fallback.color,
      width: numberOrFallback(widthInput?.value, fallback.width),
      height: numberOrFallback(heightInput?.value, fallback.height),
      depth: numberOrFallback(depthInput?.value, fallback.depth),
      blocksMovement: Boolean(blocksMovementInput?.checked),
      blocksLineOfSight: Boolean(blocksLineOfSightInput?.checked),
      coverBonus: numberOrFallback(coverBonusInput?.value, fallback.coverBonus),
      fitModelToTile: fitModelInput?.checked ?? fallback.fitModelToTile,
      windEffect: windEffectInput?.checked ?? fallback.windEffect,
      emitsLight: emitsLightInput?.checked ?? fallback.emitsLight,
      lightColor: lightColorInput?.value || fallback.lightColor,
      lightIntensity: numberOrFallback(lightIntensityInput?.value, fallback.lightIntensity),
      lightRange: numberOrFallback(lightRangeInput?.value, fallback.lightRange),
      lightOffsetY: numberOrFallback(lightOffsetYInput?.value, fallback.lightOffsetY),
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
    const windStrengthInput = this.panel.querySelector<HTMLInputElement>("[data-environment='windStrength']");
    const windSpeedInput = this.panel.querySelector<HTMLInputElement>("[data-environment='windSpeed']");
    const backgroundScaleInput = this.panel.querySelector<HTMLInputElement>("[data-background='scale']");
    const backgroundRotationInput = this.panel.querySelector<HTMLInputElement>("[data-background='rotation']");
    const backgroundOffsetInput = this.panel.querySelector<HTMLInputElement>("[data-background='offsetY']");
    const backgroundFitInput = this.panel.querySelector<HTMLInputElement>("[data-background='fitToMap']");
    return normalizeEnvironment({
      ...level.environment,
      skyColor: skyInput?.value || level.environment.skyColor,
      fogColor: fogInput?.value || level.environment.fogColor,
      groundColor: groundInput?.value || level.environment.groundColor,
      ambientIntensity: numberOrFallback(ambientInput?.value, level.environment.ambientIntensity),
      sunIntensity: numberOrFallback(sunInput?.value, level.environment.sunIntensity),
      windStrength: numberOrFallback(windStrengthInput?.value, level.environment.windStrength),
      windSpeed: numberOrFallback(windSpeedInput?.value, level.environment.windSpeed),
      backgroundModel: {
        ...level.environment.backgroundModel,
        fitToMap: backgroundFitInput?.checked ?? level.environment.backgroundModel.fitToMap,
        scale: numberOrFallback(backgroundScaleInput?.value, level.environment.backgroundModel.scale),
        rotation: numberOrFallback(backgroundRotationInput?.value, level.environment.backgroundModel.rotation),
        offsetY: numberOrFallback(backgroundOffsetInput?.value, level.environment.backgroundModel.offsetY)
      }
    });
  }

  private readStoryDraft(): StoryBeat {
    this.syncStoryDraftFromPanel();
    const draft = this.state.storyDraft;
    const storyBeat: StoryBeat = {
      id: draft.editingId || `story-${Date.now()}`,
      trigger: draft.trigger,
      presentation: draft.presentation,
      title: draft.title.trim(),
      speaker: draft.speaker.trim(),
      text: draft.text.trim() || "New story beat",
      avatarUrl: draft.avatarUrl.trim(),
      ...(draft.trigger === "tileEnter"
        ? {
            x: Math.round(numberOrFallback(draft.x, this.state.selected?.x ?? 0)),
            z: Math.round(numberOrFallback(draft.z, this.state.selected?.z ?? 0))
          }
        : {})
    };
    return storyBeat.avatarUrl ? storyBeat : { ...storyBeat, avatarUrl: "" };
  }

  private syncStoryDraftFromPanel(): void {
    const triggerInput = this.panel.querySelector<HTMLSelectElement>("[data-story='trigger']");
    const presentationInput = this.panel.querySelector<HTMLSelectElement>("[data-story='presentation']");
    const titleInput = this.panel.querySelector<HTMLInputElement>("[data-story='title']");
    const speakerInput = this.panel.querySelector<HTMLInputElement>("[data-story='speaker']");
    const avatarInput = this.panel.querySelector<HTMLInputElement>("[data-story='avatarUrl']");
    const textInput = this.panel.querySelector<HTMLTextAreaElement>("[data-story='text']");
    const xInput = this.panel.querySelector<HTMLInputElement>("[data-story='x']");
    const zInput = this.panel.querySelector<HTMLInputElement>("[data-story='z']");
    const trigger = triggerInput?.value === "tileEnter" || triggerInput?.value === "levelComplete" ? triggerInput.value : "levelStart";
    const presentation = presentationInput?.value === "screen" ? "screen" : "dialog";
    this.state.storyDraft = {
      editingId: this.state.storyDraft.editingId,
      trigger,
      presentation,
      title: titleInput?.value ?? this.state.storyDraft.title,
      speaker: speakerInput?.value ?? this.state.storyDraft.speaker,
      text: textInput?.value ?? this.state.storyDraft.text,
      avatarUrl: avatarInput?.value ?? this.state.storyDraft.avatarUrl,
      x: Math.max(0, Math.round(numberOrFallback(xInput?.value, this.state.storyDraft.x))),
      z: Math.max(0, Math.round(numberOrFallback(zInput?.value, this.state.storyDraft.z)))
    };
  }

  private setStoryDraftTile(coord: TileCoord): void {
    this.syncStoryDraftFromPanel();
    this.state.storyDraft = {
      ...this.state.storyDraft,
      trigger: "tileEnter",
      x: coord.x,
      z: coord.z
    };
    this.state.selected = coord;
    this.scene.setSelected(coord);
    this.updatePanel();
    this.flash(`Story tile set to ${coord.x}, ${coord.z}.`);
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

  private applyPropRotation(steps: number): void {
    this.state.propRotationSteps = ((steps % 4) + 4) % 4;
    const level = this.currentLevel();
    if (!this.state.selected) {
      this.updatePanel();
      this.flash(`Prop rotation set to ${this.propRotationLabel()}.`);
      return;
    }

    let rotated = false;
    const next = {
      ...level,
      obstacles: level.obstacles.map((obstacle) => {
        if (obstacle.x !== this.state.selected?.x || obstacle.z !== this.state.selected.z) {
          return obstacle;
        }
        rotated = true;
        return {
          ...obstacle,
          rotation: this.propRotationAngle()
        };
      })
    };
    if (rotated) {
      this.setCurrentLevel(next);
      this.scene.setLevel(next);
      this.scene.setSelected(this.state.selected);
      this.flash(`Rotated selected prop to ${this.propRotationLabel()}.`);
    } else {
      this.flash(`Prop rotation set to ${this.propRotationLabel()}.`);
    }
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
      next = placeObstacle(level, coord, this.state.obstacle, this.propRotationAngle());
    } else if (this.state.tool === "unit") {
      const template = this.selectedTemplate();
      next = placeUnit(level, coord, this.state.team, template);
    } else if (this.state.tool === "story") {
      this.setStoryDraftTile(coord);
      return;
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
    const selectedObstacle = this.state.selected
      ? level.obstacles.find((obstacle) => obstacle.x === this.state.selected?.x && obstacle.z === this.state.selected?.z)
      : undefined;
    const storyDraft = this.state.storyDraft;
    const json = this.editorJson();
    const libraryCards = [
      { label: "Classes", count: this.classDefinitions.length, details: this.classDefinitions.map((item) => item.name).join(", ") },
      { label: "Builds", count: this.templates.length, details: this.templates.map((item) => item.name).join(", ") },
      { label: "Props", count: this.propDefinitions.length, details: this.propDefinitions.map((item) => item.name).join(", ") },
      { label: "Materials", count: this.environmentMaterials.length, details: this.environmentMaterials.map((item) => item.name).join(", ") }
    ];
    this.panel.innerHTML = `
      <div class="editor-column editor-column-left">
      <div class="panel-head">
        <div>
          <h1>Craft Heroes Editor</h1>
          <p>${this.state.mode === "editor" ? "Build voxel tactics levels." : "Play-test the current level data."}</p>
        </div>
        <div class="head-actions">
          <button data-action="open-client">Client</button>
          <button data-action="toggle-mode">${this.state.mode === "editor" ? "Play" : "Edit"}</button>
        </div>
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
        ${(["select", "raise", "lower", "paint", "obstacle", "unit", "story", "erase"] as EditorTool[])
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
          <strong>Prop Placement</strong>
          <span>${selectedObstacle ? `Selected ${escapeHtml(selectedObstacle.type)} @ ${selectedObstacle.x}, ${selectedObstacle.z}` : "Set rotation before placing GLB props or blockers."}</span>
        </div>
        <div class="button-row two">
          <button data-action="rotate-prop">Rotate 90</button>
          <button data-action="reset-prop-rotation">Reset Rotation</button>
        </div>
        <div class="level-card">
          <strong>${this.propRotationLabel()}</strong>
          <span>${selectedObstacle ? "Rotates the selected prop and future placements." : "Applies to future prop placements."}</span>
        </div>
      </section>

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
          <label class="field">
            <span>Wind Strength</span>
            <input data-environment="windStrength" type="number" min="0" max="3" step="0.05" value="${level.environment.windStrength}">
          </label>
          <label class="field">
            <span>Wind Speed</span>
            <input data-environment="windSpeed" type="number" min="0" max="4" step="0.05" value="${level.environment.windSpeed}">
          </label>
        </div>
        <div class="button-row two">
          <button data-action="update-environment">Update Environment</button>
          <button data-action="clear-ground-texture">Clear Ground Texture</button>
        </div>
        <div class="asset-preview-head">
          <div>
            <strong>Background GLB</strong>
            <span>${escapeHtml(level.environment.backgroundModel.modelFileName || "No map surround loaded")}</span>
          </div>
          <input data-background-model type="file" accept=".glb,model/gltf-binary">
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Model Scale</span>
            <input data-background="scale" type="number" min="0.01" max="20" step="0.05" value="${level.environment.backgroundModel.scale}">
          </label>
          <label class="field">
            <span>Rotation</span>
            <input data-background="rotation" type="number" min="-6.28" max="6.28" step="0.1" value="${level.environment.backgroundModel.rotation}">
          </label>
          <label class="field">
            <span>Vertical Offset</span>
            <input data-background="offsetY" type="number" min="-20" max="20" step="0.1" value="${level.environment.backgroundModel.offsetY}">
          </label>
          <label class="check-row">
            <input data-background="fitToMap" type="checkbox" ${level.environment.backgroundModel.fitToMap ? "checked" : ""}>
            <span>Fit around map</span>
          </label>
        </div>
        <div class="button-row two">
          <button data-action="update-background">Update Background</button>
          <button data-action="clear-background">Clear Background</button>
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
          <strong>Story Beats</strong>
          <span>Show dialog or full-screen story at level start, a tile, or completion.</span>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Trigger</span>
            <select data-story="trigger">
              <option value="levelStart" ${storyDraft.trigger === "levelStart" ? "selected" : ""}>Level Start</option>
              <option value="tileEnter" ${storyDraft.trigger === "tileEnter" ? "selected" : ""}>Tile Enter</option>
              <option value="levelComplete" ${storyDraft.trigger === "levelComplete" ? "selected" : ""}>Level Complete</option>
            </select>
          </label>
          <label class="field">
            <span>Presentation</span>
            <select data-story="presentation">
              <option value="dialog" ${storyDraft.presentation === "dialog" ? "selected" : ""}>Dialog</option>
              <option value="screen" ${storyDraft.presentation === "screen" ? "selected" : ""}>Story Screen</option>
            </select>
          </label>
          <label class="field">
            <span>Tile X (left to right)</span>
            <input data-story="x" type="number" min="0" max="${Math.max(0, level.width - 1)}" step="1" value="${storyDraft.x}">
          </label>
          <label class="field">
            <span>Tile Z (back to front)</span>
            <input data-story="z" type="number" min="0" max="${Math.max(0, level.depth - 1)}" step="1" value="${storyDraft.z}">
          </label>
          <label class="field">
            <span>Title</span>
            <input data-story="title" type="text" placeholder="Optional title" value="${escapeHtml(storyDraft.title)}">
          </label>
          <label class="field">
            <span>Speaker</span>
            <input data-story="speaker" type="text" placeholder="Optional speaker" value="${escapeHtml(storyDraft.speaker)}">
          </label>
          <label class="field">
            <span>Avatar URL</span>
            <input data-story="avatarUrl" type="text" placeholder="Optional portrait image URL" value="${escapeHtml(storyDraft.avatarUrl)}">
          </label>
        </div>
        <div class="story-avatar-editor">
          <div class="story-avatar-preview">
            ${storyDraft.avatarUrl ? `<img src="${escapeHtml(storyDraft.avatarUrl)}" alt="">` : `<span>${escapeHtml((storyDraft.speaker || "CH").slice(0, 2).toUpperCase())}</span>`}
          </div>
          <div>
            <strong>${storyDraft.editingId ? "Editing Story Beat" : "New Story Beat"}</strong>
            <span>Upload an optional speaker portrait, or paste an image URL.</span>
          </div>
          <input data-story-avatar type="file" accept="image/*">
          <button data-action="clear-story-avatar" ${storyDraft.avatarUrl ? "" : "disabled"}>Clear Avatar</button>
        </div>
        <div class="story-picker">
          <strong>Tile target</strong>
          <span>${storyDraft.trigger === "tileEnter" ? `Tile ${storyDraft.x}, ${storyDraft.z} selected. Origin 0,0 is the back-left tile from the default camera.` : "Only used when Trigger is Tile Enter."}</span>
          <div class="button-row two">
            <button data-action="pick-story-tile">Pick Tile</button>
            <button data-action="use-selected-story-tile" ${this.state.selected ? "" : "disabled"}>Use Selected Tile</button>
          </div>
        </div>
        <label class="field">
          <span>Story Text</span>
          <textarea class="story-textarea" data-story="text" placeholder="What happens here?">${escapeHtml(storyDraft.text)}</textarea>
        </label>
        <div class="button-row two">
          <button data-action="add-story">${storyDraft.editingId ? "Update Story Beat" : "Add Story Beat"}</button>
          <button data-action="new-story-draft" ${storyDraft.editingId ? "" : "disabled"}>New Story Beat</button>
        </div>
        <div class="story-list">
          ${level.story
            .map(
              (beat) => `
                <div class="story-item ${storyDraft.editingId === beat.id ? "active" : ""}">
                  <div class="story-item-avatar">
                    ${beat.avatarUrl ? `<img src="${escapeHtml(beat.avatarUrl)}" alt="">` : `<span>${escapeHtml((beat.speaker || beat.title || "ST").slice(0, 2).toUpperCase())}</span>`}
                  </div>
                  <div>
                    <strong>${escapeHtml(beat.title || beat.speaker || beat.presentation)}</strong>
                    <span>${escapeHtml(beat.trigger)}${beat.trigger === "tileEnter" ? ` @ ${beat.x}, ${beat.z}` : ""} / ${escapeHtml(beat.text)}</span>
                  </div>
                  <button data-action="edit-story" data-story-id="${escapeHtml(beat.id)}" title="Edit story beat" aria-label="Edit story beat">Edit</button>
                  <button data-action="remove-story" data-story-id="${escapeHtml(beat.id)}" title="Remove story beat" aria-label="Remove story beat">&times;</button>
                </div>
              `
            )
            .join("") || `<span class="empty-note">No story beats in this level.</span>`}
        </div>
      </section>

      </div>
      <div class="editor-column editor-column-right">
      <section class="control-section library-section">
        <div class="section-title">
          <strong>Content Library</strong>
          <span>Reusable content for building scenarios, enemy loadouts, props, terrain, and class faces.</span>
        </div>
        <div class="library-grid">
          ${libraryCards
            .map(
              (card) => `
                <div class="library-card">
                  <strong>${card.count}</strong>
                  <span>${escapeHtml(card.label)}</span>
                  <small>${escapeHtml(card.details || "None yet")}</small>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="role-strip">
          <div><b>Head</b><span>Targeting, awareness, support, passive reads.</span></div>
          <div><b>Body / Arms</b><span>Attack shape, defense posture, cast or swing actions.</span></div>
          <div><b>Legs</b><span>Movement range, terrain rules, evasion, post-move pivots.</span></div>
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
            <span>Surface Effect</span>
            <select data-material="surfaceEffect">
              ${(["solid", "grass", "water"] as EnvironmentSurfaceEffect[])
                .map((effect) => `<option value="${effect}" ${currentMaterial.surfaceEffect === effect ? "selected" : ""}>${effect}</option>`)
                .join("")}
            </select>
          </label>
          <label class="field">
            <span>Grass Density</span>
            <input data-material="grassDensity" type="number" min="0" max="30" step="1" value="${currentMaterial.grassDensity}">
          </label>
          <label class="field">
            <span>Grass Min Height</span>
            <input data-material="grassHeightMin" type="number" min="0.01" max="0.3" step="0.01" value="${currentMaterial.grassHeightMin}">
          </label>
          <label class="field">
            <span>Grass Max Height</span>
            <input data-material="grassHeightMax" type="number" min="0.01" max="0.35" step="0.01" value="${currentMaterial.grassHeightMax}">
          </label>
          <label class="field">
            <span>Top Color</span>
            <input data-material="topColor" type="color" value="${escapeHtml(currentMaterial.topColor)}">
          </label>
          <label class="field">
            <span>Legacy Side</span>
            <input data-material="sideColor" type="color" value="${escapeHtml(currentMaterial.sideColor)}">
          </label>
        </div>
        <div class="compact-grid">
          ${currentMaterial.grassColors
            .map(
              (color, index) => `
                <label class="field">
                  <span>Grass Color ${index + 1}</span>
                  <input data-material-grass-color type="color" value="${escapeHtml(color)}">
                </label>
              `
            )
            .join("")}
        </div>
        <div class="asset-pair">
          <div class="asset-preview-head">
            <strong>Top</strong>
            ${assetPreviewImage(currentMaterial.topImageUrl)}
          </div>
          <div class="asset-preview-head">
            <strong>Cap Side</strong>
            ${assetPreviewImage(currentMaterial.sideCapImageUrl)}
          </div>
          <div class="asset-preview-head">
            <strong>Full Side</strong>
            ${assetPreviewImage(currentMaterial.sideFullImageUrl)}
          </div>
          <div class="asset-preview-head">
            <strong>Half Side</strong>
            ${assetPreviewImage(currentMaterial.sideHalfImageUrl)}
          </div>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Top Texture</span>
            <input data-material-image="top" type="file" accept="image/*">
          </label>
          <label class="field">
            <span>Cap Side Texture</span>
            <input data-material-image="sideCap" type="file" accept="image/*">
          </label>
          <label class="field">
            <span>Full Side Texture</span>
            <input data-material-image="sideFull" type="file" accept="image/*">
          </label>
          <label class="field">
            <span>Half Side Texture</span>
            <input data-material-image="sideHalf" type="file" accept="image/*">
          </label>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Cap Side Color</span>
            <input data-material="sideCapColor" type="color" value="${escapeHtml(currentMaterial.sideCapColor)}">
          </label>
          <label class="field">
            <span>Full Side Color</span>
            <input data-material="sideFullColor" type="color" value="${escapeHtml(currentMaterial.sideFullColor)}">
          </label>
          <label class="field">
            <span>Half Side Color</span>
            <input data-material="sideHalfColor" type="color" value="${escapeHtml(currentMaterial.sideHalfColor)}">
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
            <span>Render As</span>
            <select data-prop="assetKind">
              ${(["box", "glb"] as PropDefinition["assetKind"][])
                .map((assetKind) => `<option value="${assetKind}" ${currentProp.assetKind === assetKind ? "selected" : ""}>${assetKind}</option>`)
                .join("")}
            </select>
          </label>
          <label class="field">
            <span>Color</span>
            <input data-prop="color" type="color" value="${escapeHtml(currentProp.color)}">
          </label>
          <label class="field">
            <span>Box Texture</span>
            <input data-prop-image type="file" accept="image/*">
          </label>
          <label class="field">
            <span>GLB Model</span>
            <input data-prop-model type="file" accept=".glb,model/gltf-binary">
          </label>
        </div>
        <div class="asset-preview-head">
          <strong>${currentProp.assetKind === "glb" ? currentProp.modelFileName || "GLB Model" : "Texture Preview"}</strong>
          ${assetPreviewImage(currentProp.textureUrl)}
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
        <label class="check-row">
          <input data-prop="fitModelToTile" type="checkbox" ${currentProp.fitModelToTile ? "checked" : ""}>
          <span>Fit uploaded GLB to this prop's one-square footprint.</span>
        </label>
        <label class="check-row">
          <input data-prop="windEffect" type="checkbox" ${currentProp.windEffect ? "checked" : ""}>
          <span>Apply a subtle wind sway to foliage-style props.</span>
        </label>
        <label class="check-row">
          <input data-prop="emitsLight" type="checkbox" ${currentProp.emitsLight ? "checked" : ""}>
          <span>Emit light from this prop or uploaded GLB.</span>
        </label>
        <div class="compact-grid">
          <label class="field">
            <span>Light Color</span>
            <input data-prop="lightColor" type="color" value="${escapeHtml(currentProp.lightColor)}">
          </label>
          <label class="field">
            <span>Intensity</span>
            <input data-prop="lightIntensity" type="number" min="0" max="8" step="0.05" value="${currentProp.lightIntensity}">
          </label>
          <label class="field">
            <span>Range</span>
            <input data-prop="lightRange" type="number" min="0.5" max="16" step="0.1" value="${currentProp.lightRange}">
          </label>
          <label class="field">
            <span>Light Height</span>
            <input data-prop="lightOffsetY" type="number" min="0" max="5" step="0.05" value="${currentProp.lightOffsetY}">
          </label>
        </div>
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
                    ${assetPreviewImage(sectionDefinition.imageUrl)}
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
                  <label class="field">
                    <span>Abilities</span>
                    <textarea class="ability-textarea" data-class-section="${section}" data-ability>${escapeHtml(abilitiesToText(sectionDefinition.abilities))}</textarea>
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

      <div class="button-row">
        <button data-action="open-flow-editor">Level Flow</button>
        <button data-action="open-title-editor">Title Screen</button>
        <button data-action="open-rules-editor">Gameplay Rules</button>
      </div>

      <label class="field">
        <span>Export / Import Current Level + Campaign</span>
        <textarea data-json>${json}</textarea>
      </label>

      <div class="button-row">
        <button data-action="download-json">Export JSON</button>
        <button data-action="import-json">Import JSON</button>
        <button data-action="next-level">Load Next</button>
      </div>

      <div class="button-row">
        <button data-action="copy-json">Copy JSON</button>
      </div>

      <ul class="warnings">
        ${(warnings.length ? warnings : ["Level validates for first-pass playtesting."]).map((warning) => `<li>${warning}</li>`).join("")}
      </ul>
      </div>
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

    this.panel.querySelectorAll<HTMLInputElement>("[data-prop-model]").forEach((input) => {
      input.addEventListener("change", () => this.handlePropModelUpload(input));
    });

    this.panel.querySelectorAll<HTMLInputElement>("[data-ground-texture]").forEach((input) => {
      input.addEventListener("change", () => this.handleGroundTextureUpload(input));
    });

    this.panel.querySelectorAll<HTMLInputElement>("[data-background-model]").forEach((input) => {
      input.addEventListener("change", () => this.handleBackgroundModelUpload(input));
    });

    this.panel.querySelectorAll<HTMLInputElement>("[data-story-avatar]").forEach((input) => {
      input.addEventListener("change", () => this.handleStoryAvatarUpload(input));
    });

    this.panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[data-story]").forEach((input) => {
      input.addEventListener("input", () => this.syncStoryDraftFromPanel());
      input.addEventListener("change", () => {
        this.syncStoryDraftFromPanel();
        if (input instanceof HTMLSelectElement && input.dataset.story === "trigger") {
          this.updatePanel();
        }
      });
    });

    this.panel.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
      button.addEventListener("click", () => this.handleAction(button.dataset.action ?? "", button.dataset.storyId));
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
    if (!file || (target !== "top" && target !== "sideCap" && target !== "sideFull" && target !== "sideHalf")) {
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
      } else if (target === "sideCap") {
        draft.sideCapImageUrl = String(reader.result ?? "");
      } else if (target === "sideFull") {
        draft.sideFullImageUrl = String(reader.result ?? "");
      } else if (target === "sideHalf") {
        draft.sideHalfImageUrl = String(reader.result ?? "");
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

  private handlePropModelUpload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const isGlb = file.name.toLowerCase().endsWith(".glb") || file.type === "model/gltf-binary";
    if (!isGlb) {
      this.flash("Prop model upload needs a .glb file.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const draft = this.readPropDraft();
      draft.assetKind = "glb";
      draft.modelUrl = String(reader.result ?? "");
      draft.modelFileName = file.name;
      draft.fitModelToTile = true;
      this.replacePropDefinition(draft);
      this.updatePanel();
      this.flash(`Updated ${draft.name} GLB model.`);
    });
    reader.addEventListener("error", () => {
      this.flash("Prop model upload failed.");
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

  private handleBackgroundModelUpload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const isGlb = file.name.toLowerCase().endsWith(".glb") || file.type === "model/gltf-binary";
    if (!isGlb) {
      this.flash("Background model upload needs a .glb file.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const level = this.currentLevel();
      const next = normalizeLevelData({
        ...level,
        environment: {
          ...this.readEnvironmentDraft(level),
          backgroundModel: {
            ...this.readEnvironmentDraft(level).backgroundModel,
            modelUrl: String(reader.result ?? ""),
            modelFileName: file.name
          }
        }
      });
      this.setCurrentLevel(next);
      this.scene.setLevel(next);
      this.updatePanel();
      this.flash(`Loaded background ${file.name}.`);
    });
    reader.addEventListener("error", () => {
      this.flash("Background model upload failed.");
    });
    reader.readAsDataURL(file);
  }

  private handleStoryAvatarUpload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      this.flash("Story avatar upload needs an image file.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      this.syncStoryDraftFromPanel();
      this.state.storyDraft = {
        ...this.state.storyDraft,
        avatarUrl: String(reader.result ?? "")
      };
      this.updatePanel();
      this.flash(`Loaded avatar ${file.name}.`);
    });
    reader.addEventListener("error", () => {
      this.flash("Story avatar upload failed.");
    });
    reader.readAsDataURL(file);
  }

  private handleAction(action: string, storyId?: string): void {
    if (action === "open-client") {
      this.openClientPreview();
    } else if (action === "toggle-mode") {
      this.state.mode = this.state.mode === "editor" ? "play" : "editor";
      this.scene.setMode(this.state.mode);
      this.updatePanel();
    } else if (action === "apply-size") {
      this.applyLevelSize();
    } else if (action === "frame-board") {
      this.scene.frameCurrentLevel();
      this.flash("Camera framed to the current board.");
    } else if (action === "rotate-prop") {
      const level = this.currentLevel();
      const selectedObstacle = this.state.selected
        ? level.obstacles.find((obstacle) => obstacle.x === this.state.selected?.x && obstacle.z === this.state.selected.z)
        : undefined;
      const currentSteps = selectedObstacle ? Math.round((selectedObstacle.rotation ?? 0) / (Math.PI / 2)) : this.state.propRotationSteps;
      this.applyPropRotation(currentSteps + 1);
    } else if (action === "reset-prop-rotation") {
      this.applyPropRotation(0);
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
    } else if (action === "update-background") {
      const level = this.currentLevel();
      const next = {
        ...level,
        environment: this.readEnvironmentDraft(level)
      };
      this.setCurrentLevel(next);
      this.scene.setLevel(next);
      this.updatePanel();
      this.flash("Updated background model placement.");
    } else if (action === "clear-background") {
      const level = this.currentLevel();
      const next = {
        ...level,
        environment: {
          ...this.readEnvironmentDraft(level),
          backgroundModel: {
            ...level.environment.backgroundModel,
            modelUrl: "",
            modelFileName: ""
          }
        }
      };
      this.setCurrentLevel(next);
      this.scene.setLevel(next);
      this.updatePanel();
      this.flash("Cleared background model.");
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
    } else if (action === "pick-story-tile") {
      this.syncStoryDraftFromPanel();
      this.state.tool = "story";
      this.updatePanel();
      this.flash("Story tile picker active. Click the tile that should trigger this beat.");
    } else if (action === "use-selected-story-tile") {
      if (this.state.selected) {
        this.setStoryDraftTile(this.state.selected);
      } else {
        this.flash("Select a tile first, then use it for the story beat.");
      }
    } else if (action === "clear-story-avatar") {
      this.syncStoryDraftFromPanel();
      this.state.storyDraft = {
        ...this.state.storyDraft,
        avatarUrl: ""
      };
      this.updatePanel();
      this.flash("Cleared story avatar.");
    } else if (action === "new-story-draft") {
      this.state.storyDraft = this.emptyStoryDraft();
      this.updatePanel();
      this.flash("Ready for a new story beat.");
    } else if (action === "edit-story" && storyId) {
      const beat = this.currentLevel().story.find((candidate) => candidate.id === storyId);
      if (beat) {
        this.state.storyDraft = this.storyDraftFromBeat(beat);
        if (beat.trigger === "tileEnter" && beat.x !== undefined && beat.z !== undefined) {
          this.state.selected = { x: beat.x, z: beat.z };
          this.scene.setSelected(this.state.selected);
        }
        this.updatePanel();
        this.flash("Loaded story beat for editing.");
      }
    } else if (action === "add-story") {
      const level = this.currentLevel();
      const storyBeat = this.readStoryDraft();
      const isEditing = Boolean(this.state.storyDraft.editingId);
      const next = {
        ...level,
        story: isEditing
          ? level.story.map((beat) => (beat.id === storyBeat.id ? storyBeat : beat))
          : [...level.story, storyBeat]
      };
      this.setCurrentLevel(next);
      this.state.storyDraft = this.storyDraftFromBeat(storyBeat);
      this.updatePanel();
      this.flash(`${isEditing ? "Updated" : "Added"} story beat${storyBeat.trigger === "tileEnter" ? ` at ${storyBeat.x}, ${storyBeat.z}` : ""}.`);
    } else if (action === "remove-story" && storyId) {
      const level = this.currentLevel();
      const next = {
        ...level,
        story: level.story.filter((beat) => beat.id !== storyId)
      };
      this.setCurrentLevel(next);
      if (this.state.storyDraft.editingId === storyId) {
        this.state.storyDraft = this.emptyStoryDraft();
      }
      this.updatePanel();
      this.flash("Removed story beat.");
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
      localStorage.setItem(editorProjectStorageKey, this.editorJson());
      localStorage.setItem(templatesStorageKey, JSON.stringify(this.templates, null, 2));
      localStorage.setItem(classesStorageKey, JSON.stringify(this.classDefinitions, null, 2));
      localStorage.setItem(materialsStorageKey, JSON.stringify(this.environmentMaterials, null, 2));
      localStorage.setItem(propsStorageKey, JSON.stringify(this.propDefinitions, null, 2));
      this.flash("Saved campaign, level, builds, classes, materials, and props.");
    } else if (action === "load-sample") {
      this.levels = defaultLevels.map((level) => normalizeLevelData(cloneLevel(level)));
      this.campaign = normalizeCampaignData(structuredClone(defaultCampaign), this.levels);
      this.templates = unitTemplates.map((template) => structuredClone(template));
      this.classDefinitions = defaultClassDefinitions.map((classDefinition) => structuredClone(classDefinition));
      this.environmentMaterials = defaultEnvironmentMaterials.map((material) => structuredClone(material));
      this.propDefinitions = defaultPropDefinitions.map((prop) => structuredClone(prop));
      this.state.levelId = this.campaign.startLevel;
      this.state.templateId = this.templates[1]?.id ?? this.templates[0].id;
      this.state.classId = this.classDefinitions[0].id;
      this.state.terrain = this.environmentMaterials[0].id;
      this.state.obstacle = this.propDefinitions[0].id;
      this.state.propRotationSteps = 0;
      this.state.storyDraft = this.emptyStoryDraft();
      this.state.selected = undefined;
      this.scene.setClassDefinitions(this.classDefinitions);
      this.scene.setEnvironmentMaterials(this.environmentMaterials);
      this.scene.setPropDefinitions(this.propDefinitions);
      localStorage.removeItem(editorProjectStorageKey);
      this.render(true);
    } else if (action === "open-flow-editor") {
      this.openLevelFlowEditor();
    } else if (action === "open-title-editor") {
      this.openTitleEditor();
    } else if (action === "open-rules-editor") {
      this.openGameplayRulesEditor();
    } else if (action === "download-json") {
      this.downloadJsonFile(safeFileName(this.campaign.id || "craft-heroes-campaign"), this.editorJson());
      this.flash("Exported campaign JSON.");
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
        levels?: LevelData[];
        templates?: UnitTemplate[];
        classes?: ClassDefinition[];
        classDefinitions?: ClassDefinition[];
        terrainMaterials?: EnvironmentMaterialDefinition[];
        environmentMaterials?: EnvironmentMaterialDefinition[];
        props?: PropDefinition[];
        propDefinitions?: PropDefinition[];
      };
      if (parsed.levels?.length) {
        this.levels = parsed.levels.map((level) => normalizeLevelData(level));
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
        if (this.levels.some((level) => level.id === normalizedLevel.id)) {
          this.setCurrentLevel(normalizedLevel);
        } else {
          this.levels.push(normalizedLevel);
        }
        this.state.levelId = normalizedLevel.id;
      } else if (!this.levels.some((level) => level.id === this.state.levelId)) {
        this.state.levelId = this.levels.find((level) => level.id === this.campaign.startLevel)?.id ?? this.levels[0].id;
      }
      if (parsed.campaign) {
        this.campaign = normalizeCampaignData(parsed.campaign, this.levels);
      } else {
        this.campaign = normalizeCampaignData(this.campaign, this.levels);
      }
      if (!this.levels.some((level) => level.id === this.state.levelId)) {
        this.state.levelId = this.levels.find((level) => level.id === this.campaign.startLevel)?.id ?? this.levels[0].id;
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
