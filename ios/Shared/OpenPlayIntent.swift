import AppIntents
import Foundation

/// 鎖定畫面／控制中心的「AE互動」按鈕：打開 App 並直接進入互動模式
@available(iOS 18.0, *)
struct OpenAEPlayIntent: AppIntent {
    static var title: LocalizedStringResource = "打開 AE 互動模式"
    static var description = IntentDescription("打開 AE動態桌布，直接進入全螢幕互動模式。")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(URL(string: "aewallpaper://play")!))
    }
}
