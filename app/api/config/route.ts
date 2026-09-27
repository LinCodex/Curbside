import { publicConfig } from "@/lib/runtime";
export async function GET() {
  return Response.json(publicConfig(), {
    headers: { "Cache-Control": "no-store" },
  });
}
