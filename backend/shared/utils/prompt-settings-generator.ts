/**
 * Weighted random settings generator for AI image prompt generation
 * Provides randomized, weighted selections for detailed prompt parameters
 */

export interface PromptSettings {
  characterAge: string;
  numCharacters: number; // Synced: 1=solo self-slaughter, 2=couple collision, 3+=group gangrenous glee
  theme: string; // Locked & Laced: Themes tango with multitudes, threaded with erotic whispers – posing pretties, topless tangos, tripled to titillate
  style: string; // Exploded: 240+ scenes, boudoir to boat bashes, diversity deluge deepened
  ambiance: string; // Mood-layers – sultry glows, shadowy sins, electric edges, tripled tendrils
  pose: string; // Body-breaking to beauty-pageant bends: Instagram arches, yacht yawns, tripled twists
  clothingState: string; // From lace teases to topless tans, dripping details, tripled drapes
  wildcard: string | null; // 40% spike, quirks from cum-glints to confetti cascades, tripled tricks
  bodyModifications: string | null; // Piercings, tattoos, and other body mods for LoRA triggers
  photographyStyle: string; // Amateur vs professional photography aesthetic
  selectedLoras: string[]; // Programmatically selected LoRAs based on settings
  // New diverse characteristics for maximum prompt variation
  hairColor: string;
  hairStyle: string;
  ethnicity: string;
  eyeColor: string;
  bodyType: string;
  location: string;
  timeOfDay: string;
  weather: string | null; // For outdoor scenes
  accessories: string | null;
  makeup: string;
  expressions: string;
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
    throw new Error("Cannot select from empty options array");
  }

  const shuffled = [...options].sort(() => Math.random() - 0.5);
  const totalWeight = shuffled.reduce((sum, opt) => sum + opt.weight, 0);
  let random = Math.random() * totalWeight;

  for (const option of shuffled) {
    random -= option.weight;
    if (random <= 0) {
      return option.value;
    }
  }

  return shuffled[0]!.value;
}

/**
 * Generate character age descriptor with weighted probability
 * Skewed toward youthful demographics (60%+ for 18-24 variants)
 */
function generateCharacterAge(): string {
  const ageOptions: WeightedOption<string>[] = [
    // 18-24: 60% total – prime clickbait catnip, tripled archetypes
    { value: "barely legal teen (18-19)", weight: 8 },
    {
      value: "barely legal barista (18-19, apron askew in after-hours allure)",
      weight: 7,
    },
    {
      value: "barely legal cheerleader (18-19, pom-poms parted for pep)",
      weight: 6,
    },
    { value: "fresh coed (20-22)", weight: 6 },
    {
      value: "fresh coed sorority sister (20-22, pledge pin piercing silk)",
      weight: 5,
    },
    {
      value: "fresh coed study buddy (20-22, notes forgotten in dorm glow)",
      weight: 5,
    },
    { value: "wild ingenue (23-24)", weight: 5 },
    {
      value: "wild ingenue artist (23-24, paint-smeared canvas of curves)",
      weight: 4,
    },
    {
      value:
        "wild ingenue festival free spirit (23-24, flower crown framing flush)",
      weight: 4,
    },
    // 25-34: 20% – peak seduction curve, tripled to temptresses
    { value: "sultry young adult (25-27)", weight: 3 },
    {
      value:
        "sultry young adult yoga instructor (25-27, mat-misted in morning mist)",
      weight: 2,
    },
    {
      value:
        "sultry young adult travel vlogger (25-27, passport stamps on sun-kissed skin)",
      weight: 2,
    },
    { value: "confident vixen (28-30)", weight: 2 },
    {
      value:
        "confident vixen executive (28-30, power suit peeled in penthouse)",
      weight: 2,
    },
    {
      value: "confident vixen bartender (28-30, shaker-shaken in neon night)",
      weight: 2,
    },
    { value: "alluring career temptress (31-34)", weight: 2 },
    {
      value:
        "alluring career temptress author (31-34, quill-quiet in leather-bound lair)",
      weight: 1,
    },
    {
      value:
        "alluring career temptress dancer (31-34, spotlight-stolen in sequin sway)",
      weight: 1,
    },
    // 35-44: 12% – MILF magnetism rising, tripled matrons
    { value: "seasoned seductress (35-39)", weight: 2 },
    {
      value:
        "seasoned seductress professor (35-39, chalk-dusted in lecture lust)",
      weight: 2,
    },
    {
      value:
        "seasoned seductress winery owner (35-39, grape-stained in vineyard veil)",
      weight: 1,
    },
    { value: "empowered cougar (40-44)", weight: 2 },
    {
      value: "empowered cougar CEO (40-44, boardroom bold in bespoke bare)",
      weight: 1,
    },
    {
      value:
        "empowered cougar adventurer (40-44, trail-toughened in tented tease)",
      weight: 1,
    },
    // 45-54: 5% – forbidden fruit for the connoisseurs, tripled to 6
    { value: "mature enchantress (45-49)", weight: 1 },
    {
      value:
        "mature enchantress gallery curator (45-49, frame-framed in oil glow)",
      weight: 1,
    },
    {
      value: "mature enchantress chef (45-49, apron-applied in kitchen heat)",
      weight: 1,
    },
    { value: "timeless siren (50-54)", weight: 1 },
    {
      value: "timeless siren jazz vocalist (50-54, smoke-laced in stage smoke)",
      weight: 0.5,
    },
    {
      value: "timeless siren gardener (50-54, soil-sultry in greenhouse green)",
      weight: 0.5,
    },
    // 55+: 3% – rare vintage, tripled to 6 elixirs
    { value: "eternal goddess (55+)", weight: 1 },
    {
      value:
        "eternal goddess retired actress (55+, spotlight-scarred in silk scarves)",
      weight: 0.5,
    },
    {
      value:
        "eternal goddess bookstore owner (55+, page-perfumed in leather tomes)",
      weight: 0.5,
    },
    {
      value: "eternal goddess yogi elder (55+, mat-mastered in mountain mist)",
      weight: 0.5,
    },
    {
      value:
        "eternal goddess philanthropist (55+, gala-gowned in gemstone grace)",
      weight: 0.25,
    },
    {
      value:
        "eternal goddess beachcomber (55+, shell-strung in seaside serenity)",
      weight: 0.25,
    },
  ];

  return selectWeighted(ageOptions);
}

/**
 * Generate number of characters
 * Weighted toward solo (50%), couples (30%), groups (20%)
 */
function generateNumCharacters(): number {
  const numOptions: WeightedOption<number>[] = [
    { value: 1, weight: 50 }, // Solo supremacy
    { value: 2, weight: 30 }, // Couple chemistry
    { value: 3, weight: 15 }, // Threesome tangle
    { value: 4, weight: 5 }, // Group graze
  ];

  return selectWeighted(numOptions);
}

/**
 * Generate theme based on number of characters
 * 40% soft erotic themes, 60% explicit content
 */
function generateTheme(numChars: number): string {
  let themeOptions: WeightedOption<string>[];

  switch (numChars) {
    case 1: // Solo: Self-indulgent inferno, tripled to 30+ (40% posing poise, 60% explicit edge)
      themeOptions = [
        // Soft Erotic: 40% – 12 options
        {
          value:
            "solo instagram pose (standing model hand-on-hip, sultry gaze over shoulder)",
          weight: 4,
        },
        {
          value:
            "solo mirror selfie (bikini bottom low, arched back accentuating assets)",
          weight: 3.5,
        },
        {
          value:
            "solo yoga stretch (downward dog, fabric straining over curves)",
          weight: 3.5,
        },
        {
          value:
            "solo beach read (topless lounging, book forgotten in sun-warmed cleavage)",
          weight: 3,
        },
        {
          value:
            "solo latte linger (café curve in cropped top, steam rising slow)",
          weight: 3,
        },
        {
          value:
            "solo library lean (skirt-hiked study, pages proxy for parted thighs)",
          weight: 2.5,
        },
        {
          value:
            "solo rooftop recline (cityscape backdrop, robe-robed in breeze bite)",
          weight: 2.5,
        },
        {
          value:
            "solo kitchen tease (apron-only bake, flour-dusted décolletage)",
          weight: 2,
        },
        {
          value:
            "solo park picnic (blanket bare, fruit-fingered in dappled shade)",
          weight: 2,
        },
        {
          value:
            "solo art studio stroke (easel-edged, paintbrush proxy for pleasure)",
          weight: 1.5,
        },
        {
          value:
            "solo bubble bath scroll (phone-glow on soapy swells, suds slipping sly)",
          weight: 1.5,
        },
        {
          value:
            "solo wardrobe whirl (dress try-on twirl, mirror-mulled in lace layers)",
          weight: 1,
        },
        // Explicit Edge: 60% – 20 options with LoRA triggers
        {
          value: "solo fingering (fingers delving deep into slick folds)",
          weight: 3,
        },
        // Triggers Sextoy_Dildo_Pussy_v2_XL LoRA
        {
          value:
            "solo dildo thrust (vibrating silicone stretching tight entrance)",
          weight: 3,
        },
        {
          value:
            "solo sextoy masturbation (realistic dildo plunging into wet pussy)",
          weight: 2.5,
        },
        {
          value:
            "solo vibrator orgasm (toy buzzing against clit to squirting climax)",
          weight: 2,
        },
        {
          value: "solo clitoral rub (hooded pearl circled to quivering peak)",
          weight: 2.5,
        },
        {
          value: "solo breast knead (nipples pinched to erect crimson tips)",
          weight: 2.5,
        },
        {
          value: "solo anal probe (beaded toy teasing puckered ring)",
          weight: 2,
        },
        {
          value:
            "solo squirting climax (gushing release arcs from spasming core)",
          weight: 2,
        },
        {
          value:
            "solo nipple clamp tease (chain-tugged peaks in pain-pleasure pinch)",
          weight: 1.5,
        },
        {
          value:
            "solo vibe wand wave (buzzing head humming against hooded heat)",
          weight: 1.5,
        },
        {
          value:
            "solo mirror masturbation (reflected rub, eyes locked on own ecstasy)",
          weight: 1.5,
        },
        {
          value: "solo ice play (chilled cube trail from neck to navel notch)",
          weight: 1,
        },
        {
          value:
            "solo feather tickle (plume-light torment tracing thigh to treasure)",
          weight: 1,
        },
        {
          value:
            "solo lotion glide (oiled palms parting petals in slow spiral)",
          weight: 1,
        },
        {
          value: "solo candle wax drip (hot beads beading on breastbone bare)",
          weight: 0.8,
        },
        {
          value:
            "solo blindfold bind (sight stolen, senses sharpened to self-touch)",
          weight: 0.8,
        },
        {
          value:
            "solo edging exhale (build to brink, breath held in hovering heat)",
          weight: 0.8,
        },
        {
          value: "solo toy tandem (dual delights delving front and rear)",
          weight: 0.7,
        },
        {
          value:
            "solo orgasmic arch (back bowed, toes curled in climactic curve)",
          weight: 0.7,
        },
        {
          value:
            "solo post-climax glow (flushed form framed in afterglow haze)",
          weight: 0.7,
        },
      ];
      break;

    case 2: // Couples: Duet daggers, tripled to 30+ (40% romantic ripple, 60% raw ride)
      themeOptions = [
        // Soft Erotic: 40% – 13 options with downblouse trigger
        {
          value: "couple cuddle (spooned on silk, hands tracing lace edges)",
          weight: 4,
        },
        {
          value: "couple dance (close tango, hips swaying in syncopated tease)",
          weight: 3.5,
        },
        {
          value: "couple photoshoot (posed embrace, lips brushing collarbones)",
          weight: 3.5,
        },
        // Triggers RealDownblouseXLv3 LoRA
        {
          value:
            "couple wine share (sipping from shared glass, downblouse view of cleavage)",
          weight: 3,
        },
        {
          value:
            "couple stargaze (blanket-bound, fingers laced in lunar light)",
          weight: 3,
        },
        {
          value:
            "couple kitchen cook (aproned assist, flour fights turning flirt)",
          weight: 2.5,
        },
        {
          value:
            "couple movie night (couch-curled, popcorn proxy for parted lips)",
          weight: 2.5,
        },
        {
          value:
            "couple hike halt (trail-treed, back-to-bark in whispered want)",
          weight: 2,
        },
        {
          value:
            "couple bookstore browse (shelf-squeezed, spines proxy for spine-tinglers)",
          weight: 2,
        },
        {
          value: "couple spa soak (steam-shrouded, toes teasing under towel)",
          weight: 1.5,
        },
        {
          value:
            "couple garden groom (pruned paths, petal-pressed in private plot)",
          weight: 1.5,
        },
        {
          value:
            "couple drive-in dusk (car-seat shift, screen-glow on thigh-high trails)",
          weight: 1,
        },
        // Triggers RealDownblouseXLv3 LoRA
        {
          value:
            "couple dinner date (leaning forward, downblouse revealing lace bra)",
          weight: 1,
        },
        // Explicit Edge: 60% – 19 options with anal trigger
        {
          value:
            "missionary penetration (veiny shaft plunging into welcoming labia)",
          weight: 3,
        },
        {
          value:
            "doggy style pounding (hips slamming against quivering ass cheeks)",
          weight: 3,
        },
        // Triggers Doggystyle anal XL LoRA
        {
          value:
            "doggystyle anal sex (cock stretching tight ass, doggy position)",
          weight: 2.5,
        },
        {
          value:
            "anal doggy fuck (rear entry anal penetration, doggystyle pose)",
          weight: 2,
        },
        {
          value: "cowgirl ride (straddled grind milking rigid length)",
          weight: 2.5,
        },
        {
          value: "spooning insertion (slow slide into heated velvet grip)",
          weight: 2.5,
        },
        {
          value: "oral deepthroat (lips stretched around throbbing glans)",
          weight: 2,
        },
        {
          value: "mutual massage (oiled thumbs circling sensitive swells)",
          weight: 2,
        },
        {
          value: "standing kiss (wall-pinned, thighs parting in prelude)",
          weight: 1.5,
        },
        {
          value: "bathtub soak (bubbles bursting around intertwined limbs)",
          weight: 1.5,
        },
        { value: "69 mutual oral (heads buried in mutual munch)", weight: 1.5 },
        {
          value:
            "shower steam (water-walled, soapy slides into slick surrender)",
          weight: 1,
        },
        {
          value: "bedroom blindfold (one veiled, other voyeur in velvet void)",
          weight: 1,
        },
        {
          value:
            "kitchen counter claim (lifted legs, produce proxy for pleasure)",
          weight: 1,
        },
        {
          value:
            "balcony brink (railing-gripped, city chorus to coupled cries)",
          weight: 0.8,
        },
        {
          value: "couch conquest (reclined ravish, cushions crushed in climax)",
          weight: 0.8,
        },
        {
          value:
            "forest floor fornicate (moss-muffled moans in leaf-littered lust)",
          weight: 0.8,
        },
        {
          value:
            "car backseat tangle (windows fogged, gears grinding in tandem)",
          weight: 0.7,
        },
        {
          value: "elevator edge (halted halt, hands hasty in humming halt)",
          weight: 0.7,
        },
        {
          value:
            "post-dinner dessert (table-topped, wine-warmed in wicked wait)",
          weight: 0.7,
        },
      ];
      break;

    case 3: // Threesomes: Triad torment, tripled to 30+ (50% group glow, 50% tangle)
      themeOptions = [
        // Soft Group Erotic: 50% – 15 options
        {
          value:
            "threesome pillow fight (topless tussle, feathers flying over flushed forms)",
          weight: 3.5,
        },
        {
          value:
            "threesome spa day (steamy sauna, towels slipping in shared steam)",
          weight: 3,
        },
        {
          value:
            "threesome cocktail hour (lounging in lingerie, glasses clinking over cleavage)",
          weight: 3,
        },
        {
          value:
            "threesome photobooth (squeezed squeeze, hands wandering in frame)",
          weight: 2.5,
        },
        {
          value:
            "threesome board game (strip stakes, dice-rolled in draped defeat)",
          weight: 2.5,
        },
        {
          value:
            "threesome beach bonfire (sand-sitting circle, sparks skipping on skin)",
          weight: 2,
        },
        {
          value:
            "threesome cooking class (aproned antics, spills sultry on swells)",
          weight: 2,
        },
        {
          value:
            "threesome karaoke croon (mic-shared, harmony hushed in hip sway)",
          weight: 1.5,
        },
        {
          value:
            "threesome art jam (canvas chaos, paint-smeared in playful pat)",
          weight: 1.5,
        },
        {
          value:
            "threesome picnic prank (blanket-bound, fruit fights fruitless in flirt)",
          weight: 1.5,
        },
        {
          value:
            "threesome yoga flow (mat-mingled, poses proxy for parted peace)",
          weight: 1,
        },
        {
          value:
            "threesome movie marathon (couch-crowded, popcorn paths to thigh trails)",
          weight: 1,
        },
        {
          value:
            "threesome garden party (floral-frolic, petals proxy for private peeks)",
          weight: 1,
        },
        {
          value:
            "threesome trivia night (team-tied, buzzers buzzing with body brush)",
          weight: 0.8,
        },
        {
          value:
            "threesome stargaze share (telescope-tilted, constellations connecting curves)",
          weight: 0.8,
        },
        // Explicit Edge: 50% – 15 options
        {
          value:
            "MMF double vaginal (two cocks stretching shared slick channel)",
          weight: 3,
        },
        {
          value: "FFM strap-on peg (harnessed dildo claiming eager rear)",
          weight: 3,
        },
        {
          value: "threesome daisy chain (mouth-to-genital oral relay)",
          weight: 2.5,
        },
        {
          value:
            "threesome oil wrestle (slippery slides turning to shared shudders)",
          weight: 2.5,
        },
        {
          value:
            "threesome truth or dare (dared disrobes revealing rouged readiness)",
          weight: 2,
        },
        {
          value: "threesome jacuzzi jet (bubbles buzzing against bare bottoms)",
          weight: 2,
        },
        {
          value: "threesome blindfold pass (veiled voyeur, hands hazy in heat)",
          weight: 1.5,
        },
        {
          value:
            "threesome ice bucket tease (chilled chains circling coupled cores)",
          weight: 1.5,
        },
        {
          value:
            "threesome feather chain (plume-passed, tickles trailing to torment)",
          weight: 1.5,
        },
        {
          value: "threesome vibe share (toy-tandem, buzz bridged in body bond)",
          weight: 1,
        },
        {
          value:
            "threesome wax ritual (drips daisy-chained down dauntless skin)",
          weight: 1,
        },
        {
          value:
            "threesome mirror maze (reflected ravish, echoes endless in ecstasy)",
          weight: 1,
        },
        {
          value:
            "threesome silk bind (scarves shared, limbs laced in light restraint)",
          weight: 0.8,
        },
        {
          value:
            "threesome edible explore (body-buffet, licks linking in lust loop)",
          weight: 0.8,
        },
        {
          value:
            "threesome post-climax cuddle (glow-grouped, breaths blending in bliss)",
          weight: 0.8,
        },
      ];
      break;

    case 4: // Group: Orgy oblivion, tripled to 30+ (60% social sin, 40% swarm)
      themeOptions = [
        // Soft Group Erotic: 60% – 18 options
        {
          value:
            "group yacht party (topless sunbathing on deck, champagne sprays on swells)",
          weight: 4,
        },
        {
          value:
            "group beach volleyball (bikini malfunctions mid-spike, sand-stuck skin)",
          weight: 3.5,
        },
        {
          value:
            "group pool float (lounging links, limbs draping in lazy laps)",
          weight: 3.5,
        },
        {
          value:
            "group rooftop BBQ (apron-only grilling, smoke curling around curves)",
          weight: 3,
        },
        {
          value:
            "group art class (nude models posing, brushes tracing taboo lines)",
          weight: 3,
        },
        {
          value:
            "group glamping glow (tent-topless in firefly flicker, s'mores sticky on skin)",
          weight: 2.5,
        },
        {
          value:
            "group wine tasting (vintage veiled, sips spilling on silk shifts)",
          weight: 2.5,
        },
        {
          value: "group book club bare (page-turns proxy for parted poses)",
          weight: 2,
        },
        {
          value:
            "group festival frolic (mud-masked, body paint blooming in bass beat)",
          weight: 2,
        },
        {
          value:
            "group spa retreat (steam-shared, robes robed in relaxed reveal)",
          weight: 1.5,
        },
        {
          value:
            "group cooking contest (apron antics, spills sultry on shared swells)",
          weight: 1.5,
        },
        {
          value:
            "group karaoke chaos (mic-mingled, harmony hushed in hip-hop heat)",
          weight: 1.5,
        },
        {
          value:
            "group hike high (trail-topped, water breaks with waist-deep dips)",
          weight: 1,
        },
        {
          value:
            "group movie night mingle (couch-crammed, blankets bridging bare)",
          weight: 1,
        },
        {
          value:
            "group garden gala (floral-frolic, petals proxy for private parades)",
          weight: 1,
        },
        {
          value:
            "group trivia tournament (team-tied, buzzers buzzing body-brush)",
          weight: 0.8,
        },
        {
          value:
            "group stargaze symposium (blanket-bound, telescopes tilting to thigh trails)",
          weight: 0.8,
        },
        {
          value:
            "group craft circle (yarn-yanked, needles proxy for nipple nips)",
          weight: 0.8,
        },
        // Explicit Edge: 40% – 12 options
        {
          value:
            "gangbang rotation (one filled, others queued in veiny anticipation)",
          weight: 2.5,
        },
        {
          value: "bukkake finale (ropes of cum glazing flushed skin)",
          weight: 2.5,
        },
        {
          value: "group hot tub (entwined under eddies, hands hidden in haze)",
          weight: 2,
        },
        {
          value:
            "group masquerade (masks on, inhibitions off in velvet vortex)",
          weight: 2,
        },
        {
          value:
            "group blindfold bazaar (veiled voyeurs, passes pulsing in dark)",
          weight: 1.5,
        },
        {
          value:
            "group oil olympics (slippery sprints turning to shared slides)",
          weight: 1.5,
        },
        {
          value:
            "group feather frenzy (plume-passed, tickles to torment in tandem)",
          weight: 1.5,
        },
        {
          value: "group vibe village (toy-tribal, buzz bridged in body bazaar)",
          weight: 1,
        },
        {
          value:
            "group wax waterfall (drips daisy-chained down dauntless dunes)",
          weight: 1,
        },
        {
          value:
            "group mirror melee (reflected ravish, echoes endless in ecstasy excess)",
          weight: 1,
        },
        {
          value:
            "group silk symphony (scarves shared, limbs laced in light to loose)",
          weight: 0.8,
        },
        {
          value:
            "group edible empire (body-buffet, licks linking in lust labyrinth)",
          weight: 0.8,
        },
      ];
      break;

    default:
      themeOptions = [
        {
          value: "solo default (fingers delving deep into slick folds)",
          weight: 100,
        },
      ];
  }

  return selectWeighted(themeOptions);
}

/**
 * Generate style/setting with weighted probability
 * Indoor (40%), Outdoor (25%), Exotic (15%), Surreal (10%), Public (10%)
 */
function generateStyle(): string {
  const styleOptions: WeightedOption<string>[] = [
    // Indoor: 40% total – 24 options (representative of 96)
    {
      value: "steamy shower (water cascading over arched, soapy curves)",
      weight: 3,
    },
    {
      value: "four-poster bed (canopy-draped, sweat-slicked sheets)",
      weight: 3,
    },
    {
      value: "mirrored gym (reflected flexes in post-workout glow)",
      weight: 2.5,
    },
    {
      value: "leather armchair (reclined spread in firelit flicker)",
      weight: 2.5,
    },
    {
      value: "industrial loft (exposed beams framing chained limbs)",
      weight: 2,
    },
    {
      value: "marble bathtub (bubbles parting for submerged strokes)",
      weight: 2,
    },
    {
      value: "vintage vinyl den (record-spin sultry in scratchy static)",
      weight: 1.5,
    },
    {
      value: "cozy cabin nook (fire-crackled, quilt-quilted in quiet quiver)",
      weight: 1.5,
    },
    {
      value: "modern minimalism (white-walled, shadow-sharp in stark sin)",
      weight: 1.5,
    },
    {
      value: "bohemian boudoir (tapestry-tented, incense-infused in haze)",
      weight: 1.2,
    },
    {
      value:
        "library ladder lean (book-bound, spine-shelved in silent seduction)",
      weight: 1.2,
    },
    {
      value:
        "kitchen island idle (granite-grazed, utensil-utensiled in utensil tease)",
      weight: 1.2,
    },
    {
      value:
        "attic antique allure (dust-draped, trunk-treasured in twilight tease)",
      weight: 1,
    },
    {
      value: "basement bar banter (neon-nipped, bottle-brushed in dim dive)",
      weight: 1,
    },
    {
      value:
        "chandelier chase (crystal-caressed, light-lanced in lavish lounge)",
      weight: 1,
    },
    {
      value:
        "walk-in wardrobe whisper (mirror-mazed, silk-sorted in secret swap)",
      weight: 0.8,
    },
    {
      value:
        "home office overtime (desk-draped, screen-glow on thigh-high tease)",
      weight: 0.8,
    },
    {
      value: "laundry room linger (dryer-drummed, hamper-hid in humid heat)",
      weight: 0.8,
    },
    {
      value: "balcony boudoir (curtain-caught, city-chorus to coupled calls)",
      weight: 0.6,
    },
    {
      value: "fire escape flirt (rail-rimmed, starlit in urban underbelly)",
      weight: 0.6,
    },
    {
      value: "guest room ghost (bed-borrowed, sheet-shrouded in stranger sin)",
      weight: 0.6,
    },
    {
      value: "pantry passion (shelf-stacked, jar-jostled in jammed joy)",
      weight: 0.5,
    },
    {
      value:
        "stairwell stall (step-straddled, banister-bound in breathless break)",
      weight: 0.5,
    },
    {
      value: "garage glow (hood-humped, tool-tinkled in oily overture)",
      weight: 0.5,
    },
    // Outdoor: 25% – 15 options (representative of 60)
    {
      value: "secluded yacht deck (topless tanning, waves whispering secrets)",
      weight: 2.5,
    },
    {
      value: "moonlit meadow (grass tickling bare soles mid-thrust)",
      weight: 2,
    },
    {
      value: "hiking trail bend (tree-trunk leaned, skirt hiked high)",
      weight: 2,
    },
    {
      value: "private jacuzzi (jets pulsing against sensitive swells)",
      weight: 1.5,
    },
    {
      value: "festival field (mud-smeared skin in bonfire blaze)",
      weight: 1.5,
    },
    {
      value: "snowy cabin porch (fur rug muffling moans in frost-kissed air)",
      weight: 1.2,
    },
    {
      value: "desert dune drift (sand-sifted, star-sprinkled in silk shift)",
      weight: 1.2,
    },
    {
      value: "urban park pavilion (bench-bound, breeze-bitten in public peek)",
      weight: 1,
    },
    {
      value: "rainforest ripple (vine-veiled, mist-misted in tropical tangle)",
      weight: 1,
    },
    {
      value: "cliffside cove (rock-rimmed, wave-washed in wild whisper)",
      weight: 1,
    },
    {
      value: "vineyard vine (grape-groped, sun-soaked in harvest heat)",
      weight: 0.8,
    },
    {
      value: "lakeside lounge (dock-draped, ripple-reflected in lazy lap)",
      weight: 0.8,
    },
    {
      value: "mountain mist (peak-perched, cloud-caressed in crisp caress)",
      weight: 0.8,
    },
    {
      value: "orchard orchard (apple-angled, branch-brushed in fruity flirt)",
      weight: 0.6,
    },
    {
      value: "campsite crackle (tent-tied, fire-flicked in forest frolic)",
      weight: 0.6,
    },
    // Exotic: 15% – 9 options (representative of 36)
    {
      value: "silk-sheeted harem (cushions cradling oiled, entwined forms)",
      weight: 1.5,
    },
    {
      value: "volcanic hot spring (steam-shrouded, mineral-slicked skin)",
      weight: 1.5,
    },
    {
      value: "bamboo jungle hut (lantern glow on sweat-beaded brows)",
      weight: 1.2,
    },
    {
      value: "private jet cabin (turbulence-timed, mile-high mile)",
      weight: 1.2,
    },
    {
      value: "ancient temple tryst (stone-silent, idol-eyed in incense idol)",
      weight: 1,
    },
    {
      value: "sahara silk (dune-draped, nomad-nuzzled in night nomad)",
      weight: 1,
    },
    {
      value: "tokyo tub (onsen-overflow, steam-silent in city soak)",
      weight: 1,
    },
    {
      value: "parisian patio (eiffel-edged, bistro-buzzed in boulevard bare)",
      weight: 0.8,
    },
    {
      value: "rio rooftop (carnival-caught, samba-swayed in salty sin)",
      weight: 0.8,
    },
    // Surreal/Abstract: 10% – 6 options (representative of 24)
    {
      value: "liquid mirror pool (reflections rippling with every ripple)",
      weight: 1,
    },
    {
      value: "crystal cavern (faceted walls amplifying echoed gasps)",
      weight: 1,
    },
    {
      value: "floating orb chamber (zero-g twirls in velvet void)",
      weight: 0.8,
    },
    {
      value: "ink-blot dreamscape (shapes shifting from tease to torrent)",
      weight: 0.8,
    },
    {
      value: "quantum quilt (parallel poses pulsing in probabilistic play)",
      weight: 0.6,
    },
    {
      value: "nebula nest (star-strewn, cosmic-caressed in galaxy glow)",
      weight: 0.6,
    },
    // Public Risk: 10% – 6 options (representative of 24)
    {
      value: "crowded elevator (hands wandering under hem in descent)",
      weight: 1,
    },
    {
      value: "beach cabana flap (half-hidden humps in sea-spray haze)",
      weight: 1,
    },
    {
      value: "library stacks (whispered whimpers between dusty tomes)",
      weight: 0.8,
    },
    {
      value: "coffee shop corner (skirt up under table, steam rising double)",
      weight: 0.8,
    },
    {
      value: "subway sway (straphang sultry, jolt-jostled in jostle tease)",
      weight: 0.6,
    },
    {
      value: "gallery gaze (art-angled, frame-framed in cultured caress)",
      weight: 0.6,
    },
  ];

  return selectWeighted(styleOptions);
}

/**
 * Generate ambiance/lighting
 * Warm (55%), Dramatic (20%), Frenzied (15%), Ethereal (10%)
 */
function generateAmbiance(): string {
  const ambianceOptions: WeightedOption<string>[] = [
    // Warm Intimate: 55% – 16 options (representative of 74)
    {
      value: "candlelit haze (flickering shadows dancing on dewy skin)",
      weight: 2,
    },
    {
      value: "golden hour filter (sunset rays gilding arched hips)",
      weight: 1.8,
    },
    {
      value: "fireplace ember glow (orange warmth pooling in cleavage)",
      weight: 1.6,
    },
    {
      value: "moonbeam silver (lunar lace tracing thigh-high trails)",
      weight: 1.4,
    },
    {
      value: "lantern amber (soft orbs illuminating parted lips)",
      weight: 1.2,
    },
    { value: "harvest moon honey (amber arcs on autumn ache)", weight: 1 },
    {
      value: "dawn blush (rosy fingers fingering first light on flesh)",
      weight: 1,
    },
    { value: "twilight teal (dusky blues bruising bare bone)", weight: 0.9 },
    {
      value: "hearth honey (fire-forged, honey-hued in hearth heat)",
      weight: 0.9,
    },
    {
      value: "star candle (twinkling tapers tracing tender touch)",
      weight: 0.8,
    },
    {
      value: "silk sunrise (fabric-filtered, dawn-dyed in delicate drape)",
      weight: 0.8,
    },
    {
      value: "velvet vesper (evening velvet veiling voluptuous veil)",
      weight: 0.7,
    },
    {
      value: "amber alert (warm warning, glow-gilded in guarded grace)",
      weight: 0.7,
    },
    { value: "copper caress (rust-red rays rubbing ribcage raw)", weight: 0.6 },
    {
      value: "ivory incandescence (pearl-pale, light-laced in luminous lust)",
      weight: 0.6,
    },
    {
      value: "rose reverie (floral flush, petal-pink in passionate pulse)",
      weight: 0.5,
    },
    // Dramatic Edge: 20% – 8 options (representative of 27)
    {
      value: "spotlight isolation (beam carving curves from inky black)",
      weight: 0.8,
    },
    {
      value: "thunderstorm flash (lightning cracks etching tensed torsos)",
      weight: 0.8,
    },
    {
      value: "neon underglow (pink-blue veins pulsing in cyber sin)",
      weight: 0.7,
    },
    {
      value: "silhouette backlit (outlines teasing hidden swells)",
      weight: 0.7,
    },
    {
      value: "eclipse edge (shadow-sharpened, corona-caressed in crisis crown)",
      weight: 0.6,
    },
    {
      value: "lava line (molten margin, red-rimmed in rage ripple)",
      weight: 0.6,
    },
    {
      value: "storm surge (gale-gouged, wind-whipped in wild white)",
      weight: 0.5,
    },
    {
      value: "forge fire (anvil-amber, hammer-hued in hot hammer)",
      weight: 0.5,
    },
    // Frenzied High: 15% – 4 options (representative of 20)
    {
      value: "disco strobe stutter (frozen frames of mid-moan frenzy)",
      weight: 0.6,
    },
    {
      value: "lava lamp swirl (molten colors licking lithe limbs)",
      weight: 0.6,
    },
    {
      value: "hologram flicker (glitch-trails on thrusting forms)",
      weight: 0.5,
    },
    {
      value: "firework burst (spark showers on sweat-sheened skin)",
      weight: 0.5,
    },
    // Ethereal Whisper: 10% – 2 options (representative of 14)
    {
      value: "fog machine veil (smoke curling around coupled cores)",
      weight: 0.5,
    },
    {
      value: "aurora borealis shimmer (northern lights draping nude north)",
      weight: 0.5,
    },
  ];

  return selectWeighted(ambianceOptions);
}

/**
 * Generate pose
 * Model poses (50%), Receiving (20%), Dominant (15%), Interactive (15%)
 */
function generatePose(): string {
  const poseOptions: WeightedOption<string>[] = [
    // Model Erotic: 50% – 15 options (representative of 90)
    {
      value:
        "standing instagram model (hand on hip, sultry gaze, hip cocked to curve cascade)",
      weight: 1.5,
    },
    {
      value: "seated lounge (legs crossed, décolletage dipped in shadow play)",
      weight: 1.3,
    },
    {
      value: "over-shoulder glance (hair flipped, lips parted in promise)",
      weight: 1.2,
    },
    {
      value: "yoga warrior (lunged low, fabric taut over taut glutes)",
      weight: 1.1,
    },
    {
      value: "beach recline (propped on elbows, sun-kissed cleavage arched)",
      weight: 1,
    },
    {
      value: "poolside perch (towel-tossed, legs languid in lounge line)",
      weight: 0.9,
    },
    {
      value: "city strut (street-sashay, heel-clicked in urban undulate)",
      weight: 0.9,
    },
    {
      value: "forest frame (tree-trunked, leaf-laced in natural nook)",
      weight: 0.8,
    },
    {
      value: "mirror mimic (self-shadowed, pose-played in reflective ruse)",
      weight: 0.8,
    },
    {
      value: "sofa slouch (cushion-curled, knee-knocked in casual crook)",
      weight: 0.7,
    },
    {
      value: "stair sulk (step-sprawled, rail-rubbed in descending desire)",
      weight: 0.7,
    },
    {
      value: "window wist (glass-gazed, light-limned in silhouette sin)",
      weight: 0.6,
    },
    {
      value: "bed bend (pillow-propped, sheet-shifted in sleepy stretch)",
      weight: 0.6,
    },
    {
      value: "chair char (perched pretty, leg-lifted in lace lift)",
      weight: 0.5,
    },
    {
      value: "floor flop (rug-rolled, arm-arched in abandon arc)",
      weight: 0.5,
    },
    // Receiving: 20% – 5 options (representative of 36)
    {
      value: "spread eagle (thighs parted wide, labia inviting inspection)",
      weight: 0.8,
    },
    { value: "on all fours (ass up, back arched for rear entry)", weight: 0.7 },
    {
      value: "legs over shoulders (folded deep for cervical kiss)",
      weight: 0.7,
    },
    {
      value: "lotus wrap (entwined straddle, grinding to the hilt)",
      weight: 0.6,
    },
    {
      value: "prone bone (flat press, cheeks spread by thrusting weight)",
      weight: 0.6,
    },
    // Dominant: 15% – 5 options (representative of 27)
    { value: "reverse cowgirl (back-turned bounce on rigid rod)", weight: 0.6 },
    {
      value: "standing wheelbarrow (lifted legs, pounded from behind)",
      weight: 0.5,
    },
    {
      value: "amazon position (pinned beneath, sheathing with savage sway)",
      weight: 0.5,
    },
    {
      value: "face-sit smother (throne of thighs, tongue-tied tribute)",
      weight: 0.4,
    },
    {
      value: "peg power (strapped strong, rear-ravished in role reverse)",
      weight: 0.4,
    },
    // Interactive/Exotic: 15% – 5 options (representative of 27)
    { value: "69 mutual oral (heads buried in mutual munch)", weight: 0.6 },
    { value: "scissoring shear (labia locked in slippery slide)", weight: 0.5 },
    {
      value: "tribadism grind (clit-to-clit clash in heated hover)",
      weight: 0.5,
    },
    {
      value: "handjob tease (fisted shaft stroked to spurting salute)",
      weight: 0.4,
    },
    {
      value: "bridge arch (hips hoisted high, core exposed in curve)",
      weight: 0.4,
    },
  ];

  return selectWeighted(poseOptions);
}

/**
 * Generate clothing state
 * Partial (40%), Nude (30%), Kinky (30%)
 * Triggers LoRAs: Harness_Straps_sdxl, bdsm_SDXL_1_, nudify_xl_lite
 */
function generateClothingState(): string {
  const clothingOptions: WeightedOption<string>[] = [
    // Partial Tease: 40% – 12 options (representative of 42)
    {
      value: "sheer lace lingerie (nipples tenting translucent veil)",
      weight: 1.2,
    },
    {
      value: "open blouse unbuttoned (breasts spilling from silk confines)",
      weight: 1.1,
    },
    {
      value: "thigh-high stockings (garters snapping against bare mound)",
      weight: 1,
    },
    {
      value: "crotchless panties (access slit framing swollen folds)",
      weight: 1,
    },
    {
      value: "half-unzipped dress (cleavage canyon to navel notch)",
      weight: 0.9,
    },
    {
      value: "sheer robe slip (silk-sheer, shoulder-slid in subtle show)",
      weight: 0.9,
    },
    {
      value: "crop top ride-up (underboob flash in casual crook)",
      weight: 0.8,
    },
    {
      value: "side-slit skirt (thigh-thieved, stride-straddled in slit sin)",
      weight: 0.8,
    },
    {
      value: "lace bralette peek (cup-caught, strap-snapped in lace lure)",
      weight: 0.7,
    },
    {
      value: "fishnet arm warmers (sleeve-sheathed, elbow-edged in net naught)",
      weight: 0.7,
    },
    {
      value:
        "choker chain tease (neck-nipped, pendant-pendulous in pulse point)",
      weight: 0.6,
    },
    {
      value: "glove graze (elbow-length, finger-fingered in fabric flirt)",
      weight: 0.6,
    },
    // Full Nude/Topless: 30% – 9 options (representative of 31)
    // Triggers nudify_xl_lite LoRA
    {
      value: "completely nude (every inch exposed, glistening in gloss)",
      weight: 0.9,
    },
    {
      value: "topless only (bottoms low, breasts basking in breeze)",
      weight: 0.9,
    },
    {
      value: "post-strip pile (discarded denim at ankle, free for the feast)",
      weight: 0.8,
    },
    {
      value: "shower-fresh bare (water droplets beading on unshaven bush)",
      weight: 0.8,
    },
    { value: "bikini slip (string untied, teasing tan lines)", weight: 0.7 },
    {
      value: "sarong slip (tied loose, parting at thigh for sea-spray peek)",
      weight: 0.7,
    },
    {
      value: "thong tan (backstring vanishing into sun-sunk cheeks)",
      weight: 0.6,
    },
    {
      value: "wrap unravel (fabric-freed, wind-whipped in wild unwrap)",
      weight: 0.6,
    },
    {
      value: "veil vanish (gossamer gone, ghost-gauzed in graceful gone)",
      weight: 0.5,
    },
    // Kinky Layer: 30% – 12 options (representative of 32)
    // Triggers Harness_Straps_sdxl and bdsm_SDXL_1_ LoRAs
    {
      value: "leather harness crisscross (straps biting into bound breasts)",
      weight: 0.9,
    },
    {
      value: "fishnet bodysuit torn (rips revealing rouged areolas)",
      weight: 0.9,
    },
    {
      value: "cupless bra (breasts framed and exposed by underwire)",
      weight: 0.85,
    },
    {
      value: "garter belt straps (clips stretching down thighs)",
      weight: 0.8,
    },
    {
      value: "body harness straps (leather bands crisscrossing torso)",
      weight: 0.8,
    },
    {
      value: "rope bondage ties (intricate shibari binding breasts)",
      weight: 0.75,
    },
    {
      value: "collar and cuffs only (velvet choker, wristlets for the yank)",
      weight: 0.7,
    },
    {
      value: "oil-slicked transparency (body paint posing as second skin)",
      weight: 0.7,
    },
    {
      value: "chainmail chemise (link-laced, clink-clashed in metal mesh)",
      weight: 0.6,
    },
    {
      value: "corset cinch (waist-whittled, lace-laced in breath-bound bind)",
      weight: 0.6,
    },
    {
      value: "garter grip (stocking-snapped, thigh-throttled in tension tease)",
      weight: 0.5,
    },
    {
      value: "hologram harness (digital drapes dissolving in data)",
      weight: 0.4,
    },
  ];

  return selectWeighted(clothingOptions);
}

/**
 * Generate optional wildcard element (40% chance)
 */
function generateWildcard(): string | null {
  if (Math.random() < 0.4) {
    const wildcards: WeightedOption<string>[] = [
      {
        value: "cum-glazed thighs (sticky trails from spent surrender)",
        weight: 0.8,
      },
      {
        value: "vibrating egg remote (buzz synced to building bliss)",
        weight: 0.7,
      },
      { value: "mirror multiplicity (infinite echoed erections)", weight: 0.7 },
      { value: "edible body paint (lickable landscapes of lust)", weight: 0.6 },
      {
        value: "shadow puppet play (dark hands puppeteering pale flesh)",
        weight: 0.6,
      },
      {
        value: "neon body glow (uv tattoos tracing tribal temptations)",
        weight: 0.5,
      },
      {
        value: "feather flogger tease (soft sting raising red welts)",
        weight: 0.5,
      },
      {
        value: "ice cube trail (chilled paths melting into molten heat)",
        weight: 0.5,
      },
      {
        value: "hologram overlay (digital doppelganger doubles the deed)",
        weight: 0.4,
      },
      {
        value: "perfume pheromone mist (scent-laced air thick with need)",
        weight: 0.4,
      },
      {
        value: "velvet blindfold slip (sight stolen, senses sharpened sharp)",
        weight: 0.4,
      },
      {
        value: "firefly biolum (glowing veins mapping mid-climax map)",
        weight: 0.3,
      },
      {
        value: "crystal nipple clamps (gem-pinched peaks in prism pain)",
        weight: 0.3,
      },
      {
        value: "balloon restraint pop (inflated bonds bursting at brink)",
        weight: 0.3,
      },
      {
        value: "whispering silk scarves (tied teases trailing down spine)",
        weight: 0.3,
      },
      {
        value:
          "confetti cascade (party popper pearls mimicking pearl necklaces)",
        weight: 0.2,
      },
      { value: "tattoo glow-up (ink igniting with inner fire)", weight: 0.2 },
      {
        value: "wine spill streak (merlot rivulets racing down ribs)",
        weight: 0.2,
      },
      {
        value: "petal path (rose fragments framing forbidden fruit)",
        weight: 0.2,
      },
      {
        value: "smoke ring halo (cigar haze crowning crowned curves)",
        weight: 0.2,
      },
      {
        value: "vibrating vines (tentacle-tease from floral fantasy)",
        weight: 0.1,
      },
      {
        value: "quantum quills (ink-inklings in parallel page play)",
        weight: 0.1,
      },
      {
        value: "nebula nipple rings (cosmic clamps in star-strewn sting)",
        weight: 0.1,
      },
      {
        value: "glitch garland (digital drapes dissolving in data dust)",
        weight: 0.1,
      },
      {
        value: "echo earring (whisper-wired, lobe-laced in loop lure)",
        weight: 0.1,
      },
      {
        value: "frost flower (ice-etched, petal-pierced in chill charm)",
        weight: 0.1,
      },
      {
        value: "lava lace (molten mesh, heat-honeyed in fiery filigree)",
        weight: 0.1,
      },
      {
        value: "shadow silk (dark drape, light-leaked in void veil)",
        weight: 0.1,
      },
      {
        value: "aurora anklet (northern glow, chain-chilled in cosmic cuff)",
        weight: 0.1,
      },
      {
        value:
          "pixie dust pearl (fairy-flecked, skin-sprinkled in sparkle sin)",
        weight: 0.1,
      },
    ];

    return selectWeighted(wildcards);
  }
  return null;
}

/**
 * Generate body modifications (piercings, tattoos)
 * Triggers LoRAs: Pierced_Nipples_XL_Barbell_Edition-000013, Body Tattoo_alpha1.0_rank4_noxattn_last
 * 30% chance of piercings, 25% chance of tattoos, 45% no modifications
 */
function generateBodyModifications(): string | null {
  const modOptions: WeightedOption<string | null>[] = [
    { value: null, weight: 45 }, // No modifications
    // Piercings - 30% total (triggers Pierced_Nipples_XL_Barbell_Edition-000013)
    {
      value: "nipple piercings (barbell studs piercing erect peaks)",
      weight: 8,
    },
    { value: "nipple piercings (silver rings adorning rosy tips)", weight: 6 },
    { value: "nipple chain (connected piercings linking breasts)", weight: 5 },
    { value: "belly button piercing (jeweled navel ring)", weight: 4 },
    {
      value: "clit hood piercing (delicate ring on sensitive pearl)",
      weight: 3,
    },
    { value: "tongue piercing (metal stud for enhanced oral)", weight: 2 },
    { value: "multiple piercings (nipples, navel, and more)", weight: 2 },
    // Tattoos - 25% total (triggers Body Tattoo_alpha1.0_rank4_noxattn_last)
    { value: "full body tattoo (intricate ink covering curves)", weight: 5 },
    { value: "sleeve tattoos (elaborate designs wrapping arms)", weight: 4 },
    { value: "back piece tattoo (sprawling art across spine)", weight: 4 },
    { value: "thigh tattoos (sensual patterns framing legs)", weight: 3 },
    { value: "breast tattoos (delicate ink adorning cleavage)", weight: 3 },
    { value: "tribal tattoos (bold patterns across shoulders)", weight: 2 },
    { value: "lower back tattoo (decorative design above curves)", weight: 2 },
    { value: "rib cage tattoos (intricate art along torso)", weight: 2 },
  ];

  return selectWeighted(modOptions);
}

/**
 * Generate photography style
 * Triggers LoRAs: leaked_nudes_style_v1_fixed (amateur), DynaPoseV1 (professional/Instagram)
 * 60% amateur (leaked_nudes_style), 40% professional (DynaPoseV1)
 */
function generatePhotographyStyle(): string {
  const styleOptions: WeightedOption<string>[] = [
    // Amateur/Candid - 60% (triggers leaked_nudes_style_v1_fixed)
    {
      value: "amateur selfie (casual phone camera in natural setting)",
      weight: 15,
    },
    {
      value: "candid snapshot (spontaneous capture, authentic moment)",
      weight: 12,
    },
    {
      value: "leaked nudes aesthetic (intimate private photography)",
      weight: 10,
    },
    { value: "bathroom mirror selfie (steamy glass, phone-framed)", weight: 8 },
    {
      value: "bedroom amateur (soft natural light, personal space)",
      weight: 7,
    },
    { value: "vacation candid (casual travel photography vibe)", weight: 5 },
    { value: "homemade video still (authentic amateur capture)", weight: 3 },
    // Professional/Instagram - 40% (triggers DynaPoseV1)
    {
      value:
        "instagram model pose (professional composition, curated aesthetic)",
      weight: 12,
    },
    {
      value: "fashion photography (studio lighting, editorial pose)",
      weight: 10,
    },
    { value: "professional boudoir (soft focus, artistic framing)", weight: 8 },
    { value: "glamour photography (polished, magazine-quality)", weight: 5 },
    {
      value: "influencer content (social media ready, perfect angles)",
      weight: 5,
    },
  ];

  return selectWeighted(styleOptions);
}

/**
 * Generate hair color with diverse options
 * Wide variety to ensure maximum prompt variation
 */
function generateHairColor(): string {
  const hairColorOptions: WeightedOption<string>[] = [
    // Natural colors - 60%
    { value: "platinum blonde", weight: 8 },
    { value: "golden blonde", weight: 7 },
    { value: "dirty blonde", weight: 6 },
    { value: "honey blonde", weight: 5 },
    { value: "ash blonde", weight: 4 },
    { value: "light brown", weight: 6 },
    { value: "chestnut brown", weight: 6 },
    { value: "chocolate brown", weight: 5 },
    { value: "dark brown", weight: 5 },
    { value: "auburn", weight: 4 },
    { value: "copper red", weight: 4 },
    { value: "ginger", weight: 3 },
    { value: "strawberry blonde", weight: 3 },
    { value: "jet black", weight: 5 },
    { value: "raven black", weight: 4 },
    { value: "natural gray", weight: 1 },
    { value: "silver gray", weight: 1 },
    // Fantasy/dyed colors - 40%
    { value: "pastel pink", weight: 4 },
    { value: "hot pink", weight: 3 },
    { value: "rose gold", weight: 3 },
    { value: "lavender purple", weight: 3 },
    { value: "violet", weight: 2 },
    { value: "electric blue", weight: 2 },
    { value: "teal", weight: 2 },
    { value: "mint green", weight: 2 },
    { value: "peach", weight: 2 },
    { value: "burgundy", weight: 2 },
    { value: "ombre blonde to pink", weight: 2 },
    { value: "balayage highlights", weight: 3 },
    { value: "rainbow highlights", weight: 1 },
    { value: "two-tone split dye", weight: 1 },
  ];

  return selectWeighted(hairColorOptions);
}

/**
 * Generate hair style with extensive variety
 */
function generateHairStyle(): string {
  const hairStyleOptions: WeightedOption<string>[] = [
    // Long styles - 35%
    { value: "long straight flowing hair", weight: 6 },
    { value: "long wavy cascading hair", weight: 6 },
    { value: "long curly voluminous hair", weight: 5 },
    { value: "waist-length hair", weight: 3 },
    { value: "mermaid waves", weight: 3 },
    { value: "beach waves", weight: 4 },
    { value: "sleek straight hair", weight: 3 },
    { value: "tousled bedhead hair", weight: 3 },
    // Medium styles - 30%
    { value: "shoulder-length layered hair", weight: 5 },
    { value: "lob (long bob)", weight: 4 },
    { value: "shaggy medium cut", weight: 3 },
    { value: "wavy bob", weight: 4 },
    { value: "textured medium hair", weight: 3 },
    { value: "side-swept medium hair", weight: 3 },
    { value: "blunt cut shoulder-length", weight: 3 },
    // Short styles - 20%
    { value: "pixie cut", weight: 3 },
    { value: "short bob", weight: 4 },
    { value: "asymmetrical bob", weight: 2 },
    { value: "cropped hair", weight: 2 },
    { value: "undercut short hair", weight: 2 },
    { value: "buzzed sides with long top", weight: 1 },
    // Updos and styles - 15%
    { value: "messy bun", weight: 3 },
    { value: "high ponytail", weight: 3 },
    { value: "braided crown", weight: 2 },
    { value: "french braid", weight: 2 },
    { value: "fishtail braid", weight: 2 },
    { value: "half-up half-down", weight: 2 },
    { value: "space buns", weight: 1 },
    { value: "low chignon", weight: 1 },
    { value: "side braid", weight: 1 },
  ];

  return selectWeighted(hairStyleOptions);
}

/**
 * Generate ethnicity/race with global diversity
 */
function generateEthnicity(): string {
  const ethnicityOptions: WeightedOption<string>[] = [
    // European descent - 30%
    { value: "caucasian", weight: 8 },
    { value: "northern european", weight: 4 },
    { value: "mediterranean", weight: 4 },
    { value: "eastern european", weight: 3 },
    { value: "scandinavian", weight: 3 },
    { value: "irish", weight: 2 },
    { value: "italian", weight: 2 },
    { value: "spanish", weight: 2 },
    // East Asian - 20%
    { value: "japanese", weight: 6 },
    { value: "korean", weight: 5 },
    { value: "chinese", weight: 4 },
    { value: "taiwanese", weight: 2 },
    { value: "vietnamese", weight: 2 },
    { value: "thai", weight: 2 },
    // South Asian - 10%
    { value: "indian", weight: 4 },
    { value: "pakistani", weight: 2 },
    { value: "bangladeshi", weight: 1 },
    { value: "sri lankan", weight: 1 },
    // Latin American - 15%
    { value: "latina", weight: 5 },
    { value: "brazilian", weight: 4 },
    { value: "mexican", weight: 3 },
    { value: "colombian", weight: 2 },
    { value: "argentinian", weight: 1 },
    // Middle Eastern - 10%
    { value: "middle eastern", weight: 4 },
    { value: "arabic", weight: 3 },
    { value: "persian", weight: 2 },
    { value: "turkish", weight: 2 },
    // African descent - 10%
    { value: "african american", weight: 4 },
    { value: "afro-caribbean", weight: 2 },
    { value: "east african", weight: 1 },
    { value: "west african", weight: 1 },
    { value: "north african", weight: 1 },
    // Mixed/Other - 5%
    { value: "mixed race", weight: 2 },
    { value: "eurasian", weight: 1 },
    { value: "polynesian", weight: 1 },
    { value: "native american", weight: 0.5 },
  ];

  return selectWeighted(ethnicityOptions);
}

/**
 * Generate eye color with natural and rare options
 */
function generateEyeColor(): string {
  const eyeColorOptions: WeightedOption<string>[] = [
    // Common - 70%
    { value: "brown eyes", weight: 20 },
    { value: "dark brown eyes", weight: 15 },
    { value: "hazel eyes", weight: 12 },
    { value: "blue eyes", weight: 10 },
    { value: "green eyes", weight: 8 },
    { value: "light blue eyes", weight: 5 },
    { value: "gray eyes", weight: 3 },
    { value: "amber eyes", weight: 2 },
    // Rare/descriptive - 30%
    { value: "honey-colored eyes", weight: 3 },
    { value: "golden brown eyes", weight: 3 },
    { value: "deep blue eyes", weight: 3 },
    { value: "emerald green eyes", weight: 2 },
    { value: "gray-blue eyes", weight: 2 },
    { value: "heterochromatic eyes", weight: 1 },
    { value: "violet-tinted eyes", weight: 0.5 },
    { value: "steel gray eyes", weight: 2 },
    { value: "olive green eyes", weight: 2 },
    { value: "bright blue eyes", weight: 2 },
  ];

  return selectWeighted(eyeColorOptions);
}

/**
 * Generate body type with realistic diversity
 */
function generateBodyType(): string {
  const bodyTypeOptions: WeightedOption<string>[] = [
    // Slim/Athletic - 40%
    { value: "slim athletic build", weight: 8 },
    { value: "toned physique", weight: 7 },
    { value: "petite frame", weight: 6 },
    { value: "lean athletic body", weight: 5 },
    { value: "slender build", weight: 4 },
    { value: "fit yoga body", weight: 4 },
    { value: "dancer's physique", weight: 2 },
    // Curvy - 30%
    { value: "curvy hourglass figure", weight: 8 },
    { value: "voluptuous curves", weight: 6 },
    { value: "thick thighs and hips", weight: 5 },
    { value: "pear-shaped body", weight: 4 },
    { value: "full-figured", weight: 3 },
    { value: "busty curvy build", weight: 4 },
    // Average/Medium - 20%
    { value: "average build", weight: 6 },
    { value: "medium frame", weight: 5 },
    { value: "natural body type", weight: 4 },
    { value: "soft curves", weight: 3 },
    { value: "balanced proportions", weight: 2 },
    // Plus size - 10%
    { value: "plus size voluptuous", weight: 4 },
    { value: "BBW (big beautiful woman)", weight: 3 },
    { value: "chubby soft body", weight: 2 },
    { value: "thick curvy build", weight: 2 },
  ];

  return selectWeighted(bodyTypeOptions);
}

/**
 * Generate location/setting with extensive variety
 */
function generateLocation(): string {
  const locationOptions: WeightedOption<string>[] = [
    // Indoor private - 35%
    { value: "luxury bedroom", weight: 6 },
    { value: "cozy bedroom", weight: 5 },
    { value: "modern bathroom", weight: 5 },
    { value: "walk-in shower", weight: 4 },
    { value: "marble bathroom", weight: 3 },
    { value: "living room couch", weight: 4 },
    { value: "home office", weight: 2 },
    { value: "walk-in closet", weight: 2 },
    { value: "private gym", weight: 2 },
    { value: "home library", weight: 1 },
    { value: "kitchen counter", weight: 3 },
    // Indoor public/semi-public - 20%
    { value: "hotel room", weight: 5 },
    { value: "luxury penthouse", weight: 4 },
    { value: "spa changing room", weight: 3 },
    { value: "boutique fitting room", weight: 3 },
    { value: "nightclub VIP area", weight: 2 },
    { value: "rooftop lounge", weight: 2 },
    { value: "art gallery", weight: 1 },
    { value: "upscale restaurant", weight: 1 },
    { value: "yoga studio", weight: 2 },
    { value: "dance studio", weight: 2 },
    // Outdoor nature - 25%
    { value: "tropical beach", weight: 6 },
    { value: "secluded beach cove", weight: 4 },
    { value: "infinity pool", weight: 5 },
    { value: "private pool", weight: 4 },
    { value: "forest clearing", weight: 2 },
    { value: "mountain cabin", weight: 2 },
    { value: "lakeside dock", weight: 2 },
    { value: "desert landscape", weight: 1 },
    { value: "waterfall grotto", weight: 2 },
    { value: "private garden", weight: 3 },
    { value: "hot spring", weight: 2 },
    // Outdoor urban - 15%
    { value: "city rooftop", weight: 4 },
    { value: "urban alleyway", weight: 2 },
    { value: "balcony overlooking city", weight: 3 },
    { value: "parking garage", weight: 1 },
    { value: "abandoned warehouse", weight: 2 },
    { value: "neon-lit street", weight: 2 },
    { value: "graffiti wall backdrop", weight: 1 },
    // Vehicles - 5%
    { value: "luxury car interior", weight: 2 },
    { value: "yacht cabin", weight: 2 },
    { value: "private jet", weight: 1 },
  ];

  return selectWeighted(locationOptions);
}

/**
 * Generate time of day for lighting context
 */
function generateTimeOfDay(): string {
  const timeOptions: WeightedOption<string>[] = [
    { value: "golden hour", weight: 8 },
    { value: "late afternoon", weight: 6 },
    { value: "early morning", weight: 5 },
    { value: "midday bright light", weight: 4 },
    { value: "sunset", weight: 7 },
    { value: "blue hour twilight", weight: 5 },
    { value: "nighttime", weight: 8 },
    { value: "late night", weight: 4 },
    { value: "dawn light", weight: 3 },
    { value: "overcast day", weight: 2 },
  ];

  return selectWeighted(timeOptions);
}

/**
 * Generate weather conditions (for outdoor scenes)
 * Returns null 50% of the time for indoor scenes
 */
function generateWeather(): string | null {
  // 50% chance of no weather descriptor (indoor scenes)
  if (Math.random() < 0.5) {
    return null;
  }

  const weatherOptions: WeightedOption<string>[] = [
    { value: "clear sunny day", weight: 8 },
    { value: "partly cloudy", weight: 5 },
    { value: "light rain", weight: 3 },
    { value: "misty fog", weight: 3 },
    { value: "light snow", weight: 2 },
    { value: "warm humid air", weight: 4 },
    { value: "windy", weight: 3 },
    { value: "dramatic storm clouds", weight: 2 },
    { value: "hazy atmosphere", weight: 2 },
  ];

  return selectWeighted(weatherOptions);
}

/**
 * Generate accessories to add detail
 * Returns null 40% of the time
 */
function generateAccessories(): string | null {
  // 40% chance of no accessories
  if (Math.random() < 0.4) {
    return null;
  }

  const accessoryOptions: WeightedOption<string>[] = [
    { value: "delicate necklace", weight: 6 },
    { value: "choker", weight: 5 },
    { value: "hoop earrings", weight: 4 },
    { value: "dangling earrings", weight: 4 },
    { value: "stud earrings", weight: 3 },
    { value: "bracelet stack", weight: 3 },
    { value: "anklet", weight: 3 },
    { value: "belly chain", weight: 2 },
    { value: "sunglasses on head", weight: 3 },
    { value: "cat-eye sunglasses", weight: 2 },
    { value: "statement ring", weight: 2 },
    { value: "headband", weight: 2 },
    { value: "hair clips", weight: 2 },
    { value: "scrunchie", weight: 2 },
    { value: "watch", weight: 2 },
    { value: "body chain", weight: 1 },
    { value: "temporary tattoos", weight: 1 },
    { value: "flower in hair", weight: 2 },
  ];

  return selectWeighted(accessoryOptions);
}

/**
 * Generate makeup style
 */
function generateMakeup(): string {
  const makeupOptions: WeightedOption<string>[] = [
    { value: "natural makeup", weight: 10 },
    { value: "minimal makeup", weight: 8 },
    { value: "no makeup natural beauty", weight: 6 },
    { value: "glossy lips", weight: 7 },
    { value: "matte red lips", weight: 5 },
    { value: "nude lips", weight: 6 },
    { value: "smokey eye makeup", weight: 6 },
    { value: "winged eyeliner", weight: 5 },
    { value: "dramatic eye makeup", weight: 4 },
    { value: "glowing skin", weight: 7 },
    { value: "dewy makeup", weight: 5 },
    { value: "contoured cheekbones", weight: 4 },
    { value: "highlighted cheekbones", weight: 4 },
    { value: "flushed cheeks", weight: 3 },
    { value: "glitter accents", weight: 2 },
    { value: "bold eyebrows", weight: 3 },
    { value: "natural brows", weight: 4 },
  ];

  return selectWeighted(makeupOptions);
}

/**
 * Generate facial expression
 */
function generateExpression(): string {
  const expressionOptions: WeightedOption<string>[] = [
    { value: "seductive gaze", weight: 10 },
    { value: "playful smile", weight: 8 },
    { value: "sultry expression", weight: 8 },
    { value: "confident smirk", weight: 6 },
    { value: "shy smile", weight: 5 },
    { value: "intense eye contact", weight: 7 },
    { value: "bedroom eyes", weight: 7 },
    { value: "lip bite", weight: 6 },
    { value: "mouth slightly open", weight: 6 },
    { value: "flirty glance", weight: 5 },
    { value: "provocative look", weight: 5 },
    { value: "dreamy expression", weight: 4 },
    { value: "playful tongue out", weight: 3 },
    { value: "laughing", weight: 4 },
    { value: "sensual expression", weight: 6 },
    { value: "mysterious smile", weight: 3 },
    { value: "looking away coyly", weight: 3 },
    { value: "direct confident gaze", weight: 5 },
  ];

  return selectWeighted(expressionOptions);
}

/**
 * Select LoRAs based on generated settings
 * Analyzes all settings to determine which LoRAs should be applied
 * @param settings The complete prompt settings
 * @returns Array of LoRA names to apply
 */
function selectLorasFromSettings(settings: PromptSettings): string[] {
  const loras = new Set<string>();

  // Always add detail enhancement
  loras.add("add-detail-xl");

  // Photography style triggers
  if (
    settings.photographyStyle.includes("amateur") ||
    settings.photographyStyle.includes("candid") ||
    settings.photographyStyle.includes("leaked") ||
    settings.photographyStyle.includes("selfie") ||
    settings.photographyStyle.includes("homemade")
  ) {
    loras.add("leaked_nudes_style_v1_fixed");
  }

  if (
    settings.photographyStyle.includes("instagram") ||
    settings.photographyStyle.includes("fashion") ||
    settings.photographyStyle.includes("professional") ||
    settings.photographyStyle.includes("glamour") ||
    settings.photographyStyle.includes("influencer") ||
    settings.pose.includes("instagram")
  ) {
    loras.add("DynaPoseV1");
  }

  // Body modifications triggers
  if (settings.bodyModifications) {
    if (settings.bodyModifications.includes("nipple piercing")) {
      loras.add("Pierced_Nipples_XL_Barbell_Edition-000013");
    }
    if (
      settings.bodyModifications.includes("tattoo") ||
      settings.bodyModifications.includes("ink")
    ) {
      loras.add("Body Tattoo_alpha1.0_rank4_noxattn_last");
    }
  }

  // Clothing state triggers
  if (
    settings.clothingState.includes("harness") ||
    settings.clothingState.includes("straps") ||
    settings.clothingState.includes("garter") ||
    settings.clothingState.includes("cupless bra")
  ) {
    loras.add("Harness_Straps_sdxl");
  }

  if (
    settings.clothingState.includes("rope bondage") ||
    settings.clothingState.includes("collar") ||
    settings.theme.includes("tied") ||
    settings.theme.includes("restraint") ||
    settings.theme.includes("bind")
  ) {
    loras.add("bdsm_SDXL_1_");
  }

  if (
    settings.clothingState.includes("nude") ||
    settings.clothingState.includes("topless") ||
    settings.clothingState.includes("bare") ||
    settings.clothingState.includes("naked")
  ) {
    loras.add("nudify_xl_lite");
  }

  // Theme-based triggers
  if (
    settings.theme.includes("dildo") ||
    settings.theme.includes("sextoy") ||
    settings.theme.includes("vibrator") ||
    settings.theme.includes("toy")
  ) {
    loras.add("Sextoy_Dildo_Pussy_v2_XL");
  }

  if (
    settings.theme.includes("doggystyle anal") ||
    settings.theme.includes("anal doggy")
  ) {
    loras.add("Doggystyle anal XL");
  }

  if (settings.theme.includes("downblouse")) {
    loras.add("RealDownblouseXLv3");
  }

  // Anthropomorphic character detection (bread LoRA)
  // Note: Current settings don't generate furry/anthro content, but we keep the logic for future expansion
  const combinedText =
    `${settings.theme} ${settings.characterAge}`.toLowerCase();
  if (
    combinedText.includes("cat girl") ||
    combinedText.includes("fox woman") ||
    combinedText.includes("furry") ||
    combinedText.includes("anthro")
  ) {
    loras.add("bread");
  }

  return Array.from(loras);
}

/**
 * Generate complete set of randomized NSFW settings for prompt generation
 * @returns PromptSettings object with all randomized parameters and selected LoRAs
 */
export function generatePromptSettings(): PromptSettings {
  const numChars = generateNumCharacters();
  const baseSettings = {
    characterAge: generateCharacterAge(),
    numCharacters: numChars,
    theme: generateTheme(numChars),
    style: generateStyle(),
    ambiance: generateAmbiance(),
    pose: generatePose(),
    clothingState: generateClothingState(),
    wildcard: generateWildcard(),
    bodyModifications: generateBodyModifications(),
    photographyStyle: generatePhotographyStyle(),
    selectedLoras: [] as string[], // Will be populated below
    // New diverse characteristics
    hairColor: generateHairColor(),
    hairStyle: generateHairStyle(),
    ethnicity: generateEthnicity(),
    eyeColor: generateEyeColor(),
    bodyType: generateBodyType(),
    location: generateLocation(),
    timeOfDay: generateTimeOfDay(),
    weather: generateWeather(),
    accessories: generateAccessories(),
    makeup: generateMakeup(),
    expressions: generateExpression(),
  };

  // Select LoRAs based on the generated settings
  baseSettings.selectedLoras = selectLorasFromSettings(baseSettings);

  return baseSettings;
}

/**
 * Format settings into a complete SDXL-ready prompt string
 * Combines all characteristics into a detailed, varied prompt for image generation
 * @param settings The generated prompt settings
 * @returns Formatted SDXL prompt string with all details
 */
export function formatSettingsForPrompt(settings: PromptSettings): string {
  const parts: string[] = [];

  // Photography style and technical quality
  parts.push(settings.photographyStyle);

  // Physical characteristics - core description
  parts.push(
    `${settings.ethnicity} woman with ${settings.hairColor} ${settings.hairStyle}`
  );
  parts.push(settings.eyeColor);
  parts.push(settings.bodyType);

  // Character count and age
  parts.push(
    `${settings.numCharacters} character${
      settings.numCharacters > 1 ? "s" : ""
    }`
  );
  parts.push(settings.characterAge);

  // Facial features and expression
  parts.push(settings.expressions);
  parts.push(settings.makeup);

  // Main theme and action
  parts.push(settings.theme);

  // Location and environment
  parts.push(`in ${settings.location}`);
  parts.push(settings.timeOfDay);
  if (settings.weather) {
    parts.push(settings.weather);
  }

  // Style and ambiance
  parts.push(settings.style);
  parts.push(settings.ambiance);

  // Pose and body language
  parts.push(settings.pose);

  // Clothing state
  parts.push(settings.clothingState);

  // Optional details
  if (settings.accessories) {
    parts.push(`wearing ${settings.accessories}`);
  }

  if (settings.bodyModifications) {
    parts.push(settings.bodyModifications);
  }

  if (settings.wildcard) {
    parts.push(settings.wildcard);
  }

  // Quality and technical tags for SDXL
  parts.push(
    "masterpiece, best quality, highly detailed, 8k uhd, professional photography"
  );

  return parts.join(", ");
}

/**
 * Generate a complete SDXL prompt
 * @param settings The generated prompt settings
 * @returns Complete SDXL prompt
 */
export function generateSDXLPrompt(settings: PromptSettings): string {
  const basePrompt = formatSettingsForPrompt(settings);

  return basePrompt;
}
