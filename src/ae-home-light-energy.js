(function(root){
  'use strict';
  function energy(bins){
    if(!bins.length)return 0;
    let sum=0;
    for(let i=0;i<bins.length;i++)sum+=(bins[i]/255)**2;
    return Math.min(1,Math.sqrt(sum/bins.length));
  }
  // One cue for the 15 s opening AND the first ♫ play: they are the same piece of the same track.
  energy.openingTime=timeline=>(typeof timeline?.cue==='number'?timeline.cue:timeline?.sections?.[0]?.start)||0;
  // Pre-measured 40-180 Hz energy of the real track (no live WebAudio analyser needed).
  energy.energyAt=(timeline,time)=>{const e=timeline?.energy;if(!e||!e.data)return 0;const i=Math.floor(time/e.hop);if(i<0||i>=e.data.length)return 0;const c=e.data.charCodeAt(i);return (c<58?c-48:c-87)/35;};
  energy.flightPower=age=>Math.exp(-Math.max(0,age)/.065);
  energy.createRhythm=function(events,accents=[],sections=[]){
    let average=0,previous=0,last=-10,count=0,interval=60/148,accentCount=0,lastTime=-10;
    function passed(list,time){
      let lo=0,hi=list.length;while(lo<hi){const mid=(lo+hi)>>1;if(list[mid]<=time)lo=mid+1;else hi=mid;}return lo;
    }
    return{
      reset(){average=previous=count=accentCount=0;last=lastTime=-10;interval=60/148;},
      update(level,time){
        if(events){
          if(time<lastTime){count=accentCount=0;}lastTime=time;
          const nextCount=passed(events,time),beat=nextCount>count;count=nextCount;last=count?events[count-1]:-10;
          if(count>1){const gap=last-events[count-2];if(gap>.24&&gap<.9)interval=gap;}
          const nextAccent=passed(accents,time),accentBeat=nextAccent>accentCount;accentCount=nextAccent;
          const accentTime=accentCount?accents[accentCount-1]:-10;
          const accentPulse=accentCount?Math.exp(-Math.max(0,time-accentTime)/.04):0;
          const section=sections.find(s=>time>=s.start&&time<s.end);
          const stage=section?(time<section.drop?'build':'drop'):'groove';
          const buildProgress=stage==='build'?(time-section.start)/(section.drop-section.start):0;
          const dropPulse=stage==='drop'?Math.exp(-(time-section.drop)/.55):0;
          const kickPulse=count?Math.exp(-Math.max(0,time-last)/.095):0;
          const pulse=stage==='build'?Math.max(kickPulse*.45,accentPulse*(.80+buildProgress*.15)):Math.max(kickPulse,dropPulse);
          return{beat,count,interval,pulse,phase:count?Math.min(1,Math.max(0,time-last)/interval):0,
            accentBeat,accentCount,accentPulse,stage,buildProgress,dropPulse,sweep:time/(60/148)};
        }
        const rise=level-previous;
        const beat=level>.16&&rise>.025&&level>average*1.12&&time-last>.24;
        if(beat){const gap=time-last;if(count&&gap>.28&&gap<.9)interval=interval*.5+gap*.5;last=time;count++;}
        average=average*.93+level*.07;previous=level;
        return{beat,count,interval,pulse:count?Math.exp(-Math.max(0,time-last)/.115):0,phase:count?Math.min(1,Math.max(0,time-last)/interval):0,
          accentBeat:false,accentCount:0,accentPulse:0,stage:'groove',buildProgress:0,dropPulse:0,sweep:time/(60/148)};
      }
    };
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=energy;
  else root.aeHomeAudioEnergy=energy;
})(typeof window!=='undefined'?window:this);
