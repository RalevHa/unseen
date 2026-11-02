// chrome.storage is not reachable from the page world, so relay the settings to hook.js over a DOM event.
const DEFAULTS = { read: true, typing: true, stories: true };
const send = (cfg) => dispatchEvent(new CustomEvent("unseen-config", { detail: JSON.stringify(cfg) }));
chrome.storage.local.get(DEFAULTS, send);
chrome.storage.onChanged.addListener(() => chrome.storage.local.get(DEFAULTS, send));
// patch results from hook.js, shown in the popup
addEventListener("unseen-status", (e) => {
  try {
    chrome.storage.local.set({ status: JSON.parse(e.detail) });
  } catch (err) {}
});
