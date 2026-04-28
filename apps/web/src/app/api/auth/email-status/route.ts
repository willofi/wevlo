import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest): Promise<Response> {
  request.nextUrl.searchParams.get("email");
  return NextResponse.json(
    {
      message: "This endpoint is deprecated."
    },
    { status: 410 }
  );
}
