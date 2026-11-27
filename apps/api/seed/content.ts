/**
 * SAMPLE DATA. Every row has verified: false.
 *
 * These are widely documented figures for local play, not an editorially
 * approved puzzle set. Check the number, unit, and source before treating
 * any of them as official. See the README for how production content should
 * stay out of this public repository.
 */
import { CLASSIC_QUESTIONS, COUNTRIES, ELEMENTS, LEGACY_SLOTS, METRIC_COPY, PACK_QUESTIONS, SEED_SLOTS, normalizeAnswer, suggestionsFor, type SliderScale } from "@ballpark/shared";
import { addedDays, addedNameOne } from "./added-days.ts";
import { extraFacts } from "./more-facts.ts";
import { metricForExisting } from "./metrics.ts";
import { funDays, funNameOne, packNameOne, packs as funPacks, type SeedPack as FunPack } from "./fun.ts";
import { journeyChapters, journeyNameOne, type SeedChapter } from "./journeys.ts";
import { nameOneById, type AcceptedSeed, type NameOneSeed } from "./name-one.ts";
import { NUDGES } from "./nudges.ts";
import { moreBase } from "./seven.ts";

export type { SeedChapter };

/** A Ballpark+ pack as a journey: chapter 1 is the pack's original five questions, then the chapters after it. */
export type SeedPack = FunPack & { route: string; chapters: SeedChapter[] };

export const packs: SeedPack[] = funPacks.map((pack) => {
  const journey = journeyChapters[pack.id];
  if (!journey) throw new Error(`Pack ${pack.id} has no journey`);
  return { ...pack, route: journey.route, chapters: [{ ...journey.first, questionIds: pack.questionIds }, ...journey.more] };
});

export type SeedFact = {
  id: string;
  label: string;
  value: number;
  unit: string;
  context: string;
  sourceUrl: string;
  sourceName: string;
  retrievedAt: string;
  license: string;
  topic: string;
  difficulty: 1 | 2 | 3;
  verified: false;
  vintage: string | null;
  metric: string;
};

export type SeedQuestion = {
  id: string;
  prompt: string;
  type: "estimate" | "compare" | "rank" | "name_one";
  unit: string | null;
  polarity: "higher" | "lower";
  scale: SliderScale | null;
  factIds: string[];
  displayIds: string[];
  context: string;
  sourceUrl: string;
  sourceName: string;
  retrievedAt: string;
  license: string;
  topic: string;
  difficulty: 1 | 2 | 3;
  verified: false;
  accepted: AcceptedSeed[] | null;
  entitySet: "countries" | "elements" | null;
  /** A line for a stuck player. Every daily question has one; pack questions do not. */
  nudge?: string | null;
};

export type SeedPuzzle = {
  slot: number;
  theme: string;
  blurb: string;
  questionIds: string[];
};

const ON = "2026-11-21";
const PD = "Public domain (U.S. government work)";
const CC = "CC BY-SA 4.0";

function fact(
  id: string,
  label: string,
  value: number,
  unit: string,
  topic: string,
  difficulty: 1 | 2 | 3,
  sourceName: string,
  sourceUrl: string,
  license: string,
  context: string,
  vintage: string | null = null,
): SeedFact {
  return {
    id,
    label,
    value,
    unit,
    topic,
    difficulty,
    sourceName,
    sourceUrl,
    license,
    context,
    vintage,
    metric: "",
    retrievedAt: ON,
    verified: false,
  };
}

const baseFacts: SeedFact[] = [
  fact("f-moon-distance", "Earth–Moon distance", 384400, "km", "space", 2, "NASA Science", "https://science.nasa.gov/moon/facts/", PD, "NASA gives the Moon's average distance as 384,400 km. The orbit is slightly oval, so the distance changes through the month.", "NASA mean distance"),
  fact("f-earth-diameter", "Earth", 12756.274, "km", "space", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html", PD, "Earth's equatorial diameter is twice the 6,378.137 km radius on NASA's fact sheet.", "NASA fact sheet"),
  fact("f-jupiter-diameter", "Jupiter", 142984, "km", "space", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html", PD, "Jupiter's equatorial diameter is about 142,984 km, more than eleven Earths across.", "NASA fact sheet"),
  fact("f-mercury-distance", "Mercury", 57909000, "km", "space", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html", PD, "Mercury orbits at a semimajor axis of about 57.9 million km.", "NASA fact sheet"),
  fact("f-venus-distance", "Venus", 108210000, "km", "space", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html", PD, "Venus orbits at a semimajor axis of about 108.2 million km.", "NASA fact sheet"),
  fact("f-earth-distance", "Earth", 149598000, "km", "space", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html", PD, "One astronomical unit, Earth's average distance from the Sun, is about 149.6 million km.", "NASA fact sheet"),
  fact("f-sun-distance", "Earth to the Sun", 149598000, "km", "space", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html", PD, "One astronomical unit, Earth's average distance from the Sun, is about 149.6 million km.", "NASA fact sheet"),
  fact("f-mars-distance", "Mars", 227923000, "km", "space", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html", PD, "Mars orbits at a semimajor axis of about 227.9 million km.", "NASA fact sheet"),
  fact("f-mercury-diameter", "Mercury", 4879.4, "km", "space", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html", PD, "Mercury's equatorial diameter is about 4,879 km, the smallest of the eight planets.", "NASA fact sheet"),
  fact("f-venus-diameter", "Venus", 12103.6, "km", "space", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html", PD, "Venus is only slightly smaller than Earth, with an equatorial diameter of about 12,104 km.", "NASA fact sheet"),
  fact("f-mars-diameter", "Mars", 6792.4, "km", "space", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html", PD, "Mars's equatorial diameter is about 6,792 km.", "NASA fact sheet"),
  fact("f-earth-year", "Earth", 365.256, "days", "space", 1, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html", PD, "Earth's sidereal orbit period is about 365.256 days.", "NASA fact sheet"),
  fact("f-mars-year", "Mars", 686.98, "days", "space", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html", PD, "A Martian year lasts about 687 Earth days.", "NASA fact sheet"),
  fact("f-light-speed", "Speed of light in a vacuum", 299792458, "m/s", "science", 2, "NIST", "https://physics.nist.gov/cgi-bin/cuu/Value?c", PD, "The metre is defined from this speed. In a vacuum it is exactly 299,792,458 m/s.", "SI definition, 1983"),
  fact("f-everest", "Height of Mount Everest", 8848.86, "m", "geography", 2, "Survey Department, Government of Nepal", "https://dos.gov.np/everest/index.html", "Government of Nepal survey publication", "In 2020 Nepal and China jointly announced 8,848.86 m, including the snow cap.", "2020 joint survey"),
  fact("f-kilimanjaro", "Kilimanjaro", 5895, "m", "geography", 2, "Wikipedia: Mount Kilimanjaro", "https://en.wikipedia.org/wiki/Mount_Kilimanjaro", CC, "Uhuru Peak on Kilimanjaro is 5,895 m above sea level.", "Standard surveyed height"),
  fact("f-denali", "Denali", 6190, "m", "geography", 2, "U.S. Geological Survey", "https://www.usgs.gov/news/national-news-release/new-elevation-nations-highest-peak", PD, "USGS measured Denali at 20,310 feet, which is 6,190 m, in 2015.", "2015 USGS survey"),
  fact("f-mediterranean", "Mediterranean Sea", 2500000, "km²", "geography", 2, "Wikipedia: Mediterranean Sea", "https://en.wikipedia.org/wiki/Mediterranean_Sea", CC, "A widely cited area for the Mediterranean is about 2.5 million km². Sea boundaries are conventional.", "Reference area"),
  fact("f-caribbean", "Caribbean Sea", 2754000, "km²", "geography", 2, "Wikipedia: Caribbean Sea", "https://en.wikipedia.org/wiki/Caribbean_Sea", CC, "A widely cited area for the Caribbean Sea is about 2.75 million km².", "Reference area"),
  fact("f-pacific", "Pacific", 168723000, "km²", "geography", 2, "Wikipedia: Ocean, citing NOAA", "https://en.wikipedia.org/wiki/Ocean", CC, "With the Southern Ocean counted separately, the Pacific is still much the largest ocean, about 169 million km².", "NOAA compilation via Wikipedia"),
  fact("f-atlantic", "Atlantic", 85133000, "km²", "geography", 2, "Wikipedia: Ocean, citing NOAA", "https://en.wikipedia.org/wiki/Ocean", CC, "On that same compilation the Atlantic is about 85 million km².", "NOAA compilation via Wikipedia"),
  fact("f-indian", "Indian", 70560000, "km²", "geography", 2, "Wikipedia: Ocean, citing NOAA", "https://en.wikipedia.org/wiki/Ocean", CC, "The Indian Ocean is about 71 million km² on the NOAA compilation.", "NOAA compilation via Wikipedia"),
  fact("f-arctic", "Arctic", 15558000, "km²", "geography", 2, "Wikipedia: Ocean, citing NOAA", "https://en.wikipedia.org/wiki/Ocean", CC, "The Arctic Ocean is the smallest of the four, about 15.6 million km².", "NOAA compilation via Wikipedia"),
  fact("f-challenger", "Challenger Deep", 10935, "m", "geography", 3, "NOAA Ocean Exploration", "https://oceanexplorer.noaa.gov/ocean-fact/ocean-depth/", PD, "NOAA reports the deepest known seafloor, in Challenger Deep, at 10,935 m.", "2020 submersible survey"),
  fact("f-puerto-rico", "Puerto Rico Trench", 8400, "m", "geography", 3, "Wikipedia: Puerto Rico Trench", "https://en.wikipedia.org/wiki/Puerto_Rico_Trench", CC, "The Puerto Rico Trench is the deepest part of the Atlantic, about 8,400 m. Published soundings differ by a few hundred metres.", "Approximate maximum"),
  fact("f-bones-adult", "Adult bones", 206, "bones", "human-body", 1, "Wikipedia: Human skeleton", "https://en.wikipedia.org/wiki/Human_skeleton", CC, "A typical adult skeleton has 206 bones. Small extra bones can change the count slightly.", "Standard anatomy count"),
  fact("f-bones-infant", "Newborn bones", 270, "bones", "human-body", 2, "Wikipedia: Human skeleton", "https://en.wikipedia.org/wiki/Human_skeleton", CC, "A newborn has around 270 bones. Many later fuse, which is why adults have fewer.", "Approximate anatomy count"),
  fact("f-teeth", "Adult teeth", 32, "teeth", "human-body", 1, "Wikipedia: Human tooth", "https://en.wikipedia.org/wiki/Human_tooth", CC, "A full adult set, including wisdom teeth, is 32 teeth.", "Standard dental count"),
  fact("f-baby-teeth", "Baby teeth", 20, "teeth", "human-body", 1, "Wikipedia: Deciduous teeth", "https://en.wikipedia.org/wiki/Deciduous_teeth", CC, "Children have 20 baby teeth before the adult set replaces them.", "Standard dental count"),
  fact("f-right-lung", "Right lung", 3, "lobes", "human-body", 1, "NCBI StatPearls: Anatomy, Thorax, Lungs", "https://www.ncbi.nlm.nih.gov/books/NBK470197/", "NCBI Bookshelf", "The right lung has three lobes.", "Standard anatomy"),
  fact("f-left-lung", "Left lung", 2, "lobes", "human-body", 1, "NCBI StatPearls: Anatomy, Thorax, Lungs", "https://www.ncbi.nlm.nih.gov/books/NBK470197/", "NCBI Bookshelf", "The left lung has two lobes, leaving room for the heart.", "Standard anatomy"),
  fact("f-chromosomes", "Chromosomes", 46, "chromosomes", "human-body", 1, "National Human Genome Research Institute", "https://www.genome.gov/about-genomics/fact-sheets/Chromosomes-Fact-Sheet", PD, "Most human cells carry 46 chromosomes, in 23 pairs.", "NHGRI fact sheet"),
  fact("f-neurons", "Neurons in an adult human brain", 86100000000, "neurons", "human-body", 3, "PubMed: Azevedo et al. 2009", "https://pubmed.ncbi.nlm.nih.gov/19226510/", "Public research abstract", "A 2009 cell count estimated about 86.1 billion neurons in the adult male human brain.", "Azevedo et al. 2009"),
  fact("f-small-intestine", "Small intestine", 6, "m", "human-body", 2, "Wikipedia: Small intestine", "https://en.wikipedia.org/wiki/Small_intestine", CC, "Anatomy references put a typical adult small intestine at about 6 metres. It varies by person.", "Textbook average"),
  fact("f-large-intestine", "Large intestine", 1.5, "m", "human-body", 2, "Wikipedia: Large intestine", "https://en.wikipedia.org/wiki/Large_intestine", CC, "A typical adult large intestine is about 1.5 metres long.", "Textbook average"),
  fact("f-clock", "Mechanical clock in Europe", 1283, "year", "inventions", 3, "Wikipedia: Clock", "https://en.wikipedia.org/wiki/Clock", CC, "The earliest recorded European mechanical clock is dated to 1283, at Dunstable Priory in England.", "Traditional date"),
  fact("f-gutenberg", "Gutenberg's movable type", 1440, "year", "inventions", 2, "Wikipedia: Johannes Gutenberg", "https://en.wikipedia.org/wiki/Johannes_Gutenberg", CC, "Gutenberg's metal movable type is traditionally dated to around 1440. The Bible followed in the 1450s.", "Traditional date"),
  fact("f-telescope", "Telescope", 1608, "year", "inventions", 2, "Wikipedia: History of the telescope", "https://en.wikipedia.org/wiki/History_of_the_telescope", CC, "Hans Lippershey applied for a patent on a refracting telescope in 1608.", "1608 patent"),
  fact("f-telephone", "Telephone", 1876, "year", "inventions", 1, "Wikipedia: Telephone", "https://en.wikipedia.org/wiki/Telephone", CC, "Alexander Graham Bell received a U.S. patent for the telephone in 1876.", "1876 patent"),
  fact("f-eiffel", "Eiffel Tower", 330, "m", "inventions", 1, "Société d'Exploitation de la Tour Eiffel", "https://www.toureiffel.paris/en/news/events/eiffel-tower-grows-330-meters-tall", "Official operator announcement", "With its current antennas the tower is 330 m. The 1889 structure was shorter.", "Height after the 2022 antenna"),
  fact("f-pyramid-height", "Original height of the Great Pyramid", 146.6, "m", "history", 2, "Wikipedia: Great Pyramid of Giza", "https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza", CC, "Khufu's pyramid originally rose about 146.6 m. The lost outer casing makes it a little shorter today.", "Original height"),
  fact("f-empire", "Height of the Empire State Building", 443.2, "m", "inventions", 2, "Empire State Building", "https://www.esbnyc.com/about/facts-figures", "Official building fact sheet", "To the tip of its antenna the Empire State Building is 1,454 feet, about 443.2 m.", "Height to tip"),
  fact("f-cn-tower", "CN Tower", 553.3, "m", "inventions", 2, "Wikipedia: CN Tower", "https://en.wikipedia.org/wiki/CN_Tower", CC, "The CN Tower in Toronto is 553.3 m to the tip of its antenna.", "Height to tip"),
  fact("f-piano", "Keys on a modern piano", 88, "keys", "culture", 1, "Wikipedia: Musical keyboard", "https://en.wikipedia.org/wiki/Musical_keyboard", CC, "A standard modern piano has 88 keys, 52 white and 36 black, from A0 to C8.", "Modern standard"),
  fact("f-railway", "Stockton and Darlington Railway", 1825, "year", "inventions", 2, "Wikipedia: Stockton and Darlington Railway", "https://en.wikipedia.org/wiki/Stockton_and_Darlington_Railway", CC, "The Stockton and Darlington Railway opened in 1825 and is often called the first public railway to use steam locomotives.", "1825 opening"),
  fact("f-wright", "Wright Flyer", 1903, "year", "inventions", 1, "Smithsonian National Air and Space Museum", "https://airandspace.si.edu/collection-objects/1903-wright-flyer/nasm_A19610048000", PD, "The Wright Flyer made the first powered, controlled airplane flights on 17 December 1903.", "17 December 1903"),
  fact("f-pyramid-year", "Great Pyramid", -2560, "year", "history", 2, "Wikipedia: Great Pyramid of Giza", "https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza", CC, "Khufu's pyramid is conventionally dated to about 2560 BCE. The exact year is still debated; the era is not.", "Conventional date"),
  fact("f-parthenon", "Parthenon", -438, "year", "history", 2, "Wikipedia: Parthenon", "https://en.wikipedia.org/wiki/Parthenon", CC, "The Parthenon was dedicated in 438 BCE.", "438 BCE"),
  fact("f-magna", "Magna Carta", 1215, "year", "history", 1, "Wikipedia: Magna Carta", "https://en.wikipedia.org/wiki/Magna_Carta", CC, "King John sealed Magna Carta at Runnymede in 1215.", "1215"),
  fact("f-declaration", "Declaration of Independence", 1776, "year", "history", 1, "Wikipedia: United States Declaration of Independence", "https://en.wikipedia.org/wiki/United_States_Declaration_of_Independence", CC, "The Continental Congress adopted the Declaration of Independence in 1776.", "1776"),
  fact("f-colosseum", "Colosseum", 80, "year", "history", 2, "Wikipedia: Colosseum", "https://en.wikipedia.org/wiki/Colosseum", CC, "The Colosseum opened under Titus in 80 CE.", "80 CE"),
  fact("f-taj", "Taj Mahal", 1653, "year", "history", 2, "Wikipedia: Taj Mahal", "https://en.wikipedia.org/wiki/Taj_Mahal", CC, "The Taj Mahal complex was completed in 1653, about two decades after work began.", "1653 completion"),
  fact("f-liberty-total", "Statue of Liberty, ground to torch", 92.99, "m", "culture", 2, "U.S. National Park Service", "https://www.nps.gov/stli/learn/historyculture/statue-statistics.htm", PD, "From the ground of Liberty Island to the tip of the torch is 305 feet 1 inch, or 92.99 m.", "NPS statistics"),
  fact("f-liberty-figure", "Statue of Liberty", 46.05, "m", "culture", 2, "U.S. National Park Service", "https://www.nps.gov/stli/learn/historyculture/statue-statistics.htm", PD, "The copper figure herself, from heel to torch, is 46.05 m. The pedestal is separate.", "NPS statistics"),
  fact("f-christ-statue", "Christ the Redeemer", 30, "m", "culture", 2, "Wikipedia: Christ the Redeemer", "https://en.wikipedia.org/wiki/Christ_the_Redeemer_(statue)", CC, "The statue itself is 30 m tall. Its pedestal adds about another 8 m.", "Statue excluding pedestal"),
  fact("f-whale-length", "Length of the largest blue whales", 30, "m", "nature", 2, "NOAA Fisheries", "https://www.fisheries.noaa.gov/species/blue-whale", PD, "NOAA describes the largest blue whales as reaching about 100 feet, or 30 m. Most are shorter.", "Approximate maximum"),
  fact("f-elephant-mass", "African elephant", 6000, "kg", "nature", 2, "Wikipedia: African bush elephant", "https://en.wikipedia.org/wiki/African_bush_elephant", CC, "A large adult male African savanna elephant is on the order of 6 tonnes. Bulls vary widely.", "Typical large male"),
  fact("f-whale-mass", "Blue whale", 150000, "kg", "nature", 2, "NOAA Fisheries", "https://www.fisheries.noaa.gov/species/blue-whale", PD, "A large blue whale weighs on the order of 150 tonnes, far beyond any land animal alive today.", "Order-of-magnitude adult"),
  fact("f-mouse-mass", "House mouse", 0.02, "kg", "nature", 1, "Wikipedia: House mouse", "https://en.wikipedia.org/wiki/House_mouse", CC, "An adult house mouse weighs about 20 grams.", "Typical adult"),
  fact("f-penguin-mass", "Emperor penguin", 30, "kg", "nature", 2, "Australian Antarctic Program", "https://www.antarctica.gov.au/about-antarctica/animals/penguins/emperor-penguins/", "Australian Antarctic Program", "An adult emperor penguin is around 30 kg. Weight swings a lot across the breeding season.", "Typical adult"),
  fact("f-bear-mass", "Polar bear", 450, "kg", "nature", 2, "Wikipedia: Polar bear", "https://en.wikipedia.org/wiki/Polar_bear", CC, "Adult male polar bears are often around 350 to 700 kg. 450 kg is a mid-range figure, not a record.", "Mid-range adult male"),
  fact("f-hippo-mass", "Hippopotamus", 1500, "kg", "nature", 2, "Wikipedia: Hippopotamus", "https://en.wikipedia.org/wiki/Hippopotamus", CC, "A large male hippopotamus is around 1,500 kg. Adults vary, and the order against a polar bear does not.", "Typical large male"),
  fact("f-albatross", "Wingspan of a wandering albatross", 3.5, "m", "nature", 2, "Britannica: wandering albatross", "https://www.britannica.com/animal/wandering-albatross", "Encyclopaedia Britannica (sample citation)", "The wandering albatross has the largest wingspan of any living bird, up to about 3.5 m.", "Approximate maximum"),
  fact("f-elephant-gestation", "African elephant", 660, "days", "nature", 2, "Wikipedia: African bush elephant", "https://en.wikipedia.org/wiki/African_bush_elephant", CC, "African elephant pregnancies last about 22 months, close to 660 days, the longest of any land mammal.", "Approximate mean"),
  fact("f-human-gestation", "Human", 280, "days", "human-body", 1, "NICHD", "https://www.nichd.nih.gov/health/topics/pregnancy/conditioninfo", PD, "A typical human pregnancy is counted as about 40 weeks, or 280 days, from the last menstrual period.", "Clinical average"),
  fact("f-un-members", "United Nations member states", 193, "member states", "geography", 1, "United Nations", "https://www.un.org/en/about-us/member-states", "United Nations public information", "The United Nations has 193 member states, unchanged since South Sudan joined in 2011.", "Membership since 2011"),
  fact("f-canada-area", "Canada", 9984670, "km²", "geography", 2, "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/canada/", PD, "The Factbook lists Canada's total area, including inland water, as 9,984,670 km².", "CIA World Factbook"),
  fact("f-china-area", "China", 9596960, "km²", "geography", 2, "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/china/", PD, "The Factbook lists China's total area as 9,596,960 km².", "CIA World Factbook"),
  fact("f-vatican-area", "Vatican City", 0.44, "km²", "geography", 1, "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/holy-see/", PD, "Vatican City covers about 0.44 km², the smallest country by area.", "CIA World Factbook"),
  fact("f-japan-area", "Japan", 377915, "km²", "geography", 2, "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/japan/", PD, "The Factbook lists Japan's total area as about 377,915 km².", "CIA World Factbook"),
  fact("f-mexico-area", "Mexico", 1964375, "km²", "geography", 2, "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/mexico/", PD, "The Factbook lists Mexico's total area as 1,964,375 km².", "CIA World Factbook"),
  fact("f-brazil-area", "Brazil", 8515770, "km²", "geography", 2, "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/brazil/", PD, "The Factbook lists Brazil's total area as 8,515,770 km².", "CIA World Factbook"),
  fact("f-russia-area", "Total area of Russia", 17098242, "km²", "geography", 2, "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/russia/", PD, "Russia is the largest country by area, 17,098,242 km² in the Factbook, including inland water.", "CIA World Factbook"),
  fact("f-australia-area", "Australia", 7741220, "km²", "geography", 2, "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/australia/", PD, "The Factbook lists Australia's total area as 7,741,220 km².", "CIA World Factbook"),
  fact("f-india-area", "India", 3287263, "km²", "geography", 2, "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/india/", PD, "The Factbook lists India's total area as 3,287,263 km².", "CIA World Factbook"),
  fact("f-c14", "Half-life of carbon-14", 5730, "years", "science", 2, "NIST", "https://www.nist.gov/how-do-you-measure-it/how-do-you-know-age-fossils-and-other-old-things", PD, "NIST describes carbon-14's half-life as about 5,730 years. Some radiocarbon calculations still use the older Libby value of 5,568.", "Commonly cited half-life"),
  fact("f-sound", "Speed of sound in dry air at 20 °C", 343, "m/s", "science", 2, "Wikipedia: Speed of sound", "https://en.wikipedia.org/wiki/Speed_of_sound", CC, "In dry air at 20 °C, sound travels at about 343 m/s. Warmer air is faster.", "20 °C, dry air"),
  fact("f-tin-melt", "Tin", 231.93, "°C", "science", 2, "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/50/tin", "Royal Society of Chemistry periodic table", "Tin melts at about 232 °C at ordinary pressure.", "Standard pressure"),
  fact("f-gold-melt", "Gold", 1064.18, "°C", "science", 2, "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/79/gold", "Royal Society of Chemistry periodic table", "Gold melts at about 1,064 °C.", "Standard pressure"),
  fact("f-iron-melt", "Iron", 1538, "°C", "science", 2, "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/26/iron", "Royal Society of Chemistry periodic table", "Iron melts at about 1,538 °C.", "Standard pressure"),
  fact("f-tungsten-melt", "Tungsten", 3422, "°C", "science", 3, "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/74/tungsten", "Royal Society of Chemistry periodic table", "Tungsten has the highest melting point of any metal, about 3,422 °C.", "Standard pressure"),
  fact("f-aluminum-melt", "Aluminium", 660.32, "°C", "science", 2, "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/13/aluminium", "Royal Society of Chemistry periodic table", "Aluminium melts at about 660 °C.", "Standard pressure"),
  fact("f-copper-melt", "Copper", 1084.62, "°C", "science", 2, "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/29/copper", "Royal Society of Chemistry periodic table", "Copper melts at about 1,085 °C.", "Standard pressure"),
  fact("f-gold-z", "Gold", 79, "protons", "science", 1, "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/79/gold", "Royal Society of Chemistry periodic table", "Gold is element 79.", "Exact"),
  fact("f-lead-z", "Lead", 82, "protons", "science", 1, "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/82/lead", "Royal Society of Chemistry periodic table", "Lead is element 82.", "Exact"),
  fact("f-marathon", "Length of a standard marathon", 42.195, "km", "culture", 1, "World Athletics", "https://worldathletics.org/disciplines/road-running/marathon", "World Athletics competition rules", "The marathon is standardized at 42.195 km, the distance fixed after the 1908 London course.", "Current standard"),
  fact("f-beethoven", "Beethoven's Ninth", 1824, "year", "culture", 2, "Wikipedia: Symphony No. 9 (Beethoven)", "https://en.wikipedia.org/wiki/Symphony_No._9_(Beethoven)", CC, "Beethoven's Ninth Symphony was first performed in Vienna on 7 May 1824.", "7 May 1824"),
  fact("f-rite", "The Rite of Spring", 1913, "year", "culture", 2, "Wikipedia: The Rite of Spring", "https://en.wikipedia.org/wiki/The_Rite_of_Spring", CC, "Stravinsky's The Rite of Spring premiered in Paris on 29 May 1913.", "29 May 1913"),
  fact("f-figaro", "The Marriage of Figaro", 1786, "year", "culture", 2, "Wikipedia: The Marriage of Figaro", "https://en.wikipedia.org/wiki/The_Marriage_of_Figaro", CC, "Mozart's The Marriage of Figaro opened in Vienna on 1 May 1786.", "1 May 1786"),
  fact("f-messiaen", "Quartet for the End of Time", 1941, "year", "culture", 3, "Wikipedia: Quatuor pour la fin du temps", "https://en.wikipedia.org/wiki/Quatuor_pour_la_fin_du_temps", CC, "Messiaen's Quartet for the End of Time was first played in a prisoner-of-war camp on 15 January 1941.", "15 January 1941"),
  fact("f-mona", "Mona Lisa", 0.4081, "m²", "culture", 2, "Louvre", "https://collections.louvre.fr/en/ark:/53355/cl010062370", "Louvre collection record", "The Mona Lisa's panel is 77 cm by 53 cm, about 0.41 square metres.", "Louvre dimensions"),
  fact("f-guernica", "Guernica", 27.1266, "m²", "culture", 2, "Museo Reina Sofía", "https://www.museoreinasofia.es/en/collections/artwork/guernica", "Museo Reina Sofía collection record", "Guernica measures 349.3 cm by 776.6 cm, about 27 square metres.", "Museum dimensions"),
  fact("f-shakespeare", "Year of Shakespeare's birth", 1564, "year", "culture", 1, "Wikipedia: William Shakespeare", "https://en.wikipedia.org/wiki/William_Shakespeare", CC, "Shakespeare was baptised on 26 April 1564. The exact birth date was not written down; the year was.", "Baptismal year 1564"),
  fact("f-principia", "Newton's Principia", 1687, "year", "culture", 2, "Wikipedia: Philosophiæ Naturalis Principia Mathematica", "https://en.wikipedia.org/wiki/Philosophi%C3%A6_Naturalis_Principia_Mathematica", CC, "Newton's Principia was published in 1687.", "1687"),
  fact("f-origin", "On the Origin of Species", 1859, "year", "culture", 2, "Wikipedia: On the Origin of Species", "https://en.wikipedia.org/wiki/On_the_Origin_of_Species", CC, "Darwin's On the Origin of Species was published in 1859.", "1859"),
  fact("f-equator", "Equatorial circumference of Earth", 40075.017, "km", "geography", 2, "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html", PD, "NASA lists Earth's equatorial circumference as 40,075.017 km. The polar circumference is a little shorter.", "NASA fact sheet"),
  fact("f-elements", "Confirmed chemical elements", 118, "elements", "science", 1, "IUPAC", "https://iupac.org/what-we-do/periodic-table-of-elements/", "IUPAC", "IUPAC's periodic table lists 118 confirmed elements. The newest names were adopted in 2016.", "Current IUPAC table"),
];

function question(
  id: string,
  prompt: string,
  type: SeedQuestion["type"],
  polarity: SeedQuestion["polarity"],
  factIds: string[],
  displayIds: string[],
  context: string,
  sourceName: string,
  sourceUrl: string,
  license: string,
  topic: string,
  difficulty: 1 | 2 | 3,
  unit: string | null = null,
  scale: SliderScale | null = null,
): SeedQuestion {
  return {
    id,
    prompt,
    type,
    polarity,
    factIds,
    displayIds,
    context,
    sourceName,
    sourceUrl,
    license,
    topic,
    difficulty,
    unit,
    scale,
    retrievedAt: ON,
    verified: false,
    accepted: null,
    entitySet: null,
  };
}

const baseQuestions: SeedQuestion[] = [
  question("q-space-moon", "How far is the Moon from Earth, on average?", "estimate", "higher", ["f-moon-distance"], ["f-moon-distance"], "NASA gives the Moon's average distance as 384,400 km. The orbit is slightly oval, so the real distance swings by tens of thousands of kilometres.", "NASA Science", "https://science.nasa.gov/moon/facts/", PD, "space", 2, "km", "distance-km"),
  question("q-space-giants", "Which planet has the larger equatorial diameter?", "compare", "higher", ["f-earth-diameter", "f-jupiter-diameter"], ["f-earth-diameter", "f-jupiter-diameter"], "Jupiter's equatorial diameter is about 142,984 km, more than eleven times Earth's 12,756 km.", "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html", PD, "space", 1),
  question("q-space-orbits", "Order these planets from closest to the Sun to farthest.", "rank", "lower", ["f-mercury-distance", "f-venus-distance", "f-earth-distance", "f-mars-distance"], ["f-earth-distance", "f-mercury-distance", "f-mars-distance", "f-venus-distance"], "Average distances from the Sun run Mercury, Venus, Earth, then Mars: about 58 million km out to about 228 million km.", "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/", PD, "space", 1),
  question("q-space-light", "What is the speed of light in a vacuum?", "estimate", "higher", ["f-light-speed"], ["f-light-speed"], "Since 1983 the metre has been defined from this speed. In a vacuum, light travels at exactly 299,792,458 metres per second.", "NIST", "https://physics.nist.gov/cgi-bin/cuu/Value?c", PD, "science", 2, "m/s", "speed-ms"),
  question("q-space-year", "Which planet takes longer to orbit the Sun?", "compare", "higher", ["f-earth-year", "f-mars-year"], ["f-earth-year", "f-mars-year"], "A Martian year lasts about 687 Earth days. Earth's sidereal year is about 365.256 days.", "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html", PD, "space", 1),

  question("q-earth-everest", "How high is Mount Everest above sea level?", "estimate", "higher", ["f-everest"], ["f-everest"], "In 2020 Nepal and China jointly announced a height of 8,848.86 m, including the snow cap.", "Survey Department, Government of Nepal", "https://dos.gov.np/everest/index.html", "Government of Nepal survey publication", "geography", 2, "m", "length-m"),
  question("q-earth-seas", "Which sea has the larger surface area?", "compare", "higher", ["f-mediterranean", "f-caribbean"], ["f-mediterranean", "f-caribbean"], "Standard reference areas put the Caribbean at about 2.75 million km² and the Mediterranean at about 2.5 million km². Boundaries of seas are conventional, so both figures are rounded.", "Wikipedia: Caribbean Sea", "https://en.wikipedia.org/wiki/Caribbean_Sea", CC, "geography", 2),
  question("q-earth-oceans", "Order these oceans by surface area, largest first.", "rank", "higher", ["f-pacific", "f-atlantic", "f-indian", "f-arctic"], ["f-arctic", "f-indian", "f-pacific", "f-atlantic"], "Counting the Southern Ocean separately, the Pacific is still by far the largest of these four, and the Arctic is the smallest. Figures follow a NOAA compilation widely reprinted from the ocean article on Wikipedia.", "Wikipedia: Ocean, citing NOAA", "https://en.wikipedia.org/wiki/Ocean", CC, "geography", 2),
  question("q-earth-trench", "How deep is Challenger Deep, the deepest known point in the ocean?", "estimate", "higher", ["f-challenger"], ["f-challenger"], "A 2020 crewed survey, reported by NOAA, put the deepest observed seafloor in Challenger Deep at 10,935 metres, give or take about 6 metres.", "NOAA Ocean Exploration", "https://oceanexplorer.noaa.gov/ocean-fact/ocean-depth/", PD, "geography", 3, "m", "length-m"),
  question("q-earth-peaks", "Which peak is higher above sea level?", "compare", "higher", ["f-kilimanjaro", "f-denali"], ["f-kilimanjaro", "f-denali"], "Denali's official USGS elevation is 6,190 m. Kilimanjaro's Uhuru Peak is 5,895 m. Everest is higher than both, but that is a different question.", "U.S. Geological Survey", "https://www.usgs.gov/news/national-news-release/new-elevation-nations-highest-peak", PD, "geography", 2),

  question("q-body-bones", "How many bones are in a typical adult human skeleton?", "estimate", "higher", ["f-bones-adult"], ["f-bones-adult"], "Anatomy texts settle on 206 bones in a typical adult. The count can vary slightly with small sesamoid bones, and babies start with more that later fuse.", "Wikipedia: Human skeleton", "https://en.wikipedia.org/wiki/Human_skeleton", CC, "human-body", 1, "bones", "count"),
  question("q-body-lungs", "Which lung has more lobes?", "compare", "higher", ["f-right-lung", "f-left-lung"], ["f-left-lung", "f-right-lung"], "The right lung has three lobes. The left has two, which leaves room for the heart.", "NCBI StatPearls: Anatomy, Thorax, Lungs", "https://www.ncbi.nlm.nih.gov/books/NBK470197/", "NCBI Bookshelf", "human-body", 1),
  question("q-body-counts", "Order these by how many a typical person has, fewest first.", "rank", "lower", ["f-baby-teeth", "f-teeth", "f-chromosomes"], ["f-chromosomes", "f-baby-teeth", "f-teeth"], "Children have 20 baby teeth. A full adult set, including wisdom teeth, is 32. Most human cells carry 46 chromosomes.", "National Human Genome Research Institute", "https://www.genome.gov/about-genomics/fact-sheets/Chromosomes-Fact-Sheet", PD, "human-body", 2),
  question("q-body-neurons", "About how many neurons are in an adult human brain?", "estimate", "higher", ["f-neurons"], ["f-neurons"], "A 2009 count by Azevedo and colleagues estimated about 86 billion neurons in the adult male human brain, with a margin of a few billion.", "PubMed: Azevedo et al. 2009", "https://pubmed.ncbi.nlm.nih.gov/19226510/", "Public research abstract", "human-body", 3, "neurons", "count"),
  question("q-body-gut", "Which is longer in a typical adult?", "compare", "higher", ["f-small-intestine", "f-large-intestine"], ["f-small-intestine", "f-large-intestine"], "References put the small intestine at about 6 metres and the large intestine at about 1.5 metres. Both lengths vary from person to person.", "Wikipedia: Small intestine", "https://en.wikipedia.org/wiki/Small_intestine", CC, "human-body", 2),

  question("q-inv-order", "Order these from earliest to latest.", "rank", "lower", ["f-clock", "f-gutenberg", "f-telescope", "f-telephone"], ["f-telephone", "f-clock", "f-telescope", "f-gutenberg"], "The earliest recorded European mechanical clock is dated to 1283. Gutenberg's metal type is traditionally placed around 1440, the telescope patent in 1608, and Bell's telephone patent in 1876.", "Wikipedia: Clock", "https://en.wikipedia.org/wiki/Clock", CC, "inventions", 2),
  question("q-inv-piano", "How many keys does a standard modern piano have?", "estimate", "higher", ["f-piano"], ["f-piano"], "The modern piano keyboard settled on 88 keys, from A0 to C8.", "Wikipedia: Musical keyboard", "https://en.wikipedia.org/wiki/Musical_keyboard", CC, "culture", 1, "keys", "count"),
  question("q-inv-towers", "Which tower is taller, to the tip?", "compare", "higher", ["f-eiffel", "f-cn-tower"], ["f-eiffel", "f-cn-tower"], "The CN Tower in Toronto is 553.3 m. The Eiffel Tower, antennas included, is 330 m.", "Wikipedia: CN Tower", "https://en.wikipedia.org/wiki/CN_Tower", CC, "inventions", 2),
  question("q-inv-empire", "How tall is the Empire State Building, to the tip of its antenna?", "estimate", "higher", ["f-empire"], ["f-empire"], "The building's own fact sheet gives 1,454 feet to the tip, about 443.2 metres.", "Empire State Building", "https://www.esbnyc.com/about/facts-figures", "Official building fact sheet", "inventions", 2, "m", "length-m"),
  question("q-inv-first", "Which came first?", "compare", "lower", ["f-railway", "f-wright"], ["f-wright", "f-railway"], "The Stockton and Darlington Railway opened in 1825. The Wright Flyer flew at Kitty Hawk in 1903.", "Smithsonian National Air and Space Museum", "https://airandspace.si.edu/collection-objects/1903-wright-flyer/nasm_A19610048000", PD, "inventions", 1),

  question("q-land-pyramid", "What was the original height of the Great Pyramid of Giza?", "estimate", "higher", ["f-pyramid-height"], ["f-pyramid-height"], "The Great Pyramid originally rose about 146.6 m. The outer casing is gone, so it stands a little lower today.", "Wikipedia: Great Pyramid of Giza", "https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza", CC, "history", 2, "m", "length-m"),
  question("q-land-older", "Which document is older?", "compare", "lower", ["f-magna", "f-declaration"], ["f-declaration", "f-magna"], "Magna Carta was sealed in 1215. The Declaration of Independence was adopted in 1776.", "Wikipedia: Magna Carta", "https://en.wikipedia.org/wiki/Magna_Carta", CC, "history", 1),
  question("q-land-timeline", "Order these from oldest to newest.", "rank", "lower", ["f-pyramid-year", "f-parthenon", "f-colosseum", "f-taj"], ["f-taj", "f-colosseum", "f-pyramid-year", "f-parthenon"], "Conventional completion dates: the Great Pyramid around 2560 BCE, the Parthenon in 438 BCE, the Colosseum in 80 CE, and the Taj Mahal complex in 1653. The pyramid's exact year is debated; the order is not.", "Wikipedia: Great Pyramid of Giza", "https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza", CC, "history", 2),
  question("q-land-liberty", "How tall is the Statue of Liberty from the ground to the tip of the torch?", "estimate", "higher", ["f-liberty-total"], ["f-liberty-total"], "The National Park Service lists the height from the ground to the tip of the torch as 92.99 metres. The figure of Liberty herself is 46 metres; the rest is the pedestal.", "U.S. National Park Service", "https://www.nps.gov/stli/learn/historyculture/statue-statistics.htm", PD, "culture", 2, "m", "length-m"),
  question("q-land-statues", "Which statue is taller, not counting its pedestal?", "compare", "higher", ["f-liberty-figure", "f-christ-statue"], ["f-christ-statue", "f-liberty-figure"], "Liberty's figure, from heel to torch, is 46.05 m. Christ the Redeemer's statue is 30 m, with a separate pedestal of about 8 m.", "U.S. National Park Service", "https://www.nps.gov/stli/learn/historyculture/statue-statistics.htm", PD, "culture", 2),

  question("q-nat-whale", "About how long can the largest blue whales grow?", "estimate", "higher", ["f-whale-length"], ["f-whale-length"], "NOAA describes the largest blue whales as reaching about 30 metres. Most individuals are shorter. They are the largest animals known to have lived.", "NOAA Fisheries", "https://www.fisheries.noaa.gov/species/blue-whale", PD, "nature", 2, "m", "length-m"),
  question("q-nat-heavy", "Which is heavier?", "compare", "higher", ["f-whale-mass", "f-elephant-mass"], ["f-elephant-mass", "f-whale-mass"], "A large blue whale weighs on the order of 150 tonnes. A large male African savanna elephant is about 6 tonnes.", "NOAA Fisheries", "https://www.fisheries.noaa.gov/species/blue-whale", PD, "nature", 1),
  question("q-nat-masses", "Order these by typical adult body mass, lightest first.", "rank", "lower", ["f-mouse-mass", "f-penguin-mass", "f-bear-mass", "f-hippo-mass"], ["f-bear-mass", "f-mouse-mass", "f-hippo-mass", "f-penguin-mass"], "Typical masses, not records: a house mouse around 20 grams, an emperor penguin around 30 kg, a male polar bear around 450 kg, and a large male hippo around 1,500 kg. Individuals vary, and the order does not.", "Wikipedia: Hippopotamus", "https://en.wikipedia.org/wiki/Hippopotamus", CC, "nature", 1),
  question("q-nat-wings", "What is the wingspan of the largest wandering albatrosses?", "estimate", "higher", ["f-albatross"], ["f-albatross"], "The wandering albatross has the largest wingspan of any living bird, up to about 3.5 metres. It spends most of its life gliding over the Southern Ocean.", "Britannica: wandering albatross", "https://www.britannica.com/animal/wandering-albatross", "Encyclopaedia Britannica (sample citation)", "nature", 2, "m", "length-m"),
  question("q-nat-gestation", "Which pregnancy lasts longer?", "compare", "higher", ["f-elephant-gestation", "f-human-gestation"], ["f-human-gestation", "f-elephant-gestation"], "African elephant pregnancies last about 22 months, near 660 days. A typical human pregnancy is counted as about 280 days.", "Wikipedia: African bush elephant", "https://en.wikipedia.org/wiki/African_bush_elephant", CC, "nature", 1),

  question("q-geo-un", "How many member states does the United Nations have?", "estimate", "higher", ["f-un-members"], ["f-un-members"], "The United Nations has 193 member states. That count has been stable since South Sudan joined in 2011. The Holy See and Palestine are observer states, not members.", "United Nations", "https://www.un.org/en/about-us/member-states", "United Nations public information", "geography", 1, "member states", "count"),
  question("q-geo-canada", "Which country has the larger total area, including inland water?", "compare", "higher", ["f-canada-area", "f-china-area"], ["f-china-area", "f-canada-area"], "The CIA World Factbook lists Canada at 9,984,670 km² and China at 9,596,960 km². Inland water is included, which is why this is not a land-only ranking.", "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/canada/", PD, "geography", 2),
  question("q-geo-areas", "Order these by total area, smallest first.", "rank", "lower", ["f-vatican-area", "f-japan-area", "f-mexico-area", "f-brazil-area"], ["f-brazil-area", "f-vatican-area", "f-mexico-area", "f-japan-area"], "Vatican City is under half a square kilometre. Japan is about 378,000 km², Mexico about 2.0 million, and Brazil about 8.5 million.", "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/brazil/", PD, "geography", 1),
  question("q-geo-russia", "What is the total area of Russia, including inland water?", "estimate", "higher", ["f-russia-area"], ["f-russia-area"], "The CIA World Factbook gives Russia a total area of 17,098,242 km². It is the largest country on Earth by area.", "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/russia/", PD, "geography", 2, "km²", "area-km2"),
  question("q-geo-brazil", "Which country has the larger total area?", "compare", "higher", ["f-india-area", "f-australia-area"], ["f-india-area", "f-australia-area"], "In the CIA World Factbook, Australia is 7,741,220 km² and India is 3,287,263 km².", "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/australia/", PD, "geography", 2),

  question("q-sci-c14", "What is the half-life of carbon-14, in years?", "estimate", "higher", ["f-c14"], ["f-c14"], "NIST describes carbon-14's half-life as about 5,730 years. Radiocarbon labs still use an older conventional Libby value of 5,568 years for some calculations. This question uses 5,730.", "NIST", "https://www.nist.gov/how-do-you-measure-it/how-do-you-know-age-fossils-and-other-old-things", PD, "science", 2, "years", "years"),
  question("q-sci-melt", "Which metal has the higher melting point?", "compare", "higher", ["f-aluminum-melt", "f-copper-melt"], ["f-aluminum-melt", "f-copper-melt"], "Copper melts at about 1,085 °C. Aluminium melts at about 660 °C. Both are the ordinary-pressure values from the Royal Society of Chemistry.", "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/29/copper", "Royal Society of Chemistry periodic table", "science", 2),
  question("q-sci-metals", "Order these metals by melting point, lowest first.", "rank", "lower", ["f-tin-melt", "f-gold-melt", "f-iron-melt", "f-tungsten-melt"], ["f-tungsten-melt", "f-tin-melt", "f-iron-melt", "f-gold-melt"], "At ordinary pressure, tin melts near 232 °C, gold near 1,064 °C, iron near 1,538 °C, and tungsten near 3,422 °C.", "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/74/tungsten", "Royal Society of Chemistry periodic table", "science", 2),
  question("q-sci-sound", "How fast does sound travel in dry air at 20 °C?", "estimate", "higher", ["f-sound"], ["f-sound"], "In dry air at 20 °C, sound travels at about 343 metres per second. The speed rises as the air gets warmer, so the temperature is part of the question.", "Wikipedia: Speed of sound", "https://en.wikipedia.org/wiki/Speed_of_sound", CC, "science", 2, "m/s", "speed-ms"),
  question("q-sci-atomic", "Which element has the higher atomic number?", "compare", "higher", ["f-gold-z", "f-lead-z"], ["f-gold-z", "f-lead-z"], "Gold is element 79. Lead is element 82. Atomic number is the proton count, and it is exact.", "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/82/lead", "Royal Society of Chemistry periodic table", "science", 1),

  question("q-cul-marathon", "How long is a standard marathon?", "estimate", "higher", ["f-marathon"], ["f-marathon"], "World Athletics sets the marathon at 42.195 km, the distance standardized from the 1908 London course.", "World Athletics", "https://worldathletics.org/disciplines/road-running/marathon", "World Athletics competition rules", "culture", 1, "km", "distance-km"),
  question("q-cul-premiere", "Which book was published earlier?", "compare", "lower", ["f-principia", "f-origin"], ["f-origin", "f-principia"], "Newton's Principia was published in 1687. Darwin's On the Origin of Species was published in 1859.", "Wikipedia: Philosophiæ Naturalis Principia Mathematica", "https://en.wikipedia.org/wiki/Philosophi%C3%A6_Naturalis_Principia_Mathematica", CC, "culture", 2),
  question("q-cul-works", "Order these works by the year of their first performance, earliest first.", "rank", "lower", ["f-figaro", "f-beethoven", "f-rite", "f-messiaen"], ["f-rite", "f-figaro", "f-messiaen", "f-beethoven"], "Figaro opened in 1786, Beethoven's Ninth in 1824, The Rite of Spring in 1913, and Messiaen's Quartet for the End of Time in a prisoner-of-war camp in 1941.", "Wikipedia: The Marriage of Figaro", "https://en.wikipedia.org/wiki/The_Marriage_of_Figaro", CC, "culture", 3),
  question("q-cul-paintings", "Which painting has the larger surface area?", "compare", "higher", ["f-mona", "f-guernica"], ["f-mona", "f-guernica"], "The Mona Lisa is 77 cm by 53 cm, under half a square metre. Guernica is 349.3 cm by 776.6 cm, about 27 square metres.", "Museo Reina Sofía", "https://www.museoreinasofia.es/en/collections/artwork/guernica", "Museo Reina Sofía collection record", "culture", 1),
  question("q-cul-shakespeare", "In what year was William Shakespeare born?", "estimate", "higher", ["f-shakespeare"], ["f-shakespeare"], "Parish records show Shakespeare's baptism on 26 April 1564. His birthday is traditionally marked on 23 April, but the birth date itself was not written down. The year was.", "Wikipedia: William Shakespeare", "https://en.wikipedia.org/wiki/William_Shakespeare", CC, "culture", 1, "year", "years"),

  question("q-long-equator", "What is the equatorial circumference of Earth?", "estimate", "higher", ["f-equator"], ["f-equator"], "NASA's planetary fact sheet lists Earth's equatorial circumference as 40,075 km. The polar circumference is a little shorter because Earth is not a perfect sphere.", "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html", PD, "geography", 2, "km", "distance-km"),
  question("q-long-span", "Which distance is longer?", "compare", "higher", ["f-moon-distance", "f-sun-distance"], ["f-moon-distance", "f-sun-distance"], "The Moon's average distance is 384,400 km. Earth's average distance from the Sun is about 149.6 million km, roughly 400 times farther.", "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html", PD, "space", 1),
  question("q-long-rocky", "Order these planets by equatorial diameter, smallest first.", "rank", "lower", ["f-mercury-diameter", "f-mars-diameter", "f-venus-diameter", "f-earth-diameter"], ["f-earth-diameter", "f-mercury-diameter", "f-venus-diameter", "f-mars-diameter"], "Mercury is the smallest, then Mars, then Venus, then Earth. Venus is only slightly smaller than Earth. Diameters are the equatorial figures from NASA's fact sheets.", "NASA Planetary Fact Sheet", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/", PD, "space", 2),
  question("q-long-elements", "How many chemical elements are on the periodic table?", "estimate", "higher", ["f-elements"], ["f-elements"], "IUPAC's periodic table currently lists 118 confirmed elements. The last of the newest names were adopted in 2016.", "IUPAC", "https://iupac.org/what-we-do/periodic-table-of-elements/", "IUPAC", "science", 1, "elements", "count"),
  question("q-long-trenches", "Which ocean trench is deeper?", "compare", "higher", ["f-challenger", "f-puerto-rico"], ["f-puerto-rico", "f-challenger"], "Challenger Deep reaches about 10,935 m. The Puerto Rico Trench, the deepest part of the Atlantic, is about 8,400 m.", "NOAA Ocean Exploration", "https://oceanexplorer.noaa.gov/ocean-fact/ocean-depth/", PD, "geography", 2),
];

const baseNamed: SeedQuestion[] = baseQuestions.map((item) => {
  const named = nameOneById.get(item.id);
  if (!named) return item;
  return {
    ...item,
    prompt: named.prompt,
    type: "name_one",
    factIds: [],
    displayIds: [],
    unit: null,
    scale: null,
    context: named.context,
    sourceUrl: named.sourceUrl,
    sourceName: named.sourceName,
    license: named.license,
    topic: named.topic,
    difficulty: named.difficulty,
    accepted: named.accepted,
    entitySet: named.entitySet,
  };
});

const olderPuzzles: SeedPuzzle[] = [
  { slot: 0, theme: "Space", blurb: "Planets, moons, moonwalkers, bright stars, constellations, and a couple of maps.", questionIds: ["q-space-moon", "q-space-giants", "q-space-orbits", "q-space-light", "q-space-year"] },
  { slot: 1, theme: "Planet Earth", blurb: "High peaks, long rivers, five oceans, layers of sky, European seas, and some rare gases.", questionIds: ["q-earth-everest", "q-earth-seas", "q-earth-oceans", "q-earth-trench", "q-earth-peaks"] },
  { slot: 2, theme: "The human body", blurb: "Bones, organs, muscles, hormones, the brain, and a little chemistry.", questionIds: ["q-body-bones", "q-body-lungs", "q-body-counts", "q-body-neurons", "q-body-gut"] },
  { slot: 3, theme: "Inventions", blurb: "Old machines, strings, woodwinds, browsers, code, and some very small countries.", questionIds: ["q-inv-order", "q-inv-piano", "q-inv-towers", "q-inv-empire", "q-inv-first"] },
  { slot: 4, theme: "Landmarks", blurb: "Wonders, Olympic cities, tall towers, pyramids, Disney castles, and the biggest countries.", questionIds: ["q-land-pyramid", "q-land-older", "q-land-timeline", "q-land-liberty", "q-land-statues"] },
  { slot: 5, theme: "Living world", blurb: "Whales, wild cats, apes, sharks, flightless birds, and two maps.", questionIds: ["q-nat-whale", "q-nat-heavy", "q-nat-masses", "q-nat-wings", "q-nat-gestation"] },
  { slot: 6, theme: "Maps", blurb: "Borders, flags, coastlines, the alphabet, and the Security Council.", questionIds: ["q-geo-un", "q-geo-canada", "q-geo-areas", "q-geo-russia", "q-geo-brazil"] },
  { slot: 7, theme: "Laboratory", blurb: "Gases, coin metals, school lab kit, and elements named after places and people.", questionIds: ["q-sci-c14", "q-sci-melt", "q-sci-metals", "q-sci-sound", "q-sci-atomic"] },
  { slot: 8, theme: "Culture", blurb: "Sports, paintings, plays, Hogwarts, World Cups, and the far north.", questionIds: ["q-cul-marathon", "q-cul-premiere", "q-cul-works", "q-cul-paintings", "q-cul-shakespeare"] },
  { slot: 9, theme: "Measured Earth", blurb: "The equator, the tropics, Greenwich, deserts, the Caribbean, and the heavy end of the periodic table.", questionIds: ["q-long-equator", "q-long-span", "q-long-rocky", "q-long-elements", "q-long-trenches"] },
];

/** Each older day gets its two extra questions from seven.ts on the end. */
const basePuzzles: SeedPuzzle[] = olderPuzzles.map((item) => {
  const more = moreBase[item.theme];
  if (!more) throw new Error(`No extra questions for ${item.theme}`);
  return { ...item, questionIds: [...item.questionIds, ...more.map((extra) => extra.id)] };
});

/** A name-one question that has no older numeric version to replace. */
function fromNameOne(named: NameOneSeed): SeedQuestion {
  return {
    id: named.id,
    prompt: named.prompt,
    type: "name_one",
    unit: null,
    polarity: "higher",
    scale: null,
    factIds: [],
    displayIds: [],
    context: named.context,
    sourceUrl: named.sourceUrl,
    sourceName: named.sourceName,
    retrievedAt: ON,
    license: named.license,
    topic: named.topic,
    difficulty: named.difficulty,
    verified: false,
    accepted: named.accepted,
    entitySet: named.entitySet,
  };
}

export const questions: SeedQuestion[] = [
  ...[
    ...baseNamed,
    ...Object.values(moreBase).flat().map(fromNameOne),
    ...funNameOne.map(fromNameOne),
    ...packNameOne.map(fromNameOne),
    ...journeyNameOne.map(fromNameOne),
  ].map((item) => ({ ...item, nudge: NUDGES[item.id] ?? null })),
  // The added days carry their own nudges.
  ...addedNameOne.map((item) => ({ ...fromNameOne(item), nudge: item.nudge })),
];

/** The fun week opens the rotation and the older themes follow it. The added days come after both, from LEGACY_SLOTS. */
export const puzzles: SeedPuzzle[] = [
  ...funDays.map((day, slot) => ({ slot, ...day })),
  ...basePuzzles.map((item) => ({ ...item, slot: item.slot + funDays.length })),
  ...addedDays.map((day, index) => ({ slot: LEGACY_SLOTS + index, ...day })),
];

/** Unlimited draws from every daily question. The server holds back days that have not run yet. */
export const unlimitedPool: string[] = puzzles.flatMap((puzzle) => puzzle.questionIds);

export const facts: SeedFact[] = [
  ...baseFacts.map((item) => {
    const metric = metricForExisting[item.id];
    if (!metric) throw new Error(`Missing metric for ${item.id}`);
    return { ...item, metric };
  }),
  ...extraFacts,
];

export function assertSeed(): void {
  const factById = new Map(facts.map((item) => [item.id, item]));
  if (factById.size !== facts.length) throw new Error("Duplicate fact id");
  const questionById = new Map(questions.map((item) => [item.id, item]));
  if (questionById.size !== questions.length) throw new Error("Duplicate question id");
  const chapters = packs.flatMap((pack) => pack.chapters);
  const expectedQuestions = SEED_SLOTS * CLASSIC_QUESTIONS + chapters.length * PACK_QUESTIONS;
  if (questions.length !== expectedQuestions) throw new Error(`Expected ${expectedQuestions} questions, found ${questions.length}`);
  if (puzzles.length !== SEED_SLOTS) throw new Error(`Expected ${SEED_SLOTS} puzzles`);
  if (funDays.length + basePuzzles.length !== LEGACY_SLOTS) throw new Error(`Expected ${LEGACY_SLOTS} days before the added ones`);
  if (packs.length !== 3) throw new Error("Expected 3 packs");
  assertNudges();

  for (const item of facts) {
    if (item.verified !== false) throw new Error(`${item.id} must stay unverified in the sample`);
    if (!item.sourceUrl.startsWith("https://")) throw new Error(`${item.id} needs an https source`);
    if (!Number.isFinite(item.value)) throw new Error(`${item.id} has a bad value`);
    if (!item.metric) throw new Error(`${item.id} needs a metric`);
    if (item.metric !== "unpaired" && !METRIC_COPY[item.metric]) throw new Error(`${item.id} has unknown metric ${item.metric}`);
  }
  if (facts.length < 150) throw new Error(`Head-to-head needs at least 150 facts, found ${facts.length}`);

  const seenSlots = new Set<number>();
  for (const puzzle of puzzles) {
    if (seenSlots.has(puzzle.slot)) throw new Error(`Duplicate slot ${puzzle.slot}`);
    seenSlots.add(puzzle.slot);
  }
  const seenPacks = new Set<string>();
  for (const pack of packs) {
    if (!/^[a-z0-9-]{2,24}$/.test(pack.id)) throw new Error(`Pack id ${pack.id} must be short lowercase words`);
    if (seenPacks.has(pack.id)) throw new Error(`Duplicate pack ${pack.id}`);
    seenPacks.add(pack.id);
    if (!pack.route) throw new Error(`Pack ${pack.id} needs a route`);
    if (pack.chapters.length !== 3) throw new Error(`Pack ${pack.id} needs 3 chapters`);
    if (pack.chapters[0]!.questionIds.join(",") !== pack.questionIds.join(",")) throw new Error(`Pack ${pack.id} chapter 1 must be its own questions`);
    for (const chapter of pack.chapters) {
      if (!chapter.title || chapter.title.length > 24) throw new Error(`Pack ${pack.id} has a bad chapter title "${chapter.title}"`);
      if (chapter.blurb.length < 10 || chapter.blurb.length > 80) throw new Error(`Pack ${pack.id} chapter ${chapter.title} needs a blurb of 10 to 80 characters`);
    }
  }
  if (new Set(unlimitedPool).size !== unlimitedPool.length) throw new Error("Unlimited pool repeats a question");
  // Every question plays in exactly one daily puzzle or one pack, so a pack never repeats a daily question.
  const rounds = [
    ...puzzles.map((item) => ({ theme: item.theme, questionIds: item.questionIds, size: CLASSIC_QUESTIONS })),
    ...packs.flatMap((pack) => pack.chapters.map((chapter) => ({ theme: `${pack.title} · ${chapter.title}`, questionIds: chapter.questionIds, size: PACK_QUESTIONS }))),
  ];
  const placed = new Set<string>();
  for (const puzzle of rounds) {
    if (puzzle.questionIds.length !== puzzle.size) throw new Error(`${puzzle.theme} does not have ${puzzle.size} questions`);
    for (const questionId of puzzle.questionIds) {
      if (placed.has(questionId)) throw new Error(`${questionId} is used twice`);
      placed.add(questionId);
    }
    const usedFacts = new Set<string>();
    const types = new Set<string>();
    for (const questionId of puzzle.questionIds) {
      const item = questionById.get(questionId);
      if (!item) throw new Error(`Missing question ${questionId}`);
      types.add(item.type);
      const expected = [...item.factIds].sort().join(",");
      const shown = [...item.displayIds].sort().join(",");
      if (expected !== shown) throw new Error(`${item.id} display ids are not a permutation`);
      if (item.type === "rank" && item.displayIds.join(",") === item.factIds.join(",")) {
        throw new Error(`${item.id} shows the correct rank order`);
      }
      for (const factId of item.factIds) {
        if (usedFacts.has(factId)) throw new Error(`${puzzle.theme} reuses ${factId}`);
        usedFacts.add(factId);
        const source = factById.get(factId);
        if (!source) throw new Error(`${item.id} references missing ${factId}`);
      }
      if (item.type === "estimate") {
        if (item.factIds.length !== 1 || !item.scale || !item.unit) throw new Error(`${item.id} is a bad estimate`);
        const value = factById.get(item.factIds[0])!.value;
        if (!(value > 0)) throw new Error(`${item.id} estimate must be positive`);
        if (item.prompt.includes(String(value))) throw new Error(`${item.id} prompt contains its answer`);
      } else if (item.type === "compare") {
        if (item.factIds.length !== 2) throw new Error(`${item.id} needs two facts`);
        const [left, right] = item.factIds.map((id) => factById.get(id)!);
        if (left.value === right.value) throw new Error(`${item.id} is a tie`);
        const units = new Set(item.factIds.map((id) => factById.get(id)!.unit));
        if (units.size !== 1) throw new Error(`${item.id} mixes units`);
      } else if (item.type === "name_one") {
        if (item.factIds.length !== 0 || !item.accepted || item.accepted.length < 5) {
          throw new Error(`${item.id} is a bad name-one question`);
        }
        const names = new Set(item.accepted.map((answer) => answer.canonical));
        if (names.size !== item.accepted.length) throw new Error(`${item.id} repeats a canonical answer`);
        const spellings = new Map<string, string>();
        for (const answer of item.accepted) {
          for (const name of [answer.canonical, ...answer.aliases]) {
            const key = normalizeAnswer(name);
            const owner = spellings.get(key);
            if (owner && owner !== answer.canonical) throw new Error(`${item.id} gives "${name}" to two answers`);
            spellings.set(key, answer.canonical);
          }
        }
        // A countries or elements question must use the group's own spellings. Players never see the group as a list.
        const suggestions = item.entitySet ? new Set(suggestionsFor(item.entitySet)) : null;
        if (suggestions) {
          const pool = item.entitySet === "countries" ? COUNTRIES : ELEMENTS;
          if (suggestions.size !== pool.length) throw new Error(`${item.id} suggestions drifted`);
        }
        const promptWords = ` ${normalizeAnswer(item.prompt)} `;
        for (const answer of item.accepted) {
          if (!(answer.prior > 0)) throw new Error(`${item.id} needs a positive prior`);
          if (suggestions && !suggestions.has(answer.canonical)) throw new Error(`${item.id} has ${answer.canonical}, which is not in its ${item.entitySet} list`);
          if (promptWords.includes(` ${normalizeAnswer(answer.canonical)} `)) {
            throw new Error(`${item.id} prompt contains ${answer.canonical}`);
          }
        }
      } else if (item.factIds.length < 3 || item.factIds.length > 4) {
        throw new Error(`${item.id} rank needs 3 or 4 facts`);
      }
    }
    // Classic is open answers only: every question is "name one", scored by how rare the answer is.
    if (types.size !== 1 || !types.has("name_one")) throw new Error(`${puzzle.theme} must be all name-one questions`);
  }
  if (placed.size !== questions.length) throw new Error("Every question needs a puzzle or a pack chapter");
  for (let slot = 0; slot < SEED_SLOTS; slot += 1) {
    if (!seenSlots.has(slot)) throw new Error(`Slots must be 0 through ${SEED_SLOTS - 1}`);
  }
}

/** Every daily question has a nudge, no pack question has one, and no nudge spells out an accepted answer. */
function assertNudges(): void {
  const daily = new Set(puzzles.flatMap((puzzle) => puzzle.questionIds));
  for (const id of Object.keys(NUDGES)) {
    if (!daily.has(id)) throw new Error(`Nudge for ${id}, which is not a daily question`);
  }
  const problems: string[] = [];
  for (const item of questions) {
    if (!daily.has(item.id)) continue;
    const nudge = item.nudge ?? "";
    if (nudge.length < 10 || nudge.length > 140) problems.push(`${item.id} needs a nudge of 10 to 140 characters`);
    const words = ` ${normalizeAnswer(nudge).replace(/[^a-z0-9]+/g, " ").trim()} `;
    for (const answer of item.accepted ?? []) {
      for (const name of [answer.canonical, ...answer.aliases]) {
        const key = normalizeAnswer(name).replace(/[^a-z0-9]+/g, " ").trim();
        if (key.length >= 3 && words.includes(` ${key} `)) problems.push(`${item.id} nudge names "${name}"`);
      }
    }
  }
  if (problems.length > 0) throw new Error(problems.join("\n"));
}
