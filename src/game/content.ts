import type {
  CampaignData,
  ClassDefinition,
  ClassId,
  ClassSectionStats,
  EnvironmentMaterialDefinition,
  EnvironmentSettings,
  LevelData,
  PropDefinition,
  TerrainType,
  TileData,
  UnitData,
  UnitFaceLayout,
  UnitTemplate
} from "./schema";

function stats(attack: number, defense: number, move: number, range: number, support: number): ClassSectionStats {
  return { attack, defense, move, range, support };
}

export const defaultClassDefinitions: ClassDefinition[] = [
  {
    id: "Warrior",
    name: "Warrior",
    color: "#d24a35",
    sections: {
      head: {
        imageUrl: "/assets/classes/warrior-head.png",
        stats: stats(1, 3, 0, 1, 0),
        conditions: ["Braced: ignore first push"]
      },
      body: {
        imageUrl: "/assets/classes/warrior-body.png",
        stats: stats(4, 3, 0, 1, 0),
        conditions: ["Melee: attacks the front tile"]
      },
      legs: {
        imageUrl: "/assets/classes/warrior-legs.png",
        stats: stats(0, 2, 2, 0, 0),
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
        imageUrl: "/assets/classes/healer-head.png",
        stats: stats(0, 1, 0, 3, 3),
        conditions: ["Cleanse: clears one condition"]
      },
      body: {
        imageUrl: "/assets/classes/healer-body.png",
        stats: stats(1, 2, 0, 2, 4),
        conditions: ["Mend: restores adjacent ally HP"]
      },
      legs: {
        imageUrl: "/assets/classes/healer-legs.png",
        stats: stats(0, 1, 2, 0, 2),
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
        imageUrl: "/assets/classes/ranger-head.png",
        stats: stats(2, 1, 0, 4, 1),
        conditions: ["Scout: extends line of sight from height"]
      },
      body: {
        imageUrl: "/assets/classes/ranger-body.png",
        stats: stats(3, 1, 0, 5, 0),
        conditions: ["Volley: blocked by cover"]
      },
      legs: {
        imageUrl: "/assets/classes/ranger-legs.png",
        stats: stats(0, 1, 4, 0, 0),
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
        imageUrl: "/assets/classes/mage-head.png",
        stats: stats(3, 1, 0, 4, 1),
        conditions: ["Arcane sight: ignores low cover"]
      },
      body: {
        imageUrl: "/assets/classes/mage-body.png",
        stats: stats(4, 1, 0, 3, 2),
        conditions: ["Blast: affects nearby target tiles"]
      },
      legs: {
        imageUrl: "/assets/classes/mage-legs.png",
        stats: stats(0, 0, 2, 0, 1),
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
  sunIntensity: 2
};

export const defaultEnvironmentMaterials: EnvironmentMaterialDefinition[] = [
  {
    id: "grass",
    name: "Grass",
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

function unit(id: string, team: "player" | "enemy", templateId: string, x: number, z: number): UnitData {
  const template = unitTemplates.find((candidate) => candidate.id === templateId) ?? unitTemplates[0];
  return {
    id,
    team,
    templateId,
    name: team === "player" ? "Player Cube" : template.name,
    x,
    z,
    hp: template.hp,
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
    { id: "obs-wall-1", type: "wall", x: 5, z: 2 },
    { id: "obs-tower-1", type: "tower", x: 7, z: 5 },
    { id: "obs-tree-1", type: "tree", x: 8, z: 2 }
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
  objectives: [{ type: "defeatTeam", team: "enemy" }],
  links: [{ id: "ridge-link", label: "Continue to Ridge Ambush", to: "ridge-ambush-02" }]
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
    { id: "ridge-cover-1", type: "cover", x: 3, z: 3 },
    { id: "ridge-cover-2", type: "cover", x: 6, z: 4 },
    { id: "ridge-tower", type: "tower", x: 8, z: 2 }
  ],
  surroundings: [
    { id: "sur-ridge-wall-west", type: "wall", x: -2, z: 4, rotation: 0.1, scale: 1.1 },
    { id: "sur-ridge-tower-east", type: "tower", x: 11, z: 1, rotation: 0.2, scale: 0.95 },
    { id: "sur-ridge-cover-north", type: "cover", x: 2, z: -2, rotation: 0.5, scale: 1.2 },
    { id: "sur-ridge-wall-south", type: "wall", x: 8, z: 9, rotation: 0.7, scale: 0.85 }
  ],
  units: [
    unit("player-1", "player", "starter-cube", 1, 6),
    unit("enemy-1", "enemy", "skirmisher-cube", 7, 1),
    unit("enemy-2", "enemy", "guard-cube", 8, 4)
  ],
  objectives: [{ type: "surviveRounds", rounds: 5 }],
  links: []
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
  levels: [
    { id: "forest-pass-01", file: "levels/forest-pass-01.json", next: ["ridge-ambush-02"] },
    { id: "ridge-ambush-02", file: "levels/ridge-ambush-02.json", next: [] }
  ]
};
