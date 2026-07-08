import type { CampaignData, LevelData, ObstacleType, Team, TerrainType, TileCoord, UnitData, UnitTemplate } from "./schema";

export function cloneLevel(level: LevelData): LevelData {
  return structuredClone(level);
}

export function levelKey(levelId: string): string {
  return `craft-heroes-level:${levelId}`;
}

export function campaignKey(campaignId: string): string {
  return `craft-heroes-campaign:${campaignId}`;
}

export function saveLevel(level: LevelData): void {
  localStorage.setItem(levelKey(level.id), JSON.stringify(level, null, 2));
}

export function saveCampaign(campaign: CampaignData): void {
  localStorage.setItem(campaignKey(campaign.id), JSON.stringify(campaign, null, 2));
}

export function getTile(level: LevelData, coord: TileCoord) {
  return level.tiles[coord.z]?.[coord.x];
}

export function isInside(level: LevelData, coord: TileCoord): boolean {
  return coord.x >= 0 && coord.z >= 0 && coord.x < level.width && coord.z < level.depth;
}

export function changeHeight(level: LevelData, coord: TileCoord, delta: number): LevelData {
  const next = cloneLevel(level);
  const tile = getTile(next, coord);
  if (tile) {
    tile.height = Math.max(0, Math.min(6, tile.height + delta));
  }
  return next;
}

export function paintTerrain(level: LevelData, coord: TileCoord, terrain: TerrainType): LevelData {
  const next = cloneLevel(level);
  const tile = getTile(next, coord);
  if (tile) {
    tile.terrain = terrain;
  }
  return next;
}

export function resizeLevel(level: LevelData, width: number, depth: number, terrain: TerrainType = "grass"): LevelData {
  const next = cloneLevel(level);
  const nextWidth = Math.max(4, Math.min(32, Math.round(width)));
  const nextDepth = Math.max(4, Math.min(32, Math.round(depth)));
  next.width = nextWidth;
  next.depth = nextDepth;
  next.tiles = Array.from({ length: nextDepth }, (_, z) =>
    Array.from({ length: nextWidth }, (_, x) => {
      const existing = level.tiles[z]?.[x];
      return existing ? { ...existing } : { height: 1, terrain };
    })
  );
  next.obstacles = next.obstacles.filter((obstacle) => isInside(next, obstacle));
  next.units = next.units.filter((unit) => isInside(next, unit));
  return next;
}

export function placeObstacle(level: LevelData, coord: TileCoord, type: ObstacleType): LevelData {
  const next = cloneLevel(level);
  next.obstacles = next.obstacles.filter((obstacle) => obstacle.x !== coord.x || obstacle.z !== coord.z);
  next.obstacles.push({
    id: `obs-${type}-${Date.now()}`,
    type,
    x: coord.x,
    z: coord.z
  });
  return next;
}

export function placeUnit(level: LevelData, coord: TileCoord, team: Team, template: UnitTemplate): LevelData {
  const next = cloneLevel(level);
  next.units = next.units.filter((unit) => unit.x !== coord.x || unit.z !== coord.z);
  next.units.push({
    id: `${team}-${Date.now()}`,
    team,
    templateId: template.id,
    name: team === "player" ? "Player Cube" : template.name,
    x: coord.x,
    z: coord.z,
    hp: template.hp,
    rotations: { head: 0, body: team === "enemy" ? 2 : 0, legs: 0 },
    faces: structuredClone(template.faces)
  });
  return next;
}

export function eraseTileOccupants(level: LevelData, coord: TileCoord): LevelData {
  const next = cloneLevel(level);
  next.obstacles = next.obstacles.filter((obstacle) => obstacle.x !== coord.x || obstacle.z !== coord.z);
  next.units = next.units.filter((unit) => unit.x !== coord.x || unit.z !== coord.z);
  return next;
}

export function unitAt(level: LevelData, coord: TileCoord): UnitData | undefined {
  return level.units.find((unit) => unit.x === coord.x && unit.z === coord.z);
}

export function obstacleAt(level: LevelData, coord: TileCoord) {
  return level.obstacles.find((obstacle) => obstacle.x === coord.x && obstacle.z === coord.z);
}

export function validateLevel(level: LevelData): string[] {
  const warnings: string[] = [];
  if (!level.units.some((unit) => unit.team === "player")) {
    warnings.push("No player unit placed.");
  }
  if (!level.units.some((unit) => unit.team === "enemy")) {
    warnings.push("No enemy units placed.");
  }
  if (level.objectives.length === 0) {
    warnings.push("No objective configured.");
  }
  for (const unit of level.units) {
    if (!isInside(level, unit)) {
      warnings.push(`${unit.name} is outside the board.`);
    }
  }
  return warnings;
}
