// TUNING section owned by the overworld stream: money (gameplay spec 8.5, 10).

export const economy = {
  walletMax: 9999,
  coins: [1, 10, 100],
  bossPay: [250, 360, 750, 1000, 1400, 1800],
  upgrade: 200,
  coloredKey: 1000,
  well: 20,
  inn: [10, 20, 40],
  // Brannoc's prices for the Squire Blade's smith levels (fun audit: coins
  // bought nothing). Flat per level (game/swords.js prices a stat, not a
  // level), so the ladder from length through strength is the escalation.
  smith: { length: 40, width: 55, strength: 90 },
  smithBudget: 40 * 4 + 55 * 4 + 90 * 3, // every level of every sold stat, once
  bombRefill: { amount: 10, price: 15 }, // 10 more bombs, once the bag is owned
};
