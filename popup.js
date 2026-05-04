document.addEventListener('DOMContentLoaded', () => {
  const fontSelect = document.getElementById('font-select');
  const spacingToggle = document.getElementById('spacing-toggle');
  const sidebarToggle = document.getElementById('sidebar-toggle');

  // Load saved settings (or fallback to defaults)
  chrome.storage.local.get({ font: 'cascadia', spacing: true, sidebar: true }, (result) => {
    fontSelect.value = result.font;
    spacingToggle.checked = result.spacing;
    sidebarToggle.checked = result.sidebar;
  });

  // Save changes and reload the tab if it's Wikipedia
  const saveSettings = () => {
    const settings = {
      font: fontSelect.value,
      spacing: spacingToggle.checked,
      sidebar: sidebarToggle.checked
    };
    
    chrome.storage.local.set(settings, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url;
        if (url && url.includes('wikipedia.org')) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    });
  };

  fontSelect.addEventListener('change', saveSettings);
  spacingToggle.addEventListener('change', saveSettings);
  sidebarToggle.addEventListener('change', saveSettings);
});