const DEFAULTS = { read: true, typing: true, stories: true };
const boxes = Object.keys(DEFAULTS).map((key) => document.getElementById(key));
const status = document.getElementById("status");

function render() {
  const on = boxes.filter((b) => b.checked).length;
  document.body.dataset.state = on === boxes.length ? "all" : on ? "some" : "none";
  status.textContent = on === boxes.length ? `ซ่อนครบทั้ง ${on} อย่าง` : on ? `ซ่อนอยู่ ${on} จาก ${boxes.length} อย่าง` : "ปิดการซ่อนทั้งหมด";
}

chrome.storage.local.get(DEFAULTS, (cfg) => {
  for (const box of boxes) {
    box.checked = cfg[box.id];
    box.onchange = () => {
      chrome.storage.local.set({ [box.id]: box.checked });
      render();
    };
  }
  render();
});
