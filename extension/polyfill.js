/* Explicit resource management APIs. No dependencies or dynamic code evaluation. */
"use strict";

function installDisposableStack(realm, expose = (fn) => fn) {
  // Page objects and exported functions are necessary: content-script objects
  // cannot be read by Firefox page scripts. Private state stays in this closure.
  const create = realm.Object.create;
  const define = Object.defineProperty;
  const getPrototypeOf = Object.getPrototypeOf;
  const setPrototypeOf = Object.setPrototypeOf;
  const apply = Reflect.apply;
  const PagePromise = realm.Promise;
  const promiseResolve = PagePromise.resolve;
  const promiseThen = PagePromise.prototype.then;
  const TypeError = realm.TypeError;
  const ReferenceError = realm.ReferenceError;
  const Error = realm.Error;
  const Symbol = realm.Symbol;

  function data(object, key, value, writable = true, configurable = true) {
    define(object, key, { value, writable, configurable, enumerable: false });
  }

  function exported(fn, name) {
    const result = expose(fn);
    data(result, "name", name);
    return result;
  }

  function method(object, key, fn, name = key) {
    const result = exported(fn, name);
    data(object, key, result);
    return result;
  }

  function wellKnown(name) {
    if (Symbol[name] === undefined) {
      // Matches core-js and other common polyfills. Never replace an existing
      // symbol: resources and stacks must agree on the exact same property key.
      data(Symbol, name, Symbol.for("Symbol." + name), false, false);
    }
    return Symbol[name];
  }

  const disposeSymbol = wellKnown("dispose");
  const asyncDisposeSymbol = wellKnown("asyncDispose");

  function prototypeFor(newTarget, fallback) {
    const prototype = newTarget.prototype;
    return isObject(prototype) ? prototype : fallback;
  }

  function isObject(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
  }

  // An exported constructor alone loses new.target through Firefox's function
  // forwarder. A page-realm Proxy passes it explicitly to our construct trap,
  // preserving subclassing without eval or a CSP-sensitive script injection.
  function constructor(name, length, construct, call) {
    const handler = create(realm.Object.prototype);
    method(handler, "construct", (_target, args, newTarget) => construct(args, newTarget));
    method(handler, "apply", (_target, _this, args) => {
      if (call) return call(args);
      throw new TypeError(name + " requires 'new'");
    });
    const target = exported(function () {}, name);
    data(target, "length", length);
    return new realm.Proxy(target, handler);
  }

  let SuppressedError = realm.SuppressedError;
  if (SuppressedError === undefined) {
    const prototype = create(Error.prototype);
    function makeError(args, newTarget) {
      // Construct Error for its native ErrorData and stack trace. Error's own
      // conversion of message also correctly rejects a Symbol message.
      const result = args[2] === undefined ? new Error() : new Error(args[2]);
      setPrototypeOf(result, prototypeFor(newTarget, prototype));
      data(result, "error", args[0]);
      data(result, "suppressed", args[1]);
      return result;
    }
    SuppressedError = constructor("SuppressedError", 3, makeError, (args) => makeError(args, SuppressedError));
    data(SuppressedError, "prototype", prototype, false, false);
    setPrototypeOf(SuppressedError, Error);
    data(prototype, "constructor", SuppressedError);
    data(prototype, "name", "SuppressedError");
    data(prototype, "message", "");
    data(realm, "SuppressedError", SuppressedError);
  }

  function getMethod(value, symbol) {
    const fn = value[symbol];
    if (fn === undefined || fn === null) return undefined;
    if (typeof fn !== "function") throw new TypeError("Disposal method is not callable");
    return fn;
  }

  function recordFor(value, async) {
    if (value === null || value === undefined) return { method: undefined };
    if (!isObject(value)) throw new TypeError("A disposable resource must be an object");
    let fn;
    let syncFallback = false;
    if (async) {
      fn = getMethod(value, asyncDisposeSymbol);
      if (fn === undefined) {
        fn = getMethod(value, disposeSymbol);
        syncFallback = true;
      }
    } else {
      fn = getMethod(value, disposeSymbol);
    }
    if (fn === undefined) throw new TypeError("Object is not disposable");
    return { value, method: fn, args: [], syncFallback };
  }

  function makeStack(async) {
    const name = async ? "AsyncDisposableStack" : "DisposableStack";
    const slots = new WeakMap();
    const prototype = create(realm.Object.prototype);
    const Stack = constructor(name, 0, (_args, newTarget) => {
      const instance = create(prototypeFor(newTarget, prototype));
      slots.set(instance, { disposed: false, records: [] });
      return instance;
    });
    data(Stack, "prototype", prototype, false, false);
    data(prototype, "constructor", Stack);
    data(prototype, Symbol.toStringTag, name, false);

    function stateOf(instance, pending = false) {
      const state = slots.get(instance);
      if (!state) throw new TypeError("Incompatible " + name + " receiver");
      if (pending && state.disposed) throw new ReferenceError(name + " is already disposed");
      return state;
    }

    define(prototype, "disposed", {
      get: exported(function () { return stateOf(this).disposed; }, "get disposed"),
      configurable: true,
      enumerable: false
    });

    method(prototype, "use", function use(value) {
      const state = stateOf(this, true);
      const record = recordFor(value, async);
      if (async || record.method !== undefined) state.records.push(record);
      return value;
    });

    method(prototype, "adopt", function adopt(value, onDispose) {
      const state = stateOf(this, true);
      if (typeof onDispose !== "function") throw new TypeError("onDispose must be callable");
      state.records.push({ value: undefined, method: onDispose, args: [value] });
      return value;
    });

    method(prototype, "defer", function defer(onDispose) {
      const state = stateOf(this, true);
      if (typeof onDispose !== "function") throw new TypeError("onDispose must be callable");
      state.records.push({ value: undefined, method: onDispose, args: [] });
    });

    method(prototype, "move", function move() {
      const state = stateOf(this, true);
      const instance = new Stack();
      slots.get(instance).records = state.records;
      state.records = [];
      state.disposed = true;
      return instance;
    });

    if (!async) {
      const dispose = method(prototype, "dispose", function dispose() {
        const state = stateOf(this);
        if (state.disposed) return;
        state.disposed = true;
        const records = state.records;
        state.records = [];
        let failed = false;
        let error;
        while (records.length) {
          const record = records.pop();
          try {
            apply(record.method, record.value, record.args);
          } catch (nextError) {
            error = failed ? new SuppressedError(nextError, error) : nextError;
            failed = true;
          }
        }
        if (failed) throw error;
      });
      data(prototype, disposeSymbol, dispose);
    } else {
      const disposeAsync = method(prototype, "disposeAsync", function disposeAsync() {
        const instance = this;
        return new PagePromise(expose((resolve, reject) => {
          let state;
          try {
            state = stateOf(instance);
          } catch (error) {
            reject(error);
            return;
          }
          if (state.disposed) { resolve(undefined); return; }
          state.disposed = true;
          const records = state.records;
          state.records = [];
          let failed = false;
          let error;
          let needsAwait = false;
          let hasAwaited = false;

          function remember(nextError) {
            error = failed ? new SuppressedError(nextError, error) : nextError;
            failed = true;
          }

          function awaitResult(value, fulfilled, rejected) {
            const promise = apply(promiseResolve, PagePromise, [value]);
            apply(promiseThen, promise, [expose(fulfilled), expose(rejected)]);
          }

          function finish() {
            if (failed) reject(error);
            else resolve(undefined);
          }

          function next() {
            while (records.length) {
              const record = records.pop();
              if (record.method === undefined) { needsAwait = true; continue; }
              let result;
              try {
                result = apply(record.method, record.value, record.args);
                // Sync fallback ignores returned promises/thenables. It still
                // awaits a promise of undefined, including on a sync throw.
                if (record.syncFallback) result = undefined;
              } catch (nextError) {
                if (!record.syncFallback) { remember(nextError); continue; }
                result = new PagePromise(expose((_resolve, reject) => reject(nextError)));
              }
              hasAwaited = true;
              awaitResult(result, next, (nextError) => { remember(nextError); next(); });
              return;
            }
            if (needsAwait && !hasAwaited) awaitResult(undefined, finish, reject);
            else finish();
          }
          next();
        }));
      });
      data(prototype, asyncDisposeSymbol, disposeAsync);
    }
    data(realm, name, Stack);
  }

  if (realm.DisposableStack === undefined) makeStack(false);
  if (realm.AsyncDisposableStack === undefined) makeStack(true);

  // Modern resource management also makes built-in iterators disposable. This
  // calls return(), if present; it does not make arbitrary objects disposable.
  const iteratorPrototype = getPrototypeOf(getPrototypeOf(new realm.Array()[Symbol.iterator]()));
  if (iteratorPrototype[disposeSymbol] === undefined) {
    method(iteratorPrototype, disposeSymbol, function () {
      const close = getMethod(this, "return");
      if (close !== undefined) apply(close, this, []);
    }, "[Symbol.dispose]");
  }

}
