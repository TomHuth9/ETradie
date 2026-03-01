const TRADE_CATEGORIES = [
  { id: 'PLUMBING', label: 'Plumbing' },
  { id: 'ELECTRICAL', label: 'Electrical' },
  { id: 'PAINTING_DECORATING', label: 'Painting & Decorating' },
  { id: 'CARPENTRY', label: 'Carpentry' },
  { id: 'ROOFING', label: 'Roofing' },
  { id: 'PLASTERING', label: 'Plastering' },
  { id: 'TILING', label: 'Tiling' },
  { id: 'FLOORING', label: 'Flooring' },
  { id: 'HEATING_BOILERS', label: 'Heating & Boilers' },
  { id: 'GARDENING_LANDSCAPING', label: 'Gardening & Landscaping' },
  { id: 'CLEANING', label: 'Cleaning' },
  { id: 'REMOVALS', label: 'Removals' },
  { id: 'BUILDING_CONSTRUCTION', label: 'Building & Construction' },
  { id: 'LOCKSMITH', label: 'Locksmith' },
  { id: 'OTHER_NOT_SURE', label: 'Other / Not Sure' },
];

// GET /trades/categories
async function listTradeCategories(_req, res) {
  res.json(TRADE_CATEGORIES);
}

module.exports = {
  listTradeCategories,
  TRADE_CATEGORIES,
};

