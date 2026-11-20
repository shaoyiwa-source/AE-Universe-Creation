import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct PanelView: View {
    @ObservedObject var model: EditorModel
    @Binding var guide: GuideKind?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            switch model.tab {
            case .photo: PhotoPanel(model: model)
            case .edit: EditPanel(model: model)
            case .comp: ComponentPanel(model: model)
            case .filter: FilterPanel(model: model)
            case .theme: ThemePanel(model: model)
            case .music: MusicPanel(model: model)
            case .settings: SettingsPanel(model: model, guide: $guide)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// 載入相簿選到的圖片
private func loadImage(_ item: PhotosPickerItem?) async -> UIImage? {
    guard let item, let data = try? await item.loadTransferable(type: Data.self) else { return nil }
    return UIImage(data: data)
}

// MARK: - 桌布

struct PhotoPanel: View {
    @ObservedObject var model: EditorModel
    @State private var pick: PhotosPickerItem?
    @State private var deleting: GalleryItem?

    var body: some View {
        AESectionTitle(title: "桌布照片", note: model.scene.baseImageFile == nil ? "目前使用預設底圖" : "已匯入照片")
        HStack(spacing: 8) {
            PhotosPicker(selection: $pick, matching: .images) { Text("匯入照片") }
                .buttonStyle(AEButtonStyle(filled: true))
            Button("預設底圖") { model.setBase(nil) }.buttonStyle(AEButtonStyle())
        }
        .onChange(of: pick) { _, item in
            Task { if let img = await loadImage(item) { model.setBase(img) }; pick = nil }
        }
        AEHint("建議使用直式照片，會自動裁成 iPhone 全螢幕比例（1080×2340）。")

        AESectionTitle(title: "我的桌布收藏", note: "\(model.gallery.count) 張・輪播用").padding(.top, 8)
        let rotation = AppSettings.shared.rotation(count: model.gallery.count)
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
            ForEach(Array(model.gallery.enumerated()), id: \.element.id) { index, item in
                Button { model.loadFromGallery(item) } label: {
                    ZStack(alignment: .bottom) {
                        Color.aePaper
                        if let img = AssetStore.shared.image(named: item.thumbFile) {
                            Image(uiImage: img).resizable().scaledToFill()
                        }
                        if rotation?.index == index {
                            Text("目前").font(.system(size: 10)).tracking(1.5).frame(maxWidth: .infinity)
                                .padding(.vertical, 2).background(Color.aeAccent).foregroundStyle(Color.aeOnAccent)
                        }
                    }
                    .aspectRatio(Canvas2340.width / Canvas2340.height, contentMode: .fit)
                    .clipped()
                    .overlay(Rectangle().stroke(rotation?.index == index ? Color.aeAccent : Color.aeLine,
                                                lineWidth: rotation?.index == index ? 2 : 1))
                }
                .buttonStyle(.plain)
                .contextMenu { Button("刪除", role: .destructive) { deleting = item } }
                .overlay(alignment: .topTrailing) {
                    Button { deleting = item } label: {
                        Image(systemName: "xmark").font(.system(size: 9, weight: .bold)).frame(width: 22, height: 22)
                            .background(Color.aeBg).foregroundStyle(Color.aeInk)
                    }
                    .padding(3)
                    .accessibilityLabel("刪除")
                }
            }
        }
        Button("把目前作品存進收藏") { model.saveToGallery() }.buttonStyle(AEButtonStyle(fullWidth: true))
        AEHint("點收藏縮圖可載入編輯。在「設定」開啟自動更換後，互動模式會依頻率輪流顯示收藏的桌布。")
            .confirmationDialog("要刪除這張收藏的桌布嗎？", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                                titleVisibility: .visible) {
                Button("刪除", role: .destructive) { if let d = deleting { model.deleteFromGallery(d) }; deleting = nil }
            }
    }
}

// MARK: - 編輯

private let symbols: [(String, String)] = [
    ("❤️", "愛心"), ("🌙", "月亮"), ("☀️", "太陽"), ("⭐", "星星"), ("♾️", "無限"), ("🌸", "花"),
    ("🌳", "樹"), ("🐦", "鳥"), ("🐟", "魚"), ("🐶", "狗"), ("🐱", "貓"), ("🌈", "彩虹"),
    ("☁️", "雲"), ("🍀", "幸運草"), ("🦋", "蝴蝶"), ("🐰", "兔兔"), ("🍓", "草莓"), ("🎀", "蝴蝶結"),
    ("✨", "閃亮"), ("💖", "心心"), ("🌷", "鬱金香"), ("🐻", "熊熊"), ("🍰", "蛋糕"), ("🪐", "星球"),
]

struct ColorRow: View {
    let selected: RGBA
    let onPick: (RGBA) -> Void
    var body: some View {
        HStack(spacing: 8) {
            ForEach(RGBA.palette, id: \.self) { c in
                Button { onPick(c) } label: {
                    Circle().fill(c.color).frame(width: 26, height: 26)
                        .overlay(Circle().stroke(Color.aeBg, lineWidth: 2))
                        .overlay(Circle().stroke(c == selected ? Color.aeAccent : Color.aeLine, lineWidth: c == selected ? 2 : 1).padding(-2))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct EditPanel: View {
    @ObservedObject var model: EditorModel
    @State private var text = ""
    @State private var pick: PhotosPickerItem?
    @State private var confirmClear = false

    private var selectedText: String? {
        if let sel = model.selected, case .text(let t, _) = sel.content { return t }
        return nil
    }

    var body: some View {
        AESectionTitle(title: "編輯工具", note: model.tool == .select ? "點選物件可移動・雙指縮放旋轉" : "在畫面上直接畫")
        HStack(spacing: 8) {
            AEChip(title: "選取移動", selected: model.tool == .select) { model.tool = .select }
            AEChip(title: "手寫字", selected: model.tool == .pen) { model.tool = .pen; model.selectedID = nil }
            AEChip(title: "手畫光紋", selected: model.tool == .glow) { model.tool = .glow; model.selectedID = nil }
        }
        if model.tool != .select {
            ColorRow(selected: model.penColor) { model.penColor = $0 }
            HStack {
                Text("筆刷粗細").font(.aeSmall).foregroundStyle(Color.aeMuted)
                Slider(value: $model.penSize, in: 4...48).tint(Color.aeAccent)
            }
        }

        AESectionTitle(title: "文字方塊").padding(.top, 6)
        TextField("輸入想寫的字，例如：今天也要開心 ♡", text: $text, axis: .vertical)
            .lineLimit(1...3)
            .padding(10)
            .overlay(Rectangle().stroke(Color.aeLine))
            .onAppear { if let t = selectedText { text = t } }
            .onChange(of: model.selectedID) { _, _ in if let t = selectedText { text = t } }
        ColorRow(selected: model.textColor) { model.setTextColor($0) }
        Button(selectedText == nil ? "＋ 加入文字" : "更新文字") { model.setText(text) }
            .buttonStyle(AEButtonStyle(filled: true))

        AESectionTitle(title: "可愛小符號").padding(.top, 6)
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 48), spacing: 1)], spacing: 1) {
            ForEach(symbols, id: \.0) { pair in
                Button { model.add(.emoji(pair.0), scale: 1.6) } label: {
                    VStack(spacing: 0) {
                        Text(pair.0).font(.system(size: 24))
                        Text(pair.1).font(.system(size: 9)).foregroundStyle(Color.aeMuted)
                    }
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(Color.aeBg)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(pair.1)
            }
        }
        .background(Color.aeLine)
        .overlay(Rectangle().stroke(Color.aeLine))

        HStack(spacing: 8) {
            PhotosPicker(selection: $pick, matching: .images) { Text("匯入可愛圖片") }
                .buttonStyle(AEButtonStyle())
            Button("清除全部編輯") { confirmClear = true }.buttonStyle(AEButtonStyle())
        }
        .onChange(of: pick) { _, item in
            Task { if let img = await loadImage(item) { model.addSticker(img) }; pick = nil }
        }
        .confirmationDialog("要清除畫面上全部的文字、符號、筆畫與元件嗎？（可按復原）", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("全部清除", role: .destructive) { model.clearAll() }
        }
    }
}

// MARK: - 元件

struct ComponentPreview: View {
    let kind: ComponentKind
    var body: some View {
        TimelineView(.animation) { tl in
            Canvas { ctx, size in
                var c = ctx
                c.translateBy(x: size.width / 2, y: size.height / 2 + 4)
                let s = size.width / 290
                c.scaleBy(x: s, y: s)
                Components.draw(kind, in: c, t: tl.date.timeIntervalSinceReferenceDate, seed: 0.3, tap: 0, tapAge: 99, emit: nil)
            }
        }
        .background(LinearGradient(colors: [Color(hex: 0xFFF0F7), Color(hex: 0xE8F2FF)], startPoint: .top, endPoint: .bottom))
        .aspectRatio(1, contentMode: .fit)
    }
}

struct ComponentPanel: View {
    @ObservedObject var model: EditorModel
    @ObservedObject private var settings = AppSettings.shared

    var body: some View {
        AESectionTitle(title: "動態可愛元件", note: "點一下加到桌布")
        HStack(spacing: 10) {
            ForEach(ComponentKind.allCases) { kind in
                Button { model.add(.component(kind), scale: 1.4) } label: {
                    VStack(spacing: 6) {
                        ComponentPreview(kind: kind)
                        Text(kind.name).font(.system(size: 13)).foregroundStyle(Color.aeInk)
                        Text(kind.detail).font(.system(size: 10.5)).foregroundStyle(Color.aeMuted)
                    }
                    .padding(6)
                    .overlay(Rectangle().stroke(Color.aeLine))
                }
                .buttonStyle(.plain)
            }
        }
        AESectionTitle(title: "元件聲音", note: "點元件時播放").padding(.top, 6)
        ForEach(ComponentKind.allCases) { kind in
            HStack(spacing: 8) {
                Text(kind.name).font(.aeSmall).foregroundStyle(Color.aeMuted).frame(width: 60, alignment: .leading)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(SoundID.allCases) { sound in
                            AEChip(title: sound.name, selected: settings.sound(for: kind) == sound) {
                                settings.compSounds[kind] = sound
                                SoundEngine.shared.play(sound)
                            }
                        }
                    }
                }
            }
        }
        AEHint("在畫面上點一下元件就能看它動、聽它叫；拖曳可移動，雙指可縮放旋轉。")
    }
}

// MARK: - 濾鏡

struct FilterPanel: View {
    @ObservedObject var model: EditorModel

    var body: some View {
        AESectionTitle(title: "濾鏡", note: "會動的動態濾鏡")
        HStack(spacing: 8) {
            ForEach(FilterID.allCases) { f in
                Button { model.pushUndo(); model.scene.filter = f } label: {
                    VStack(spacing: 5) {
                        Group {
                            if let img = model.thumb(for: f) { Image(uiImage: img).resizable().scaledToFill() } else { Color.aePaper }
                        }
                        .frame(height: 110).frame(maxWidth: .infinity).clipped()
                        Text(f.name).font(.system(size: 12.5)).foregroundStyle(Color.aeInk)
                        Text(f.detail).font(.system(size: 10)).foregroundStyle(Color.aeMuted).multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(5)
                    .overlay(Rectangle().stroke(model.scene.filter == f ? Color.aeAccent : Color.aeLine, lineWidth: model.scene.filter == f ? 2 : 1))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - 主題

struct ThemePanel: View {
    @ObservedObject var model: EditorModel

    var body: some View {
        AESectionTitle(title: "動態桌面主題")
        HStack(spacing: 8) {
            ForEach(ThemeID.allCases) { theme in
                Button { model.pushUndo(); model.scene.theme = theme } label: {
                    VStack(spacing: 5) {
                        LinearGradient(colors: theme.swatch, startPoint: .topLeading, endPoint: .bottomTrailing)
                            .frame(height: 80)
                        Text(theme.name).font(.system(size: 12.5)).foregroundStyle(Color.aeInk)
                        Text(theme.detail).font(.system(size: 10)).foregroundStyle(Color.aeMuted).multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(5)
                    .overlay(Rectangle().stroke(model.scene.theme == theme ? Color.aeAccent : Color.aeLine, lineWidth: model.scene.theme == theme ? 2 : 1))
                }
                .buttonStyle(.plain)
            }
        }
        HStack {
            Text("效果強度").font(.aeSmall).foregroundStyle(Color.aeMuted)
            Slider(value: $model.scene.intensity, in: 0.1...1).tint(Color.aeAccent)
        }
        AEHint("匯入音樂並播放時，雷射、風、星光會跟著音樂的節奏變化。")
    }
}

// MARK: - 音樂

struct MusicPanel: View {
    @ObservedObject var model: EditorModel
    @ObservedObject private var settings = AppSettings.shared
    @State private var importing = false

    var body: some View {
        AESectionTitle(title: "背景音樂")
        if !model.musicName.isEmpty {
            HStack(spacing: 12) {
                Image(systemName: model.musicPlaying ? "waveform" : "music.note").foregroundStyle(Color.aeAccent)
                Text(model.musicName).font(.aeDisplay(19)).foregroundStyle(Color.aeInk).lineLimit(1)
                Spacer()
                Button(model.musicPlaying ? "暫停" : "播放") { model.toggleMusic() }.buttonStyle(AEButtonStyle(filled: true))
            }
            .padding(10)
            .background(Color.aePaper)
            .overlay(Rectangle().stroke(Color.aeLine))
        } else {
            AEHint("還沒有音樂。匯入一首歌，動態主題會跟著節奏閃動！")
        }
        Button(model.musicName.isEmpty ? "匯入音樂" : "換一首") { importing = true }
            .buttonStyle(AEButtonStyle(filled: model.musicName.isEmpty))
            .fileImporter(isPresented: $importing, allowedContentTypes: [.audio]) { result in
                if case .success(let url) = result { model.importMusic(url) }
            }
        HStack {
            Text("音樂音量").font(.aeSmall).foregroundStyle(Color.aeMuted).frame(width: 60, alignment: .leading)
            Slider(value: $settings.musicVolume, in: 0...1).tint(Color.aeAccent)
        }
        AESectionTitle(title: "可愛音效").padding(.top, 6)
        HStack(spacing: 8) {
            ForEach(SoundID.playable) { s in AEChip(title: s.name, selected: false) { SoundEngine.shared.play(s) } }
        }
        HStack {
            Text("音效音量").font(.aeSmall).foregroundStyle(Color.aeMuted).frame(width: 60, alignment: .leading)
            Slider(value: $settings.sfxVolume, in: 0...1).tint(Color.aeAccent)
        }
        AEHint("支援 mp3、m4a、wav 等格式（從「檔案」App 選取）。錄製影片時，音樂與音效會一起錄進去。")
    }
}

// MARK: - 設定

struct SettingsPanel: View {
    @ObservedObject var model: EditorModel
    @Binding var guide: GuideKind?
    @ObservedObject private var settings = AppSettings.shared

    var body: some View {
        AESectionTitle(title: "使用者互動模式")
        toggle("點元件互動", "點可愛元件會跳動並發出聲音", $settings.componentTap)
        toggle("觸碰特效", "點畫面任何地方會噴出星星", $settings.touchFx)
        toggle("顯示互動按鈕", "互動模式右下角的 AE 按鈕（隱藏後長按畫面可叫回）", $settings.showFab)
        toggle("預覽鎖定畫面時鐘", "互動模式中顯示時間，方便對照版面", $settings.showClock)
        Button("設定鎖定畫面按鈕「AE互動」") { guide = .lockScreen }.buttonStyle(AEButtonStyle(filled: true, fullWidth: true))

        AESectionTitle(title: "桌布更新頻率").padding(.top, 10)
        toggle("自動更換桌布", "從「我的桌布收藏」依序輪播", $settings.rotateOn)
        HStack(spacing: 10) {
            Text("每").font(.aeBody)
            Stepper(value: $settings.rotateEvery, in: 1...99) {
                Text("\(settings.rotateEvery)").font(.aeDisplay(22)).frame(minWidth: 30)
            }
            .fixedSize()
            Picker("單位", selection: $settings.rotateInDays) {
                Text("小時").tag(false)
                Text("天").tag(true)
            }
            .pickerStyle(.segmented)
            .frame(width: 110)
            Text("更新一次").font(.aeBody)
        }
        AEHint(rotationText)
        Button("讓 iPhone 系統桌布也自動更換") { guide = .rotation }.buttonStyle(AEButtonStyle(fullWidth: true))

        AESectionTitle(title: "一鍵設為桌布").padding(.top, 10)
        Button("建立「\(ShortcutInfo.name)」捷徑") { guide = .shortcut }.buttonStyle(AEButtonStyle(fullWidth: true))

        AESectionTitle(title: "外觀").padding(.top, 10)
        Picker("外觀", selection: $settings.appearance) {
            ForEach(Appearance.allCases) { Text($0.name).tag($0) }
        }
        .pickerStyle(.segmented)
    }

    private var rotationText: String {
        guard settings.rotateOn else { return "開啟後才會輪播。" }
        guard let rot = settings.rotation(count: model.gallery.count) else { return "收藏裡還沒有桌布，先到「桌布」分頁存幾張吧。" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "zh_TW")
        f.dateFormat = "M/d HH:mm"
        return "目前顯示第 \(rot.index + 1) / \(model.gallery.count) 張・下次更新：\(f.string(from: rot.next))"
    }

    private func toggle(_ title: String, _ detail: String, _ value: Binding<Bool>) -> some View {
        VStack(spacing: 0) {
            Toggle(isOn: value) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 14.5)).foregroundStyle(Color.aeInk)
                    Text(detail).font(.aeSmall).foregroundStyle(Color.aeMuted)
                }
            }
            .tint(Color.aeAccent)
            .padding(.vertical, 8)
            Rectangle().fill(Color.aeLine).frame(height: 1)
        }
    }
}
