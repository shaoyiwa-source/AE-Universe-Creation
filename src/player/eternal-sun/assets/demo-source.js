/* Only exact bundled audio bytes may use the trusted metadata shortcut. */
(function(root){'use strict';
function check(signal){if(signal?.aborted)throw Object.assign(Error('已取消音樂載入'),{name:'AbortError'});}
async function verify(blob,manifest,signal){
 check(signal);if(!manifest?.sha256||!Number.isFinite(manifest.analysis?.duration))throw Error('示範音訊驗證資料未準備好。');
 const bytes=await blob.arrayBuffer();check(signal);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');check(signal);
 if(hash!==manifest.sha256)throw Error('示範音訊完整性檢查失敗，收到的內容不是這首完整音樂。');
 return {file:new File([bytes],'AE-Eternal-Sun-demo.m4a',{type:'audio/mp4'}),verified:{sha256:hash,duration:manifest.analysis.duration,sampleRate:manifest.analysis.sampleRate,channels:2}};
}
async function decode(file,verified,context,{signal,memoryBytes,memoryBudgetBytes}){
 check(signal);const {duration,sampleRate,channels}=verified;
 if(!(duration>0&&duration<=600&&sampleRate===44100&&channels===2))throw Error('示範音訊驗證資料不正確。');
 if(memoryBytes+duration*sampleRate*channels*4>memoryBudgetBytes)throw Error('音樂已超過預解碼容量；請移除部分曲目再加入。');
 const bytes=await file.arrayBuffer();check(signal);let result;
 try{result=await context.decodeAudioData(bytes);}catch(error){throw Error('音訊解碼失敗：'+(error.message||error.name||'此瀏覽器未能解碼示範曲'));}
 check(signal);if(!result||!Number.isFinite(result.duration)||!Number.isInteger(result.length)||result.length<=0||Math.abs(result.duration-duration)>.05||result.sampleRate!==sampleRate||result.numberOfChannels!==channels)throw Error('解碼後的示範音訊與驗證資料不一致。');
 if(memoryBytes+result.length*result.numberOfChannels*4>memoryBudgetBytes)throw Error('解碼音樂已超過容量。');return result;
}
const api={verify,decode};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AEDemoSource=api;
})(typeof window!=='undefined'?window:globalThis);
