// ShelfLife scan-receipt Edge Function.
// Paste this whole file into Supabase -> Edge Functions -> scan-receipt -> code, then Deploy.
// Returns { items, skipped, rawText }. `skipped` powers the "Skipped" box on the Review screen.

// ---------- Name cleanup ----------
const ABBREVIATIONS: Record<string, string> = {
  BBRY: 'Blueberry', BLUBRY: 'Blueberry', STRWBRY: 'Strawberry', STRAWB: 'Strawberry',
  RASP: 'Raspberry', BNNA: 'Banana', BAN: 'Banana', APPL: 'Apple', GRPS: 'Grapes',
  AVO: 'Avocado', AVOC: 'Avocado', TOM: 'Tomato', TOMS: 'Tomatoes', POT: 'Potato',
  ONN: 'Onion', LETT: 'Lettuce', SPNCH: 'Spinach', CUC: 'Cucumber', CRT: 'Carrot',
  CRTS: 'Carrots', PPR: 'Pepper', VEG: 'Vegetable', VEGS: 'Vegetables', MNGO: 'Mango',
  WHL: 'Whole', MLK: 'Milk', CHS: 'Cheese', CHED: 'Cheddar', MOZZ: 'Mozzarella',
  YGRT: 'Yogurt', YOG: 'Yogurt', GRK: 'Greek', BTR: 'Butter', CRM: 'Cream',
  SR: 'Sour', CRMR: 'Creamer', OJ: 'Orange Juice', JC: 'Juice',
  CHKN: 'Chicken', CHK: 'Chicken', BRST: 'Breast', BNLS: 'Boneless', SKNLS: 'Skinless',
  GRND: 'Ground', BF: 'Beef', TRKY: 'Turkey',
  BRD: 'Bread', WHT: 'Wheat', WW: 'Whole Wheat', MUFF: 'Muffin', MFN: 'Muffin',
  CKIE: 'Cookie', CKIES: 'Cookies', CRKR: 'Cracker', CRKRS: 'Crackers',
  CHP: 'Chip', CHPS: 'Chips', CHOC: 'Chocolate', VAN: 'Vanilla', PB: 'Peanut Butter',
  RCE: 'Rice', BRWN: 'Brown', SPGH: 'Spaghetti', SCE: 'Sauce', SAUC: 'Sauce',
  FRZ: 'Frozen', FZN: 'Frozen', PZA: 'Pizza', PZZ: 'Pizza',
  ORG: 'Organic', LG: 'Large', SM: 'Small', DZ: 'Dozen',
  SDA: 'Soda', WTR: 'Water', SPRK: 'Sparkling', CFE: 'Coffee',
};

const DROP_TOKENS = new Set([
  'MP', 'GV', 'KS', 'HEB', 'KRO', 'KRG', 'SB', 'MM', 'GG', 'TJ',
  'NF', 'TF', 'EA', 'CT', 'PK', 'PKG', 'BAG', 'XTRA',
]);

const SIZE_TOKEN = /^\d+(\.\d+)?(OZ|LB|LBS|CT|PK|GAL|ML|L|G|KG|FL|QT|PT|X)?$/;

function titleCase(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// Returns the cleaned name and whether we actually recognized anything in it
function cleanName(raw: string): { name: string; confident: boolean } {
  const tokens = raw.toUpperCase().replace(/[^A-Z0-9.\s]/g, ' ').split(/\s+/).filter(Boolean);
  let confident = false;
  const words = tokens
    .filter((t) => t.length > 1 && !DROP_TOKENS.has(t) && !SIZE_TOKEN.test(t))
    .map((t) => {
      if (ABBREVIATIONS[t]) {
        confident = true;
        return ABBREVIATIONS[t];
      }
      if (t.length >= 5 && /[AEIOU]/.test(t)) confident = true; // a real-looking word like POPCORN
      return titleCase(t);
    });
  const name = words.join(' ').trim();
  return { name: name || titleCase(raw.trim()), confident };
}

// ---------- Receipt parsing ----------
const STOP_LINE = /^(sub\s*total|subtotal|total|balance due|amount due)\b/i;
const NON_FOOD = /(gift\s*card|payment|tender|refund|coupon|discount|saving|you saved|reward|points|member|bag fee|paper bag|plastic bag|deposit|approval|approved|\bauth\b|\bref\b|\b(visa|mastercard|amex|debit|credit|card|cash|change|tax|tip|balance|bag)\b)/i;
const PRICE_ONLY = /^\$?\d+\.\d{2}\s*-?\s*[A-Z]{0,2}$/;
const ITEM_LINE = /^(.+?)\s+\$?(\d+\.\d{2})\s*-?\s*[A-Z]{0,2}$/;

type Item = { name: string; rawName: string; price: number };
type Skipped = { name: string; reason: 'Non-food' | 'Not sure'; suggestion?: string };

function parseReceipt(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\t+/g, ' ').trim()).filter(Boolean);
  const items: Item[] = [];
  const skipped: Skipped[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (STOP_LINE.test(line)) break;

    if (!/\d+\.\d{2}/.test(line) && i + 1 < lines.length && PRICE_ONLY.test(lines[i + 1])) {
      line = `${line} ${lines[i + 1]}`;
      i++;
    }

    const match = line.match(ITEM_LINE);
    if (!match) continue;

    const rawName = match[1]
      .replace(/\b\d{4,}\b/g, '')
      .replace(/\b\d+\s*@\s*\$?\d+\.\d{2}\b/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (rawName.replace(/[^a-z]/gi, '').length < 3) continue;

    if (NON_FOOD.test(rawName)) {
      skipped.push({ name: titleCase(rawName), reason: 'Non-food' });
      continue;
    }

    const { name, confident } = cleanName(rawName);
    if (!confident) {
      skipped.push({ name: rawName, reason: 'Not sure', suggestion: name });
      continue;
    }
    items.push({ name, rawName, price: Number(match[2]) });
  }

  return { items, skipped };
}

Deno.serve(async (req) => {
  try {
    const { imageBase64 } = await req.json();

    const form = new FormData();
    form.append('base64Image', `data:image/jpeg;base64,${imageBase64}`);
    form.append('language', 'eng');
    form.append('OCREngine', '2');
    form.append('isTable', 'true');
    form.append('scale', 'true');
    form.append('detectOrientation', 'true');

    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: Deno.env.get('OCR_SPACE_KEY') ?? '' },
      body: form,
    });
    const data = await res.json();

    if (data.IsErroredOnProcessing) {
      return new Response(JSON.stringify({ error: data.ErrorMessage?.[0] ?? 'OCR failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const text: string = data.ParsedResults?.[0]?.ParsedText ?? '';
    const { items, skipped } = parseReceipt(text);

    return new Response(JSON.stringify({ items, skipped, rawText: text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
