import assert from 'node:assert/strict';
class MockPlayer {
  constructor({playImpl,endAfterMs=null,playingAfterMs=0}={}){this.playImpl=playImpl||(()=>Promise.resolve());this.endAfterMs=endAfterMs;this.playingAfterMs=playingAfterMs;this.onended=this.onerror=this.onplaying=this.onstalled=null;this.isPlaying=false;this.src='';this.currentTime=0;}
  pause(){this.isPlaying=false;}
  play(){const p=this.playImpl();Promise.resolve(p).then(()=>{setTimeout(()=>{this.isPlaying=true;this.onplaying?.();if(this.endAfterMs!=null)setTimeout(()=>{this.isPlaying=false;this.onended?.();},this.endAfterMs);},this.playingAfterMs)}).catch(()=>{});return p;}
}
class PatchedEngine {
  constructor({player=null,speechMode='success',audioCtxState='running',startTimeoutMs=50,finishTimeoutMs=300,speechTimeoutMs=80,unlockDelayMs=0}={}){this.player=player;this.state='LOCKED';this.audioCtx={state:audioCtxState,resume:async()=>{if(unlockDelayMs)await new Promise(r=>setTimeout(r,unlockDelayMs));this.audioCtx.state='running'}};this.speechMode=speechMode;this.startTimeoutMs=startTimeoutMs;this.finishTimeoutMs=finishTimeoutMs;this.speechTimeoutMs=speechTimeoutMs;this.events=[];}
  updateState(s){this.state=s;this.events.push(['state',s,Date.now()]);}
  async unlockFromUserGesture(){
    this.updateState('UNLOCKING');
    if(!this.player){this.updateState('BLOCKED');return false;}
    this.player.pause();this.player.src='/audio/audio-ready.mp3';this.player.currentTime=0;
    // Crucial: play synchronously before awaiting anything else.
    let mediaPromise;
    try{mediaPromise=this.player.play();}catch(e){this.updateState('BLOCKED');return false;}
    const ctxPromise=this.audioCtx.state==='suspended'?this.audioCtx.resume():Promise.resolve();
    try{await mediaPromise;await ctxPromise;this.updateState('READY');return true;}catch(e){this.updateState(e?.name==='NotAllowedError'?'BLOCKED':'ERROR');return false;}
  }
  playPersistentAudioSrc(src){
    return new Promise((resolve,reject)=>{
      if(!this.player){reject(new Error('UNBOUND_PLAYER'));return;}
      const p=this.player;let startTimer,finishTimer,settled=false;
      const cleanup=()=>{clearTimeout(startTimer);clearTimeout(finishTimer);p.onplaying=p.onended=p.onerror=p.onstalled=null;};
      const fail=e=>{if(settled)return;settled=true;cleanup();p.pause();reject(e)};
      const ok=()=>{if(settled)return;settled=true;cleanup();resolve()};
      p.pause();p.src=src;p.currentTime=0;
      p.onplaying=()=>{clearTimeout(startTimer);finishTimer=setTimeout(()=>fail(new Error('AUDIO_FINISH_TIMEOUT')),this.finishTimeoutMs)};
      p.onended=ok;p.onerror=()=>fail(new Error('PLAYBACK_ERROR'));
      startTimer=setTimeout(()=>fail(new Error('AUDIO_START_TIMEOUT')),this.startTimeoutMs);
      const pp=p.play();pp?.catch(fail);
    });
  }
  speakWebSpeech(){
    if(this.speechMode==='unavailable') return Promise.reject(new Error('WEB_SPEECH_UNAVAILABLE'));
    return new Promise((resolve,reject)=>{let done=false;const finish=(err)=>{if(done)return;done=true;clearTimeout(t);err?reject(err):resolve()};const t=setTimeout(()=>finish(new Error('WEB_SPEECH_TIMEOUT')),this.speechTimeoutMs);if(this.speechMode==='error')setTimeout(()=>finish(new Error('WEB_SPEECH_ERROR')),5);else if(this.speechMode==='success')setTimeout(()=>finish(),5);});
  }
  async execute(){
    try{await this.playPersistentAudioSrc('tts-url');return{success:true,source:'SERVER_MP3'}}catch(mp3Err){if(mp3Err?.name==='NotAllowedError'){this.updateState('BLOCKED');return{success:false,error:'NotAllowedError'}}}
    try{await this.speakWebSpeech();return{success:true,source:'WEB_SPEECH'}}catch(e){return{success:false,error:e.message||'VOICE_PLAYBACK_FAILED'}}
  }
}
const out=[];async function t(name,fn){try{out.push({name,status:'PASS',detail:await fn()})}catch(e){out.push({name,status:'FAIL',detail:String(e.stack||e)})}}
await t('Unlock does NOT report READY when media player is unbound',async()=>{const e=new PatchedEngine({player:null});const ok=await e.unlockFromUserGesture();assert.equal(ok,false);assert.equal(e.state,'BLOCKED');return{ok,state:e.state}});
await t('Unlock does NOT report READY when actual media play fails even if AudioContext can run',async()=>{const err=Object.assign(new Error('decode'),{name:'NotSupportedError'});const e=new PatchedEngine({player:new MockPlayer({playImpl:()=>Promise.reject(err)}),audioCtxState:'running'});const ok=await e.unlockFromUserGesture();assert.equal(ok,false);assert.equal(e.state,'ERROR');return{ok,state:e.state}});
await t('Unavailable Web Speech is a failure, not false success',async()=>{const e=new PatchedEngine({player:null,speechMode:'unavailable'});const r=await e.execute();assert.equal(r.success,false);return r});
await t('Web Speech onerror is a failure',async()=>{const e=new PatchedEngine({player:null,speechMode:'error'});const r=await e.execute();assert.equal(r.success,false);return r});
await t('Start timeout is cleared on onplaying; long media can finish normally',async()=>{const p=new MockPlayer({playImpl:()=>Promise.resolve(),playingAfterMs:5,endAfterMs:100});const e=new PatchedEngine({player:p,startTimeoutMs:40,finishTimeoutMs:200});const r=await e.execute();assert.equal(r.source,'SERVER_MP3');return r});
await t('Audio start timeout stops media before fallback, preventing overlap',async()=>{const p=new MockPlayer({playImpl:()=>new Promise(()=>{}),playingAfterMs:999});const e=new PatchedEngine({player:p,speechMode:'success',startTimeoutMs:30});const r=await e.execute();assert.equal(r.source,'WEB_SPEECH');assert.equal(p.isPlaying,false);return{result:r,playerStillPlaying:p.isPlaying}});
console.log(JSON.stringify(out,null,2));
