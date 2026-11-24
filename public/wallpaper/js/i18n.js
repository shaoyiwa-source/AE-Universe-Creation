// AE動態桌布 — 中英文字（與 AE 官網共用 ae-language 設定）
let lang = 'zh';
try {
  const saved = localStorage.getItem('ae-language');
  lang = saved === 'en' || saved === 'zh' ? saved : (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
} catch (e) { /* ignore */ }

export const getLang = () => lang;
export function setLang(l) {
  lang = l;
  try { localStorage.setItem('ae-language', l); } catch (e) { /* ignore */ }
  document.documentElement.lang = l === 'zh' ? 'zh-Hant' : 'en';
}

const T = {
  // 頁首、選單
  menu: ['選單', 'Menu'],
  home: ['回到 AE Universe Creation 官網', 'Back to AE Universe Creation'],
  langSwitch: ['EN', '中文'],
  undo: ['復原', 'Undo'],
  redo: ['重做', 'Redo'],
  preview: ['預覽', 'Preview'],
  close: ['關閉', 'Close'],
  darkOn: ['深色外觀', 'Dark appearance'],
  darkOff: ['淺色外觀', 'Light appearance'],
  mSettings: ['互動設定', 'Interaction'],
  mSettingsSub: ['觸碰特效、互動按鈕、時鐘', 'Touch effects, button and clock'],
  mRotate: ['桌布更新頻率', 'Wallpaper rotation'],
  mRotateSub: ['每幾小時／幾天自動換一張', 'Change every few hours or days'],
  mLock: ['鎖定畫面按鈕', 'Lock Screen button'],
  mLockSub: ['從鎖定畫面一鍵打開互動模式', 'Open interactive mode from the Lock Screen'],
  mShortcut: ['一鍵設為桌布', 'One-tap wallpaper'],
  mShortcutSub: ['建立「AE設桌布」捷徑', 'Create the “AE設桌布” shortcut'],
  mInstall: ['加到主畫面', 'Add to Home Screen'],
  mInstallSub: ['像 App 一樣全螢幕使用', 'Use it full screen, like an app'],
  mSite: ['AE Universe Creation 官網', 'AE Universe Creation'],
  mSiteSub: ['回到作品與收藏', 'Back to the artworks and collections'],

  // 步驟
  s1: ['底圖', 'Photo'],
  s2: ['裝飾', 'Decorate'],
  s3: ['風格', 'Style'],
  s4: ['完成', 'Finish'],
  stepOf: ['STEP {0} / 04', 'STEP {0} / 04'],
  next: ['下一步：{0}', 'Next: {0}'],
  back: ['上一步', 'Back'],
  startOver: ['回到第一步', 'Back to step 1'],

  // 01 底圖
  h1: ['選一張底圖', 'Choose a photo'],
  p1: ['用你的照片，或先用預設底圖試試看。直式照片會自動裁成 iPhone 全螢幕比例。', 'Use your own photo, or start with the default background. Portrait photos are cropped to fit the iPhone screen.'],
  importPhoto: ['匯入照片', 'Import a photo'],
  defaultBg: ['預設底圖', 'Default background'],
  usingDefault: ['目前使用預設底圖', 'Using the default background'],
  usingPhoto: ['目前使用你的照片', 'Using your photo'],
  myGallery: ['我的收藏', 'My wallpapers'],
  galleryCount: ['{0} 張', '{0} saved'],
  galleryEmpty: ['還沒有收藏。做好後按右下角「完成」→「存進我的收藏」，就會出現在這裡。', 'Nothing saved yet. Tap Finish → Save to My wallpapers and it will appear here.'],
  galleryHint: ['點縮圖可以載入繼續編輯。', 'Tap a wallpaper to keep editing it.'],
  current: ['目前', 'Now'],
  delete: ['刪除', 'Delete'],
  confirmDelete: ['要刪除這張收藏的桌布嗎？', 'Delete this saved wallpaper?'],

  // 02 裝飾
  h2: ['加上會動的裝飾', 'Add moving details'],
  p2: ['點一下就加到畫面上。拖曳移動、雙指縮放旋轉，點元件會動也會發出聲音。', 'Tap to add. Drag to move, pinch to resize or rotate. Tap a companion to hear it.'],
  subComp: ['動態元件', 'Companions'],
  subSym: ['符號', 'Symbols'],
  subText: ['文字', 'Text'],
  subDraw: ['畫筆', 'Draw'],
  subImage: ['圖片', 'Images'],
  compSound: ['這個元件的聲音', 'Sound for this companion'],
  compSoundHint: ['點選畫面上的元件，就能換它的聲音。', 'Select a companion on the canvas to change its sound.'],
  mute: ['無聲', 'Silent'],
  textPh: ['輸入想寫的字，例如：今天也要開心 ♡', 'Type something, e.g. Have a lovely day ♡'],
  addText: ['加入文字', 'Add text'],
  updateText: ['更新文字', 'Update text'],
  needText: ['先輸入文字喔', 'Type some text first'],
  textUpdated: ['已更新文字', 'Text updated'],
  pen: ['手寫字', 'Handwriting'],
  glow: ['手畫光紋', 'Light trail'],
  drawHint: ['直接在畫面上畫。換到其他分頁就會回到選取模式。', 'Draw straight on the canvas. Switch tabs to go back to selecting.'],
  brush: ['筆刷粗細', 'Brush size'],
  importImage: ['匯入可愛圖片', 'Import an image'],
  imageHint: ['PNG 去背圖片效果最好。', 'Transparent PNGs look best.'],
  clearAll: ['清除全部裝飾', 'Clear all details'],
  confirmClear: ['要清除畫面上全部的文字、符號、筆畫與元件嗎？（可以按復原）', 'Remove all text, symbols, drawings and companions? (You can undo.)'],
  imageAdded: ['已加入圖片', 'Image added'],

  // 03 風格
  h3: ['選一種氛圍', 'Set the mood'],
  p3: ['動態主題和濾鏡都會一直動。匯入音樂後，主題會跟著節奏變化。', 'Themes and filters keep moving. Add music and the theme follows the beat.'],
  subTheme: ['動態主題', 'Themes'],
  subFilter: ['濾鏡', 'Filters'],
  subMusic: ['音樂', 'Music'],
  intensity: ['效果強度', 'Intensity'],
  noMusic: ['還沒有音樂。匯入一首歌，主題會跟著節奏閃動。', 'No music yet. Add a song and the theme will move to the beat.'],
  importMusic: ['匯入音樂', 'Add music'],
  changeMusic: ['換一首', 'Change song'],
  play: ['播放', 'Play'],
  pause: ['暫停', 'Pause'],
  musicVol: ['音樂音量', 'Music'],
  sfx: ['可愛音效', 'Sound effects'],
  sfxVol: ['音效音量', 'Effects'],
  musicHint: ['支援 mp3、m4a、wav。錄製影片時，音樂與音效會一起錄進去。', 'Supports mp3, m4a and wav. Music and sounds are included when you record a video.'],

  // 04 完成
  h4: ['完成，帶走你的桌布', 'Take it with you'],
  p4: ['先全螢幕預覽，再選擇要設成桌布、存成圖片或錄成影片。', 'Preview it full screen, then set it as your wallpaper, save an image or record a video.'],
  fullPreview: ['全螢幕互動預覽', 'Full-screen preview'],
  setTitle: ['設成 iPhone 桌布', 'Set as iPhone wallpaper'],
  setText: ['透過「捷徑」一鍵把畫面設成桌布。第一次要先建立捷徑。', 'Use Shortcuts to set it in one tap. Create the shortcut once first.'],
  setBtn: ['設為桌布', 'Set as wallpaper'],
  setGuide: ['第一次使用？建立捷徑', 'First time? Create the shortcut'],
  saveTitle: ['存下來', 'Save'],
  saveText: ['圖片為 1080×2340 高畫質。影片會錄下動畫、音樂和你的互動。', 'Images are 1080×2340. Videos capture the animation, music and your taps.'],
  saveImage: ['存成圖片', 'Save image'],
  making: ['產生中…', 'Preparing…'],
  saveShare: ['儲存／分享', 'Save / Share'],
  recTitle: ['錄製動態影片', 'Record a video'],
  sec: ['{0} 秒', '{0}s'],
  recStart: ['開始錄製', 'Start recording'],
  recAgain: ['重新錄製', 'Record again'],
  recording: ['錄製中 {0}s・可以點元件互動', 'Recording {0}s · tap the companions'],
  saveVideo: ['儲存／分享影片', 'Save / Share video'],
  recDone: ['錄製完成', 'Recording finished'],
  noRec: ['這個瀏覽器不支援錄影，請使用 iPhone Safari（iOS 14.5 以上）或 Chrome。', 'This browser cannot record. Please use Safari on iPhone (iOS 14.5+) or Chrome.'],
  liveTitle: ['原況照片（Live Photo）', 'Live Photo'],
  liveText: ['錄製 3 秒並直接存成原況照片，設成鎖定畫面就會動。', 'Records 3 seconds and saves a Live Photo for your Lock Screen.'],
  liveBtn: ['製作原況照片', 'Make a Live Photo'],
  liveSaved: ['原況照片已存到「照片」', 'Live Photo saved to Photos'],
  processing: ['處理中…', 'Processing…'],
  savedPhotos: ['已存到「照片」', 'Saved to Photos'],
  saveGallery: ['存進我的收藏', 'Save to My wallpapers'],
  savedGallery: ['已存進我的收藏', 'Saved to My wallpapers'],
  saveFail: ['儲存失敗，可能是空間不足', 'Could not save — storage may be full'],
  finishNote: ['<b>不用捷徑也可以：</b>把圖片存到照片 → 打開照片 → 分享 →「設為背景圖片」。<br><b>想讓鎖定畫面會動：</b>把影片用「intoLive」等 App 轉成原況照片，再到 設定 → 背景圖片 選用。', '<b>Without Shortcuts:</b> save the image → open it in Photos → Share → “Use as Wallpaper”.<br><b>For a moving Lock Screen:</b> turn the video into a Live Photo with an app such as intoLive, then choose it in Settings → Wallpaper.'],
  finishNoteNative: ['<b>設定原況照片桌布：</b>設定 → 背景圖片 →「＋ 新增背景圖片」→ 照片 → 選剛存好的原況照片。', '<b>Use a Live Photo:</b> Settings → Wallpaper → Add New Wallpaper → Photos → choose the Live Photo you saved.'],

  // 設定
  setHead: ['互動設定', 'Interaction'],
  tapComp: ['點元件互動', 'Tap companions'],
  tapCompSub: ['點可愛元件會跳動並發出聲音', 'Companions bounce and make a sound'],
  touchFx: ['觸碰特效', 'Touch sparkles'],
  touchFxSub: ['點畫面任何地方會噴出星星', 'Tap anywhere for a burst of stars'],
  showFab: ['顯示互動按鈕', 'Show the AE button'],
  showFabSub: ['互動模式右下角的 AE 按鈕（隱藏後長按畫面可叫回）', 'The AE button in interactive mode (long-press to bring it back)'],
  showClock: ['預覽鎖定畫面時鐘', 'Lock Screen clock'],
  showClockSub: ['互動模式中顯示時間，方便對照版面', 'Show the time in interactive mode to check the layout'],
  rotHead: ['桌布更新頻率', 'Wallpaper rotation'],
  rotOn: ['自動更換桌布', 'Rotate wallpapers'],
  rotOnSub: ['從「我的收藏」依序輪播', 'Cycle through My wallpapers'],
  every: ['每', 'Every'],
  hour: ['小時', 'hours'],
  day: ['天', 'days'],
  once: ['更新一次', ''],
  rotOff: ['開啟後才會輪播。', 'Turn it on to start rotating.'],
  rotEmpty: ['收藏裡還沒有桌布，先存幾張吧。', 'Save a few wallpapers first.'],
  rotNow: ['目前顯示第 {0} / {1} 張・下次更新：{2}', 'Showing {0} of {1} · next change {2}'],
  rotGuideBtn: ['讓 iPhone 系統桌布也自動更換', 'Rotate the iPhone wallpaper too'],

  // 互動模式
  fab: ['AE 互動按鈕', 'AE button'],
  fabTheme: ['換主題', 'Next theme'],
  fabMusic: ['音樂播放／暫停', 'Play / pause music'],
  fabClock: ['鎖定畫面時鐘', 'Lock Screen clock'],
  fabHide: ['隱藏互動按鈕', 'Hide this button'],
  fabExit: ['離開互動模式', 'Exit'],
  tapHint: ['點點看畫面上的元件', 'Try tapping the companions'],
  rotated: ['桌布已依頻率更新', 'Wallpaper changed'],
  fabPeek: ['AE 按鈕回來了，在右下角', 'The AE button is back, bottom right'],
  fabHidden: ['已隱藏，長按畫面可叫回', 'Hidden — long-press to bring it back'],
  themeIs: ['主題：{0}', 'Theme: {0}'],
  needMusic: ['先到「音樂」匯入音樂喔', 'Add music in Music first'],
  musicPaused: ['音樂暫停', 'Music paused'],

  // 工具列
  tPhoto: ['底圖', 'Photo'],
  tComp: ['元件', 'Companions'],
  tSym: ['符號', 'Symbols'],
  tText: ['文字', 'Text'],
  tDraw: ['畫筆', 'Draw'],
  tImage: ['圖片', 'Image'],
  tTheme: ['主題', 'Theme'],
  tFilter: ['濾鏡', 'Filter'],
  tMusic: ['音樂', 'Music'],
  tFinish: ['完成', 'Finish'],
  startHint: ['點下方的工具開始編輯', 'Tap a tool below to start'],
  mClear: ['清除全部裝飾', 'Clear all details'],
  mClearSub: ['移除文字、符號、筆畫與元件（可復原）', 'Remove text, symbols, drawings and companions (undoable)'],

  // 物件屬性
  selected: ['已選取：{0}', 'Selected: {0}'],
  propSize: ['大小', 'Size'],
  propRotate: ['旋轉', 'Rotate'],
  propOpacity: ['透明度', 'Opacity'],
  duplicate: ['複製', 'Duplicate'],
  flip: ['左右翻轉', 'Flip'],
  forward: ['往上一層', 'Bring forward'],
  backward: ['往下一層', 'Send backward'],
  deselect: ['完成', 'Done'],
  objComp: ['動態元件', 'Companion'],
  objText: ['文字', 'Text'],
  objEmoji: ['符號', 'Symbol'],
  objImage: ['圖片', 'Image'],
  objStroke: ['筆畫', 'Drawing'],
  fontLabel: ['字型', 'Font'],
  fontRound: ['圓體', 'Rounded'],
  fontSerif: ['明體', 'Serif'],
  fontSans: ['黑體', 'Sans'],
  outlineLabel: ['描邊', 'Outline'],
  outlineWhite: ['白邊', 'White'],
  outlineDark: ['深色邊', 'Dark'],
  outlineNone: ['無', 'None'],
  rainbow: ['彩虹光紋', 'Rainbow trail'],
  eraser: ['橡皮擦', 'Eraser'],
  eraserHint: ['在畫面上抹過筆畫就能擦掉。', 'Swipe over a drawing to erase it.'],
  removeBg: ['自動去除白色背景', 'Remove white background'],
  themeToggle: ['切換深色／淺色外觀', 'Switch dark / light appearance'],
  deleted: ['已刪除・可按復原找回', 'Deleted — tap undo to bring it back'],
  newText: ['新增另一段文字', 'Add another text'],
  recReveal: ['重播手繪過程', 'Replay the drawing'],
  recRevealSub: ['影片開頭會把你畫的光紋一筆一筆畫出來', 'Your strokes are drawn in, one by one, at the start of the video'],
  liveRecStart: ['邊畫邊錄影', 'Record while drawing'],
  liveRecStop: ['停止錄影', 'Stop recording'],
  liveRecOn: ['錄影中・畫好了再按停止', 'Recording — tap stop when done'],
  liveRecHint: ['把手繪光紋的過程錄成影片', 'Capture your glowing strokes as a video'],
  liveRecDone: ['繪畫過程錄好了', 'Your drawing video is ready'],
  backToEdit: ['返回編輯', 'Back to edit'],
  playerHint: ['左上角返回編輯・拖曳可移動物件・右下角 AE 按鈕有更多功能', 'Back to edit at top left · drag to move things · more in the AE button'],
  playerHintRot: ['左上角返回編輯・右下角 AE 按鈕有更多功能', 'Back to edit at top left · more in the AE button'],

  // 其他
  noUndo: ['沒有可以復原的步驟', 'Nothing to undo'],
  noRedo: ['沒有可以重做的步驟', 'Nothing to redo'],
  photoIn: ['已匯入照片', 'Photo added'],
  badImage: ['無法讀取這張圖片', 'Could not read this image'],
  loaded: ['已載入收藏的桌布', 'Wallpaper loaded'],
  copied: ['已複製', 'Copied'],
  copyFail: ['請長按手動複製', 'Long-press to copy'],
  copy: ['複製', 'Copy'],
  clipFail: ['無法複製圖片，改用「儲存／分享」', 'Could not copy — saving instead'],
  opening: ['桌布已複製，正在打開捷徑…', 'Copied — opening Shortcuts…'],
  openingNative: ['正在打開捷徑…', 'Opening Shortcuts…'],
  saveErr: ['儲存失敗：{0}', 'Could not save: {0}'],
  failed: ['失敗：{0}', 'Failed: {0}'],
};

export function t(key, ...args) {
  const pair = T[key];
  let s = pair ? pair[lang === 'en' ? 1 : 0] : key;
  args.forEach((a, i) => { s = s.replace(`{${i}}`, a); });
  return s;
}

// 元件、濾鏡、主題、聲音、符號的英文名稱（中文名稱在 effects.js / sound.js）
const NAMES_EN = {
  comp: {
    cloud: ['Cloud Baby', 'Floats and blinks'], star: ['Hop Star', 'Bounces, sprinkles light'],
    heart: ['Jelly Heart', 'Heartbeat and bubbles'], bunny: ['Bunny', 'Wiggly ears, twitchy nose'],
    moon: ['Sleepy Moon', 'Dozes and floats Zzz'], flower: ['Swaying Flower', 'Sways and drops petals'],
  },
  filter: {
    none: ['Original', 'No filter'], peach: ['Peach Cream', 'Warm, breathing light'],
    lavender: ['Lavender Mist', 'Lilac tones, drifting haze'], film: ['Vintage Film', 'Grain and light leaks'],
    mint: ['Mint Soda', 'Cool tones, rising bubbles'], sunset: ['Sunset Glow', 'Golden-hour light'],
    mono: ['Silver Screen', 'Black and white, flicker'],
  },
  theme: {
    none: ['None', 'Companions only'], laser: ['Club Lasers', 'Colour beams on the beat'],
    breeze: ['Breeze', 'Petals on the wind'], sparkle: ['Sparkle', 'Twinkling stars, glitter'],
    snow: ['Snowfall', 'Soft falling snow'], bubbles: ['Dream Bubbles', 'Rainbow bubbles rising'],
    aurora: ['Aurora Night', 'Northern lights, shooting stars'],
  },
  sound: {
    pop: ['Bubble Pop'], bell: ['Little Bells'], chirp: ['Chirp Chirp'],
    boing: ['Boing'], harp: ['Harp Glide'], meow: ['Meow'], none: ['Silent'],
  },
};

/** 取得名稱與說明：item 為 effects.js 中的 { id, name, desc } */
export function nm(group, item) {
  if (lang === 'en') {
    const en = NAMES_EN[group][item.id];
    if (en) return { name: en[0], desc: en[1] || '' };
  }
  return { name: item.name, desc: item.desc || '' };
}

export const SYMBOLS = [
  ['❤️', '愛心', 'Heart'], ['🌙', '月亮', 'Moon'], ['☀️', '太陽', 'Sun'], ['⭐', '星星', 'Star'],
  ['♾️', '無限', 'Infinity'], ['🌸', '花', 'Blossom'], ['🌳', '樹', 'Tree'], ['🐦', '鳥', 'Bird'],
  ['🐟', '魚', 'Fish'], ['🐶', '狗', 'Dog'], ['🐱', '貓', 'Cat'], ['🌈', '彩虹', 'Rainbow'],
  ['☁️', '雲', 'Cloud'], ['🍀', '幸運草', 'Clover'], ['🦋', '蝴蝶', 'Butterfly'], ['🐰', '兔兔', 'Bunny'],
  ['🍓', '草莓', 'Berry'], ['🎀', '蝴蝶結', 'Ribbon'], ['✨', '閃亮', 'Sparkles'], ['💖', '心心', 'Love'],
  ['🌷', '鬱金香', 'Tulip'], ['🐻', '熊熊', 'Bear'], ['🍰', '蛋糕', 'Cake'], ['🪐', '星球', 'Planet'],
];
export const symLabel = (s) => (lang === 'en' ? s[2] : s[1]);
