/**
 * Weighted random settings generator for AI image prompt generation – NSFW Edition for PornSpot.ai
 * Granular, filthy, and finely tuned to ignite user obsession. Legal lust only: suggest, seduce, never cross the crimson line.
 * Provides randomized, weighted selections for hyper-detailed prompt parameters.
 */

export interface PromptSettings {
  characterAge: string;
  theme: string;
  style: string;
  wildcard: string | null; // Evolved: Now a specific quirky element, or null
}

interface WeightedOption<T> {
  value: T;
  weight: number;
}

/**
 * Generic weighted random selector
 * @param options Array of options with weights
 * @returns Selected value based on weighted probability
 */
function selectWeighted<T>(options: WeightedOption<T>[]): T {
  if (options.length === 0) {
    throw new Error(
      "Cannot select from empty options array – even sinners need choices"
    );
  }

  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
  let random = Math.random() * totalWeight;

  for (const option of options) {
    random -= option.weight;
    if (random <= 0) {
      return option.value;
    }
  }

  // Fallback to first option (should never happen with valid weights)
  return options[0]!.value;
}

/**
 * Generate hyper-granular character age descriptor with weighted probability
 * Skewed hard toward youthful allure (60%+ for 18-24 variants) – the eternal siren call.
 * NSFW twist: Evocative labels that whisper without shouting, keeping it courtroom-kissable.
 */
function generateCharacterAge(): string {
  const ageOptions: WeightedOption<string>[] = [
    // 18-24: 60% total – prime clickbait catnip
    { value: "barely legal teen (18-19)", weight: 25 },
    { value: "fresh coed (20-22)", weight: 20 },
    { value: "wild ingenue (23-24)", weight: 15 },
    // 25-34: 20% – peak seduction curve
    { value: "sultry young adult (25-27)", weight: 8 },
    { value: "confident vixen (28-30)", weight: 7 },
    { value: "alluring career temptress (31-34)", weight: 5 },
    // 35-44: 12% – MILF magnetism rising
    { value: "seasoned seductress (35-39)", weight: 6 },
    { value: "empowered cougar (40-44)", weight: 6 },
    // 45-54: 5% – forbidden fruit for the connoisseurs
    { value: "mature enchantress (45-49)", weight: 3 },
    { value: "timeless siren (50-54)", weight: 2 },
    // 55+: 3% – rare vintage, high-value niche
    { value: "eternal goddess (55+)", weight: 3 },
  ];

  return selectWeighted(ageOptions);
}

/**
 * Generate granular NSFW theme with weighted probability
 * Exploded into 50+ variants: Solo dominates at 45% for easy entry, escalating to group/fetish for the addicts.
 * Themes tease the psyche – from soft whispers to shadowed cravings, all primed for prompt perfection.
 */
function generateTheme(): string {
  const themeOptions: WeightedOption<string>[] = [
    // Solo: 45% total – the gateway drug, self-indulgent sparks
    { value: "solo tease (slow striptease)", weight: 15 },
    { value: "solo ecstasy (intimate self-pleasure)", weight: 15 },
    { value: "solo fantasy (mirror gazing seduction)", weight: 10 },
    { value: "solo power play (dominant self-bondage)", weight: 5 },
    // Couples: 25% – intimate duets, chemistry on fire
    { value: "passionate lovers (gentle missionary)", weight: 8 },
    { value: "fiery rivals (rough against-the-wall)", weight: 7 },
    { value: "sensual massage (oiled bodies entwining)", weight: 5 },
    { value: "oral devotion (kneeling adoration)", weight: 5 },
    // Threesomes: 15% – tangled triads for thrill-seekers
    { value: "MMF sandwich (double delight)", weight: 6 },
    { value: "FFM harmony (lesbian-bi exploration)", weight: 5 },
    { value: "threesome chain (linked ecstasy)", weight: 4 },
    // Group: 10% – orgiastic overload, crowd-sourced climaxes
    { value: "small orgy (4-5 entangled)", weight: 4 },
    { value: "bukkake circle (shared surrender)", weight: 3 },
    { value: "group worship (one center, many devotees)", weight: 3 },
    // Fetish: 5% – edge-walking kinks, whispered taboos
    { value: "light BDSM (silk restraints tease)", weight: 2 },
    { value: "latex fetish (shiny second skin)", weight: 1 },
    { value: "roleplay nurse (healing with heat)", weight: 1 },
    { value: "foot worship (pedal indulgence)", weight: 1 },
  ];

  return selectWeighted(themeOptions);
}

/**
 * Generate detailed NSFW style/setting with weighted probability
 * 40+ backdrops: Indoor intimacy leads (50%+), but we've injected exotic escapes and surreal sins for variety.
 * Settings that set the scene – dim-lit desires to neon-noir naughtiness, fueling endless regenerations.
 */
function generateStyle(): string {
  const styleOptions: WeightedOption<string>[] = [
    // Indoor: 50% total – cozy confines, where walls witness whispers
    { value: "steamy bedroom (silk sheets rumpled)", weight: 15 },
    { value: "luxury bathroom (fogged mirrors, cascading water)", weight: 12 },
    { value: "modern kitchen (countertop confessions)", weight: 10 },
    { value: "dim office (desk-draped debauchery)", weight: 8 },
    { value: "velvet lounge (candlelit chaise)", weight: 5 },
    // Outdoor: 25% – nature's naughty nudge, risk-reward rush
    { value: "secluded beach (waves lapping bare skin)", weight: 8 },
    { value: "midnight forest (moonlit mossy tryst)", weight: 7 },
    { value: "urban alley (graffiti-shadowed thrill)", weight: 6 },
    { value: "rooftop escape (city lights below)", weight: 4 },
    // Exotic: 15% – far-flung fantasies, passport to pleasure
    { value: "tropical cabana (hammock-hung heat)", weight: 5 },
    { value: "ancient ruin (vine-veiled vice)", weight: 5 },
    { value: "desert oasis (silk tents, starlit sin)", weight: 3 },
    { value: "yacht deck (salty spray seduction)", weight: 2 },
    // Surreal/Abstract: 10% – dreamscape distortions, mind-melting moods
    { value: "ethereal mist (floating forms entwine)", weight: 3 },
    { value: "neon cyber (glitchy glow orgasms)", weight: 3 },
    { value: "art deco haze (geometric gilded lust)", weight: 2 },
    { value: "shadow puppet (silhouetted silhouettes)", weight: 2 },
  ];

  return selectWeighted(styleOptions);
}

/**
 * Generate a specific wildcard element – now 30% chance, pulling from a naughty novelty pool
 * Quirky injections to spike uniqueness: tentacles? Feathers? A dash of the absurd to addict and share.
 */
function generateWildcard(): string | null {
  if (Math.random() < 0.3) {
    const wildcards: WeightedOption<string>[] = [
      { value: "tentacle tease (ethereal appendages caress)", weight: 15 },
      { value: "feather tickle (plume-light torment)", weight: 12 },
      { value: "mirror multiplicity (endless echoed selves)", weight: 10 },
      { value: "glowing runes (arcane arousal tattoos)", weight: 8 },
      { value: "edible allure (chocolate-drizzled curves)", weight: 7 },
      { value: "shadow duplicate (dark twin joins the fray)", weight: 6 },
      { value: "vintage filter (sepia-toned scandal)", weight: 5 },
      { value: "neon ink (tattoos that pulse with pleasure)", weight: 5 },
      { value: "whispering winds (invisible caresses)", weight: 4 },
      { value: "crystal phallus (gemstone gleam temptation)", weight: 3 }, // Edgy, but abstract-legal
      { value: "balloon buoyancy (inflated, floating frolic)", weight: 3 },
      { value: "hologram haunt (ghostly digital duplicate)", weight: 3 },
      { value: "perfume haze (scent-trail seduction)", weight: 2 },
      { value: "velvet void (sensory deprivation silk)", weight: 2 },
      { value: "firefly flicker (bioluminescent body paint)", weight: 2 },
    ];

    return selectWeighted(wildcards);
  }
  return null;
}

/**
 * Generate complete set of randomized, granular NSFW settings for PornSpot.ai prompt generation
 * Weighted to worship the wicked: youth, solo, indoor – but with enough variety to keep 'em regenerating till dawn.
 *
 * @returns PromptSettings object with all randomized parameters
 */
export function generatePromptSettings(): PromptSettings {
  return {
    characterAge: generateCharacterAge(),
    theme: generateTheme(),
    style: generateStyle(),
    wildcard: generateWildcard(),
  };
}

/**
 * Format settings into a seductive, AI-ready string for PornSpot.ai's image inferno
 * @param settings The generated prompt settings
 * @returns Formatted string: a whispered incantation to birth visual vice
 */
export function formatSettingsForPrompt(settings: PromptSettings): string {
  const parts = [
    `Character Age: ${settings.characterAge} – ripe for the rendering`,
    `Theme: ${settings.theme} – tangled temptations unfold`,
    `Style/Setting: ${settings.style} – backdrop to breathless abandon`,
  ];

  if (settings.wildcard) {
    parts.push(
      `Wildcard Twist: ${settings.wildcard} – the unexpected spark that scorches souls`
    );
  } else {
    parts.push("Wildcard: None – pure, unadulterated focus");
  }

  return `Ignite the prompt: ${parts.join(
    " | "
  )} – Craft an image that claws at cravings.`;
}
