const DEFAULTS = { read: true, typing: true, stories: true };
// Facebook modules behind each switch (same names as the tables in hook.js)
const MODULES = {
  read: ["LSOptimisticMarkThreadReadV2", "LSOptimisticMarkThreadReadV2StoredProcedure", "useMAWMarkThreadAsRead"],
  typing: ["LSSendTypingIndicator", "MAWSecureTypingState"],
  stories: ["StoriesSuspenseBucketContainer.react"],
};
const boxes = Object.keys(DEFAULTS).map((key) => document.getElementById(key));
const status = document.getElementById("status");

function render() {
  const on = boxes.filter((b) => b.checked).length;
  document.body.dataset.state = on === boxes.length ? "all" : on ? "some" : "none";
  status.textContent = on === boxes.length ? `ซ่อนครบทั้ง ${on} อย่าง` : on ? `ซ่อนอยู่ ${on} จาก ${boxes.length} อย่าง` : "ปิดการซ่อนทั้งหมด";
}

// patch result per switch: any module failed -> ✗, some patched -> ✓, nothing loaded yet -> –
function renderPatch(res) {
  let broken = 0;
  for (const key in MODULES) {
    const failed = MODULES[key].filter((m) => res[m] === "fail" || res.__d === "fail");
    const ok = MODULES[key].some((m) => res[m] === "ok");
    const [cls, text, tip] = failed.length
      ? ["fail", "✗", "ใช้ไม่ได้: " + (res.__d === "fail" ? "hook __d ไม่ติด (รีโหลดแท็บ)" : failed.join(", "))]
      : ok
        ? ["ok", "✓", "patch ทำงานอยู่"]
        : ["", "–", "ยังไม่โหลดโมดูล (เปิดหน้าแชท/Story ก่อน)"];
    broken += failed.length ? 1 : 0;
    const el = document.getElementById("st-" + key);
    el.className = "st " + cls;
    el.textContent = text;
    el.title = tip;
  }
  if (broken) status.textContent += ` · ⚠ ใช้ไม่ได้ ${broken} อย่าง`;
}

chrome.storage.local.get({ ...DEFAULTS, status: {} }, (cfg) => {
  for (const box of boxes) {
    box.checked = cfg[box.id];
    box.onchange = () => {
      chrome.storage.local.set({ [box.id]: box.checked });
      render();
      renderPatch(cfg.status);
    };
  }
  render();
  renderPatch(cfg.status);
});
