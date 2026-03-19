package com.fintr.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(com.fintr.app.CacheControlPlugin.class);
    WebView.setWebContentsDebuggingEnabled(true);
    super.onCreate(savedInstanceState);
    // Ensure the SYSTEM navigation bar area is owned by Android (3-button nav),
    // so its background color is the nav bar color (not the webview/background behind it).
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    applySystemBarColors();
    configureWebViewCache();
  }

  private void applySystemBarColors() {
    int topBarColor = ContextCompat.getColor(this, R.color.fintr_top_bar);
    int bottomNavColor = ContextCompat.getColor(this, R.color.fintr_bottom_nav);

    getWindow().setStatusBarColor(topBarColor);
    // Keep the system navigation buttons clearly visible: use a light nav bar background
    // (matching the app chrome) with dark icons.
    getWindow().setNavigationBarColor(bottomNavColor);

    // Android 10+ can enforce contrast and override nav bar coloring; disable it.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      getWindow().setNavigationBarContrastEnforced(false);
      getWindow().setStatusBarContrastEnforced(false);
    }

    // Ensure Android doesn't treat navigation bar as "light" (which can wash out colors).
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    if (controller != null) {
      controller.setAppearanceLightStatusBars(true);
      controller.setAppearanceLightNavigationBars(false);
    }
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
