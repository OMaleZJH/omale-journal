// A persistent GPU universe shared by every route: planet, nebula, deep starfield and shooting stars.
// Motion starts on the first frame; no click required.
export function createUniverse(canvas) {
  const gl=canvas.getContext('webgl',{alpha:true,antialias:false,powerPreference:'high-performance',premultipliedAlpha:true});
  if(!gl)return fallback(canvas);
  const vertex=`
    precision highp float;
    attribute vec3 aSphere;
    attribute vec3 aGalaxy;
    attribute vec3 aMeta;
    uniform vec2 uResolution;
    uniform vec2 uCenter;
    uniform vec2 uPointer;
    uniform float uRadius;
    uniform float uTime;
    uniform float uMorph;
    uniform float uIntro;
    uniform float uBurst;
    uniform float uDpr;
    varying vec4 vColor;
    varying float vCloud;
    mat2 rotation(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
    void main(){
      float kind=aMeta.z;
      float seed=aMeta.y;
      vec2 screen;
      float size;
      vCloud=0.;
      if(kind<1.5){
        // The main body: particles fly in from all directions, swirl, and assemble into the planet / nebula.
        float delay=seed*.42;
        float arrive=clamp((uIntro-delay)/.58,0.,1.);
        float e=1.-pow(1.-arrive,3.);
        vec3 p=mix(aSphere,aGalaxy,uMorph);
        float swirl=(1.-e)*1.9;
        float spawn=2.9+seed*4.6;
        p+=vec3(cos(seed*40.+uTime*(.6+seed)+swirl*2.4),sin(seed*31.)*.6,sin(seed*47.-uTime*.4+swirl*2.1))*spawn*(1.-e);
        p.y+=sin(uTime*.3+seed*6.28)*.008;
        p.xz=rotation(uTime*.095+uPointer.x*.25+(1.-uIntro)*2.1)*p.xz;
        p.yz=rotation(.37+uMorph*.20+uPointer.y*.14)*p.yz;
        p.xy=rotation(-.28+sin(uTime*.08)*.035)*p.xy;
        float camera=3.6/(3.6-p.z*.4);
        screen=uCenter+p.xy*uRadius*camera*(1.+uBurst*(.4+seed*.6));
        float depth=clamp((p.z+1.8)/3.6,0.,1.);
        float shimmer=.85+.15*sin(uTime*.65+seed*30.);
        vec3 color=mix(vec3(.26,.64,.51),vec3(.73,1.,.80),depth);
        color=mix(color,vec3(.48,.74,1.),uMorph*(.25+.25*sin(seed*19.)));
        float core=1.-smoothstep(0.,.42,length(aGalaxy.xz));
        color=mix(color,vec3(.90,1.,.85),core*uMorph*.85);
        float alpha=(.37+depth*.68)*shimmer*(.22+.78*e);
        if(kind>.5){
          alpha*=.82;
          if(p.z<0.&&length(p.xy)<.98)alpha*=mix(.08,1.,uMorph);
        }
        size=(aMeta.x+depth*1.4+.5)*camera*uDpr*mix(.5,1.,e);
        vColor=vec4(color,alpha);
      }else if(kind<2.5){
        // Deep-space starfield: far away, static, gently breathing with the pointer.
        float depth=aSphere.z;
        vec2 drift=vec2(sin(uTime*.014+seed*40.),cos(uTime*.011+seed*31.))*depth*15.;
        screen=uResolution*(.5+aSphere.xy*.62)+drift+uPointer*depth*44.;
        float twinkle=.5+.5*sin(uTime*(.4+seed*1.4)+seed*80.);
        vec3 tint=mix(vec3(.62,.78,.85),vec3(.95,.98,.88),fract(seed*7.7));
        float alpha=(.12+.32*twinkle)*(.35+depth*2.2);
        size=(.6+seed*1.7)*uDpr*(.5+depth);
        if(seed>.93){size*=1.9;alpha*=1.7;}
        vColor=vec4(tint,alpha*(.4+.6*uIntro));
      }else if(kind<3.5){
        // Shooting stars: each one flashes along a line once in a while, five points form its trail.
        float head=aSphere.y;
        float p=fract(uTime*aGalaxy.y+aSphere.z);
        vec2 dir=vec2(cos(aGalaxy.x),sin(aGalaxy.x));
        vec2 pos=vec2(mix(-.18,1.06,fract(aSphere.x*13.7)),aGalaxy.z)+dir*p*1.5-dir*head*.035;
        screen=uResolution*pos+uPointer*10.;
        float fade=step(p,.085)*(1.-smoothstep(.05,.085,p))*(1.-head*.85);
        vec3 tint=mix(vec3(.86,1.,.93),vec3(.72,.88,1.),seed);
        vColor=vec4(tint,fade);
        size=(1.1+(1.-head)*2.2)*uDpr;
      }else{
        // Nebula glow: condenses together with the body out of thin air.
        float arrive=clamp((uIntro-seed*.42)/.58,0.,1.);
        float e=1.-pow(1.-arrive,3.);
        vec3 p=mix(aSphere*1.35,aGalaxy*.55,uMorph)*(1.+(1.-e)*2.6);
        p.xz=rotation(uTime*.095+uPointer.x*.25+(1.-uIntro)*2.1)*p.xz;
        p.yz=rotation(.37+uMorph*.20+uPointer.y*.14)*p.yz;
        float camera=3.6/(3.6-p.z*.4);
        screen=uCenter+p.xy*uRadius*camera;
        size=aMeta.x*camera*uDpr*(1.+uMorph*.5)*mix(.4,1.,e);
        float alpha=(.008+seed*.016)*mix(.45,1.,uMorph)*e*.9;
        vColor=vec4(mix(vec3(.32,.70,.60),vec3(.42,.60,1.),seed*uMorph),alpha);
        vCloud=1.;
      }
      vec2 clip=screen/uResolution*2.-1.;
      gl_Position=vec4(clip.x,-clip.y,0.,1.);
      gl_PointSize=size;
    }`;
  const fragment=`
    precision mediump float;
    varying vec4 vColor;
    varying float vCloud;
    void main(){
      float d=length(gl_PointCoord-.5)*2.;
      if(d>1.)discard;
      float glow=exp(-d*d*4.6);
      float core=1.-smoothstep(.06,.58,d);
      float opacity=mix(core*.68+glow*.32,glow,vCloud)*vColor.a;
      gl_FragColor=vec4(vColor.rgb,opacity);
    }`;
  let program,buffer,uniforms={};
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  let seed=731;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const mobile=matchMedia('(max-width:760px)').matches;
  const bodyCount=mobile?5200:14000,ringCount=mobile?1700:5200,cloudCount=mobile?900:2400,starCount=mobile?350:900,meteorCount=mobile?5:10,trail=5;
  const data=[];
  function galaxy(i){const r=Math.pow(rand(),.7)*1.62;const angle=(i%4)*Math.PI/2+r*3.7+(rand()-.5)*(.7-r*.18);return[Math.cos(angle)*r,(rand()-.5)*(.10+.10*(1-r/1.7)),Math.sin(angle)*r];}
  for(let i=0;i<bodyCount;i++){const y=1-2*(i+.5)/bodyCount,r=Math.sqrt(1-y*y),angle=i*2.3999632297;const g=galaxy(i);data.push(Math.cos(angle)*r,y,Math.sin(angle)*r,...g,.7+rand()*1.9,rand(),0);}
  for(let i=0;i<ringCount;i++){const a=rand()*Math.PI*2;let r=1.23+Math.pow(rand(),.7)*.5;if(r>1.43&&r<1.49)r+=.08;const x=Math.cos(a)*r,z=Math.sin(a)*r;data.push(x,(rand()-.5)*.018,z,...galaxy(i),.5+rand()*1.4,rand(),1);}
  for(let i=0;i<starCount;i++)data.push((rand()-.5)*2.3,(rand()-.5)*2.3,.06+rand()*.3,0,0,0,.6+rand()*1.6,rand(),2);
  for(let m=0;m<meteorCount;m++){
    const offset=rand(),speed=1/(7+rand()*15),angle=(rand()<.5?20+rand()*50:110+rand()*50)*Math.PI/180,y0=.03+rand()*.42,rx=rand();
    for(let t=0;t<trail;t++)data.push(rx,t/(trail-1),offset,angle,speed,y0,0,rand(),3);
  }
  for(let i=0;i<cloudCount;i++){
    const g=galaxy(i),dx=rand()*2-1,dy=rand()*2-1,dz=rand()*2-1,len=Math.sqrt(dx*dx+dy*dy+dz*dz)||1,halo=.85+rand()*.55;
    data.push(dx/len*halo,dy/len*halo,dz/len*halo,g[0],g[1],g[2],(mobile?20:26)+rand()*(mobile?55:75),rand(),4);
  }
  function setup(){program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Particle shader failed');gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);for(const [index,name]of ['aSphere','aGalaxy','aMeta'].entries()){const attr=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,36,index*12);}for(const name of ['uResolution','uCenter','uPointer','uRadius','uTime','uMorph','uIntro','uBurst','uDpr'])uniforms[name]=gl.getUniformLocation(program,name);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);}
  setup();
  let width=0,height=0,dpr=1,cx=0,cy=0,radius=0,paused=false,active=true,lost=false;
  let frame=0,last=0,time=0,intro=0,morph=0,targetMorph=0,burst=0,lastDraw=0;
  const pointer={x:0,y:0,tx:0,ty:0};const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function resize(){const bounds=canvas.getBoundingClientRect();width=bounds.width;height=bounds.height;dpr=Math.min(devicePixelRatio||1,mobile?1.5:2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);gl.viewport(0,0,canvas.width,canvas.height);const narrow=width<=760;radius=narrow?Math.min(width*.33,170):Math.min(width*.235,height*.37);cx=width*(narrow?.52:.745);cy=narrow?Math.max(650,Math.min(height*.74,800)):height*.505;draw();}
  function draw(){if(lost||!width)return;gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform2f(uniforms.uResolution,width,height);gl.uniform2f(uniforms.uCenter,cx,cy);gl.uniform2f(uniforms.uPointer,pointer.x,pointer.y);gl.uniform1f(uniforms.uRadius,radius);gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uMorph,morph);gl.uniform1f(uniforms.uIntro,Math.min(intro/(reduced.matches?2.2:3.4),1));gl.uniform1f(uniforms.uBurst,burst);gl.uniform1f(uniforms.uDpr,dpr);gl.drawArrays(gl.POINTS,0,data.length/9);}
  function tick(now){frame=0;if(paused||document.hidden||lost)return;const dt=last?Math.min((now-last)/1000,.06):1/60;last=now;time+=dt*(reduced.matches?.55:1);intro+=dt;burst*=Math.exp(-dt*2.1);morph+=(targetMorph-morph)*(1-Math.exp(-dt*2.3));pointer.x+=(pointer.tx-pointer.x)*(1-Math.exp(-dt*3));pointer.y+=(pointer.ty-pointer.y)*(1-Math.exp(-dt*3));if(active||now-lastDraw>60){draw();lastDraw=now;}frame=requestAnimationFrame(tick);}
  function start(){if(!frame&&!paused&&!document.hidden&&!lost){last=0;frame=requestAnimationFrame(tick);}}
  document.addEventListener('pointermove',e=>{pointer.tx=e.clientX/width-.5;pointer.ty=e.clientY/height-.5;},{passive:true});
  document.addEventListener('click',e=>{if(active&&!e.target.closest('a,button,input,textarea,select,dialog')&&!reduced.matches)burst=1;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else start();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;setup();resize();start();});
  new ResizeObserver(resize).observe(canvas);resize();start();
  canvas.dataset.renderer='webgl';canvas.dataset.particles=String(data.length/9);canvas.dataset.playing='true';
  return {count:data.length/9,get paused(){return paused;},setMode(mode){targetMorph=mode==='galaxy'?1:0;if(paused){morph=targetMorph;draw();}},setActive(value){active=value;},toggle(){paused=!paused;canvas.dataset.playing=String(!paused);if(paused){cancelAnimationFrame(frame);frame=0;}else start();return paused;},replay(){intro=0;burst=0;if(paused){paused=false;canvas.dataset.playing='true';start();}}};
}

function fallback(canvas){
  const ctx=canvas.getContext('2d');let paused=false,mode='sphere',active=true,frame=0,time=0,last=0;
  if(!ctx)return {count:0,paused:false,toggle(){return false;},setMode(){},setActive(){},replay(){}};
  const stars=Array.from({length:320},()=>({x:Math.random(),y:Math.random(),depth:.06+Math.random()*.3,seed:Math.random()}));
  function tick(now){frame=0;if(paused||document.hidden)return;if(now-last>30){last=now;time+=.012;const reveal=Math.min(time/1.7,1);const w=canvas.clientWidth,h=canvas.clientHeight;canvas.width=w;canvas.height=h;const narrow=w<=760,cx=w*(narrow?.52:.74),cy=narrow?Math.max(650,h*.74):h*.51,r=(narrow?w*.32:Math.min(w*.23,h*.36))*(1+(1-reveal)*1.2);
    for(const star of stars){const twinkle=.5+.5*Math.sin(time*(.4+star.seed*1.4)+star.seed*80);ctx.fillStyle=`rgba(210,235,220,${(.08+.3*twinkle)*(.35+star.depth*2.2)*(active?1:.5)})`;ctx.fillRect(star.x*w+Math.sin(time*.02)*8*star.depth,star.y*h,1.3,1.3);}
    for(let i=0;i<1800;i++){if(i/1800>reveal)continue;const y=1-2*i/1800,q=Math.sqrt(1-y*y),a=i*2.39996+time;const x=mode==='sphere'?Math.cos(a)*q:Math.cos(a+i*.001)*(i/1100);const z=Math.sin(a)*q;const py=mode==='sphere'?y:Math.sin(a+i*.001)*(i/1300)*.4;ctx.fillStyle=`rgba(163,238,187,${(.35+z*.25)*(active?1:.5)*(.4+.6*reveal)})`;ctx.fillRect(cx+x*r,cy+(py-z*.2)*r,1.7,1.7);}}frame=requestAnimationFrame(tick);}
  function start(){if(!frame&&!paused&&!document.hidden)frame=requestAnimationFrame(tick);}document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else start();});start();canvas.dataset.renderer='canvas';canvas.dataset.playing='true';
  return {count:2120,get paused(){return paused;},toggle(){paused=!paused;canvas.dataset.playing=String(!paused);if(paused){cancelAnimationFrame(frame);frame=0;}else start();return paused;},setMode(v){mode=v;},setActive(v){active=v;},replay(){paused=false;time=0;canvas.dataset.playing='true';start();}};
}
