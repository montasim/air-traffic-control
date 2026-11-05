import { mountHugeIcon, type AppIconName } from "./hugeicons";

export interface ConfirmRequest {
  readonly title: string;
  readonly copy: string;
  /** The button that goes ahead; the safe choice is always "Keep playing". */
  readonly accept: { readonly label: string; readonly icon: AppIconName };
}

/** Leaving discards the shift, wherever the player leaves from (the pause menu or another airfield). */
export const LEAVE_SHIFT: ConfirmRequest = {
  title: "Leave this shift?",
  copy: "This unfinished shift will not count toward your career, records, or achievements.",
  accept: { label: "Main menu", icon: "home" },
};

export const RESTART_SHIFT: ConfirmRequest = {
  title: "Restart this shift?",
  copy: "Your unfinished shift, including achievement progress, will not be saved.",
  accept: { label: "Restart shift", icon: "restart" },
};

/**
 * The one confirmation dialog: asks, then runs the action only if the player goes ahead. Closing it
 * any other way (Keep playing, Escape) forgets the action.
 */
export function createConfirmDialog(dialog: HTMLDialogElement): (request: ConfirmRequest, action: () => void) => void {
  let pending: (() => void) | undefined;
  dialog.querySelector("#confirm-cancel")!.addEventListener("click", () => dialog.close());
  dialog.querySelector("#confirm-accept")!.addEventListener("click", () => {
    const action = pending;
    dialog.close();
    action?.();
  });
  dialog.addEventListener("close", () => { pending = undefined; });
  return (request, action) => {
    pending = action;
    dialog.querySelector("#confirm-title")!.textContent = request.title;
    dialog.querySelector("#confirm-copy")!.textContent = request.copy;
    dialog.querySelector("#confirm-accept-label")!.textContent = request.accept.label;
    mountHugeIcon(dialog.querySelector<HTMLElement>("#confirm-accept-icon")!, request.accept.icon, 18);
    dialog.showModal();
  };
}
