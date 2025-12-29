import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var hasAdjustedWebView = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        // Adjust webview safe area after launch
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
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
        // Adjust webview safe area after app becomes active
        adjustWebViewSafeArea()
    }
    
    private func adjustWebViewSafeArea() {
        guard !hasAdjustedWebView,
              let window = window,
              let rootViewController = window.rootViewController as? CAPBridgeViewController else {
            return
        }
        
        // Wait a bit for webview to be ready
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.setupWebViewPadding(for: rootViewController)
        }
    }
    
    private func setupWebViewPadding(for viewController: CAPBridgeViewController) {
        // Find the webview by searching the view hierarchy
        // Capacitor uses WKWebView, so we'll search for it
        var webView: UIView? = nil
        
        // Recursive function to find WKWebView in the view hierarchy
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
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.setupWebViewPadding(for: viewController)
                }
            }
            return
        }
        
        // Ensure webview has been added to the view hierarchy and has valid dimensions
        guard webView.superview != nil,
              webView.frame.width > 0,
              webView.frame.height > 0 else {
            if !hasAdjustedWebView {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.setupWebViewPadding(for: viewController)
                }
            }
            return
        }

        var topPadding: CGFloat = 0
        var leftPadding: CGFloat = 0
        var rightPadding: CGFloat = 0

        if #available(iOS 13.0, *) {
            let window = viewController.view.window ?? UIApplication.shared.windows.first { $0.isKeyWindow }

            topPadding = window?.windowScene?.statusBarManager?.statusBarFrame.height ?? 0
            leftPadding = window?.safeAreaInsets.left ?? 0
            rightPadding = window?.safeAreaInsets.right ?? 0
        } else {
            topPadding = UIApplication.shared.statusBarFrame.size.height
        }

        // Only adjust if we have safe area insets (devices with bezels/notches)
        if topPadding > 0 || leftPadding > 0 || rightPadding > 0 {
            webView.frame.origin = CGPoint(x: leftPadding, y: topPadding)
            webView.frame.size = CGSize(
                width: UIScreen.main.bounds.width - leftPadding - rightPadding,
                height: UIScreen.main.bounds.height - topPadding
            )
            hasAdjustedWebView = true
            
            // Also listen for orientation changes
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
