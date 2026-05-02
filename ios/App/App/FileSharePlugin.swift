import Foundation
import UIKit
import Capacitor

/**
 * Presents the system share sheet for a file URL from Capacitor Filesystem (cache, etc.).
 * The stock @capacitor/share plugin rejects the promise when the user dismisses the sheet
 * ("Share canceled") and can mishandle file URIs; this matches Android FileSharePlugin behavior.
 */
@objc(FileSharePlugin)
public class FileSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FileSharePlugin"
    public let jsName = "FileShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareStream", returnType: CAPPluginReturnPromise),
    ]

    @objc func shareStream(_ call: CAPPluginCall) {
        guard let uriString = call.getString("uri"), !uriString.isEmpty else {
            call.reject("uri is required")
            return
        }

        guard let fileURL = Self.resolveFileURL(from: uriString) else {
            call.reject("Could not resolve file URL from uri")
            return
        }

        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            call.reject("File does not exist at path")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let strongSelf = self else {
                call.reject("plugin deallocated")
                return
            }

            if strongSelf.bridge?.viewController?.presentedViewController != nil {
                call.reject("Can't share while another share is in progress")
                return
            }

            let activity = UIActivityViewController(
                activityItems: [fileURL],
                applicationActivities: nil
            )

            activity.completionWithItemsHandler = { _, _, _, activityError in
                if let activityError = activityError {
                    call.reject("Error sharing", nil, activityError)
                    return
                }
                call.resolve()
            }

            strongSelf.setCenteredPopover(activity)
            strongSelf.bridge?.viewController?.present(activity, animated: true, completion: nil)
        }
    }

    private static func resolveFileURL(from uriString: String) -> URL? {
        if let url = URL(string: uriString), url.isFileURL {
            return url
        }
        if let url = URL(string: uriString), url.scheme?.lowercased() == "file" {
            return URL(fileURLWithPath: url.path)
        }
        if uriString.hasPrefix("/") {
            return URL(fileURLWithPath: uriString)
        }
        return nil
    }
}
