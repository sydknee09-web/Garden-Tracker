/**
 * Parses the body of a find-hero-photo API response.
 * When the server returns non-JSON (e.g. HTML error page or timeout), we show a friendly
 * message instead of exposing "Unexpected token ... is not valid JSON".
 */

export type FindHeroPhotoResult =
  | { success: true; url: string }
  | { success: false; error: string };

const ERROR_MSG_OK = "Search failed. Please try again.";
const ERROR_MSG_NOT_OK = "Search timed out or the server returned an error. Please try again.";

export function parseFindHeroPhotoResponse(text: string, resOk: boolean): FindHeroPhotoResult {
  let data: { hero_image_url?: string; error?: string };
  try {
    data = JSON.parse(text) as { hero_image_url?: string; error?: string };
  } catch {
    return {
      success: false,
      error: resOk ? ERROR_MSG_OK : ERROR_MSG_NOT_OK,
    };
  }
  const url = data.hero_image_url?.trim();
  if (url?.startsWith("http")) {
    return { success: true, url };
  }
  return {
    success: false,
    error: data.error?.trim() ?? "No image found for this variety.",
  };
}
