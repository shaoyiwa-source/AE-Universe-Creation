import SwiftUI

/// 常用路徑（座標與網頁版 canvas 相同，y 軸向下）
enum Shapes {
    static func heart(_ s: CGFloat) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: 0, y: s * 0.35))
        p.addCurve(to: CGPoint(x: 0, y: -s * 0.5),
                   control1: CGPoint(x: -s * 1.1, y: -s * 0.35), control2: CGPoint(x: -s * 0.55, y: -s * 1.05))
        p.addCurve(to: CGPoint(x: 0, y: s * 0.35),
                   control1: CGPoint(x: s * 0.55, y: -s * 1.05), control2: CGPoint(x: s * 1.1, y: -s * 0.35))
        p.closeSubpath()
        return p
    }

    /// 四角星光
    static func star4(_ r: CGFloat, thin: CGFloat = 0.18) -> Path {
        var p = Path()
        for i in 0..<4 {
            let a = Double(i) * .pi / 2
            let na = a + .pi / 2
            if i == 0 { p.move(to: CGPoint(x: cos(a) * r, y: sin(a) * r)) }
            p.addQuadCurve(to: CGPoint(x: cos(na) * r, y: sin(na) * r),
                           control: CGPoint(x: cos(a + .pi / 4) * r * thin, y: sin(a + .pi / 4) * r * thin))
        }
        p.closeSubpath()
        return p
    }

    /// 五角星（外框用粗圓角線條畫出圓潤感）
    static func star5(outer: CGFloat, inner: CGFloat) -> Path {
        var p = Path()
        for i in 0..<10 {
            let a = -Double.pi / 2 + Double(i) * .pi / 5
            let r = i % 2 == 1 ? inner : outer
            let pt = CGPoint(x: cos(a) * r, y: sin(a) * r)
            if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
        }
        p.closeSubpath()
        return p
    }

    /// 圓弧（以取樣點組成，角度方向與網頁 canvas 相同：角度遞增 = 畫面上順時針）
    static func arc(center: CGPoint, radius: CGFloat, from a0: Double, to a1: Double, into path: inout Path, moveFirst: Bool = true) {
        let steps = 16
        for i in 0...steps {
            let a = a0 + (a1 - a0) * Double(i) / Double(steps)
            let pt = CGPoint(x: center.x + cos(a) * radius, y: center.y + sin(a) * radius)
            if i == 0 && moveFirst { path.move(to: pt) } else { path.addLine(to: pt) }
        }
    }

    static func circle(_ c: CGPoint, _ r: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
    }

    static func ellipse(_ c: CGPoint, rx: CGFloat, ry: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: c.x - rx, y: c.y - ry, width: rx * 2, height: ry * 2))
    }

    /// 平滑筆畫
    static func stroke(_ pts: [CGPoint]) -> Path {
        var p = Path()
        guard let first = pts.first else { return p }
        p.move(to: first)
        if pts.count == 1 { p.addLine(to: CGPoint(x: first.x + 0.1, y: first.y)); return p }
        if pts.count > 2 {
            for i in 1..<(pts.count - 1) {
                let mid = CGPoint(x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2)
                p.addQuadCurve(to: mid, control: pts[i])
            }
        }
        p.addLine(to: pts[pts.count - 1])
        return p
    }

    static func petal(_ s: CGFloat, leaf: Bool) -> Path {
        var p = Path()
        if leaf {
            p.move(to: CGPoint(x: -s, y: 0))
            p.addQuadCurve(to: CGPoint(x: s, y: 0), control: CGPoint(x: 0, y: -s * 0.7))
            p.addQuadCurve(to: CGPoint(x: -s, y: 0), control: CGPoint(x: 0, y: s * 0.7))
        } else {
            p.move(to: CGPoint(x: 0, y: -s * 0.55))
            p.addCurve(to: CGPoint(x: 0, y: s * 0.6), control1: CGPoint(x: s * 0.9, y: -s * 0.9), control2: CGPoint(x: s * 0.9, y: s * 0.6))
            p.addCurve(to: CGPoint(x: 0, y: -s * 0.55), control1: CGPoint(x: -s * 0.9, y: s * 0.6), control2: CGPoint(x: -s * 0.9, y: -s * 0.9))
        }
        p.closeSubpath()
        return p
    }
}

extension GraphicsContext {
    /// 以圓形放射漸層填滿一塊區域（光暈）
    func glow(at c: CGPoint, radius r: CGFloat, color: Color, alpha: Double) {
        guard r > 0.5, alpha > 0.001 else { return }
        fill(Path(CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)),
             with: .radialGradient(Gradient(colors: [color.opacity(alpha), color.opacity(0)]),
                                   center: c, startRadius: 0, endRadius: r))
    }
}

/// 簡單的可重現亂數
func rnd(_ a: Double, _ b: Double) -> Double { Double.random(in: a..<b) }
func rndf(_ a: CGFloat, _ b: CGFloat) -> CGFloat { CGFloat.random(in: a..<b) }

func hsla(_ h: Double, _ s: Double, _ l: Double, _ a: Double) -> Color {
    // HSL → RGB
    let hh = (h.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) / 360
    let q = l < 0.5 ? l * (1 + s) : l + s - l * s
    let p = 2 * l - q
    func hue(_ t0: Double) -> Double {
        var t = t0
        if t < 0 { t += 1 }
        if t > 1 { t -= 1 }
        if t < 1 / 6 { return p + (q - p) * 6 * t }
        if t < 1 / 2 { return q }
        if t < 2 / 3 { return p + (q - p) * (2 / 3 - t) * 6 }
        return p
    }
    return Color(.sRGB, red: hue(hh + 1 / 3), green: hue(hh), blue: hue(hh - 1 / 3), opacity: max(0, min(1, a)))
}
