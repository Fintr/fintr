package com.fintr.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebSettings;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.WindowInsetsCompat;
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
    setupWebSafeAreaInsets();

    // Let the web layer know we're running on Android native so we can scope
    // Android-only safe-area adjustments (prevents iOS from getting extra padding).
    try {
      getBridge()
          .getWebView()
          .evaluateJavascript(
              "(function(){"
                  + "var apply=function(){document.documentElement.classList.add('fintr-native-android');};"
                  + "if(document.readyState==='loading'){"
                  + "document.addEventListener('DOMContentLoaded',apply,{once:true});"
                  + "}else{"
                  + "apply();"
                  + "}"
                  + "})();",
              null);
    } catch (Exception e) {
      // Ignore; best-effort only.
    }
  }

  private void applySystemBarColors() {
    int topBarColor = ContextCompat.getColor(this, R.color.fintr_top_bar);
    int bottomNavColor = ContextCompat.getColor(this, R.color.fintr_bottom_nav);

    getWindow().setStatusBarColor(topBarColor);
    // Use a light nav bar background with dark icons so the 3-button navigation
    // is always visible.
    getWindow().setNavigationBarColor(topBarColor);

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
      controller.setAppearanceLightNavigationBars(true);
    }
  }

  private void setupWebSafeAreaInsets() {
    final View decorView = getWindow().getDecorView();

    // Set initial value immediately (best-effort).
    try {
      WindowInsetsCompat rootInsets = ViewCompat.getRootWindowInsets(decorView);
      if (rootInsets != null) {
        applyWebSafeAreaInsets(rootInsets);
      }
    } catch (Exception e) {
      // Ignore; best-effort only.
    }

    ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, insets) -> {
      applyWebSafeAreaInsets(insets);
      return insets;
    });

    ViewCompat.requestApplyInsets(decorView);
  }

  private void applyWebSafeAreaInsets(WindowInsetsCompat insets) {
    boolean navVisible = insets.isVisible(WindowInsetsCompat.Type.navigationBars());
    int navBarHeight = 0;
    if (navVisible) {
      navBarHeight = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
    }

    int statusBarTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;

    final boolean hasNav = navBarHeight > 0;
    try {
      getBridge()
          .getWebView()
          .evaluateJavascript(
              "(function(){"
                  + "document.documentElement.style.setProperty('--safe-area-inset-top','" + statusBarTop + "px');"
                  + "document.documentElement.style.setProperty('--safe-area-inset-bottom','" + navBarHeight + "px');"
                  + "document.documentElement.classList.toggle('fintr-has-3btn-nav'," + (hasNav ? "true" : "false") + ");"
                  + "})();",
              null);
    } catch (Exception e) {
      // Ignore; best-effort only.
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
