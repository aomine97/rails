import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  manifest: {
    name: "Rails: autofill job applications",
    description: "Fill Workday, Greenhouse, Lever, iCIMS and company career sites from your Rails profile. You review, you click Submit.",
    version: "0.1.0",
    minimum_chrome_version: "116",
    permissions: ["sidePanel", "storage", "activeTab", "tabs", "scripting"],
    host_permissions: ["https://rails-psi.vercel.app/*"],
    optional_host_permissions: ["https://*/*"],
    action: { default_title: "Open Rails" },
    side_panel: { default_path: "sidepanel.html" },
    icons: { 16: "icons/16.png", 32: "icons/32.png", 48: "icons/48.png", 128: "icons/128.png" },
    web_accessible_resources: [{ resources: ["icons/*"], matches: ["<all_urls>"] }],
  },
});
