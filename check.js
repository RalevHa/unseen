// Run: node check.js  -- fake Facebook module loader, asserts each patch takes effect.
const assert = require("assert");
globalThis.window = globalThis;
const handlers = [];
globalThis.addEventListener = (type, fn) => handlers.push(fn);
const setCfg = (c) => handlers.forEach((f) => f({ detail: JSON.stringify(c) }));
require("./hook.js");

const modules = {};
// fake FB loader: __d(name, deps, factory) -> runs factory(g, req, rd, rl, module, exports)
window.__d = (name, deps, factory) => {
  const module = { exports: {} };
  factory({}, null, null, null, module, module.exports);
  modules[name] = module.exports;
};

const calls = [];
const sproc = (name) => { const f = (...a) => calls.push([name, a]); f.__sproc_name__ = name; return f; };
__d("LSOptimisticMarkThreadReadV2", [], (g, r, d, l, m) => { m.exports = sproc("read"); });
__d("useMAWMarkThreadAsRead", [], (g, r, d, l, m) => { m.exports = { default: () => () => calls.push(["maw-read"]) }; });
__d("LSOptimisticMarkThreadReadV2StoredProcedure", [], (g, r, d, l, m) => { m.exports = { default: sproc("read-sp") }; });
__d("LSSendTypingIndicator", [], (g, r, d, l, m) => { m.exports = sproc("typing"); });
__d("MAWSecureTypingState", [], function (g, r, d, l, m) { m.exports = { send: "sendChatStateFromComposer" }; });
__d("StoriesSuspenseBucketContainer.react", [], function (g, r, d, l, m) { m.exports = { src: (function () { return { a: 1,onCardSeen:x,b: 2 }; }).toString() }; });

let resolved = null;
modules.LSOptimisticMarkThreadReadV2(1, 2, { resolve: (v) => (resolved = v) });
assert.deepStrictEqual(resolved, [], "read: promise resolved, original not called");
assert.strictEqual(modules.LSOptimisticMarkThreadReadV2.__sproc_name__, "read", "static props kept");
modules.useMAWMarkThreadAsRead.default()();
let resolved2 = null;
modules.LSOptimisticMarkThreadReadV2StoredProcedure.default(1, { resolve: (v) => (resolved2 = v) });
assert.deepStrictEqual(resolved2, [], "sproc (default-export shape): original not called");
modules.LSSendTypingIndicator("t", "id", true);
assert.strictEqual(calls.length, 1, "only typing reached the original");
assert.strictEqual(calls[0][1][2], false, "typing forced to false");
assert.strictEqual(modules.MAWSecureTypingState.send, "none", "E2EE typing source rewritten");
assert.ok(modules["StoriesSuspenseBucketContainer.react"].src.includes("onCardSeen:(window.__unseenCfg.stories?()=>{}:x),"), "story seen callback replaced");
assert.ok(modules["StoriesSuspenseBucketContainer.react"].src.includes("__unseenCfg.stories"), "story patch honors the switch");
// switches off -> originals run again
calls.length = 0;
setCfg({ read: false, typing: false });
modules.LSOptimisticMarkThreadReadV2(1, 2, { resolve: () => {} });
modules.LSSendTypingIndicator("t", "id", true);
assert.strictEqual(calls.length, 2, "read + typing reached the originals when switched off");
assert.strictEqual(calls[1][1][2], true, "typing value untouched when switched off");
const cb = modules.useMAWMarkThreadAsRead.default();
assert.ok(typeof cb === "function");
setCfg({ read: true, typing: true });
console.log("ok");
