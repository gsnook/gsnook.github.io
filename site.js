document.documentElement.classList.add("has-js");

const navToggle = document.querySelector(".nav-toggle");
const navigation = document.querySelector("[data-nav]");

function setNavigation(open) {
  if (!navToggle || !navigation) {
    return;
  }

  navToggle.setAttribute("aria-expanded", String(open));
  navigation.dataset.open = String(open);
}

if (navToggle && navigation) {
  navToggle.addEventListener("click", () => {
    setNavigation(navToggle.getAttribute("aria-expanded") !== "true");
  });

  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      setNavigation(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navigation.dataset.open === "true") {
      setNavigation(false);
      navToggle.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 920) {
      setNavigation(false);
    }
  });
}

document.querySelectorAll("[data-year]").forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

document.querySelectorAll("[data-print]").forEach((button) => {
  button.addEventListener("click", () => window.print());
});

const previewCards = Array.from(document.querySelectorAll("[data-project-preview]"));
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
let previewObserver;
let activePreview;

function previewVideo(card) {
  return card.querySelector(".credit-video");
}

function pausePreview(card) {
  const video = previewVideo(card);

  card.dataset.previewRequested = "false";
  card.classList.remove("is-previewing");
  video?.pause();

  if (activePreview === card) {
    activePreview = undefined;
  }
}

function pauseOtherPreviews(currentCard) {
  previewCards.forEach((card) => {
    if (card !== currentCard) {
      pausePreview(card);
    }
  });
}

function loadPreview(video) {
  if (video.dataset.loaded === "true") {
    return;
  }

  video.src = video.dataset.src;
  video.preload = "metadata";
  video.dataset.loaded = "true";
  video.load();
}

function startPreview(card) {
  if (reducedMotionQuery.matches || card.classList.contains("preview-unavailable")) {
    return;
  }

  const video = previewVideo(card);

  if (!video) {
    return;
  }

  pauseOtherPreviews(card);
  card.dataset.previewRequested = "true";
  loadPreview(video);

  const play = () => {
    if (card.dataset.previewRequested !== "true") {
      return;
    }

    const start = Number(video.dataset.start);
    const end = Number(video.dataset.end);

    if (video.currentTime < start || video.currentTime >= end) {
      video.currentTime = start;
    }

    video.play().then(() => {
      if (card.dataset.previewRequested !== "true") {
        video.pause();
        return;
      }

      activePreview = card;
      card.classList.add("is-previewing");
    }).catch((error) => {
      card.classList.remove("is-previewing");

      if (error.name !== "AbortError" && error.name !== "NotAllowedError") {
        console.warn("Project motion preview could not play.", error);
      }
    });
  };

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    play();
  } else {
    video.addEventListener("loadedmetadata", play, { once: true });
  }
}

function configurePreviewMode() {
  previewObserver?.disconnect();
  previewCards.forEach(pausePreview);

  if (reducedMotionQuery.matches || hoverQuery.matches) {
    return;
  }

  previewObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        startPreview(entry.target);
      } else {
        pausePreview(entry.target);
      }
    });
  }, { threshold: 0.72 });

  previewCards.forEach((card) => previewObserver.observe(card));
}

if (previewCards.length > 0) {
  document.documentElement.classList.add("has-motion-previews");

  previewCards.forEach((card) => {
    const video = previewVideo(card);

    card.addEventListener("pointerenter", () => {
      if (hoverQuery.matches) {
        startPreview(card);
      }
    });
    card.addEventListener("pointerleave", () => {
      if (hoverQuery.matches) {
        pausePreview(card);
      }
    });
    card.addEventListener("focusin", () => startPreview(card));
    card.addEventListener("focusout", () => pausePreview(card));

    video?.addEventListener("timeupdate", () => {
      const end = Number(video.dataset.end);
      const start = Number(video.dataset.start);

      if (video.currentTime >= end) {
        video.currentTime = start;
      }
    });

    video?.addEventListener("error", () => {
      card.classList.add("preview-unavailable");
      pausePreview(card);
      console.warn(`Project motion preview failed to load: ${video.dataset.src}`);
    });
  });

  reducedMotionQuery.addEventListener("change", configurePreviewMode);
  hoverQuery.addEventListener("change", configurePreviewMode);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      previewCards.forEach(pausePreview);
    }
  });
  configurePreviewMode();
}

const projectDialogs = Array.from(document.querySelectorAll(".project-dialog"));
const dialogTriggers = new WeakMap();
const synchronouslyClosedDialogs = new WeakSet();

function finishDialogClose(dialog) {
  const anotherDialogIsOpen = projectDialogs.some((candidate) => {
    return candidate !== dialog && candidate.open;
  });

  if (anotherDialogIsOpen) {
    return;
  }

  document.documentElement.classList.remove("dialog-open");
  dialogTriggers.get(dialog)?.focus({ preventScroll: true });
}

function closeProjectDialog(dialog) {
  if (dialog.open) {
    synchronouslyClosedDialogs.add(dialog);
    dialog.close();
  }

  finishDialogClose(dialog);
}

document.querySelectorAll("[data-dialog-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = document.getElementById(button.dataset.dialogTarget);

    if (!dialog || typeof dialog.showModal !== "function" || dialog.open) {
      return;
    }

    const card = button.closest("[data-project-preview]");

    if (card) {
      pausePreview(card);
    }

    dialogTriggers.set(dialog, button);
    dialog.showModal();
    document.documentElement.classList.add("dialog-open");
  });
});

projectDialogs.forEach((dialog) => {
  dialog.querySelector("[data-dialog-close]")?.addEventListener("click", () => {
    closeProjectDialog(dialog);
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeProjectDialog(dialog);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) {
      return;
    }

    const bounds = dialog.getBoundingClientRect();
    const outsideDialog =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (outsideDialog) {
      closeProjectDialog(dialog);
    }
  });

  dialog.addEventListener("close", () => {
    if (!synchronouslyClosedDialogs.delete(dialog)) {
      finishDialogClose(dialog);
    }
  });
});
