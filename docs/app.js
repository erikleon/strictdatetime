const copyButton = document.querySelector("[data-copy]");

copyButton?.addEventListener("click", async () => {
  const command = copyButton.getAttribute("data-copy");
  if (!command) return;

  try {
    await navigator.clipboard.writeText(command);
    copyButton.textContent = "Copied";
    window.setTimeout(() => {
      copyButton.textContent = "Copy";
    }, 1600);
  } catch {
    copyButton.textContent = "Select command";
  }
});
