/* Runs as an ordinary page script, not in the extension's isolated world. */
"use strict";

window.smokeResultsPromise = (async function () {
  const results = [];
  async function check(name, run) {
    try {
      if (!(await run())) throw new Error("Assertion returned false");
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error: String(error), stack: error.stack });
    }
  }

  await check("available to the first inline page script", () => window.earlyStackType === "function");
  await check("private installer and privileged APIs are not exposed", () =>
    typeof installDisposableStack === "undefined" && typeof exportFunction === "undefined");
  await check("constructors, subclasses, and page object identity", () => {
    class Sub extends DisposableStack {}
    const s = new Sub();
    return s instanceof Sub && s instanceof DisposableStack && s instanceof Object && !s.disposed &&
      DisposableStack instanceof Function && s.use instanceof Function;
  });
  await check("callbacks receive page resources and original values", () => {
    const calls = []; const s = new DisposableStack(); const resource = {};
    resource[Symbol.dispose] = function () { calls.push(this === resource ? "resource" : "bad"); };
    s.use(resource);
    s.adopt(resource, function (value) { calls.push(value === resource && this === undefined ? "adopt" : "bad"); });
    s.defer(function () { calls.push(this === undefined ? "defer" : "bad"); });
    s.dispose(); s.dispose(); return calls.join() === "defer,adopt,resource";
  });
  await check("nested stacks are themselves disposable", () => {
    let called = false; const outer = new DisposableStack();
    outer.use(new DisposableStack()).defer(() => { called = true; });
    outer.dispose(); return called;
  });
  await check("missing disposal methods produce a page TypeError", () => {
    try { new DisposableStack().use({}); return false; }
    catch (error) { return error instanceof TypeError; }
  });
  await check("page errors, SuppressedError, and continued cleanup", () => {
    const first = new Error("first"); const last = new Error("last"); const s = new DisposableStack();
    s.defer(() => { throw first; }); s.defer(() => { throw last; });
    try { s.dispose(); return false; }
    catch (error) {
      return error instanceof SuppressedError && error instanceof Error && error.error === first &&
        error.suppressed === last && Object.keys(error).length === 0 && s.disposed;
    }
  });
  await check("SuppressedError supports subclassing and callable construction", () => {
    class Sub extends SuppressedError {}
    const e = new Sub("one", "two", "message");
    return e instanceof Sub && e instanceof Error && e.message === "message" &&
      SuppressedError(1, 2).suppressed === 2;
  });
  await check("move transfers cleanup ownership", () => {
    let called = 0; const s = new DisposableStack(); s.defer(() => called++);
    const moved = s.move(); s.dispose(); moved.dispose();
    try { s.use(null); return false; } catch (error) { return error instanceof ReferenceError && called === 1; }
  });
  await check("async callbacks return page promises and clean up sequentially", async () => {
    const calls = []; const s = new AsyncDisposableStack();
    s.defer(async () => { await Promise.resolve(); calls.push("last"); });
    const resource = { async [Symbol.asyncDispose]() { calls.push(this === resource ? "start" : "bad"); await Promise.resolve(); calls.push("end"); } };
    s.use(resource);
    const p = s.disposeAsync();
    if (!(p instanceof Promise) || !s.disposed || calls.join() !== "start") return false;
    await p; return calls.join() === "start,end,last";
  });
  await check("async disposal supports sync fallback without awaiting its result", async () => {
    let done = false; const s = new AsyncDisposableStack();
    s.use({ [Symbol.dispose]() { done = true; return { get then() { throw new Error("not awaited"); } }; } });
    await s.disposeAsync(); return done;
  });
  await check("async rejection identity and error suppression", async () => {
    const one = new Error("one"), two = new Error("two"); const s = new AsyncDisposableStack();
    s.defer(() => Promise.reject(one)); s.defer(async () => { throw two; });
    try { await s.disposeAsync(); return false; }
    catch (e) { return e instanceof SuppressedError && e.error === one && e.suppressed === two; }
  });
  await check("invalid async receivers return a rejected page promise", async () => {
    const p = AsyncDisposableStack.prototype.disposeAsync.call({});
    if (!(p instanceof Promise)) return false;
    try { await p; return false; } catch (e) { return e instanceof TypeError; }
  });
  await check("generator cleanup runs finally", () => {
    let done = false;
    function* items() { try { yield 1; } finally { done = true; } }
    const resource = items(); resource.next(); const s = new DisposableStack(); s.use(resource); s.dispose(); return done;
  });
  await check("symbols are immutable and methods non-enumerable", () =>
    Object.keys(DisposableStack.prototype).length === 0 &&
    Object.getOwnPropertyDescriptor(Symbol, "dispose").writable === false &&
    DisposableStack.prototype[Symbol.dispose] === DisposableStack.prototype.dispose);
  return results;
})();
