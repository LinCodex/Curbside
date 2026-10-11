export async function GET() {
  return Response.json(
    { version: process.env.APP_BUILD_ID || "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
