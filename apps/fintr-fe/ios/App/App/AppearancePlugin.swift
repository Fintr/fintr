import UIKit
import Capacitor

@objc(AppearancePlugin)
public class AppearancePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppearancePlugin"
    public let jsName = "Appearance"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setAppearance", returnType: CAPPluginReturnPromise),
    ]

    @objc func setAppearance(_ call: CAPPluginCall) {
        let theme = call.getString("theme") ?? "dark"
        let isLight = theme == "light"

        DispatchQueue.main.async { [weak self] in
            let window = AppDelegate.keyWindow()
            window?.overrideUserInterfaceStyle = isLight ? .light : .dark
            window?.backgroundColor = isLight
                ? UIColor(red: 0.98, green: 0.98, blue: 0.973, alpha: 1.0)
                : UIColor(red: 0.082, green: 0.098, blue: 0.129, alpha: 1.0)

            if let viewController = self?.bridge?.viewController {
                viewController.setNeedsStatusBarAppearanceUpdate()
                if #available(iOS 13.0, *) {
                    viewController.overrideUserInterfaceStyle = isLight ? .light : .dark
                }
            }

            call.resolve()
        }
    }
}
