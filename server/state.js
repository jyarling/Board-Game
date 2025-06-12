const boardData = require('../data/board.json');
const BOARD_SIZE = boardData.spaces.length;
const PROPERTY_INFO = boardData.spaces.map(s => ({
  price: s.price || 0,
  group: s.group,
  houseCost: s.houseCost,
  rentTable: s.rentTable,
  railroad: s.railroad,
  utility: s.utility
}));
const SPACE_NAMES = boardData.spaces.map(s => s.name);

module.exports = {
  BOARD_SIZE,
  PROPERTY_INFO,
  SPACE_NAMES,
  players: [],
  propertyOwners: Array(BOARD_SIZE).fill(null),
  propertyMortgaged: Array(BOARD_SIZE).fill(false),
  propertyHouses: Array(BOARD_SIZE).fill(0),
  currentTurn: 0,
  trades: [],
  currentAuction: null,
  turnTimer: null
};
