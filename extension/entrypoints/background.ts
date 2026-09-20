export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  // Relay: side panel asks the active tab's content script to fill; the panel can't message tabs it has no permission for until the user grants it.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // On-page badge click: open the panel for that tab (user gesture carries through the message).
    if (msg?.type === "rails:open" && sender.tab?.id != null) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ error: String(e) }));
      return true;
    }
    // Panel -> badge on the active tab: show the fit number.
    if (msg?.type === "rails:badge") {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => { if (tab?.id) chrome.tabs.sendMessage(tab.id, msg).catch(() => {}); sendResponse({ ok: true }); });
      return true;
    }
    if (msg?.type === "rails:fill" || msg?.type === "rails:scan") {
      chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
        if (!tab?.id || !tab.url) return sendResponse({ error: "no_tab" });
        const origin = new URL(tab.url).origin + "/*";
        try {
          // Known ATS hosts are covered by the badge content script's matches; other sites need the optional grant.
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["filler.js"] });
        } catch {
          const has = await chrome.permissions.contains({ origins: [origin] }).catch(() => false);
          if (!has) return sendResponse({ error: "needs_permission", origin });
        }
        try {
          const res = await chrome.tabs.sendMessage(tab.id, msg);
          sendResponse(res);
        } catch (e) { sendResponse({ error: String((e as Error).message) }); }
      });
      return true;
    }
    return false;
  });
});
