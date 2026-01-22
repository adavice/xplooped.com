import { loadCoaches } from "/js/chatApi.js";


// Attach modal triggers for nav and hero button
export function setupCoachSelectorTriggers() {
  // Nav link
  const coachingLink = document.getElementById("coachingNavLink");
  if (coachingLink) {
    coachingLink.addEventListener("click", function (e) {
      e.preventDefault();
      showCoachSelectorModal();
    });
  }
  // Hero CTA button
  const chooseCoachBtn = document.getElementById("chooseCoachBtn");
  if (chooseCoachBtn) {
    chooseCoachBtn.addEventListener("click", function (e) {
      e.preventDefault();
      showCoachSelectorModal();
    });
  }
}
// coachSelector.js
// Renders and manages the game/coach selection modal for reuse on any page
// Usage: import { setupCoachSelectorTriggers, showCoachSelectorModal } from './coachSelector.js';
// Then call setupCoachSelectorTriggers() on page load to wire buttons/links, and showCoachSelectorModal() to open lazily

const games = [
  {
    key: "tft",
    name: "Teamfight Tactics",
    genre: "Auto Battler",
    img: "/images/game-tft.jpg",
  },
  {
    key: "lol",
    name: "League of Legends",
    genre: "MOBA",
    img: "/images/game-lol.jpg",
  },
  {
    key: "valorant",
    name: "Valorant",
    genre: "Tactical Shooter",
    img: "/images/game-valorant.jpg",
  },
  {
    key: "fifa24",
    name: "EA Sports FC 24",
    genre: "Sports",
    img: "/images/game-fifa24.jpg",
  },
  { key: "dota2", name: "Dota 2", genre: "MOBA", img: "/images/game-dota2.jpg" },
  {
    key: "cs2",
    name: "Counter-Strike 2",
    genre: "Tactical Shooter",
    img: "/images/game-cs2.jpg",
  },
  {
    key: "apex",
    name: "Apex Legends",
    genre: "Battle Royale",
    img: "/images/game-apex.jpg",
  },
  {
    key: "fifa23",
    name: "FIFA 23",
    genre: "Sports",
    img: "/images/game-fifa23.jpg",
  },
];

function sortCoachesByRole(coaches) {
  return coaches.slice().sort((a, b) => {
    if (!a.role && !b.role) return 0;
    if (!a.role) return 1;
    if (!b.role) return -1;
    return a.role.localeCompare(b.role, undefined, { sensitivity: "base" });
  });
}

function renderGamesList() {
  const gamesList = document.getElementById("gamesList");
  if (!gamesList) return;
  gamesList.innerHTML = games
    .map((game, idx) => {
      return `
        <button class="list-group-item list-group-item-action d-flex align-items-center gap-3${
          idx === 0 ? " active" : ""
        }" data-game="${game.key}">
            <img src="${game.img}" alt="${game.name}" width="50" height="50" class="rounded">
            <div>
                <h6 class="mb-0 text-start">${game.name}</h6>
                <small class="text-muted">${game.genre}</small>
            </div>
        </button>
    `;
    })
    .join("");
}

async function renderCoachesInModal(gameKey) {
  const coachesList = document.getElementById("coachesList");
  if (!coachesList) return;
  const loadingText = "Loading coaches...";
  coachesList.innerHTML = `<div class="text-muted text-center">${loadingText}</div>`;
  try {
    const coaches = await loadCoaches();
    let genre = null;
    if (gameKey) {
      const game = games.find((g) => g.key === gameKey);
      genre = game ? game.genre : null;
    }
    let filtered = Array.isArray(coaches)
      ? coaches.filter(
          (coach) =>
            !genre ||
            (coach.role &&
              (coach.role.toLowerCase() === genre.toLowerCase() ||
                coach.role.toLowerCase() === "gaming"))
        )
      : [];
    filtered = sortCoachesByRole(filtered);
    if (filtered.length === 0) {
      const noCoachesText = "No coaches found for this game.";
      coachesList.innerHTML = `<div class="text-muted">${noCoachesText}</div>`;
      return;
    }
    coachesList.innerHTML = filtered
      .map((coach) => {
        const expertLabel = "expert";
        const statusLabel = coach.status || "online";
        const roleText = coach.role
          ? `${coach.role} ${expertLabel}`
          : `${expertLabel}`;
        return `
            <div class="col-md-6">
                <div class="coach-card border p-3 rounded d-flex gap-3 align-items-center coach-selectable" data-coach-id="${
                  coach.id
                }">
                    <img src="${
                      coach.avatar || "/images/default-avatar.png"
                    }" alt="${
          coach.name
        }" width="60" height="60" class="rounded-circle coach-select-avatar">
                    <div>
                        <h6 class="mb-1 text-center">${coach.name}</h6>
                        <div class="flags d-flex"></div>
                        <small class="text-muted">${
          coach.role ? `${coach.role} ${expertLabel}` : ""
        }</small>
                        <div class="mt-1">
                            <span class="badge bg-primary">${statusLabel}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
      })
      .join("");
    // Render language flags for each coach (if provided)
    try {
      coachesList.querySelectorAll(".coach-selectable").forEach((card) => {
        const coachId = card.getAttribute("data-coach-id");
        const coach = filtered.find((c) => String(c.id) === String(coachId));
        const flagsContainer = card.querySelector(".flags");
        if (!flagsContainer) return;
        if (coach && Array.isArray(coach.languages) && coach.languages.length) {
          // Use the 4x3 svg flags shipped in /css/assets/flag-icons/flags/4x3
          flagsContainer.innerHTML = coach.languages
            .map((code) => {
              const safeCode = String(code || "").toLowerCase();
              const imgPath = `/css/assets/flag-icons/flags/4x3/${encodeURIComponent(
                safeCode
              )}.svg`;
              return `<img src="${imgPath}" alt="${safeCode}" title="${safeCode}" width="24" height="18" class="me-1 rounded">`;
            })
            .join("");
        } else {
          flagsContainer.innerHTML = "";
        }
      });
    } catch (e) {
      // non-fatal: if DOM operations fail, leave flags empty
      console.error("Failed to render flags for coaches", e);
    }
    coachesList.querySelectorAll(".coach-selectable").forEach((card) => {
      card.addEventListener("click", function () {
        const coachId = this.getAttribute("data-coach-id");
        if (coachId) {
          window.location.href = `/?page=chat&coach=${encodeURIComponent(
            coachId
          )}`;
        }
      });
    });
  } catch (err) {
    // Always show login prompt if loading coaches fails
    const pleaseLogin = "Please log in to view the list of available coaches.";
    const loginBtnText = "Go to Login";
    coachesList.innerHTML = `
      <div class="text-center py-4 w-100">
        <div class="mb-3 text-muted">${pleaseLogin}</div>
        <a id="loginModalBtn" href="/?page=login" class="btn btn-primary">${loginBtnText}</a>
      </div>
    `;
    setTimeout(() => {
      const loginBtn = document.getElementById("loginModalBtn");
      if (loginBtn) {
        loginBtn.addEventListener("click", function (e) {
          e.preventDefault();
          const isIndex =
            window.location.pathname.endsWith("index.html") ||
            window.location.pathname === "/" ||
            window.location.pathname === "";
          if (isIndex) {
            // Just close the modal and scroll to login section
            const modalInstance = bootstrap.Modal.getInstance(
              document.getElementById("gameCoachModal")
            );
            if (modalInstance) modalInstance.hide();
            setTimeout(() => {
              const loginEl = document.getElementById("login");
              if (loginEl) {
                loginEl.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }, 400);
          } else {
            // Redirect to /?page=login
            window.location.href = "/?page=login";
          }
        });
      }
    }, 0);
  }
}

function ensureModalHtml() {
  if (document.getElementById("gameCoachModal")) return;
  const modalHtml = `
    <div class="modal fade" id="gameCoachModal" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-centered">
            <div class="modal-content coach-modal-content">
                <div class="modal-header coach-modal-header">
                    <div class="d-flex align-items-center gap-3">
                        <div class="modal-icon-wrapper">
                            <i class="fas fa-gamepad"></i>
                        </div>
                        <div>
                            <h5 class="modal-title mb-0" id="gameCoachModalTitle" data-i18n="modal.title">Select Your Game</h5>
                            <small class="text-muted">Choose a game and find your perfect coach</small>
                        </div>
                    </div>
                    <button type="button" class="btn-close btn-close-white coach-modal-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body coach-modal-body p-0">
                    <div class="g-0">
                        <div class="col-md-4 coach-games-sidebar p-0">
                            <div class="sidebar-header">
                                <h4 class="mb-0"><i class="fas fa-trophy me-2"></i>Popular Games</h4>
                            </div>
                            <div class="list-group list-group-flush" id="gamesList"></div>
                        </div>
                        <div class="col-md-8">
                            <div class="p-4">
                                <div class="coaches-header mb-4 text-center">
                                    <h4 class="mb-1"><i class="fas fa-users me-2"></i>Available Coaches</h4>
                                    <small class="text-muted">Click on a coach to start your journey</small>
                                </div>
                                <div class="row g-4" id="coachesList"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  // Set localized title immediately after insertion (modal created dynamically)
  try {
    const titleEl = document.getElementById("gameCoachModalTitle");
    if (titleEl) {
      titleEl.textContent = "Select Game & Coach";
    }
  } catch (e) {
    // no-op if localization fails
  }
}

export function showCoachSelectorModal() {
  ensureModalHtml();
  renderGamesList();
  const gamesList = document.getElementById("gamesList");
  if (gamesList) {
    let activeBtn = gamesList.querySelector(".list-group-item.active");
    let initialGame = activeBtn ? activeBtn.getAttribute("data-game") : null;
    renderCoachesInModal(initialGame);
    // Attach a single click handler; overwrite any previous to avoid duplicates across opens
    gamesList.onclick = (e) => {
      const btn = e.target.closest(".list-group-item");
      if (!btn) return;
      gamesList
        .querySelectorAll(".list-group-item")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderCoachesInModal(btn.getAttribute("data-game"));
      
      // Scroll to coaches list on mobile after selection
      if (window.innerWidth < 768) {
        setTimeout(() => {
          const coachesList = document.getElementById("coachesList");
          if (coachesList) {
            coachesList.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      }
    };
  }
  const modal = new bootstrap.Modal(document.getElementById("gameCoachModal"));
  modal.show();
}
