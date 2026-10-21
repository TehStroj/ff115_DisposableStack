"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../extension/polyfill.js"), "utf8");

function fresh() {
  const context = vm.createContext({});
  // Supply a Symbol constructor with missing disposal symbols, even on Node
  // versions with native support. Keep the remaining well-known symbols.
  vm.runInContext(`
    const OriginalSymbol = Symbol;
    globalThis.Symbol = function Symbol(description) { return OriginalSymbol(description); };
    for (const key of Reflect.ownKeys(OriginalSymbol)) {
      if (!["dispose", "asyncDispose", "prototype", "name", "length"].includes(key)) {
        Object.defineProperty(Symbol, key, Object.getOwnPropertyDescriptor(OriginalSymbol, key));
      }
    }
    delete globalThis.DisposableStack;
    delete globalThis.AsyncDisposableStack;
    delete globalThis.SuppressedError;
  `, context);
  const realm = vm.runInContext("globalThis", context);
  const install = vm.runInNewContext(source + "\ninstallDisposableStack;");
  install(realm);
  return { realm, install, run: (code) => vm.runInContext(code, context) };
}

test("installs shared symbols, page-realm objects, and non-enumerable APIs", () => {
  const { run } = fresh();
  assert.equal(run(`Symbol.dispose === Symbol.for("Symbol.dispose")`), true);
  assert.equal(run(`Symbol.asyncDispose === Symbol.for("Symbol.asyncDispose")`), true);
  assert.equal(run(`new DisposableStack() instanceof Object`), true);
  assert.equal(run(`Object.keys(DisposableStack.prototype).length`), 0);
  assert.equal(run(`Object.prototype.toString.call(new DisposableStack())`), "[object DisposableStack]");
  assert.equal(run(`Object.prototype.toString.call(new AsyncDisposableStack())`), "[object AsyncDisposableStack]");
  assert.equal(run(`DisposableStack.prototype[Symbol.dispose] === DisposableStack.prototype.dispose`), true);
  assert.equal(run(`AsyncDisposableStack.prototype[Symbol.asyncDispose] === AsyncDisposableStack.prototype.disposeAsync`), true);
  assert.equal(run(`Object.getOwnPropertyDescriptor(Symbol, "dispose").writable`), false);
  assert.equal(run(`Object.getOwnPropertyDescriptor(DisposableStack, "prototype").writable`), false);
});

test("constructors require new, support subclasses, and reject forged receivers", () => {
  const { run } = fresh();
  assert.equal(run(`(() => { try { DisposableStack(); } catch (e) { return e instanceof TypeError; } })()`), true);
  assert.equal(run(`(() => { try { AsyncDisposableStack(); } catch (e) { return e instanceof TypeError; } })()`), true);
  assert.equal(run(`(() => { class Sub extends DisposableStack {}; const s = new Sub(); return s instanceof Sub && s instanceof DisposableStack && !s.disposed; })()`), true);
  assert.equal(run(`(() => { class Sub extends AsyncDisposableStack {}; const s = new Sub(); return s instanceof Sub && !s.disposed; })()`), true);
  assert.equal(run(`(() => { try { DisposableStack.prototype.dispose.call(Object.create(DisposableStack.prototype)); } catch (e) { return e instanceof TypeError; } })()`), true);
  assert.equal(run(`(() => { try { new DisposableStack.prototype.use(); } catch (e) { return e instanceof TypeError; } })()`), true);
});

test("sync use/adopt/defer dispose in reverse order with correct receivers and arguments", () => {
  const { run } = fresh();
  assert.equal(run(`(() => {
    const calls = []; const s = new DisposableStack();
    const resource = { [Symbol.dispose]() { calls.push(this === resource ? "resource" : "bad"); } };
    if (s.use(resource) !== resource || s.use(null) !== null || s.use(undefined) !== undefined) return false;
    if (s.adopt(42, function (v) { "use strict"; calls.push(this === undefined && arguments.length === 1 ? v : "bad"); }) !== 42) return false;
    if (s.defer(function () { "use strict"; calls.push(this === undefined && arguments.length === 0 ? "defer" : "bad"); }) !== undefined) return false;
    s.dispose(); s.dispose();
    return JSON.stringify(calls) === '["defer",42,"resource"]' && s.disposed;
  })()`), true);
});

test("captures the disposal method at registration and accepts function resources", () => {
  const { run } = fresh();
  assert.equal(run(`(() => {
    let calls = 0, gets = 0; const s = new DisposableStack();
    const r = { get [Symbol.dispose]() { gets++; return function () { calls++; }; } };
    s.use(r); Object.defineProperty(r, Symbol.dispose, { value() { calls += 100; } });
    function f() {}; f[Symbol.dispose] = () => calls++;
    s.use(f); s.dispose(); return gets === 1 && calls === 2;
  })()`), true);
});

test("rejects non-disposable objects instead of silently skipping required cleanup", () => {
  const { run } = fresh();
  assert.equal(run(`(() => {
    const s = new DisposableStack();
    const values = [{}, { dispose() {} }, { [Symbol.dispose]: 1 }, { [Symbol.dispose]: null }, 0, "x", false, Symbol()];
    return values.every(v => { try { s.use(v); return false; } catch (e) { return e instanceof TypeError; } });
  })()`), true);
  assert.equal(run(`(() => {
    const s = new DisposableStack(); s.dispose();
    return [() => s.use(null), () => s.defer(null), () => s.adopt(1, null), () => s.move()].every(fn => {
      try { fn(); return false; } catch (e) { return e instanceof ReferenceError; }
    });
  })()`), true);
});

test("move transfers ownership once and creates a base stack even for subclasses", () => {
  const { run } = fresh();
  assert.equal(run(`(() => {
    class Sub extends DisposableStack {};
    let calls = 0; const s = new Sub(); s.defer(() => calls++);
    const moved = s.move(); s.dispose();
    if (calls || !s.disposed || moved.disposed || moved instanceof Sub) return false;
    moved.dispose(); moved.dispose(); return calls === 1;
  })()`), true);
});

test("disposal is reentrant and continues cleanup after thrown undefined or other failures", () => {
  const { run } = fresh();
  assert.equal(run(`(() => {
    const s = new DisposableStack(); const a = new Error("a"); const b = new Error("b"); let calls = 0;
    s.defer(() => { calls++; throw a; }); s.defer(() => { calls++; throw b; });
    s.defer(() => { s.dispose(); throw undefined; });
    try { s.dispose(); return false; } catch (e) {
      return calls === 2 && s.disposed && e instanceof SuppressedError && e.error === a &&
        e.suppressed instanceof SuppressedError && e.suppressed.error === b && e.suppressed.suppressed === undefined;
    }
  })()`), true);
  assert.equal(run(`(() => { const s = new DisposableStack(); s.defer(() => { throw undefined; }); try { s.dispose(); return false; } catch (e) { return e === undefined; } })()`), true);
});

test("SuppressedError supports calls, inheritance, native error identity, and message conversion", () => {
  const { run } = fresh();
  assert.equal(run(`(() => {
    const a = {}; const b = {}; const e = SuppressedError(a, b, "message");
    class Sub extends SuppressedError {}; const sub = new Sub(a, b, "sub");
    return e instanceof Error && e instanceof SuppressedError && e.error === a && e.suppressed === b &&
      e.message === "message" && e.name === "SuppressedError" && Object.keys(e).length === 0 &&
      Object.prototype.toString.call(e) === "[object Error]" && sub instanceof Sub && sub instanceof Error &&
      Object.getPrototypeOf(SuppressedError) === Error && !Object.hasOwn(new SuppressedError(a, b), "message");
  })()`), true);
  assert.equal(run(`(() => { try { new SuppressedError(1, 2, Symbol()); return false; } catch(e) { return e instanceof TypeError; } })()`), true);
});

test("async disposal returns a page Promise, starts immediately, and awaits sequentially", async () => {
  const { run } = fresh();
  assert.equal(await run(`(async () => {
    const calls = []; const s = new AsyncDisposableStack();
    s.adopt(1, async (v) => { await Promise.resolve(); calls.push(v); });
    const r = { async [Symbol.asyncDispose]() { calls.push(this === r ? "start" : "bad"); await Promise.resolve(); calls.push("end"); } };
    s.use(r); const p = s.disposeAsync();
    if (!(p instanceof Promise) || !s.disposed || calls.join() !== "start") return false;
    await p; await s.disposeAsync(); return calls.join() === "start,end,1";
  })()`), true);
});

test("async use prioritizes async disposal and ignores a sync fallback's returned thenable", async () => {
  const { run } = fresh();
  assert.equal(await run(`(async () => {
    const calls = []; const s = new AsyncDisposableStack();
    s.use({ [Symbol.asyncDispose]() { calls.push("async"); }, [Symbol.dispose]() { calls.push("bad"); } });
    s.use({ [Symbol.asyncDispose]: null, [Symbol.dispose]() { calls.push("sync"); return { get then() { throw new Error("must not inspect then"); } }; } });
    s.use(null); s.use(undefined); await s.disposeAsync(); return calls.join() === "sync,async";
  })()`), true);
});

test("async cleanup aggregates rejections and synchronous throws while continuing", async () => {
  const { run } = fresh();
  assert.equal(await run(`(async () => {
    const s = new AsyncDisposableStack(); const a = new Error("a"), b = new Error("b");
    s.defer(() => Promise.reject(a)); s.use({ [Symbol.dispose]() { throw b; } });
    s.defer(() => { throw undefined; });
    try { await s.disposeAsync(); return false; } catch (e) {
      return e instanceof SuppressedError && e.error === a && e.suppressed.error === b && e.suppressed.suppressed === undefined;
    }
  })()`), true);
});

test("disposeAsync rejects invalid receivers rather than throwing synchronously", async () => {
  const { run } = fresh();
  assert.equal(await run(`(async () => {
    let p; try { p = AsyncDisposableStack.prototype.disposeAsync.call({}); } catch (_) { return false; }
    if (!(p instanceof Promise)) return false;
    try { await p; return false; } catch (e) { return e instanceof TypeError; }
  })()`), true);
});

test("async move transfers ownership and rejects additions after disposal", async () => {
  const { run } = fresh();
  assert.equal(await run(`(async () => {
    let calls = 0; const s = new AsyncDisposableStack(); s.defer(() => calls++);
    const moved = s.move(); await s.disposeAsync();
    if (calls || !s.disposed || moved.disposed) return false;
    try { s.use(null); return false; } catch (e) { if (!(e instanceof ReferenceError)) return false; }
    await moved.disposeAsync(); return calls === 1;
  })()`), true);
});

test("reinstallation preserves existing symbols, constructors, and iterator hooks", () => {
  const { realm, install, run } = fresh();
  const before = [realm.DisposableStack, realm.AsyncDisposableStack, realm.SuppressedError, realm.Symbol.dispose];
  install(realm);
  assert.deepEqual([realm.DisposableStack, realm.AsyncDisposableStack, realm.SuppressedError, realm.Symbol.dispose], before);
  assert.equal(run(`(() => { let done = false; function* values() { try { yield 1; } finally { done = true; } }; const it = values(); it.next(); const s = new DisposableStack(); s.use(it); s.dispose(); return done; })()`), true);
});

test("leaves independently supplied implementations intact", () => {
  const context = vm.createContext({});
  vm.runInContext(`globalThis.DisposableStack = function Existing() {}; globalThis.AsyncDisposableStack = function ExistingAsync() {}; globalThis.SuppressedError = function ExistingError() {};`, context);
  const realm = vm.runInContext("globalThis", context);
  const existing = [realm.DisposableStack, realm.AsyncDisposableStack, realm.SuppressedError];
  vm.runInNewContext(source + "\ninstallDisposableStack;")(realm);
  assert.deepEqual([realm.DisposableStack, realm.AsyncDisposableStack, realm.SuppressedError], existing);
});
