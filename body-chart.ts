import { parse } from "https://deno.land/std@0.106.0/encoding/csv.ts";

const SEGMENTS = 82;

const threshold = 1;

const text = await Deno.readTextFile("./test.csv");
const values = (await parse(text) as string[][])
  .filter((row) =>
    !Number.isNaN(parseInt(row[0], 10)) && !Number.isNaN(parseInt(row[1], 10))
  )
  .map((row) => row.slice(1).map((val) => parseInt(val, 10)));

const init = Array.from({ length: SEGMENTS }, () => 0);

const tally = values.reduce(
  (acc, curr) => acc.map((val, i) => curr[i] >= threshold ? val + 1 : val),
  init,
);

const max = Math.max(...tally);

const svg = (await Deno.readTextFile("./zones.svg")).split("\n");

for (let i = 0; i < SEGMENTS; i++) {
  const green = tally[i] === 0 ? 255 : Math.floor(255 * (max - tally[i]) / (max - 1))
  svg[i + 4] = svg[i + 4].replace(
    `fill=""`,
    `fill="rgb(255,${green},${tally[i] === 0 ? 255 : 0})"`,
  );
}

await Deno.writeTextFile("./test.svg", svg.join("\n"));
