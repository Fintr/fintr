package com.fintr.app;

import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import java.net.URL;

/**
 * Probes the configured server URL before choosing what to show. The WebView stays
 * hidden until the correct page has loaded — offline.html is never shown while online.
 */
public final class FintrConnectionGate {

  private static final long RECONNECT_INTERVAL_MS = 5000;

  private final MainActivity activity;
  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private Runnable reconnectRunnable;
  private boolean reconnectMonitorActive = false;
  private boolean initialGateComplete = false;
  private boolean offlineMode = false;
  private String pendingRevealUrlPrefix = null;

  public FintrConnectionGate(MainActivity activity) {
    this.activity = activity;
  }

  /** WebViewClient may only redirect to offline.html when the gate is in offline mode. */
  public boolean shouldHandleOfflineError() {
    return initialGateComplete && offlineMode;
  }

  public void beginInitialGate(Bridge bridge) {
    if (bridge == null) {
      return;
    }

    WebView webView = bridge.getWebView();
    if (webView == null) {
      return;
    }

    String serverUrl = bridge.getServerUrl();
    if (serverUrl == null || serverUrl.trim().isEmpty()) {
      initialGateComplete = true;
      offlineMode = false;
      activity.applyAppearance(true);
      revealWebView(webView);
      return;
    }

    initialGateComplete = false;
    offlineMode = false;
    activity.applyAppearance(true);
    hideWebView(webView);

    new Thread(() -> {
      boolean reachable = FintrServerReachability.isReachable(serverUrl);
      mainHandler.post(() -> presentAfterProbe(bridge, webView, serverUrl, reachable));
    }).start();
  }

  public void onPageFinished(WebView webView, String url, Bridge bridge) {
    if (webView == null || bridge == null || url == null) {
      return;
    }

    if (isOfflineUrl(url, bridge)) {
      if (!offlineMode) {
        hideWebView(webView);
        return;
      }

      activity.applyAppearance(false);
      revealWebView(webView);
      pendingRevealUrlPrefix = null;
      startReconnectMonitor(bridge);
      return;
    }

    if (isServerUrl(url, bridge) || shouldReveal(url)) {
      offlineMode = false;
      activity.applyAppearance(true);
      activity.syncAppearanceFromWebStorage();
      revealWebView(webView);
      pendingRevealUrlPrefix = null;
      stopReconnectMonitor();
    }
  }

  public void prepareReveal(String urlPrefix) {
    pendingRevealUrlPrefix = urlPrefix;
  }

  public void hideWebView(WebView webView) {
    if (webView != null) {
      webView.setVisibility(View.INVISIBLE);
    }
  }

  public void revealWebView(WebView webView) {
    if (webView != null) {
      webView.setVisibility(View.VISIBLE);
    }
  }

  private void presentAfterProbe(
    Bridge bridge,
    WebView webView,
    String serverUrl,
    boolean reachable
  ) {
    initialGateComplete = true;

    if (reachable) {
      presentServer(bridge, webView, serverUrl);
      return;
    }

    presentOffline(bridge, webView);
  }

  private void presentServer(Bridge bridge, WebView webView, String serverUrl) {
    stopReconnectMonitor();
    offlineMode = false;
    pendingRevealUrlPrefix = null;
    activity.applyAppearance(true);
    hideWebView(webView);

    String currentUrl = webView.getUrl();
    if (
      currentUrl != null
      && isServerUrl(currentUrl, bridge)
      && !isWebViewLoading(webView)
    ) {
      revealWebView(webView);
      return;
    }

    pendingRevealUrlPrefix = serverBase(serverUrl);
    webView.loadUrl(serverUrl);
  }

  private void presentOffline(Bridge bridge, WebView webView) {
    String errorUrl = bridge.getErrorUrl();
    if (errorUrl == null || errorUrl.trim().isEmpty()) {
      revealWebView(webView);
      return;
    }

    offlineMode = true;
    activity.applyAppearance(false);
    prepareReveal(errorUrl);
    hideWebView(webView);
    webView.loadUrl(errorUrl);
    startReconnectMonitor(bridge);
  }

  private void startReconnectMonitor(Bridge bridge) {
    if (bridge == null) {
      return;
    }

    String serverUrl = bridge.getServerUrl();
    if (serverUrl == null || serverUrl.trim().isEmpty()) {
      return;
    }

    reconnectMonitorActive = true;
    scheduleReconnectProbe(bridge, serverUrl);
  }

  public void stopReconnectMonitor() {
    reconnectMonitorActive = false;
    if (reconnectRunnable != null) {
      mainHandler.removeCallbacks(reconnectRunnable);
      reconnectRunnable = null;
    }
  }

  private void scheduleReconnectProbe(Bridge bridge, String serverUrl) {
    if (reconnectRunnable != null) {
      mainHandler.removeCallbacks(reconnectRunnable);
    }

    reconnectRunnable = () -> {
      if (!reconnectMonitorActive) {
        return;
      }

      WebView webView = bridge.getWebView();
      if (webView == null) {
        scheduleReconnectProbe(bridge, serverUrl);
        return;
      }

      String currentUrl = webView.getUrl();
      if (!isOfflineUrl(currentUrl, bridge)) {
        stopReconnectMonitor();
        return;
      }

      new Thread(() -> {
        boolean reachable = FintrServerReachability.isReachable(serverUrl);
        mainHandler.post(() -> {
          if (!reconnectMonitorActive) {
            return;
          }

          if (reachable) {
            stopReconnectMonitor();
            offlineMode = false;
            pendingRevealUrlPrefix = serverBase(serverUrl);
            activity.applyAppearance(true);
            hideWebView(webView);
            webView.loadUrl(serverUrl);
            return;
          }

          scheduleReconnectProbe(bridge, serverUrl);
        });
      }).start();
    };

    mainHandler.postDelayed(reconnectRunnable, RECONNECT_INTERVAL_MS);
  }

  private boolean shouldReveal(String url) {
    if (pendingRevealUrlPrefix == null) {
      return false;
    }

    return url.startsWith(pendingRevealUrlPrefix);
  }

  private boolean isOfflineUrl(String url, Bridge bridge) {
    String errorUrl = bridge.getErrorUrl();
    return errorUrl != null && url != null && url.startsWith(errorUrl);
  }

  private boolean isServerUrl(String url, Bridge bridge) {
    String serverUrl = bridge.getServerUrl();
    if (serverUrl == null || serverUrl.trim().isEmpty() || url == null) {
      return false;
    }

    String serverBase = serverBase(serverUrl);
    if (url.startsWith(serverBase)) {
      return true;
    }

    try {
      URL parsedServer = new URL(serverUrl);
      URL parsedUrl = new URL(url);
      String serverHost = parsedServer.getHost();
      return serverHost != null && serverHost.equalsIgnoreCase(parsedUrl.getHost());
    } catch (Exception e) {
      return false;
    }
  }

  private String serverBase(String serverUrl) {
    return serverUrl.split("\\?")[0];
  }

  private boolean isWebViewLoading(WebView webView) {
    return webView.getProgress() < 100;
  }
}
