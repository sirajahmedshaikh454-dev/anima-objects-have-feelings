// Souls are generated in code, not by the LLM: free, instant and deterministic per seed.

export type Voice = { pitch: number; rate: number };
export type Soul = { name: string; traits: string[]; voice: Voice };

const TRAITS = [
  "dramatic", "sarcastic", "cheerful", "anxious", "proud", "sleepy", "nosy", "poetic", "competitive", "clingy",
  "philosophical", "grumpy", "optimistic", "theatrical", "shy", "bossy", "gossipy", "polite", "chaotic", "wise",
  "jealous", "romantic", "paranoid", "lazy", "heroic", "fussy", "flirty", "nostalgic", "punny", "zen",
];

const NAMES: Record<string, string[]> = {
  mug: ["Mugsy", "Sir Sips", "Brewster"], cup: ["Cuppy", "Teacup Tina"], pen: ["Penelope", "Inkredible Ian"],
  phone: ["Ringo", "Buzz Lightbright"], "cell phone": ["Ringo", "Buzz Lightbright"], laptop: ["Lappy", "Professor Keys"],
  book: ["Paige", "Chapter Chuck"], bottle: ["Bottleneck Bob", "Splash"], chair: ["Sitwell", "Chairlotte"],
  lamp: ["Lumière", "Glowria"], plant: ["Fernando", "Leafy Lou"], "potted plant": ["Fernando", "Leafy Lou"],
  television: ["Telly", "Screen Queen"], tv: ["Telly", "Screen Queen"], window: ["Paneful Pete", "Windy"],
  keyboard: ["Clacky", "Shift Happens"], mouse: ["Squeaks", "Clicky"], clock: ["Tick Tock Tom", "Chrono"],
  remote: ["Remo", "Channel Chad"], glass: ["Glassy Gus", "Clearly Claire"], plate: ["Plato", "Dish Dash"],
  bed: ["Snoozy", "Duvet Dave"], "dining table": ["Tabitha", "Sir Dines-a-lot"], vase: ["Vasey", "Bloom Boss"],
  dog: ["Barkley", "Sir Woofs"], cat: ["Whiskers", "Purrfect Pam"], car: ["Vroomy", "Carla"], tree: ["Bark Twain", "Oakley"],
};

/** FNV-1a: small, stable string hash. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const title = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function createSoul(input: { label: string; ocrText?: string; color?: string | null; seed: string }): Soul {
  const h = hash(`${input.label}|${input.ocrText ?? ""}|${input.color ?? ""}|${input.seed}`);
  const pick = <T,>(arr: T[], salt: number) => arr[hash(`${h}:${salt}`) % arr.length];
  const pool = NAMES[input.label];
  const fallback = [`${title(input.label)}y`, `Sir ${title(input.label)}`, `${input.color ? title(input.color) + " " : "Little "}${title(input.label)}`];
  const name = pool ? pick(pool, 1) : pick(fallback, 1);
  const traits: string[] = [];
  for (let salt = 2; traits.length < 3; salt++) {
    const t = pick(TRAITS, salt);
    if (!traits.includes(t)) traits.push(t);
  }
  const voice = { pitch: 0.6 + (hash(`${h}:p`) % 100) / 100, rate: 0.85 + (hash(`${h}:r`) % 40) / 100 };
  return { name, traits, voice };
}
