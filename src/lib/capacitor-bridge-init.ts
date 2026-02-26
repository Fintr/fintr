/**
 * Manual Capacitor bridge initializer for Android in remote-server-URL mode.
 *
 * When `server.url` points to https://www.fintr.ai, Capacitor's
 * WebViewLocalServer intercepts the initial HTML request and injects the
 * native bridge script (native-bridge.js + plugin JS) that sets up
 * `window.Capacitor.PluginHeaders`, `cap.nativeCallback`, etc.
 *
 * However this injection can silently fail when:
 *   1. The server URL lacks a path component (e.g. "https://www.fintr.ai?cv=…")
 *      so UriMatcher finds no handler and returns null.
 *   2. The upstream CDN uses Brotli encoding and Java's HttpURLConnection
 *      cannot decompress it, producing garbled HTML where <head> is not found.
 *
 * When injection fails, `window.Capacitor.PluginHeaders` is never set.
 * Every call to `registerPlugin(name, {web})` (executed when the plugin module
 * is first imported) captures `pluginHeader = undefined` and permanently uses
 * the web shim.  For @capacitor/browser the web shim calls window.open()
 * which is a no-op in an Android WebView → auth button hangs forever.
 *
 * This module detects the gap and fills it synchronously:
 *   - sets up cap.nativeCallback / cap.nativePromise (backed by androidBridge)
 *   - sets cap.fromNative so the native layer can deliver responses back to JS
 *     (Android native bridge uses evaluateJavascript("window.Capacitor.fromNative(…)")
 *      — without this function, ALL native responses are silently dropped and
 *      every nativePromise hangs forever)
 *   - sets cap.PluginHeaders for Browser & App so registerPlugin uses native
 *   - sets window.androidBridge.onmessage as secondary delivery path
 *
 * MUST be called (awaited) before the first dynamic import of
 * @capacitor/browser or @capacitor/app.
 */

let bridgeInitialized = false;

export const initCapacitorBridgeIfNeeded = (): void => {
  if (typeof window === 'undefined') return;

  const win = window as any;

  // Only needed on Android (androidBridge is exposed via addJavascriptInterface).
  // Capital-A AndroidBridge is the raw Java interface; lowercase androidBridge
  // is the alias set up by native-bridge.js when injection succeeds. Check both.
  const hasAndroidBridge = !!(win.androidBridge || win.AndroidBridge);
  if (!hasAndroidBridge) return;

  const cap = (win.Capacitor = win.Capacitor || {});

  // If PluginHeaders already populated by normal injection, nothing to do.
  if (cap.PluginHeaders && cap.PluginHeaders.length > 0) return;

  // Guard against double initialisation
  if (bridgeInitialized) return;
  bridgeInitialized = true;

  console.log('[CapacitorBridgeInit] Initializing Capacitor bridge manually (Android remote-URL mode)');

  type NativeCallback = (data: unknown, err?: unknown) => void;
  type NativeResolve = (value: unknown) => void;
  type NativeReject = (reason: unknown) => void;

  // --- Callback registry ---
  let callbackIdCounter = Math.floor(Math.random() * 134_217_728);
  const callbacks = new Map<string, {
    resolve?: NativeResolve;
    reject?: NativeReject;
    callback?: NativeCallback;
    keepAlive?: boolean;
  }>();

  // --- Shared response dispatcher ---
  // Mirrors Capacitor's native-bridge.js `returnResult` function.
  // Native delivers results via EITHER:
  //   (a) evaluateJavascript("window.Capacitor.fromNative({…})") → cap.fromNative
  //   (b) androidBridge.onmessage event                         → onmessage handler
  // Both paths call this function so callbacks always fire.
  const returnResult = (result: {
    callbackId: string;
    success?: boolean;
    data?: unknown;
    error?: unknown;
    save?: boolean;
  }) => {
    const stored = callbacks.get(String(result.callbackId));
    if (!stored) return;

    if (typeof stored.callback === 'function') {
      // Event-listener / keepAlive callback
      if (result.success !== false) {
        stored.callback(result.data);
      } else {
        stored.callback(null, result.error);
      }
      // Native sets save:false to signal the listener should be torn down
      if (result.save === false) {
        callbacks.delete(String(result.callbackId));
      }
    } else if (stored.resolve) {
      // One-shot promise callback
      if (result.success !== false) {
        stored.resolve(result.data);
      } else {
        stored.reject?.(result.error);
      }
      callbacks.delete(String(result.callbackId));
    }
  };

  // --- cap.fromNative (primary delivery path for Android native responses) ---
  // Android Bridge.java calls: evaluateJavascript("window.Capacitor.fromNative({…})")
  // Without this function every nativePromise hangs forever.
  cap.fromNative = (result: unknown) => {
    try {
      returnResult(result as Parameters<typeof returnResult>[0]);
    } catch (err) {
      console.error('[CapacitorBridgeInit] fromNative error', err);
    }
  };

  // Ensure the raw Java interface is aliased as win.androidBridge so the
  // postMessage call below works regardless of which name is present.
  if (!win.androidBridge && win.AndroidBridge) {
    win.androidBridge = {
      postMessage: (data: string) => win.AndroidBridge.postMessage(data),
    };
  }

  // --- androidBridge.onmessage (secondary delivery path) ---
  win.androidBridge.onmessage = (event: MessageEvent) => {
    try {
      const result =
        typeof event === 'object' && event !== null && 'data' in event
          ? JSON.parse(typeof event.data === 'string' ? event.data : JSON.stringify(event.data))
          : JSON.parse(String(event));
      returnResult(result);
    } catch (err) {
      console.error('[CapacitorBridgeInit] onmessage parse error', err);
    }
  };

  // --- cap.toNative ---
  // Message format matches Capacitor native-bridge.js exactly (no extra 'type' field).
  cap.toNative = (
    pluginName: string,
    methodName: string,
    options: unknown,
    storedCallback?: {
      resolve?: NativeResolve;
      reject?: NativeReject;
      callback?: NativeCallback;
      keepAlive?: boolean;
    }
  ): string => {
    const callbackId = String(++callbackIdCounter);
    if (storedCallback) {
      callbacks.set(callbackId, storedCallback);
    }
    try {
      win.androidBridge.postMessage(
        JSON.stringify({
          callbackId,
          pluginId: pluginName,
          methodName,
          options: options ?? {},
        })
      );
    } catch (err) {
      console.error('[CapacitorBridgeInit] postMessage error', err);
    }
    return callbackId;
  };

  // --- cap.nativeCallback ---
  cap.nativeCallback = (
    pluginName: string,
    methodName: string,
    options: unknown,
    callback: NativeCallback
  ): string => {
    return cap.toNative(
      pluginName,
      methodName,
      options,
      { callback, keepAlive: true }
    );
  };

  // --- cap.nativePromise ---
  cap.nativePromise = (
    pluginName: string,
    methodName: string,
    options: unknown
  ): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      cap.toNative(pluginName, methodName, options, { resolve, reject });
    });
  };

  // --- cap.addListener (used by @capacitor/core's addListenerNative) ---
  cap.addListener = (
    pluginName: string,
    eventName: string,
    callback: NativeCallback
  ): string => {
    return cap.nativeCallback(pluginName, 'addListener', { eventName }, callback);
  };

  // --- cap.removeListener ---
  cap.removeListener = (
    pluginName: string,
    callbackId: string,
    eventName: string,
    _callback: NativeCallback
  ): void => {
    cap.nativeCallback(pluginName, 'removeListener', { callbackId, eventName }, () => {
      callbacks.delete(callbackId);
    });
  };

  // --- Platform detection ---
  cap.getPlatform = () => 'android';
  cap.isNativePlatform = () => true;
  cap.isPluginAvailable = (name: string) =>
    Object.prototype.hasOwnProperty.call(cap.Plugins || {}, name);

  // --- PluginHeaders ---
  // These are the method descriptors registerPlugin() reads to decide whether
  // to use the native path.  rtype values: 'promise' | 'callback' | 'none'.
  cap.PluginHeaders = [
    {
      name: 'Browser',
      methods: [
        { name: 'open', rtype: 'promise' },
        { name: 'close', rtype: 'promise' },
        { name: 'addListener', rtype: 'callback' },
        { name: 'removeAllListeners', rtype: 'promise' },
      ],
    },
    {
      name: 'App',
      methods: [
        { name: 'exitApp', rtype: 'none' },
        { name: 'getInfo', rtype: 'promise' },
        { name: 'getLaunchUrl', rtype: 'promise' },
        { name: 'getState', rtype: 'promise' },
        { name: 'minimizeApp', rtype: 'promise' },
        { name: 'addListener', rtype: 'callback' },
        { name: 'removeAllListeners', rtype: 'promise' },
      ],
    },
  ];

  // --- Plugins object (legacy compatibility) ---
  const Plugins = (cap.Plugins = cap.Plugins || {});

  Plugins.Browser = {
    addListener: (eventName: string, callback: NativeCallback) =>
      cap.addListener('Browser', eventName, callback),
    open: (options: unknown) => cap.nativePromise('Browser', 'open', options),
    close: () => cap.nativePromise('Browser', 'close', {}),
    removeAllListeners: () => cap.nativePromise('Browser', 'removeAllListeners', {}),
  };

  Plugins.App = {
    addListener: (eventName: string, callback: NativeCallback) =>
      cap.addListener('App', eventName, callback),
    getState: () => cap.nativePromise('App', 'getState', {}),
    getLaunchUrl: () => cap.nativePromise('App', 'getLaunchUrl', {}),
    exitApp: () => cap.toNative('App', 'exitApp', {}),
    minimizeApp: () => cap.nativePromise('App', 'minimizeApp', {}),
  };

  win.Capacitor = cap;
  console.log('[CapacitorBridgeInit] Bridge ready – PluginHeaders:', cap.PluginHeaders.map((h: any) => h.name));
};
