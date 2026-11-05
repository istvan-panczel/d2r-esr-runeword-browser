/**
 * The generated minimap icons of the loot filter editor: bold shapes in the style presets' colours
 * (src/features/loot-filter/utils/stylePresets.ts), drawn in code so they can be regenerated and checked
 * (scripts/generate-loot-filter-icons.ts writes them to public/loot-filters/icons/ as .sprite files).
 *
 * Every shape is a signed distance function on a 128 px canvas (negative inside). A pixel's colour comes from its
 * distance: the fill inside, a dark outline `OUTLINE` px wide around it, transparent beyond, each edge anti-aliased over
 * one pixel from the exact distance (the same result as heavy supersampling for these smooth edges, and deterministic).
 * The fill is the colour shaded top to bottom, plus facets (lighter or darker regions, lit from the top left), shine
 * spots and dark detail marks (eyes, text lines, sockets).
 */

export type Rgb = readonly [number, number, number];

/** The icon colours, after the style presets' name, border and beam colours. */
export const ICON_COLORS = {
  gold: [240, 178, 40],
  green: [60, 225, 60],
  emerald: [0, 196, 100],
  purple: [172, 64, 255],
  red: [236, 34, 34],
  orange: [255, 146, 20],
  yellow: [255, 226, 60],
  teal: [0, 204, 204],
  blue: [40, 156, 255],
  white: [238, 238, 238],
  grey: [140, 140, 140],
} as const satisfies Record<string, Rgb>;

export type IconColor = keyof typeof ICON_COLORS;

/** Signed distance in pixels from (x, y) to a shape's edge: negative inside. */
type Sdf = (x: number, y: number) => number;

interface Facet {
  readonly sdf: Sdf;
  /** -1 (black) … 0 (the colour) … 1 (white). */
  readonly shade: number;
}

interface Shine {
  readonly sdf: Sdf;
  /** Pixels over which the shine fades in from its edge. */
  readonly soft: number;
  readonly opacity: number;
}

export interface IconShape {
  readonly body: Sdf;
  readonly facets?: readonly Facet[];
  readonly shine?: readonly Shine[];
  /** Dark marks in the outline colour, drawn over the fill. */
  readonly details?: readonly Sdf[];
}

export const ICON_SIZE = 128;
/** The dark outline's width outside the shape, in pixels at 128 px (about 2 px at the usual 40 px on the minimap). */
const OUTLINE = 6;
/** How far the outline colour sits from black: the colour × this. */
const OUTLINE_TINT = 0.16;
/** The top-to-bottom shading of the fill: lighter by this at the top, darker by this at the bottom. */
const GRADIENT = 0.22;
/** Light from the top left (unit vector). */
const LIGHT: readonly [number, number] = [-0.55, -0.835];

// ---------------------------------------------------------------------------------------------- distance functions

type Point = readonly [number, number];

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

function circle(cx: number, cy: number, r: number): Sdf {
  return (x, y) => Math.hypot(x - cx, y - cy) - r;
}

/** An axis-aligned box with corners rounded by r. */
function box(cx: number, cy: number, halfWidth: number, halfHeight: number, r = 0): Sdf {
  return (x, y) => {
    const qx = Math.abs(x - cx) - halfWidth + r;
    const qy = Math.abs(y - cy) - halfHeight + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
}

/** A line from a to b with round ends, r thick on each side. */
function capsule(a: Point, b: Point, r: number): Sdf {
  const [ax, ay] = a;
  const ex = b[0] - ax;
  const ey = b[1] - ay;
  const ee = ex * ex + ey * ey;
  return (x, y) => {
    const wx = x - ax;
    const wy = y - ay;
    const t = clamp01((wx * ex + wy * ey) / ee);
    return Math.hypot(wx - ex * t, wy - ey * t) - r;
  };
}

/** The exact distance to a simple polygon (Inigo Quilez's sdPolygon). */
function polygon(points: readonly Point[]): Sdf {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const n = points.length;
  return (x, y) => {
    let best = Infinity;
    let sign = 1;
    for (let i = 0, j = n - 1; i < n; j = i, i++) {
      const vx = xs[i];
      const vy = ys[i];
      const ex = xs[j] - vx;
      const ey = ys[j] - vy;
      const wx = x - vx;
      const wy = y - vy;
      const t = clamp01((wx * ex + wy * ey) / (ex * ex + ey * ey));
      const bx = wx - ex * t;
      const by = wy - ey * t;
      best = Math.min(best, bx * bx + by * by);
      const c1 = y >= vy;
      const c2 = y < ys[j];
      const c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) sign = -sign;
    }
    return sign * Math.sqrt(best);
  };
}

const union =
  (...shapes: readonly Sdf[]): Sdf =>
  (x, y) =>
    Math.min(...shapes.map((shape) => shape(x, y)));

/** A union with the seams rounded over k pixels. */
function smoothUnion(a: Sdf, b: Sdf, k: number): Sdf {
  return (x, y) => {
    const da = a(x, y);
    const db = b(x, y);
    const h = clamp01(0.5 + (0.5 * (db - da)) / k);
    return db + (da - db) * h - k * h * (1 - h);
  };
}

const subtract =
  (shape: Sdf, ...holes: readonly Sdf[]): Sdf =>
  (x, y) =>
    Math.max(shape(x, y), ...holes.map((hole) => -hole(x, y)));

/** A ring of the shape's edge, r thick on each side. */
const stroke =
  (shape: Sdf, r: number): Sdf =>
  (x, y) =>
    Math.abs(shape(x, y)) - r;

/** The shape turned by `degrees` (clockwise on screen) around (cx, cy). */
function rotate(shape: Sdf, degrees: number, cx: number, cy: number): Sdf {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    return shape(cx + dx * cos + dy * sin, cy - dx * sin + dy * cos);
  };
}

// ---------------------------------------------------------------------------------------------- point helpers

/** Points around (cx, cy), the first straight up, clockwise, alternating between the radii given. */
function radial(cx: number, cy: number, count: number, radii: readonly number[], startDegrees = -90): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = ((startDegrees + (360 * index) / count) * Math.PI) / 180;
    const r = radii[index % radii.length];
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  });
}

/** The points scaled by `factor` around (cx, cy). */
const scaled = (points: readonly Point[], factor: number, cx: number, cy: number): Point[] =>
  points.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor] as const);

/** A quadratic Bézier from a to b through the control point c, as `steps` points after a. */
function quad(a: Point, c: Point, b: Point, steps = 12): Point[] {
  return Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / steps;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as const;
  });
}

/**
 * Bevelled facets of a polygon: one trapezoid per edge between the outline and an inner copy (a triangle when the inner
 * copy is a single point), shaded by how much its edge faces the light, plus the inner "table" when it has an area.
 */
function bevel(outer: readonly Point[], inner: readonly Point[], strength: number, tableShade = 0): Facet[] {
  const n = outer.length;
  const cx = outer.reduce((sum, point) => sum + point[0], 0) / n;
  const cy = outer.reduce((sum, point) => sum + point[1], 0) / n;
  const facets: Facet[] = outer.map((a, i) => {
    const b = outer[(i + 1) % n];
    const ia = inner[i % inner.length];
    const ib = inner[(i + 1) % inner.length];
    let nx = b[1] - a[1];
    let ny = a[0] - b[0];
    const length = Math.hypot(nx, ny);
    nx /= length;
    ny /= length;
    if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const facing = -(nx * LIGHT[0] + ny * LIGHT[1]);
    const points: Point[] = inner.length === 1 ? [a, b, ia] : [a, b, ib, ia];
    return { sdf: polygon(points), shade: strength * facing };
  });
  if (inner.length > 2) facets.push({ sdf: polygon(inner), shade: tableShade });
  return facets;
}

// ---------------------------------------------------------------------------------------------- shapes

function star(): IconShape {
  const r = 57;
  const cy = 64 + r * 0.0955; // centres the star's box (its bottom tips sit at 0.809 r)
  const outer = radial(64, cy, 10, [r, r * 0.46]);
  return { body: polygon(outer), facets: bevel(outer, [[64, cy]], 0.42) };
}

function diamond(): IconShape {
  const outer: Point[] = [
    [64, 10],
    [110, 64],
    [64, 118],
    [18, 64],
  ];
  return { body: polygon(outer), facets: bevel(outer, scaled(outer, 0.42, 64, 64), 0.4, 0.18) };
}

function triangle(): IconShape {
  // Pointing down, at the drop.
  const outer: Point[] = [
    [12, 18],
    [116, 18],
    [64, 112],
  ];
  return { body: polygon(outer), facets: bevel(outer, scaled(outer, 0.4, 64, 49.3), 0.4, 0.15) };
}

function square(): IconShape {
  const outer: Point[] = [
    [18, 18],
    [110, 18],
    [110, 110],
    [18, 110],
  ];
  return { body: box(64, 64, 46, 46, 12), facets: bevel(outer, scaled(outer, 0.62, 64, 64), 0.36, 0.08) };
}

function hexagon(): IconShape {
  const outer = radial(64, 64, 6, [55], 0); // flat top: a pointed top reads as a cube
  return { body: polygon(outer), facets: bevel(outer, scaled(outer, 0.5, 64, 64), 0.42, 0.2) };
}

function orb(): IconShape {
  return {
    body: circle(64, 64, 52),
    shine: [
      { sdf: rotate(box(46, 42, 17, 10, 10), -35, 46, 42), soft: 6, opacity: 0.7 },
      { sdf: circle(88, 90, 6), soft: 4, opacity: 0.25 },
    ],
  };
}

function coin(): IconShape {
  const emblem = radial(64, 66, 10, [22, 10]);
  return {
    body: circle(64, 64, 52),
    facets: [
      { sdf: subtract(circle(64, 64, 37), polygon(emblem)), shade: -0.14 },
      ...bevel(emblem, [[64, 66]], 0.35).map((facet) => ({ ...facet, shade: facet.shade + 0.2 })),
    ],
    shine: [{ sdf: rotate(box(46, 40, 12, 6, 6), -35, 46, 40), soft: 5, opacity: 0.6 }],
    details: [stroke(circle(64, 64, 39), 2.2)],
  };
}

function crown(): IconShape {
  const spikes = polygon([
    [16, 40],
    [40, 68],
    [64, 26],
    [88, 68],
    [112, 40],
    [104, 92],
    [24, 92],
  ]);
  const band = box(64, 96, 42, 11, 3);
  return {
    body: union(spikes, band, circle(16, 40, 9), circle(64, 26, 9), circle(112, 40, 9)),
    facets: [
      { sdf: band, shade: -0.12 },
      { sdf: circle(40, 96, 5.5), shade: 0.6 },
      { sdf: circle(64, 96, 5.5), shade: 0.6 },
      { sdf: circle(88, 96, 5.5), shade: 0.6 },
    ],
    shine: [
      { sdf: circle(14, 37, 3.5), soft: 2, opacity: 0.7 },
      { sdf: circle(62, 23, 3.5), soft: 2, opacity: 0.7 },
      { sdf: circle(110, 37, 3.5), soft: 2, opacity: 0.7 },
    ],
    details: [capsule([24, 84], [104, 84], 1.6)],
  };
}

function skull(): IconShape {
  const cranium = circle(64, 52, 42);
  const jaw = box(64, 94, 25, 18, 8);
  return {
    body: smoothUnion(cranium, jaw, 10),
    shine: [{ sdf: rotate(box(44, 30, 12, 7, 7), -35, 44, 30), soft: 5, opacity: 0.45 }],
    details: [
      circle(46, 58, 12.5),
      circle(82, 58, 12.5),
      polygon([
        [64, 70],
        [71, 84],
        [57, 84],
      ]),
      capsule([53, 99], [53, 112], 2.2),
      capsule([64, 99], [64, 112], 2.2),
      capsule([75, 99], [75, 112], 2.2),
    ],
  };
}

function key(): IconShape {
  // Drawn level (the bow on the left, the bit below the shaft on the right), then turned 45° to point down right.
  const bow = subtract(circle(30, 64, 25), circle(30, 64, 10));
  const shaft = box(76, 64, 30, 8.5, 3);
  const teeth = union(box(96, 80, 7, 10, 2), box(76, 76, 5, 7, 2));
  const level = union(bow, shaft, teeth);
  return {
    body: rotate(level, 45, 64, 64),
    facets: [{ sdf: rotate(stroke(circle(30, 64, 17.5), 3), 45, 64, 64), shade: 0.25 }],
  };
}

function gem(): IconShape {
  const crownTop: Point[] = [
    [40, 20],
    [88, 20],
    [114, 46],
    [14, 46],
  ];
  const apex: Point = [64, 110];
  return {
    body: polygon([crownTop[0], crownTop[1], crownTop[2], apex, crownTop[3]]),
    facets: [
      {
        sdf: polygon([
          [40, 20],
          [52, 46],
          [14, 46],
        ]),
        shade: 0.3,
      },
      {
        sdf: polygon([
          [40, 20],
          [88, 20],
          [76, 46],
          [52, 46],
        ]),
        shade: 0.5,
      },
      {
        sdf: polygon([
          [88, 20],
          [114, 46],
          [76, 46],
        ]),
        shade: 0.12,
      },
      { sdf: polygon([[14, 46], [52, 46], apex]), shade: 0.05 },
      { sdf: polygon([[52, 46], [76, 46], apex]), shade: -0.15 },
      { sdf: polygon([[76, 46], [114, 46], apex]), shade: -0.36 },
    ],
  };
}

function shield(): IconShape {
  // A heater shield with three sockets (a runeword base).
  const right: Point[] = [[108, 14], [108, 52], ...quad([108, 52], [108, 98], [64, 120])];
  const left = right.map(([x, y]) => [128 - x, y] as const).reverse();
  const outline: Point[] = [...right, ...left.slice(1)];
  return {
    body: polygon(outline),
    facets: [
      {
        sdf: polygon([
          [64, 0],
          [128, 0],
          [128, 128],
          [64, 128],
        ]),
        shade: -0.22,
      },
    ],
    details: [circle(64, 40, 9), circle(64, 66, 9), circle(64, 92, 8)],
  };
}

function scroll(): IconShape {
  const top = capsule([22, 22], [106, 22], 11);
  const bottom = capsule([22, 106], [106, 106], 11);
  return {
    body: union(box(64, 64, 34, 44, 2), top, bottom),
    facets: [
      { sdf: top, shade: 0.22 },
      { sdf: bottom, shade: -0.12 },
    ],
    details: [
      stroke(top, 1.6),
      stroke(bottom, 1.6),
      capsule([44, 48], [84, 48], 2.6),
      capsule([44, 62], [84, 62], 2.6),
      capsule([44, 76], [74, 76], 2.6),
    ],
  };
}

function flame(): IconShape {
  const tongue = (scale: number, cx: number, cy: number): Sdf => {
    const outline: Point[] = [
      [64, 112],
      ...quad([64, 112], [28, 108], [32, 76]),
      ...quad([32, 76], [36, 40], [72, 8]),
      ...quad([72, 8], [74, 40], [96, 76]),
    ];
    const tail = quad([96, 76], [100, 108], [64, 112]).slice(0, -1);
    return polygon(scaled([...outline, ...tail], scale, cx, cy));
  };
  const outer = smoothUnion(tongue(1, 64, 64), circle(64, 84, 31), 8);
  const core = smoothUnion(tongue(0.5, 64, 100), circle(64, 92, 15), 5);
  return { body: outer, facets: [{ sdf: core, shade: 0.55 }], shine: [{ sdf: circle(52, 70, 6), soft: 5, opacity: 0.35 }] };
}

function cross(): IconShape {
  const bar = box(64, 64, 54, 13, 5);
  const a = rotate(bar, 45, 64, 64);
  const b = rotate(bar, -45, 64, 64);
  return { body: union(a, b), facets: [{ sdf: subtract(b, a), shade: -0.16 }] };
}

function map(): IconShape {
  const panels: Point[][] = [
    [
      [14, 26],
      [46, 14],
      [46, 102],
      [14, 114],
    ],
    [
      [46, 14],
      [82, 26],
      [82, 114],
      [46, 102],
    ],
    [
      [82, 26],
      [114, 14],
      [114, 102],
      [82, 114],
    ],
  ];
  const route: Point[] = [
    [26, 94],
    [34, 84],
    [44, 78],
    [54, 74],
    [62, 66],
    [70, 58],
    [80, 54],
    [88, 48],
  ];
  const dashes: Sdf[] = [];
  for (let i = 0; i + 1 < route.length; i += 2) dashes.push(capsule(route[i], route[i + 1], 2.4));
  return {
    body: polygon([...panels[0].slice(0, 2), panels[1][1], panels[2][1], panels[2][2], panels[1][2], panels[0][2], panels[0][3]]),
    facets: [
      { sdf: polygon(panels[0]), shade: 0.12 },
      { sdf: polygon(panels[1]), shade: -0.22 },
      { sdf: polygon(panels[2]), shade: 0.05 },
    ],
    details: [...dashes, capsule([93, 31], [105, 43], 3), capsule([105, 31], [93, 43], 3)],
  };
}

function ring(): IconShape {
  const band = subtract(circle(64, 76, 40), circle(64, 76, 25));
  const gemPoints: Point[] = [
    [64, 10],
    [86, 32],
    [64, 54],
    [42, 32],
  ];
  const stone = polygon(gemPoints);
  return {
    body: union(band, stone),
    facets: bevel(gemPoints, scaled(gemPoints, 0.4, 64, 32), 0.3, 0.75).map((facet) => ({ ...facet, shade: facet.shade + 0.45 })),
    details: [stroke(stone, 1.6)],
  };
}

export const ICON_SHAPES = {
  star,
  diamond,
  triangle,
  square,
  hexagon,
  circle: orb,
  coin,
  crown,
  skull,
  key,
  gem,
  shield,
  scroll,
  flame,
  cross,
  map,
  ring,
} as const satisfies Record<string, () => IconShape>;

export type IconShapeName = keyof typeof ICON_SHAPES;

export interface GeneratedIcon {
  /** The file name without `.sprite`: `<shape>_<colour>`. */
  readonly name: string;
  readonly shape: IconShapeName;
  readonly color: IconColor;
}

const generated = (shape: IconShapeName, color: IconColor): GeneratedIcon => ({ name: `${shape}_${color}`, shape, color });

/** Every generated icon, in the registry's order (bundledAssets.ts lists the same names with a label and a note). */
export const GENERATED_ICONS: readonly GeneratedIcon[] = [
  generated('star', 'gold'),
  generated('crown', 'gold'),
  generated('star', 'green'),
  generated('star', 'purple'),
  generated('crown', 'purple'),
  generated('diamond', 'red'),
  generated('diamond', 'orange'),
  generated('triangle', 'orange'),
  generated('cross', 'red'),
  generated('shield', 'white'),
  generated('square', 'emerald'),
  generated('hexagon', 'teal'),
  generated('hexagon', 'yellow'),
  generated('ring', 'blue'),
  generated('skull', 'purple'),
  generated('key', 'purple'),
  generated('gem', 'gold'),
  generated('flame', 'orange'),
  generated('coin', 'gold'),
  generated('scroll', 'gold'),
  generated('map', 'white'),
  generated('circle', 'grey'),
  generated('star', 'white'),
  generated('diamond', 'white'),
  generated('circle', 'white'),
];

// ---------------------------------------------------------------------------------------------- rendering

const shadeChannel = (value: number, shade: number) =>
  shade >= 0 ? value + (255 - value) * Math.min(shade, 1) : value * (1 + Math.max(shade, -1));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const toByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

/** The icon's pixels: RGBA with straight alpha, `size × size`, row by row from the top. */
export function renderIcon(icon: Pick<GeneratedIcon, 'shape' | 'color'>, size = ICON_SIZE): Uint8Array {
  const shape = ICON_SHAPES[icon.shape]();
  const base = ICON_COLORS[icon.color];
  const outline = base.map((channel) => channel * OUTLINE_TINT);
  const scale = ICON_SIZE / size;
  const sample = (px: number, py: number) => shape.body((px + 0.5) * scale, (py + 0.5) * scale) / scale;

  // The fill's top and bottom, for the top-to-bottom shading.
  let top = size;
  let bottom = 0;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      if (sample(px, py) < 0) {
        top = Math.min(top, py);
        bottom = Math.max(bottom, py);
      }
    }
  }
  const span = Math.max(1, bottom - top);

  const rgba = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const distance = sample(px, py);
      const alpha = toByte(clamp01(OUTLINE / scale + 0.5 - distance) * 255);
      if (alpha === 0) continue; // transparent pixels stay 0, 0, 0, 0
      const x = (px + 0.5) * scale;
      const y = (py + 0.5) * scale;
      const inside = clamp01(0.5 - distance);
      let r = outline[0];
      let g = outline[1];
      let b = outline[2];
      if (inside > 0) {
        let shade = GRADIENT * (1 - (2 * (py - top)) / span);
        let weight = 0;
        let facetShade = 0;
        for (const facet of shape.facets ?? []) {
          const cover = clamp01(0.5 - facet.sdf(x, y) / scale);
          weight += cover;
          facetShade += cover * facet.shade;
        }
        if (weight > 0) shade += facetShade / Math.max(weight, 1);
        let fr = shadeChannel(base[0], shade);
        let fg = shadeChannel(base[1], shade);
        let fb = shadeChannel(base[2], shade);
        for (const shine of shape.shine ?? []) {
          const glow = clamp01(-shine.sdf(x, y) / shine.soft) * shine.opacity;
          fr = mix(fr, 255, glow);
          fg = mix(fg, 255, glow);
          fb = mix(fb, 255, glow);
        }
        for (const detail of shape.details ?? []) {
          const mark = clamp01(0.5 - detail(x, y) / scale);
          fr = mix(fr, outline[0], mark);
          fg = mix(fg, outline[1], mark);
          fb = mix(fb, outline[2], mark);
        }
        r = mix(r, fr, inside);
        g = mix(g, fg, inside);
        b = mix(b, fb, inside);
      }
      const offset = (py * size + px) * 4;
      rgba[offset] = toByte(r);
      rgba[offset + 1] = toByte(g);
      rgba[offset + 2] = toByte(b);
      rgba[offset + 3] = alpha;
    }
  }
  return rgba;
}
