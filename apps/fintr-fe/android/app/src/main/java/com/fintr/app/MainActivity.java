package com.fintr.app;

import android.annotation.SuppressLint;
import android.content.Intent;
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
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.filesystem.FilesystemPlugin;

public class MainActivity extends BridgeActivity {

  private static final String SYNC_APPEARANCE_JS =
    "(function(){try{"
      + "var t=localStorage.getItem('fintr-theme');"
      + "if(t==='light'||t==='dark')return t;"
      + "if(document.documentElement.classList.contains('dark'))return 'dark';"
      + "return 'light';"
      + "}catch(e){return 'dark';}})();";

  private static final String INSTALL_APPEARANCE_OBSERVER_JS =
    "(function(){try{"
      + "if(window.__fintrAppearanceObserverInstalled)return;"
      + "window.__fintrAppearanceObserverInstalled=true;"
      + "var resolve=function(){"
      + "var t=localStorage.getItem('fintr-theme');"
      + "if(t==='light'||t==='dark')return t;"
      + "if(document.documentElement.classList.contains('dark'))return 'dark';"
      + "return 'light';"
      + "};"
      + "var pending=0;"
      + "var push=function(){"
      + "if(pending)cancelAnimationFrame(pending);"
      + "pending=requestAnimationFrame(function(){"
      + "pending=0;"
      + "if(!window.FintrAppearance)return;"
      + "var theme=resolve();"
      + "if(window.FintrAppearance.setTheme)window.FintrAppearance.setTheme(theme);"
      + "else if(window.FintrAppearance.syncFromDom)window.FintrAppearance.syncFromDom();"
      + "});"
      + "};"
      + "new MutationObserver(push).observe(document.documentElement,{attributes:true,attributeFilter:['class']});"
      + "push();"
      + "}catch(e){}})();";

  private boolean appearanceBridgeAttached = false;
  private final FintrAppearanceBridge appearanceBridge = new FintrAppearanceBridge(this);
  private final FintrConnectionGate connectionGate = new FintrConnectionGate(this);

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
    syncAppearanceFromWebStorage();
  }

  @Override
  protected void load() {
    bridge = bridgeBuilder.addPlugins(initialPlugins).setConfig(config).create();

    this.keepRunning = bridge.shouldKeepRunning();
    this.onNewIntent(getIntent());

    installOfflineErrorHandler();
    connectionGate.beginInitialGate(bridge);
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    registerPlugin(com.fintr.app.CacheControlPlugin.class);
    registerPlugin(com.fintr.app.NavigationInfoPlugin.class);
    registerPlugin(com.fintr.app.AppearancePlugin.class);
    registerPlugin(com.fintr.app.FileSharePlugin.class);
    registerPlugin(FilesystemPlugin.class);
    WebView.setWebContentsDebuggingEnabled(true);
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    applyAppearance(true);
    configureWebViewCache();
    setupWebSafeAreaInsets();
    ViewCompat.requestApplyInsets(getWindow().getDecorView());
    final View decorView = getWindow().getDecorView();
    decorView.post(this::installOfflineErrorHandler);
    decorView.postDelayed(this::installOfflineErrorHandler, 100);
    decorView.postDelayed(this::installOfflineErrorHandler, 500);
  }

  @Override
  public void onStart() {
    super.onStart();
    attachAppearanceBridge();
    installOfflineErrorHandler();
    scheduleAppearanceSyncFromWeb();
  }

  @Override
  public void onResume() {
    super.onResume();
    attachAppearanceBridge();
    installOfflineErrorHandler();
    scheduleAppearanceSyncFromWeb();
  }

  public void applyAppearance(boolean isLight) {
    runOnUiThread(() -> applyAppearanceInternal(isLight));
  }

  private void applyAppearanceInternal(boolean isLight) {
    int topBarColor = ContextCompat.getColor(
      this,
      isLight ? R.color.fintr_top_bar_light : R.color.fintr_top_bar
    );

    getWindow().setStatusBarColor(topBarColor);
    getWindow().setNavigationBarColor(topBarColor);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      getWindow().setNavigationBarContrastEnforced(false);
      getWindow().setStatusBarContrastEnforced(false);
    }

    View decorView = getWindow().getDecorView();
    WindowInsetsControllerCompat controller =
        WindowCompat.getInsetsController(getWindow(), decorView);
    if (controller != null) {
      controller.setAppearanceLightStatusBars(isLight);
      controller.setAppearanceLightNavigationBars(isLight);
    }

    applyLegacySystemBarAppearance(decorView, isLight);
    applyWebContainerBackground(topBarColor);
  }

  private void applyWebContainerBackground(int color) {
    try {
      WebView webView = getBridge().getWebView();
      if (webView == null) {
        return;
      }

      webView.setBackgroundColor(color);
      if (webView.getParent() instanceof View) {
        ((View) webView.getParent()).setBackgroundColor(color);
      }
    } catch (Exception e) {
      // Bridge may not be ready yet.
    }
  }

  private void applyLegacySystemBarAppearance(View decorView, boolean isLight) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return;
    }

    int flags = decorView.getSystemUiVisibility();
    if (isLight) {
      flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
      }
    } else {
      flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
      }
    }
    decorView.setSystemUiVisibility(flags);
  }

  @SuppressLint("JavascriptInterface")
  private void attachAppearanceBridge() {
    try {
      WebView webView = getBridge().getWebView();
      if (webView == null || appearanceBridgeAttached) {
        return;
      }
      webView.addJavascriptInterface(appearanceBridge, "FintrAppearance");
      appearanceBridgeAttached = true;
      webView.evaluateJavascript(INSTALL_APPEARANCE_OBSERVER_JS, null);
    } catch (Exception e) {
      // Ignore — bridge may attach on a later lifecycle pass.
    }
  }

  private void scheduleAppearanceSyncFromWeb() {
    final View decorView = getWindow().getDecorView();
    decorView.post(this::syncAppearanceFromWebStorage);
    decorView.postDelayed(this::syncAppearanceFromWebStorage, 400);
    decorView.postDelayed(this::syncAppearanceFromWebStorage, 1200);
    decorView.postDelayed(this::syncAppearanceFromWebStorage, 3000);
  }

  public void syncAppearanceFromWebStorage() {
    try {
      WebView webView = getBridge().getWebView();
      if (webView == null) {
        return;
      }

      String currentUrl = webView.getUrl();
      String errorUrl = getBridge().getErrorUrl();
      if (
        errorUrl != null
        && currentUrl != null
        && currentUrl.startsWith(errorUrl)
      ) {
        runOnUiThread(() -> applyAppearance(false));
        return;
      }

      webView.evaluateJavascript(
        SYNC_APPEARANCE_JS,
        raw -> {
          if (raw == null) {
            return;
          }
          String theme = raw.replace("\"", "").trim();
          boolean isLight = "light".equals(theme);
          runOnUiThread(() -> applyAppearance(isLight));
        }
      );
    } catch (Exception e) {
      // Ignore
    }
  }

  private void setupWebSafeAreaInsets() {
    try {
      final View decorView = getWindow().getDecorView();

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

      applyInsetsRunnable.run();
      decorView.post(applyInsetsRunnable);
      decorView.postDelayed(applyInsetsRunnable, 100);
      decorView.postDelayed(applyInsetsRunnable, 500);

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
      int statusBarTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
      final boolean is3ButtonNav = isButtonNavigation();
      final int finalNavHeight = is3ButtonNav ? 48 : 16;

      WebView webView = getBridge().getWebView();
      if (webView == null) return;

      String jsCode =
          "(function(){"
          + "try {"
          + "var html = document.documentElement;"
          + "html.classList.add('fintr-native-android');"
          + "html.style.setProperty('--safe-area-inset-top','" + statusBarTop + "px');"
          + "html.style.setProperty('--safe-area-inset-bottom','" + finalNavHeight + "px');"
          + (is3ButtonNav ? "html.classList.add('fintr-has-3btn-nav');" : "html.classList.remove('fintr-has-3btn-nav');")
          + "console.log('[AndroidNative] Safe area applied: top=" + statusBarTop + "px, bottom=" + finalNavHeight + "px, 3btn=" + is3ButtonNav + "');"
          + "return 'SUCCESS';"
          + "} catch(e) {"
          + "console.error('[AndroidNative] Error:', e.message);"
          + "return 'ERROR: ' + e.message;"
          + "}"
          + "})();";

      webView.evaluateJavascript(jsCode, null);
      syncAppearanceFromWebStorage();
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

  private void installOfflineErrorHandler() {
    try {
      Bridge bridge = getBridge();
      if (bridge == null) {
        return;
      }

      if (bridge.getWebView() == null) {
        return;
      }

      if (!(bridge.getWebViewClient() instanceof FintrBridgeWebViewClient)) {
        bridge.setWebViewClient(new FintrBridgeWebViewClient(bridge, connectionGate));
      }
    } catch (Exception e) {
      // Bridge may not be ready yet; retry on a later lifecycle pass.
    }
  }
}
