import Foundation
import AVFoundation
import ImageIO
import UniformTypeIdentifiers

/// 把「一張靜態圖＋一段影片」組成原況照片（Live Photo）。
///
/// 原況照片 = JPEG（MakerApple 字典第 17 項寫入識別碼）
///           + MOV（com.apple.quicktime.content.identifier 寫入同一個識別碼，
///                  並有一條 still-image-time 的時間中繼資料軌）。
/// 兩個檔案以 .photo 與 .pairedVideo 一起加入「照片」，系統就會認成同一張原況照片。
enum LivePhotoMaker {
    static func save(imageData: Data, videoURL: URL) async throws {
        let identifier = UUID().uuidString
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(identifier, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let photoURL = dir.appendingPathComponent("IMG.JPG")
        let movURL = dir.appendingPathComponent("IMG.MOV")

        try writePhoto(imageData, identifier: identifier, to: photoURL)
        try await writeVideo(from: videoURL, identifier: identifier, to: movURL)
        try? FileManager.default.removeItem(at: videoURL)
        try await PhotoSaver.saveLivePhoto(photoURL: photoURL, videoURL: movURL)
    }

    // MARK: - 照片

    static func writePhoto(_ data: Data, identifier: String, to url: URL) throws {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
              let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
        else { throw AEError.message("無法讀取原況照片的靜態圖") }

        let properties: [CFString: Any] = [
            kCGImagePropertyMakerAppleDictionary: ["17": identifier],
            kCGImageDestinationLossyCompressionQuality: 0.95,
        ]
        CGImageDestinationAddImage(dest, image, properties as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { throw AEError.message("無法寫入原況照片的靜態圖") }
    }

    // MARK: - 影片

    static func writeVideo(from input: URL, identifier: String, to output: URL) async throws {
        let asset = AVURLAsset(url: input)
        guard let track = try await asset.loadTracks(withMediaType: .video).first else {
            throw AEError.message("影片中沒有畫面")
        }
        let size = try await track.load(.naturalSize)
        let transform = try await track.load(.preferredTransform)

        let reader = try AVAssetReader(asset: asset)
        let readerOutput = AVAssetReaderTrackOutput(track: track, outputSettings: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        ])
        readerOutput.alwaysCopiesSampleData = false
        reader.add(readerOutput)

        let writer = try AVAssetWriter(outputURL: output, fileType: .mov)
        writer.metadata = [contentIdentifierItem(identifier)]

        let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(size.width.rounded()) / 2 * 2,
            AVVideoHeightKey: Int(size.height.rounded()) / 2 * 2,
        ])
        videoInput.transform = transform
        videoInput.expectsMediaDataInRealTime = false
        writer.add(videoInput)

        let metadataInput = try stillImageTimeInput()
        let adaptor = AVAssetWriterInputMetadataAdaptor(assetWriterInput: metadataInput)
        writer.add(metadataInput)

        guard writer.startWriting() else { throw writer.error ?? AEError.message("無法建立原況照片影片") }
        guard reader.startReading() else { throw reader.error ?? AEError.message("無法讀取影片") }

        // 以第一格的時間作為起點（網頁錄影的時間不一定從 0 開始）
        guard let first = readerOutput.copyNextSampleBuffer() else { throw AEError.message("影片是空的") }
        let start = CMSampleBufferGetPresentationTimeStamp(first)
        writer.startSession(atSourceTime: start)

        // 靜態圖對應影片的第一格
        let stillItem = AVMutableMetadataItem()
        stillItem.keySpace = AVMetadataKeySpace(rawValue: "mdta")
        stillItem.key = "com.apple.quicktime.still-image-time" as NSString
        stillItem.value = NSNumber(value: Int8(0))
        stillItem.dataType = "com.apple.metadata.datatype.int8"
        adaptor.append(AVTimedMetadataGroup(items: [stillItem],
                                            timeRange: CMTimeRange(start: start, duration: CMTime(value: 1, timescale: 100))))
        metadataInput.markAsFinished()

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            var pending: CMSampleBuffer? = first
            let queue = DispatchQueue(label: "com.aeuniverse.wallpaper.livephoto")
            videoInput.requestMediaDataWhenReady(on: queue) {
                while videoInput.isReadyForMoreMediaData {
                    let buffer = pending ?? readerOutput.copyNextSampleBuffer()
                    pending = nil
                    if let buffer {
                        if !videoInput.append(buffer) {
                            reader.cancelReading()
                            videoInput.markAsFinished()
                            writer.cancelWriting()
                            continuation.resume(throwing: writer.error ?? AEError.message("寫入影片失敗"))
                            return
                        }
                    } else {
                        videoInput.markAsFinished()
                        writer.finishWriting {
                            if writer.status == .completed {
                                continuation.resume()
                            } else {
                                continuation.resume(throwing: writer.error ?? AEError.message("完成影片失敗"))
                            }
                        }
                        return
                    }
                }
            }
        }
    }

    private static func contentIdentifierItem(_ identifier: String) -> AVMetadataItem {
        let item = AVMutableMetadataItem()
        item.keySpace = .quickTimeMetadata
        item.key = AVMetadataKey.quickTimeMetadataKeyContentIdentifier.rawValue as NSString
        item.value = identifier as NSString
        item.dataType = "com.apple.metadata.datatype.UTF-8"
        return item
    }

    private static func stillImageTimeInput() throws -> AVAssetWriterInput {
        let spec: [String: Any] = [
            kCMMetadataFormatDescriptionMetadataSpecificationKey_Identifier as String:
                "mdta/com.apple.quicktime.still-image-time",
            kCMMetadataFormatDescriptionMetadataSpecificationKey_DataType as String:
                "com.apple.metadata.datatype.int8",
        ]
        var description: CMFormatDescription?
        let status = CMMetadataFormatDescriptionCreateWithMetadataSpecifications(
            allocator: kCFAllocatorDefault,
            metadataType: kCMMetadataFormatType_Boxed,
            metadataSpecifications: [spec] as CFArray,
            formatDescriptionOut: &description)
        guard status == noErr, let description else { throw AEError.message("無法建立原況照片中繼資料") }
        return AVAssetWriterInput(mediaType: .metadata, outputSettings: nil, sourceFormatHint: description)
    }
}
