import Capacitor
import UIKit
import WebKit

/// Applies dark native chrome when the bundled offline page is shown.
final class OfflineAppearanceBridge: NSObject, WKScriptMessageHandler {
    private weak var bridge: CAPBridgeProtocol?
    private let handlerName = "fintrOfflineAppearance"
    private var isInstalled = false

    func install(webView: WKWebView?, bridge: CAPBridgeProtocol?) {
        guard let webView = webView, let bridge = bridge, !isInstalled else {
            return
        }

        self.bridge = bridge
        webView.configuration.userContentController.add(self, name: handlerName)
        isInstalled = true
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == handlerName else {
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.applyOfflineAppearance()
        }
    }

    func applyOfflineAppearance() {
        let window = AppDelegate.keyWindow()
        window?.overrideUserInterfaceStyle = .dark
        window?.backgroundColor = FintrLaunchColors.darkBackground

        if let viewController = bridge?.viewController {
            viewController.setNeedsStatusBarAppearanceUpdate()
            if #available(iOS 13.0, *) {
                viewController.overrideUserInterfaceStyle = .dark
            }
        }
    }

    func resetAppAppearance() {
        let window = AppDelegate.keyWindow()
        window?.overrideUserInterfaceStyle = .unspecified
        window?.backgroundColor = FintrLaunchColors.lightBackground

        if let viewController = bridge?.viewController {
            viewController.setNeedsStatusBarAppearanceUpdate()
            if #available(iOS 13.0, *) {
                viewController.overrideUserInterfaceStyle = .unspecified
            }
        }
    }
}
