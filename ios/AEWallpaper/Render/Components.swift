import SwiftUI

/// 三款動態可愛元件：雲朵寶寶、跳跳星、果凍愛心（座標以元件中心為原點，約 ±110）
enum Components {
    static let radius: CGFloat = 110

    /// tap：點擊後的彈跳強度（1 → 0）；emit：讓元件噴出粒子（本地座標）
    static func draw(_ kind: ComponentKind, in ctx: GraphicsContext, t: Double, seed: Double, tap: Double, tapAge: Double,
                     emit: ((CGPoint, ParticleKind, ParticleOptions) -> Void)?) {
        switch kind {
        case .cloud: cloud(ctx, t: t, seed: seed, tap: tap, tapAge: tapAge, emit: emit)
        case .star: star(ctx, t: t, seed: seed, tap: tap, emit: emit)
        case .heart: jelly(ctx, t: t, seed: seed, tap: tap, emit: emit)
        }
    }

    static func face(_ ctx: GraphicsContext, t: Double, seed: Double, y: CGFloat, scale: CGFloat, eye: Color) {
        var c = ctx
        c.translateBy(x: 0, y: y)
        c.scaleBy(x: scale, y: scale)
        let blink = (t + seed * 1.7).truncatingRemainder(dividingBy: 3.8) < 0.13
        let blush = Color(.sRGB, red: 1, green: 0.47, blue: 0.63, opacity: 0.55)
        c.fill(Shapes.ellipse(CGPoint(x: -36, y: 14), rx: 13, ry: 8), with: .color(blush))
        c.fill(Shapes.ellipse(CGPoint(x: 36, y: 14), rx: 13, ry: 8), with: .color(blush))
        for ex in [CGFloat(-22), 22] {
            if blink {
                c.fill(Shapes.ellipse(CGPoint(x: ex, y: 0), rx: 8, ry: 2.2), with: .color(eye))
            } else {
                c.fill(Shapes.ellipse(CGPoint(x: ex, y: 0), rx: 7.5, ry: 10), with: .color(eye))
                c.fill(Shapes.circle(CGPoint(x: ex + 2.5, y: -3.5), 3), with: .color(.white))
            }
        }
        var mouth = Path()
        Shapes.arc(center: CGPoint(x: -6, y: 12), radius: 6, from: 0.1, to: .pi - 0.1, into: &mouth)
        Shapes.arc(center: CGPoint(x: 6, y: 12), radius: 6, from: 0.1, to: .pi - 0.1, into: &mouth)
        c.stroke(mouth, with: .color(eye), style: StrokeStyle(lineWidth: 3.5, lineCap: .round, lineJoin: .round))
    }

    // MARK: 雲朵寶寶

    private static let blobs: [(CGFloat, CGFloat, CGFloat)] = [
        (-62, 14, 42), (-22, -22, 54), (32, -16, 50), (70, 16, 38), (0, 26, 52), (-40, 32, 36), (42, 32, 38),
    ]

    private static func cloud(_ ctx: GraphicsContext, t: Double, seed: Double, tap: Double, tapAge: Double,
                              emit: ((CGPoint, ParticleKind, ParticleOptions) -> Void)?) {
        let bob = sin(t * 1.6 + seed) * 14
        var shadow = ctx
        shadow.fill(Shapes.ellipse(CGPoint(x: 0, y: 112), rx: max(10, 80 - bob * 0.8), ry: 12), with: .color(Color(hex: 0x5A6B9A, opacity: 0.18)))

        var c = ctx
        let sq = 1 + tap * 0.22 * sin(tapAge * 22)
        c.translateBy(x: 0, y: bob - tap * 30)
        c.scaleBy(x: sq, y: 2 - sq)
        var outline = Path(), body = Path()
        for (x, y, r) in blobs {
            outline.addPath(Shapes.circle(CGPoint(x: x, y: y), r + 6))
            body.addPath(Shapes.circle(CGPoint(x: x, y: y), r))
        }
        c.fill(outline, with: .color(Color(hex: 0xBFD8F5)))
        c.fill(body, with: .linearGradient(Gradient(colors: [.white, Color(hex: 0xEAF3FF)]),
                                           startPoint: CGPoint(x: 0, y: -80), endPoint: CGPoint(x: 0, y: 80)))
        face(c, t: t, seed: seed, y: 10, scale: 1, eye: Color(hex: 0x3B2A3F))
        if let emit, Double.random(in: 0..<1) < 0.012 {
            emit(CGPoint(x: 0, y: -70 + bob), .heart, ParticleOptions())
        }
    }

    // MARK: 跳跳星

    private static func star(_ ctx: GraphicsContext, t: Double, seed: Double, tap: Double,
                             emit: ((CGPoint, ParticleKind, ParticleOptions) -> Void)?) {
        let p = (t * 0.75 + seed).truncatingRemainder(dividingBy: 1)
        let hop = sin(p * .pi)
        let land = p < 0.12 ? 1 - p / 0.12 : (p > 0.92 ? (p - 0.92) / 0.08 : 0)
        var shadow = ctx
        shadow.fill(Shapes.ellipse(CGPoint(x: 0, y: 100), rx: 70 - hop * 20, ry: 10),
                    with: .color(Color(hex: 0x7A5A20, opacity: 0.16 * (1 - hop * 0.5))))

        var c = ctx
        c.translateBy(x: 0, y: -hop * 46 + land * 8 - tap * 40)
        c.rotate(by: .radians(sin(t * 2.2 + seed) * 0.12 + tap * .pi * 2 * (1 - tap) * 0.6))
        c.scaleBy(x: 1 + land * 0.14, y: 1 - land * 0.16)
        let shape = Shapes.star5(outer: 96, inner: 44)
        let grad = GraphicsContext.Shading.linearGradient(Gradient(colors: [Color(hex: 0xFFF2A0), Color(hex: 0xFFC93C)]),
                                                          startPoint: CGPoint(x: 0, y: -90), endPoint: CGPoint(x: 0, y: 80))
        c.stroke(shape, with: .color(Color(hex: 0xF5A623)), style: StrokeStyle(lineWidth: 30, lineJoin: .round))
        c.stroke(shape, with: grad, style: StrokeStyle(lineWidth: 20, lineJoin: .round))
        c.fill(shape, with: grad)
        var gloss = c
        gloss.translateBy(x: -30, y: -40)
        gloss.rotate(by: .radians(-0.6))
        gloss.fill(Shapes.ellipse(.zero, rx: 12, ry: 7), with: .color(.white.opacity(0.7)))
        face(c, t: t, seed: seed, y: 8, scale: 0.85, eye: Color(hex: 0x5A3A12))
        if let emit, land > 0.95, Double.random(in: 0..<1) < 0.5 {
            emit(CGPoint(x: rndf(-60, 60), y: 80), .spark, ParticleOptions(vy: rnd(-140, -60), size: rnd(10, 18), life: 0.8))
        }
    }

    // MARK: 果凍愛心

    private static func jelly(_ ctx: GraphicsContext, t: Double, seed: Double, tap: Double,
                              emit: ((CGPoint, ParticleKind, ParticleOptions) -> Void)?) {
        let ph = (t * 1.1 + seed).truncatingRemainder(dividingBy: 1)
        let beat = ph < 0.5 ? max(0, sin(ph * .pi * 4)) : 0
        let s = 1 + beat * 0.08 + tap * 0.25
        let wob = sin(t * 7) * 0.03 * (1 + tap * 3)
        var shadow = ctx
        shadow.fill(Shapes.ellipse(CGPoint(x: 0, y: 70), rx: 70, ry: 10), with: .color(Color(hex: 0xA03060, opacity: 0.16)))

        var c = ctx
        c.translateBy(x: 0, y: 30 + sin(t * 1.4 + seed) * 6)
        c.scaleBy(x: s + wob, y: s - wob)
        let heart = Shapes.heart(120)
        c.stroke(heart, with: .color(Color(hex: 0xF0559A)), lineWidth: 10)
        c.fill(heart, with: .radialGradient(Gradient(colors: [Color(hex: 0xFFC4DA), Color(hex: 0xFF5E9A)]),
                                            center: CGPoint(x: -30, y: -50), startRadius: 10, endRadius: 140))
        var gloss = c
        gloss.translateBy(x: -50, y: -60)
        gloss.rotate(by: .radians(-0.7))
        gloss.fill(Shapes.ellipse(.zero, rx: 18, ry: 10), with: .color(.white.opacity(0.65)))
        c.fill(Shapes.circle(CGPoint(x: -26, y: -72), 5), with: .color(.white.opacity(0.65)))
        face(c, t: t, seed: seed, y: -10, scale: 0.9, eye: Color(hex: 0x5A1830))
        if let emit, Double.random(in: 0..<1) < 0.03 {
            emit(CGPoint(x: rndf(-50, 50), y: -60), .bubble, ParticleOptions(vy: rnd(-140, -80), size: rnd(8, 18), life: rnd(1.4, 2.2)))
        }
    }
}

struct ParticleOptions {
    var vx: Double? = nil
    var vy: Double? = nil
    var size: Double? = nil
    var life: Double? = nil
}

/// 元件互動與觸碰特效的粒子
struct Particle {
    var x, y, vx, vy, life, max, s, rot, hue, wob: Double
    var kind: ParticleKind
}

final class ParticleSystem {
    var particles: [Particle] = []

    func burst(at p: CGPoint, kind: ParticleKind, count: Int = 10, spread: Double = 1) {
        for _ in 0..<count {
            let a = rnd(0, .pi * 2), sp = rnd(120, 380) * spread
            particles.append(Particle(x: p.x, y: p.y, vx: cos(a) * sp, vy: sin(a) * sp - (kind == .bubble ? 120 : 60),
                                      life: 0, max: rnd(0.7, 1.4), s: rnd(14, 30), rot: rnd(0, .pi * 2),
                                      hue: kind == .heart ? rnd(330, 360) : rnd(0, 360), wob: rnd(0, .pi * 2), kind: kind))
        }
    }

    func emit(at p: CGPoint, kind: ParticleKind, options o: ParticleOptions) {
        particles.append(Particle(x: p.x, y: p.y, vx: o.vx ?? rnd(-30, 30), vy: o.vy ?? rnd(-160, -90), life: 0,
                                  max: o.life ?? rnd(1.6, 2.6), s: o.size ?? rnd(12, 24), rot: rnd(0, .pi * 2),
                                  hue: rnd(330, 360), wob: rnd(0, .pi * 2), kind: kind))
    }

    func stepAndDraw(_ ctx: GraphicsContext, dt: Double) {
        var alive: [Particle] = []
        alive.reserveCapacity(particles.count)
        for var p in particles {
            p.life += dt
            if p.life >= p.max { continue }
            let u = p.life / p.max
            if p.kind == .bubble {
                p.vx *= 0.97
                p.vy = p.vy * 0.98 - 36 * dt
                p.x += sin(p.life * 6 + p.wob) * 0.8
            } else {
                p.vx *= 0.96
                p.vy = p.vy * 0.96 + 260 * dt
            }
            p.x += p.vx * dt
            p.y += p.vy * dt
            alive.append(p)

            var c = ctx
            c.translateBy(x: p.x, y: p.y)
            c.opacity = 1 - u * u
            switch p.kind {
            case .heart:
                c.rotate(by: .radians(sin(p.life * 5) * 0.3))
                let h = Shapes.heart(p.s)
                c.fill(h, with: .color(hsla(p.hue, 0.95, 0.72, 1)))
                c.stroke(h, with: .color(.white), lineWidth: 3)
            case .bubble:
                let circle = Shapes.circle(.zero, p.s)
                c.fill(circle, with: .color(.white.opacity(0.18)))
                c.stroke(circle, with: .color(.white.opacity(0.9)), lineWidth: 3)
                c.fill(Shapes.circle(CGPoint(x: -p.s * 0.35, y: -p.s * 0.35), p.s * 0.22), with: .color(.white))
            case .spark:
                c.rotate(by: .radians(p.rot + p.life * 3))
                c.fill(Shapes.star4(p.s * (1 - u * 0.5)), with: .color(hsla(p.hue, 1, 0.85, 1)))
            }
        }
        particles = alive
    }
}
