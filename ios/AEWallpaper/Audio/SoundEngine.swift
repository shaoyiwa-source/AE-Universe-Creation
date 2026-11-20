import AVFoundation

/// 音效（即時合成的三款可愛聲音）＋匯入音樂＋節奏偵測＋匯出用離線混音
final class SoundEngine: @unchecked Sendable {
    static let shared = SoundEngine()

    let sampleRate: Double = 44_100
    let monoFormat: AVAudioFormat
    private(set) var buffers: [SoundID: AVAudioPCMBuffer] = [:]

    private let engine = AVAudioEngine()
    private let sfxMixer = AVAudioMixerNode()
    private var sfxNodes: [AVAudioPlayerNode] = []
    private var nextNode = 0

    private let musicNode = AVAudioPlayerNode()
    private(set) var musicFile: AVAudioFile?
    private(set) var musicURL: URL?
    private(set) var isMusicPlaying = false
    private var generation = 0

    private let lock = NSLock()
    private var level = 0.0, beat = 0.0, average = 0.0

    var sfxVolume: Float = 0.7 { didSet { sfxMixer.outputVolume = sfxVolume } }
    var musicVolume: Float = 0.8 { didSet { musicNode.volume = musicVolume } }

    var musicName: String { musicURL?.deletingPathExtension().lastPathComponent ?? "" }

    /// 目前音樂的節奏（給動態主題用）
    var pulse: MusicPulse {
        lock.lock(); defer { lock.unlock() }
        if !isMusicPlaying { level *= 0.9; beat *= 0.85 }
        return MusicPulse(playing: isMusicPlaying, level: level, beat: beat)
    }

    private init() {
        monoFormat = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
        for id in SoundID.playable { buffers[id] = Synth.render(id, sampleRate: sampleRate, format: monoFormat) }

        engine.attach(sfxMixer)
        engine.connect(sfxMixer, to: engine.mainMixerNode, format: nil)
        for _ in 0..<6 {
            let node = AVAudioPlayerNode()
            engine.attach(node)
            engine.connect(node, to: sfxMixer, format: monoFormat)
            sfxNodes.append(node)
        }
        engine.attach(musicNode)
        engine.connect(musicNode, to: engine.mainMixerNode, format: nil)
        sfxMixer.outputVolume = sfxVolume
        musicNode.volume = musicVolume
        startEngine()

        NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
            self?.startEngine()
        }
        NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  AVAudioSession.InterruptionType(rawValue: raw) == .ended else { return }
            self?.startEngine()
        }
    }

    private func startEngine() {
        guard !engine.isRunning else { return }
        engine.prepare()
        try? engine.start()
    }

    // MARK: 音效

    func play(_ id: SoundID) {
        guard id != .none, let buffer = buffers[id] else { return }
        startEngine()
        let node = sfxNodes[nextNode]
        nextNode = (nextNode + 1) % sfxNodes.count
        node.scheduleBuffer(buffer, at: nil, options: .interrupts, completionHandler: nil)
        node.play()
    }

    // MARK: 音樂

    func loadMusic(_ url: URL) throws {
        let file = try AVAudioFile(forReading: url)
        stopMusic()
        musicNode.removeTap(onBus: 0)
        engine.disconnectNodeOutput(musicNode)
        engine.connect(musicNode, to: engine.mainMixerNode, format: file.processingFormat)
        musicNode.installTap(onBus: 0, bufferSize: 1024, format: file.processingFormat) { [weak self] buffer, _ in
            self?.analyze(buffer)
        }
        musicFile = file
        musicURL = url
        generation += 1
        scheduleLoop(generation)
    }

    private func scheduleLoop(_ gen: Int) {
        guard let file = musicFile else { return }
        musicNode.scheduleFile(file, at: nil, completionCallbackType: .dataPlayedBack) { [weak self] _ in
            DispatchQueue.main.async {
                guard let self, self.generation == gen, self.isMusicPlaying else { return }
                self.scheduleLoop(gen)
            }
        }
    }

    func playMusic() {
        guard musicFile != nil else { return }
        startEngine()
        musicNode.play()
        isMusicPlaying = true
    }

    func pauseMusic() {
        musicNode.pause()
        isMusicPlaying = false
    }

    private func stopMusic() {
        isMusicPlaying = false
        musicNode.stop()
    }

    @discardableResult
    func toggleMusic() -> Bool {
        if isMusicPlaying { pauseMusic() } else { playMusic() }
        return isMusicPlaying
    }

    /// 目前播放到第幾個 sample（以音樂檔的取樣率）
    var musicPosition: AVAudioFramePosition {
        guard let file = musicFile, file.length > 0,
              let nodeTime = musicNode.lastRenderTime,
              let playerTime = musicNode.playerTime(forNodeTime: nodeTime) else { return 0 }
        return max(0, playerTime.sampleTime) % file.length
    }

    private func analyze(_ buffer: AVAudioPCMBuffer) {
        guard let data = buffer.floatChannelData?[0] else { return }
        let n = Int(buffer.frameLength)
        guard n > 0 else { return }
        var sum: Float = 0
        for i in 0..<n { sum += data[i] * data[i] }
        let rms = Double(sqrt(sum / Float(n)))
        let value = min(1, rms * 3.2)
        lock.lock()
        level += (value - level) * 0.35
        average += (value - average) * 0.05
        if value > average * 1.3 && value > 0.25 { beat = 1 } else { beat *= 0.8 }
        lock.unlock()
    }

    // MARK: 匯出用：離線混音（音樂＋錄影時觸發的音效）

    func renderMix(duration: Double, events: [(time: Double, sound: SoundID)], includeMusic: Bool, to url: URL) throws {
        let offline = AVAudioEngine()
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2)!
        try offline.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 4096)

        var players: [AVAudioPlayerNode] = []
        if includeMusic, let src = musicURL {
            let file = try AVAudioFile(forReading: src)
            let node = AVAudioPlayerNode()
            offline.attach(node)
            offline.connect(node, to: offline.mainMixerNode, format: file.processingFormat)
            node.volume = musicVolume
            var start = musicPosition
            var remaining = AVAudioFramePosition(duration * file.processingFormat.sampleRate)
            while remaining > 0, file.length > 0 {
                let count = min(remaining, file.length - start)
                node.scheduleSegment(file, startingFrame: start, frameCount: AVAudioFrameCount(count), at: nil)
                remaining -= count
                start = 0
            }
            players.append(node)
        }

        let sfx = AVAudioMixerNode()
        offline.attach(sfx)
        offline.connect(sfx, to: offline.mainMixerNode, format: nil)
        sfx.outputVolume = sfxVolume
        for event in events where event.time < duration {
            guard let buffer = buffers[event.sound] else { continue }
            let node = AVAudioPlayerNode()
            offline.attach(node)
            offline.connect(node, to: sfx, format: monoFormat)
            node.scheduleBuffer(buffer, at: AVAudioTime(sampleTime: AVAudioFramePosition(event.time * sampleRate), atRate: sampleRate))
            players.append(node)
        }

        try offline.start()
        players.forEach { $0.play() }
        let output = try AVAudioFile(forWriting: url, settings: format.settings)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: offline.manualRenderingFormat,
                                            frameCapacity: offline.manualRenderingMaximumFrameCount) else { throw AEError.badData }
        let total = AVAudioFramePosition(duration * sampleRate)
        while offline.manualRenderingSampleTime < total {
            let frames = min(AVAudioFrameCount(total - offline.manualRenderingSampleTime), buffer.frameCapacity)
            switch try offline.renderOffline(frames, to: buffer) {
            case .success: try output.write(from: buffer)
            case .error: throw AEError.message("混音失敗")
            default: break
            }
        }
        players.forEach { $0.stop() }
        offline.stop()
    }
}

/// 三款可愛音效的合成（與網頁版相同的音色）
enum Synth {
    private enum Wave { case sine, triangle }

    static func render(_ id: SoundID, sampleRate sr: Double, format: AVAudioFormat) -> AVAudioPCMBuffer? {
        let length = Int(sr * 1.0)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(length)),
              let out = buffer.floatChannelData?[0] else { return nil }
        buffer.frameLength = AVAudioFrameCount(length)
        for i in 0..<length { out[i] = 0 }

        func tone(start: Double, duration: Double, peak: Double, attack: Double, decay: Double,
                  wave: Wave, freq: (Double) -> Double) {
            let s0 = Int(start * sr)
            let count = min(Int(duration * sr), length - s0)
            guard count > 0 else { return }
            var phase = 0.0
            for n in 0..<count {
                let t = Double(n) / sr
                let env = t < attack ? peak * t / attack : peak * pow(0.0001 / peak, min(1, (t - attack) / decay))
                phase += 2 * .pi * freq(t) / sr
                let p = phase.truncatingRemainder(dividingBy: 2 * .pi)
                let v: Double
                switch wave {
                case .sine: v = sin(p)
                case .triangle: v = 2 * abs(2 * (p / (2 * .pi) - floor(p / (2 * .pi) + 0.5))) - 1
                }
                out[s0 + n] += Float(v * env * 0.6)
            }
        }

        switch id {
        case .pop:
            for (i, d) in [0.0, 0.085].enumerated() {
                let f0 = 320 + Double(i) * 180, f1 = 1100 + Double(i) * 380
                tone(start: d, duration: 0.16, peak: 0.9, attack: 0.008, decay: 0.11, wave: .sine) { t in
                    f0 * pow(f1 / f0, min(1, t / 0.07))
                }
            }
        case .bell:
            for (i, f) in [1318.5, 1568, 2093, 2637].enumerated() {
                let d = Double(i) * 0.07
                tone(start: d, duration: 0.9, peak: 0.5, attack: 0.004, decay: 0.7, wave: .triangle) { _ in f }
                tone(start: d, duration: 0.4, peak: 0.12, attack: 0.004, decay: 0.25, wave: .sine) { _ in f * 2.76 }
            }
        case .chirp:
            for d in [0.0, 0.13] {
                tone(start: d, duration: 0.12, peak: 0.45, attack: 0.006, decay: 0.09, wave: .sine) { t in
                    let base = t < 0.04 ? 2300 * pow(3600.0 / 2300, t / 0.04) : 3600 * pow(2500.0 / 3600, min(1, (t - 0.04) / 0.05))
                    return base + 180 * sin(2 * .pi * 38 * t)
                }
            }
        case .none:
            break
        }
        return buffer
    }
}
