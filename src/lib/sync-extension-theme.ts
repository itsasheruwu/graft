const DARK_QUERY = "(prefers-color-scheme: dark)";

export function syncExtensionThemeClass(root: HTMLElement = document.documentElement) {
  const apply = () => {
    const dark = window.matchMedia(DARK_QUERY).matches;
    root.classList.toggle("dark", dark);
  };

  apply();

  const mq = window.matchMedia(DARK_QUERY);
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", apply);
  } else {
    mq.addListener(apply);
  }
}
