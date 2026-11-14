import SwiftUI
import AVFoundation
import UIKit

/// 錄影時記下的互動（匯出時依時間重播）
struct RecordedEvent {
    enum Kind {
        case tap(UUID)
        case sparkle(CGPoint)
    }
    var time: Double
    var kind: Kind
    var sound: SoundID
}

/// 把場景畫成圖片或影片
@MainActor
enum Exporter {
    static let fps = 30

    private struct FrameView: View {
        let engine: SceneEngine
        let time: Double
        let dt: Double

        var body: some View {
            Canvas(opaque: true) { ctx, _ in
                engine.render(in: ctx, time: time, fixedDt: dt)
            }
            .frame(width: Canvas2340.width, height: Canvas2340.height)
        }
    }

    static func renderFrame(_ engine: SceneEngine, time: Double, dt: Double) -> CGImage? {
        let renderer = ImageRenderer(content: FrameView(engine: engine, time: time, dt: dt))
        renderer.scale = 1
        renderer.isOpaque = true
        renderer.proposedSize = ProposedViewSize(Canvas2340.size)
        return renderer.cgImage
    }

    /// 1080×2340 的靜態桌布
    static func still(_ scene: WallpaperScene) -> UIImage? {
        let engine = SceneEngine(scene: scene)
        let t = Date().timeIntervalSinceReferenceDate
        _ = renderFrame(engine, time: t - 1 / 30, dt: 1 / 30)   // 先跑一格讓粒子、主題就位
        return renderFrame(engine, time: t, dt: 1 / 30).map { UIImage(cgImage: $0) }
    }

    static func thumbnail(_ scene: WallpaperScene) -> UIImage? {
        guard let full = still(scene) else { return nil }
        let size = CGSize(width: 180, height: 390)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in full.draw(in: CGRect(origin: .zero, size: size)) }
    }

    /// 依照錄影時的互動重新算出每一格，產生影片；回傳影片位置與第一格（原況照片的靜態圖）
    static func makeVideo(scene: WallpaperScene, duration: Double, events: [RecordedEvent],
                          includeAudio: Bool, includeMusic: Bool,
                          progress: @escaping (Double) -> Void) async throws -> (url: URL, firstFrame: UIImage?) {
        let engine = SceneEngine(scene: scene)
        engine.musicOverride = MusicPulse()
        let tmp = FileManager.default.temporaryDirectory
        let videoURL = tmp.appendingPathComponent(UUID().uuidString).appendingPathExtension("mov")

        let writer = try AVAssetWriter(outputURL: videoURL, fileType: .mov)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(Canvas2340.width),
            AVVideoHeightKey: Int(Canvas2340.height),
            AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 10_000_000],
        ])
        input.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: Int(Canvas2340.width),
            kCVPixelBufferHeightKey as String: Int(Canvas2340.height),
        ])
        writer.add(input)
        guard writer.startWriting() else { throw writer.error ?? AEError.message("無法建立影片") }
        writer.startSession(atSourceTime: .zero)

        let frames = Int(duration * Double(fps))
        let dt = 1 / Double(fps)
        let base = Date().timeIntervalSinceReferenceDate
        let sorted = events.sorted { $0.time < $1.time }
        var next = 0
        var first: UIImage?

        for f in 0..<frames {
            let t = Double(f) * dt
            while next < sorted.count, sorted[next].time <= t {
                switch sorted[next].kind {
                case .tap(let id):
                    if let item = scene.items.first(where: { $0.id == id }) { engine.tap(item, at: base + sorted[next].time) }
                case .sparkle(let point):
                    engine.sparkle(at: point)
                }
                next += 1
            }
            guard let image = renderFrame(engine, time: base + t, dt: dt) else { continue }
            if f == 0 { first = UIImage(cgImage: image) }
            while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 2_000_000) }
            guard let pool = adaptor.pixelBufferPool, let buffer = pixelBuffer(from: image, pool: pool) else { continue }
            adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(f), timescale: CMTimeScale(fps)))
            progress(Double(f + 1) / Double(frames) * (includeAudio ? 0.85 : 1))
            if f % 3 == 0 { await Task.yield() }
        }
        input.markAsFinished()
        await writer.finishWriting()
        guard writer.status == .completed else { throw writer.error ?? AEError.message("影片寫入失敗") }
        guard includeAudio else { return (videoURL, first) }

        // 音樂＋音效
        let audioURL = tmp.appendingPathComponent(UUID().uuidString).appendingPathExtension("caf")
        try SoundEngine.shared.renderMix(duration: duration,
                                         events: sorted.map { (time: $0.time, sound: $0.sound) },
                                         includeMusic: includeMusic, to: audioURL)
        let output = tmp.appendingPathComponent(UUID().uuidString).appendingPathExtension("mp4")
        try await merge(video: videoURL, audio: audioURL, to: output)
        progress(1)
        return (output, first)
    }

    private static func pixelBuffer(from image: CGImage, pool: CVPixelBufferPool) -> CVPixelBuffer? {
        var buffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
        guard let buffer else { return nil }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buffer),
                                  width: CVPixelBufferGetWidth(buffer), height: CVPixelBufferGetHeight(buffer),
                                  bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)
        else { return nil }
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: CVPixelBufferGetWidth(buffer), height: CVPixelBufferGetHeight(buffer)))
        return buffer
    }

    private static func merge(video: URL, audio: URL, to output: URL) async throws {
        let composition = AVMutableComposition()
        let videoAsset = AVURLAsset(url: video), audioAsset = AVURLAsset(url: audio)
        let duration = try await videoAsset.load(.duration)
        let range = CMTimeRange(start: .zero, duration: duration)
        if let src = try await videoAsset.loadTracks(withMediaType: .video).first,
           let dst = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) {
            try dst.insertTimeRange(range, of: src, at: .zero)
        }
        if let src = try await audioAsset.loadTracks(withMediaType: .audio).first,
           let dst = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
            let audioDuration = try await audioAsset.load(.duration)
            try dst.insertTimeRange(CMTimeRange(start: .zero, duration: CMTimeMinimum(duration, audioDuration)), of: src, at: .zero)
        }
        guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
            throw AEError.message("無法匯出影片")
        }
        session.outputURL = output
        session.outputFileType = .mp4
        await session.export()
        guard session.status == .completed else { throw session.error ?? AEError.message("影片合成失敗") }
    }
}
