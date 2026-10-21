/* Firefox-only bridge: no script elements, eval, messages, or extension APIs. */
"use strict";

installDisposableStack(window.wrappedJSObject, function expose(fn) {
  // Firefox gives exported functions Xray-wrapped arguments/receivers. Waive
  // those wrappers consistently so WeakMap keys keep their identity and page
  // getters, symbol methods, subclasses, and proxies stay visible.
  const unwrap = XPCNativeWrapper.unwrap;
  const forwarded = exportFunction(function (...args) {
    return Reflect.apply(fn, unwrap(this), args.map((arg) => unwrap(arg)));
  }, window);
  Object.defineProperty(forwarded, "length", { value: fn.length, configurable: true });
  return forwarded;
});
