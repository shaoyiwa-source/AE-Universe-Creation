import Foundation
import Photos

/// 把圖片、影片、原況照片存進「照片」
enum PhotoSaver {
    static func requestAddAccess() async throws {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            throw AEError.message("請到 設定 → 隱私權 → 照片，允許 AE動態桌布「加入照片」")
        }
    }

    static func saveImage(_ data: Data) async throws {
        try await requestAddAccess()
        try await PHPhotoLibrary.shared().performChanges {
            PHAssetCreationRequest.forAsset().addResource(with: .photo, data: data, options: nil)
        }
    }

    static func saveVideo(_ url: URL) async throws {
        try await requestAddAccess()
        try await PHPhotoLibrary.shared().performChanges {
            let options = PHAssetResourceCreationOptions()
            options.shouldMoveFile = true
            PHAssetCreationRequest.forAsset().addResource(with: .video, fileURL: url, options: options)
        }
    }

    static func saveLivePhoto(photoURL: URL, videoURL: URL) async throws {
        try await requestAddAccess()
        try await PHPhotoLibrary.shared().performChanges {
            let request = PHAssetCreationRequest.forAsset()
            let photoOptions = PHAssetResourceCreationOptions()
            photoOptions.shouldMoveFile = true
            let videoOptions = PHAssetResourceCreationOptions()
            videoOptions.shouldMoveFile = true
            request.addResource(with: .photo, fileURL: photoURL, options: photoOptions)
            request.addResource(with: .pairedVideo, fileURL: videoURL, options: videoOptions)
        }
    }
}
