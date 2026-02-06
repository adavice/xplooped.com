
(function () {
  const el = document.querySelector(".current-year");
  if (el) el.textContent = new Date().getFullYear();
})();

import { setupCoachSelectorTriggers } from "/js/coachSelector.js";
import { getCurrentUser } from "/js/chatApi.js";

function renderToast(message, success = false) {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector(".toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className =
      "toast-container position-fixed bottom-0 end-0 p-3";
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-bg-${
    success ? "success" : "danger"
  } border-0 show`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  toast.setAttribute("aria-atomic", "true");
  toast.style.minWidth = "250px";
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="bi ${
          success
            ? "bi-check-circle-fill text-success"
            : "bi-exclamation-circle-fill text-danger"
        } me-2"></i>
        <span>${message}</span>
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  toastContainer.appendChild(toast);

  // Show toast using Bootstrap's Toast API if available
  if (window.bootstrap && window.bootstrap.Toast) {
    const bsToast = window.bootstrap.Toast.getOrCreateInstance(toast, {
      delay: 3000,
    });
    bsToast.show();
    toast.addEventListener("hidden.bs.toast", () => toast.remove());
  } else {
    // Fallback: auto-remove after 3s
    setTimeout(() => toast.remove(), 3000);
  }
}

export function showToast(messageOrKey, success = false) {
  try {
    // If server returned a raw error string, map common patterns to user-friendly messages
    if (typeof messageOrKey === "string") {
      for (const m of serverErrorMappings) {
        try {
          if (m.pattern.test(messageOrKey)) {
            messageOrKey = m.message;
            break;
          }
        } catch (e) {
          /* ignore malformed patterns */
        }
      }
    }
    renderToast(messageOrKey, success);
  } catch (e) {
    renderToast(messageOrKey, success);
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  // Make showToast available globally
  window.showToast = showToast;

});

document.addEventListener("DOMContentLoaded", function () {
  // Wire up coach selector triggers lazily (no preloading inside the module)
  try { setupCoachSelectorTriggers(); } catch {}

  // Determine login state (supports different stored shapes)
  const user = getCurrentUser();
  const isLogged = Boolean(user && (user.username || user.id));

  const loginBtn = document.querySelector(".login-btn");
  const logoutBtn = document.querySelector(".logout-btn");

  if (isLogged) {
    // hide login, show cancel subscription
    if (loginBtn) loginBtn.classList.add("d-none");
    if (logoutBtn) logoutBtn.classList.remove("d-none");
    // display username in header if placeholder exists
    const userEl = document.querySelector(".user-name");
    if (userEl) userEl.textContent = user.username || user.id;
  } else {
    // show login, hide cancel subscription
    if (loginBtn) loginBtn.classList.remove("d-none");
    if (logoutBtn) logoutBtn.classList.add("d-none");
    const userEl = document.querySelector(".user-name");
    if (userEl) userEl.textContent = "";
  }

  { 
    // cleanup leftover modal backdrops and restore body scrolling
    function cleanupModalBackdrop() {
      try {
        // remove any leftover backdrop elements
        const backdrops = document.querySelectorAll(".modal-backdrop");
        backdrops.forEach((b) => b.remove());

        // remove modal-open class from body and restore overflow/padding
        document.body.classList.remove("modal-open");
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      } catch (e) {
        // ignore
      }
    }

    // Delegated handler for close controls (works for dynamic modals too)
    document.addEventListener("click", function (ev) {
      const btn = ev.target.closest('[data-bs-dismiss="modal"], .modal .btn-close, .modal .close');
      if (!btn) return;

      // locate parent modal
      const modalEl = btn.closest(".modal");
      if (!modalEl) {
        // still run cleanup in case modal markup is custom
        setTimeout(cleanupModalBackdrop, 50);
        return;
      }

      // If Bootstrap Modal API available, call hide(); otherwise fallback to manual cleanup
      try {
        if (window.bootstrap && window.bootstrap.Modal) {
          const instance = window.bootstrap.Modal.getInstance(modalEl) || window.bootstrap.Modal.getOrCreateInstance(modalEl);
          if (instance && typeof instance.hide === "function") {
            instance.hide();
          } else {
            // hide class fallback
            modalEl.classList.remove("show");
            modalEl.setAttribute("aria-hidden", "true");
            modalEl.style.display = "none";
          }
        } else {
          // fallback: remove show/display
          modalEl.classList.remove("show");
          modalEl.setAttribute("aria-hidden", "true");
          modalEl.style.display = "none";
        }
      } catch (e) {
        // ignore errors and ensure cleanup runs
      }

      // small delay to allow Bootstrap to animate/hide -> then cleanup any leftover backdrop
      setTimeout(cleanupModalBackdrop, 120);
    });

    // Ensure cleanup runs if Bootstrap emits hidden event (safety net)
    document.addEventListener("hidden.bs.modal", function () {
      setTimeout(cleanupModalBackdrop, 40);
    });
  }
});
