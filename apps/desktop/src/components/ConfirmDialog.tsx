import { createPortal } from "react-dom";

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** A modal dialog that asks the user to confirm an action. */
export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  return createPortal(
    // Stop clicks from reaching the React parents of the portal, such as a
    // fusen card that selects itself on click.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-80 rounded-lg border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <h2 id="confirm-title" className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {title}
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded border border-neutral-300 px-3 py-1 text-sm text-red-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-red-400 dark:hover:bg-neutral-800"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
