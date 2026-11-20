import SwiftUI
import UIKit

enum EditTool: String { case select, pen, glow }

enum PanelTab: String, CaseIterable, Identifiable {
    case photo, edit, comp, filter, theme, music, settings
    var id: String { rawValue }
    var title: String {
        switch self {
        case .photo: return "桌布"
        case .edit: return "編輯"
        case .comp: return "元件"
        case .filter: return "濾鏡"
        case .theme: return "主題"
        case .music: return "音樂"
        case .settings: return "設定"
        }
    }
    var symbol: String {
        switch self {
        case .photo: return "photo"
        case .edit: return "pencil.tip"
        case .comp: return "face.smiling"
        case .filter: return "camera.filters"
        case .theme: return "sparkles"
        case .music: return "music.note"
        case .settings: return "slider.horizontal.3"
        }
    }
}

/// 錄影請求（原況照片或影片）
struct RecordingRequest: Identifiable {
    let id = UUID()
    var duration: Double
    var livePhoto: Bool
    var includeMusic: Bool
}

func nowTime() -> Double { Date().timeIntervalSinceReferenceDate }

/// 編輯器的狀態與動作
@MainActor
final class EditorModel: ObservableObject {
    @Published var scene: WallpaperScene {
        didSet {
            engine.setScene(scene)
            scheduleSave()
            if oldValue.baseImageFile != scene.baseImageFile { filterThumbs = [:] }
        }
    }
    @Published var selectedID: UUID?
    @Published var tool: EditTool = .select
    @Published var tab: PanelTab = .photo
    @Published var penColor = RGBA.palette[0]
    @Published var penSize: CGFloat = 16
    @Published var textColor = RGBA.palette[0]
    @Published var draft: SceneItem?
    @Published var gallery: [GalleryItem] = []
    @Published var toast: String?
    @Published var exportProgress: Double?
    @Published var musicPlaying = false
    @Published var musicName = ""
    @Published var filterThumbs: [FilterID: UIImage] = [:]

    let engine = SceneEngine()
    private var undoStack: [WallpaperScene] = []
    private var saveTask: Task<Void, Never>?
    private var toastTask: Task<Void, Never>?

    init() {
        scene = AssetStore.shared.loadCurrent() ?? .demo
        engine.setScene(scene)
        gallery = AssetStore.shared.loadGallery()
        let settings = AppSettings.shared
        SoundEngine.shared.sfxVolume = Float(settings.sfxVolume)
        SoundEngine.shared.musicVolume = Float(settings.musicVolume)
        if let url = AssetStore.shared.savedMusic, (try? SoundEngine.shared.loadMusic(url)) != nil {
            musicName = SoundEngine.shared.musicName
        }
    }

    var selected: SceneItem? { scene.items.first { $0.id == selectedID } }

    // MARK: 儲存、提示、復原

    private func scheduleSave() {
        saveTask?.cancel()
        let snapshot = scene
        saveTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 600_000_000)
            guard !Task.isCancelled else { return }
            AssetStore.shared.saveCurrent(snapshot)
        }
    }

    func show(_ message: String) {
        toast = message
        toastTask?.cancel()
        toastTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            guard !Task.isCancelled else { return }
            toast = nil
        }
    }

    func pushUndo(_ snapshot: WallpaperScene? = nil) {
        undoStack.append(snapshot ?? scene)
        if undoStack.count > 50 { undoStack.removeFirst() }
    }

    func undo() {
        guard let last = undoStack.popLast() else { show("沒有可以復原的步驟"); return }
        scene = last
        selectedID = nil
    }

    // MARK: 物件

    func add(_ content: ItemContent, scale: CGFloat = 1, at position: CGPoint? = nil) {
        pushUndo()
        let pos = position ?? CGPoint(x: Canvas2340.width / 2 + rndf(-100, 100), y: Canvas2340.height / 2 + rndf(-150, 150))
        let item = SceneItem(content: content, position: pos, scale: scale)
        scene.items.append(item)
        tool = .select
        selectedID = item.id
        if case .component = content { tap(item) }
    }

    func update(_ id: UUID, _ change: (inout SceneItem) -> Void) {
        guard let i = scene.items.firstIndex(where: { $0.id == id }) else { return }
        change(&scene.items[i])
    }

    func transformSelected(scale: CGFloat = 1, rotate: Double = 0) {
        guard let id = selectedID else { return }
        pushUndo()
        update(id) {
            $0.scale = min(6, max(0.2, $0.scale * scale))
            $0.rotation += rotate
        }
    }

    func deleteSelected() {
        guard let id = selectedID else { return }
        pushUndo()
        scene.items.removeAll { $0.id == id }
        selectedID = nil
    }

    func bringSelectedToFront() {
        guard let id = selectedID, let i = scene.items.firstIndex(where: { $0.id == id }) else { return }
        pushUndo()
        let item = scene.items.remove(at: i)
        scene.items.append(item)
    }

    func clearAll() {
        guard !scene.items.isEmpty else { return }
        pushUndo()
        scene.items.removeAll()
        selectedID = nil
    }

    func tap(_ item: SceneItem) {
        let sound = engine.tap(item, at: nowTime())
        SoundEngine.shared.play(sound)
    }

    func commitDraft() {
        guard let draft else { return }
        pushUndo()
        scene.items.append(draft)
        self.draft = nil
    }

    func setText(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { show("先輸入文字喔"); return }
        if let sel = selected, case .text = sel.content {
            pushUndo()
            update(sel.id) { $0.content = .text(trimmed, self.textColor) }
            show("已更新文字")
        } else {
            add(.text(trimmed, textColor), at: CGPoint(x: Canvas2340.width / 2, y: Canvas2340.height * 0.55))
        }
    }

    func setTextColor(_ color: RGBA) {
        textColor = color
        if let sel = selected, case .text(let text, _) = sel.content {
            pushUndo()
            update(sel.id) { $0.content = .text(text, color) }
        }
    }

    // MARK: 圖片

    func setBase(_ image: UIImage?) {
        pushUndo()
        if let image {
            do {
                scene.baseImageFile = try AssetStore.shared.saveImage(Filters.cover(image))
                show("已匯入桌布照片")
            } catch { show("無法儲存這張照片") }
        } else {
            scene.baseImageFile = nil
        }
    }

    func addSticker(_ image: UIImage) {
        let s = min(1, 640 / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * s, height: image.size.height * s)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let small = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        do {
            let file = try AssetStore.shared.saveImage(small, png: true)
            add(.sticker(file), scale: 1.2)
            show("已加入可愛圖片")
        } catch { show("無法儲存這張圖片") }
    }

    func thumb(for filter: FilterID) -> UIImage? {
        if let cached = filterThumbs[filter] { return cached }
        let raw = scene.baseImageFile.flatMap { AssetStore.shared.image(named: $0) } ?? Filters.defaultBackground
        let size = CGSize(width: 120, height: 260)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let small = UIGraphicsImageRenderer(size: size, format: format).image { _ in raw.draw(in: CGRect(origin: .zero, size: size)) }
        let result = Filters.apply(filter, to: small)
        DispatchQueue.main.async { self.filterThumbs[filter] = result }
        return result
    }

    // MARK: 收藏

    func saveToGallery() {
        guard let thumb = Exporter.thumbnail(scene), let file = try? AssetStore.shared.saveImage(thumb) else {
            show("儲存失敗")
            return
        }
        gallery.append(GalleryItem(scene: scene, thumbFile: file))
        AssetStore.shared.saveGallery(gallery)
        show("已存進我的桌布收藏")
    }

    func loadFromGallery(_ item: GalleryItem) {
        pushUndo()
        scene = item.scene
        selectedID = nil
        show("已載入收藏的桌布")
    }

    func deleteFromGallery(_ item: GalleryItem) {
        gallery.removeAll { $0.id == item.id }
        AssetStore.shared.saveGallery(gallery)
    }

    /// 互動模式要顯示的場景（依更新頻率輪播收藏）
    func playerScene() -> (WallpaperScene, Int?) {
        if let rot = AppSettings.shared.rotation(count: gallery.count) {
            return (gallery[rot.index].scene, rot.index)
        }
        return (scene, nil)
    }

    // MARK: 音樂

    func importMusic(_ url: URL) {
        do {
            let local = try AssetStore.shared.importMusic(from: url)
            try SoundEngine.shared.loadMusic(local)
            SoundEngine.shared.playMusic()
            refreshMusic()
            show("♪ \(musicName)")
        } catch {
            show("無法讀取這個音樂檔")
        }
    }

    func toggleMusic() {
        guard SoundEngine.shared.musicFile != nil else { show("先到「音樂」匯入音樂喔"); return }
        SoundEngine.shared.toggleMusic()
        refreshMusic()
    }

    func refreshMusic() {
        musicPlaying = SoundEngine.shared.isMusicPlaying
        musicName = SoundEngine.shared.musicName
    }

    // MARK: 匯出

    func saveStill() async {
        selectedID = nil
        guard let image = Exporter.still(scene), let data = image.pngData() else { show("產生失敗"); return }
        do {
            try await PhotoSaver.saveImage(data)
            show("已存到「照片」")
        } catch { show(error.localizedDescription) }
    }

    func setAsWallpaper() {
        selectedID = nil
        guard let image = Exporter.still(scene) else { show("產生失敗"); return }
        UIPasteboard.general.image = image
        var comps = URLComponents(string: "shortcuts://run-shortcut")!
        comps.queryItems = [URLQueryItem(name: "name", value: ShortcutInfo.name)]
        guard let url = comps.url else { return }
        UIApplication.shared.open(url) { ok in
            if !ok { Task { @MainActor in self.show("無法打開「捷徑」App") } }
        }
    }

    func finishRecording(_ request: RecordingRequest, events: [RecordedEvent]) {
        let snapshot = scene
        exportProgress = 0
        Task { @MainActor in
            do {
                let result = try await Exporter.makeVideo(
                    scene: snapshot, duration: request.duration, events: events,
                    includeAudio: !request.livePhoto, includeMusic: request.includeMusic) { p in
                        self.exportProgress = p
                    }
                if request.livePhoto {
                    guard let still = result.firstFrame?.jpegData(compressionQuality: 0.95) else { throw AEError.badData }
                    try await LivePhotoMaker.save(imageData: still, videoURL: result.url)
                    show("原況照片已存到「照片」")
                } else {
                    try await PhotoSaver.saveVideo(result.url)
                    show("影片已存到「照片」")
                }
            } catch {
                show("匯出失敗：\(error.localizedDescription)")
            }
            exportProgress = nil
        }
    }
}

enum ShortcutInfo {
    static let name = "AE設桌布"
}
