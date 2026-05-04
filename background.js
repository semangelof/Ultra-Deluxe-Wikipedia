chrome.runtime.onInstalled.addListener(() => {
  // Set defaults: Cascadia Mono selected, spacing enabled, sidebar enabled.
  chrome.storage.local.get(['font', 'spacing', 'sidebar'], (result) => {
    const defaults = {};
    if (result.font === undefined) defaults.font = 'cascadia';
    if (result.spacing === undefined) defaults.spacing = true;
    if (result.sidebar === undefined) defaults.sidebar = true;
    chrome.storage.local.set(defaults);
  });
});