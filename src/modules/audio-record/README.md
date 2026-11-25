# audio-record｜錄音模組

麥克風錄音、去頭尾靜音、變聲、輸出 WAV、播放。原生 ES module，直接 import 即可，不需要建置工具。
只處理聲音，不碰畫面；按鈕與文案由使用的頁面自己做。

目前使用的地方：`public/wallpaper/`（AE 動態桌布的「錄音」工具）。

## 用法

```js
import {
  isRecordingSupported, createRecorder, decodeAudio, trimSilence,
  applyVoiceEffect, VOICE_EFFECTS, toWav, playBuffer,
} from '/modules/audio-record/index.js';

if (!isRecordingSupported()) { /* 提示：需要 https 與支援錄音的瀏覽器 */ }

const rec = createRecorder({ maxSeconds: 15, onTick: (s) => console.log(s) });
await rec.start();               // 第一次會跳出麥克風權限
const blob = await rec.stop();   // 錄好的原始音檔（iPhone 為 m4a，其他多為 webm）

const ctx = new AudioContext();
const raw = trimSilence(await decodeAudio(blob, ctx));
const cute = await applyVoiceEffect(raw, 'chipmunk');
playBuffer(cute, { context: ctx });
const wav = toWav(cute);         // 可下載或分享
```

## API

| 名稱 | 說明 |
| --- | --- |
| `VOICE_EFFECTS` | 變聲清單：`original` 原聲、`chipmunk` 小松鼠、`baby` 小寶寶、`monster` 大怪獸、`robot` 機器人、`echo` 山谷回音。每項有 `zh`／`en` 名稱 |
| `isRecordingSupported()` | 能不能錄音 |
| `createRecorder({ maxSeconds, onTick })` | 回傳 `{ start(), stop() → Promise<Blob>, cancel(), recording }`；到上限秒數自動停止 |
| `decodeAudio(blob, ctx?)` | Blob → AudioBuffer |
| `trimSilence(buffer, { threshold, padSeconds })` | 去掉頭尾靜音 |
| `applyVoiceEffect(buffer, id)` | 套用變聲，回傳新的 AudioBuffer |
| `toWav(buffer)` | AudioBuffer → WAV Blob |
| `playBuffer(buffer, { context, destination, gain })` | 播放；`destination` 可接到錄影用的混音節點 |

## 限制與注意

- 錄音需要 **https**（本機開發可用 `localhost`）。
- iPhone：錄音時系統會切到「錄音＋播放」模式；`stop()`／`cancel()` 後模組會自動切回原本的模式，聲音才會從喇叭正常播放。
- 變聲用的是「變速變調」（聲音變高時也會變快），這是最可愛也最穩定的做法。之後若要「只變調不變速」，請在這個模組裡加新的效果，不要另寫一份。
- 修音（音高校正、降噪、EQ 等）屬於另一個模組 `audio-tune`（規劃中），不要放進這裡。
