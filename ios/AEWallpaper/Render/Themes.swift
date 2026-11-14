import SwiftUI

/// 音樂節奏資訊（0...1）
struct MusicPulse {
    var playing = false
    var level: Double = 0
    var beat: Double = 0
}

/// 三款動態桌面主題：夜店雷射、微風流動、閃閃發光
final class ThemeState {
    private let W = Canvas2340.width, H = Canvas2340.height

    // 雷射
    private struct Dot { var a, r, s, h: Double }
    private lazy var dots: [Dot] = (0..<36).map { _ in Dot(a: rnd(0, .pi * 2), r: rnd(0.15, 1), s: rnd(10, 26), h: rnd(0, 360)) }

    // 微風
    private struct Petal { var x, y, s, rot, vr, ph, sp: Double; var leaf: Bool; var col: Color }
    private struct Streak { var x, y, len, amp, p, dur, w: Double }
    private lazy var petals: [Petal] = (0..<46).map { i in
        Petal(x: rnd(0, W), y: rnd(0, H), s: rnd(14, 30), rot: rnd(0, .pi * 2), vr: rnd(-1.5, 1.5),
              ph: rnd(0, .pi * 2), sp: rnd(0.6, 1.3), leaf: Double.random(in: 0..<1) < 0.3,
              col: [Color(hex: 0xFFC2D9), Color(hex: 0xFFD9E8), .white, Color(hex: 0xFFB3CE)][i % 4])
    }
    private lazy var streaks: [Streak] = (0..<8).map { _ in newStreak(randomStart: true) }

    // 星光
    private struct Star { var x, y, s, sp, ph: Double; var col: Color }
    private struct Glitter { var x, y, r, vy, ph: Double }
    private lazy var stars: [Star] = (0..<70).map { i in
        Star(x: rnd(0, W), y: rnd(0, H), s: rnd(14, 46), sp: rnd(1.2, 3.2), ph: rnd(0, .pi * 2),
             col: [Color.white, Color(hex: 0xFFE696), Color(hex: 0xFFBEE1), Color(hex: 0xBEE1FF)][i % 4])
    }
    private lazy var glitter: [Glitter] = (0..<60).map { _ in Glitter(x: rnd(0, W), y: rnd(0, H), r: rnd(2, 5), vy: rnd(30, 90), ph: rnd(0, .pi * 2)) }

    private func newStreak(randomStart: Bool) -> Streak {
        Streak(x: rnd(-W * 0.4, W * 0.6), y: rnd(0, H), len: rnd(W * 0.5, W * 0.9), amp: rnd(20, 60),
               p: randomStart ? rnd(0, 1) : 0, dur: rnd(3, 6), w: rnd(2, 4.5))
    }

    func draw(_ id: ThemeID, in ctx: GraphicsContext, t: Double, dt: Double, k: Double, music: MusicPulse) {
        guard k > 0 else { return }
        switch id {
        case .none: return
        case .laser: laser(ctx, t: t, k: k, music: music)
        case .breeze: breeze(ctx, t: t, dt: dt, k: k, music: music)
        case .sparkle: sparkle(ctx, t: t, dt: dt, k: k, music: music)
        }
    }

    // MARK: 夜店雷射

    private func laser(_ ctx: GraphicsContext, t: Double, k: Double, music: MusicPulse) {
        let beat = music.playing ? music.beat : max(0, 1 - (t * 2).truncatingRemainder(dividingBy: 1) * 3.5)
        let boost = music.playing ? 0.6 + music.level * 1.4 : 1
        let full = Path(CGRect(origin: .zero, size: Canvas2340.size))
        ctx.fill(full, with: .color(Color(hex: 0x0C001E, opacity: 0.42 * k)))

        var c = ctx
        c.blendMode = .plusLighter
        for i in 0..<3 {
            let x = W * (0.5 + 0.4 * sin(t * 0.2 + Double(i) * 2)), y = H * (0.75 + 0.15 * cos(t * 0.17 + Double(i)))
            c.glow(at: CGPoint(x: x, y: y), radius: W * 0.8, color: hsla(t * 30 + Double(i) * 120, 0.9, 0.6, 1), alpha: 0.1 * k)
        }
        let emitters: [(CGFloat, CGFloat, Double)] = [
            (W * 0.06, H * 0.99, -Double.pi / 2 + 0.55),
            (W * 0.94, H * 0.99, -Double.pi / 2 - 0.55),
            (W * 0.5, H * 0.01, Double.pi / 2),
        ]
        for (ei, (ex, ey, base)) in emitters.enumerated() {
            for i in 0..<6 {
                let ang = base + (Double(i) - 2.5) * 0.16 + sin(t * (0.6 + Double(ei) * 0.25) + Double(i) * 0.8) * 0.5
                let hue = t * 50 + Double(ei) * 120 + Double(i) * 22
                let a = min(1, (0.45 + 0.35 * sin(t * 5 + Double(i) * 1.3 + Double(ei))) * k * boost)
                var beam = Path()
                beam.move(to: CGPoint(x: ex, y: ey))
                beam.addLine(to: CGPoint(x: ex + ccos(ang) * H * 1.4, y: ey + csin(ang) * H * 1.4))
                c.stroke(beam, with: .color(hsla(hue, 1, 0.55, a * 0.18)), style: StrokeStyle(lineWidth: 26, lineCap: .round))
                c.stroke(beam, with: .color(hsla(hue, 1, 0.62, a * 0.75)), style: StrokeStyle(lineWidth: 5, lineCap: .round))
                c.stroke(beam, with: .color(.white.opacity(a * 0.55)), style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
            }
            c.glow(at: CGPoint(x: ex, y: ey), radius: 120, color: .white, alpha: 0.8 * k)
        }
        for d in dots {
            let a = d.a + t * 0.35
            let x = W / 2 + cos(a) * W * 0.7 * d.r, y = H * 0.42 + sin(a * 1.3) * H * 0.35 * d.r
            c.glow(at: CGPoint(x: x, y: y), radius: d.s * (1 + beat * 0.6), color: hsla(d.h + t * 40, 1, 0.8, 1), alpha: 0.7 * k)
        }
        if beat > 0.05 {
            c.fill(full, with: .color(hsla(t * 90, 1, 0.65, beat * 0.13 * k)))
        }
    }

    // MARK: 微風流動

    private func breeze(_ ctx: GraphicsContext, t: Double, dt: Double, k: Double, music: MusicPulse) {
        let wind = 1 + (music.playing ? music.level * 1.5 : 0)
        var sun = ctx
        sun.blendMode = .screen
        sun.glow(at: CGPoint(x: W * 0.15, y: H * 0.05), radius: H * 0.55, color: Color(hex: 0xFFFAD7), alpha: (0.32 + 0.1 * sin(t * 0.8)) * k)

        for i in streaks.indices {
            streaks[i].p += dt / streaks[i].dur * wind
            if streaks[i].p > 1.3 { streaks[i] = newStreak(randomStart: false) }
            let s = streaks[i]
            let seg = 24
            for j in 0..<seg {
                let u0 = s.p - 0.3 + Double(j) / Double(seg) * 0.3, u1 = u0 + 0.3 / Double(seg)
                if u1 < 0 || u0 > 1 { continue }
                let fade = sin(.pi * min(1, max(0, u0))) * Double(j) / Double(seg)
                var line = Path()
                line.move(to: streakPoint(s, u0, t))
                line.addLine(to: streakPoint(s, u1, t))
                ctx.stroke(line, with: .color(.white.opacity(0.55 * fade * k)), style: StrokeStyle(lineWidth: s.w, lineCap: .round))
            }
        }

        var c = ctx
        c.opacity = min(1, k * 1.1)
        for i in petals.indices {
            var p = petals[i]
            p.x += (55 + 30 * sin(t * 0.7 + p.ph)) * p.sp * dt * wind
            p.y += (38 + 22 * sin(t * 1.3 + p.ph)) * p.sp * dt
            p.rot += p.vr * dt * wind
            if p.x > W + 40 { p.x = -40 }
            if p.y > H + 40 { p.y = -40; p.x = rnd(-W * 0.2, W) }
            petals[i] = p
            var pc = c
            pc.translateBy(x: p.x, y: p.y)
            pc.rotate(by: .radians(p.rot))
            pc.scaleBy(x: 1, y: 0.55 + 0.45 * abs(sin(t * 2 + p.ph)))
            let path = Shapes.petal(p.s, leaf: p.leaf)
            pc.fill(path, with: .color(p.leaf ? Color(hex: 0xA8E6A1) : p.col))
            pc.stroke(path, with: .color(p.leaf ? Color(hex: 0x50A05A, opacity: 0.5) : Color(hex: 0xFF8CB4, opacity: 0.45)), lineWidth: 2)
        }
    }

    private func streakPoint(_ s: Streak, _ u: Double, _ t: Double) -> CGPoint {
        CGPoint(x: s.x + u * s.len, y: s.y + sin(u * 5 + t * 0.6) * s.amp - u * 60)
    }

    // MARK: 閃閃發光

    private func sparkle(_ ctx: GraphicsContext, t: Double, dt: Double, k: Double, music: MusicPulse) {
        let boost = music.playing ? 0.8 + music.level * 1.6 + music.beat * 0.6 : 1
        var c = ctx
        c.blendMode = .plusLighter
        for i in glitter.indices {
            glitter[i].y += glitter[i].vy * dt
            if glitter[i].y > H + 10 { glitter[i].y = -10; glitter[i].x = rnd(0, W) }
            let g = glitter[i]
            let a = (0.4 + 0.6 * abs(sin(t * 4 + g.ph))) * k
            c.fill(Shapes.circle(CGPoint(x: g.x + sin(t + g.ph) * 10, y: g.y), g.r), with: .color(Color(hex: 0xFFF0C8, opacity: a * 0.8)))
        }
        for s in stars {
            let b = sin(t * s.sp + s.ph)
            if b <= 0 { continue }
            let r = s.s * b * b * boost
            let a = min(1, b * k * 1.2)
            c.glow(at: CGPoint(x: s.x, y: s.y), radius: r * 1.6, color: s.col, alpha: 0.55 * a)
            var sc = c
            sc.translateBy(x: s.x, y: s.y)
            sc.rotate(by: .radians(t * 0.3 + s.ph))
            sc.fill(Shapes.star4(r), with: .color(.white.opacity(a)))
        }
        let cyc = t.truncatingRemainder(dividingBy: 6) / 6
        if cyc < 0.45 {
            let p = cyc / 0.45
            var band = c
            band.translateBy(x: -W * 0.6 + p * W * 2.2, y: H / 2)
            band.rotate(by: .radians(-0.45))
            band.fill(Path(CGRect(x: -160, y: -H, width: 320, height: H * 2)), with: .linearGradient(
                Gradient(colors: [.white.opacity(0), .white.opacity(0.22 * k), .white.opacity(0)]),
                startPoint: CGPoint(x: -160, y: 0), endPoint: CGPoint(x: 160, y: 0)))
        }
    }
}
