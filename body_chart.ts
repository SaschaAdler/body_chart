import { parse as parseCSV } from "https://deno.land/std@0.106.0/encoding/csv.ts";
import {
  basename,
  dirname,
  fromFileUrl,
  isAbsolute,
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

/** distance: 0 to 1 */
const interpolateColor = (distance: number) => {
  const distanceInColor = distance * (COLORS.length - 1);
  const from = COLORS[Math.floor(distanceInColor)];
  const to = COLORS[Math.ceil(distanceInColor)];
  distance = distanceInColor - Math.floor(distanceInColor);

  const result: Color = from.slice() as Color;
  for (let i = 0; i < 3; i++) {
    result[i] = Math.round(result[i] + distance * (to[i] - from[i]));
  }
  return result;
};

const rgb = (color: [number, number, number]) => {
  color = color.map((val) => Math.floor(val)) as [number, number, number];
  return `rgb(${color[0]},${color[1]},${color[2]})`;
};

const getPath = (input: string): string => {
  return isAbsolute(input) ? input : pathJoin(Deno.cwd(), input);
};

const resourcePath = (input: string): string => {
  return pathJoin(
    dirname(fromFileUrl(import.meta.url)),
    "resources",
    input,
  );
};

// TODO: drop "extreme", create two files: $X.all.png and $X.worst.png
if (Deno.args.includes("--help")) {
  console.log(`body_chart: generates a body chart image from a csv file

USAGE:
    body_chart [--extreme] [--output=<OUTPUT_FILE>] <INPUT_FILE>

OPTIONS:
    --extreme
        Only uses "extreme" pain values (i.e. "2")
    
    --output=<OUTPUT_FILE>
        Creates the output image file at OUTPUT_FILE.
        By default, the output file is generated in the same directory as
        the input file, with extension \`.png\`.`);
  Deno.exit(0);
}

// Parse arguments
const parseArgs = (args: string[]) => {
  const bare = args.filter((arg) => !arg.startsWith("--"));
  if (bare.length === 0) {
    console.error("Please specify an input file.");
    Deno.exit(1);
  } else if (bare.length > 1) {
    console.error("Please specify only one input file.");
    Deno.exit(Math.min(bare.length, 255));
  }
  const input = getPath(bare[0]);

  const threshold = args.includes("--extreme") ? 2 : 1;
  const outputArg = args.find((arg) => arg.startsWith("--output="));
  const output = outputArg
    ? getPath(outputArg.slice("--output=".length))
    : pathJoin(dirname(input), basename(input, ".csv") + ".png");

  return { input, output, threshold };
};

const args = parseArgs(Deno.args);

const text = await Deno.readTextFile(args.input);
const values = (await parseCSV(text) as string[][])
  .filter((row) =>
    !Number.isNaN(parseInt(row[0], 10)) && !Number.isNaN(parseInt(row[1], 10))
  )
  .map((row) => row.slice(1).map((val) => parseInt(val, 10)));

const tally = values.reduce(
  (acc, curr) => acc.map((val, i) => curr[i] >= args.threshold ? val + 1 : val),
  Array.from({ length: SEGMENTS }, () => 0),
);

const max = Math.max(...tally);

const svg = (await Deno.readTextFile(
  resourcePath("chart.svg"),
)).split("\n");

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

const bodyImage = await Deno.readTextFile(resourcePath("body.png.b64.txt"));

const tmpSvg = await Deno.makeTempFile();

const svgOutput = svg
  .join("\n")
  .replace("$IMAGE_DATA", bodyImage)
  .replace("$MAX", max.toString())
  .replace(
    "$GRADIENT",
    COLORS.reverse().map((color, i) =>
      `      <stop offset="${100 * i / (COLORS.length - 1)}%" stop-color="${
        rgb(color)
      }" stop-opacity="0.8" />`
    ).join("\n"),
  );

await Deno.writeTextFile(tmpSvg, svgOutput);

const convertProcess = Deno.run({ cmd: ["convert", tmpSvg, args.output] });
await convertProcess.status();
convertProcess.close();
