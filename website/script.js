const journal = document.querySelector("#journal");
const controls = [
  {
    id: "theme-toggle",
    className: "is-dark",
    message: "A softer palette. A little easier on the eyes.",
  },
  {
    id: "hide-toggle",
    className: "is-focused",
    message: "Distraction removed. Room for what matters.",
  },
  {
    id: "sound-toggle",
    className: "is-boosted",
    message: "A little more volume. Illustrated here at 200%.",
  },
];
for (const control of controls) {
  const button = document.getElementById(control.id);
  button.addEventListener("click", () => {
    const enabled = button.getAttribute("aria-checked") !== "true";
    button.setAttribute("aria-checked", String(enabled));
    journal.classList.toggle(control.className, enabled);
    document.querySelector("#volume-output").textContent =
      journal.classList.contains("is-boosted") ? "200%" : "100%";
    document.querySelector("#demo-status").textContent = enabled
      ? control.message
      : "Your preview, adjusted. Try another small fix.";
  });
}
document.querySelector("#reset-demo").addEventListener("click", () => {
  controls.forEach(({ id, className }) => {
    document.getElementById(id).setAttribute("aria-checked", "false");
    journal.classList.remove(className);
  });
  document.querySelector("#volume-output").textContent = "100%";
  document.querySelector("#demo-status").textContent =
    "A familiar page. A few possibilities.";
});
const wave = document.querySelector(".wave");
for (let i = 0; i < 28; i++) {
  const bar = document.createElement("i");
  bar.style.setProperty(
    "--bar-height",
    `${7 + Math.round((Math.sin(i * 1.7) + 1) * 9)}px`,
  );
  wave.append(bar);
}
document.querySelector("#copy-code").addEventListener("click", async () => {
  const text = document.querySelector("#install-code").textContent;
  const status = document.querySelector("#copy-status");
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "Commands copied.";
    document.querySelector("#copy-code").textContent = "Copied ✓";
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("#install-code"));
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent =
      "Commands selected. Press Command+C or Ctrl+C to copy.";
  }
});
