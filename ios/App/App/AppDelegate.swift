import UIKit
import Capacitor
import WebKit
import Sentry

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var hasAdjustedWebView = false

    /// Key window for the app. Uses scene-based API on iOS 15+ to avoid deprecated `windows`.
    static func keyWindow() -> UIWindow? {
        if #available(iOS 15.0, *) {
            return UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first?
                .keyWindow
        }
        return UIApplication.shared.windows.first { $0.isKeyWindow }
    }

    // MARK: - Cache Configuration

    private func configureWebViewCache() {
        let cacheSizeMB = 100 * 1024 * 1024 // 100 MB
        let diskCapacity = cacheSizeMB
        let memoryCapacity = cacheSizeMB / 4 // 25 MB for memory cache

        let cache = URLCache(
            memoryCapacity: memoryCapacity,
            diskCapacity: diskCapacity,
            diskPath: "webCache"
        )
        URLCache.shared = cache

        // Configure URLSession for better caching behavior
        let config = URLSessionConfiguration.default
        config.requestCachePolicy = .returnCacheDataElseLoad
        config.urlCache = cache
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize Sentry for native crash/error reporting
        if let dsn = Bundle.main.object(
            forInfoDictionaryKey: "SentryDSN"
        ) as? String,
           !dsn.isEmpty,
           dsn != "YOUR_IOS_SENTRY_DSN_HERE" {
            SentrySDK.start { options in
                options.dsn = dsn
                options.enableAutoSessionTracking = true
                options.enableAutoBreadcrumbTracking = true
                options.tracesSampleRate = 0.0
            }
        }

        // Set the app background color to match web app's off-white background
        if let window = AppDelegate.keyWindow() {
            // oklch(98.20% 0.004 91.45) converted to RGB: #FAF9F8
            window.backgroundColor = UIColor(red: 0.98, green: 0.976, blue: 0.973, alpha: 1.0)
        }
        
        // Configure cache settings for the WebView
        configureWebViewCache()
        
        // Adjust webview safe area after launch
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.adjustWebViewSafeArea()
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        if !hasAdjustedWebView {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                self.adjustWebViewSafeArea()
            }
        }
    }
    
    private func adjustWebViewSafeArea() {
        guard !hasAdjustedWebView,
              let window = window,
              let rootViewController = window.rootViewController as? CAPBridgeViewController else {
            return
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.setupWebViewPadding(for: rootViewController)
        }
    }
    
    private func setupWebViewPadding(for viewController: CAPBridgeViewController) {
        var webView: UIView? = nil
        
        func findWebView(in view: UIView) -> UIView? {
            if view.isKind(of: WKWebView.self) {
                return view
            }
            for subview in view.subviews {
                if let found = findWebView(in: subview) {
                    return found
                }
            }
            return nil
        }
        
        webView = findWebView(in: viewController.view)
        
        guard let webView = webView else {
            if !hasAdjustedWebView {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.setupWebViewPadding(for: viewController)
                }
            }
            return
        }
        
        guard webView.superview != nil,
              webView.frame.width > 0,
              webView.frame.height > 0 else {
            if !hasAdjustedWebView {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.setupWebViewPadding(for: viewController)
                }
            }
            return
        }

        var topPadding: CGFloat = 0
        var leftPadding: CGFloat = 0
        var rightPadding: CGFloat = 0

        if #available(iOS 13.0, *) {
            let window = viewController.view.window ?? AppDelegate.keyWindow()

            topPadding = window?.windowScene?.statusBarManager?.statusBarFrame.height ?? 0
            leftPadding = window?.safeAreaInsets.left ?? 0
            rightPadding = window?.safeAreaInsets.right ?? 0
        } else {
            topPadding = UIApplication.shared.statusBarFrame.size.height
        }

        // Only adjust if we have safe area insets (devices with notches/dynamic island)
        if topPadding > 0 || leftPadding > 0 || rightPadding > 0 {
            // Position webview with top padding but let it extend to screen bottom
            webView.frame.origin = CGPoint(x: leftPadding, y: topPadding)
            webView.frame.size = CGSize(
                width: UIScreen.main.bounds.width - leftPadding - rightPadding,
                height: UIScreen.main.bounds.height - topPadding
            )
            hasAdjustedWebView = true
            
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handleOrientationChange),
                name: UIDevice.orientationDidChangeNotification,
                object: nil
            )
        }
    }
    
    @objc private func handleOrientationChange() {
        guard let window = window,
              let rootViewController = window.rootViewController as? CAPBridgeViewController else {
            return
        }
        
        hasAdjustedWebView = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.setupWebViewPadding(for: rootViewController)
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
        NotificationCenter.default.removeObserver(self)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
