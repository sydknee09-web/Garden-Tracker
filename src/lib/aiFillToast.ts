/**
 * Toast copy for AI Fill background-job completions, shown GLOBALLY (the job survives
 * navigation, so the toast can fire on any page — every message names its plant).
 *
 * Adapts the honest-feedback copy set (locked verbatim Syd 2026-06-10; audit 2026-06-10
 * §8.4 + B5) to the backgrounding brief's subject-named direction ("Cherokee Purple
 * profile updated", Syd-directed via Dispatch 2026-06-11 — declared supersession, same
 * shape as Ship 2's species-fallback lock). Semantics preserved: notFound outranks an
 * incidental fieldsFilled count; quota/infra failures read as "AI unavailable".
 */

export type AiFillResultSummary = {
  fieldsFilled?: number;
  notFound?: boolean;
  enriched?: boolean;
  /** Filled something + found the plant, but a core section is still empty (Finding #41). */
  partial?: boolean;
  error?: string;
  plantName?: string;
};

export type AiFillToastContent = {
  message: string;
  variant: "success" | "error";
};

/** Subject = variety_name || name, captured by the enqueue route; "Plant" guards the empty edge. */
export function aiFillJobToastContent(summary: AiFillResultSummary): AiFillToastContent {
  const subject = (summary.plantName ?? "").trim() || "Plant";
  if (summary.notFound) {
    return {
      message: `Couldn't find data for ${subject}. Check the spelling of name and variety.`,
      variant: "error",
    };
  }
  const filled = typeof summary.fieldsFilled === "number" ? summary.fieldsFilled : 0;
  if (filled > 0) {
    // Honest partial signal (Finding #41): a core section is still empty after a successful fill —
    // name it so the user doesn't read the green toast as "fully done". Still success, not error.
    if (summary.partial) {
      const noun = filled === 1 ? "field" : "fields";
      return {
        message: `${subject}: filled ${filled} ${noun} — some details unavailable, tap Fill blanks to retry`,
        variant: "success",
      };
    }
    return { message: `${subject} profile updated`, variant: "success" };
  }
  const quota = summary.error === "DAILY_AI_LIMIT" || summary.error === "RATE_LIMITED";
  if (summary.error || quota || summary.enriched === false) {
    return { message: `${subject}: AI unavailable, try again later`, variant: "error" };
  }
  return { message: `${subject}: nothing new to add`, variant: "success" };
}
