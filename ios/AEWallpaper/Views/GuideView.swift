import SwiftUI

enum GuideKind: String, Identifiable {
    case lockScreen, shortcut, rotation
    var id: String { rawValue }
}

/// 說明頁：鎖定畫面按鈕、一鍵設為桌布捷徑、系統桌布自動更換
struct GuideView: View {
    let kind: GuideKind
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    Text(title).font(.aeDisplay(30)).foregroundStyle(Color.aeInk)
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").frame(width: 36, height: 36).overlay(Rectangle().stroke(Color.aeLine))
                    }
                    .foregroundStyle(Color.aeInk)
                    .accessibilityLabel("關閉")
                }
                content
            }
            .padding(20)
        }
        .background(Color.aeBg)
        .presentationDetents([.large])
    }

    private var title: String {
        switch kind {
        case .lockScreen: return "鎖定畫面按鈕"
        case .shortcut: return "建立「\(ShortcutInfo.name)」捷徑"
        case .rotation: return "系統桌布自動更換"
        }
    }

    @ViewBuilder private var content: some View {
        switch kind {
        case .lockScreen:
            AEHint("AE動態桌布 內建「AE互動」按鈕（iOS 18 以上）。按下並解鎖後，會直接進入全螢幕互動模式。")
            AEEyebrow("加到鎖定畫面")
            steps(["在鎖定畫面長按 →「自訂」→ 選「鎖定畫面」",
                   "點左下或右下按鈕上的「－」移除原本的（手電筒／相機）",
                   "點「＋」→ 搜尋「AE」→ 選擇「AE互動」→ 完成"])
            AEEyebrow("也可以放在控制中心")
            steps(["從右上角往下滑 → 長按空白處 →「加入控制項」→ 搜尋「AE互動」"])
            AEEyebrow("隱藏這個按鈕")
            steps(["鎖定畫面：進入「自訂」，按「－」移除 AE互動 按鈕",
                   "App 內：在「設定」關閉「顯示互動按鈕」，互動模式就不會出現 AE 浮動按鈕（長按畫面 1 秒可暫時叫回）"])
        case .shortcut:
            AEHint("只需要做一次。之後在「匯出」按「設為桌布」，就會把目前畫面設成 iPhone 桌布。")
            steps(["打開「捷徑」App → 右上角「＋」",
                   "點「加入動作」，搜尋「取得剪貼板」並加入",
                   "再搜尋「設定背景圖片」並加入，選擇要套用的背景圖片",
                   "點「設定背景圖片」旁的箭頭，關閉「顯示預覽」",
                   "把捷徑名稱改成「\(ShortcutInfo.name)」（要一模一樣）"])
            AENote("第一次執行時，iPhone 會詢問是否允許讀取剪貼板、更改背景圖片，請選「一律允許」。\niOS 不允許任何 App 直接更換桌布，所以要透過「捷徑」。這個方式設定的是靜態圖片；會動的桌布請用「製作原況照片」。")
        case .rotation:
            AEHint("iOS 不允許 App 在背景替你換桌布。下面兩種做法可以讓 iPhone 依頻率自動更新：")
            AEEyebrow("方法 A：相片隨機顯示（最推薦）")
            steps(["在「匯出」把喜歡的桌布存到「照片」，放進同一本相簿",
                   "設定 → 背景圖片 →「＋ 新增背景圖片」→「相片隨機顯示」",
                   "選擇那本相簿，頻率選「每小時」或「每天」"])
            AEEyebrow("方法 B：捷徑自動化＋App 輪播")
            steps(["在 App「設定」開啟「自動更換桌布」，選好每幾小時／幾天",
                   "捷徑 App → 自動化 → 新增「特定時間」→ 動作「打開 URL」：aewallpaper://play",
                   "到點會打開互動模式，自動顯示當下該輪到的那張桌布"])
        }
    }

    private func steps(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, text in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("\(i + 1)").font(.aeDisplay(20)).foregroundStyle(Color.aeAccent).frame(width: 18)
                    Text(text).font(.system(size: 14)).foregroundStyle(Color.aeInk).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}
