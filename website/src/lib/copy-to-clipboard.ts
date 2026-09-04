const RESET_MS = 2200;

/** Copies text, falling back to a temporary textarea when the async API is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export interface CopyButtonOptions {
  getText: () => string;
  doneLabel?: string;
  onCopied?: () => void;
}

/** Wires a button to copy text and flash a "done" state for a moment. */
export function bindCopyButton(button: HTMLButtonElement, options: CopyButtonOptions): void {
  const label = button.querySelector<HTMLElement>('[data-copy-label]') ?? button;
  const idleLabel = label.textContent ?? '';
  const doneLabel = options.doneLabel ?? 'Copied';
  let timer: ReturnType<typeof setTimeout> | undefined;

  button.addEventListener('click', () => {
    void copyText(options.getText()).then((ok) => {
      if (!ok) return;
      if (timer !== undefined) clearTimeout(timer);
      button.dataset.copied = '';
      label.textContent = doneLabel;
      options.onCopied?.();
      timer = setTimeout(() => {
        delete button.dataset.copied;
        label.textContent = idleLabel;
        timer = undefined;
      }, RESET_MS);
    });
  });
}
