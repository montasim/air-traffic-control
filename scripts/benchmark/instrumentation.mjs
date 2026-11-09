// Browser-side instrumentation shared by both immutable production snapshots.
export function installInstrumentation() {
  let seed=123456789;
  Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  localStorage.setItem('vector-approach:performance-stats','off');
  const canvases=[];
  const create=document.createElement.bind(document);
  document.createElement=function(name,...args){const el=create(name,...args);if(name.toLowerCase()==='canvas')canvases.push(new WeakRef(el));return el;};
  const textures=new Map(),buffers=new Map(),renderbuffers=new Map();
  let draws=0,frames=[],drawSamples=[],heapSamples=[],measuring=false,previous,begin=0,lastHeap=0;
  const contexts=new WeakMap();
  for(const proto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){
    const wrap=(name,fn)=>{const original=proto[name];if(!original)return;proto[name]=function(...args){const out=original.apply(this,args);let state=contexts.get(this);if(!state){state={unit:0,textures:new Map(),buffers:new Map(),rb:null};contexts.set(this,state);}fn(this,state,args,out);return out;};};
    wrap('activeTexture',(_,s,a)=>s.unit=a[0]);
    wrap('bindTexture',(_,s,a)=>s.textures.set(s.unit+':'+a[0],a[1]));
    wrap('texImage2D',(gl,s,a)=>{if(a[1]!==0)return;const source=a[5],w=a.length>=9?a[3]:(source?.videoWidth||source?.naturalWidth||source?.width||0),h=a.length>=9?a[4]:(source?.videoHeight||source?.naturalHeight||source?.height||0);const t=s.textures.get(s.unit+':'+a[0]);if(t)textures.set(t,w*h*4);});
    wrap('texStorage2D',(_,s,a)=>{const t=s.textures.get(s.unit+':'+a[0]);let w=a[3],h=a[4],bytes=0;for(let i=0;i<a[1];i++){bytes+=w*h*4;w=Math.max(1,w>>1);h=Math.max(1,h>>1);}if(t)textures.set(t,bytes);});
    wrap('deleteTexture',(_,s,a)=>textures.delete(a[0]));
    wrap('bindBuffer',(_,s,a)=>s.buffers.set(a[0],a[1]));
    wrap('bufferData',(_,s,a)=>{const b=s.buffers.get(a[0]);if(b)buffers.set(b,typeof a[1]==='number'?a[1]:a[1]?.byteLength||0);});
    wrap('deleteBuffer',(_,s,a)=>buffers.delete(a[0]));
    wrap('bindRenderbuffer',(_,s,a)=>s.rb=a[1]);
    wrap('renderbufferStorage',(_,s,a)=>{if(s.rb)renderbuffers.set(s.rb,a[2]*a[3]*4);});
    wrap('renderbufferStorageMultisample',(_,s,a)=>{if(s.rb)renderbuffers.set(s.rb,a[1]*a[3]*a[4]*4);});
    wrap('deleteRenderbuffer',(_,s,a)=>renderbuffers.delete(a[0]));
    for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])wrap(name,()=>draws++);
  }
  const memory=()=>({heap:performance.memory?.usedJSHeapSize??null,textureBytes:[...textures.values()].reduce((a,b)=>a+b,0),bufferBytes:[...buffers.values()].reduce((a,b)=>a+b,0),renderbufferBytes:[...renderbuffers.values()].reduce((a,b)=>a+b,0),canvasBytes:canvases.reduce((sum,ref)=>{const c=ref.deref();return sum+(c?c.width*c.height*4:0);},0),textures:textures.size});
  window.bench={
    frame(){window.bench.firstFrameMs??=performance.now();if(!measuring){draws=0;return;}const now=performance.now();if(previous!==undefined)frames.push(now-previous);previous=now;drawSamples.push(draws);draws=0;if(now-lastHeap>500){heapSamples.push(memory().heap);lastHeap=now;}},
    begin(){frames=[];drawSamples=[];heapSamples=[];previous=undefined;draws=0;begin=performance.now();lastHeap=begin;measuring=true;},
    finish(){measuring=false;return{durationMs:performance.now()-begin,intervals:frames,drawCalls:drawSamples,heapSamples,memory:memory(),resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.transferSize,encoded:r.encodedBodySize}))};},memory
  };
}
