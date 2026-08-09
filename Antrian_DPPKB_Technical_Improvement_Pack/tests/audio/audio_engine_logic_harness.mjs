import assert from 'node:assert/strict';

class MockPlayer {
  constructor({playImpl, endAfterMs=null}={}) {
    this.playImpl = playImpl || (() => Promise.resolve());
    this.endAfterMs = endAfterMs;
    this.onended = null;
    this.onerror = null;
    this.onplaying = null;
    this.onstalled = null;
    this.error = null;
    this.isPlaying = false;
    this.src = '';
    this.currentTime = 0;
    this.preload = 'auto';
    this.volume = 1;
  }
  pause(){ this.isPlaying = false; }
  play(){
    this.isPlaying = true;
    const p = this.playImpl();
    Promise.resolve(p).then(() => {
      // Browser would fire playing, but production source has no handler installed.
      if (this.onplaying) this.onplaying();
      if (this.endAfterMs != null) {
        setTimeout(() => {
          this.isPlaying = false;
          if (this.onended) this.onended();
        }, this.endAfterMs);
      }
    }).catch(()=>{});
    return p;
  }
}

class ModelEngine {
  constructor({player=null, speechMode='success', audioCtxState='running', startTimeoutMs=80, speechTimeoutMs=80, unlockDelayMs=0}={}) {
    this.player=player;
    this.state='LOCKED';
    this.audioCtx={ state: audioCtxState, resume: async()=>{ if (unlockDelayMs) await new Promise(r=>setTimeout(r,unlockDelayMs)); this.audioCtx.state='running'; } };
    this.speechMode=speechMode;
    this.startTimeoutMs=startTimeoutMs;
    this.speechTimeoutMs=speechTimeoutMs;
    this.jobQueue=[];
    this.seenCallIds=new Set();
    this.playedCallIds=new Set();
    this.inFlightCallIds=new Set();
    this.isProcessing=false;
    this.events=[];
  }
  updateState(s){ this.state=s; this.events.push(['state',s,Date.now()]); }
  async unlockFromUserGesture(){
    this.updateState('UNLOCKING');
    let mediaSuccess=false, audioCtxSuccess=false;
    try {
      const ctx=this.audioCtx;
      if (ctx.state==='suspended') await ctx.resume();
      audioCtxSuccess=ctx.state==='running';
    } catch {}
    if (this.player) {
      try {
        this.player.pause(); this.player.src='/audio/audio-ready.mp3'; this.player.currentTime=0;
        await this.player.play(); mediaSuccess=true;
      } catch (e) {
        if (e?.name==='NotAllowedError'){ this.updateState('BLOCKED'); return false; }
      }
    }
    if (mediaSuccess || audioCtxSuccess){ this.updateState('READY'); this.processQueue(); return true; }
    this.updateState('BLOCKED'); return false;
  }
  queueCall(job){ if(this.seenCallIds.has(job.id)||this.playedCallIds.has(job.id))return; this.seenCallIds.add(job.id); this.jobQueue.push(job); this.processQueue(); }
  async processQueue(){
    if(this.isProcessing||this.jobQueue.length===0)return;
    this.isProcessing=true; const job=this.jobQueue.shift(); this.inFlightCallIds.add(job.id);
    if(this.state==='LOCKED'||this.state==='BLOCKED'){ this.jobQueue.unshift(job); this.inFlightCallIds.delete(job.id); this.isProcessing=false; return; }
    this.events.push(['job-start', this.state, Date.now()]);
    this.updateState('PLAYING'); const result=await this.executeCallJob(job);
    this.inFlightCallIds.delete(job.id); if(result.success)this.playedCallIds.add(job.id);
    this.events.push(['job-result', result, Date.now()]); this.isProcessing=false; return result;
  }
  async executeCallJob(){
    // Chime omitted except event; source always chimes first.
    this.events.push(['chime',true,Date.now()]);
    try { await this.playPersistentAudioSrc('tts-url'); return {success:true,source:'SERVER_MP3'}; }
    catch(e){ if(e?.name==='NotAllowedError'){this.updateState('BLOCKED');return {success:false,error:'NotAllowedError'};} }
    try { await this.speakWebSpeech(); return {success:true,source:'WEB_SPEECH'}; }
    catch { return {success:true,source:'CHIME_ONLY'}; }
  }
  playPersistentAudioSrc(src){
    return new Promise((resolve,reject)=>{
      if(!this.player){ reject(new Error('Persistent HTMLAudioElement belum terikat (unbound)')); return; }
      const player=this.player;
      let startTimeout;
      const cleanup=()=>{ clearTimeout(startTimeout); player.onplaying=null; player.onended=null; player.onerror=null; player.onstalled=null; };
      player.pause(); player.src=src; player.currentTime=0;
      player.onended=()=>{cleanup();resolve();};
      player.onerror=()=>{cleanup();reject(new Error('Playback Error'));};
      startTimeout=setTimeout(()=>{ this.events.push(['mp3-timeout-while-playing', player.isPlaying, Date.now()]); cleanup(); reject(new Error('Audio Playback Timeout')); }, this.startTimeoutMs);
      const pp=player.play(); if(pp) pp.catch(err=>{cleanup();reject(err);});
    });
  }
  speakWebSpeech(){
    // Mirrors the production semantics: unavailable resolves, onerror resolves, timeout resolves.
    if(this.speechMode==='unavailable') return Promise.resolve();
    return new Promise((resolve)=>{
      let done=false;
      const finish=()=>{ if(done)return; done=true; clearTimeout(t); resolve(); };
      const t=setTimeout(finish,this.speechTimeoutMs);
      if(this.speechMode==='error') setTimeout(finish,5);
      else if(this.speechMode==='success') setTimeout(finish,5);
    });
  }
}

const results=[];
async function test(name, fn){
  try { const detail=await fn(); results.push({name,status:'PASS',detail}); }
  catch(e){ results.push({name,status:'FAIL',detail:e.stack||String(e)}); }
}

await test('Unlock can report READY when media test fails but AudioContext is running', async()=>{
  const mediaErr=Object.assign(new Error('decode fail'),{name:'NotSupportedError'});
  const player=new MockPlayer({playImpl:()=>Promise.reject(mediaErr)});
  const e=new ModelEngine({player,audioCtxState:'running'});
  const ok=await e.unlockFromUserGesture();
  assert.equal(ok,true); assert.equal(e.state,'READY');
  return 'mediaSuccess=false, audioCtxSuccess=true => READY=true';
});

await test('No persistent player + no Web Speech is falsely marked WEB_SPEECH success', async()=>{
  const e=new ModelEngine({player:null,speechMode:'unavailable'}); e.state='READY';
  const r=await e.executeCallJob();
  assert.deepEqual(r,{success:true,source:'WEB_SPEECH'});
  return r;
});

await test('Web Speech error is swallowed and falsely marked success', async()=>{
  const e=new ModelEngine({player:null,speechMode:'error'}); e.state='READY';
  const r=await e.executeCallJob();
  assert.deepEqual(r,{success:true,source:'WEB_SPEECH'});
  return r;
});

await test('MP3 start timeout can fire while media is already playing', async()=>{
  const player=new MockPlayer({playImpl:()=>Promise.resolve(), endAfterMs:200});
  const e=new ModelEngine({player,speechMode:'success',startTimeoutMs:50}); e.state='READY';
  const r=await e.executeCallJob();
  const timeoutEvent=e.events.find(x=>x[0]==='mp3-timeout-while-playing');
  assert.equal(timeoutEvent?.[1],true);
  assert.equal(r.source,'WEB_SPEECH');
  return {result:r, mp3WasStillPlayingAtTimeout:timeoutEvent[1]};
});

await test('testAudio-style fire-and-forget unlock allows job to start while state is UNLOCKING', async()=>{
  const player=new MockPlayer({playImpl:()=>Promise.resolve(), endAfterMs:2});
  const e=new ModelEngine({player,speechMode:'success',audioCtxState:'suspended',unlockDelayMs:40,startTimeoutMs:80});
  const unlockPromise=e.unlockFromUserGesture(); // not awaited, mirrors TTSService.unlockAudio()
  e.queueCall({id:'test',ticketCode:'A-001'}); // immediately mirrors announceCall()
  await unlockPromise;
  await new Promise(r=>setTimeout(r,100));
  const js=e.events.find(x=>x[0]==='job-start');
  assert.equal(js?.[1],'UNLOCKING');
  return {jobStartedFromState:js[1], finalState:e.state};
});

console.log(JSON.stringify(results,null,2));
