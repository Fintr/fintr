package com.fintr.app;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

final class FintrServerReachability {

  private static final int DEFAULT_TIMEOUT_MS = 8000;

  private FintrServerReachability() {}

  static boolean isReachable(String serverUrl) {
    return isReachable(serverUrl, DEFAULT_TIMEOUT_MS);
  }

  static boolean isReachable(String serverUrl, int timeoutMs) {
    if (serverUrl == null || serverUrl.trim().isEmpty()) {
      return true;
    }

    if (probe(serverUrl, "HEAD", timeoutMs)) {
      return true;
    }

    return probe(serverUrl, "GET", timeoutMs);
  }

  private static boolean probe(String serverUrl, String method, int timeoutMs) {
    HttpURLConnection connection = null;

    try {
      connection = (HttpURLConnection) new URL(serverUrl).openConnection();
      connection.setRequestMethod(method);
      connection.setConnectTimeout(timeoutMs);
      connection.setReadTimeout(timeoutMs);
      connection.setInstanceFollowRedirects(true);
      connection.setUseCaches(false);

      int responseCode = connection.getResponseCode();
      return responseCode >= 200 && responseCode < 500;
    } catch (IOException e) {
      return false;
    } finally {
      if (connection != null) {
        connection.disconnect();
      }
    }
  }
}
