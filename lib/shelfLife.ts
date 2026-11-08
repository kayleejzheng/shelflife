// Rough shelf life in days. Add foods your team buys.
const DAYS: Record<string, number> = {
  milk: 7, egg: 21, bread: 5, bagel: 5, muffin: 4, croissant: 3, tortilla: 14,
  banana: 5, apple: 21, berr: 4, grape: 7, orange: 21, lemon: 21, lime: 21, mango: 5,
  avocado: 4, peach: 5, pear: 7, melon: 7, pineapple: 5,
  chicken: 2, beef: 3, pork: 3, turkey: 3, fish: 2, salmon: 2, shrimp: 2, bacon: 7,
  yogurt: 14, cheese: 21, cheddar: 21, butter: 30, cream: 10, hummus: 7, salsa: 14,
  lettuce: 5, spinach: 5, kale: 5, tomato: 7, onion: 30, garlic: 60, potato: 30,
  carrot: 21, broccoli: 5, pepper: 7, cucumber: 7, zucchini: 7, mushroom: 5, corn: 5,
  rice: 365, pasta: 365, cereal: 180, oat: 365, bean: 365, flour: 365, sugar: 730,
  popcorn: 60, chip: 60, cracker: 90, cookie: 14, granola: 120, 'peanut butter': 120,
  pizza: 90, frozen: 90, juice: 10, soda: 270, water: 365, coffee: 180, tea: 365,
};

export function estimateExpiry(name: string): string {
  const lower = name.toLowerCase();
  // longest keys first, so "pineapple" beats "apple" and "peanut butter" beats "butter"
  const match = Object.keys(DAYS)
    .sort((a, b) => b.length - a.length)
    .find((food) => lower.includes(food));
  const days = match ? DAYS[match] : 7;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
