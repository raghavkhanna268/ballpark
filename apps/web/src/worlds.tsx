/** Illustrated stops along one continuous zoom-out path. Vector only. */

export const WORLD_STOPS = [
  { id: "atom", name: "the atom", label: "Atom", frame: "40 160 310 360" },
  { id: "cell", name: "the cell", label: "Cell", frame: "30 150 330 420" },
  { id: "insect", name: "the leaf", label: "Leaf", frame: "20 250 350 280" },
  { id: "street", name: "the street", label: "Street", frame: "10 180 370 380" },
  { id: "city", name: "the city", label: "City", frame: "10 140 370 420" },
  { id: "country", name: "the country", label: "Country", frame: "10 80 370 420" },
  { id: "earth", name: "Earth", label: "Earth", frame: "30 180 330 360" },
  { id: "moon", name: "the Moon", label: "Moon", frame: "40 180 320 360" },
  { id: "solar", name: "the solar system", label: "Solar system", frame: "10 250 370 220" },
  { id: "stars", name: "the nearby stars", label: "Nearby stars", frame: "0 80 390 420" },
  { id: "galaxy", name: "the Milky Way", label: "Milky Way", frame: "40 180 320 360" },
  { id: "universe", name: "the universe", label: "Universe", frame: "10 140 370 420" },
] as const;

export function WorldArt({ id }: { id: string }) {
  if (id === "atom") return <Atom />;
  if (id === "cell") return <Cell />;
  if (id === "insect") return <Insect />;
  if (id === "street") return <Street />;
  if (id === "city") return <City />;
  if (id === "country") return <Country />;
  if (id === "earth") return <Earth />;
  if (id === "moon") return <Moon />;
  if (id === "solar") return <Solar />;
  if (id === "stars") return <Stars />;
  if (id === "galaxy") return <Galaxy />;
  return <Universe />;
}

/** Distant shapes that slide slower than the illustrated world. */
export function Backdrop({ id }: { id: string }) {
  const wash = washFor(id);
  return (
    <g>
      <rect width="390" height="700" fill={wash} />
      <circle cx="70" cy="160" r="90" fill="rgba(255,255,255,0.08)" />
      <circle cx="320" cy="480" r="120" fill="rgba(0,0,0,0.12)" />
      <ellipse cx="200" cy="80" rx="160" ry="28" fill="rgba(255,255,255,0.06)" />
      {id === "street" || id === "city" ? <circle cx="300" cy="120" r="40" fill="rgba(255,224,138,0.35)" /> : null}
      {id === "country" ? <path d="M0 520 C80 480 160 560 390 500 L390 700 L0 700 Z" fill="rgba(255,255,255,0.08)" /> : null}
      {id === "earth" || id === "moon" || id === "solar" || id === "stars" || id === "galaxy" || id === "universe"
        ? Array.from({ length: 8 }, (_, index) => <circle key={index} cx={30 + index * 46} cy={40 + (index % 3) * 30} r="1.6" fill="rgba(255,255,255,0.7)" />)
        : null}
    </g>
  );
}

function washFor(id: string): string {
  const washes: Record<string, string> = {
    atom: "#071824",
    cell: "#12331f",
    insect: "#1d4a28",
    street: "#8ec4ea",
    city: "#f0b089",
    country: "#1a6a8a",
    earth: "#071624",
    moon: "#0b1020",
    solar: "#070b16",
    stars: "#070b18",
    galaxy: "#100818",
    universe: "#05060e",
  };
  return washes[id] ?? "#071018";
}

function Atom() {
  return (
    <g>
      <rect width="390" height="700" fill="#071824" />
      <circle cx="195" cy="340" r="28" fill="#ffd36a" />
      <circle cx="184" cy="332" r="10" fill="#ff8a3d" />
      <circle cx="206" cy="348" r="8" fill="#ffe7a3" />
      <ellipse cx="195" cy="340" rx="120" ry="42" fill="none" stroke="#9ad7ff" strokeWidth="2" />
      <ellipse cx="195" cy="340" rx="78" ry="120" fill="none" stroke="#7ec8ff" strokeWidth="2" transform="rotate(28 195 340)" />
      <ellipse cx="195" cy="340" rx="150" ry="56" fill="none" stroke="#d7f4ff" strokeWidth="2" transform="rotate(-18 195 340)" />
      <g className="spin">
        <circle cx="315" cy="340" r="7" fill="#e8fbff" />
      </g>
      <g className="spin slow">
        <circle cx="195" cy="220" r="6" fill="#b9ecff" />
      </g>
      <g className="spin reverse">
        <circle cx="70" cy="360" r="5" fill="#fff" />
      </g>
    </g>
  );
}

function Cell() {
  return (
    <g>
      <rect width="390" height="700" fill="#12331f" />
      <ellipse cx="195" cy="360" rx="150" ry="190" fill="#8fd48a" stroke="#e9ffd8" strokeWidth="8" />
      <ellipse cx="210" cy="330" rx="48" ry="42" fill="#245c38" />
      <ellipse cx="120" cy="400" rx="36" ry="16" fill="#c6f0a4" transform="rotate(-20 120 400)" />
      <ellipse cx="270" cy="430" rx="30" ry="14" fill="#d8ffb0" transform="rotate(24 270 430)" />
      <circle cx="160" cy="280" r="10" fill="#f4ffe4" className="float" />
      <circle cx="250" cy="300" r="7" fill="#f4ffe4" />
      <circle cx="180" cy="470" r="8" fill="#e4ffc4" />
    </g>
  );
}

function Insect() {
  return (
    <g>
      <rect width="390" height="700" fill="#1d4a28" />
      <ellipse cx="210" cy="460" rx="190" ry="100" fill="#2f7a34" transform="rotate(-12 210 460)" />
      <ellipse cx="200" cy="420" rx="160" ry="72" fill="#46a84a" transform="rotate(-8 200 420)" />
      <path d="M70 400 C150 360 240 470 340 390" fill="none" stroke="#1d4a28" strokeWidth="4" />
      <g className="float">
        <ellipse cx="168" cy="360" rx="28" ry="18" fill="#1a1208" />
        <ellipse cx="210" cy="346" rx="16" ry="13" fill="#24180c" />
        <circle cx="242" cy="334" r="12" fill="#1a1208" />
        <circle cx="246" cy="330" r="2.4" fill="#f4ffe0" />
        <path d="M238 322 q-6 -30 10 -48" fill="none" stroke="#1a1208" strokeWidth="2" />
        <path d="M248 322 q14 -28 28 -40" fill="none" stroke="#1a1208" strokeWidth="2" />
        <path d="M198 352 l-36 8 M200 358 l-28 26 M186 366 l-8 34" fill="none" stroke="#1a1208" strokeWidth="2.4" />
        <path d="M214 354 l30 6 M216 360 l26 22 M204 368 l6 32" fill="none" stroke="#1a1208" strokeWidth="2.4" />
      </g>
    </g>
  );
}

function Street() {
  return (
    <g>
      <rect width="390" height="700" fill="#8ec4ea" />
      <rect y="430" width="390" height="270" fill="#7d8b62" />
      <rect y="500" width="390" height="46" fill="#4d463c" />
      <rect x="40" y="300" width="90" height="140" fill="#f3e2c4" />
      <polygon points="30,300 85,240 175,300" fill="#b8431f" />
      <rect x="70" y="340" width="28" height="36" fill="#245c86" />
      <rect x="230" y="270" width="110" height="170" fill="#efe6d4" />
      <polygon points="220,270 285,210 350,270" fill="#8d4b32" />
      <rect x="258" y="310" width="24" height="30" fill="#16324a" />
      <rect x="300" y="310" width="24" height="30" fill="#16324a" />
      <circle cx="150" cy="470" r="10" fill="#f3d2b8" />
      <rect x="144" y="480" width="12" height="28" fill="#0e5c52" />
      <path d="M140 508 l-12 8 M160 508 l12 8" stroke="#1c1915" strokeWidth="3" />
      <circle cx="320" cy="250" r="28" fill="#ffe08a" />
    </g>
  );
}

function City() {
  return (
    <g>
      <rect width="390" height="700" fill="#f0b089" />
      <rect y="520" width="390" height="180" fill="#3a3344" />
      {[40, 90, 150, 210, 270, 320].map((x, index) => (
        <g key={x}>
          <rect x={x} y={360 - (index % 3) * 40} width={42} height={160 + (index % 3) * 40} fill={index % 2 ? "#2a2230" : "#46344c"} />
          {Array.from({ length: 4 }, (_, row) => (
            <rect key={row} x={x + 8} y={380 - (index % 3) * 40 + row * 28} width="8" height="12" fill="#ffe7a3" />
          ))}
        </g>
      ))}
      <circle cx="300" cy="180" r="36" fill="#ffe08a" />
    </g>
  );
}

function Country() {
  return (
    <g>
      <rect width="390" height="700" fill="#1a6a8a" />
      <path d="M40 180 C90 120 150 200 180 160 C230 90 300 150 360 120 L370 420 C300 380 240 460 180 400 C120 470 70 390 30 430 Z" fill="#8fd48a" />
      <path d="M80 240 C140 220 160 300 220 270" fill="none" stroke="#1a6a8a" strokeWidth="6" />
      <circle cx="120" cy="210" r="5" fill="#f4efe4" />
      <circle cx="200" cy="230" r="4" fill="#f4efe4" />
      <circle cx="280" cy="190" r="6" fill="#ffe08a" />
      <path d="M20 500 C80 470 140 530 200 490 C260 450 320 520 380 480" fill="none" stroke="#d8f3c8" strokeWidth="3" />
    </g>
  );
}

function Earth() {
  return (
    <g>
      <rect width="390" height="700" fill="#071624" />
      <circle cx="195" cy="350" r="150" fill="#2f7ec4" />
      <g className="spin slow">
        <ellipse cx="150" cy="300" rx="50" ry="28" fill="#3e9a45" />
        <ellipse cx="230" cy="360" rx="64" ry="30" fill="#8fd48a" />
        <ellipse cx="170" cy="410" rx="36" ry="16" fill="#2f8a4e" />
      </g>
      <g className="float">
        <ellipse cx="120" cy="280" rx="40" ry="14" fill="rgba(255,255,255,0.55)" />
        <ellipse cx="250" cy="320" rx="50" ry="16" fill="rgba(255,255,255,0.45)" />
      </g>
    </g>
  );
}

function Moon() {
  return (
    <g>
      <rect width="390" height="700" fill="#0b1020" />
      <circle cx="210" cy="360" r="130" fill="#d9d3c4" />
      <circle cx="170" cy="320" r="22" fill="#b7b0a2" />
      <circle cx="240" cy="390" r="16" fill="#b7b0a2" />
      <circle cx="200" cy="420" r="10" fill="#c4bdae" />
      <circle cx="70" cy="180" r="28" fill="#2f7ec4" />
      <circle cx="62" cy="174" r="8" fill="#3e9a45" />
    </g>
  );
}

function Solar() {
  return (
    <g>
      <rect width="390" height="700" fill="#070b16" />
      <circle cx="195" cy="350" r="36" fill="#ffe08a" />
      <ellipse cx="195" cy="350" rx="80" ry="28" fill="none" stroke="rgba(255,224,150,0.45)" />
      <ellipse cx="195" cy="350" rx="130" ry="46" fill="none" stroke="rgba(255,224,150,0.35)" />
      <ellipse cx="195" cy="350" rx="175" ry="64" fill="none" stroke="rgba(255,224,150,0.28)" />
      <g className="spin">
        <circle cx="275" cy="350" r="8" fill="#c46a3a" />
      </g>
      <g className="spin slow">
        <circle cx="325" cy="350" r="14" fill="#d7b07a" />
      </g>
      <g className="spin reverse">
        <circle cx="195" cy="286" r="10" fill="#4aa3d8" />
      </g>
    </g>
  );
}

function Stars() {
  return (
    <g>
      <rect width="390" height="700" fill="#070b18" />
      {Array.from({ length: 40 }, (_, index) => (
        <circle
          key={index}
          cx={20 + ((index * 47) % 350)}
          cy={30 + ((index * 89) % 640)}
          r={index % 5 === 0 ? 2.4 : 1.2}
          fill="#fff"
          className={index % 2 ? "twinkle" : undefined}
        />
      ))}
      <path d="M60 200 l18 8 l-14 14 l4 -20 z M240 160 l16 6 l-12 12 l2 -16 z" fill="#ffe7a3" />
    </g>
  );
}

function Galaxy() {
  return (
    <g>
      <rect width="390" height="700" fill="#100818" />
      <g className="spin slow" style={{ transformOrigin: "195px 350px" }}>
        <ellipse cx="195" cy="350" rx="150" ry="48" fill="none" stroke="#8d7ae0" strokeWidth="18" />
        <ellipse cx="195" cy="350" rx="110" ry="36" fill="none" stroke="#c4b6ff" strokeWidth="12" transform="rotate(28 195 350)" />
        <ellipse cx="195" cy="350" rx="70" ry="22" fill="none" stroke="#efe8ff" strokeWidth="8" transform="rotate(-16 195 350)" />
      </g>
      <ellipse cx="195" cy="350" rx="28" ry="16" fill="#fff7e8" />
      <ellipse cx="195" cy="350" rx="12" ry="8" fill="#fff" />
      {Array.from({ length: 24 }, (_, index) => (
        <circle key={index} cx={40 + ((index * 53) % 320)} cy={160 + ((index * 37) % 380)} r={index % 4 === 0 ? 2 : 1.2} fill="#fff" className={index % 2 ? "twinkle" : undefined} />
      ))}
    </g>
  );
}

function Universe() {
  return (
    <g>
      <rect width="390" height="700" fill="#05060e" />
      <path d="M40 200 C120 160 160 280 240 220 C300 180 340 260 370 220" fill="none" stroke="#b7a6ff" strokeWidth="6" />
      <path d="M30 420 C110 360 180 480 250 400 C310 340 350 430 380 390" fill="none" stroke="#ffe08a" strokeWidth="5" />
      <path d="M60 520 C140 470 200 560 280 500" fill="none" stroke="#e08ad4" strokeWidth="5" />
      <circle cx="120" cy="190" r="14" fill="#f7f3ff" />
      <circle cx="250" cy="230" r="10" fill="#ffe7a3" />
      <circle cx="300" cy="410" r="16" fill="#d7c8ff" />
      <circle cx="160" cy="500" r="12" fill="#f0c27a" />
      <circle cx="80" cy="360" r="8" fill="#fff" />
    </g>
  );
}
