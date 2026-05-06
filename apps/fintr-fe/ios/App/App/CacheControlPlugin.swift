import Foundation
import Capacitor
import WebKit

@objc(CacheControlPlugin)
public class CacheControlPlugin: CAPPlugin {

    @objc func clearCacheAndReload(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            // Clear WKWebView data stores (caches, cookies, etc.)
            let dataStore = WKWebsiteDataStore.default()
            let dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
            let date = Date(timeIntervalSince1970: 0)

            dataStore.removeData(
                ofTypes: dataTypes,
                modifiedSince: date
            ) { [weak self] in
                // Completion may run on a background queue; UI and bridge must run on main
                DispatchQueue.main.async {
                    // Clear URL cache used by the app
                    URLCache.shared.removeAllCachedResponses()

                    // Reload the WebView (must be on main thread)
                    if let webView = self?.bridge?.webView {
                        webView.reload()
                    }

                    call.resolve()
                }
            }
        }
    }
}
