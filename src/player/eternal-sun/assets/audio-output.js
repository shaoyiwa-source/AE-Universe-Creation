/* Long-form music requests the browser's playback category, not ambient audio.
   Unsupported engines keep their original behavior; user mute/volume are untouched. */
(function(root){'use strict';
function configure(navigatorLike){try{const session=navigatorLike?.audioSession;if(!session)return 'unsupported';session.type='playback';return 'playback';}catch{return 'unavailable';}}
const api={configure};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArtAudioOutput=api;
})(typeof window!=='undefined'?window:globalThis);
