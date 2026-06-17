document.getElementById('capture').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, dataUrl => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'siteshot-visible-tab.png';
    a.click();
  });
});
