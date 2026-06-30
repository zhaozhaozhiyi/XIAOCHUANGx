import { buildSvgFromScadParameters } from "../web/src/lib/scad-dxf-export.ts";
import { parseScadParameters } from "../web/src/lib/scad-parameters.ts";

const source = `/* [Main Dimensions] */
base_length = 120; // [40:5:300]
base_width = 80; // [30:5:200]
hole_diameter = 8; // [4:1:30]
hole_margin = 16; // [8:1:50]

cube([base_length, base_width, 8]);
`;

const parameters = parseScadParameters(source);
const svg = buildSvgFromScadParameters(parameters);
const circleCount = (svg.match(/<circle /g) ?? []).length;
const ok =
  svg.includes("<svg") &&
  svg.includes("<rect") &&
  circleCount === 4 &&
  svg.includes("120.000000 x 80.000000 mm");

console.log(
  JSON.stringify(
    {
      ok,
      parameters: parameters.length,
      circleCount,
      length: svg.length,
    },
    null,
    2,
  ),
);

if (!ok) process.exitCode = 1;
