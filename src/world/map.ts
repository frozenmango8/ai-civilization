import type { Building, Point } from "./types";
export const names = [
  "Milo",
  "Juniper",
  "Oliver",
  "Cleo",
  "Rowan",
  "Poppy",
  "Felix",
  "Willow",
  "Theo",
  "Iris",
  "Jasper",
  "Hazel",
  "Arlo",
  "Florence",
  "Finn",
  "Olive",
  "Leo",
  "Wren",
  "Oscar",
  "Daisy",
];
const colors = ["#d8bc91", "#c3cfa3", "#e3bdac", "#c0ced1", "#d9cead"];
export const buildings: Building[] = [
  {
    id: "hall",
    name: "Town Hall",
    kind: "hall",
    position: [0, -8],
    color: "#e6d9b8",
  },
  {
    id: "farm",
    name: "Sunfield Farm",
    kind: "farm",
    position: [-14, 8],
    color: "#a4b65a",
  },
  {
    id: "market",
    name: "The Sunday Market",
    kind: "market",
    position: [12, 5],
    color: "#d79b75",
  },
  {
    id: "forest",
    name: "Whispering Woods",
    kind: "forest",
    position: [18, -10],
    color: "#49704c",
  },
  {
    id: "construction",
    name: "The New Library",
    kind: "construction",
    position: [-13, -10],
    color: "#be9b73",
  },
  {
    id: "fountain",
    name: "Founders’ Square",
    kind: "fountain",
    position: [0, 1],
    color: "#b6c7c5",
  },
  ...names.map((_, i): Building => ({
    id: `home-${i}`,
    name: `${names[i]}’s Cottage`,
    kind: "home",
    position: [
      i < 10 ? -23 + (i % 5) * 10 : -23 + (i % 5) * 10,
      i < 5 ? -21 : i < 10 ? 21 : i < 15 ? -29 : 29,
    ],
    color: colors[i % colors.length],
    owner: `citizen-${i}`,
  })),
];
// A connected street graph: building doors join horizontal lanes and the central avenue.
export function roadPath(from: Point, to: Point): Point[] {
  const lane = (z: number) => (z < -16 ? -16 : z > 16 ? 16 : 0);
  const a = lane(from[1]),
    b = lane(to[1]);
  return [
    from,
    [from[0], a],
    ...(a === b
      ? []
      : ([
          [0, a],
          [0, b],
        ] as Point[])),
    [to[0], b],
    to,
  ].filter(
    (p, i, all) =>
      i === 0 || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > 0.01,
  ) as Point[];
}
export function pointAlong(path: Point[], progress: number): Point {
  const lengths = path
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  let d =
    lengths.reduce((a, b) => a + b, 0) * Math.min(1, Math.max(0, progress));
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i]) {
      const t = lengths[i] ? d / lengths[i] : 1;
      return [
        path[i][0] + (path[i + 1][0] - path[i][0]) * t,
        path[i][1] + (path[i + 1][1] - path[i][1]) * t,
      ];
    }
    d -= lengths[i];
  }
  return path.at(-1) ?? [0, 0];
}
