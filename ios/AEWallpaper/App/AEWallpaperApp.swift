import SwiftUI
import AVFoundation

@main
struct AEWallpaperApp: App {
    init() {
        // 讓音效與音樂在靜音開關打開時也能播放
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        _ = SoundEngine.shared
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    // aewallpaper://play —— 鎖定畫面「AE互動」按鈕、捷徑會打開這個網址
                    if url.scheme == "aewallpaper", url.host == "play" {
                        AppState.shared.showPlayer = true
                    }
                }
        }
    }
}

@MainActor
final class AppState: ObservableObject {
    static let shared = AppState()
    @Published var showPlayer = false
}
