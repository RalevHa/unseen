// Hides "Seen", "Typing..." and story views on Facebook / Messenger.
// Runs in the page's own JS world at document_start and wraps Facebook's module
// loader (__d), so a few internal modules are replaced as they are defined.
// ponytail: always on, no UI/toggles. These are Facebook-internal names: if a patch
// stops working, the console shows "[unseen] no match <name>"; update the tables below.
(() => {
  // also kept in window.__unseenLog so the result is readable after the page has loaded
  const history = (window.__unseenLog = []);
  const log = (...a) => {
    history.push(a.map(String).join(" "));
    console.debug("[unseen]", ...a);
  };

  // per-module result ("ok" | "fail"), relayed to the popup by bridge.js so a silent miss is visible
  const status = (window.__unseenStatus = {});
  const report = (name, ok) => {
    status[name] = ok ? "ok" : "fail";
    try {
      dispatchEvent(new CustomEvent("unseen-status", { detail: JSON.stringify(status) }));
    } catch (e) {}
  };

  // switches from the popup (relayed by bridge.js); everything on until the first message arrives
  const cfg = (window.__unseenCfg = { read: true, typing: true, stories: true });
  window.addEventListener("unseen-config", (e) => {
    try {
      Object.assign(cfg, JSON.parse(e.detail));
    } catch (err) {}
  });

  // --- patches that run after the module factory has filled module.exports ---
  const STATIC_SKIP = ["length", "name", "prototype", "arguments", "caller"];
  // The function can sit in different places depending on the module: module.exports = fn,
  // module.exports.default = fn, or on the exports object passed as a later factory argument.
  function findHolder(args) {
    const mod = args[4];
    const candidates = [];
    if (mod) {
      candidates.push([mod, "exports"]);
      if (mod.exports) candidates.push([mod.exports, "default"]);
    }
    for (const i of [5, 6]) if (args[i] && typeof args[i] === "object") candidates.push([args[i], "default"]);
    return candidates.find(([holder, key]) => holder && typeof holder[key] === "function");
  }

  const describe = (args) => args.slice(0, 8).map((a) => typeof a + ":" + Object.keys(a || {}).slice(0, 4).join("/")).join(" | ");

  function wrapExports(args, fn) {
    const found = findHolder(args);
    if (!found) throw new Error("no function export; args " + describe(args));
    const [holder, key] = found;
    const orig = holder[key];
    const wrapper = function (...callArgs) {
      return fn.call(this, orig, callArgs);
    };
    // keep static props the caller may read (__sproc_name__, __tables__, displayName)
    for (const k of Object.getOwnPropertyNames(orig)) {
      if (!STATIC_SKIP.includes(k)) Object.defineProperty(wrapper, k, Object.getOwnPropertyDescriptor(orig, k));
    }
    holder[key] = wrapper;
    // require() hands out defaultExport when present; keep it in step
    const mod = args[4];
    if (mod && mod.defaultExport === orig) mod.defaultExport = wrapper;
  }

  // stored-procedure style call: last arg is a promise holder; resolve it and skip the real work
  const skipSproc = function (orig, args) {
    if (!cfg.read) return orig.apply(this, args);
    const holder = args[args.length - 1];
    return holder && holder.resolve ? holder.resolve([]) : undefined;
  };

  const AFTER = {
    // Messenger "mark thread as read" (normal chats)
    LSOptimisticMarkThreadReadV2: (a) => wrapExports(a, skipSproc),
    LSOptimisticMarkThreadReadV2StoredProcedure: (a) => wrapExports(a, skipSproc),
    // end-to-end encrypted chats: the hook returns a callback; hand back a no-op one
    useMAWMarkThreadAsRead: (a) =>
      wrapExports(a, function (orig, args) {
        const markRead = orig.apply(this, args); // always run the real hook so React's hook order stays stable
        return cfg.read ? () => {} : markRead;
      }),
    // typing indicator: third argument is "is typing"; force it to false
    LSSendTypingIndicator: (a) =>
      wrapExports(a, function (orig, args) {
        if (cfg.typing) args[2] = false;
        return orig.apply(this, args);
      }),
  };

  // --- patches that rewrite a module's source before it is defined ---
  const SOURCE = {
    // typing indicator in encrypted chats (always on: the rewritten source is fixed once defined)
    MAWSecureTypingState: (s) => s.replaceAll("sendChatStateFromComposer", "none"),
    // story "seen" callback, checked at render time so the popup switch applies live
    "StoriesSuspenseBucketContainer.react": (s) =>
      s.replace(/,onCardSeen:(\w+),/g, ",onCardSeen:(window.__unseenCfg.stories?()=>{}:$1),"),
  };

  function rebuild(name, factory) {
    const before = String(factory);
    const after = SOURCE[name](before);
    if (after === before) {
      log("no match", name);
      report(name, false);
      return factory;
    }
    log("source patched", name);
    report(name, true);
    // factories only use their params and globals, so rebuilding in global scope is safe
    return compile(after);
  }

  // Facebook's CSP forbids eval/new Function but allows inline scripts that carry its nonce.
  let seq = 0;
  function compile(expr) {
    if (typeof document === "undefined") return new Function("return (" + expr + ")")(); // node self-check
    const nonce = (document.querySelector("script[nonce]") || {}).nonce;
    if (!nonce) throw new Error("no script nonce on page");
    const key = "__unseenFn" + seq++;
    const el = document.createElement("script");
    el.nonce = nonce;
    el.textContent = "window." + key + "=(" + expr + ")";
    (document.head || document.documentElement).appendChild(el);
    el.remove();
    const fn = window[key];
    delete window[key];
    if (typeof fn !== "function") throw new Error("nonce script did not run");
    return fn;
  }

  function wrapDefine(define) {
    return new Proxy(define, {
      apply(target, self, args) {
        const name = args[0];
        if (typeof name === "string" && typeof args[2] === "function") {
          try {
            if (SOURCE[name]) args[2] = rebuild(name, args[2]);
            if (AFTER[name]) {
              const factory = args[2];
              args[2] = new Proxy(factory, {
                apply(t, s, a) {
                  const result = Reflect.apply(t, s, a);
                  try {
                    AFTER[name](a);
                    log("patched", name);
                    report(name, true);
                  } catch (e) {
                    log("no match", name, e.message);
                    report(name, false);
                  }
                  return result;
                },
              });
            }
          } catch (e) {
            log("failed", name, e);
            report(name, false);
          }
        }
        return Reflect.apply(target, self, args);
      },
    });
  }

  // Facebook assigns window.__d itself; intercept the assignment
  // ponytail: if __d is already locked (non-configurable) or this script ran twice, we can't
  // intercept; log it and bail instead of throwing. Reload the tab to retry.
  let current = window.__d;
  if (current && current.__unseenWrapped) return log("skip: __d already hooked");
  try {
    Object.defineProperty(window, "__d", {
      configurable: true,
      get: () => current,
      set: (v) => {
        current = typeof v === "function" ? wrapDefine(v) : v;
        if (typeof current === "function") current.__unseenWrapped = true;
      },
    });
  } catch (e) {
    report("__d", false);
    return log("failed: cannot hook __d (locked):", e.message);
  }
  if (typeof current === "function") current = wrapDefine(current);
})();
