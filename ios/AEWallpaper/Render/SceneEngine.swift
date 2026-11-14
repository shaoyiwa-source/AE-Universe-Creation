import SwiftUI
import UIKit

/// 負責一個桌布場景的動畫狀態與繪製（編輯畫面、互動模式、匯出各用一個）
@MainActor
final class SceneEngine {
    private(set) var scene = WallpaperScene()
    private var baseImage: Image = Image(uiImage: Filters.defaultBackground)
    private var baseKey: String = "-"
    private var stickerCache: [String: (Image, CGSize)] = [:]
    private let themes = ThemeState()
    private let particles = ParticleSystem()
    private var tapTimes: [UUID: Double] = [:]
    private var lastTime: Double?

    /// 匯出時使用固定的時間軸，不受音樂狀態影響
    var musicOverride: MusicPulse?

    init(scene: WallpaperScene = WallpaperScene()) {
        setScene(scene)
    }

    func setScene(_ newScene: WallpaperScene) {
        let key = "\(newScene.baseImageFile ?? "default")|\(newScene.filter.rawValue)"
        if key != baseKey {
            baseKey = key
            let raw = newScene.baseImageFile.flatMap { AssetStore.shared.image(named: $0) } ?? Filters.defaultBackground
            baseImage = Image(uiImage: Filters.apply(newScene.filter, to: raw))
        }
        scene = newScene
    }

    // MARK: - 互動

    /// 點擊某個物件：彈跳＋噴粒子，回傳要播放的聲音
    @discardableResult
    func tap(_ item: SceneItem, at time: Double) -> SoundID {
        tapTimes[item.id] = time
        if case .component(let kind) = item.content {
            particles.burst(at: CGPoint(x: item.position.x, y: item.position.y - 40 * item.scale), kind: kind.burst, count: 12, spread: item.scale)
            return AppSettings.shared.sound(for: kind)
        }
        particles.burst(at: item.position, kind: .spark, count: 7, spread: 0.7)
        return .none
    }

    func sparkle(at point: CGPoint) {
        particles.burst(at: point, kind: .spark, count: 9, spread: 0.8)
    }

    func hitTest(_ point: CGPoint) -> SceneItem? {
        for item in scene.items.reversed() where !item.content.isStroke {
            let half = halfSize(of: item)
            let dx: CGFloat = point.x - item.position.x
            let dy: CGFloat = point.y - item.position.y
            let c = CGFloat(cos(-item.rotation)), s = CGFloat(sin(-item.rotation))
            let lx: CGFloat = (dx * c - dy * s) / item.scale
            let ly: CGFloat = (dx * s + dy * c) / item.scale
            let pad: CGFloat = 24 / item.scale
            if abs(lx) <= half.width + pad && abs(ly) <= half.height + pad { return item }
        }
        return nil
    }

    func halfSize(of item: SceneItem) -> CGSize {
        switch item.content {
        case .component: return CGSize(width: Components.radius, height: Components.radius)
        case .emoji: return CGSize(width: 62, height: 62)
        case .sticker(let file): return sticker(file)?.1 ?? CGSize(width: 100, height: 100)
        case .text(let text, _):
            let lines = text.components(separatedBy: "\n")
            let font = TextStyle.uiFont
            let w = lines.map { ($0 as NSString).size(withAttributes: [.font: font]).width }.max() ?? 0
            return CGSize(width: w / 2 + 16, height: CGFloat(lines.count) * TextStyle.size * 1.2 / 2 + 10)
        case .stroke: return .zero
        }
    }

    private func sticker(_ file: String) -> (Image, CGSize)? {
        if let cached = stickerCache[file] { return cached }
        guard let ui = AssetStore.shared.image(named: file) else { return nil }
        let s = 360 / max(ui.size.width, ui.size.height)
        let entry = (Image(uiImage: ui), CGSize(width: ui.size.width * s / 2, height: ui.size.height * s / 2))
        stickerCache[file] = entry
        return entry
    }

    // MARK: - 繪製（座標為 1080×2340）

    func render(in ctx: GraphicsContext, time t: Double, fixedDt: Double? = nil,
                selection: UUID? = nil, draft: SceneItem? = nil) {
        let dt = fixedDt ?? min(0.05, max(0, t - (lastTime ?? t)))
        lastTime = t
        let music = musicOverride ?? SoundEngine.shared.pulse

        ctx.draw(baseImage, in: CGRect(origin: .zero, size: Canvas2340.size))
        themes.draw(scene.theme, in: ctx, t: t, dt: dt, k: scene.intensity, music: music)
        for item in scene.items { draw(item, in: ctx, t: t) }
        if let draft { draw(draft, in: ctx, t: t) }
        particles.stepAndDraw(ctx, dt: dt)
        Filters.drawOverlay(scene.filter, in: ctx, t: t)
        if let selection, let item = scene.items.first(where: { $0.id == selection }) {
            drawSelection(item, in: ctx)
        }
    }

    private func draw(_ item: SceneItem, in ctx: GraphicsContext, t: Double) {
        if case .stroke(let mode, let color, let width, let points) = item.content {
            drawStroke(mode: mode, color: color.color, width: width, points: points, in: ctx, t: t)
            return
        }
        let tapAge = tapTimes[item.id].map { t - $0 } ?? 99
        let tap = tapAge < 3 ? exp(-tapAge * 4.5) : 0
        var c = ctx
        c.translateBy(x: item.position.x, y: item.position.y)
        c.rotate(by: .radians(item.rotation))
        c.scaleBy(x: item.scale, y: item.scale)

        switch item.content {
        case .component(let kind):
            let ps = particles
            let pos: CGPoint = item.position
            let scale: CGFloat = item.scale
            let cr = CGFloat(cos(item.rotation)), sr = CGFloat(sin(item.rotation))
            Components.draw(kind, in: c, t: t, seed: item.seed, tap: tap, tapAge: tapAge) { local, pkind, opts in
                let rx: CGFloat = local.x * cr - local.y * sr
                let ry: CGFloat = local.x * sr + local.y * cr
                ps.emit(at: CGPoint(x: pos.x + rx * scale, y: pos.y + ry * scale), kind: pkind, options: opts)
            }
        case .emoji(let char):
            let k = 1 + exp(-tapAge * 5) * 0.2
            c.scaleBy(x: k, y: k)
            c.addFilter(.shadow(color: .black.opacity(0.18), radius: 8, x: 0, y: 4))
            c.draw(Text(char).font(.system(size: 110)), at: CGPoint(x: 0, y: 6), anchor: .center)
        case .sticker(let file):
            guard let entry = sticker(file) else { return }
            let (image, half) = entry
            let k = 1 + exp(-tapAge * 5) * 0.2
            c.scaleBy(x: k, y: k)
            c.addFilter(.shadow(color: .black.opacity(0.18), radius: 12, x: 0, y: 6))
            c.draw(image, in: CGRect(x: -half.width, y: -half.height, width: half.width * 2, height: half.height * 2))
        case .text(let text, let color):
            let k = 1 + exp(-tapAge * 5) * 0.2
            c.scaleBy(x: k, y: k)
            let lines = text.components(separatedBy: "\n")
            let lh = TextStyle.size * 1.2
            for (i, line) in lines.enumerated() {
                let y = (CGFloat(i) - CGFloat(lines.count - 1) / 2) * lh
                let outline = c.resolve(Text(line).font(TextStyle.font).foregroundColor(.white))
                let d = TextStyle.size * 0.09
                for a in stride(from: 0.0, to: Double.pi * 2, by: Double.pi / 8) {
                    c.draw(outline, at: CGPoint(x: cos(a) * d, y: y + sin(a) * d), anchor: .center)
                }
                c.draw(Text(line).font(TextStyle.font).foregroundColor(color.color), at: CGPoint(x: 0, y: y), anchor: .center)
            }
        case .stroke:
            break
        }
    }

    private func drawStroke(mode: StrokeMode, color: Color, width: CGFloat, points: [CGPoint], in ctx: GraphicsContext, t: Double) {
        let path = Shapes.stroke(points)
        let style = { (w: CGFloat) in StrokeStyle(lineWidth: w, lineCap: .round, lineJoin: .round) }
        switch mode {
        case .pen:
            var c = ctx
            c.opacity = 0.85
            c.stroke(path, with: .color(.white), style: style(width + 8))
            ctx.stroke(path, with: .color(color), style: style(width))
        case .glow:
            let pulse = 0.82 + 0.18 * sin(t * 3 + Double(points.count))
            for (w, a) in [(3.4, 0.12), (2.2, 0.2), (1.3, 0.45)] {
                var c = ctx
                c.opacity = a * pulse
                c.stroke(path, with: .color(color), style: style(width * w))
            }
            ctx.stroke(path, with: .color(color), style: style(width * 0.75))
            var core = ctx
            core.blendMode = .plusLighter
            core.opacity = 0.9
            core.stroke(path, with: .color(.white), style: style(width * 0.28))
            core.stroke(path, with: .color(.white),
                        style: StrokeStyle(lineWidth: width * 0.75, lineCap: .round, lineJoin: .round,
                                           dash: [width * 1.2, width * 5], dashPhase: -t * 260))
        }
    }

    private func drawSelection(_ item: SceneItem, in ctx: GraphicsContext) {
        let half = halfSize(of: item)
        var c = ctx
        c.translateBy(x: item.position.x, y: item.position.y)
        c.rotate(by: .radians(item.rotation))
        let w = (half.width + 16) * item.scale, h = (half.height + 16) * item.scale
        c.stroke(Path(CGRect(x: -w, y: -h, width: w * 2, height: h * 2)), with: .color(Color(hex: 0x244D3D)),
                 style: StrokeStyle(lineWidth: 4, dash: [18, 12]))
        c.stroke(Path(CGRect(x: -w, y: -h, width: w * 2, height: h * 2)), with: .color(.white.opacity(0.8)),
                 style: StrokeStyle(lineWidth: 4, dash: [18, 12], dashPhase: 18))
        for (x, y) in [(-w, -h), (w, -h), (-w, h), (w, h)] {
            let dot = Shapes.circle(CGPoint(x: x, y: y), 11)
            c.fill(dot, with: .color(.white))
            c.stroke(dot, with: .color(Color(hex: 0x244D3D)), lineWidth: 4)
        }
    }
}

/// 桌布上的文字樣式（圓體粗字＋白色描邊）
enum TextStyle {
    static let size: CGFloat = 120
    static let font = Font.system(size: size, weight: .black, design: .rounded)
    static let uiFont: UIFont = {
        let base = UIFont.systemFont(ofSize: size, weight: .black)
        if let desc = base.fontDescriptor.withDesign(.rounded) { return UIFont(descriptor: desc, size: size) }
        return base
    }()
}
