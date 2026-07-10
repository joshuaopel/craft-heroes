import type {
  AbilityDefinition,
  AbilityTrigger,
  CampaignData,
  ClassDefinition,
  ClassId,
  ClassSectionStats,
  ConditionDefinition,
  EnvironmentMaterialDefinition,
  EnvironmentSettings,
  GameplayRules,
  LevelData,
  PropDefinition,
  TerrainType,
  TileData,
  AIBehavior,
  UnitData,
  UnitFaceLayout,
  UnitTemplate
} from "./schema";

function stats(attack: number, defense: number, move: number, range: number, support: number): ClassSectionStats {
  return { attack, defense, move, range, support };
}

function ability(name: string, trigger: AbilityTrigger, icon: string, color: string, description: string, effect: string): AbilityDefinition {
  return {
    id: name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    name,
    trigger,
    icon,
    color,
    description,
    effect
  };
}

function condition(
  id: string,
  name: string,
  kind: ConditionDefinition["kind"],
  icon: string,
  color: string,
  duration: number,
  description: string,
  modifiers: ConditionDefinition["modifiers"],
  effect = "",
  stackable = false,
  hidden = false
): ConditionDefinition {
  return {
    id,
    name,
    kind,
    icon,
    color,
    duration,
    description,
    modifiers,
    effect,
    stackable,
    hidden
  };
}

export const defaultGameplayRules: GameplayRules = {
  initiative: {
    base: 10,
    headWeight: 1,
    bodyWeight: 0.35,
    legsWeight: 1.15,
    heightWeight: 1,
    conditionWeight: 1,
    random: 0,
    tieBreaker: "player"
  },
  conditions: [
    condition("braced", "Braced", "buff", "SH", "#d24a35", 1, "+1 defense and +1 initiative until the next round.", { defense: 1, initiative: 1 }),
    condition("marked", "Marked", "debuff", "MK", "#f2bd55", 2, "-1 defense; ranged and support actions can read this target.", { defense: -1 }),
    condition("warded", "Warded", "buff", "WD", "#46a65c", 2, "+2 defense from protective support.", { defense: 2 }),
    condition("haste", "Haste", "buff", "HS", "#76a957", 1, "+1 move and +2 initiative.", { move: 1, initiative: 2 }),
    condition("exposed", "Exposed", "debuff", "EX", "#8c6ad1", 2, "-2 defense after a magical burst.", { defense: -2 }),
    condition("poisoned", "Poisoned", "debuff", "PS", "#5da85a", 3, "Take 1 damage at the end of each round.", {}, "damagePerRound:1"),
    condition("snared", "Snared", "trap", "TR", "#8d6a3f", 2, "-2 move after triggering a trap.", { move: -2 }, "", false, true),
    condition("healing-aura", "Healing Aura", "buff", "HA", "#6fcf7c", 1, "+1 support from sanctuary movement.", { support: 1 }, "healPerRound:1")
  ]
};

export const defaultClassDefinitions: ClassDefinition[] = [
  {
    id: "Warrior",
    name: "Warrior",
    color: "#d24a35",
    sections: {
      head: {
        imageUrl: "./assets/classes/warrior-head.png",
        stats: stats(1, 3, 0, 1, 0),
        abilities: [ability("Braced Focus", "passive", "SH", "#d24a35", "Ignore the first push or forced turn each round.", "ignorePush:1;apply:braced")],
        conditions: ["Braced: ignore first push"]
      },
      body: {
        imageUrl: "./assets/classes/warrior-body.png",
        stats: stats(4, 3, 0, 1, 0),
        abilities: [ability("Guard Break", "onAttack", "SW", "#d24a35", "Strike the front tile and gain impact from high ground.", "frontMelee:1;heightAttack:1")],
        conditions: ["Melee: attacks the front tile"]
      },
      legs: {
        imageUrl: "./assets/classes/warrior-legs.png",
        stats: stats(0, 2, 2, 0, 0),
        abilities: [ability("Hold Line", "onDefend", "ST", "#b96a42", "+1 defense if this unit did not move this turn.", "stationaryDefense:1;apply:braced")],
        conditions: ["Hold line: +1 defense if unmoved"]
      }
    }
  },
  {
    id: "Healer",
    name: "Healer",
    color: "#46a65c",
    sections: {
      head: {
        imageUrl: "./assets/classes/healer-head.png",
        stats: stats(0, 1, 0, 3, 3),
        abilities: [ability("Cleanse", "onSupport", "SP", "#46a65c", "Clear one condition from a visible ally.", "cleanse:1")],
        conditions: ["Cleanse: clears one condition"]
      },
      body: {
        imageUrl: "./assets/classes/healer-body.png",
        stats: stats(1, 2, 0, 2, 4),
        abilities: [ability("Mend", "active", "HE", "#46a65c", "Restore HP to an adjacent ally instead of attacking.", "healAdjacent:3;apply:warded")],
        conditions: ["Mend: restores adjacent ally HP"]
      },
      legs: {
        imageUrl: "./assets/classes/healer-legs.png",
        stats: stats(0, 1, 2, 0, 2),
        abilities: [ability("Sanctuary Step", "onMove", "SA", "#6fcf7c", "Ignore water movement cost and leave a support aura.", "ignoreTerrain:water;apply:healing-aura")],
        conditions: ["Sanctuary: ignores water cost"]
      }
    }
  },
  {
    id: "Ranger",
    name: "Ranger",
    color: "#4f7f3c",
    sections: {
      head: {
        imageUrl: "./assets/classes/ranger-head.png",
        stats: stats(2, 1, 0, 4, 1),
        abilities: [ability("Scout Sight", "passive", "EY", "#4f7f3c", "Extend line of sight when attacking from height.", "heightLineOfSight:1;applyOnAttack:marked")],
        conditions: ["Scout: extends line of sight from height"]
      },
      body: {
        imageUrl: "./assets/classes/ranger-body.png",
        stats: stats(3, 1, 0, 5, 0),
        abilities: [ability("Volley", "onAttack", "AR", "#4f7f3c", "Fire at range; cover can reduce or block the shot.", "rangedAttack:5;coverBlocked:1;apply:marked;apply:snared")],
        conditions: ["Volley: blocked by cover"]
      },
      legs: {
        imageUrl: "./assets/classes/ranger-legs.png",
        stats: stats(0, 1, 4, 0, 0),
        abilities: [ability("Swift Pivot", "onMove", "BT", "#76a957", "Move farther and rotate one section after moving.", "bonusMove:1;postMoveRotate:1;apply:haste")],
        conditions: ["Swift: may rotate after moving"]
      }
    }
  },
  {
    id: "Mage",
    name: "Mage",
    color: "#6b4fa0",
    sections: {
      head: {
        imageUrl: "./assets/classes/mage-head.png",
        stats: stats(3, 1, 0, 4, 1),
        abilities: [ability("Arcane Sight", "passive", "OR", "#6b4fa0", "Ignore low cover when tracing magical line of sight.", "ignoreLowCover:1")],
        conditions: ["Arcane sight: ignores low cover"]
      },
      body: {
        imageUrl: "./assets/classes/mage-body.png",
        stats: stats(4, 1, 0, 3, 2),
        abilities: [ability("Blast", "onAttack", "FX", "#8c6ad1", "Damage the target tile and splash nearby enemies.", "splashRadius:1;apply:exposed")],
        conditions: ["Blast: affects nearby target tiles"]
      },
      legs: {
        imageUrl: "./assets/classes/mage-legs.png",
        stats: stats(0, 0, 2, 0, 1),
        abilities: [ability("Blink Step", "onMove", "BL", "#9f78e8", "Cross one height step or gap during movement.", "crossHeightStep:1")],
        conditions: ["Blink: crosses one height step"]
      }
    }
  }
];

export const classNames: ClassId[] = defaultClassDefinitions.map((classDefinition) => classDefinition.id);

export const defaultEnvironmentSettings: EnvironmentSettings = {
  skyColor: "#7bb6c5",
  fogColor: "#7bb6c5",
  groundColor: "#526553",
  groundTextureUrl: "",
  ambientIntensity: 1.2,
  sunIntensity: 2,
  windStrength: 0.8,
  windSpeed: 1,
  backgroundModel: {
    modelUrl: "",
    modelFileName: "",
    fitToMap: true,
    scale: 1,
    rotation: 0,
    offsetY: 0
  }
};

export const defaultEnvironmentMaterials: EnvironmentMaterialDefinition[] = [
  {
    id: "grass",
    name: "Grass",
    surfaceEffect: "grass",
    grassDensity: 4,
    grassHeightMin: 0.03,
    grassHeightMax: 0.095,
    grassColors: ["#79b95a", "#94c866", "#b1dc70"],
    topColor: "#8fc265",
    sideColor: "#5c6f48",
    sideCapColor: "#6f8f45",
    sideFullColor: "#6b4f35",
    sideHalfColor: "#4f3d2c",
    topImageUrl: "",
    sideImageUrl: "",
    sideCapImageUrl: "",
    sideFullImageUrl: "",
    sideHalfImageUrl: "",
    topRule: "Open playable ground. Use leafy or mossy top texture.",
    sideRule: "Cap side should include a green grass lip; full and half sides should be pure dirt below it.",
    movementCost: 1,
    blocksLineOfSight: false
  },
  {
    id: "stone",
    name: "Stone",
    surfaceEffect: "solid",
    grassDensity: 0,
    grassHeightMin: 0.03,
    grassHeightMax: 0.08,
    grassColors: ["#7d8e6c", "#8fa173", "#a5b784"],
    topColor: "#8f958d",
    sideColor: "#646a63",
    sideCapColor: "#777d74",
    sideFullColor: "#5e635d",
    sideHalfColor: "#4e544f",
    topImageUrl: "",
    sideImageUrl: "",
    sideCapImageUrl: "",
    sideFullImageUrl: "",
    sideHalfImageUrl: "",
    topRule: "Hard elevation surface. Good for ridges, ruins, and high ground.",
    sideRule: "Cap side can show the top stone edge; full and half sides should use clean cliff/block faces.",
    movementCost: 1,
    blocksLineOfSight: false
  },
  {
    id: "sand",
    name: "Sand",
    surfaceEffect: "solid",
    grassDensity: 0,
    grassHeightMin: 0.03,
    grassHeightMax: 0.08,
    grassColors: ["#a5a563", "#b4b978", "#c7ca8f"],
    topColor: "#d0b66b",
    sideColor: "#9b7f46",
    sideCapColor: "#b99b58",
    sideFullColor: "#8d7041",
    sideHalfColor: "#6e5734",
    topImageUrl: "",
    sideImageUrl: "",
    sideCapImageUrl: "",
    sideFullImageUrl: "",
    sideHalfImageUrl: "",
    topRule: "Loose terrain. Use soft grain top texture with lower contrast.",
    sideRule: "Cap side may include wind-swept sand at the top; lower sides should be compacted bank texture.",
    movementCost: 2,
    blocksLineOfSight: false
  },
  {
    id: "water",
    name: "Water",
    surfaceEffect: "water",
    grassDensity: 0,
    grassHeightMin: 0.03,
    grassHeightMax: 0.08,
    grassColors: ["#2d6954", "#3f7654", "#4f8b63"],
    topColor: "#5198ba",
    sideColor: "#385f6f",
    sideCapColor: "#3d7d96",
    sideFullColor: "#2d5968",
    sideHalfColor: "#244957",
    topImageUrl: "",
    sideImageUrl: "",
    sideCapImageUrl: "",
    sideFullImageUrl: "",
    sideHalfImageUrl: "",
    topRule: "Shallow tactical water. Use animated-looking or glossy top art.",
    sideRule: "Cap side can be wet-bank detail; lower sides should be darker water or bank texture.",
    movementCost: 3,
    blocksLineOfSight: false
  }
];

export const defaultPropDefinitions: PropDefinition[] = [
  {
    id: "wall",
    name: "Wall",
    role: "blocker",
    assetKind: "box",
    windEffect: false,
    emitsLight: false,
    lightColor: "#ffb85c",
    lightIntensity: 1.4,
    lightRange: 4,
    lightOffsetY: 0.72,
    color: "#6c716a",
    textureUrl: "",
    modelUrl: "",
    modelFileName: "",
    fitModelToTile: true,
    width: 0.75,
    height: 0.9,
    depth: 0.75,
    blocksMovement: true,
    blocksLineOfSight: true,
    coverBonus: 2,
    notes: ["Full blocker", "Breaks line of sight"]
  },
  {
    id: "tower",
    name: "Tower",
    role: "blocker",
    assetKind: "box",
    windEffect: false,
    emitsLight: false,
    lightColor: "#ffb85c",
    lightIntensity: 1.4,
    lightRange: 4,
    lightOffsetY: 0.95,
    color: "#696d5e",
    textureUrl: "",
    modelUrl: "",
    modelFileName: "",
    fitModelToTile: true,
    width: 0.82,
    height: 1.25,
    depth: 0.82,
    blocksMovement: true,
    blocksLineOfSight: true,
    coverBonus: 3,
    notes: ["Tall blocker", "Marks height advantage"]
  },
  {
    id: "tree",
    name: "Tree",
    role: "cover",
    assetKind: "box",
    windEffect: true,
    emitsLight: false,
    lightColor: "#ffb85c",
    lightIntensity: 1.4,
    lightRange: 4,
    lightOffsetY: 0.75,
    color: "#3e8a58",
    textureUrl: "",
    modelUrl: "",
    modelFileName: "",
    fitModelToTile: true,
    width: 0.7,
    height: 0.95,
    depth: 0.7,
    blocksMovement: true,
    blocksLineOfSight: false,
    coverBonus: 1,
    notes: ["Soft cover", "Can be used as forest dressing"]
  },
  {
    id: "cover",
    name: "Cover",
    role: "cover",
    assetKind: "box",
    windEffect: false,
    emitsLight: false,
    lightColor: "#ffb85c",
    lightIntensity: 1.4,
    lightRange: 4,
    lightOffsetY: 0.36,
    color: "#776a50",
    textureUrl: "",
    modelUrl: "",
    modelFileName: "",
    fitModelToTile: true,
    width: 0.9,
    height: 0.42,
    depth: 0.35,
    blocksMovement: false,
    blocksLineOfSight: false,
    coverBonus: 1,
    notes: ["Half cover", "Does not block movement"]
  },
  {
    id: "torch",
    name: "Torch",
    role: "decor",
    assetKind: "box",
    windEffect: false,
    emitsLight: true,
    lightColor: "#ffb55f",
    lightIntensity: 1.85,
    lightRange: 4.6,
    lightOffsetY: 0.72,
    color: "#8a5a30",
    textureUrl: "",
    modelUrl: "",
    modelFileName: "",
    fitModelToTile: true,
    width: 0.24,
    height: 0.78,
    depth: 0.24,
    blocksMovement: false,
    blocksLineOfSight: false,
    coverBonus: 0,
    notes: ["Emits warm light", "Use with low ambient and sun for nighttime scenes"]
  }
];

function faceLayout(offset = 0): UnitFaceLayout {
  const spin = (amount: number) => classNames.map((_, index) => classNames[(index + offset + amount) % classNames.length]);
  return {
    head: spin(1),
    body: spin(0),
    legs: spin(2)
  };
}

export const unitTemplates: UnitTemplate[] = [
  {
    id: "starter-cube",
    name: "Starter Cube",
    hp: 24,
    faces: faceLayout(0)
  },
  {
    id: "guard-cube",
    name: "Guard Cube",
    hp: 30,
    faces: faceLayout(3)
  },
  {
    id: "skirmisher-cube",
    name: "Skirmisher Cube",
    hp: 20,
    faces: faceLayout(2)
  }
];

export function makeTiles(width: number, depth: number, terrain: TerrainType = "grass", height = 1): TileData[][] {
  return Array.from({ length: depth }, () =>
    Array.from({ length: width }, () => ({
      height,
      terrain
    }))
  );
}

function unit(id: string, team: "player" | "enemy", templateId: string, x: number, z: number, aiBehavior: AIBehavior = "straight-offense"): UnitData {
  const template = unitTemplates.find((candidate) => candidate.id === templateId) ?? unitTemplates[0];
  return {
    id,
    team,
    templateId,
    name: team === "player" ? "Player Cube" : template.name,
    x,
    z,
    hp: template.hp,
    aiBehavior: team === "enemy" ? aiBehavior : undefined,
    rotations: { head: 0, body: team === "enemy" ? 2 : 0, legs: 0 },
    faces: structuredClone(template.faces)
  };
}

export const forestPass: LevelData = {
  id: "forest-pass-01",
  name: "Forest Pass",
  width: 10,
  depth: 8,
  environment: structuredClone(defaultEnvironmentSettings),
  tiles: makeTiles(10, 8),
  obstacles: [
    { id: "obs-wall-1", type: "wall", x: 5, z: 2, rotation: 0 },
    { id: "obs-tower-1", type: "tower", x: 7, z: 5, rotation: 0 },
    { id: "obs-tree-1", type: "tree", x: 8, z: 2, rotation: 0 }
  ],
  surroundings: [
    { id: "sur-tree-west-1", type: "tree", x: -2, z: 1, rotation: 0.2, scale: 1.25 },
    { id: "sur-tree-east-1", type: "tree", x: 11, z: 2, rotation: 0.8, scale: 1.1 },
    { id: "sur-wall-north-1", type: "wall", x: 4, z: -2, rotation: 0, scale: 0.9 },
    { id: "sur-cover-south-1", type: "cover", x: 7, z: 9, rotation: 0.4, scale: 1.15 }
  ],
  units: [
    unit("player-1", "player", "starter-cube", 1, 6),
    unit("enemy-1", "enemy", "guard-cube", 8, 1)
  ],
  initiativeOrder: ["player-1", "enemy-1"],
  objectives: [{ type: "defeatTeam", team: "enemy" }],
  links: [{ id: "ridge-link", label: "Continue to Ridge Ambush", to: "ridge-ambush-02" }],
  story: [
    {
      id: "forest-opening",
      trigger: "levelStart",
      presentation: "screen",
      title: "The Forest Pass",
      speaker: "",
      text: "The road narrows ahead. Break the guard line before the ridge closes around you."
    },
    {
      id: "forest-warning",
      trigger: "tileEnter",
      presentation: "dialog",
      title: "",
      speaker: "Ranger",
      text: "That rise gives us a clean line of sight.",
      x: 3,
      z: 6
    }
  ]
};

forestPass.tiles[0][3].height = 2;
forestPass.tiles[0][4].height = 2;
forestPass.tiles[1][4].height = 3;
forestPass.tiles[1][5].height = 2;
forestPass.tiles[5][7].height = 3;
forestPass.tiles[6][3].height = 3;
forestPass.tiles[0][6].terrain = "water";
forestPass.tiles[0][7].terrain = "water";
forestPass.tiles[3][3].terrain = "sand";
forestPass.tiles[3][4].terrain = "sand";
forestPass.tiles[7][1].terrain = "sand";

export const ridgeAmbush: LevelData = {
  id: "ridge-ambush-02",
  name: "Ridge Ambush",
  width: 10,
  depth: 8,
  environment: {
    ...defaultEnvironmentSettings,
    skyColor: "#8aa6b2",
    fogColor: "#8aa6b2",
    groundColor: "#5f5d52",
    ambientIntensity: 1.1,
    sunIntensity: 2.2
  },
  tiles: makeTiles(10, 8, "stone", 1),
  obstacles: [
    { id: "ridge-cover-1", type: "cover", x: 3, z: 3, rotation: 0 },
    { id: "ridge-cover-2", type: "cover", x: 6, z: 4, rotation: 0 },
    { id: "ridge-tower", type: "tower", x: 8, z: 2, rotation: 0 }
  ],
  surroundings: [
    { id: "sur-ridge-wall-west", type: "wall", x: -2, z: 4, rotation: 0.1, scale: 1.1 },
    { id: "sur-ridge-tower-east", type: "tower", x: 11, z: 1, rotation: 0.2, scale: 0.95 },
    { id: "sur-ridge-cover-north", type: "cover", x: 2, z: -2, rotation: 0.5, scale: 1.2 },
    { id: "sur-ridge-wall-south", type: "wall", x: 8, z: 9, rotation: 0.7, scale: 0.85 }
  ],
  units: [
    unit("player-1", "player", "starter-cube", 1, 6),
    unit("enemy-1", "enemy", "skirmisher-cube", 7, 1, "avoidance-cycle"),
    unit("enemy-2", "enemy", "guard-cube", 8, 4, "cautionary-cycle")
  ],
  initiativeOrder: ["player-1", "enemy-1", "enemy-2"],
  objectives: [{ type: "surviveRounds", rounds: 5 }],
  links: [],
  story: [
    {
      id: "ridge-opening",
      trigger: "levelStart",
      presentation: "dialog",
      title: "",
      speaker: "Mage",
      text: "They have the high ground. Twist your build before they choose the range of this fight."
    },
    {
      id: "ridge-finale",
      trigger: "levelComplete",
      presentation: "screen",
      title: "The Ridge Holds",
      speaker: "",
      text: "The ambush breaks. Beyond the ridge, the road into the crafted wilds is open."
    }
  ]
};

for (let z = 0; z < ridgeAmbush.depth; z += 1) {
  for (let x = 0; x < ridgeAmbush.width; x += 1) {
    ridgeAmbush.tiles[z][x].height = x > 5 ? 3 : x > 2 ? 2 : 1;
    ridgeAmbush.tiles[z][x].terrain = z % 3 === 0 ? "sand" : "stone";
  }
}

export const defaultLevels: LevelData[] = [forestPass, ridgeAmbush].map((level) => structuredClone(level));

export const defaultCampaign: CampaignData = {
  id: "craft-heroes-demo",
  title: "Craft Heroes Demo Campaign",
  startLevel: "forest-pass-01",
  titleScreen: {
    kicker: "Voxel tactics prototype",
    headline: "Craft Heroes",
    subhead: "Rotate class faces, chain handmade levels, and test the build language for a Steam-ready tactics pitch.",
    backgroundLevelId: "forest-pass-01",
    cameraOrbit: true,
    orbitSpeed: 0.08,
    mockBattle: true
  },
  gameplay: structuredClone(defaultGameplayRules),
  levels: [
    { id: "forest-pass-01", file: "levels/forest-pass-01.json", next: ["ridge-ambush-02"] },
    { id: "ridge-ambush-02", file: "levels/ridge-ambush-02.json", next: [] }
  ]
};
