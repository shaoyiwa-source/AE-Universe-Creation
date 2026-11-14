import SwiftUI
import UIKit

// AE Universe Creation VI v1.0：紙白／深綠、Cormorant Garamond 標題、細線、方正按鈕

private func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
    Color(UIColor { trait in
        let hex = trait.userInterfaceStyle == .dark ? dark : light
        return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255,
                       green: CGFloat((hex >> 8) & 0xFF) / 255,
                       blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    })
}

extension Color {
    static let aeBg = dynamic(0xFCFCFA, 0x141C18)
    static let aePaper = dynamic(0xF1F2EE, 0x202C25)
    static let aeInk = dynamic(0x202622, 0xF4F4ED)
    static let aeMuted = dynamic(0x626B65, 0xBBC6BD)
    static let aeLine = dynamic(0xD5DAD4, 0x435148)
    static let aeAccent = dynamic(0x244D3D, 0xD6E4D9)
    static let aeOnAccent = dynamic(0xFFFFFF, 0x15221A)
    static let aeDanger = dynamic(0x8A2F2F, 0xE6A3A3)
}

extension Font {
    /// 標題字：Cormorant Garamond（App 內建）
    static func aeDisplay(_ size: CGFloat, semibold: Bool = false) -> Font {
        .custom(semibold ? "CormorantGaramond-SemiBold" : "CormorantGaramond-Medium", size: size)
    }
    static let aeBody = Font.system(size: 15)
    static let aeSmall = Font.system(size: 12)
    static let aeEyebrow = Font.system(size: 11, weight: .medium)
}

/// 方正按鈕：實心（主要）或細線框
struct AEButtonStyle: ButtonStyle {
    var filled = false
    var fullWidth = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13.5))
            .tracking(0.5)
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .foregroundStyle(filled ? Color.aeOnAccent : Color.aeAccent)
            .background(filled ? Color.aeAccent : Color.clear)
            .overlay(Rectangle().stroke(Color.aeAccent, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.7 : 1)
            .contentShape(Rectangle())
    }
}

/// 可切換的選項小方塊
struct AEChip: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13))
                .lineLimit(1)
                .padding(.horizontal, 12)
                .frame(minHeight: 38)
                .foregroundStyle(selected ? Color.aeOnAccent : Color.aeInk)
                .background(selected ? Color.aeAccent : Color.clear)
                .overlay(Rectangle().stroke(selected ? Color.aeAccent : Color.aeLine, lineWidth: 1))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// 面板中的段落標題
struct AESectionTitle: View {
    let title: String
    var note: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.aeDisplay(24)).foregroundStyle(Color.aeInk)
            Spacer()
            if let note {
                Text(note).font(.system(size: 11)).tracking(0.6).foregroundStyle(Color.aeMuted)
            }
        }
        .padding(.top, 4)
        .padding(.bottom, 6)
    }
}

struct AEHint: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(.aeSmall).foregroundStyle(Color.aeMuted).lineSpacing(4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }
}

struct AEEyebrow: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased()).font(.aeEyebrow).tracking(2).foregroundStyle(Color.aeMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 14)
    }
}

/// 說明卡（左側深綠細線）
struct AENote: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(.system(size: 12.5)).foregroundStyle(Color.aeMuted).lineSpacing(5)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Color.aePaper)
            .overlay(alignment: .leading) { Rectangle().fill(Color.aeAccent).frame(width: 2) }
    }
}

/// 深色／淺色外觀
enum Appearance: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
    var name: String {
        switch self {
        case .system: return "跟隨系統"
        case .light: return "淺色"
        case .dark: return "深色"
        }
    }
    var scheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}
