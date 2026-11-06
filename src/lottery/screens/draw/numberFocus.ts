/**
 * "Buy another number" (Printed) returns to Draw with the number window
 * focused, as the board does. The Draw route's params are frozen
 * (navigation/types.ts), so the wish travels through this one flag instead:
 * Printed raises it right before `popTo("LotteryDraw")`, and Draw takes it the
 * next time it gains focus. Plain module state on purpose — it is a one-shot
 * UI hint, never data, and it must not re-render anything.
 */
let wanted = false;

/** Printed: focus the number window when Draw shows again. */
export function requestNumberFocus(): void {
  wanted = true;
}

/** Draw: whether a focus was asked for (and forget it). */
export function takeNumberFocusRequest(): boolean {
  const asked = wanted;
  wanted = false;
  return asked;
}
