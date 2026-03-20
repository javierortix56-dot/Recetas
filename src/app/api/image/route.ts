import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url param", { status: 400 });
  }

  // Only allow Firebase Storage URLs
  if (!url.includes("firebasestorage.googleapis.com") && !url.includes("storage.googleapis.com")) {
    return new NextResponse("URL not allowed", { status: 403 });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return new NextResponse("Failed to fetch image", { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Error fetching image", { status: 500 });
  }
}
