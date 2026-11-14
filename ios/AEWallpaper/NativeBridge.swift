import UIKit
import WebKit
import Photos

/// 網頁 ↔ 原生 的橋接：window.webkit.messageHandlers.ae.postMessage({ action, ... }) 會回傳 Promise
@MainActor
final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate, WKUIDelegate {
    weak var webView: WKWebView?
    private(set) var isLoaded = false

    // MARK: - 訊息

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else {
            replyHandler(nil, "訊息格式錯誤")
            return
        }
        Task { @MainActor in
            do {
                let result = try await self.handle(action: action, body: body)
                replyHandler(result, nil)
            } catch {
                replyHandler(nil, error.localizedDescription)
            }
        }
    }

    private func handle(action: String, body: [String: Any]) async throws -> Any? {
        switch action {
        case "info":
            return ["native": true, "version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] ?? ""]

        case "saveImage":
            let data = try Self.decode(body["data"])
            try await PhotoSaver.saveImage(data)
            return true

        case "saveVideo":
            let data = try Self.decode(body["data"])
            let ext = (body["mime"] as? String)?.contains("mp4") == true ? "mp4" : "mov"
            let url = try Self.writeTemp(data, ext: ext)
            try await PhotoSaver.saveVideo(url)
            return true

        case "saveLivePhoto":
            let image = try Self.decode(body["image"])
            let video = try Self.decode(body["video"])
            let videoURL = try Self.writeTemp(video, ext: "mp4")
            try await LivePhotoMaker.save(imageData: image, videoURL: videoURL)
            return true

        case "setWallpaper":
            // iOS 不允許 App 直接更換桌布：複製圖片後交給使用者的「捷徑」設定
            let data = try Self.decode(body["data"])
            guard let image = UIImage(data: data) else { throw BridgeError.badData }
            UIPasteboard.general.image = image
            let name = (body["shortcut"] as? String) ?? "AE設桌布"
            var comps = URLComponents(string: "shortcuts://run-shortcut")!
            comps.queryItems = [URLQueryItem(name: "name", value: name)]
            guard let url = comps.url, await UIApplication.shared.open(url) else {
                throw BridgeError.message("無法打開「捷徑」App，請確認已安裝並建立「\(name)」捷徑")
            }
            return true

        default:
            throw BridgeError.message("不支援的動作：\(action)")
        }
    }

    // MARK: - 互動模式（鎖定畫面按鈕）

    func enterPlayer() {
        webView?.evaluateJavaScript("window.AE && window.AE.enterPlayer()", completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoaded = true
        if AppState.shared.pendingPlay {
            AppState.shared.pendingPlay = false
            enterPlayer()
        }
    }

    // 外部連結（例如說明頁）用 Safari 打開
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, url.scheme != BundleSchemeHandler.scheme,
           navigationAction.targetFrame?.isMainFrame ?? true,
           url.scheme != "about", url.scheme != "blob", url.scheme != "data" {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // MARK: - alert / confirm（WKWebView 預設不會顯示）

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default) { _ in completionHandler() })
        present(alert, fallback: completionHandler)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "確定", style: .default) { _ in completionHandler(true) })
        present(alert) { completionHandler(false) }
    }

    private func present(_ alert: UIAlertController, fallback: @escaping () -> Void) {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        guard var top = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            fallback()
            return
        }
        while let presented = top.presentedViewController { top = presented }
        top.present(alert, animated: true)
    }

    // MARK: - 工具

    private static func decode(_ value: Any?) throws -> Data {
        guard let base64 = value as? String, let data = Data(base64Encoded: base64) else { throw BridgeError.badData }
        return data
    }

    private static func writeTemp(_ data: Data, ext: String) throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(ext)
        try data.write(to: url)
        return url
    }
}

enum BridgeError: LocalizedError {
    case badData
    case message(String)

    var errorDescription: String? {
        switch self {
        case .badData: return "檔案資料錯誤"
        case .message(let text): return text
        }
    }
}
