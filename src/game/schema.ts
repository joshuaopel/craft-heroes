export type TerrainType = string;
export type ObstacleType = string;
export type Team = "player" | "enemy";
export type ClassId = string;
export type ClassName = ClassId;
export type SectionName = "head" | "body" | "legs";
export type EnvironmentMaterialId = string;
export type PropDefinitionId = string;
export type EnvironmentSurfaceEffect = "solid" | "grass" | "water";

export interface ClassSectionStats {
  attack: number;
  defense: number;
  move: number;
  range: number;
  support: number;
}

export interface ClassSectionDefinition {
  imageUrl: string;
  stats: ClassSectionStats;
  conditions: string[];
}

export interface ClassDefinition {
  id: ClassId;
  name: string;
  color: string;
  sections: Record<SectionName, ClassSectionDefinition>;
}

export interface EnvironmentMaterialDefinition {
  id: EnvironmentMaterialId;
  name: string;
  surfaceEffect: EnvironmentSurfaceEffect;
  grassDensity: number;
  topColor: string;
  sideColor: string;
  sideCapColor: string;
  sideFullColor: string;
  sideHalfColor: string;
  topImageUrl: string;
  sideImageUrl: string;
  sideCapImageUrl: string;
  sideFullImageUrl: string;
  sideHalfImageUrl: string;
  topRule: string;
  sideRule: string;
  movementCost: number;
  blocksLineOfSight: boolean;
}

export interface PropDefinition {
  id: PropDefinitionId;
  name: string;
  role: "blocker" | "cover" | "decor";
  assetKind: "box" | "glb";
  windEffect: boolean;
  color: string;
  textureUrl: string;
  modelUrl: string;
  modelFileName: string;
  fitModelToTile: boolean;
  width: number;
  height: number;
  depth: number;
  blocksMovement: boolean;
  blocksLineOfSight: boolean;
  coverBonus: number;
  notes: string[];
}

export interface EnvironmentSettings {
  skyColor: string;
  fogColor: string;
  groundColor: string;
  groundTextureUrl: string;
  ambientIntensity: number;
  sunIntensity: number;
  backgroundModel: BackgroundModelSettings;
}

export interface BackgroundModelSettings {
  modelUrl: string;
  modelFileName: string;
  fitToMap: boolean;
  scale: number;
  rotation: number;
  offsetY: number;
}

export interface TileData {
  height: number;
  terrain: EnvironmentMaterialId;
}

export interface ObstacleData {
  id: string;
  type: PropDefinitionId;
  x: number;
  z: number;
}

export interface SurroundingPropData {
  id: string;
  type: PropDefinitionId;
  x: number;
  z: number;
  rotation: number;
  scale: number;
}

export interface UnitFaceLayout {
  head: ClassId[];
  body: ClassId[];
  legs: ClassId[];
}

export interface UnitData {
  id: string;
  team: Team;
  templateId: string;
  name: string;
  x: number;
  z: number;
  hp: number;
  rotations: Record<SectionName, number>;
  faces: UnitFaceLayout;
}

export interface LevelObjective {
  type: "defeatTeam" | "reachTile" | "surviveRounds";
  team?: Team;
  x?: number;
  z?: number;
  rounds?: number;
}

export interface LevelLink {
  id: string;
  label: string;
  to: string;
}

export type StoryTrigger = "levelStart" | "tileEnter" | "levelComplete";
export type StoryPresentation = "dialog" | "screen";

export interface StoryBeat {
  id: string;
  trigger: StoryTrigger;
  presentation: StoryPresentation;
  title: string;
  speaker: string;
  text: string;
  x?: number;
  z?: number;
}

export interface LevelData {
  id: string;
  name: string;
  width: number;
  depth: number;
  environment: EnvironmentSettings;
  tiles: TileData[][];
  obstacles: ObstacleData[];
  surroundings: SurroundingPropData[];
  units: UnitData[];
  objectives: LevelObjective[];
  links: LevelLink[];
  story: StoryBeat[];
}

export interface CampaignLevelRef {
  id: string;
  file: string;
  next: string[];
}

export interface CampaignData {
  id: string;
  title: string;
  startLevel: string;
  levels: CampaignLevelRef[];
}

export interface UnitTemplate {
  id: string;
  name: string;
  hp: number;
  faces: UnitFaceLayout;
}

export type EditorTool =
  | "select"
  | "raise"
  | "lower"
  | "paint"
  | "obstacle"
  | "unit"
  | "erase";

export interface TileCoord {
  x: number;
  z: number;
}
