// Minimal background worker — currently just a passthrough placeholder.
// Kept so future features (badge updates, alarms) have a place to live.
chrome.runtime.onInstalled.addListener(() => {
  console.log('Gemma Copilot installed.');
});
