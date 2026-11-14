import SwiftUI

/// 使用者設定（存在 UserDefaults）
@MainActor
final class AppSettings: ObservableObject {
    static let shared = AppSettings()
    private let d = UserDefaults.standard

    @Published var componentTap: Bool { didSet { d.set(componentTap, forKey: "componentTap") } }
    @Published var touchFx: Bool { didSet { d.set(touchFx, forKey: "touchFx") } }
    @Published var showFab: Bool { didSet { d.set(showFab, forKey: "showFab") } }
    @Published var showClock: Bool { didSet { d.set(showClock, forKey: "showClock") } }
    @Published var sfxVolume: Double { didSet { d.set(sfxVolume, forKey: "sfxVolume"); SoundEngine.shared.sfxVolume = Float(sfxVolume) } }
    @Published var musicVolume: Double { didSet { d.set(musicVolume, forKey: "musicVolume"); SoundEngine.shared.musicVolume = Float(musicVolume) } }
    @Published var rotateOn: Bool { didSet { d.set(rotateOn, forKey: "rotateOn"); if rotateOn { resetRotation() } } }
    @Published var rotateEvery: Int { didSet { d.set(rotateEvery, forKey: "rotateEvery"); resetRotation() } }
    @Published var rotateInDays: Bool { didSet { d.set(rotateInDays, forKey: "rotateInDays"); resetRotation() } }
    @Published var rotateAnchor: Date { didSet { d.set(rotateAnchor, forKey: "rotateAnchor") } }
    @Published var appearance: Appearance { didSet { d.set(appearance.rawValue, forKey: "appearance") } }
    @Published var compSounds: [ComponentKind: SoundID] {
        didSet {
            let raw = Dictionary(uniqueKeysWithValues: compSounds.map { ($0.key.rawValue, $0.value.rawValue) })
            d.set(raw, forKey: "compSounds")
        }
    }

    private init() {
        d.register(defaults: [
            "componentTap": true, "touchFx": true, "showFab": true, "showClock": true,
            "sfxVolume": 0.7, "musicVolume": 0.8, "rotateOn": false, "rotateEvery": 1, "rotateInDays": true,
        ])
        componentTap = d.bool(forKey: "componentTap")
        touchFx = d.bool(forKey: "touchFx")
        showFab = d.bool(forKey: "showFab")
        showClock = d.bool(forKey: "showClock")
        sfxVolume = d.double(forKey: "sfxVolume")
        musicVolume = d.double(forKey: "musicVolume")
        rotateOn = d.bool(forKey: "rotateOn")
        rotateEvery = max(1, d.integer(forKey: "rotateEvery"))
        rotateInDays = d.bool(forKey: "rotateInDays")
        rotateAnchor = (d.object(forKey: "rotateAnchor") as? Date) ?? Date()
        appearance = Appearance(rawValue: d.string(forKey: "appearance") ?? "") ?? .system
        var sounds: [ComponentKind: SoundID] = [:]
        let raw = d.dictionary(forKey: "compSounds") as? [String: String] ?? [:]
        for kind in ComponentKind.allCases {
            sounds[kind] = raw[kind.rawValue].flatMap(SoundID.init(rawValue:)) ?? kind.defaultSound
        }
        compSounds = sounds
    }

    func sound(for kind: ComponentKind) -> SoundID { compSounds[kind] ?? kind.defaultSound }

    private func resetRotation() { rotateAnchor = Date() }

    var rotationPeriod: TimeInterval { Double(rotateEvery) * (rotateInDays ? 86_400 : 3_600) }

    /// 依頻率目前該顯示第幾張收藏、下次更新時間
    func rotation(count: Int, now: Date = Date()) -> (index: Int, next: Date)? {
        guard rotateOn, count > 0 else { return nil }
        let k = Int(floor(now.timeIntervalSince(rotateAnchor) / rotationPeriod))
        let index = ((k % count) + count) % count
        return (index, rotateAnchor.addingTimeInterval(Double(k + 1) * rotationPeriod))
    }
}
