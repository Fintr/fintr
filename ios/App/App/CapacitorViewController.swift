import UIKit
import Capacitor

class CapacitorViewController: CAPBridgeViewController {
    private var hasAdjustedFrame = false
    private var observer: NSObjectProtocol?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Listen for when the webview finishes loading
        observer = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("CAPBridgeDidLoad"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            // Wait for webview to be fully ready
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                self?.setupWebViewPadding()
            }
        }
    }
    
    deinit {
        if let observer = observer {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    override open func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Only adjust after initial setup is done (for orientation changes)
        if hasAdjustedFrame {
            setupWebViewPadding()
        }
    }

    private func setupWebViewPadding() {
        // Use value(forKey:) to safely access webView
        guard let webView = self.value(forKey: "webView") as? UIView else {
            if !hasAdjustedFrame {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.setupWebViewPadding()
                }
            }
            return
        }
        
        // Ensure webview has been added to the view hierarchy and has valid dimensions
        guard webView.superview != nil,
              webView.frame.width > 0,
              webView.frame.height > 0 else {
            if !hasAdjustedFrame {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.setupWebViewPadding()
                }
            }
            return
        }

        view.layoutIfNeeded()

        var topPadding: CGFloat = 0
        var leftPadding: CGFloat = 0
        var rightPadding: CGFloat = 0

        if #available(iOS 13.0, *) {
            let window = view.window ?? AppDelegate.keyWindow()

            topPadding = window?.windowScene?.statusBarManager?.statusBarFrame.height ?? 0
            leftPadding = view.safeAreaInsets.left
            rightPadding = view.safeAreaInsets.right
        } else {
            topPadding = UIApplication.shared.statusBarFrame.size.height
        }

        // Exclude the home-indicator safe region from the WKWebView frame. If the WebView
        // extends under the indicator, CSS env(safe-area-inset-bottom) plus pb-safe-bottom on
        // the fixed nav stacks visually as a large empty band below the tab row.
        let bottomInset = view.safeAreaInsets.bottom

        // Only adjust if we have safe area insets (devices with bezels/notches / home indicator)
        if topPadding > 0 || leftPadding > 0 || rightPadding > 0 || bottomInset > 0 {
            webView.frame.origin = CGPoint(x: leftPadding, y: topPadding)
            webView.frame.size = CGSize(
                width: UIScreen.main.bounds.width - leftPadding - rightPadding,
                height: UIScreen.main.bounds.height - topPadding - bottomInset
            )
            hasAdjustedFrame = true
        }
    }
}

