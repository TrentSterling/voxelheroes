// Terrain, dungeon and prop colours (albedo, sRGB hex), from the art bible section 7.
//
// These are authoring colours: the lights and the tone mapping move them toward the rendered
// targets listed in the bible. Re-derive by rendering and sampling, not by eye.

// Overworld, grass field (art bible section 7, "Albedo" column; soil and wood from the lab). Sand is
// the bible's sand biome (base, ripple strokes, specks): the lab's placeholder sand 0xe2d6a4 rendered
// pale pinkish grey, #cbbdac, against the references' #b5a772. Cliffs are the bible's albedos x0.94
// (south faces rendered 15-20% brighter than refs 36, 40 and 49, in the game and the lab alike).
// Leaf speckles are a yellow-green cream (ref 01's close-up reads #cbdd9f; 0xf2e2d6 rendered
// pink-white #d9cad1, brighter than any canopy pixel in the references).
export const TP = {
  grass: 0x7bb45a, grassDark: 0x5f983f, grassLight: 0x94c273,
  dirt: 0xada47b, dirtDark: 0x968e68, dirtLight: 0xc2b98e,
  sand: 0xc3bf7e, sandDark: 0x8b8a61, sandLight: 0xd2cd92,
  cliff: 0xa7a378, cliffDark: 0x8e8a67, cliffLight: 0xb5b183, cliffCrack: 0x747154,
  soil: 0x7d6650,
  cave: 0x1a120c,
  waterBed: 0x2c5f9e,
  leaf: 0x1aa818, leafDark: 0x0f8a10, leafLight: 0x86d45e, leafSpeck: 0xdfe9a6,
  trunk: 0x9a7458, trunkDark: 0x7a5a44,
  rock: 0x9c968c, rockDark: 0x77726a,
  stone: 0xa7a39a, stoneDark: 0x817d75,
  wood: 0x9b7048, woodDark: 0x6e4d30,
};

// Ground kinds: base colour, dark accent, light accent.
export const GROUND = {
  grass: [TP.grass, TP.grassDark, TP.grassLight],
  dirt: [TP.dirt, TP.dirtDark, TP.dirtLight],
  path: [TP.dirt, TP.dirtDark, TP.dirtLight],
  sand: [TP.sand, TP.sandDark, TP.sandLight],
};

// Dungeon, golden temple (art bible section 7).
export const GOLD = {
  floor: 0x5c5a54, floorRing: 0x75716a, grout: 0x46433e, floorUnder: 0x3a3833,
  wall: 0xbc8a58, wallDark: 0x9c7048, mortar: 0x5e3c20, trim: 0x2c5048, ledge: 0xd8983c,
  south: 0x000000,
  plate: 0x9a7866, plateMark: 0xe08a30, plateShade: 0x56708a,
  statue: 0x3c3a3a, statueLight: 0x444140, statueDark: 0x363434, statueEye: 0x1a1818, plinth: 0x3a2a22,
  spike: 0x152659, spikeStud: 0x22357a,
  block: 0x7a7a3a, blockDark: 0x5e5e2a, blockStud: 0x9a9a52,
  step: 0x6e5034, stepDark: 0x3e2c1c,
  water: 0x1c2c4a,
  sconce: 0x2a2018, lamp: 0xffb060,
};

// Props and characters (1/16 tile voxels). Names are ours.
export const PROP = {
  flowerRed: 0xf0463c, flowerYellow: 0xffd83a, flowerWhite: 0xfafafa, flowerCenter: 0xffb020, stem: 0x277a30,
  potClay: 0xc8784a, potClayLo: 0xa05a34, potInside: 0x3a2418,
  chestWood: 0x9a5a2a, chestWoodLo: 0x74421e, chestGold: 0xe6b43a, chestDark: 0x3a2418,
  brazier: 0x4a4c5c, brazierInside: 0x2a1a10,
  flameCore: 0xfff2b0, flame: 0xffb640, flameOuter: 0xff6a1e,
  signWood: 0xc08a52, signWoodLo: 0x9a6a3a, signPost: 0x8a5a30, signInk: 0x5a3a20,
  stone: 0xb4b2ac, stoneLo: 0x8e8c88, stoneDark: 0x6a6966,
  doorWood: 0x7a4a26, doorWoodDark: 0x5e371b, doorIron: 0x3a3a44, doorGold: 0xe6b43a,
};

// The M1 colour table, kept so tiles written against it still build. New code uses TP, GOLD, PROP.
export const C = {
  grassA: TP.grass,
  grassB: TP.grass,
  grassDark: TP.grassDark,
  dirt: TP.soil,
  path: TP.dirt,
  sand: TP.sand,
  bed: TP.soil,
  water: 0x1f4fb0,
  trunk: TP.trunk,
  leaf: TP.leaf,
  leafLight: TP.leafLight,
  leafDark: TP.leafDark,
  rock: TP.rock,
  rockLight: TP.rock,
  moss: 0x6a9a4a,
  cliffA: TP.cliff,
  cliffB: TP.cliffDark,
  flowers: [PROP.flowerWhite, PROP.flowerYellow, PROP.flowerRed],
  bush: TP.leaf,
  bushLight: TP.leafLight,
  berry: 0xd8334a,
  under: GOLD.floorUnder,
  floorA: GOLD.floor,
  floorB: GOLD.floor,
  grout: GOLD.grout,
  brickA: GOLD.wall,
  brickB: GOLD.wallDark,
  mortar: GOLD.mortar,
  wallTop: GOLD.ledge,
  pillar: GOLD.statue,
  pillarLight: GOLD.statueLight,
  stair: GOLD.step,
  darkBed: GOLD.water,
  darkWater: 0x1f4fb0,
  wood: PROP.doorWood,
  woodDark: PROP.doorWoodDark,
  iron: PROP.doorIron,
  gold: PROP.doorGold,
  void: 0x000000,
};
