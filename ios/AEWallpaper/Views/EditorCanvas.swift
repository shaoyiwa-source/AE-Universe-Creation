import SwiftUI

/// 編輯畫面：即時動畫＋拖曳、雙指縮放旋轉、手寫、光紋
struct EditorCanvas: View {
    @ObservedObject var model: EditorModel

    private enum Drag {
        case none
        case draw
        case move(id: UUID, origin: CGPoint, start: CGPoint, moved: Bool, snapshot: WallpaperScene)
    }
    @State private var drag: Drag?
    @State private var pinch: (scale: CGFloat, rotation: Double)?

    var body: some View {
        GeometryReader { geo in
            let k = geo.size.width / Canvas2340.width
            TimelineView(.animation) { timeline in
                Canvas { ctx, _ in
                    var c = ctx
                    c.scaleBy(x: k, y: k)
                    model.engine.render(in: c, time: timeline.date.timeIntervalSinceReferenceDate,
                                        selection: model.selectedID, draft: model.draft)
                }
            }
            .contentShape(Rectangle())
            .gesture(dragGesture(k))
            .simultaneousGesture(pinchGesture)
        }
        .aspectRatio(Canvas2340.width / Canvas2340.height, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(Color.aeLine, lineWidth: 1))
        .shadow(color: .black.opacity(0.16), radius: 18, y: 10)
    }

    private func dragGesture(_ k: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let p = CGPoint(x: value.location.x / k, y: value.location.y / k)
                if drag == nil { begin(at: CGPoint(x: value.startLocation.x / k, y: value.startLocation.y / k)) }
                guard let current = drag else { return }
                switch current {
                case .none:
                    break
                case .draw:
                    guard var item = model.draft, case .stroke(let mode, let color, let width, var points) = item.content else { return }
                    if let last = points.last, hypot(p.x - last.x, p.y - last.y) > 4 {
                        points.append(p)
                        item.content = .stroke(mode, color, width, points)
                        model.draft = item
                    }
                case .move(let id, let origin, let start, var moved, let snapshot):
                    guard pinch == nil else { return }
                    if !moved, hypot(p.x - start.x, p.y - start.y) > 14 {
                        moved = true
                        model.pushUndo(snapshot)
                        drag = .move(id: id, origin: origin, start: start, moved: true, snapshot: snapshot)
                    }
                    if moved {
                        model.update(id) { $0.position = CGPoint(x: origin.x + p.x - start.x, y: origin.y + p.y - start.y) }
                    }
                }
            }
            .onEnded { _ in
                if let current = drag {
                    switch current {
                    case .draw:
                        model.commitDraft()
                    case .move(let id, _, _, let moved, _):
                        if !moved, pinch == nil, let item = model.scene.items.first(where: { $0.id == id }) {
                            model.tap(item)
                        }
                    case .none:
                        break
                    }
                }
                drag = nil
            }
    }

    private func begin(at start: CGPoint) {
        switch model.tool {
        case .pen, .glow:
            let mode: StrokeMode = model.tool == .pen ? .pen : .glow
            let width = model.tool == .glow ? model.penSize * 1.4 : model.penSize
            model.selectedID = nil
            model.draft = SceneItem(content: .stroke(mode, model.penColor, width, [start]), position: .zero)
            drag = .draw
        case .select:
            if let hit = model.engine.hitTest(start) {
                model.selectedID = hit.id
                drag = .move(id: hit.id, origin: hit.position, start: start, moved: false, snapshot: model.scene)
            } else {
                model.selectedID = nil
                drag = Drag.none
            }
        }
    }

    private var pinchGesture: some Gesture {
        MagnifyGesture()
            .simultaneously(with: RotateGesture())
            .onChanged { value in
                guard model.tool == .select, let item = model.selected else { return }
                if pinch == nil {
                    pinch = (item.scale, item.rotation)
                    model.pushUndo()
                }
                guard let start = pinch else { return }
                let mag = value.first?.magnification ?? 1
                let rot = value.second?.rotation.radians ?? 0
                model.update(item.id) {
                    $0.scale = min(6, max(0.2, start.scale * mag))
                    $0.rotation = start.rotation + rot
                }
            }
            .onEnded { _ in pinch = nil }
    }
}
