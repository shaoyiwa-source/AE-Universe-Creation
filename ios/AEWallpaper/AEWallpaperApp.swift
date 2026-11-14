import SwiftUI
import AVFoundation

@main
struct AEWallpaperApp: App {
    init() {
        // 讓音效與音樂在靜音開關打開時也能播放
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    var body: some Scene {
        WindowGroup {
            AEWebView()
                .ignoresSafeArea()
                .background(Color("LaunchBackground"))
                .onOpenURL { url in
                    // aewallpaper://play —— 鎖定畫面按鈕、捷徑會打開這個網址
                    if url.scheme == "aewallpaper", url.host == "play" {
                        AppState.shared.requestPlay()
                    }
                }
        }
    }
}

/// 記住「要進入互動模式」的請求，等網頁載入完成再執行
@MainActor
final class AppState {
    static let shared = AppState()
    weak var bridge: NativeBridge?
    var pendingPlay = false

    func requestPlay() {
        if let bridge, bridge.isLoaded {
            bridge.enterPlayer()
        } else {
            pendingPlay = true
        }
    }
}
