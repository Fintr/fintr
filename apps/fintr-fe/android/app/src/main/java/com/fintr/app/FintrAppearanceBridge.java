package com.fintr.app;

import android.webkit.JavascriptInterface;

/**
 * Direct WebView bridge for status/navigation bar theming.
 * Works on release APKs that load remote content where Capacitor plugin routing can fail.
 */
public class FintrAppearanceBridge {

  private final MainActivity activity;

  public FintrAppearanceBridge(MainActivity activity) {
    this.activity = activity;
  }

  @JavascriptInterface
  public void setTheme(String theme) {
    boolean isLight = "light".equals(theme);
    activity.runOnUiThread(() -> activity.applyAppearance(isLight));
  }

  /** Re-read &lt;html class&gt; and localStorage, then apply native chrome. */
  @JavascriptInterface
  public void syncFromDom() {
    activity.runOnUiThread(() -> activity.syncAppearanceFromWebStorage());
  }
}
