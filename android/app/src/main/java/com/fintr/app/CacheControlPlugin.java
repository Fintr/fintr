package com.fintr.app;

import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Clears WebView cache and reloads so the app fetches fresh content
 * when admin bumps the cache version.
 */
@CapacitorPlugin(name = "CacheControl")
public class CacheControlPlugin extends Plugin {

  @PluginMethod
  public void clearCacheAndReload(PluginCall call) {
    WebView webView = getBridge().getWebView();
    if (webView != null) {
      webView.clearCache(true);
      webView.clearSslPreferences();
      webView.reload();
    }
    call.resolve();
  }
}
