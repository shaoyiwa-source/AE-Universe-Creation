import SwiftUI

struct ContentView: View {
    @StateObject private var model = EditorModel()
    @ObservedObject private var settings = AppSettings.shared
    @ObservedObject private var appState = AppState.shared
    @State private var showExport = false
    @State private var recording: RecordingRequest?
    @State private var guide: GuideKind?

    var body: some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                header
                ZStack(alignment: .bottom) {
                    Color.aePaper
                    EditorCanvas(model: model)
                        .padding(.vertical, 12)
                        .padding(.horizontal, 16)
                    if model.selectedID != nil { SelectionBar(model: model).padding(.bottom, 22) }
                }
                .frame(maxHeight: .infinity)
                Rectangle().fill(Color.aeLine).frame(height: 1)
                ScrollView {
                    PanelView(model: model, guide: $guide)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                }
                .frame(height: geo.size.height * 0.38)
                .background(Color.aeBg)
                tabBar
            }
            .fullScreenCover(item: $recording) { request in
                PlayerView(model: model, recording: request) { events in
                    recording = nil
                    model.finishRecording(request, events: events)
                }
            }
        }
        .background(Color.aeBg)
        .overlay(alignment: .bottom) { ToastView(text: model.toast).padding(.bottom, 120) }
        .overlay { if let p = model.exportProgress { ProgressOverlay(progress: p) } }
        .sheet(isPresented: $showExport) {
            ExportSheet(model: model, guide: $guide) { request in
                showExport = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { recording = request }
            }
            .presentationDetents([.large])
        }
        .sheet(item: $guide) { kind in GuideView(kind: kind) }
        .fullScreenCover(isPresented: $appState.showPlayer) {
            PlayerView(model: model, recording: nil, onFinish: { _ in })
        }
        .preferredColorScheme(settings.appearance.scheme)
    }

    // MARK: 標題列

    private var header: some View {
        HStack(spacing: 10) {
            Image("AERings").resizable().scaledToFit().frame(width: 50)
            VStack(alignment: .leading, spacing: 2) {
                Text("動態桌布").font(.aeDisplay(21)).foregroundStyle(Color.aeInk)
                Text("AE UNIVERSE CREATION").font(.system(size: 8.5)).tracking(2.4).foregroundStyle(Color.aeMuted)
            }
            Spacer(minLength: 4)
            Button { model.undo() } label: {
                Image(systemName: "arrow.uturn.backward").frame(width: 36, height: 38)
            }
            .foregroundStyle(Color.aeInk)
            .accessibilityLabel("復原")
            Button("預覽") { model.selectedID = nil; appState.showPlayer = true }
                .buttonStyle(AEButtonStyle())
            Button("匯出") { model.selectedID = nil; showExport = true }
                .buttonStyle(AEButtonStyle(filled: true))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.aeBg)
        .overlay(alignment: .bottom) { Rectangle().fill(Color.aeLine).frame(height: 1) }
    }

    // MARK: 分頁列

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(PanelTab.allCases) { tab in
                Button {
                    model.tab = tab
                    if tab != .edit { model.tool = .select }
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: tab.symbol).font(.system(size: 18, weight: .light))
                        Text(tab.title).font(.system(size: 10.5)).tracking(0.6)
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .foregroundStyle(model.tab == tab ? Color.aeAccent : Color.aeMuted)
                    .overlay(alignment: .top) {
                        if model.tab == tab { Rectangle().fill(Color.aeAccent).frame(width: 22, height: 2) }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 2)
        .background(Color.aeBg)
        .overlay(alignment: .top) { Rectangle().fill(Color.aeLine).frame(height: 1) }
    }
}

/// 選取物件時的小工具列
struct SelectionBar: View {
    @ObservedObject var model: EditorModel

    var body: some View {
        HStack(spacing: 0) {
            bar("minus.magnifyingglass", "縮小") { model.transformSelected(scale: 0.85) }
            bar("plus.magnifyingglass", "放大") { model.transformSelected(scale: 1.18) }
            bar("rotate.left", "左轉") { model.transformSelected(rotate: -.pi / 12) }
            bar("rotate.right", "右轉") { model.transformSelected(rotate: .pi / 12) }
            bar("square.3.layers.3d.top.filled", "移到最上層") { model.bringSelectedToFront() }
            if model.selected?.content.isText == true {
                bar("character.cursor.ibeam", "編輯文字") { model.tab = .edit }
            }
            bar("trash", "刪除", danger: true) { model.deleteSelected() }
        }
        .padding(4)
        .background(Color.aeBg)
        .overlay(Rectangle().stroke(Color.aeLine, lineWidth: 1))
        .shadow(color: .black.opacity(0.15), radius: 10, y: 4)
    }

    private func bar(_ symbol: String, _ label: String, danger: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 15)).frame(width: 38, height: 36)
        }
        .foregroundStyle(danger ? Color.aeDanger : Color.aeInk)
        .accessibilityLabel(label)
    }
}

struct ToastView: View {
    let text: String?
    var body: some View {
        if let text {
            Text(text)
                .font(.system(size: 13)).tracking(0.4)
                .padding(.horizontal, 18).padding(.vertical, 10)
                .foregroundStyle(Color.aeOnAccent)
                .background(Color.aeAccent)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
                .allowsHitTesting(false)
        }
    }
}

struct ProgressOverlay: View {
    let progress: Double
    var body: some View {
        ZStack {
            Color.black.opacity(0.4).ignoresSafeArea()
            VStack(spacing: 14) {
                Text("製作中").font(.aeDisplay(26)).foregroundStyle(Color.aeInk)
                ProgressView(value: progress).tint(Color.aeAccent).frame(width: 200)
                Text("\(Int(progress * 100))%").font(.aeSmall).foregroundStyle(Color.aeMuted)
            }
            .padding(28)
            .background(Color.aeBg)
            .overlay(Rectangle().stroke(Color.aeLine))
        }
    }
}
