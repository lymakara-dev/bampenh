// Minimal service worker. The extension does its work on demand from the
// popup, so there's nothing to keep alive here — this just exists so the
// action icon has a stable owner and to leave room for future features
// (context menus, keyboard shortcuts, etc.).
chrome.runtime.onInstalled.addListener(() => {
  // no-op
});
