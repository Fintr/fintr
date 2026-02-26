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
 *   - sets cap.PluginHeaders for Browser & App so registerPlugin uses native
 *   - sets window.androidBridge.onmessage to dispatch callbacks back to JS
 *
 * MUST be called (awaited) before the first dynamic import of
 * @capacitor/browser or @capacitor/app.
 */

let bridgeInitialized = false;

export const initCapacitorBridgeIfNeeded = (): void => {
  if (typeof window === 'undefined') return;

  const win = window as any;

  // Only needed on Android (androidBridge is exposed via addJavascriptInterface)
  if (!win.androidBridge) return;

  const cap = (win.Capacitor = win.Capacitor || {});

  // If PluginHeaders already populated by normal injection, nothing to do.
  if (cap.PluginHeaders && cap.PluginHeaders.length > 0) return;

  // Guard against double initialisation
  if (bridgeInitialized) return;
  bridgeInitialized = true;

  console.log('[CapacitorBridgeInit] Initializing Capacitor bridge manually (Android remote-URL mode)');

  type NativeCallback = (data: unknown) => void;
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

  // --- androidBridge.onmessage (one handler, routes to registered callbacks) ---
  win.androidBridge.onmessage = (event: MessageEvent) => {
    try {
      const result = JSON.parse(
        typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
      );
      const stored = callbacks.get(result.callbackId);
      if (!stored) return;

      if (result.error) {
        stored.reject?.(result.error);
        callbacks.delete(result.callbackId);
        return;
      }

      if (typeof stored.callback === 'function') {
        stored.callback(result.data);
        // keep-alive callbacks (e.g. event listeners) persist until removed
        if (!stored.keepAlive) {
          callbacks.delete(result.callbackId);
        }
      } else if (stored.resolve) {
        stored.resolve(result.data);
        callbacks.delete(result.callbackId);
      }
    } catch (err) {
      console.error('[CapacitorBridgeInit] onmessage parse error', err);
    }
  };

  // --- cap.toNative ---
  cap.toNative = (
    pluginName: string,
    methodName: string,
    options: unknown,
    storedCallback?: { resolve?: NativeResolve; reject?: NativeReject; callback?: NativeCallback; keepAlive?: boolean }
  ): string => {
    const callbackId = String(++callbackIdCounter);
    if (storedCallback) {
      callbacks.set(callbackId, storedCallback as any);
    }
    try {
      win.androidBridge.postMessage(
        JSON.stringify({
          type: 'message',
          pluginId: pluginName,
          methodName,
          options: options ?? {},
          callbackId,
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
    return cap.toNative(pluginName, methodName, options, {
      callback,
      keepAlive: true,
    });
  };

  // --- cap.nativePromise ---
  cap.nativePromise = (pluginName: string, methodName: string, options: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      cap.toNative(pluginName, methodName, options, { resolve, reject });
    });
  };

  // --- cap.addListener (global helper used by addListenerNative) ---
  cap.addListener = (pluginName: string, eventName: string, callback: NativeCallback): string => {
    return cap.nativeCallback(pluginName, 'addListener', { eventName }, callback);
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

  // --- Plugins object (old-style compatibility used by native-bridge.js) ---
  const Plugins = (cap.Plugins = cap.Plugins || {});

  Plugins.Browser = {
    addListener: (eventName: string, callback: NativeCallback) =>
      cap.addListener('Browser', eventName, callback),
    open: (options: any) => cap.nativePromise('Browser', 'open', options),
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
