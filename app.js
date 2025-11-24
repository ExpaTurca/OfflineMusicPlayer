(function(){
  // Simple music player with playlist management, shuffle, sorting and rudimentary "content-aware" auto-rename.
  const fileInput = document.getElementById('file-input');
  const singleUpload = document.getElementById('single-upload');
  const playlistEl = document.getElementById('playlist');
  const titleEl = document.getElementById('title');
  const coverEl = document.getElementById('cover');
  const playBtn = document.getElementById('play');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const shuffleBtn = document.getElementById('shuffle-btn');
  const seek = document.getElementById('seek');
  const timeEl = document.getElementById('time');
  const volume = document.getElementById('volume');
  const sortBy = document.getElementById('sort-by');
  const autoRename = document.getElementById('auto-rename');
  const resetNames = document.getElementById('reset-names');

  let audio = new Audio();
  audio.crossOrigin = "anonymous";
  let tracks = [];
  let index = -1;
  let isPlaying = false;
  let shuffle = false;

  function formatTime(sec){
    if(!isFinite(sec)) return '0:00';
    const s = Math.floor(sec % 60).toString().padStart(2,'0');
    const m = Math.floor(sec/60);
    return `${m}:${s}`;
  }

  function renderPlaylist(){
    playlistEl.innerHTML = '';
    tracks.forEach((t,i)=>{
      const li = document.createElement('li');
      li.dataset.i = i;
      const cover = document.createElement('div'); cover.className='track-cover';
      const img = document.createElement('img'); img.src = t.cover || '';
      cover.appendChild(img);
      const meta = document.createElement('div'); meta.className='track-meta';
      const name = document.createElement('div'); name.className='name'; name.textContent = t.displayName || t.name;
      const sub = document.createElement('div'); sub.className='sub'; sub.textContent = `${formatTime(t.duration || 0)} • ${t.fileType || ''}`;
      meta.appendChild(name); meta.appendChild(sub);
      const actions = document.createElement('div'); actions.className='track-actions';
      const play = document.createElement('button'); play.textContent='▶'; play.title='Çal';
      play.addEventListener('click',()=>playIndex(i));
      const remove = document.createElement('button'); remove.textContent='✖'; remove.title='Kaldır';
      remove.addEventListener('click',()=>{tracks.splice(i,1); if(index===i){pause(); index=-1; resetCurrent();} renderPlaylist();});
      actions.appendChild(play); actions.appendChild(remove);
      li.appendChild(cover); li.appendChild(meta); li.appendChild(actions);
      playlistEl.appendChild(li);
    });
  }

  function resetCurrent(){
    titleEl.textContent = 'Hiçbir şarkı çalmıyor';
    coverEl.src = '';
    timeEl.textContent = '0:00 / 0:00';
  }

  function playIndex(i){
    if(i<0 || i>=tracks.length) return;
    index = i;
    const t = tracks[index];
    audio.src = t.url;
    audio.load();
    audio.play();
    isPlaying = true;
    playBtn.textContent = '⏸';
    titleEl.textContent = t.displayName || t.name;
    coverEl.src = t.cover || '';
  }

  function playNext(){
    if(tracks.length===0) return;
    if(shuffle){
      playIndex(Math.floor(Math.random()*tracks.length));
      return;
    }
    let next = index + 1;
    if(next >= tracks.length) next = 0;
    playIndex(next);
  }

  function playPrev(){
    if(tracks.length===0) return;
    let prev = index - 1;
    if(prev < 0) prev = tracks.length - 1;
    playIndex(prev);
  }

  function pause(){audio.pause(); isPlaying=false; playBtn.textContent='▶️';}

  playBtn.addEventListener('click',()=>{
    if(!audio.src) { if(tracks.length) playIndex(0); return; }
    if(isPlaying) pause(); else { audio.play(); isPlaying=true; playBtn.textContent='⏸'; }
  });
  nextBtn.addEventListener('click',playNext);
  prevBtn.addEventListener('click',playPrev);

  shuffleBtn.addEventListener('click',()=>{
    shuffle = !shuffle; shuffleBtn.textContent = `Karışık: ${shuffle? 'Açık':'Kapalı'}`;
  });

  audio.addEventListener('timeupdate',()=>{
    if(audio.duration){
      seek.value = (audio.currentTime / audio.duration) * 100;
      timeEl.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }
  });

  audio.addEventListener('ended',()=>{ playNext(); });

  seek.addEventListener('input', ()=>{
    if(audio.duration) audio.currentTime = (seek.value/100)*audio.duration;
  });

  volume.addEventListener('input', ()=>{audio.volume = volume.value});

  // Sorting
  sortBy.addEventListener('change', ()=>{
    const v = sortBy.value;
    if(v==='index') { /* keep original order by stored id */ tracks.sort((a,b)=>a.addedOrder - b.addedOrder); }
    if(v==='name') { tracks.sort((a,b)=> (a.displayName||a.name).localeCompare(b.displayName||b.name)); }
    if(v==='duration') { tracks.sort((a,b)=> (a.duration||0) - (b.duration||0)); }
    renderPlaylist();
  });

  // File handling
  let orderCounter = 0;
  fileInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files);
    for(const f of files){
      await addFileToPlaylist(f);
    }
    renderPlaylist();
  });

  singleUpload.addEventListener('change', async (e)=>{
    const f = e.target.files[0];
    if(!f) return;
    // If image, allow using as global cover for last added track
    if(f.type.startsWith('image/')){
      if(tracks.length) tracks[tracks.length-1].cover = URL.createObjectURL(f);
      renderPlaylist();
      return;
    }
    await addFileToPlaylist(f);
    renderPlaylist();
  });

  async function addFileToPlaylist(file){
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^/.]+$/,"");
    // get duration via audio element
    const duration = await probeDuration(url);
    const fileType = file.type;
    const track = { file, url, name, displayName: name, duration, fileType, addedOrder: orderCounter++, cover: '' };

    // Attempt to read embedded art (requires jsmediatags loaded)
    if(window.jsmediatags){
      try{
        window.jsmediatags.read(file, {
          onSuccess: function(tag) {
            const pictures = tag.tags.picture;
            if(pictures){
              const uint8Array = new Uint8Array(pictures.data);
              const blob = new Blob([uint8Array], {type: pictures.format || 'image/jpeg'});
              track.cover = URL.createObjectURL(blob);
              renderPlaylist();
            }
          },
          onError: function(err){ /* ignore */ }
        });
      }catch(err){/* ignore */}
    }

    // Fallback cover: generated colored placeholder
    if(!track.cover){
      track.cover = generatePlaceholderCover(track.name);
    }

    tracks.push(track);
  }

  function probeDuration(url){
    return new Promise((res)=>{
      const a = new Audio(); a.src = url; a.preload = 'metadata';
      a.addEventListener('loadedmetadata', ()=>{ res(a.duration); a.remove(); });
      a.addEventListener('error', ()=>{ res(0); });
    });
  }

  function generatePlaceholderCover(text){
    // small canvas to generate a colorful placeholder as dataURL
    const s = 400; const c = document.createElement('canvas'); c.width=s;c.height=s; const ctx=c.getContext('2d');
    const hue = Math.abs(hashCode(text)) % 360;
    const g = ctx.createLinearGradient(0,0,s,s);
    g.addColorStop(0, `hsl(${hue} 60% 40% / 0.95)`);
    g.addColorStop(1, `hsl(${(hue+30)%360} 60% 30% / 0.95)`);
    ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
    // initials
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 120px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    const initials = text.split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
    ctx.fillText(initials, s/2, s/2);
    return c.toDataURL('image/png');
  }

  function hashCode(str){
    var h=0; for(var i=0;i<str.length;i++){ h = ((h<<5)-h)+str.charCodeAt(i); h |= 0; } return h;
  }

  // Auto-rename based on basic audio analysis (RMS + spectral centroid)
  autoRename.addEventListener('click', async ()=>{
    if(tracks.length===0) return;
    autoRename.disabled = true; autoRename.textContent='İsimlendirme...';
    for(const t of tracks){
      try{
        const features = await analyzeAudioFeatures(t.url);
        t.displayName = generateNameFromFeatures(t.name, features);
      }catch(e){
        t.displayName = t.name;
      }
    }
    renderPlaylist();
    autoRename.disabled=false; autoRename.textContent='Otomatik İsimlendir';
  });

  resetNames.addEventListener('click', ()=>{ tracks.forEach(t=>t.displayName = t.name); renderPlaylist(); });

  function generateNameFromFeatures(baseName, f){
    // Map features into descriptive tokens
    const energy = f.rms; // 0..1-ish
    const centroid = f.centroid; // rough
    const tempoish = Math.round(f.tempo || 0);
    const moods = [];
    if(energy > 0.08) moods.push('Enerjik'); else moods.push('Yumuşak');
    if(centroid > 2000) moods.push('Parlak'); else moods.push('Derin');
    if(tempoish > 120) moods.push('Hızlı'); else if(tempoish>80) moods.push('OrtaTempolu'); else moods.push('Yavaş');

    const nouns = ['Yolculuk','Gece','Rüya','Ritim','Dalgalar','Köşe','Pencere','Anılar','Şehir','Noktası'];
    const noun = nouns[Math.abs(hashCode(baseName)) % nouns.length];
    return `${moods.join('-')} ${noun} (${tempoish||'--'}bpm)`;
  }

  async function analyzeAudioFeatures(url){
    // Load small portion of audio and compute simple features using Web Audio API
    return new Promise((resolve,reject)=>{
      try{
        const ctx = new (window.AudioContext||window.webkitAudioContext)();
        fetch(url).then(r=>r.arrayBuffer()).then(buf=>ctx.decodeAudioData(buf)).then(audioBuffer=>{
          const channel = audioBuffer.getChannelData(0);
          const sampleCount = Math.min(channel.length, ctx.sampleRate * 10); // analyze up to 10 seconds
          // compute RMS
          let sum=0; for(let i=0;i<sampleCount;i++){ sum += channel[i]*channel[i]; }
          const rms = Math.sqrt(sum/sampleCount);
          // spectral centroid via simple FFT window on first 2048 samples
          const fftSize = 2048; const window = Math.min(fftSize, sampleCount);
          const re = new Float32Array(window); const im = new Float32Array(window);
          for(let i=0;i<window;i++){ re[i] = channel[i]; im[i]=0; }
          // naive DFT (costly but acceptable for short window)
          const mags = new Float32Array(window/2);
          for(let k=0;k<window/2;k++){
            let real=0, imag=0;
            for(let n=0;n<window;n++){ const phi = (2*Math.PI*k*n)/window; real += re[n]*Math.cos(phi); imag -= re[n]*Math.sin(phi); }
            mags[k] = Math.sqrt(real*real + imag*imag);
          }
          let num=0, den=0;
          for(let k=0;k<mags.length;k++){ const freq = k*(ctx.sampleRate/window); num += freq * mags[k]; den += mags[k]; }
          const centroid = den? num/den : 0;
          // primitive tempo estimate: count zero-crossings per second as proxy
          let zc=0; for(let i=1;i<sampleCount;i++){ if((channel[i-1]<0 && channel[i]>=0) || (channel[i-1]>0 && channel[i]<=0)) zc++; }
          const duration = sampleCount / ctx.sampleRate;
          const tempoApprox = Math.round((zc/duration)/2); // very rough
          resolve({rms, centroid, tempo: tempoApprox});
        }).catch(reject);
      }catch(e){ reject(e); }
    });
  }

  function generatePlaceholderCover(text){
    const s = 200; const c = document.createElement('canvas'); c.width=s;c.height=s; const ctx=c.getContext('2d');
    const hue = Math.abs(hashCode(text)) % 360;
    ctx.fillStyle = `hsl(${hue} 60% 40%)`;
    ctx.fillRect(0,0,s,s);
    ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.font='bold 48px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    const initials = text.split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
    ctx.fillText(initials, s/2, s/2);
    return c.toDataURL('image/png');
  }

  // initial state
  renderPlaylist();

  // expose a little API for debugging
  window.__player = { tracks, playIndex, playNext, playPrev };
})();