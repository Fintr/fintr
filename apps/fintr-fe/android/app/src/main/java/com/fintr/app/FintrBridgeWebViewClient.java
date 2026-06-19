package com.fintr.app;

import android.content.Context;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;
import java.io.InputStream;

/**
 * Capacitor's default WebViewClient calls super.onReceivedError() before loading
 * server.errorPath, which causes Android to show the system "Webpage not available"
 * screen. We load the bundled offline page first for main-frame failures.
 *
 * The offline URL must match bridge.getErrorUrl() exactly (no query params), or
 * Capacitor's local asset server will not intercept the request.
 */
public class FintrBridgeWebViewClient extends BridgeWebViewClient {

  private final Bridge fintrBridge;
  private final FintrConnectionGate connectionGate;

  public FintrBridgeWebViewClient(Bridge bridge, FintrConnectionGate connectionGate) {
    super(bridge);
    this.fintrBridge = bridge;
    this.connectionGate = connectionGate;
  }

  @Override
  public WebResourceResponse shouldInterceptRequest(
    WebView view,
    WebResourceRequest request
  ) {
    WebResourceResponse bundledAsset = serveBundledPublicAsset(view, request);
    if (bundledAsset != null) {
      return bundledAsset;
    }

    return super.shouldInterceptRequest(view, request);
  }

  @Override
  public void onPageFinished(WebView view, String url) {
    super.onPageFinished(view, url);

    if (connectionGate != null) {
      connectionGate.onPageFinished(view, url, fintrBridge);
    }
  }

  @Override
  public void onReceivedError(
    WebView view,
    WebResourceRequest request,
    WebResourceError error
  ) {
    if (request.isForMainFrame()) {
      if (loadOfflinePage(view, request.getUrl())) {
        return;
      }

      if (suppressMainFrameError(view)) {
        return;
      }
    }

    super.onReceivedError(view, request, error);
  }

  @SuppressWarnings("deprecation")
  @Override
  public void onReceivedError(
    WebView view,
    int errorCode,
    String description,
    String failingUrl
  ) {
    if (isMainDocumentFailure(failingUrl)) {
      if (loadOfflinePage(view, Uri.parse(failingUrl))) {
        return;
      }

      if (suppressMainFrameError(view)) {
        return;
      }
    }

    super.onReceivedError(view, errorCode, description, failingUrl);
  }

  @Override
  public void onReceivedHttpError(
    WebView view,
    WebResourceRequest request,
    WebResourceResponse errorResponse
  ) {
    if (request.isForMainFrame()) {
      if (loadOfflinePage(view, request.getUrl())) {
        return;
      }

      if (suppressMainFrameError(view)) {
        return;
      }
    }

    super.onReceivedHttpError(view, request, errorResponse);
  }

  private boolean suppressMainFrameError(WebView view) {
    if (connectionGate == null || connectionGate.shouldHandleOfflineError()) {
      return false;
    }

    connectionGate.hideWebView(view);
    return true;
  }

  private boolean loadOfflinePage(WebView view, Uri failingUrl) {
    String errorUrl = fintrBridge.getErrorUrl();
    if (errorUrl == null || errorUrl.trim().isEmpty()) {
      return false;
    }

    if (connectionGate != null && !connectionGate.shouldHandleOfflineError()) {
      return false;
    }

    if (isOfflinePageUrl(failingUrl != null ? failingUrl.toString() : null, errorUrl)) {
      return false;
    }

    applyOfflineSystemChrome(view);

    if (connectionGate != null) {
      connectionGate.hideWebView(view);
      connectionGate.prepareReveal(errorUrl);
    }

    view.stopLoading();
    view.loadUrl(errorUrl);
    return true;
  }

  private void applyOfflineSystemChrome(WebView view) {
    Context context = view.getContext();
    if (context instanceof MainActivity) {
      ((MainActivity) context).applyAppearance(false);
    }
  }

  private boolean isOfflinePageUrl(String failingUrl, String errorUrl) {
    if (failingUrl == null || failingUrl.trim().isEmpty()) {
      return false;
    }

    return failingUrl.startsWith(errorUrl);
  }

  private boolean isMainDocumentFailure(String failingUrl) {
    if (failingUrl == null || failingUrl.trim().isEmpty()) {
      return false;
    }

    String errorUrl = fintrBridge.getErrorUrl();
    if (errorUrl != null && isOfflinePageUrl(failingUrl, errorUrl)) {
      return false;
    }

    String serverUrl = fintrBridge.getServerUrl();
    if (serverUrl == null || serverUrl.trim().isEmpty()) {
      return true;
    }

    String serverBase = serverUrl.split("\\?")[0];
    return failingUrl.startsWith(serverBase);
  }

  /**
   * When a remote server URL is configured, Capacitor proxies non-main localhost
   * requests instead of serving bundled assets. Offline-page subresources (logo,
   * icons) must still load from the synced public/ bundle.
   */
  private WebResourceResponse serveBundledPublicAsset(
    WebView view,
    WebResourceRequest request
  ) {
    String serverUrl = fintrBridge.getServerUrl();
    if (serverUrl == null || serverUrl.trim().isEmpty()) {
      return null;
    }

    Uri url = request.getUrl();
    String host = url.getHost();
    if (host == null || !host.equalsIgnoreCase(fintrBridge.getHost())) {
      return null;
    }

    String path = url.getPath();
    if (path == null || path.isEmpty() || "/".equals(path)) {
      return null;
    }

    if (
      path.startsWith("/_capacitor")
      || path.startsWith("/capacitor")
      || path.startsWith("/_next")
    ) {
      return null;
    }

    String lastSegment = url.getLastPathSegment();
    if (lastSegment == null || !lastSegment.contains(".")) {
      return null;
    }

    String assetPath = "public" + path;
    try {
      InputStream stream = view.getContext().getAssets().open(assetPath);
      String mimeType = guessMimeType(path);
      return new WebResourceResponse(mimeType, "UTF-8", stream);
    } catch (IOException e) {
      return null;
    }
  }

  private String guessMimeType(String path) {
    String extension = MimeTypeMap.getFileExtensionFromUrl(path);
    if (extension != null) {
      String mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
      if (mimeType != null) {
        return mimeType;
      }
    }

    if (path.endsWith(".svg")) {
      return "image/svg+xml";
    }

    return "application/octet-stream";
  }
}
