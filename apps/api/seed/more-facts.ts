/**
 * Extra SAMPLE facts so Head-to-head has comparable pairs.
 * verified is false. Figures are widely printed reference values, not an editorial sign-off.
 */
const ON = "2026-11-21";
const CC = "CC BY-SA 4.0";
const PD = "Public domain (U.S. government work)";

type Extra = {
  id: string;
  label: string;
  value: number;
  unit: string;
  metric: string;
  topic: string;
  difficulty: 1 | 2 | 3;
  sourceName: string;
  sourceUrl: string;
  license: string;
  context: string;
  vintage: string | null;
  retrievedAt: string;
  verified: false;
};

function row(
  id: string,
  label: string,
  value: number,
  unit: string,
  metric: string,
  topic: string,
  sourceName: string,
  sourceUrl: string,
  license: string,
  context: string,
  vintage: string | null = null,
  difficulty: 1 | 2 | 3 = 2,
): Extra {
  return {
    id,
    label,
    value,
    unit,
    metric,
    topic,
    difficulty,
    sourceName,
    sourceUrl,
    license,
    context,
    vintage,
    retrievedAt: ON,
    verified: false,
  };
}

const POP = "https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population";
const GDP = "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD";
const RIVERS = "https://en.wikipedia.org/wiki/List_of_rivers_by_length";
const PEAKS = "https://en.wikipedia.org/wiki/List_of_highest_mountains_on_Earth";
const SPEED = "https://en.wikipedia.org/wiki/Fastest_animals";
const NASA = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/";

export const extraFacts: Extra[] = [
  row("f-pop-india", "India", 1_441_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded from the UN-based country population list. India is the world's most populous country.", "UN-based list, rounded"),
  row("f-pop-china", "China", 1_425_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded from the same UN-based list. China is a very close second.", "UN-based list, rounded"),
  row("f-pop-usa", "United States", 345_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for the United States from the UN-based list.", "UN-based list, rounded"),
  row("f-pop-indonesia", "Indonesia", 283_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Indonesia.", "UN-based list, rounded"),
  row("f-pop-pakistan", "Pakistan", 251_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Pakistan.", "UN-based list, rounded"),
  row("f-pop-nigeria", "Nigeria", 232_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Nigeria, Africa's most populous country.", "UN-based list, rounded"),
  row("f-pop-brazil", "Brazil", 216_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Brazil.", "UN-based list, rounded"),
  row("f-pop-bangladesh", "Bangladesh", 174_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Bangladesh.", "UN-based list, rounded"),
  row("f-pop-russia", "Russia", 144_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Russia.", "UN-based list, rounded"),
  row("f-pop-ethiopia", "Ethiopia", 132_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Ethiopia.", "UN-based list, rounded"),
  row("f-pop-mexico", "Mexico", 130_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Mexico.", "UN-based list, rounded"),
  row("f-pop-japan", "Japan", 123_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Japan.", "UN-based list, rounded"),
  row("f-pop-philippines", "Philippines", 117_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for the Philippines.", "UN-based list, rounded"),
  row("f-pop-egypt", "Egypt", 114_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Egypt.", "UN-based list, rounded"),
  row("f-pop-vietnam", "Vietnam", 100_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Vietnam.", "UN-based list, rounded"),
  row("f-pop-germany", "Germany", 84_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Germany.", "UN-based list, rounded"),
  row("f-pop-uk", "United Kingdom", 69_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for the United Kingdom.", "UN-based list, rounded"),
  row("f-pop-france", "France", 66_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for France.", "UN-based list, rounded"),
  row("f-pop-korea", "South Korea", 52_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for South Korea.", "UN-based list, rounded"),
  row("f-pop-canada", "Canada", 40_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Canada.", "UN-based list, rounded"),
  row("f-pop-australia", "Australia", 27_000_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Australia.", "UN-based list, rounded"),
  row("f-pop-nz", "New Zealand", 5_200_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for New Zealand.", "UN-based list, rounded"),
  row("f-pop-iceland", "Iceland", 390_000, "people", "country-population", "geography", "Wikipedia population list", POP, CC, "Rounded population for Iceland.", "UN-based list, rounded"),

  row("f-gdp-us", "United States", 27_361_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "United States GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-china", "China", 17_795_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "China GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-germany", "Germany", 4_456_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "Germany GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-japan", "Japan", 4_213_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "Japan GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-india", "India", 3_568_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "India GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-uk", "United Kingdom", 3_340_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "United Kingdom GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-france", "France", 3_031_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "France GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-italy", "Italy", 2_255_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "Italy GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-brazil", "Brazil", 2_174_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "Brazil GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-canada", "Canada", 2_140_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "Canada GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-korea", "South Korea", 1_713_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "South Korea GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-spain", "Spain", 1_581_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "Spain GDP, 2023, current US dollars, rounded.", "World Bank 2023"),
  row("f-gdp-iceland", "Iceland", 31_000_000_000, "US dollars", "country-gdp", "geography", "World Bank", GDP, "CC BY 4.0 (World Bank terms apply)", "Iceland GDP, 2023, current US dollars, rounded.", "World Bank 2023"),

  row("f-area-algeria", "Algeria", 2_381_741, "km²", "country-area", "geography", "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/algeria/", PD, "Algeria's total area in the CIA World Factbook.", "CIA World Factbook"),
  row("f-area-argentina", "Argentina", 2_780_400, "km²", "country-area", "geography", "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/argentina/", PD, "Argentina's total area in the CIA World Factbook.", "CIA World Factbook"),
  row("f-area-kazakhstan", "Kazakhstan", 2_724_900, "km²", "country-area", "geography", "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/kazakhstan/", PD, "Kazakhstan's total area in the CIA World Factbook.", "CIA World Factbook"),
  row("f-area-france", "France", 643_801, "km²", "country-area", "geography", "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/france/", PD, "France's total area, including overseas territory as listed by the Factbook.", "CIA World Factbook"),
  row("f-area-germany", "Germany", 357_022, "km²", "country-area", "geography", "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/germany/", PD, "Germany's total area in the CIA World Factbook.", "CIA World Factbook"),
  row("f-area-uk", "United Kingdom", 243_610, "km²", "country-area", "geography", "CIA World Factbook", "https://www.cia.gov/the-world-factbook/countries/united-kingdom/", PD, "The United Kingdom's total area in the CIA World Factbook.", "CIA World Factbook"),

  row("f-river-nile", "Nile", 6650, "km", "river-length", "geography", "Wikipedia river-length list", RIVERS, CC, "A commonly printed length for the Nile. River lengths depend on the source branch that is counted.", "Encyclopedia length"),
  row("f-river-amazon", "Amazon", 6400, "km", "river-length", "geography", "Wikipedia river-length list", RIVERS, CC, "A commonly printed length for the Amazon. Some surveys make it longer than the Nile.", "Encyclopedia length"),
  row("f-river-yangtze", "Yangtze", 6300, "km", "river-length", "geography", "Wikipedia river-length list", RIVERS, CC, "A commonly printed length for the Yangtze.", "Encyclopedia length"),
  row("f-river-mississippi", "Mississippi–Missouri", 6275, "km", "river-length", "geography", "Wikipedia river-length list", RIVERS, CC, "Length of the Mississippi–Missouri system as usually listed.", "Encyclopedia length"),
  row("f-river-yenisei", "Yenisei", 5539, "km", "river-length", "geography", "Wikipedia river-length list", RIVERS, CC, "A commonly printed length for the Yenisei–Angara system.", "Encyclopedia length"),
  row("f-river-congo", "Congo", 4700, "km", "river-length", "geography", "Wikipedia river-length list", RIVERS, CC, "A commonly printed length for the Congo.", "Encyclopedia length"),
  row("f-river-mekong", "Mekong", 4350, "km", "river-length", "geography", "Wikipedia river-length list", RIVERS, CC, "A commonly printed length for the Mekong.", "Encyclopedia length"),
  row("f-river-danube", "Danube", 2850, "km", "river-length", "geography", "Wikipedia river-length list", RIVERS, CC, "The Danube is usually listed at about 2,850 km.", "Encyclopedia length"),
  row("f-river-rhine", "Rhine", 1230, "km", "river-length", "geography", "Wikipedia river-length list", RIVERS, CC, "The Rhine is usually listed at about 1,230 km.", "Encyclopedia length"),
  row("f-river-thames", "Thames", 346, "km", "river-length", "geography", "Wikipedia river-length list", RIVERS, CC, "The Thames is about 346 km from source to estuary.", "Encyclopedia length"),

  row("f-peak-k2", "K2", 8611, "m", "mountain-height", "geography", "Wikipedia highest-mountains list", PEAKS, CC, "K2 is the second-highest mountain, at 8,611 m.", "Surveyed elevation"),
  row("f-peak-kangchenjunga", "Kangchenjunga", 8586, "m", "mountain-height", "geography", "Wikipedia highest-mountains list", PEAKS, CC, "Kangchenjunga is 8,586 m, third among the 8,000-metre peaks.", "Surveyed elevation"),
  row("f-peak-aconcagua", "Aconcagua", 6961, "m", "mountain-height", "geography", "Wikipedia: Aconcagua", "https://en.wikipedia.org/wiki/Aconcagua", CC, "Aconcagua, in the Andes, is 6,961 m and the highest peak outside Asia.", "Surveyed elevation"),
  row("f-peak-elbrus", "Elbrus", 5642, "m", "mountain-height", "geography", "Wikipedia: Mount Elbrus", "https://en.wikipedia.org/wiki/Mount_Elbrus", CC, "Mount Elbrus in the Caucasus is 5,642 m.", "Surveyed elevation"),
  row("f-peak-blanc", "Mont Blanc", 4806, "m", "mountain-height", "geography", "Wikipedia: Mont Blanc", "https://en.wikipedia.org/wiki/Mont_Blanc", CC, "Mont Blanc is about 4,806 m, the highest peak in the Alps. The snow cap changes the exact figure.", "Recent survey, rounded"),
  row("f-peak-fuji", "Fuji", 3776, "m", "mountain-height", "geography", "Wikipedia: Mount Fuji", "https://en.wikipedia.org/wiki/Mount_Fuji", CC, "Mount Fuji is 3,776 m.", "Surveyed elevation"),
  row("f-peak-cook", "Aoraki / Mount Cook", 3724, "m", "mountain-height", "geography", "Wikipedia: Aoraki / Mount Cook", "https://en.wikipedia.org/wiki/Aoraki_/_Mount_Cook", CC, "Aoraki / Mount Cook is 3,724 m after a 1991 rockfall lowered the summit.", "Post-1991 elevation"),
  row("f-peak-kosciuszko", "Kosciuszko", 2228, "m", "mountain-height", "geography", "Wikipedia: Mount Kosciuszko", "https://en.wikipedia.org/wiki/Mount_Kosciuszko", CC, "Mount Kosciuszko, Australia's highest peak, is 2,228 m.", "Surveyed elevation"),

  row("f-saturn-distance", "Saturn", 1_433_500_000, "km", "planet-distance", "space", "NASA Planetary Fact Sheet", NASA, PD, "Saturn's average distance from the Sun is about 1.43 billion km.", "NASA fact sheet"),
  row("f-uranus-distance", "Uranus", 2_872_500_000, "km", "planet-distance", "space", "NASA Planetary Fact Sheet", NASA, PD, "Uranus orbits at about 2.87 billion km from the Sun.", "NASA fact sheet"),
  row("f-neptune-distance", "Neptune", 4_495_100_000, "km", "planet-distance", "space", "NASA Planetary Fact Sheet", NASA, PD, "Neptune's average distance from the Sun is about 4.50 billion km.", "NASA fact sheet"),
  row("f-jupiter-distance", "Jupiter", 778_600_000, "km", "planet-distance", "space", "NASA Planetary Fact Sheet", NASA, PD, "Jupiter's average distance from the Sun is about 779 million km.", "NASA fact sheet"),
  row("f-saturn-diameter", "Saturn", 120_536, "km", "planet-diameter", "space", "NASA Planetary Fact Sheet", NASA, PD, "Saturn's equatorial diameter is about 120,536 km.", "NASA fact sheet"),
  row("f-uranus-diameter", "Uranus", 51_118, "km", "planet-diameter", "space", "NASA Planetary Fact Sheet", NASA, PD, "Uranus's equatorial diameter is about 51,118 km.", "NASA fact sheet"),
  row("f-neptune-diameter", "Neptune", 49_528, "km", "planet-diameter", "space", "NASA Planetary Fact Sheet", NASA, PD, "Neptune's equatorial diameter is about 49,528 km.", "NASA fact sheet"),
  row("f-mercury-year", "Mercury", 87.969, "days", "orbit-period", "space", "NASA Planetary Fact Sheet", NASA, PD, "Mercury's year is about 88 Earth days.", "NASA fact sheet"),
  row("f-venus-year", "Venus", 224.701, "days", "orbit-period", "space", "NASA Planetary Fact Sheet", NASA, PD, "Venus's year is about 225 Earth days.", "NASA fact sheet"),
  row("f-jupiter-year", "Jupiter", 4332.6, "days", "orbit-period", "space", "NASA Planetary Fact Sheet", NASA, PD, "Jupiter's year is about 4,333 Earth days, nearly 12 Earth years.", "NASA fact sheet"),
  row("f-neptune-year", "Neptune", 60_182, "days", "orbit-period", "space", "NASA Planetary Fact Sheet", NASA, PD, "Neptune's year is about 60,182 Earth days, roughly 165 Earth years.", "NASA fact sheet"),

  row("f-speed-cheetah", "Cheetah", 120, "km/h", "land-speed", "nature", "Wikipedia: Fastest animals", SPEED, CC, "A cheetah's top speed is widely given as about 120 km/h in a short sprint.", "Commonly cited top speed"),
  row("f-speed-pronghorn", "Pronghorn", 88, "km/h", "land-speed", "nature", "Wikipedia: Fastest animals", SPEED, CC, "The pronghorn is often credited with a top speed of about 88 km/h.", "Commonly cited top speed"),
  row("f-speed-lion", "Lion", 80, "km/h", "land-speed", "nature", "Wikipedia: Fastest animals", SPEED, CC, "A lion's short sprint is often listed around 80 km/h.", "Commonly cited top speed"),
  row("f-speed-ostrich", "Ostrich", 70, "km/h", "land-speed", "nature", "Wikipedia: Fastest animals", SPEED, CC, "An ostrich can run at about 70 km/h.", "Commonly cited top speed"),
  row("f-speed-horse", "Horse", 70, "km/h", "land-speed", "nature", "Wikipedia: Fastest animals", SPEED, CC, "A horse's gallop is often listed around 70 km/h. Racehorses vary.", "Commonly cited top speed"),
  row("f-speed-human", "Human", 44.7, "km/h", "land-speed", "nature", "Wikipedia: Footspeed", "https://en.wikipedia.org/wiki/Footspeed", CC, "Usain Bolt's 100 m world record averages about 37.6 km/h, with a peak near 44.7 km/h.", "Bolt peak, 2009"),
  row("f-speed-elephant", "African elephant", 40, "km/h", "land-speed", "nature", "Wikipedia: Fastest animals", SPEED, CC, "An African elephant can charge at about 40 km/h.", "Commonly cited top speed"),
  row("f-speed-giraffe", "Giraffe", 60, "km/h", "land-speed", "nature", "Wikipedia: Fastest animals", SPEED, CC, "A giraffe's gallop is often listed around 60 km/h.", "Commonly cited top speed"),

  row("f-mass-giraffe", "Giraffe", 1200, "kg", "animal-mass", "nature", "Wikipedia: Giraffe", "https://en.wikipedia.org/wiki/Giraffe", CC, "A large adult male giraffe is around 1,200 kg.", "Typical large male"),
  row("f-mass-tiger", "Tiger", 220, "kg", "animal-mass", "nature", "Wikipedia: Tiger", "https://en.wikipedia.org/wiki/Tiger", CC, "A large adult male tiger is around 220 kg. Subspecies differ.", "Typical large male"),
  row("f-mass-lion", "Lion", 190, "kg", "animal-mass", "nature", "Wikipedia: Lion", "https://en.wikipedia.org/wiki/Lion", CC, "A large adult male lion is around 190 kg.", "Typical large male"),
  row("f-mass-human", "Human", 70, "kg", "animal-mass", "nature", "Wikipedia: Human body weight", "https://en.wikipedia.org/wiki/Human_body_weight", CC, "70 kg is a round reference weight for an adult human, not a global average.", "Reference adult"),
  row("f-mass-horse", "Horse", 500, "kg", "animal-mass", "nature", "Wikipedia: Horse", "https://en.wikipedia.org/wiki/Horse", CC, "A typical riding horse is around 500 kg.", "Typical adult"),
  row("f-mass-cow", "Cow", 750, "kg", "animal-mass", "nature", "Wikipedia: Cattle", "https://en.wikipedia.org/wiki/Cattle", CC, "A mature cow is often around 750 kg. Breeds differ widely.", "Typical adult"),

  row("f-life-mouse", "House mouse", 2, "years", "lifespan", "nature", "Wikipedia: House mouse", "https://en.wikipedia.org/wiki/House_mouse", CC, "A house mouse typically lives about two years.", "Typical lifespan"),
  row("f-life-dog", "Dog", 12, "years", "lifespan", "nature", "Wikipedia: Aging in dogs", "https://en.wikipedia.org/wiki/Aging_in_dogs", CC, "A typical pet dog lives around 12 years. Breed changes that a lot.", "Typical lifespan"),
  row("f-life-cat", "Cat", 15, "years", "lifespan", "nature", "Wikipedia: Cat", "https://en.wikipedia.org/wiki/Cat", CC, "A pet cat often lives around 15 years.", "Typical lifespan"),
  row("f-life-horse", "Horse", 25, "years", "lifespan", "nature", "Wikipedia: Horse", "https://en.wikipedia.org/wiki/Horse", CC, "A horse often lives around 25 years.", "Typical lifespan"),
  row("f-life-elephant", "African elephant", 65, "years", "lifespan", "nature", "Wikipedia: African bush elephant", "https://en.wikipedia.org/wiki/African_bush_elephant", CC, "African elephants commonly live into their 60s in the wild.", "Typical lifespan"),
  row("f-life-human", "Human", 73, "years", "lifespan", "nature", "World Health Organization", "https://www.who.int/data/gho/data/themes/mortality-and-global-health-estimates/ghe-life-expectancy-and-healthy-life-expectancy", PD, "Global life expectancy at birth is about 73 years in recent WHO estimates. It is not a maximum lifespan.", "WHO global estimate"),
  row("f-life-tortoise", "Galápagos tortoise", 100, "years", "lifespan", "nature", "Wikipedia: Galápagos tortoise", "https://en.wikipedia.org/wiki/Gal%C3%A1pagos_tortoise", CC, "Galápagos tortoises regularly live past 100 years.", "Typical long lifespan"),
  row("f-life-bowhead", "Bowhead whale", 200, "years", "lifespan", "nature", "Wikipedia: Bowhead whale", "https://en.wikipedia.org/wiki/Bowhead_whale", CC, "Bowhead whales are thought to live around 200 years, the longest of any mammal.", "Estimated maximum"),

  row("f-height-burj", "Burj Khalifa", 828, "m", "landmark-height", "inventions", "Wikipedia: Burj Khalifa", "https://en.wikipedia.org/wiki/Burj_Khalifa", CC, "The Burj Khalifa is 828 m to its tip, the tallest building.", "Height to tip"),
  row("f-height-shanghai", "Shanghai Tower", 632, "m", "landmark-height", "inventions", "Wikipedia: Shanghai Tower", "https://en.wikipedia.org/wiki/Shanghai_Tower", CC, "Shanghai Tower is 632 m.", "Architectural height"),
  row("f-height-taipei", "Taipei 101", 508, "m", "landmark-height", "inventions", "Wikipedia: Taipei 101", "https://en.wikipedia.org/wiki/Taipei_101", CC, "Taipei 101 is 508 m.", "Architectural height"),
  row("f-height-shard", "The Shard", 310, "m", "landmark-height", "inventions", "Wikipedia: The Shard", "https://en.wikipedia.org/wiki/The_Shard", CC, "The Shard in London is 310 m.", "Height to tip"),
  row("f-height-washington", "Washington Monument", 169, "m", "landmark-height", "history", "National Park Service", "https://www.nps.gov/wamo/index.htm", PD, "The Washington Monument is about 169 m.", "NPS height"),
  row("f-height-pisa", "Leaning Tower of Pisa", 56, "m", "landmark-height", "history", "Wikipedia: Leaning Tower of Pisa", "https://en.wikipedia.org/wiki/Leaning_Tower_of_Pisa", CC, "The Leaning Tower of Pisa is about 56 m on the higher side.", "Height"),

  row("f-year-burj", "Burj Khalifa", 2010, "year", "build-year", "inventions", "Wikipedia: Burj Khalifa", "https://en.wikipedia.org/wiki/Burj_Khalifa", CC, "The Burj Khalifa was completed in 2010.", "Completion year"),
  row("f-year-eiffel", "Eiffel Tower", 1889, "year", "build-year", "inventions", "Wikipedia: Eiffel Tower", "https://en.wikipedia.org/wiki/Eiffel_Tower", CC, "The Eiffel Tower opened for the 1889 Exposition Universelle.", "Opening year"),
  row("f-year-empire", "Empire State Building", 1931, "year", "build-year", "inventions", "Wikipedia: Empire State Building", "https://en.wikipedia.org/wiki/Empire_State_Building", CC, "The Empire State Building was completed in 1931.", "Completion year"),
  row("f-year-opera", "Sydney Opera House", 1973, "year", "build-year", "culture", "Wikipedia: Sydney Opera House", "https://en.wikipedia.org/wiki/Sydney_Opera_House", CC, "The Sydney Opera House was opened by Queen Elizabeth II in 1973.", "Opening year"),
  row("f-year-pisa", "Leaning Tower of Pisa", 1372, "year", "build-year", "history", "Wikipedia: Leaning Tower of Pisa", "https://en.wikipedia.org/wiki/Leaning_Tower_of_Pisa", CC, "The Leaning Tower of Pisa was finished in 1372, after nearly two centuries of work.", "Completion year"),
  row("f-year-sophia", "Hagia Sophia", 537, "year", "build-year", "history", "Wikipedia: Hagia Sophia", "https://en.wikipedia.org/wiki/Hagia_Sophia", CC, "Justinian's Hagia Sophia was completed in 537.", "Completion year"),

  row("f-inv-steam", "Newcomen steam engine", 1712, "year", "invention-year", "inventions", "Wikipedia: Newcomen atmospheric engine", "https://en.wikipedia.org/wiki/Newcomen_atmospheric_engine", CC, "Thomas Newcomen's atmospheric engine dates to 1712.", "1712"),
  row("f-inv-bulb", "Practical light bulb", 1879, "year", "invention-year", "inventions", "Wikipedia: Incandescent light bulb", "https://en.wikipedia.org/wiki/Incandescent_light_bulb", CC, "Edison's practical incandescent bulb is dated to 1879. Earlier lamps existed.", "1879"),
  row("f-inv-transistor", "Transistor", 1947, "year", "invention-year", "inventions", "Wikipedia: Transistor", "https://en.wikipedia.org/wiki/Transistor", CC, "The first transistor was demonstrated at Bell Labs in 1947.", "1947"),
  row("f-inv-web", "World Wide Web", 1989, "year", "invention-year", "inventions", "CERN", "https://home.cern/science/computing/birth-web", "CERN public information", "Tim Berners-Lee proposed the World Wide Web at CERN in 1989.", "1989 proposal"),
  row("f-inv-iphone", "iPhone", 2007, "year", "invention-year", "inventions", "Wikipedia: iPhone", "https://en.wikipedia.org/wiki/IPhone_(1st_generation)", CC, "Apple announced the first iPhone in 2007.", "2007"),
  row("f-inv-tv", "Electronic television", 1927, "year", "invention-year", "inventions", "Wikipedia: History of television", "https://en.wikipedia.org/wiki/History_of_television", CC, "Philo Farnsworth transmitted an electronic television image in 1927.", "1927"),

  row("f-gest-dog", "Dog", 63, "days", "gestation", "nature", "Wikipedia: Dog", "https://en.wikipedia.org/wiki/Dog", CC, "A dog's pregnancy is about 63 days.", "Typical gestation"),
  row("f-gest-cat", "Cat", 65, "days", "gestation", "nature", "Wikipedia: Cat", "https://en.wikipedia.org/wiki/Cat", CC, "A cat's pregnancy is about 65 days.", "Typical gestation"),
  row("f-gest-horse", "Horse", 340, "days", "gestation", "nature", "Wikipedia: Horse", "https://en.wikipedia.org/wiki/Horse", CC, "A horse's pregnancy is about 340 days.", "Typical gestation"),
  row("f-gest-mouse", "House mouse", 20, "days", "gestation", "nature", "Wikipedia: House mouse", "https://en.wikipedia.org/wiki/House_mouse", CC, "A house mouse's pregnancy is about 20 days.", "Typical gestation"),

  row("f-wing-condor", "Andean condor", 3.3, "m", "wingspan", "nature", "Wikipedia: Andean condor", "https://en.wikipedia.org/wiki/Andean_condor", CC, "The Andean condor's wingspan reaches about 3.3 m.", "Approximate maximum"),
  row("f-wing-albatross-royal", "Royal albatross", 3.3, "m", "wingspan", "nature", "Wikipedia: Royal albatross", "https://en.wikipedia.org/wiki/Royal_albatross", CC, "A royal albatross's wingspan is about 3.3 m.", "Approximate maximum"),
  row("f-wing-eagle", "Bald eagle", 2.3, "m", "wingspan", "nature", "Wikipedia: Bald eagle", "https://en.wikipedia.org/wiki/Bald_eagle", CC, "A bald eagle's wingspan is about 2.3 m.", "Typical large adult"),

  row("f-len-fin", "Fin whale", 24, "m", "animal-length", "nature", "NOAA Fisheries", "https://www.fisheries.noaa.gov/species/fin-whale", PD, "Fin whales reach about 24 m, second in length to the blue whale.", "Approximate maximum"),
  row("f-len-orca", "Orca", 8, "m", "animal-length", "nature", "NOAA Fisheries", "https://www.fisheries.noaa.gov/species/orca", PD, "A large male orca is about 8 m long.", "Typical large male"),
  row("f-len-giraffe", "Giraffe", 5.5, "m", "animal-length", "nature", "Wikipedia: Giraffe", "https://en.wikipedia.org/wiki/Giraffe", CC, "A tall adult giraffe is about 5.5 m to the horns.", "Typical tall adult"),
  row("f-len-human", "Human", 1.7, "m", "animal-length", "nature", "Wikipedia: Human height", "https://en.wikipedia.org/wiki/Human_height", CC, "1.7 m is a round reference height for an adult human, not a global mean.", "Reference adult"),

  row("f-z-iron", "Iron", 26, "protons", "atomic-number", "science", "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/26/iron", "Royal Society of Chemistry periodic table", "Iron is element 26.", "Exact"),
  row("f-z-oxygen", "Oxygen", 8, "protons", "atomic-number", "science", "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/8/oxygen", "Royal Society of Chemistry periodic table", "Oxygen is element 8.", "Exact"),
  row("f-z-uranium", "Uranium", 92, "protons", "atomic-number", "science", "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/92/uranium", "Royal Society of Chemistry periodic table", "Uranium is element 92.", "Exact"),
  row("f-z-tin", "Tin", 50, "protons", "atomic-number", "science", "Royal Society of Chemistry", "https://www.rsc.org/periodic-table/element/50/tin", "Royal Society of Chemistry periodic table", "Tin is element 50.", "Exact"),
];
