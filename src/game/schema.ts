export type TerrainType = "grass" | "stone" | "sand" | "water";
export type ObstacleType = "wall" | "tower" | "tree" | "cover";
export type Team = "player" | "enemy";
export type ClassName = "Warrior" | "Healer" | "Ranger" | "Mage";
export type SectionName = "head" | "body" | "legs";

export interface TileData {
  height: number;
  terrain: TerrainType;
}

export interface ObstacleData {
  id: string;
  type: ObstacleType;
  x: number;
  z: number;
}

export interface UnitFaceLayout {
  head: ClassName[];
  body: ClassName[];
  legs: ClassName[];
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

export interface LevelData {
  id: string;
  name: string;
  width: number;
  depth: number;
  tiles: TileData[][];
  obstacles: ObstacleData[];
  units: UnitData[];
  objectives: LevelObjective[];
  links: LevelLink[];
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
