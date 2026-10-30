(function(root){'use strict';
function create({isPlaying,pause,seek,start,duration}){let active=false,resume=false;return {get active(){return active;},begin(){if(active)return;active=true;resume=!!isPlaying();pause();},preview(value){this.begin();const end=Math.max(0,Number(duration())||0);seek(Math.max(0,Math.min(Number(value)||0,end)));},commit(){if(!active)return;active=false;const play=resume;resume=false;if(play)return start();},cancel(){active=false;resume=false;}};}
function demoCue(segments,verified){if(!Array.isArray(segments)||segments.length!==1)return null;const s=segments[0];return verified(s.assetId)&&s.trimIn<=58.3&&s.trimOut>=66.52?Math.round((s.start+58.3-s.trimIn)*1e6)/1e6:null;}
const api={create,demoCue};if(typeof module==='object'&&module.exports)module.exports=api;else root.ArtPlaybackSeek=api;
})(typeof globalThis!=='undefined'?globalThis:this);
