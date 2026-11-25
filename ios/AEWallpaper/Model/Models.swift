import SwiftUI

/// 桌布的邏輯尺寸（iPhone 全螢幕比例 9:19.5）
enum Canvas2340 {
    static let width: CGFloat = 1080
    static let height: CGFloat = 2340
    static let size = CGSize(width: width, height: height)
    static let center = CGPoint(x: width / 2, y: height / 2)
}

// MARK: - 選項

enum FilterID: String, Codable, CaseIterable, Identifiable {
    case none, peach, lavender, film
    var id: String { rawValue }
    var name: String {
        switch self {
        case .none: return "原圖"
        case .peach: return "蜜桃奶霜"
        case .lavender: return "夢幻紫霧"
        case .film: return "復古底片"
        }
    }
    var detail: String {
        switch self {
        case .none: return "不加濾鏡"
        case .peach: return "暖粉柔光・呼吸光暈"
        case .lavender: return "薰衣草色調・流動霧氣"
        case .film: return "膠片顆粒・漏光閃爍"
        }
    }
}

enum ThemeID: String, Codable, CaseIterable, Identifiable {
    case none, laser, breeze, sparkle
    var id: String { rawValue }
    var name: String {
        switch self {
        case .none: return "無主題"
        case .laser: return "夜店雷射"
        case .breeze: return "微風流動"
        case .sparkle: return "閃閃發光"
        }
    }
    var detail: String {
        switch self {
        case .none: return "只顯示元件"
        case .laser: return "彩色雷射光束・跟著音樂閃"
        case .breeze: return "花瓣樹葉隨風飄・風紋流動"
        case .sparkle: return "星光閃爍・亮片飄落"
        }
    }
    var swatch: [Color] {
        switch self {
        case .none: return [Color.aePaper, Color.aeLine]
        case .laser: return [Color(hex: 0x1A0033), Color(hex: 0xFF2FD0), Color(hex: 0x2FD5FF)]
        case .breeze: return [Color(hex: 0xFFF6D8), Color(hex: 0xFFD6E7), Color(hex: 0xC9F0D8)]
        case .sparkle: return [Color(hex: 0xFFE7A8), Color(hex: 0xFFC2E2), Color(hex: 0xC8B6FF)]
        }
    }
}

enum ParticleKind: String, Codable { case heart, bubble, spark }

enum ComponentKind: String, Codable, CaseIterable, Identifiable {
    case cloud, star, heart
    var id: String { rawValue }
    var name: String {
        switch self {
        case .cloud: return "雲朵寶寶"
        case .star: return "跳跳星"
        case .heart: return "果凍愛心"
        }
    }
    var detail: String {
        switch self {
        case .cloud: return "飄呀飄・會眨眼"
        case .star: return "彈跳＋灑星光"
        case .heart: return "噗通心跳・冒泡泡"
        }
    }
    var defaultSound: SoundID {
        switch self {
        case .cloud: return .pop
        case .star: return .bell
        case .heart: return .chirp
        }
    }
    var burst: ParticleKind {
        switch self {
        case .cloud: return .heart
        case .star: return .spark
        case .heart: return .bubble
        }
    }
}

enum SoundID: String, Codable, CaseIterable, Identifiable {
    case pop, bell, chirp, none
    var id: String { rawValue }
    var name: String {
        switch self {
        case .pop: return "啵啵泡泡"
        case .bell: return "叮叮鈴鐺"
        case .chirp: return "啾啾小鳥"
        case .none: return "無聲"
        }
    }
    static var playable: [SoundID] { [.pop, .bell, .chirp] }
}

enum StrokeMode: String, Codable { case pen, glow }

// MARK: - 顏色

struct RGBA: Codable, Hashable {
    var r: Double, g: Double, b: Double, a: Double = 1

    init(r: Double, g: Double, b: Double, a: Double = 1) {
        self.r = r; self.g = g; self.b = b; self.a = a
    }
    init(hex: UInt32) {
        r = Double((hex >> 16) & 0xFF) / 255
        g = Double((hex >> 8) & 0xFF) / 255
        b = Double(hex & 0xFF) / 255
    }
    var color: Color { Color(.sRGB, red: r, green: g, blue: b, opacity: a) }

    static let palette: [RGBA] = ([
        0xFF7EB6, 0xFF4D6D, 0xFFB347, 0xFFD93D, 0x7ED957,
        0x4DD4C6, 0x5AA9FF, 0x9B7BFF, 0xFFFFFF, 0x4A3550,
    ] as [UInt32]).map { RGBA(hex: $0) }
}

// MARK: - 場景

enum ItemContent: Codable, Hashable {
    case component(ComponentKind)
    case emoji(String)
    case text(String, RGBA)
    case sticker(String)                                  // AssetStore 檔名
    case stroke(StrokeMode, RGBA, CGFloat, [CGPoint])     // 模式、顏色、粗細、點

    var isStroke: Bool { if case .stroke = self { return true } else { return false } }
    var isText: Bool { if case .text = self { return true } else { return false } }
}

struct SceneItem: Codable, Identifiable, Hashable {
    var id = UUID()
    var content: ItemContent
    var position: CGPoint
    var scale: CGFloat = 1
    var rotation: Double = 0
    var seed: Double = Double.random(in: 0...10)
}

struct WallpaperScene: Codable, Hashable {
    var baseImageFile: String?
    var filter: FilterID = .none
    var theme: ThemeID = .sparkle
    var intensity: Double = 0.8
    var items: [SceneItem] = []

    static var demo: WallpaperScene {
        var s = WallpaperScene()
        s.items = [
            SceneItem(content: .component(.cloud), position: CGPoint(x: 1080 * 0.3, y: 2340 * 0.62), scale: 1.3, seed: 1),
            SceneItem(content: .component(.star), position: CGPoint(x: 1080 * 0.72, y: 2340 * 0.72), scale: 1.2, seed: 2),
            SceneItem(content: .component(.heart), position: CGPoint(x: 1080 * 0.45, y: 2340 * 0.84), scale: 1.1, seed: 3),
        ]
        return s
    }
}

struct GalleryItem: Codable, Identifiable, Hashable {
    var id = UUID()
    var created = Date()
    var scene: WallpaperScene
    var thumbFile: String
}

enum AEError: LocalizedError {
    case message(String)
    case badData
    var errorDescription: String? {
        switch self {
        case .message(let text): return text
        case .badData: return "檔案資料錯誤"
        }
    }
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: opacity)
    }
}
