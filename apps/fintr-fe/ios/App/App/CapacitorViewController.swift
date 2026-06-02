import UIKit
import Capacitor

/// Root bridge controller: adjusts WKWebView frame so CSS safe-area and native insets do not double-count.
/// Frame updates are deferred off the layout pass and skip no-op updates to avoid main-thread hangs
/// (e.g. when the camera / photo picker changes status bar or safe-area — see App Hang reports).
class CapacitorViewController: CAPBridgeViewController {
    private var hasAdjustedFrame = false
    private var observer: NSObjectProtocol?
    private var lastAppliedTop: CGFloat?
    private var lastAppliedLeft: CGFloat?
    private var lastAppliedRight: CGFloat?
    private var lastAppliedBottom: CGFloat?
    private var lastAppliedWidth: CGFloat?
    private var lastAppliedHeight: CGFloat?

    private static let layoutEpsilon: CGFloat = 0.5

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(FileSharePlugin())
        bridge?.registerPluginInstance(AppearancePlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        observer = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("CAPBridgeDidLoad"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
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
        guard hasAdjustedFrame else { return }
        // Never mutate subview frames synchronously inside layout; defer to the next run loop
        // so we do not re-enter layout while the system is updating status bar / safe-area (camera UI).
        DispatchQueue.main.async { [weak self] in
            self?.setupWebViewPadding()
        }
    }

    private func setupWebViewPadding() {
        guard let webView = self.value(forKey: "webView") as? UIView else {
            if !hasAdjustedFrame {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                    self?.setupWebViewPadding()
                }
            }
            return
        }

        guard webView.superview != nil,
              webView.frame.width > 0,
              webView.frame.height > 0 else {
            if !hasAdjustedFrame {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                    self?.setupWebViewPadding()
                }
            }
            return
        }

        // Do not call layoutIfNeeded() here — it forces synchronous layout and can interact badly
        // with statusBarManager / safeAreaInsets during transitions (photo picker, etc.).

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

        let bottomInset = view.safeAreaInsets.bottom

        guard topPadding > 0 || leftPadding > 0 || rightPadding > 0 || bottomInset > 0 else {
            return
        }

        let newOrigin = CGPoint(x: leftPadding, y: topPadding)
        let newSize = CGSize(
            width: UIScreen.main.bounds.width - leftPadding - rightPadding,
            height: UIScreen.main.bounds.height - topPadding - bottomInset
        )

        if let t = lastAppliedTop,
           let l = lastAppliedLeft,
           let r = lastAppliedRight,
           let b = lastAppliedBottom,
           let w = lastAppliedWidth,
           let h = lastAppliedHeight,
           abs(t - topPadding) < Self.layoutEpsilon,
           abs(l - leftPadding) < Self.layoutEpsilon,
           abs(r - rightPadding) < Self.layoutEpsilon,
           abs(b - bottomInset) < Self.layoutEpsilon,
           abs(w - newSize.width) < Self.layoutEpsilon,
           abs(h - newSize.height) < Self.layoutEpsilon {
            return
        }

        webView.frame.origin = newOrigin
        webView.frame.size = newSize

        lastAppliedTop = topPadding
        lastAppliedLeft = leftPadding
        lastAppliedRight = rightPadding
        lastAppliedBottom = bottomInset
        lastAppliedWidth = newSize.width
        lastAppliedHeight = newSize.height
        hasAdjustedFrame = true
    }
}
