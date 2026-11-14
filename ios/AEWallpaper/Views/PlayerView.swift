import SwiftUI
import Combine

/// 互動模式（全螢幕）。recording 不為 nil 時是「錄影模式」：記下互動，時間到交給匯出。
struct PlayerView: View {
    @ObservedObject var model: EditorModel
    let recording: RecordingRequest?
    let onFinish: ([RecordedEvent]) -> Void

    @ObservedObject private var settings = AppSettings.shared
    @Environment(\.dismiss) private var dismiss
    @State private var engine = SceneEngine()
    @State private var rotIndex: Int?
    @State private var menuOpen = false
    @State private var fabPeek = false
    @State private var toast: String?
    @State private var events: [RecordedEvent] = []
    @State private var startTime = nowTime()
    @State private var remaining = 0
    @State private var finished = false

    private let tick = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        GeometryReader { geo in
            let k = max(geo.size.width / Canvas2340.width, geo.size.height / Canvas2340.height)
            let ox = (geo.size.width - Canvas2340.width * k) / 2
            let oy = (geo.size.height - Canvas2340.height * k) / 2
            TimelineView(.animation) { tl in
                Canvas(opaque: true) { ctx, _ in
                    var c = ctx
                    c.translateBy(x: ox, y: oy)
                    c.scaleBy(x: k, y: k)
                    engine.render(in: c, time: tl.date.timeIntervalSinceReferenceDate)
                }
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onEnded { v in
                handleTap(CGPoint(x: (v.location.x - ox) / k, y: (v.location.y - oy) / k))
            })
            .simultaneousGesture(LongPressGesture(minimumDuration: 0.9).onEnded { _ in
                if !settings.showFab && recording == nil { fabPeek = true; show("互動按鈕暫時出現囉") }
            })
        }
        .ignoresSafeArea()
        .background(Color.black)
        .overlay(alignment: .top) { if settings.showClock && recording == nil { LockClock().padding(.top, 70) } }
        .overlay(alignment: .top) {
            if recording != nil {
                HStack(spacing: 8) {
                    Circle().fill(Color.red).frame(width: 9, height: 9)
                    Text("錄製中 \(remaining)s・可以點元件互動").font(.system(size: 13))
                }
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(Color.black.opacity(0.55)).foregroundStyle(.white)
                .padding(.top, 60)
            }
        }
        .overlay(alignment: .bottomTrailing) { if recording == nil && (settings.showFab || fabPeek) { fab } }
        .overlay(alignment: .bottom) { ToastView(text: toast).padding(.bottom, 140) }
        .statusBarHidden(recording != nil)
        .onAppear(perform: setUp)
        .onReceive(tick) { _ in onTick() }
    }

    // MARK: 互動按鈕

    private var fab: some View {
        VStack(alignment: .trailing, spacing: 12) {
            if menuOpen {
                VStack(spacing: 0) {
                    menuItem("換主題") { nextTheme() }
                    menuItem(model.musicPlaying ? "音樂暫停" : "音樂播放") { model.toggleMusic(); if model.musicName.isEmpty { show("先到「音樂」匯入音樂喔") } }
                    menuItem(settings.showClock ? "隱藏鎖定畫面時鐘" : "顯示鎖定畫面時鐘") { settings.showClock.toggle() }
                    menuItem("隱藏互動按鈕") { settings.showFab = false; fabPeek = false; menuOpen = false; show("已隱藏，長按畫面可叫回") }
                    menuItem("離開互動模式") { dismiss() }
                }
                .frame(width: 220)
                .background(Color.aeBg)
                .overlay(Rectangle().stroke(Color.aeLine))
                .shadow(color: .black.opacity(0.3), radius: 16, y: 6)
            }
            Button { menuOpen.toggle() } label: {
                Image("AERings").resizable().scaledToFit().padding(11)
                    .frame(width: 62, height: 62)
                    .background(.ultraThinMaterial, in: Circle())
                    .overlay(Circle().stroke(Color.white.opacity(0.7), lineWidth: 1))
                    .shadow(color: .black.opacity(0.3), radius: 12, y: 4)
            }
            .accessibilityLabel("AE 互動按鈕")
        }
        .padding(.trailing, 22)
        .padding(.bottom, 34)
    }

    private func menuItem(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.system(size: 14)).frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16).padding(.vertical, 13)
                .foregroundStyle(Color.aeInk)
                .overlay(alignment: .bottom) { Rectangle().fill(Color.aeLine).frame(height: 1) }
        }
        .buttonStyle(.plain)
    }

    // MARK: 邏輯

    private func setUp() {
        if let recording {
            engine.setScene(model.scene)
            startTime = nowTime()
            remaining = Int(recording.duration)
            DispatchQueue.main.asyncAfter(deadline: .now() + recording.duration) { finish() }
        } else {
            let (scene, index) = model.playerScene()
            rotIndex = index
            engine.setScene(scene)
            if settings.componentTap || settings.touchFx { show("點點看畫面上的元件") }
        }
        model.refreshMusic()
    }

    private func onTick() {
        if recording != nil {
            remaining = max(0, remaining - 1)
            return
        }
        if let rot = settings.rotation(count: model.gallery.count), rot.index != rotIndex {
            rotIndex = rot.index
            engine.setScene(model.gallery[rot.index].scene)
            show("桌布已依頻率更新")
        }
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        onFinish(events)
    }

    private func handleTap(_ p: CGPoint) {
        if menuOpen { menuOpen = false; return }
        let t = nowTime()
        if let hit = engine.hitTest(p), settings.componentTap || recording != nil {
            let sound = engine.tap(hit, at: t)
            SoundEngine.shared.play(sound)
            if recording != nil { events.append(RecordedEvent(time: t - startTime, kind: .tap(hit.id), sound: sound)) }
        } else if settings.touchFx || recording != nil {
            engine.sparkle(at: p)
            if recording != nil { events.append(RecordedEvent(time: t - startTime, kind: .sparkle(p), sound: .none)) }
        }
    }

    private func nextTheme() {
        var scene = engine.scene
        let all = ThemeID.allCases
        scene.theme = all[((all.firstIndex(of: scene.theme) ?? 0) + 1) % all.count]
        engine.setScene(scene)
        if rotIndex == nil { model.scene.theme = scene.theme }
        show("主題：\(scene.theme.name)")
        menuOpen = false
    }

    private func show(_ text: String) {
        toast = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { if toast == text { toast = nil } }
    }
}

/// 模擬鎖定畫面的時鐘
struct LockClock: View {
    var body: some View {
        TimelineView(.everyMinute) { tl in
            VStack(spacing: 2) {
                Text(tl.date.formatted(.dateTime.month().day().weekday(.wide).locale(Locale(identifier: "zh_TW"))))
                    .font(.system(size: 18, weight: .semibold))
                Text(tl.date.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits)))
                    .font(.system(size: 86, weight: .bold, design: .rounded))
                    .monospacedDigit()
            }
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.25), radius: 10, y: 2)
            .allowsHitTesting(false)
        }
    }
}
