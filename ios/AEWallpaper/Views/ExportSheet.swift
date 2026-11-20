import SwiftUI

struct ExportSheet: View {
    @ObservedObject var model: EditorModel
    @Binding var guide: GuideKind?
    let startRecording: (RecordingRequest) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var duration: Double = 10
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("匯出桌布").font(.aeDisplay(32)).foregroundStyle(Color.aeInk)
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").frame(width: 36, height: 36).overlay(Rectangle().stroke(Color.aeLine))
                    }
                    .foregroundStyle(Color.aeInk)
                    .accessibilityLabel("關閉")
                }

                AEEyebrow("一鍵設為 iPhone 桌布")
                AEHint("透過「捷徑」直接把目前畫面設成桌布。第一次使用要先建立「\(ShortcutInfo.name)」捷徑。")
                HStack(spacing: 8) {
                    Button("設為桌布") { model.setAsWallpaper() }.buttonStyle(AEButtonStyle(filled: true))
                    Button("第一次使用？建立捷徑") { guide = .shortcut }.buttonStyle(AEButtonStyle())
                }

                AEEyebrow("原況照片（Live Photo）")
                AEHint("錄製 3 秒，直接存成原況照片。到 設定 → 背景圖片 選用後，鎖定畫面就會動。錄製時可以點元件互動。")
                Button("製作原況照片") {
                    startRecording(RecordingRequest(duration: 3, livePhoto: true, includeMusic: false))
                }
                .buttonStyle(AEButtonStyle(filled: true))

                AEEyebrow("靜態桌布（PNG）")
                AEHint("1080×2340 高畫質，存到「照片」。")
                Button(busy ? "產生中…" : "存靜態桌布") {
                    busy = true
                    Task { await model.saveStill(); busy = false }
                }
                .buttonStyle(AEButtonStyle(filled: true))
                .disabled(busy)

                AEEyebrow("動態桌布影片（含音樂與音效）")
                HStack(spacing: 8) {
                    ForEach([5.0, 10, 15], id: \.self) { s in
                        AEChip(title: "\(Int(s)) 秒", selected: duration == s) { duration = s }
                    }
                }
                Button("● 開始錄製") {
                    startRecording(RecordingRequest(duration: duration, livePhoto: false,
                                                    includeMusic: SoundEngine.shared.isMusicPlaying))
                }
                .buttonStyle(AEButtonStyle(filled: true))
                AEHint("錄製時可以點畫面上的元件，互動和聲音都會被錄進去。")

                AEEyebrow("我的桌布收藏")
                Button("存進收藏") { model.saveToGallery() }.buttonStyle(AEButtonStyle())

                AENote("設定原況照片桌布：設定 → 背景圖片 →「＋ 新增背景圖片」→ 照片 → 選剛存好的原況照片。\n系統桌布不能點擊互動；想玩互動時，按鎖定畫面的「AE互動」按鈕進入 App。")
                    .padding(.top, 12)
            }
            .padding(20)
        }
        .background(Color.aeBg)
    }
}
