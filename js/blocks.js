// Block type definitions shared across the game.
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6, WATER = 7;
export const SNOWY_GRASS = 8, SNOW = 9, CACTUS = 10, BIRCH = 11, BIRCH_LEAVES = 12, GRAVEL = 13;
export const COAL_ORE = 14, IRON_ORE = 15, GOLD_ORE = 16, DIAMOND_ORE = 17;
export const PLANKS = 18, COBBLE = 19, SANDSTONE = 20, BEDROCK = 21;

export const SLOT_TYPES = [GRASS, DIRT, STONE, WOOD, PLANKS, COBBLE, SAND, SNOW, CACTUS];
export const SLOT_NAMES = ['Grass', 'Dirt', 'Stone', 'Wood', 'Planks', 'Cobble', 'Sand', 'Snow', 'Cactus'];

export const PART_COL = {
  [GRASS]: 0x55aa44, [DIRT]: 0x8b5a2b, [STONE]: 0x888888, [WOOD]: 0xaa7733,
  [LEAVES]: 0x2e8b2e, [SAND]: 0xd8ce96, [SNOWY_GRASS]: 0xddeeee, [SNOW]: 0xeeeeee,
  [CACTUS]: 0x3a7a33, [BIRCH]: 0xd8d5c8, [BIRCH_LEAVES]: 0x77bb55, [GRAVEL]: 0x8a8a8a,
  [COAL_ORE]: 0x555555, [IRON_ORE]: 0xb08c64, [GOLD_ORE]: 0xd2aa28, [DIAMOND_ORE]: 0x50dcdc,
  [PLANKS]: 0xa08050, [COBBLE]: 0x777777, [SANDSTONE]: 0xd6c98f, [BEDROCK]: 0x333333,
};

// Atlas tiles (8 per row):
// 0 grass top, 1 grass side, 2 dirt, 3 stone, 4 log side, 5 log top, 6 leaves, 7 sand
// 8 water, 9 snow, 10 snowy grass side, 11 cactus, 12 birch side, 13 birch leaves, 14 gravel, 15 coal ore
// 16 iron ore, 17 gold ore, 18 diamond ore, 19 planks, 20 cobble, 21 sandstone, 22 bedrock
const FACETILES = {
  [GRASS]: { top: 0, side: 1, bottom: 2 },
  [DIRT]: { all: 2 },
  [STONE]: { all: 3 },
  [WOOD]: { top: 5, side: 4, bottom: 5 },
  [LEAVES]: { all: 6 },
  [SAND]: { all: 7 },
  [WATER]: { all: 8 },
  [SNOWY_GRASS]: { top: 9, side: 10, bottom: 2 },
  [SNOW]: { all: 9 },
  [CACTUS]: { all: 11 },
  [BIRCH]: { top: 5, side: 12, bottom: 5 },
  [BIRCH_LEAVES]: { all: 13 },
  [GRAVEL]: { all: 14 },
  [COAL_ORE]: { all: 15 },
  [IRON_ORE]: { all: 16 },
  [GOLD_ORE]: { all: 17 },
  [DIAMOND_ORE]: { all: 18 },
  [PLANKS]: { all: 19 },
  [COBBLE]: { all: 20 },
  [SANDSTONE]: { all: 21 },
  [BEDROCK]: { all: 22 },
};

export function tileFor(t, dir) {
  const f = FACETILES[t];
  if (f.all !== undefined) return f.all;
  if (dir[1] === 1) return f.top;
  if (dir[1] === -1) return f.bottom;
  return f.side;
}
