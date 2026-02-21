package com.fintr.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(com.fintr.app.CacheControlPlugin.class);
    WebView.setWebContentsDebuggingEnabled(true);
    super.onCreate(savedInstanceState);
    configureWebViewCache();
  }

  private void configureWebViewCache() {
    // Cache configuration is handled at the WebView level
    // Settings are applied to ensure proper caching behavior
    WebSettings webSettings = getBridge().getWebView().getSettings();

    // Enable DOM storage for better performance
    webSettings.setDomStorageEnabled(true);

    // Enable database storage
    webSettings.setDatabaseEnabled(true);

    // Set cache mode to use cache when available, load from network when not
    webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
  }
}
