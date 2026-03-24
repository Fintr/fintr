package com.fintr.app;

import android.os.Build;
import android.provider.Settings;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.webkit.WebView;

/**
 * Provides Android system navigation information to the web app.
 * This allows the React app to set the proper CSS classes when it's ready.
 */
@CapacitorPlugin(name = "NavigationInfo")
public class NavigationInfoPlugin extends Plugin {

  /**
   * Get the system navigation mode from Settings.Secure.
   * 0 = 3-button navigation (traditional)
   * 1 = 2-button navigation (Android 9 pill style)
   * 2 = gesture navigation (Android 10+)
   * -1 = unknown/error
   */
  private int getNavigationMode() {
    try {
      return Settings.Secure.getInt(getContext().getContentResolver(), "navigation_mode");
    } catch (Settings.SettingNotFoundException e) {
      return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? -1 : 0;
    }
  }

  /**
   * Returns true if the device is using 3-button or 2-button navigation.
   */
  private boolean isButtonNavigation() {
    int mode = getNavigationMode();
    return mode == 0 || mode == 1 || mode == -1;
  }

  /**
   * Get safe area insets from WindowInsets.
   * Uses fixed values: 48px for 3-button nav, 16px for gesture nav
   */
  private int[] getSafeAreaInsets() {
    try {
      final android.view.View decorView = getActivity().getWindow().getDecorView();
      WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decorView);
      if (insets == null) {
        return new int[] { 0, 0 };
      }
      
      int statusBarTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
      boolean is3ButtonNav = isButtonNavigation();
      
      // Use fixed values for consistency
      int finalNavHeight = is3ButtonNav ? 48 : 16;
      
      return new int[] { statusBarTop, finalNavHeight };
    } catch (Exception e) {
      return new int[] { 0, 0 };
    }
  }

  @PluginMethod
  public void getNavigationInfo(PluginCall call) {
    int navMode = getNavigationMode();
    boolean is3Button = isButtonNavigation();
    int[] insets = getSafeAreaInsets();

    JSObject result = new JSObject();
    result.put("navMode", navMode);
    result.put("is3ButtonNavigation", is3Button);
    result.put("isGestureNavigation", navMode == 2);
    result.put("platform", "android");
    result.put("safeAreaTop", insets[0]);
    result.put("safeAreaBottom", insets[1]);

    call.resolve(result);
  }

  @PluginMethod
  public void applySafeAreaClasses(PluginCall call) {
    boolean is3ButtonNav = isButtonNavigation();
    int[] insets = getSafeAreaInsets();
    
    int statusBarTop = insets[0];
    int finalNavHeight = insets[1]; // Already set to 48 or 16 by getSafeAreaInsets()

    getActivity().runOnUiThread(() -> {
      try {
        WebView webView = getBridge().getWebView();
        if (webView == null) {
          call.reject("WebView not ready");
          return;
        }
        
        // Build JavaScript to inject CSS variables AND apply CSS classes
        String jsCode = 
            "(function(){" +
            "try {" +
            "var html = document.documentElement;" +
            "html.classList.add('fintr-native-android');" +
            "html.style.setProperty('--safe-area-inset-top','" + statusBarTop + "px');" +
            "html.style.setProperty('--safe-area-inset-bottom','" + finalNavHeight + "px');" +
            (is3ButtonNav ? "html.classList.add('fintr-has-3btn-nav');" : "html.classList.remove('fintr-has-3btn-nav');") +
            "console.log('[AndroidNative] Safe area applied via plugin call: top=" + statusBarTop + "px, bottom=" + finalNavHeight + "px, 3btn=" + is3ButtonNav + "');" +
            "return 'SUCCESS';" +
            "} catch(e) {" +
            "console.error('[AndroidNative] Error:', e.message);" +
            "return 'ERROR: ' + e.message;" +
            "}" +
            "})();";
            
        webView.evaluateJavascript(jsCode, null);
        
        JSObject result = new JSObject();
        result.put("applied", true);
        result.put("safeAreaTop", statusBarTop);
        result.put("safeAreaBottom", finalNavHeight);
        result.put("is3ButtonNav", is3ButtonNav);
        call.resolve(result);
      } catch (Exception e) {
        call.reject("Failed to apply classes: " + e.getMessage());
      }
    });
  }
}
