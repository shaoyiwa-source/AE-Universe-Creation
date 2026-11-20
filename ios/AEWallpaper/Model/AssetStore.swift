import UIKit

/// 本機儲存：Documents/AEWallpaper/
///   assets/   底圖與貼圖（以 UUID 命名）
///   current.json   目前編輯中的作品
///   gallery.json   我的桌布收藏
///   music/    匯入的音樂
@MainActor
final class AssetStore {
    static let shared = AssetStore()

    let root: URL
    let assetsDir: URL
    let musicDir: URL
    private var cache: [String: UIImage] = [:]
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        root = docs.appendingPathComponent("AEWallpaper", isDirectory: true)
        assetsDir = root.appendingPathComponent("assets", isDirectory: true)
        musicDir = root.appendingPathComponent("music", isDirectory: true)
        for dir in [root, assetsDir, musicDir] {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
    }

    // MARK: 圖片

    @discardableResult
    func saveImage(_ image: UIImage, png: Bool = false) throws -> String {
        let name = UUID().uuidString + (png ? ".png" : ".jpg")
        guard let data = png ? image.pngData() : image.jpegData(compressionQuality: 0.9) else { throw AEError.badData }
        try data.write(to: assetsDir.appendingPathComponent(name), options: .atomic)
        cache[name] = image
        return name
    }

    func image(named name: String) -> UIImage? {
        if let img = cache[name] { return img }
        guard let img = UIImage(contentsOfFile: assetsDir.appendingPathComponent(name).path) else { return nil }
        cache[name] = img
        return img
    }

    // MARK: 作品

    func loadCurrent() -> WallpaperScene? {
        guard let data = try? Data(contentsOf: root.appendingPathComponent("current.json")) else { return nil }
        return try? decoder.decode(WallpaperScene.self, from: data)
    }

    func saveCurrent(_ scene: WallpaperScene) {
        guard let data = try? encoder.encode(scene) else { return }
        try? data.write(to: root.appendingPathComponent("current.json"), options: .atomic)
    }

    // MARK: 收藏

    func loadGallery() -> [GalleryItem] {
        guard let data = try? Data(contentsOf: root.appendingPathComponent("gallery.json")),
              let list = try? decoder.decode([GalleryItem].self, from: data) else { return [] }
        return list.sorted { $0.created < $1.created }
    }

    func saveGallery(_ list: [GalleryItem]) {
        guard let data = try? encoder.encode(list) else { return }
        try? data.write(to: root.appendingPathComponent("gallery.json"), options: .atomic)
    }

    // MARK: 音樂

    /// 把使用者挑的音樂複製到 App 內，回傳新位置
    func importMusic(from url: URL) throws -> URL {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        if let old = try? FileManager.default.contentsOfDirectory(at: musicDir, includingPropertiesForKeys: nil) {
            old.forEach { try? FileManager.default.removeItem(at: $0) }
        }
        let dest = musicDir.appendingPathComponent(url.lastPathComponent)
        try FileManager.default.copyItem(at: url, to: dest)
        return dest
    }

    var savedMusic: URL? {
        (try? FileManager.default.contentsOfDirectory(at: musicDir, includingPropertiesForKeys: nil))?.first
    }
}
