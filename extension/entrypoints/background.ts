export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Drawer -> side panel (user gesture carries through the message).
    if (msg?.type === "rails:open" && sender.tab?.id != null) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ error: String(e) }));
      return true;
    }
    // Panel -> the page. The panel pins a run to the tab it started on, so switching tabs mid-fill does not redirect the messages.
    if (["rails:run", "rails:open-drawer", "rails:get-state", "rails:fill-one", "rails:scan", "rails:badge"].includes(msg?.type)) {
      const pick = typeof msg.tabId === "number" ? chrome.tabs.get(msg.tabId).then((t) => [t]).catch(() => []) : chrome.tabs.query({ active: true, currentWindow: true });
      pick.then(async ([tab]) => {
        if (!tab?.id || !tab.url) return sendResponse({ error: "no_tab" });
        const origin = new URL(tab.url).origin + "/*";
        try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["filler.js"] }); }
        catch { const has = await chrome.permissions.contains({ origins: [origin] }).catch(() => false); if (!has) return sendResponse({ error: "needs_permission", origin }); }
        try { sendResponse(await chrome.tabs.sendMessage(tab.id, msg)); } catch (e) { sendResponse({ error: String((e as Error).message) }); }
      });
      return true;
    }
    return false;
  });
});
