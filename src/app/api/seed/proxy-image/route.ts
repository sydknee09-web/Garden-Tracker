import { NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "johnnyseeds.com",
  "www.johnnyseeds.com",
  "rareseeds.com",
  "www.rareseeds.com",
  "marysheirloomseeds.com",
  "www.marysheirloomseeds.com",
  "territorialseed.com",
  "www.territorialseed.com",
  "burpee.com",
  "www.burpee.com",
  "botanicalinterests.com",
  "www.botanicalinterests.com",
  "edenbrothers.com",
  "www.edenbrothers.com",
  "images.johnnyseeds.com",
  // Hero search / gallery often returns these (Wikimedia, CDNs, extensions)
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "static.wikia.nocookie.net",
  "i.etsystatic.com",
  "images.unsplash.com",
  "images.pexels.com",
  // Common plant/botanical image sources that allow embedding
  "cdn.pixabay.com",
  "pixabay.com",
  "live.staticflickr.com",
  "extension.illinois.edu",
  "imgur.com",
  "i.imgur.com",
];

function isAllowedImageUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (ALLOWED_HOSTS.some((h) => h === host)) return true;
  if (host.endsWith(".johnnyseeds.com") || host.endsWith(".rareseeds.com") || host.endsWith(".burpee.com") || host.endsWith(".botanicalinterests.com")) return true;
  if (host.endsWith(".wikimedia.org")) return true;
  if (host.endsWith(".staticflickr.com") || host.includes("staticflickr.com")) return true;
  if (host.endsWith(".pixabay.com") || host.endsWith(".imgur.com")) return true;
  if (host.startsWith("cdn.")) return true;
  return false;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");
  if (!imageUrl || !imageUrl.startsWith("http")) {
    return NextResponse.json({ error: "Valid url query required." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  const strictAllowlist = isAllowedImageUrl(url);

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
    // For domains not on the allowlist, only allow through if response is actually an image (avoids open proxy)
    if (!strictAllowlist && !isImage) {
      return NextResponse.json(
        { error: "Image URL domain not allowed." },
        { status: 400 }
      );
    }

    const blob = await res.blob();
    const type = isImage ? (contentType.split(";")[0].trim() || "image/jpeg") : "image/jpeg";
    return new NextResponse(blob, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch image.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
