import { NextResponse } from "next/server";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Fetches an image from a URL server-side (avoids CORS) for manual profile image upload.
 * Returns the image blob so the client can upload to storage.
 */
export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const urlString = typeof body.url === "string" ? body.url.trim() : "";
  if (!urlString || !urlString.startsWith("http")) {
    return NextResponse.json({ error: "Valid image url is required." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return NextResponse.json({ error: "URL must be http or https." }, { status: 400 });
  }

  try {
    const res = await fetch(url.href, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GardenTracker/1.0; +https://github.com/garden-tracker)",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Image returned ${res.status}.` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "";
    const rawType = contentType.split(";")[0].trim().toLowerCase();
    const isImage = rawType.startsWith("image/");
    const isOctet = rawType === "application/octet-stream";
    if (!isImage && !isOctet) {
      return NextResponse.json(
        { error: "URL did not return an image (wrong content-type)." },
        { status: 502 }
      );
    }

    const blob = await res.blob();
    if (blob.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large (max 10 MB)." },
        { status: 400 }
      );
    }

    const type = isImage ? (contentType.split(";")[0].trim() || "image/jpeg") : "image/jpeg";
    return new NextResponse(blob, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch image.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
