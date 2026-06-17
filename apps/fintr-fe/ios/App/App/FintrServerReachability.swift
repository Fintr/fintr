import Foundation

enum FintrServerReachability {
    private static let defaultTimeout: TimeInterval = 8

    static func check(
        _ serverURL: URL,
        timeout: TimeInterval = defaultTimeout,
        completion: @escaping (Bool) -> Void
    ) {
        var headRequest = URLRequest(url: serverURL)
        headRequest.httpMethod = "HEAD"
        headRequest.timeoutInterval = timeout
        headRequest.cachePolicy = .reloadIgnoringLocalCacheData

        let session = URLSession(configuration: .ephemeral)
        session.dataTask(with: headRequest) { _, response, error in
            if let httpResponse = response as? HTTPURLResponse,
               (200..<500).contains(httpResponse.statusCode),
               error == nil {
                completion(true)
                return
            }

            var getRequest = URLRequest(url: serverURL)
            getRequest.httpMethod = "GET"
            getRequest.timeoutInterval = timeout
            getRequest.cachePolicy = .reloadIgnoringLocalCacheData

            session.dataTask(with: getRequest) { _, response, error in
                let reachable = (response as? HTTPURLResponse).map { (200..<500).contains($0.statusCode) } ?? false
                completion(reachable && error == nil)
            }.resume()
        }.resume()
    }
}
