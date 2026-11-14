import SwiftUI
import WidgetKit
import AppIntents

@main
struct AEControlsBundle: WidgetBundle {
    var body: some Widget {
        AEPlayControl()
    }
}

/// iOS 18 控制項：可放在鎖定畫面左下／右下，或控制中心
struct AEPlayControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.aeuniverse.wallpaper.play") {
            ControlWidgetButton(action: OpenAEPlayIntent()) {
                Label("AE互動", systemImage: "sparkles")
            }
        }
        .displayName("AE互動")
        .description("打開 AE動態桌布 的互動模式")
    }
}
