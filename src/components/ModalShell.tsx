import React, { useEffect } from 'react';

interface ModalShellProps {
  /** Called on backdrop click, on Escape, and by the caller's own controls. */
  onClose: () => void;
  /** Bootstrap modal-dialog modifiers, e.g. "modal-lg modal-dialog-scrollable". */
  dialogClassName?: string;
  /**
   * When false, backdrop clicks and Escape are ignored. Set it while a form is
   * submitting or holds work that is expensive to re-enter, so a stray click
   * outside cannot discard it.
   */
  dismissible?: boolean;
  /** Contents of .modal-content — typically modal-header, modal-body, modal-footer. */
  children: React.ReactNode;
}

/**
 * The frame every modal in the app sits in: backdrop, body scroll lock, and
 * dismissal.
 *
 * These mechanics were previously copy-pasted into each modal, which meant
 * they drifted — two modals closed on a backdrop click and two did not, and
 * none handled Escape. Callers supply only their content and how wide the
 * dialog should be.
 *
 * Light and dark are handled by Tabler's own modal CSS, which keys off
 * data-bs-theme on the root element, so nothing here inspects the theme.
 */
const ModalShell: React.FC<ModalShellProps> = ({
  onClose,
  dialogClassName = '',
  dismissible = true,
  children
}) => {
  useEffect(() => {
    // Restore rather than clear: a modal opened from another modal must not
    // hand scrolling back to the page while the first one is still open.
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    if (!dismissible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dismissible, onClose]);

  return (
    <>
      <div
        className="modal-backdrop fade show"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        className="modal modal-blur fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={`modal-dialog modal-dialog-centered ${dialogClassName}`.trim()}
          role="document"
        >
          <div className="modal-content">{children}</div>
        </div>
      </div>
    </>
  );
};

export default ModalShell;
