import { parse as parseCSV } from "https://deno.land/std@0.106.0/encoding/csv.ts";
import {
  basename,
  dirname,
  fromFileUrl,
  join as pathJoin,
} from "https://deno.land/std@0.106.0/path/mod.ts";

type Color = [number, number, number];

const SEGMENTS = 82;
const SVG_OFFSET = 4;

const COLORS: Color[] = [
  [254, 229, 217],
  [252, 174, 145],
  [251, 106, 74],
  [222, 45, 38],
  [165, 15, 21],
];

const REVERSED_COLORS = Array.from(COLORS).reverse();

/** distance: 0 to 1 */
const interpolateColor = (distance: number): Color => {
  const distanceInColor = distance * (COLORS.length - 1);
  const from = COLORS[Math.floor(distanceInColor)];
  const to = COLORS[Math.ceil(distanceInColor)];
  distance = distanceInColor - Math.floor(distanceInColor);

  return from.map((fromVal, i) =>
    Math.round(fromVal + distance * (to[i] - fromVal))
  ) as Color;
};

const rgb = (color: [number, number, number]) => {
  color = color.map((val) => Math.floor(val)) as [number, number, number];
  return `rgb(${color[0]},${color[1]},${color[2]})`;
};

const resourcePath = (input: string): string => {
  return pathJoin(
    dirname(fromFileUrl(import.meta.url)),
    "resources",
    input,
  );
};

if (Deno.args.includes("--help")) {
  console.log(`body_chart: generates body chart images from CSV files

USAGE:
    body_chart <INPUT_FILE1> [<INPUT_FILE2>...]

The images will be found in the same directory as the files.`);
  Deno.exit(0);
}

const BODY_IMAGE = await Deno.readTextFile(resourcePath("body.png.b64.txt"));

const SVG_CONTENTS = (await Deno.readTextFile(
  resourcePath("chart.svg"),
))
  .replace("$IMAGE_DATA", BODY_IMAGE)
  .replace(
    "$GRADIENT",
    REVERSED_COLORS.map((color, i) =>
      `      <stop offset="${100 * i / (COLORS.length - 1)}%" stop-color="${
        rgb(color)
      }" stop-opacity="0.8" />`
    ).join("\n"),
  )
  .split("\n");

const inputs = Deno.args;

for (const input of inputs) {
  const text = await Deno.readTextFile(input);
  const values = (await parseCSV(text) as string[][])
    .filter((row) =>
      !Number.isNaN(parseInt(row[0], 10)) &&
      !Number.isNaN(parseInt(row[1], 10))
    )
    .map((row) => row.slice(1).map((val) => parseInt(val, 10)));

  for (const type of ["any", "worst"] as const) {
    const output = pathJoin(
      dirname(input),
      basename(input, ".csv") + `.${type}.png`,
    );
    const threshold = type === "any" ? 1 : 2;

    const tally = values.reduce(
      (acc, curr) => acc.map((val, i) => curr[i] >= threshold ? val + 1 : val),
      Array.from({ length: SEGMENTS }, () => 0),
    );

    const max = Math.max(...tally);

    const svg = Array.from(SVG_CONTENTS);

    for (let i = 0; i < SEGMENTS; i++) {
      let fill: string;
      if (tally[i] === 0) {
        fill = `fill-opacity="0"`;
      } else {
        const color = interpolateColor((tally[i] - 1) / (max - 1));
        fill = `fill="${rgb(color)}"`;
      }
      svg[SVG_OFFSET + i] = svg[SVG_OFFSET + i].replace(
        `fill=""`,
        fill,
      );
    }

    const tmpSvg = await Deno.makeTempFile();

    const svgOutput = svg
      .join("\n")
      .replace("$MAX", max.toString());

    await Deno.writeTextFile(tmpSvg, svgOutput);

    const convertProcess = Deno.run({ cmd: ["convert", tmpSvg, output] });
    await convertProcess.status();
    convertProcess.close();

    await Deno.remove(tmpSvg);
  }
}
