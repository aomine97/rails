export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  // Relay: side panel asks the active tab's content script to fill; the panel can't message tabs it has no permission for until the user grants it.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "rails:fill" || msg?.type === "rails:scan") {
      chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
        if (!tab?.id || !tab.url) return sendResponse({ error: "no_tab" });
        const origin = new URL(tab.url).origin + "/*";
        const has = await chrome.permissions.contains({ origins: [origin] });
        if (!has) return sendResponse({ error: "needs_permission", origin });
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["filler.js"] }).catch(() => {});
          const res = await chrome.tabs.sendMessage(tab.id, msg);
          sendResponse(res);
        } catch (e) { sendResponse({ error: String((e as Error).message) }); }
      });
      return true;
    }
    return false;
  });
});
