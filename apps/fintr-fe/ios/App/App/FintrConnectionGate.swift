import Capacitor
import UIKit
import WebKit

/// Reveals the WebView immediately. A startup reachability probe of the same URL
/// the WebView is loading stalls a single-threaded dev server for the whole compile
/// and kept login hidden for tens of seconds. Capacitor still loads offline.html
/// when the main frame fails.
final class FintrConnectionGate: NSObject {
    private weak var webView: WKWebView?
    private weak var bridge: CAPBridgeProtocol?
    private var reconnectTimer: Timer?
    private var loadingObservation: NSKeyValueObservation?
    private let offlineAppearanceBridge = OfflineAppearanceBridge()
    private var initialGateStarted = false
    private var awaitingServerReveal = false

    func beginInitialGate(webView: WKWebView?, bridge: CAPBridgeProtocol?) {
        guard let webView = webView, let bridge = bridge else {
            return
        }

        guard !initialGateStarted else {
            return
        }
        initialGateStarted = true

        self.webView = webView
        self.bridge = bridge

        offlineAppearanceBridge.install(webView: webView, bridge: bridge)
        observeLoadingState(webView)
        reveal(webView)
    }

    private func handleLoadFinished(webView: WKWebView, url: URL, bridge: CAPBridgeProtocol) {
        if isOffline(url: url, bridge: bridge) {
            offlineAppearanceBridge.applyOfflineAppearance()
            reveal(webView)
            startReconnectMonitor()
            awaitingServerReveal = false
            return
        }

        if isServer(url: url, bridge: bridge) {
            offlineAppearanceBridge.resetAppAppearance()
            reveal(webView)
            stopReconnectMonitor()
            awaitingServerReveal = false
            return
        }

        if awaitingServerReveal {
            reveal(webView)
        }
    }

    private func startReconnectMonitor() {
        reconnectTimer?.invalidate()

        reconnectTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            self?.probeForReconnect()
        }
    }

    private func stopReconnectMonitor() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
    }

    private func probeForReconnect() {
        guard
            let webView = webView,
            let bridge = bridge,
            let currentURL = webView.url,
            isOffline(url: currentURL, bridge: bridge)
        else {
            stopReconnectMonitor()
            return
        }

        let serverURL = bridge.config.serverURL
        FintrServerReachability.check(serverURL) { [weak self] reachable in
            DispatchQueue.main.async {
                guard let self = self, reachable else {
                    return
                }

                self.stopReconnectMonitor()
                self.awaitingServerReveal = true
                self.offlineAppearanceBridge.resetAppAppearance()
                self.hide(webView)
                webView.load(URLRequest(url: serverURL))
            }
        }
    }

    private func observeLoadingState(_ webView: WKWebView) {
        loadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self] webView, _ in
            guard
                let self = self,
                let bridge = self.bridge,
                !webView.isLoading,
                let url = webView.url
            else {
                return
            }

            self.handleLoadFinished(webView: webView, url: url, bridge: bridge)
        }
    }

    private func serverBasePrefix(for serverURL: URL) -> String {
        serverURL.absoluteString
            .split(separator: "?")
            .first
            .map(String.init) ?? serverURL.absoluteString
    }

    private func hide(_ webView: WKWebView) {
        webView.isHidden = true
        webView.alpha = 0
    }

    private func reveal(_ webView: WKWebView) {
        webView.isHidden = false
        webView.alpha = 1
    }

    private func isOffline(url: URL, bridge: CAPBridgeProtocol) -> Bool {
        guard let errorURL = bridge.config.errorPathURL else {
            return false
        }

        return url.absoluteString.hasPrefix(errorURL.absoluteString)
    }

    private func isServer(url: URL, bridge: CAPBridgeProtocol) -> Bool {
        let serverBase = serverBasePrefix(for: bridge.config.serverURL)
        let serverHost = URL(string: serverBase)?.host

        return url.absoluteString.hasPrefix(serverBase)
            || (serverHost != nil && url.host == serverHost)
    }
}
