// Bundled into the page under test: the chrome-free DOM layer of the extension.
import * as fill from "../lib/fill";
import * as scan from "../lib/scan";
import * as listbox from "../lib/listbox";
import * as workday from "../lib/workday";
(window as unknown as { Rails: unknown }).Rails = { ...fill, ...scan, ...listbox, ...workday };
