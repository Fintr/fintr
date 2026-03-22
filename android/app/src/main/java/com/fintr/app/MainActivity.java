package com.fintr.app;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
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

  /**
   * Get the system navigation mode from Settings.Secure.
   * 0 = 3-button navigation (traditional)
   * 1 = 2-button navigation (Android 9 pill style)
   * 2 = gesture navigation (Android 10+)
   * -1 = unknown/error (default to 3-button for safety)
   */
  private int getNavigationMode() {
    try {
      return Settings.Secure.getInt(getContentResolver(), "navigation_mode");
    } catch (Settings.SettingNotFoundException e) {
      // Fallback: check API level - Android < 10 uses 3-button nav
      return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? -1 : 0;
    }
  }

  /**
   * Returns true if the device is using 3-button or 2-button navigation.
   * Returns false for gesture navigation.
   */
  private boolean isButtonNavigation() {
    int mode = getNavigationMode();
    // 0 = 3-button, 1 = 2-button, both are button-based
    // 2 = gesture
    // -1 = unknown, default to true (safer for layout)
    return mode == 0 || mode == 1 || mode == -1;
  }

  @Override
  public void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);
    // Activity is not recreated on rotation (see configChanges in AndroidManifest);
    // re-apply window insets so WebView CSS vars match portrait/landscape bars.
    try {
      ViewCompat.requestApplyInsets(getWindow().getDecorView());
    } catch (Exception e) {
      // Ignore; best-effort only.
    }
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(com.fintr.app.CacheControlPlugin.class);
    WebView.setWebContentsDebuggingEnabled(true);
    super.onCreate(savedInstanceState);
    // IMPORTANT: setDecorFitsSystemWindows(false) allows us to handle insets ourselves
    // and properly detect 3-button vs gesture navigation
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    applySystemBarColors();
    configureWebViewCache();
    setupWebSafeAreaInsets();
    // Force initial inset dispatch after setup
    ViewCompat.requestApplyInsets(getWindow().getDecorView());

    // Let the web layer know we're running on Android native so we can scope
    // Android-only safe-area adjustments (prevents iOS from getting extra padding).
    // Also set initial 3-button nav detection class.
    try {
      getBridge()
          .getWebView()
          .evaluateJavascript(
              "(function(){"
                  + "var apply=function(){"
                  + "document.documentElement.classList.add('fintr-native-android');"
                  + "};"
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

    // Also set the 3-button nav class immediately based on Settings.Secure
    // Use a delayed approach to ensure WebView is ready
    final View decorView = getWindow().getDecorView();
    final int navMode = getNavigationMode();
    final boolean is3ButtonNav = isButtonNavigation();

    decorView.post(() -> {
      try {
        WindowInsetsCompat rootInsets = ViewCompat.getRootWindowInsets(decorView);
        if (rootInsets != null) {
          int navBarHeight = rootInsets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
          int systemBarsBottom = rootInsets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom;
          int mandatoryGesturesBottom = rootInsets.getInsets(WindowInsetsCompat.Type.mandatorySystemGestures()).bottom;
          int tappableElementBottom = rootInsets.getInsets(WindowInsetsCompat.Type.tappableElement()).bottom;

          // Use the maximum of all bottom insets to get the true nav bar height
          int effectiveNavHeight = Math.max(Math.max(navBarHeight, systemBarsBottom),
              Math.max(mandatoryGesturesBottom, tappableElementBottom));

          int statusBarTop = rootInsets.getInsets(WindowInsetsCompat.Type.statusBars()).top;

          // Use Settings.Secure navigation_mode for reliable detection
          // 0 = 3-button, 1 = 2-button, 2 = gesture, -1 = unknown
          final int finalNavHeight = Math.max(effectiveNavHeight, is3ButtonNav ? 48 : 16);
          final int finalStatusTop = statusBarTop;

          getBridge()
              .getWebView()
              .evaluateJavascript(
                  "(function(){"
                      + "var apply=function(){"
                      + "console.log('[AndroidNative] navMode=" + navMode
                      + ", is3Btn=" + is3ButtonNav
                      + ", navBar=" + navBarHeight
                      + ", sysBars=" + systemBarsBottom
                      + ", gestures=" + mandatoryGesturesBottom
                      + ", tappable=" + tappableElementBottom
                      + ", effective=" + effectiveNavHeight
                      + ", final=" + finalNavHeight + "');"
                      + "document.documentElement.style.setProperty('--safe-area-inset-top','" + finalStatusTop + "px');"
                      + "document.documentElement.style.setProperty('--safe-area-inset-bottom','" + finalNavHeight + "px');"
                      + "document.documentElement.classList.toggle('fintr-has-3btn-nav'," + (is3ButtonNav ? "true" : "false") + ");"
                      + "console.log('[AndroidNative] Classes after init:', Array.from(document.documentElement.classList));"
                      + "};"
                      + "if(document.readyState==='loading'){"
                      + "document.addEventListener('DOMContentLoaded',apply,{once:true});"
                      + "}else{"
                      + "apply();"
                      + "}"
                      + "})();",
                  null);
        }
      } catch (Exception e) {
        // Ignore; best-effort only.
      }
    });
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
      // Pass the insets through to applyWebSafeAreaInsets which will handle all the logic
      applyWebSafeAreaInsets(insets);
      // Return insets unmodified to continue propagation
      return insets;
    });

    ViewCompat.requestApplyInsets(decorView);
  }

  private void applyWebSafeAreaInsets(WindowInsetsCompat insets) {
    // Try multiple inset types to get navigation bar height
    // When setDecorFitsSystemWindows(false), navigationBars() might return 0
    int navBarHeight = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
    int systemBarsBottom = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom;
    int mandatoryGesturesBottom = insets.getInsets(WindowInsetsCompat.Type.mandatorySystemGestures()).bottom;
    int tappableElementBottom = insets.getInsets(WindowInsetsCompat.Type.tappableElement()).bottom;

    // Use the maximum of all bottom insets to get the true nav bar height
    int effectiveNavHeight = Math.max(Math.max(navBarHeight, systemBarsBottom),
        Math.max(mandatoryGesturesBottom, tappableElementBottom));

    int statusBarTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;

    // Use Settings.Secure navigation_mode for reliable 3-button nav detection
    final int navMode = getNavigationMode();
    final boolean is3ButtonNav = isButtonNavigation();

    // 3-button nav: height >= 40px, gesture nav: height < 40px
    // Use fixed heights based on navigation mode for consistency
    final int finalNavHeight = Math.max(effectiveNavHeight, is3ButtonNav ? 48 : 16);

    try {
      getBridge()
          .getWebView()
          .evaluateJavascript(
              "(function(){"
                  + "console.log('[AndroidNative] navMode=" + navMode
                  + ", is3Btn=" + is3ButtonNav
                  + ", navBar=" + navBarHeight
                  + ", sysBars=" + systemBarsBottom
                  + ", gestures=" + mandatoryGesturesBottom
                  + ", tappable=" + tappableElementBottom
                  + ", effective=" + effectiveNavHeight
                  + ", final=" + finalNavHeight + "');"
                  + "document.documentElement.style.setProperty('--safe-area-inset-top','" + statusBarTop + "px');"
                  + "document.documentElement.style.setProperty('--safe-area-inset-bottom','" + finalNavHeight + "px');"
                  + "document.documentElement.classList.toggle('fintr-has-3btn-nav'," + (is3ButtonNav ? "true" : "false") + ");"
                  + "console.log('[AndroidNative] Classes:', Array.from(document.documentElement.classList));"
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
