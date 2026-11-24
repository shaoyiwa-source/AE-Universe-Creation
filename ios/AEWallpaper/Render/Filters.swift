import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins
import UIKit

/// 濾鏡：底圖調色（一次運算）＋每格動態疊層
enum Filters {
    static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    /// 把圖片以「填滿」方式裁成 1080×2340
    static func cover(_ image: UIImage) -> UIImage {
        let size = Canvas2340.size
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            let s = max(size.width / image.size.width, size.height / image.size.height)
            let w = image.size.width * s, h = image.size.height * s
            image.draw(in: CGRect(x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h))
        }
    }

    /// 沒匯入照片時的預設底圖：粉紫藍漸層＋柔光
    static let defaultBackground: UIImage = {
        let size = Canvas2340.size
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            let cg = ctx.cgContext
            let colors = [UIColor(red: 1, green: 0.84, blue: 0.91, alpha: 1).cgColor,
                          UIColor(red: 0.91, green: 0.85, blue: 1, alpha: 1).cgColor,
                          UIColor(red: 0.79, green: 0.9, blue: 1, alpha: 1).cgColor] as CFArray
            let grad = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 0.45, 1])!
            cg.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
            for i in 0..<14 {
                let x = CGFloat((i * 397) % Int(size.width)), y = CGFloat((i * 733) % Int(size.height))
                let r = CGFloat(120 + (i * 37) % 160)
                let rg = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                    colors: [UIColor(white: 1, alpha: 0.5).cgColor, UIColor(white: 1, alpha: 0).cgColor] as CFArray,
                                    locations: [0, 1])!
                cg.drawRadialGradient(rg, startCenter: CGPoint(x: x, y: y), startRadius: 0,
                                      endCenter: CGPoint(x: x, y: y), endRadius: r, options: [])
            }
        }
    }()

    /// 底圖調色
    static func apply(_ id: FilterID, to image: UIImage) -> UIImage {
        guard id != .none, let cg = image.cgImage else { return image }
        var ci = CIImage(cgImage: cg)
        let controls = CIFilter.colorControls()
        let matrix = CIFilter.colorMatrix()
        switch id {
        case .peach:
            controls.saturation = 0.92; controls.contrast = 0.88; controls.brightness = 0.05
            matrix.rVector = CIVector(x: 1.03, y: 0, z: 0, w: 0)
            matrix.gVector = CIVector(x: 0, y: 1, z: 0, w: 0)
            matrix.bVector = CIVector(x: 0, y: 0, z: 0.97, w: 0)
            matrix.biasVector = CIVector(x: 0.09, y: 0.04, z: 0.04, w: 0)
        case .lavender:
            controls.saturation = 0.78; controls.contrast = 0.92; controls.brightness = 0.02
            matrix.rVector = CIVector(x: 1, y: 0, z: 0, w: 0)
            matrix.gVector = CIVector(x: 0, y: 0.98, z: 0, w: 0)
            matrix.bVector = CIVector(x: 0, y: 0, z: 1, w: 0)
            matrix.biasVector = CIVector(x: 0.06, y: 0.01, z: 0.12, w: 0)
        case .film:
            controls.saturation = 0.78; controls.contrast = 1.1; controls.brightness = 0
            matrix.rVector = CIVector(x: 0.9, y: 0, z: 0, w: 0)
            matrix.gVector = CIVector(x: 0, y: 0.9, z: 0, w: 0)
            matrix.bVector = CIVector(x: 0, y: 0, z: 0.84, w: 0)
            matrix.biasVector = CIVector(x: 0.12, y: 0.09, z: 0.08, w: 0)
        case .none:
            break
        }
        controls.inputImage = ci
        if let out = controls.outputImage { ci = out }
        matrix.inputImage = ci
        if let out = matrix.outputImage { ci = out }
        guard let result = ciContext.createCGImage(ci, from: CGRect(origin: .zero, size: CGSize(width: cg.width, height: cg.height))) else {
            return image
        }
        return UIImage(cgImage: result)
    }

    // MARK: - 動態疊層

    static let grainTiles: [Image] = (0..<3).map { _ in
        let size = CGSize(width: 256, height: 256)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let img = UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            for y in stride(from: 0, to: 256, by: 2) {
                for x in stride(from: 0, to: 256, by: 2) {
                    UIColor(white: CGFloat.random(in: 0...1), alpha: 1).setFill()
                    ctx.fill(CGRect(x: x, y: y, width: 2, height: 2))
                }
            }
        }
        return Image(uiImage: img)
    }

    static func drawOverlay(_ id: FilterID, in ctx: GraphicsContext, t: Double) {
        let W = Canvas2340.width, H = Canvas2340.height
        let full = Path(CGRect(origin: .zero, size: Canvas2340.size))
        switch id {
        case .none:
            return
        case .peach:
            var c = ctx
            c.blendMode = .screen
            let k = 0.5 + 0.5 * sin(t * 0.9)
            let cx = W * (0.3 + 0.15 * sin(t * 0.3))
            c.fill(full, with: .radialGradient(
                Gradient(colors: [Color(hex: 0xFFBEC8, opacity: 0.22 + 0.14 * k), Color(hex: 0xFFBEC8, opacity: 0)]),
                center: CGPoint(x: cx, y: H * 0.12), startRadius: 0, endRadius: H * 0.6))
            c.fill(full, with: .linearGradient(
                Gradient(colors: [Color(hex: 0xFFD6AA, opacity: 0.18 + 0.08 * k), Color(hex: 0xFFD6AA, opacity: 0)]),
                startPoint: CGPoint(x: 0, y: H), endPoint: CGPoint(x: 0, y: H * 0.6)))
        case .lavender:
            var c = ctx
            c.blendMode = .screen
            for i in 0..<4 {
                let x = W * (0.5 + 0.55 * sin(t * 0.13 + Double(i) * 1.7))
                let y = H * (0.5 + 0.45 * cos(t * 0.11 + Double(i) * 2.3))
                let r = H * (0.28 + 0.06 * sin(t * 0.4 + Double(i)))
                c.glow(at: CGPoint(x: x, y: y), radius: r, color: i % 2 == 1 ? Color(hex: 0xC8AAFF) : Color(hex: 0xFFB4E6), alpha: 0.26)
            }
        case .film:
            var g = ctx
            g.blendMode = .overlay
            g.opacity = 0.1
            let tile = grainTiles[Int(t * 24) % grainTiles.count]
            g.fill(full, with: .tiledImage(tile, origin: CGPoint(x: -rnd(0, 256), y: -rnd(0, 256))))
            var c = ctx
            c.blendMode = .screen
            let lx = W * (1.05 + 0.1 * sin(t * 0.5)), ly = H * (0.3 + 0.25 * sin(t * 0.21))
            c.glow(at: CGPoint(x: lx, y: ly), radius: W * 0.9, color: Color(hex: 0xFF7828), alpha: 0.3 + 0.15 * sin(t * 1.3))
            var v = ctx
            v.fill(full, with: .radialGradient(
                Gradient(stops: [.init(color: Color(hex: 0x140A00, opacity: 0), location: 0.41),
                                 .init(color: Color(hex: 0x140A00, opacity: 0.5), location: 1)]),
                center: Canvas2340.center, startRadius: 0, endRadius: H * 0.72))
            let flick = Double.random(in: 0..<1)
            if flick > 0.93 { v.fill(full, with: .color(Color(hex: 0xFFF5DC, opacity: 0.05))) }
            if flick < 0.06 {
                var line = Path()
                let sx = rndf(0, W)
                line.move(to: CGPoint(x: sx, y: 0))
                line.addLine(to: CGPoint(x: sx + rndf(-20, 20), y: H))
                v.stroke(line, with: .color(.white.opacity(0.35)), lineWidth: 2)
            }
        }
    }
}
