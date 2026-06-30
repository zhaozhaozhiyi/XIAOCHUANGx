import { probeOpenScadToolchain } from "@/lib/cad-toolchain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const openscad = await probeOpenScadToolchain();
  return Response.json({
    openscad,
    capabilities: {
      scadToStl: openscad.available,
      scadToDxfProjection: openscad.available,
      previewStlFallback: true,
      parameterOutlineDxfFallback: true,
    },
  });
}
