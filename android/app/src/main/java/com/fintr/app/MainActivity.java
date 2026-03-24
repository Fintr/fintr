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
    // NavigationInfoPlugin provides safe area class injection for the web app
    registerPlugin(com.fintr.app.NavigationInfoPlugin.class);
    WebView.setWebContentsDebuggingEnabled(true);
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    applySystemBarColors();
    configureWebViewCache();
    // Apply insets immediately (synchronously if possible, then async as backup)
    setupWebSafeAreaInsets();
    ViewCompat.requestApplyInsets(getWindow().getDecorView());
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
    try {
      final View decorView = getWindow().getDecorView();
      
      // Apply insets immediately - try both sync and async approaches
      final Runnable applyInsetsRunnable = new Runnable() {
        @Override
        public void run() {
          try {
            WindowInsetsCompat rootInsets = ViewCompat.getRootWindowInsets(decorView);
            if (rootInsets != null) {
              applyWebSafeAreaInsets(rootInsets);
            }
          } catch (Exception e) {
            // Ignore - will retry
          }
        }
      };
      
      // Try immediately first (WebView might already be ready)
      applyInsetsRunnable.run();
      
      // Then schedule for when view is definitely ready
      decorView.post(applyInsetsRunnable);
      
      // And again after a short delay to ensure WebView is fully initialized
      decorView.postDelayed(applyInsetsRunnable, 100);
      decorView.postDelayed(applyInsetsRunnable, 500);

      // Listen for changes
      ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, insets) -> {
        applyWebSafeAreaInsets(insets);
        return insets;
      });

      ViewCompat.requestApplyInsets(decorView);
    } catch (Exception e) {
      // Ignore
    }
  }

  private void applyWebSafeAreaInsets(WindowInsetsCompat insets) {
    try {
      // Get status bar height for top safe area
      int statusBarTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;

      // Detect navigation mode
      final boolean is3ButtonNav = isButtonNavigation();

      // Use fixed values: 48px for 3-button nav, 16px for gesture nav
      // This ensures consistency with CSS and layout calculations
      final int finalNavHeight = is3ButtonNav ? 48 : 16;

      // Apply to WebView if ready
      WebView webView = getBridge().getWebView();
      if (webView == null) return;

      // Build JavaScript to inject CSS variables AND apply CSS classes
      String jsCode = 
          "(function(){" +
          "try {" +
          "var html = document.documentElement;" +
          "html.classList.add('fintr-native-android');" +
          "html.style.setProperty('--safe-area-inset-top','" + statusBarTop + "px');" +
          "html.style.setProperty('--safe-area-inset-bottom','" + finalNavHeight + "px');" +
          (is3ButtonNav ? "html.classList.add('fintr-has-3btn-nav');" : "html.classList.remove('fintr-has-3btn-nav');") +
          "console.log('[AndroidNative] Safe area applied: top=" + statusBarTop + "px, bottom=" + finalNavHeight + "px, 3btn=" + is3ButtonNav + "');" +
          "return 'SUCCESS';" +
          "} catch(e) {" +
          "console.error('[AndroidNative] Error:', e.message);" +
          "return 'ERROR: ' + e.message;" +
          "}" +
          "})();";

      webView.evaluateJavascript(jsCode, null);
    } catch (Exception e) {
      // Ignore - will retry on next inset change
    }
  }

  private void configureWebViewCache() {
    try {
      WebView webView = getBridge().getWebView();
      if (webView == null) return;
      
      WebSettings webSettings = webView.getSettings();
      webSettings.setDomStorageEnabled(true);
      webSettings.setDatabaseEnabled(true);
      webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
    } catch (Exception e) {
      // Ignore - will configure when WebView is ready
    }
  }
}
