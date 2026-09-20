// Runs only on the Rails connect page: reads the freshly minted token into extension storage.
export default defineContentScript({
  matches: ["https://rails-psi.vercel.app/ext/connect*", "http://localhost:3000/ext/connect*"],
  main() {
    const t = document.querySelector('meta[name="rails-ext-token"]')?.getAttribute("content");
    if (t && /^[a-f0-9]{48}$/.test(t)) chrome.storage.local.set({ rails_token: t, rails_connected_at: Date.now() });
  },
});
