// Number Survivors 0.7.5 — zamek, lochy, rzeka, drzewo i zakręty
const PRIMES=[2,3,5,7,11,13,17,19];
const WORLD=12800;
const CHUNK=640;
const hash=(x,y,k=0)=>{let n=Math.imul(x+1297,374761393)^Math.imul(y+7919,668265263)^Math.imul(k+31,2246822519);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const CASTLE={left:6200,right:8400,top:900,bottom:3700};
const DUNGEON={left:8400,right:10500,top:900,bottom:3700};
const REGIONS=[
 {id:6,name:'Czerwone pustkowia',x:2500,y:2250,color:[147,69,59],kind:'badlands'},
 {id:5,name:'Suche równiny',x:2300,y:5850,color:[168,125,82],kind:'plains'},
 {id:4,name:'Gęsty las',x:5800,y:5700,color:[49,99,55],kind:'forest'},
 {id:3,name:'Zarośla',x:9900,y:5150,color:[75,141,66],kind:'thicket'},
 {id:1,name:'Łąka',x:5850,y:9750,color:[130,189,71],kind:'meadow'},
 {id:2,name:'Mokradła',x:9950,y:9800,color:[94,111,65],kind:'swamp'}
];
const REGION_SEED=48371; // Stały świat — powtarzalny układ do testowania
// Kolejność punktów: łąka → mokradła → zarośla → las → równiny → pustkowia → zamek.
// Delikatne przesunięcia punktów zmieniają trasę przy każdej nowej rozgrywce.
const ROAD_ANCHORS=[[0,11500],[700,11500],[2300,11300],[4200,10300],[5850,9750],[7100,10100],[8550,9850],[9800,10050],[10800,8900],[10400,7200],[9900,5300],[8350,5000],[6800,5500],[5700,5700],[4100,6100],[2300,5850],[2000,4300],[2500,2250],[4300,2900],[5300,2500],[5950,2350],[6250,2350],[6650,2350]];
const ROAD=ROAD_ANCHORS.map(([x,y])=>({x,y}));
const roadNearest=(x,y)=>{
 let best=Infinity,segment=0,t=0;
 for(let i=0;i<ROAD.length-1;i++){
  const a=ROAD[i],b=ROAD[i+1],dx=b.x-a.x,dy=b.y-a.y;
  const u=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy),0,1);
  const d=Math.hypot(x-a.x-u*dx,y-a.y-u*dy);
  if(d<best){best=d;segment=i;t=u;}
 }
 return {distance:best,segment,t};
};
const regionScores=(x,y)=>{
 const scores=REGIONS.map((r,i)=>{
  const dx=(x-r.x)/3900,dy=(y-r.y)/3600;
  const noise=(Math.sin(x/920+i*2.7)+Math.cos(y/840+i*1.8))*.035;
  return {region:r,score:dx*dx+dy*dy+noise};
 }).sort((a,b)=>a.score-b.score);
 return scores;
};
const regionAt=(x,y)=>{
 // Północna strefa za leśną ścianą należy do pustkowi (region 6),
 // nie do zielonych biomów 3 i 4. Zamek ma własny, osobny obszar.
 if(x>=CASTLE.left&&x<CASTLE.right&&y>=CASTLE.top&&y<CASTLE.bottom)return {id:7,name:'Zamek',kind:'castle',color:[111,113,119]};
 if(x>=DUNGEON.left&&x<DUNGEON.right&&y>=DUNGEON.top&&y<DUNGEON.bottom)return {id:8,name:'Lochy',kind:'dungeon',color:[55,56,69]};
 if(y<3900&&x<CASTLE.left)return REGIONS[0];
 return regionScores(x,y)[0].region;
};
const biomeWeights=(x,y)=>{
 const scores=regionScores(x,y);
 const weights={meadow:0,swamp:0,thicket:0,forest:0,plains:0,badlands:0,castle:0,dungeon:0};
 const special=regionAt(x,y);if(special.kind==='castle'||special.kind==='dungeon'){weights[special.kind]=1;return weights;}
 const a=scores[0],b=scores[1];
 const blend=clamp((b.score-a.score)/.08,0,1);
 weights[a.region.kind]=.5+.5*blend;
 weights[b.region.kind]+=.5-.5*blend;
 return weights;
};
const swampBlend=(x,y)=>biomeWeights(x,y).swamp;
const nextCost=level=>Math.min(40,level*2);
const factorTypes=n=>PRIMES.filter(p=>{let x=n;return x%p===0}).length;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
class Meadow extends Phaser.Scene{
 constructor(){super('Meadow');}
 create(){
  this.cameras.main.setBackgroundColor('#79b65d');
  this.terrainChunks=new Map();this.obstacleChunks=new Map();
  this.physicalKeys=new Set();
  this.touchVector={x:0,y:0};this.touchDash=false;this.controlMode='keyboard';
  this.controlSelect=document.getElementById('control-mode');
  this.touchControls=document.getElementById('touch-controls');
  this.touchStick=document.getElementById('touch-stick');
  this.touchKnob=document.getElementById('touch-knob');
  this.controlSelect.value=matchMedia('(pointer:coarse)').matches?'touch':'keyboard';
  this.setControlMode(this.controlSelect.value);
  this.controlSelect.addEventListener('change',()=>this.setControlMode(this.controlSelect.value));
  const savedOpacity=Number(localStorage.getItem('ns-touch-opacity'));
  this.touchOpacity=Number.isFinite(savedOpacity)&&savedOpacity>=.3&&savedOpacity<=1?savedOpacity:.8;
  this.opacitySlider=document.getElementById('touch-opacity');
  this.opacitySlider.value=String(Math.round(this.touchOpacity*100));
  this.opacitySlider.addEventListener('input',()=>{this.touchOpacity=Number(this.opacitySlider.value)/100;this.applyTouchSettings();localStorage.setItem('ns-touch-opacity',String(this.touchOpacity));});
  this.touchSize=document.getElementById('touch-size');
  this.touchSize.value=localStorage.getItem('ns-touch-size')||'normal';
  this.touchSize.addEventListener('change',()=>{localStorage.setItem('ns-touch-size',this.touchSize.value);this.applyTouchSettings();});
  document.getElementById('pause-options').addEventListener('click',()=>{document.getElementById('options-panel').hidden=false;});
  document.getElementById('options-close').addEventListener('click',()=>{document.getElementById('options-panel').hidden=true;});
  this.applyTouchSettings();
  this.perfPanel=document.getElementById('perf-panel');
  this.perfToggle=document.getElementById('show-performance');
  this.perfToggle.checked=localStorage.getItem('ns-perf')==='1';
  this.perfPanel.hidden=!this.perfToggle.checked;
  this.perfToggle.addEventListener('change',()=>{this.perfPanel.hidden=!this.perfToggle.checked;localStorage.setItem('ns-perf',this.perfToggle.checked?'1':'0');});
  this.perfLast=0;
  this.perfSamples={count:0,total:0,terrain:0,enemies:0,max:0};
  const joystick=(event)=>{
   const rect=this.touchStick.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
   const dx=event.clientX-cx,dy=event.clientY-cy,len=Math.hypot(dx,dy),max=rect.width*.35;
   const scale=Math.min(1,max/(len||1));
   this.touchVector.x=dx*scale/max;this.touchVector.y=dy*scale/max;
   this.touchKnob.style.transform='translate('+dx*scale+'px,'+dy*scale+'px)';
  };
  this.touchStick.addEventListener('pointerdown',event=>{event.preventDefault();this.touchStick.setPointerCapture(event.pointerId);joystick(event);});
  this.touchStick.addEventListener('pointermove',event=>{if(this.touchStick.hasPointerCapture(event.pointerId))joystick(event);});
  const resetStick=()=>{this.touchVector.x=0;this.touchVector.y=0;this.touchKnob.style.transform='translate(0,0)';};
  this.touchStick.addEventListener('pointerup',resetStick);this.touchStick.addEventListener('pointercancel',resetStick);
  const dashButton=document.getElementById('touch-dash');
  dashButton.addEventListener('pointerdown',event=>{event.preventDefault();this.touchDash=true;});
  dashButton.addEventListener('pointerup',()=>this.touchDash=false);
  dashButton.addEventListener('pointercancel',()=>this.touchDash=false);
  document.getElementById('touch-pause').addEventListener('click',()=>{if(!this.upgradeOpen)this.togglePause();});
  document.getElementById('touch-resume').addEventListener('click',()=>{if(this.manualPause)this.togglePause();});
  document.getElementById('pause-resume').addEventListener('click',()=>{if(this.manualPause)this.togglePause();});
  this.touchPrimes=document.getElementById('touch-primes');
  for(let i=0;i<PRIMES.length;i++){
   const button=document.createElement('button');button.type='button';button.textContent=String(PRIMES[i]);button.addEventListener('click',()=>{if(this.upgradeOpen)this.chooseUpgrade(i);else if(!this.manualPause)this.selectPrime(PRIMES[i]);});this.touchPrimes.append(button);
  }
  document.getElementById('touch-upgrades').addEventListener('click',()=>{if(this.upgradeOpen)this.chooseUpgrade(0);});
  this.keyboardCapture=document.getElementById('keyboard-capture');
  this.keyboardStatus=document.getElementById('keyboard-status');
  this.keyboardLast=document.getElementById('keyboard-last');
  this.keyboardActivate=document.getElementById('keyboard-activate');
  this.keyboardActivate.addEventListener('click',()=>this.activateKeyboard());
  this.keyboardCapture.addEventListener('blur',()=>this.updateKeyboardStatus('Nieaktywna — dotknij Aktywuj klawiaturę'));
  this.keyboardCapture.addEventListener('focus',()=>this.updateKeyboardStatus('Aktywna — sprawdź WASD lub strzałki'));
  this.keyboardCapture.addEventListener('input',()=>{this.keyboardCapture.value='';});
  this.onPhysicalKeyDown=event=>{
   const key=event.key.toLowerCase();
   const normalized=key==='arrowup'?'up':key==='arrowdown'?'down':key==='arrowleft'?'left':key==='arrowright'?'right':key===' '?'space':key;
   if(['up','down','left','right','w','a','s','d','space','p','1','2','3','4','5','6','7','8'].includes(normalized)){
    event.preventDefault();event.stopPropagation();this.physicalKeys.add(normalized);
    this.keyboardLast.textContent='Odebrany klawisz: '+normalized;
    this.updateKeyboardStatus('Gra odbiera klawiaturę ✓');
    if(!event.repeat)this.handleGameKey(normalized);
   }
  };
  this.onPhysicalKeyUp=event=>{const key=event.key.toLowerCase();const normalized=key==='arrowup'?'up':key==='arrowdown'?'down':key==='arrowleft'?'left':key==='arrowright'?'right':key===' '?'space':key;this.physicalKeys.delete(normalized);};
  this.onKeyboardBlur=()=>{this.physicalKeys.clear();this.updateKeyboardStatus('Okno straciło fokus — aktywuj klawiaturę');};
  window.addEventListener('keydown',this.onPhysicalKeyDown,true);
  window.addEventListener('keyup',this.onPhysicalKeyUp,true);
  window.addEventListener('blur',this.onKeyboardBlur);
  const gameHost=document.getElementById('game');gameHost.tabIndex=0;
  gameHost.addEventListener('pointerdown',event=>{if(this.controlMode==='keyboard'&&event.target.tagName==='CANVAS')this.activateKeyboard();});
  this.updateKeyboardStatus('Dotknij Aktywuj klawiaturę');
  const minimap=document.getElementById('world-minimap');
  minimap.addEventListener('pointerup',event=>{event.stopPropagation();this.teleportFromMap(event);});
  this.player=this.add.container(420,11500).setDepth(10);
  this.player.add([this.add.ellipse(0,7,29,14,0x314b2c),this.add.circle(0,-2,16,0x315a39),this.add.triangle(0,-12,-17,5,0,-24,17,5,0x467d45),this.add.circle(0,-11,7,0xf4c69c),this.add.line(0,0,12,-2,21,12,0xb77d46).setLineWidth(3)]);
  this.cameras.main.startFollow(this.player,true,0.12,0.12);this.cameras.main.setBounds(0,0,WORLD,WORLD);
  this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT');
  this.highestRegion=1;this.teleportTesting=false;
  this.active=[2];this.locked=[];this.enemies=[];this.tokens=[];this.arrows=[];this.level=1;this.exp=0;this.total=0;this.health=5;this.startTime=0;this.clock=0;this.upgradeOpen=false;this.manualPause=false;this.pendingUpgrades=0;this.attackRange=450;this.attackRate=1;this.multishot=1;this.moveMultiplier=1;this.pickupRadius=37;this.maxHealth=5;this.potionLevel=0;this.drops=[];this.special=null;this.eventIndex=0;this.warningUntil=0;this.lastDash=-10000;this.invulnUntil=0;this.dashUntil=0;this.dashDirection=new Phaser.Math.Vector2(1,0);this.lastSpawn=-99999;this.lastAttack=new Map();this.lastDamage=0;this.lastMove=new Phaser.Math.Vector2(1,0);
  // Stałe elementy HUD: paski w lewym górnym rogu, dzielniki i unik na dole.
  const ui=(obj)=>obj.setScrollFactor(0).setDepth(100);
  const txt=(x,y,s,size=16)=>ui(this.add.text(x,y,s,{fontFamily:'Arial',fontSize:size+'px',fontStyle:'bold',color:'#ffffff',stroke:'#233c27',strokeThickness:3}));
  this.hpBackground=ui(this.add.rectangle(16,15,222,24,0x25352b,.86).setOrigin(0));
  this.hpBar=ui(this.add.rectangle(20,19,214,16,0x50c46b).setOrigin(0));
  this.hpLabel=txt(25,18,'HP',14);

  this.expBackground=ui(this.add.rectangle(16,44,222,19,0x25352b,.86).setOrigin(0));
  this.expBar=ui(this.add.rectangle(20,48,214,11,0xe2b84e).setOrigin(0));
  this.levelLabel=txt(247,44,'Poziom 1',15);
  this.timeLabel=txt(848,15,'0:00',19);
  this.bottomPanel=ui(this.add.rectangle(480,551,726,78,0x182b20,.86).setStrokeStyle(2,0x63825a));
  this.primeButtons=PRIMES.map((p,i)=>{
   const x=154+i*72;
   const bg=ui(this.add.rectangle(x,550,62,56,0x59615b).setStrokeStyle(2,0x89938a));
   const key=txt(x-24,528,String(i+1),12);
   const label=txt(x,543,String(p),23).setOrigin(.5,0);
   const lock=txt(x+17,529,'🔒',13).setVisible(false);
   return {bg,key,label,lock};
  });
  this.dashBox=ui(this.add.rectangle(783,550,100,56,0x339b54).setStrokeStyle(2,0x91d6a3));
  this.dashLabel=txt(783,535,'SPACJA',16).setOrigin(.5,0);
  this.dashHint=txt(783,558,'UNIK',12).setOrigin(.5,0);
  this.input.keyboard.enabled=false; // Obsługa przez window capture, również w Safari na iPadzie.
  this.layoutHUD(this.scale.width,this.scale.height);
  this.setControlMode(this.controlSelect.value);
  this.scale.on('resize',this.onGameResize,this);
  this.events.once('shutdown',()=>{this.keyboardActivate.replaceWith(this.keyboardActivate.cloneNode(true));window.removeEventListener('keydown',this.onPhysicalKeyDown,true);window.removeEventListener('keyup',this.onPhysicalKeyUp,true);window.removeEventListener('blur',this.onKeyboardBlur);this.scale.off('resize',this.onGameResize,this);});
  // Pierwsza fala dopiero po ustawieniu kamery w pierwszej klatce.
  this.lastSpawn=-1;
  this.updateTerrain();
 }
 applyTouchSettings(){
  this.touchControls.style.setProperty('--touch-opacity',String(this.touchOpacity));
  this.touchControls.dataset.size=this.touchSize.value;
 }
 setControlMode(mode){
  this.controlMode=mode;this.touchControls.hidden=mode!=='touch';
  document.body.classList.toggle('touch-mode',mode==='touch');
  if(mode==='touch'&&this.keyboardCapture)this.keyboardCapture.blur();
  if(mode==='keyboard'&&this.keyboardCapture)this.activateKeyboard();
  if(this.bottomPanel){
   const show=mode!=='touch';
   this.bottomPanel.setVisible(show);this.dashBox.setVisible(show);this.dashLabel.setVisible(show);this.dashHint.setVisible(show);
   this.primeButtons.forEach(b=>{b.bg.setVisible(show);b.key.setVisible(show);b.label.setVisible(show);b.lock.setVisible(show&&this.locked.includes(Number(b.label.text)));});
  }
  if(mode!=='touch'){this.touchVector.x=0;this.touchVector.y=0;this.touchDash=false;}
 }
 activateKeyboard(){
  this.physicalKeys.clear();
  this.keyboardCapture.focus({preventScroll:true});
  this.updateKeyboardStatus(document.activeElement===this.keyboardCapture?'Aktywna — sprawdź WASD lub strzałki':'Safari nie przekazało fokusu — spróbuj ponownie');
 }
 updateKeyboardStatus(message){this.keyboardStatus.textContent=message;}
 handleGameKey(key){
  if(key==='p'){if(!this.upgradeOpen)this.togglePause();return;}
  if(this.upgradeOpen){if(['1','2','3'].includes(key))this.chooseUpgrade(Number(key)-1);return;}
  if(this.manualPause)return;
  const i=Number(key)-1;if(i>=0&&i<8)this.selectPrime(PRIMES[i]);
 }
 isPressed(...keys){return keys.some(key=>this.physicalKeys.has(key));}
 biomeAt(x,y){return regionAt(x,y).kind;}
 // Twarde granice poza szerokimi bramami na szlaku. Przejścia mają ~2 ekrany.
 regionBoundaryAt(x,y,radius=0){
  const current=regionAt(x,y);
  if(current.kind==='castle'||current.kind==='dungeon')return false;
  const d=radius+32;
  const neighbors=[regionAt(x+d,y),regionAt(x-d,y),regionAt(x,y+d),regionAt(x,y-d)];
  // Większość świata nie leży na granicy: pomijamy wtedy kosztowny test szlaku.
  const boundary=neighbors.some(other=>other.kind!=='castle'&&other.kind!=='dungeon'&&other.id!==current.id);
  return boundary&&roadNearest(x,y).distance>=740+radius;
 }
 inRect(x,y,r){return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
 dungeonOpen(x,y){
  // Szerokie skrzyżowania i korytarze w układzie kratowym.
  const horizontal=[1500,2300,3100].some(yy=>Math.abs(y-yy)<110);
  const vertical=[8850,9600,10200].some(xx=>Math.abs(x-xx)<110);
  return horizontal||vertical;
 }
 structureBlocked(x,y,radius=0){
  const x0=x-radius,x1=x+radius,y0=y-radius,y1=y+radius;
  const castleOuter=x1>CASTLE.left&&x0<CASTLE.right&&y1>CASTLE.top&&y0<CASTLE.bottom;
  const dungeonOuter=x1>DUNGEON.left&&x0<DUNGEON.right&&y1>DUNGEON.top&&y0<DUNGEON.bottom;
  if(castleOuter){
   // Jedyna zachodnia brama do zamku i przejście do lochów na wschodzie.
   // Jedyna brama zewnętrzna prowadzi od pustkowi, po zachodniej stronie.
   if(x0<CASTLE.left+75&&x1>CASTLE.left&&y1>CASTLE.top&&y0<CASTLE.bottom&&Math.abs(y-2350)>210)return true;
   if(y0<CASTLE.top+75&&y1>CASTLE.top)return true;
   // Południowa ściana zamku jest w całości nieprzebyta.
   if(y1>CASTLE.bottom-75&&y0<CASTLE.bottom)return true;
   if(x1>CASTLE.right-75&&x0<CASTLE.right&&Math.abs(y-2300)>170)return true;
   // Dziedziniec, dwa skrzydła z drzwiami pośrodku.
   if(x1>6800&&x0<6900&&y1>1450&&y0<3150&&Math.abs(y-2300)>180)return true;
   if(x1>7700&&x0<7800&&y1>1450&&y0<3150&&Math.abs(y-2300)>180)return true;
   if(y1>1450&&y0<1540&&x1>6800&&x0<7800&&Math.abs(x-7300)>170)return true;
  }
  if(dungeonOuter){
   if(y0<DUNGEON.top+75&&y1>DUNGEON.top)return true;
   if(y1>DUNGEON.bottom-75&&y0<DUNGEON.bottom)return true;
   if(x1>DUNGEON.right-75&&x0<DUNGEON.right)return true;
   if(x0<DUNGEON.left+75&&x1>DUNGEON.left&&Math.abs(y-2300)>170)return true;
   if(x>DUNGEON.left+75&&x<DUNGEON.right-75&&y>DUNGEON.top+75&&y<DUNGEON.bottom-75){
    for(const ox of [x-radius,x+radius])for(const oy of [y-radius,y+radius])if(!this.dungeonOpen(ox,oy))return true;
   }
  }
  return false;
 }
 teleportFromMap(event){
  if(!this.manualPause)return;
  const canvas=event.currentTarget,rect=canvas.getBoundingClientRect();
  const x=clamp((event.clientX-rect.left)/rect.width*WORLD,30,WORLD-30);
  const y=clamp((event.clientY-rect.top)/rect.height*WORLD,30,WORLD-30);
  let target=null;
  // Teleportacja jest narzędziem testowym: pomija blokadę postępu,
  // ale nadal respektuje ściany i przeszkody.
  this.teleportTesting=true;
  if(!this.blocked(x,y,17))target={x,y};
  else for(let radius=30;radius<=600&&!target;radius+=30)for(let a=0;a<32;a++){
   const angle=a*Math.PI/16,tx=clamp(x+Math.cos(angle)*radius,30,WORLD-30),ty=clamp(y+Math.sin(angle)*radius,30,WORLD-30);
   if(!this.blocked(tx,ty,17)){target={x:tx,y:ty};break;}
  }
  this.teleportTesting=false;
  const message=document.getElementById('teleport-status');
  if(!target){message.textContent='Nie znaleziono bezpiecznego miejsca w pobliżu.';return;}
  this.player.setPosition(target.x,target.y);
  this.highestRegion=Math.max(this.highestRegion||1,regionAt(target.x,target.y).id<=6?regionAt(target.x,target.y).id:6);
  this.cameras.main.centerOn(target.x,target.y);
  this.updateTerrain();this.drawMinimap();
  message.textContent='Przeniesiono do: '+Math.round(target.x)+', '+Math.round(target.y)+' — naciśnij P, aby grać.';
 }
 // Rzeka odcina południe i środek; przejście prowadzi północą.
 riverX(y){return 8700+Math.sin(y/540+REGION_SEED)*150;}
 riverAt(x,y,radius=0){return y>8100&&y<11700&&Math.abs(x-this.riverX(y))<145+radius&&roadNearest(x,y).distance>100-radius;}
 // Zwarty pas leśny ma szerokie obejście na południu.
 forestWallAt(x,y,radius=0){return x>4200&&x<7900&&Math.abs(y-(7400+Math.sin(x/650+REGION_SEED)*115))<165+radius&&roadNearest(x,y).distance>105-radius;}
 // Ciągła ściana lasu od zachodniej do wschodniej krawędzi mapy.
 // Jedyna przerwa to przełęcz na szlaku prowadzącym przez region 6.
 castleForestAt(x,y,radius=0){
  const wallY=4070+Math.sin(x/820)*65;
  // Przerwa dokładnie przy zachodnim odcinku szlaku (region 5 → 6).
  const westernPass=x>=1820&&x<=2440;
  return Math.abs(y-wallY)<175+radius&&!westernPass;
 }
 barrierAt(x,y,radius=0){return this.riverAt(x,y,radius)||this.forestWallAt(x,y,radius)||this.castleForestAt(x,y,radius);}
 obstaclesFor(cx,cy){
  const key=cx+','+cy;
  if(this.obstacleChunks.has(key))return this.obstacleChunks.get(key);
  const obstacles=[];
  const ox=cx*CHUNK,oy=cy*CHUNK;
  for(let i=0;i<7;i++){
   const x=ox+90+hash(cx,cy,i*11+101)*(CHUNK-180);
   const y=oy+90+hash(cx,cy,i*11+102)*(CHUNK-180);
   const kind=this.biomeAt(x,y),roll=hash(cx,cy,i*11+103);
   if(kind==='meadow'||kind==='plains'||kind==='badlands'||kind==='castle'||kind==='dungeon'||this.barrierAt(x,y,150))continue;
   if(kind==='swamp'&&roll>.55)continue;
   if(kind==='thicket'&&roll>.72)continue;
   if(kind==='forest'&&roll>.82)continue;
   const radius=kind==='swamp'?65+hash(cx,cy,i*11+104)*55:kind==='thicket'?27+hash(cx,cy,i*11+104)*21:24+hash(cx,cy,i*11+104)*18;
   // Zachowaj wolną przestrzeń startową i szerokie korytarze między obiektami.
   if(Math.hypot(x-420,y-11500)<450||roadNearest(x,y).distance<radius+100)continue;
   if(obstacles.some(o=>Math.hypot(x-o.x,y-o.y)<radius+o.radius+95))continue;
   obstacles.push({x,y,radius,kind,shape:kind==='swamp'&&roll<.22?'channel':'round'});
  }
  this.obstacleChunks.set(key,obstacles);return obstacles;
 }
 nearbyObstacles(x,y){
  const cx=Math.floor(x/CHUNK),cy=Math.floor(y/CHUNK),all=[];
  for(let yy=Math.max(0,cy-1);yy<=Math.min(WORLD/CHUNK-1,cy+1);yy++)for(let xx=Math.max(0,cx-1);xx<=Math.min(WORLD/CHUNK-1,cx+1);xx++)all.push(...this.obstaclesFor(xx,yy));
  return all;
 }
 // Szybka kolizja: bez tworzenia tablic, bez Math.hypot i tylko w sąsiednich chunkach.
 hitsObstacle(x,y,radius){
  const cx=Math.floor(x/CHUNK),cy=Math.floor(y/CHUNK);
  for(let yy=Math.max(0,cy-1);yy<=Math.min(WORLD/CHUNK-1,cy+1);yy++){
   for(let xx=Math.max(0,cx-1);xx<=Math.min(WORLD/CHUNK-1,cx+1);xx++){
    for(const o of this.obstaclesFor(xx,yy)){
     const dx=x-o.x,dy=y-o.y,limit=o.radius+radius;
     if(Math.abs(dx)<limit&&Math.abs(dy)<limit&&dx*dx+dy*dy<limit*limit)return true;
    }
   }
  }
  return false;
 }
 blocked(x,y,radius){
  if(x<radius||y<radius||x>WORLD-radius||y>WORLD-radius||this.barrierAt(x,y,radius)||this.structureBlocked(x,y,radius)||this.regionBoundaryAt(x,y,radius))return true;
  const targetRegion=regionAt(x,y);
  if(!this.teleportTesting){
   if(targetRegion.id===7&&this.highestRegion<6)return true;
   if(targetRegion.id<=6&&targetRegion.id>this.highestRegion+1)return true;
  }
  return this.hitsObstacle(x,y,radius);
 }
 moveAround(entity,vx,vy,dt,speed,radius){
  const step=speed*dt;
  const tx=entity.x+vx*step,ty=entity.y+vy*step;
  if(!this.blocked(tx,ty,radius)){entity.x=tx;entity.y=ty;return true;}
  // Przesuwanie wzdłuż krawędzi zamiast przenikania przez przeszkodę.
  let moved=false;
  if(!this.blocked(tx,entity.y,radius)){entity.x=tx;moved=true;}
  if(!this.blocked(entity.x,ty,radius)){entity.y=ty;moved=true;}
  return moved;
 }
 steerEnemy(enemy,dt,speed){
  let tx=this.player.x,ty=this.player.y;
  // Przy odcięciu barierą wróg szuka mostu albo obejścia, nie naciera w ścianę.
  if((enemy.x-this.riverX(enemy.y))*(this.player.x-this.riverX(this.player.y))<0&&enemy.y>8100&&enemy.y<11700){tx=8550;ty=9850;}
  else if((enemy.y-7400)*(this.player.y-7400)<0&&enemy.x>4200&&enemy.x<7900){tx=8050;ty=7400;}
  const dx=tx-enemy.x,dy=ty-enemy.y,dist=Math.hypot(dx,dy)||1;
  const vx=dx/dist,vy=dy/dist;
  const radius=Math.min(enemy.size*.55,24);
  const ahead=Math.max(65,speed*dt*5);
  if(!this.blocked(enemy.x+vx*ahead,enemy.y+vy*ahead,radius)&&this.moveAround(enemy,vx,vy,dt,speed,radius))return;
  // Dwa kierunki obchodzenia; zachowaj wybrany kierunek, żeby nie drgać przy brzegu.
  const turn=enemy.turn||((hash(Math.floor(enemy.x/40),Math.floor(enemy.y/40),5)<.5)?1:-1);
  const choices=[turn,-turn];
  for(const side of choices){
   const sx=vx*.35-vy*side*.94,sy=vy*.35+vx*side*.94;
   if(!this.blocked(enemy.x+sx*ahead,enemy.y+sy*ahead,radius)&&this.moveAround(enemy,sx,sy,dt,speed,radius)){enemy.turn=side;return;}
  }
  for(const side of choices){if(this.moveAround(enemy,-vy*side,vx*side,dt,speed,radius)){enemy.turn=side;return;}}
 }
 terrainColor(t){return Phaser.Display.Color.Interpolate.ColorWithColor({r:121,g:182,b:93},{r:73,g:103,b:76},100,Math.round(t*100));}
 updateTerrain(){
  const view=this.cameras.main.worldView;
  const minX=clamp(Math.floor((view.left-CHUNK)/CHUNK),0,WORLD/CHUNK-1);
  const maxX=clamp(Math.floor((view.right+CHUNK)/CHUNK),0,WORLD/CHUNK-1);
  const minY=clamp(Math.floor((view.top-CHUNK)/CHUNK),0,WORLD/CHUNK-1);
  const maxY=clamp(Math.floor((view.bottom+CHUNK)/CHUNK),0,WORLD/CHUNK-1);
  const visible=new Set();
  for(let cy=minY;cy<=maxY;cy++)for(let cx=minX;cx<=maxX;cx++){
   const key=cx+','+cy;visible.add(key);
   if(!this.terrainChunks.has(key))this.buildChunk(cx,cy,key);
  }
  for(const [key,g] of this.terrainChunks)if(!visible.has(key)){
   g.destroy();this.terrainChunks.delete(key);
   const textureKey='terrain-'+key;
   if(this.textures.exists(textureKey))this.textures.remove(textureKey);
  }
 }
 drawSwampPond(g,o){
  // Nieregularna linia brzegowa jest wyłącznie wizualna; kolizja pozostaje kołowa.
  const x=o.x,y=o.y,r=o.radius;
  const shore=[],water=[],inner=[];
  const count=18,seed=Math.floor(x/7)+Math.floor(y/11);
  for(let i=0;i<count;i++){
   const a=i*Math.PI*2/count;
   const ripple=.87+hash(seed,i,29)*.25;
   const rr=r*ripple;
   shore.push(new Phaser.Math.Vector2(x+Math.cos(a)*(rr+11),y+Math.sin(a)*(rr*.78+9)));
   water.push(new Phaser.Math.Vector2(x+Math.cos(a)*rr,y+Math.sin(a)*rr*.78));
   inner.push(new Phaser.Math.Vector2(x+Math.cos(a)*rr*.76,y+Math.sin(a)*rr*.59));
  }
  g.fillStyle(0x2b5446,.75).fillPoints(shore,true);
  g.fillStyle(0x4a9aa2,1).fillPoints(water,true);
  g.fillStyle(0x367d8c,.85).fillPoints(inner,true);
  g.lineStyle(2,0x9ac6a8,.75).strokePoints(water,true);
  for(let k=0;k<3;k++){
   const angle=hash(seed,k,71)*Math.PI*2;
   const distance=r*(.17+hash(seed,k,72)*.38);
   const px=x+Math.cos(angle)*distance,py=y+Math.sin(angle)*distance*.7;
   g.lineStyle(1.7,0xb2d6c1,.48).lineBetween(px-10,py,px+8,py);
  }
  // Trzciny na obrzeżach — rosną poza środkiem oczka, nie zasłaniają całej wody.
  for(let k=0;k<4;k++){
   const a=hash(seed,k,83)*Math.PI*2;
   const px=x+Math.cos(a)*(r+4),py=y+Math.sin(a)*(r*.79+5);
   const scale=.8+hash(seed,k,84)*.45;
   g.fillStyle(0x234e34,.22).fillEllipse(px,py+5,22*scale,7*scale);
   for(let j=0;j<3;j++){
    const sx=px+(j-1)*7*scale,sy=py+(j%2)*3;
    const height=(23+hash(seed,k*3+j,86)*17)*scale;
    const tipX=sx+(j-1)*4*scale;
    g.lineStyle(2.5*scale,j===1?0x8bb45c:0x477c44,1).lineBetween(sx,sy,tipX,sy-height);
    if(j!==2){g.fillStyle(0x67482b).fillRoundedRect(tipX-3*scale,sy-height-8*scale,6*scale,13*scale,3*scale);g.fillStyle(0x987143,.65).fillRect(tipX-1*scale,sy-height-6*scale,2*scale,8*scale);}
   }
  }
 }
 drawThicket(g,x,y,r,seed){
  // Nieregularne kępy zamiast okrągłych placków; obszar kolizji bez zmian.
  g.fillStyle(0x1b4125,.35).fillEllipse(x+7,y+12,r*2.2,r*.8);
  for(let j=0;j<9;j++){
   const a=j*2.399+hash(seed,j,11)*.5;
   const distance=r*(.23+hash(seed,j,12)*.42);
   const px=x+Math.cos(a)*distance,py=y+Math.sin(a)*distance*.67;
   const size=r*(.33+hash(seed,j,13)*.18);
   g.fillStyle(0x204b2a).fillEllipse(px+3,py+4,size*2.05,size*1.65);
   g.fillStyle(j%3===0?0x6ca343:j%3===1?0x3e7937:0x4e8d3b).fillEllipse(px,py,size*1.85,size*1.45);
   g.fillStyle(0x8cb75c,.6).fillEllipse(px-size*.25,py-size*.25,size*.55,size*.23);
  }
  for(let j=0;j<4;j++){
   const px=x+(hash(seed,j,20)-.5)*r*1.3,py=y+(hash(seed,j,21)-.5)*r*.8;
   g.lineStyle(2.5,0x76533a).lineBetween(px,py+6,px+6,py-12);
   g.lineStyle(2,0x76533a).lineBetween(px+3,py-5,px+12,py-9);
  }
 }
 drawForestTree(g,x,y,r,seed){
  // Lekka perspektywa 3/4: widoczny pień, cień i kilka warstw korony.
  g.fillStyle(0x173b24,.27).fillEllipse(x+12,y+16,r*2.2,r*.85);
  g.fillStyle(0x4c3829).fillRoundedRect(x-8,y-r*.12,16,r*.9,4);
  g.fillStyle(0x99734c,.7).fillRect(x-4,y-r*.05,4,r*.65);
  for(let j=0;j<6;j++){
   const a=j*Math.PI*2/6+.3;
   const px=x+Math.cos(a)*r*.44,py=y-r*.5+Math.sin(a)*r*.31;
   const rr=r*(.53+hash(seed,j,25)*.12);
   g.fillStyle(0x163e29).fillCircle(px+3,py+5,rr+3);
   g.fillStyle(j%3===0?0x3d7d3c:j%3===1?0x285e36:0x347043).fillCircle(px,py,rr);
  }
  g.fillStyle(0x6da34e,.75).fillEllipse(x-r*.27,y-r*.92,r*.65,r*.24);
 }
 drawDryGround(g,x,y,kind,variant,s){
  const volcanic=kind==='badlands';
  if(variant===0){
   // Niskie, nieregularne skały i ich miękkie cienie.
   g.fillStyle(0x30291f,.2).fillEllipse(x+4*s,y+9*s,31*s,11*s);
   g.fillStyle(volcanic?0x513e3a:0x716956).fillPoints([{x:x-15*s,y:y+4*s},{x:x-9*s,y:y-8*s},{x:x+2*s,y:y-13*s},{x:x+13*s,y:y-4*s},{x:x+17*s,y:y+6*s}],true);
   g.fillStyle(volcanic?0x8e6c60:0xb3a085).fillPoints([{x:x-9*s,y:y-8*s},{x:x+2*s,y:y-13*s},{x:x+6*s,y:y-2*s},{x:x-3*s,y:y+1*s}],true);
  }else if(variant===1){
   // Suche, powykręcane gałązki.
   g.lineStyle(3*s,volcanic?0x3e302b:0x6a5035).lineBetween(x,y+7*s,x-2*s,y-14*s);
   g.lineStyle(2*s,volcanic?0x4c332d:0x806040);
   g.lineBetween(x-2*s,y-8*s,x-13*s,y-17*s);
   g.lineBetween(x-2*s,y-4*s,x+11*s,y-14*s);
   g.lineBetween(x+6*s,y-9*s,x+12*s,y-20*s);
  }else if(volcanic){
   // Spękana ziemia, żar i lekki dym: statyczne, bez kosztu animacji.
   g.fillStyle(0x3c302c,.85).fillEllipse(x,y,31*s,14*s);
   g.lineStyle(2*s,0xf09b47,.75).lineBetween(x-9*s,y,x+7*s,y+2*s);
   g.fillStyle(0xe7b4a0,.17).fillEllipse(x-4*s,y-12*s,15*s,13*s);
   g.fillStyle(0xd6b3a2,.12).fillEllipse(x+2*s,y-22*s,18*s,14*s);
  }else{
   g.fillStyle(0xc9ae74,.55).fillEllipse(x,y,22*s,8*s);
   for(let j=-1;j<=1;j++)g.lineStyle(2*s,0x9a884f).lineBetween(x+j*5*s,y+4*s,x+(j*7+2)*s,y-10*s);
  }
 }
 drawWildGround(g,x,y,kind,variant,s){
  if(kind==='thicket'){
   if(variant===0){ // paproć
    for(let j=-2;j<=2;j++){
     g.lineStyle(2,0x2b6232).lineBetween(x,y+8,x+j*8*s,y-(14-Math.abs(j)*3)*s);
     g.fillStyle(j%2?0x5a9d43:0x77aa4b).fillEllipse(x+j*6*s,y-(9-Math.abs(j)*2)*s,12*s,5*s);
    }
   }else if(variant===1){g.fillStyle(0x6d5637,.6).fillEllipse(x,y,18*s,5*s);g.lineStyle(2,0x77513a).lineBetween(x-9*s,y,x+10*s,y-5*s);}
   else{g.fillStyle(0x326c37,.65).fillEllipse(x,y,23*s,9*s);g.fillStyle(0x79a54a,.65).fillEllipse(x-5*s,y-3*s,10*s,4*s);}
  }else{
   if(variant===0){ // grzyby
    for(let j=0;j<2;j++){
     const xx=x+j*12*s,yy=y+j*4*s;
     g.fillStyle(0xe4c99a).fillRoundedRect(xx-2*s,yy-4*s,4*s,11*s,2*s);
     g.fillStyle(0xa45435).fillEllipse(xx,yy-5*s,13*s,7*s);
     g.fillStyle(0xf6d8ac).fillCircle(xx-3*s,yy-6*s,1.6*s);
    }
   }else if(variant===1){g.fillStyle(0x775b32,.6).fillEllipse(x,y,19*s,5*s);g.fillStyle(0xb38c4e,.7).fillEllipse(x+7*s,y-4*s,11*s,5*s);}
   else{g.lineStyle(2,0x426e38).lineBetween(x,y+5*s,x+4*s,y-14*s);g.fillStyle(0x638f47).fillEllipse(x-3*s,y-7*s,15*s,6*s);}
  }
 }
 drawMeadowDecoration(g,x,y,variant,scale=1){
  // Elementy rysunkowe: miękkie cienie, ciemny kontur, jasne akcenty.
  const s=scale;
  if(variant===0){ // mały kępka trawy
   g.fillStyle(0x376f32,.22).fillEllipse(x,y+5*s,28*s,9*s);
   g.lineStyle(3*s,0x315c2d,1);
   for(let k=-1;k<=1;k++){g.lineBetween(x+k*7*s,y+4*s,x+(k*9+3)*s,y-(13+Math.abs(k)*4)*s);}
   g.lineStyle(2*s,0x7cbd45,1).lineBetween(x,y+3*s,x+3*s,y-15*s);
  }else if(variant===1){ // stokrotki
   g.fillStyle(0x38672b,.18).fillEllipse(x,y+5*s,31*s,8*s);
   for(const [dx,dy] of [[-9,1],[8,-5],[14,6]]){
    const fx=x+dx*s,fy=y+dy*s;
    g.lineStyle(2*s,0x3c873b).lineBetween(fx,fy+8*s,fx,fy);
    for(let p=0;p<5;p++){const a=p*Math.PI*2/5;g.fillStyle(0xfff8e5).fillCircle(fx+Math.cos(a)*4*s,fy+Math.sin(a)*4*s,3*s);}
    g.fillStyle(0xf5bf3b).fillCircle(fx,fy,3.2*s);
   }
  }else if(variant===2){ // zaokrąglony kamień
   g.fillStyle(0x254b29,.25).fillEllipse(x+4*s,y+10*s,43*s,13*s);
   g.fillStyle(0x53634e).fillEllipse(x,y+2*s,39*s,26*s);
   g.fillStyle(0x8c9b82).fillEllipse(x-3*s,y-3*s,33*s,23*s);
   g.fillStyle(0xb6c1a4,.7).fillEllipse(x-9*s,y-8*s,13*s,5*s);
  }else{ // niski krzew, dekoracyjny (nie blokuje ruchu)
   g.fillStyle(0x244b2a,.2).fillEllipse(x,y+9*s,45*s,14*s);
   g.fillStyle(0x2a5930).fillEllipse(x,y+3*s,39*s,24*s);
   for(const [dx,dy,r] of [[-12,0,12],[0,-8,15],[12,1,11]]){
    g.fillStyle(0x244c2a).fillCircle(x+dx*s,y+dy*s,(r+2)*s);
    g.fillStyle(0x65aa3c).fillCircle(x+(dx-2)*s,y+(dy-3)*s,r*s);
   }
   g.fillStyle(0x9bd15c,.75).fillCircle(x-9*s,y-11*s,4*s);
  }
 }
 buildChunk(cx,cy,key){
  const g=this.make.graphics({x:0,y:0},false);
  const ox=cx*CHUNK,oy=cy*CHUNK;
  // Generujemy jedną teksturę na chunk zamiast odtwarzać tysiące kół co klatkę.
  // Przesunięcie poleceń rysowania z globalnych współrzędnych do lokalnych.
  g.translateCanvas(-ox,-oy);
  // Małe pola o zmiennym nasyceniu tworzą łagodne, nieregularne przejście.
  for(let iy=0;iy<40;iy++)for(let ix=0;ix<40;ix++){
   const x=ox+ix*16,y=oy+iy*16;
   // Drobną mozaikę kolorów zapisujemy tylko raz do tekstury terenu.
   const noise=(hash(Math.floor(x/32),Math.floor(y/32),2)-.5)*.10;
   const b=biomeWeights(x+8,y+8);
   const rgb={r:Math.round(130*b.meadow+94*b.swamp+82*b.thicket+48*b.forest+168*b.plains+147*b.badlands+111*b.castle+55*b.dungeon),g:Math.round(189*b.meadow+111*b.swamp+141*b.thicket+99*b.forest+125*b.plains+69*b.badlands+113*b.castle+56*b.dungeon),b:Math.round(71*b.meadow+65*b.swamp+66*b.thicket+55*b.forest+82*b.plains+59*b.badlands+119*b.castle+69*b.dungeon)};
   const n=noise*26;rgb.r=clamp(rgb.r+n,0,255);rgb.g=clamp(rgb.g+n,0,255);rgb.b=clamp(rgb.b+n,0,255);
   const color=Phaser.Display.Color.GetColor(rgb.r,rgb.g,rgb.b);
   g.fillStyle(color,1).fillRect(x,y,16.5,16.5);
  }
  // Ciemna opaska wokół lochów maskuje sąsiednią zieloną krainę.
  // To wyłącznie grafika: nie modyfikujemy żadnych przejść ani kolizji.
  const fringe=170;
  const bx1=Math.max(ox,DUNGEON.left-fringe),by1=Math.max(oy,DUNGEON.top-fringe);
  const bx2=Math.min(ox+CHUNK,DUNGEON.right+fringe),by2=Math.min(oy+CHUNK,DUNGEON.bottom+fringe);
  if(bx2>bx1&&by2>by1){
   g.fillStyle(0x24252c,.95).fillRect(bx1,by1,bx2-bx1,by2-by1);
   for(let yy=Math.floor(by1/48)*48;yy<by2;yy+=48)
    for(let xx=Math.floor(bx1/48)*48;xx<bx2;xx+=48){
     if(xx>=DUNGEON.left&&xx<DUNGEON.right&&yy>=DUNGEON.top&&yy<DUNGEON.bottom)continue;
     const x=Math.max(xx,bx1),y=Math.max(yy,by1),w=Math.min(xx+48,bx2)-x,h=Math.min(yy+48,by2)-y;
     if(w>0&&h>0){g.fillStyle(0x393943,.75).fillRect(x,y,w,h);g.lineStyle(1,0x15151b,.4).strokeRect(x,y,w,h);}
    }
  }
  // Oddzielne podłoże zamku i lochów — żadnej zieleni pod posadzką.
  // Dokładne prostokąty świata pozostają zgodne z dotychczasowymi kolizjami.
  for(const [bounds,base,edge,grid] of [[CASTLE,0x77787b,0x9b9a96,80],[DUNGEON,0x25252f,0x373744,64]]){
   const x1=Math.max(ox,bounds.left),y1=Math.max(oy,bounds.top);
   const x2=Math.min(ox+CHUNK,bounds.right),y2=Math.min(oy+CHUNK,bounds.bottom);
   if(x2<=x1||y2<=y1)continue;
   g.fillStyle(base,1).fillRect(x1,y1,x2-x1,y2-y1);
   for(let yy=Math.floor(y1/grid)*grid;yy<y2;yy+=grid)
    for(let xx=Math.floor(x1/grid)*grid;xx<x2;xx+=grid){
     const tx=Math.max(xx,x1),ty=Math.max(yy,y1),tw=Math.min(xx+grid,x2)-tx,th=Math.min(yy+grid,y2)-ty;
     if(tw<=0||th<=0)continue;
     const n=hash(Math.floor(xx/grid),Math.floor(yy/grid),7800);
     g.fillStyle(edge,n*.16).fillRect(tx,ty,tw,th);
     g.lineStyle(1,0x12131b,.22).strokeRect(tx,ty,tw,th);
     if(n>.83){g.lineStyle(1,0x1b1b24,.4).lineBetween(tx+tw*.3,ty+th*.4,tx+tw*.6,ty+th*.57);}
    }
  }
  for(let i=0;i<65;i++){
   const x=ox+hash(cx,cy,i*3+1)*CHUNK;
   const y=oy+hash(cx,cy,i*3+2)*CHUNK;
   if(['castle','dungeon'].includes(this.biomeAt(x,y))||roadNearest(x,y).distance<90)continue;
   const wet=swampBlend(x,y)+(hash(cx,cy,i*3+3)-.5)*.32;
   const kind=hash(cx,cy,i*3+4);
   if(wet>.42&&kind<wet*.48){
    g.fillStyle(0x466f78,.62).fillEllipse(x,y,24+hash(cx,cy,i+61)*66,11+hash(cx,cy,i+81)*27);
    g.lineStyle(1,0x90b4a5,.35).strokeEllipse(x,y,19,8);
   }else if(wet>.25&&kind<.7){
    g.lineStyle(2,0x657e43,.9);
    for(let j=0;j<4;j++)g.lineBetween(x+j*4-7,y+8,x+j*5-9,y-9-hash(cx,i,j)*13);
   }else{
    g.fillStyle(kind<.25?0x9acb6c:0x5b994e,.62).fillEllipse(x,y,7+kind*18,3+kind*6);
   }
  }
  // Nowa oprawa biomu 1: dekoracje tylko na łące, poza drogą i barierami.
  // Stałe ziarno zapewnia ten sam układ po teleportacji i bez kosztu animowania.
  for(let i=0;i<24;i++){
   const x=ox+28+hash(cx,cy,1100+i*5)*(CHUNK-56);
   const y=oy+28+hash(cx,cy,1101+i*5)*(CHUNK-56);
   if(regionAt(x,y).id!==1||biomeWeights(x,y).meadow<.82)continue;
   if(roadNearest(x,y).distance<115||this.barrierAt(x,y,50)||this.regionBoundaryAt(x,y,35))continue;
   const variant=Math.floor(hash(cx,cy,1102+i*5)*4);
   const scale=.7+hash(cx,cy,1103+i*5)*.55;
   this.drawMeadowDecoration(g,x,y,variant,scale);
  }
  // Rysunkowe runo w biomach 3 i 4; bez nowych kolizji i obiektów sceny.
  for(let i=0;i<30;i++){
   const x=ox+20+hash(cx,cy,4100+i*4)*(CHUNK-40);
   const y=oy+20+hash(cx,cy,4101+i*4)*(CHUNK-40);
   const kind=this.biomeAt(x,y);
   if(kind!=='thicket'&&kind!=='forest')continue;
   if(biomeWeights(x,y)[kind]<.77||roadNearest(x,y).distance<100||this.barrierAt(x,y,32)||this.regionBoundaryAt(x,y,25))continue;
   const variant=Math.floor(hash(cx,cy,4102+i*4)*3);
   const scale=.7+hash(cx,cy,4103+i*4)*.65;
   this.drawWildGround(g,x,y,kind,variant,scale);
  }
  // Drobne elementy biomów 5 i 6: generowane raz na fragment terenu.
  for(let i=0;i<25;i++){
   const x=ox+24+hash(cx,cy,5100+i*4)*(CHUNK-48);
   const y=oy+24+hash(cx,cy,5101+i*4)*(CHUNK-48);
   const kind=this.biomeAt(x,y);
   if(kind!=='plains'&&kind!=='badlands')continue;
   if(biomeWeights(x,y)[kind]<.8||roadNearest(x,y).distance<105||this.regionBoundaryAt(x,y,28)||this.barrierAt(x,y,28))continue;
   const v=Math.floor(hash(cx,cy,5102+i*4)*3);
   const scale=.75+hash(cx,cy,5103+i*4)*.65;
   this.drawDryGround(g,x,y,kind,v,scale);
  }
  // Ciągłe bariery: rzeka z przejściem na północy oraz gęsty las z obejściem na południu.
  // Rzeka z ciągłych czworokątów: bez wielkich nakładających się kół.
  // Wspólne krawędzie segmentów eliminują schodki i półokrągłe artefakty.
  const riverStart=Math.max(8100,oy-20),riverEnd=Math.min(11700,oy+CHUNK+20);
  if(riverEnd>riverStart){
   const riverBand=(y1,y2,half,color)=>{
    const bend=y=>this.riverX(y)+5*Math.sin(y/91)+3*Math.sin(y/37);
    const x1=bend(y1),x2=bend(y2);
    if(Math.min(x1,x2)-half>ox+CHUNK||Math.max(x1,x2)+half<ox)return;
    g.fillStyle(color,1).fillPoints([
     {x:x1-half,y:y1},{x:x1+half,y:y1},
     {x:x2+half,y:y2},{x:x2-half,y:y2}
    ],true);
   };
   for(let yy=Math.floor(riverStart/8)*8;yy<riverEnd;yy+=8){
    const y1=Math.max(8100,yy),y2=Math.min(11700,yy+8);
    if(y2<=y1)continue;
    riverBand(y1,y2,159,0x394f3b);
    riverBand(y1,y2,152,0x69866b);
    riverBand(y1,y2,144,0x3d8292);
   }
   // Naturalne zaokrąglenie końca rzeki; warstwy wypełniane od brzegu do środka.
   // Końcowy łuk jest rysowany raz, a nie na każdym odcinku.
   for(const endY of [8100,11700]){
    const rx=this.riverX(endY)+5*Math.sin(endY/91)+3*Math.sin(endY/37);
    if(rx+160<ox||rx-160>ox+CHUNK||endY+165<oy||endY-165>oy+CHUNK)continue;
    for(const [radius,color] of [[159,0x394f3b],[152,0x69866b],[144,0x3d8292]]){
     g.fillStyle(color,1).fillCircle(rx,endY,radius);
    }
   }
   for(let i=0;i<12;i++){
    const y=oy+hash(cx,cy,3800+i*2)*CHUNK;
    const x=this.riverX(y)+(hash(cx,cy,3801+i*2)-.5)*190;
    if(y<8100||y>11700||x<ox||x>ox+CHUNK)continue;
    g.lineStyle(1.6,0x9ac1b8,.3).lineBetween(x-13,y,x+11,y);
   }
  }
  for(let xx=ox;xx<ox+CHUNK;xx+=32){
   const fy=7400+Math.sin(xx/650+REGION_SEED)*115;
   if(xx>4200&&xx<7900&&fy+165>=oy&&fy-165<=oy+CHUNK){
    g.fillStyle(0x1e4628).fillRect(xx,fy-165,33,330);
    for(let j=0;j<5;j++)g.fillStyle(j%2?0x275a30:0x356e35).fillCircle(xx+16,fy-145+j*70,29);
   }
  }
  // Mur lasu oddziela północną część świata od pozostałych regionów.
  // Ta sama funkcja wyznacza grafikę i kolizję.
  for(let xx=ox;xx<ox+CHUNK;xx+=48){
   const wallY=4070+Math.sin((xx+24)/820)*65;
   if(wallY+190<oy||wallY-190>oy+CHUNK)continue;
   for(let yy=Math.max(oy,Math.floor((wallY-190)/48)*48);yy<Math.min(oy+CHUNK,wallY+190);yy+=48){
    if(this.castleForestAt(xx+24,yy+24,24)){
     g.fillStyle(0x173d24).fillCircle(xx+24,yy+24,35);
     g.fillStyle(0x2b6835).fillCircle(xx+16,yy+16,23);
    }
   }
  }
  // Twarde granice biomów poza szerokimi bramami w pobliżu drogi.
  // Granice: zamiast szarej szachownicy — organiczne kępy i głazy.
  // Test kolizji jest niezmieniony. Próbkujemy również sąsiedni chunk,
  // by korony na jego krawędzi nie urywały się prostą linią.
  for(let yy=Math.floor((oy-48)/40)*40;yy<oy+CHUNK+48;yy+=40)
   for(let xx=Math.floor((ox-48)/40)*40;xx<ox+CHUNK+48;xx+=40){
    if(!this.regionBoundaryAt(xx+20,yy+20,25))continue;
    const kind=this.biomeAt(xx+20,yy+20);
    const seedX=Math.floor(xx/40),seedY=Math.floor(yy/40);
    const jitterX=(hash(seedX,seedY,6101)-.5)*10;
    const jitterY=(hash(seedX,seedY,6102)-.5)*10;
    const x=xx+20+jitterX,y=yy+20+jitterY;
    const size=25+hash(seedX,seedY,6103)*8;
    if(kind==='forest'||kind==='thicket'||kind==='meadow'){
     g.fillStyle(0x183f29,.95).fillEllipse(x+3,y+5,size*2.25,size*1.95);
     g.fillStyle(kind==='thicket'?0x427a39:0x2d6338).fillEllipse(x-2,y-3,size*2.1,size*1.9);
     g.fillStyle(0x639347,.7).fillEllipse(x-9,y-11,size*.8,size*.38);
    }else if(kind==='swamp'){
     g.fillStyle(0x46573c,.94).fillEllipse(x,y,size*2.3,size*1.6);
     g.fillStyle(0x738052,.85).fillEllipse(x-4,y-4,size*1.6,size*.9);
    }else{
     g.fillStyle(kind==='badlands'?0x57423a:0x655b47,.96).fillEllipse(x+3,y+5,size*2.1,size*1.65);
     g.fillStyle(kind==='badlands'?0x89614f:0x93866b).fillEllipse(x-3,y-4,size*1.7,size*1.4);
     g.fillStyle(0xb5a186,.55).fillEllipse(x-9,y-10,size*.7,size*.26);
    }
   }
  // Zaokrąglona trasa: krzywe kwadratowe łagodzą zakręty, ale zachowują
  // wszystkie punkty szlaku i jego dotychczasowe połączenia.
  const path=[];
  const push=(x,y)=>{const last=path[path.length-1];if(!last||Math.hypot(last.x-x,last.y-y)>1)path.push({x,y});};
  push(ROAD[0].x,ROAD[0].y);
  for(let i=1;i<ROAD.length-1;i++){
   const prev=ROAD[i-1],p=ROAD[i],next=ROAD[i+1];
   const d1=Math.hypot(p.x-prev.x,p.y-prev.y),d2=Math.hypot(next.x-p.x,next.y-p.y);
   const r=Math.min(125,d1*.22,d2*.22);
   const enter={x:p.x-(p.x-prev.x)*r/d1,y:p.y-(p.y-prev.y)*r/d1};
   const leave={x:p.x+(next.x-p.x)*r/d2,y:p.y+(next.y-p.y)*r/d2};
   push(enter.x,enter.y);
   for(let k=1;k<=12;k++){
    const t=k/12,u=1-t;
    push(u*u*enter.x+2*u*t*p.x+t*t*leave.x,u*u*enter.y+2*u*t*p.y+t*t*leave.y);
   }
  }
  push(ROAD[ROAD.length-1].x,ROAD[ROAD.length-1].y);
  const roadPalette=kind=>{
   switch(kind){
    case 'swamp':return [0x4d4c31,0x857b50,0xa79b69];
    case 'forest':return [0x4a3827,0x866744,0xaa875c];
    case 'thicket':return [0x55482c,0x9a8253,0xb9a06d];
    case 'plains':return [0x74523b,0xc19a6b,0xd4b282];
    case 'badlands':return [0x743f35,0xb47759,0xd09a72];
    case 'castle':return [0x42424a,0x8c8b86,0xb0ada2];
    case 'dungeon':return [0x34343c,0x6e6c72,0x929097];
    default:return [0x655039,0xb99c70,0xd7ba89];
   }
  };
  // Droga jako ciąg czworokątów bez kół. Kolory zmieniają się
  // stopniowo wzdłuż szlaku, a nie w postaci wielkich półokręgów.
  const blendRoad=(x,y,index)=>{
   const w=biomeWeights(x,y);
   let red=0,green=0,blue=0,total=0;
   for(const [kind,weight] of Object.entries(w)){
    if(weight<=0)continue;
    const color=roadPalette(kind)[index];
    red+=((color>>16)&255)*weight;green+=((color>>8)&255)*weight;blue+=(color&255)*weight;total+=weight;
   }
   return Phaser.Display.Color.GetColor(Math.round(red/total),Math.round(green/total),Math.round(blue/total));
  };
  // Zamiast wielu wąskich trapezów tworzymy jeden obrys z wierzchołkami
  // współdzielonymi przez kolejne segmenty. Eliminuje to trójkątne szwy.
  const roadOutline=half=>{
   const left=[],right=[];
   for(let i=0;i<path.length;i++){
    const p=path[i],prev=path[Math.max(0,i-1)],next=path[Math.min(path.length-1,i+1)];
    const d1=Math.hypot(p.x-prev.x,p.y-prev.y)||1,d2=Math.hypot(next.x-p.x,next.y-p.y)||1;
    const ax=-(p.y-prev.y)/d1,ay=(p.x-prev.x)/d1;
    const bx=-(next.y-p.y)/d2,by=(next.x-p.x)/d2;
    const mx=ax+bx,my=ay+by,ml=Math.hypot(mx,my)||1;
    const dot=Math.max(.65,(mx*bx+my*by)/ml);
    const length=Math.min(half*1.4,half/dot);
    left.push({x:p.x+mx/ml*length,y:p.y+my/ml*length});
    right.push({x:p.x-mx/ml*length,y:p.y-my/ml*length});
   }
   return {left,right};
  };
  for(const [width,index] of [[124,0],[108,1]]){
   const outline=roadOutline(width/2);
   for(let i=1;i<path.length;i++){
    const p=path[i-1],q=path[i];
    if(Math.max(p.x,q.x)<ox-70||Math.min(p.x,q.x)>ox+CHUNK+70||Math.max(p.y,q.y)<oy-70||Math.min(p.y,q.y)>oy+CHUNK+70)continue;
    const color=blendRoad((p.x+q.x)/2,(p.y+q.y)/2,index);
    g.fillStyle(color,1).fillPoints([outline.left[i-1],outline.left[i],outline.right[i],outline.right[i-1]],true);
   }
  }
  // Łagodne zamknięcie drogi na jej ostatnim punkcie.
  const endPoint=path[path.length-1];
  if(endPoint.x>=ox-70&&endPoint.x<=ox+CHUNK+70&&endPoint.y>=oy-70&&endPoint.y<=oy+CHUNK+70){
   g.fillStyle(blendRoad(endPoint.x,endPoint.y,0)).fillCircle(endPoint.x,endPoint.y,62);
   g.fillStyle(blendRoad(endPoint.x,endPoint.y,1)).fillCircle(endPoint.x,endPoint.y,54);
  }
  // Drobne plamki, kamyczki i ślady ziemi są wypalane w teksturze chunku.
  // Nie powstają żadne nowe obiekty ani obliczenia w każdej klatce.
  for(let i=0;i<125;i++){
   const x=ox+hash(cx,cy,2300+i*4)*CHUNK,y=oy+hash(cx,cy,2301+i*4)*CHUNK;
   let d2=Infinity;
   for(let j=1;j<path.length;j++){
    const p=path[j-1],q=path[j],vx=q.x-p.x,vy=q.y-p.y;
    if(x<Math.min(p.x,q.x)-60||x>Math.max(p.x,q.x)+60||y<Math.min(p.y,q.y)-60||y>Math.max(p.y,q.y)+60)continue;
    const t=clamp(((x-p.x)*vx+(y-p.y)*vy)/(vx*vx+vy*vy||1),0,1);
    const dx=x-p.x-t*vx,dy=y-p.y-t*vy;d2=Math.min(d2,dx*dx+dy*dy);
   }
   if(d2>48*48)continue;
   const palette=roadPalette(this.biomeAt(x,y));
   const n=hash(cx,cy,2302+i*4),size=1.5+hash(cx,cy,2303+i*4)*4;
   g.fillStyle(n<.55?palette[2]:palette[0],n<.55?.26:.13);
   g.fillEllipse(x,y,size*(n<.2?3:2),size*(n<.2?.65:1));
  }
  // Nieprzebyty pas lasu wokół zamku; jedynie zachodnia brama pozostaje otwarta.
  for(let yy=oy;yy<oy+CHUNK;yy+=40)for(let xx=ox;xx<ox+CHUNK;xx+=40){
   const x=xx+20,y=yy+20;
   const south=y>CASTLE.bottom-115&&y<CASTLE.bottom+160&&x>CASTLE.left-170&&x<CASTLE.right+150;
   const west=x>CASTLE.left-170&&x<CASTLE.left+90&&y>CASTLE.top-100&&y<CASTLE.bottom+100&&Math.abs(y-2350)>270;
   const north=y>CASTLE.top-120&&y<CASTLE.top+90&&x>CASTLE.left-170&&x<CASTLE.right+100;
   if(south||west||north){g.fillStyle(0x173c24).fillCircle(x,y,29);g.fillStyle(0x326c37).fillCircle(x-7,y-8,20);}
  }
  // Zamkowe mury i baszty — wyłącznie wizualne, bramy pozostają otwarte.
  // Nie rysujemy murów przez wejście zachodnie (y około 2350).
  for(let y=CASTLE.top+80;y<CASTLE.bottom-40;y+=82){
   if(Math.abs(y-2350)<280)continue;
   const x=CASTLE.left+26;
   if(x>=ox-50&&x<=ox+CHUNK+50&&y>=oy-50&&y<=oy+CHUNK+50){
    g.fillStyle(0x42444b).fillRoundedRect(x-26,y-34,52,67,8);
    g.fillStyle(0xa6a5a0).fillRoundedRect(x-24,y-37,48,52,7);
    g.lineStyle(2,0x5b5a5c,.8).strokeRoundedRect(x-24,y-37,48,52,7);
   }
  }
  for(const [x,y] of [[CASTLE.left+75,CASTLE.top+90],[CASTLE.left+75,CASTLE.bottom-90],[CASTLE.right-90,CASTLE.top+90],[CASTLE.right-90,CASTLE.bottom-90]]){
   if(x<ox-100||x>ox+CHUNK+100||y<oy-100||y>oy+CHUNK+100)continue;
   g.fillStyle(0x383943,.4).fillEllipse(x+13,y+19,120,48);
   g.fillStyle(0x51525a).fillCircle(x,y,52);
   g.fillStyle(0xa9a6a0).fillCircle(x-5,y-9,44);
   g.fillStyle(0x75747b).fillCircle(x-5,y-9,29);
   g.fillStyle(0x42444c).fillCircle(x-5,y-9,16);
  }
  // Pochodnie i proporce przy istniejących korytarzach lochów.
  for(const [x,y] of [[8700,1500],[10150,1500],[8700,3000],[10150,3000]]){
   if(x<ox-55||x>ox+CHUNK+55||y<oy-55||y>oy+CHUNK+55)continue;
   g.fillStyle(0x24242b,.4).fillEllipse(x+9,y+18,42,18);
   g.fillStyle(0x686873).fillRoundedRect(x-14,y-16,28,37,4);
   g.fillStyle(0x9e4c43).fillPoints([{x:x-10,y:y-11},{x:x+10,y:y-11},{x:x+10,y:y+23},{x:x,y:y+14},{x:x-10,y:y+23}],true);
   g.fillStyle(0xe8a65a).fillCircle(x,y-16,7);
  }
  // Mury i korytarze są rysowane tym samym testem, który steruje kolizją.
  for(let yy=oy;yy<oy+CHUNK;yy+=32)for(let xx=ox;xx<ox+CHUNK;xx+=32){
   const kind=this.biomeAt(xx+16,yy+16);
   if(kind!=='castle'&&kind!=='dungeon')continue;
   if(this.structureBlocked(xx+16,yy+16,4)){
    g.fillStyle(kind==='castle'?0x555761:0x272832).fillRect(xx,yy,33,33);
    g.lineStyle(1,kind==='castle'?0x81838c:0x424452,.6).strokeRect(xx,yy,32,32);
   }else if(kind==='dungeon'){
    g.lineStyle(1,0x777884,.23).strokeRect(xx,yy,32,32);
   }
  }
  // Rysunkowe szczegóły architektury — statyczne, wypalane w teksturze.
  for(let i=0;i<12;i++){
   const x=ox+hash(cx,cy,8100+i*3)*CHUNK,y=oy+hash(cx,cy,8101+i*3)*CHUNK;
   const kind=this.biomeAt(x,y);
   if(kind!=='castle'&&kind!=='dungeon'||this.structureBlocked(x,y,25))continue;
   if(kind==='castle'){
    g.fillStyle(0x34323a,.22).fillEllipse(x+5,y+9,24,10);
    g.fillStyle(0x57565b).fillPoints([{x:x-12,y:y+4},{x:x-6,y:y-9},{x:x+8,y:y-8},{x:x+13,y:y+5}],true);
    g.fillStyle(0xa6a49e,.65).fillEllipse(x-5,y-7,12,4);
   }else{
    // Pochodnia i kamienie, bez animacji i nowych kolizji.
    if(i%3===0){
     g.fillStyle(0x9a703f).fillRoundedRect(x-3,y-1,6,16,2);
     g.fillStyle(0xe77e2f,.35).fillCircle(x,y-9,23);
     g.fillStyle(0xffb54d).fillEllipse(x,y-10,10,18);
     g.fillStyle(0xffe4a0).fillEllipse(x,y-9,4,9);
    }else{
     g.fillStyle(0x464650).fillEllipse(x,y,19,9);
     g.fillStyle(0x71717b,.55).fillEllipse(x-4,y-3,10,4);
    }
   }
  }
  for(const o of this.obstaclesFor(cx,cy)){
   if(o.kind==='swamp'){
    this.drawSwampPond(g,o);
   }else if(o.kind==='thicket'){
    this.drawThicket(g,o.x,o.y,o.radius,Math.floor(o.x+o.y));
   }else if(o.kind==='forest'){
    this.drawForestTree(g,o.x,o.y,o.radius,Math.floor(o.x+o.y));
   }
  }
  // Stary Trakt: zwalony pień leży W POPRZEK poziomej drogi.
  // Korona i korzenie są odsunięte od środka trasy, by czytelnie pokazać blokadę.
  if(cx===0&&cy===Math.floor(11500/CHUNK)){
   const x=112,y=11500;
   g.fillStyle(0x254b29,.25).fillEllipse(x+8,y+10,205,155);
   g.lineStyle(48,0x543922).lineBetween(x-74,y+82,x+71,y-81);
   g.lineStyle(36,0x98653b).lineBetween(x-74,y+82,x+71,y-81);
   g.lineStyle(4,0xc28b50,.7).lineBetween(x-66,y+74,x+74,y-75);
   for(const [ax,ay,bx,by] of [[-58,62,-107,85],[-22,19,-78,-20],[40,-45,91,-110]]){
    g.lineStyle(11,0x65432a).lineBetween(x+ax,y+ay,x+bx,y+by);
    g.lineStyle(5,0x9b7044).lineBetween(x+ax,y+ay,x+bx,y+by);
   }
   for(const [dx,dy,r] of [[-84,85,27],[-107,52,24],[73,-88,30],[97,-111,24]]){
    g.fillStyle(0x1f4a2a).fillCircle(x+dx+3,y+dy+4,r+3);
    g.fillStyle(0x4f963c).fillCircle(x+dx,y+dy,r);
    g.fillStyle(0x86b850,.7).fillEllipse(x+dx-8,y+dy-8,r*.85,r*.42);
   }
   for(const [dx,dy] of [[-44,-99],[86,72],[-100,-29]]){
    g.fillStyle(0x557d3b).fillEllipse(x+dx,y+dy,25,10);
    g.fillStyle(0xfff3d7).fillCircle(x+dx+3,y+dy-4,3);
   }
  }
  const textureKey='terrain-'+key;
  g.generateTexture(textureKey,CHUNK,CHUNK);
  g.destroy();
  const image=this.add.image(ox,oy,textureKey).setOrigin(0).setDepth(-10);
  this.terrainChunks.set(key,image);
 }
 slotCount(){return 1+Number(this.level>=10)+Number(this.level>=20)+Number(this.level>=30);}
 lockLimit(){return this.slotCount()-1;}
 selectPrime(p){
  if(this.locked.includes(p)||this.active.includes(p))return;
  this.active.push(p);
  while(this.active.length>this.slotCount()){
   const index=this.active.findIndex(v=>!this.locked.includes(v));
   if(index<0)break;
   this.active.splice(index,1);
  }
 }
 togglePrimeLock(p){
  if(this.locked.includes(p))this.locked=this.locked.filter(v=>v!==p);
  else{
   if(this.locked.length>=this.lockLimit())return;
   if(!this.active.includes(p))this.selectPrime(p);
   this.locked.push(p);
  }
  this.renderLockMenu();
  this.renderStats();
 }
 drawMinimap(){
  const canvas=document.getElementById('world-minimap');if(!canvas)return;
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const cell=5;
  for(let py=0;py<h;py+=cell)for(let px=0;px<w;px+=cell){
   const x=(px+cell/2)/w*WORLD,y=(py+cell/2)/h*WORLD;
   const b=biomeWeights(x,y);
   const rgb=[0,1,2].map(i=>Math.round(REGIONS.reduce((sum,r)=>sum+r.color[i]*b[r.kind],0)+[111,113,119][i]*b.castle+[55,56,69][i]*b.dungeon));
   ctx.fillStyle='rgb('+rgb.join(',')+')';ctx.fillRect(px,py,cell,cell);
  }
  ctx.fillStyle='#327f9b';ctx.strokeStyle='#a5d6df';ctx.lineWidth=1;
  for(let y=8100;y<11700;y+=35){const x=this.riverX(y);ctx.fillRect((x-145)/WORLD*w,y/WORLD*h,290/WORLD*w,36/WORLD*h);}
  ctx.fillStyle='#173f24';for(let x=4200;x<7900;x+=35){const y=7400+Math.sin(x/650+REGION_SEED)*115;ctx.fillRect(x/WORLD*w,(y-165)/WORLD*h,36/WORLD*w,330/WORLD*h);}
  for(let x=0;x<WORLD;x+=24){const y=4070+Math.sin(x/820)*65;if(this.castleForestAt(x,y,0))ctx.fillRect(x/WORLD*w,(y-175)/WORLD*h,25/WORLD*w,350/WORLD*h);}
  ctx.fillStyle='#777983';ctx.fillRect(CASTLE.left/WORLD*w,CASTLE.top/WORLD*h,(CASTLE.right-CASTLE.left)/WORLD*w,(CASTLE.bottom-CASTLE.top)/WORLD*h);
  ctx.fillStyle='#383943';ctx.fillRect(DUNGEON.left/WORLD*w,DUNGEON.top/WORLD*h,(DUNGEON.right-DUNGEON.left)/WORLD*w,(DUNGEON.bottom-DUNGEON.top)/WORLD*h);
  ctx.strokeStyle='#c6c9d0';ctx.lineWidth=2;ctx.strokeRect(CASTLE.left/WORLD*w,CASTLE.top/WORLD*h,(CASTLE.right-CASTLE.left)/WORLD*w,(CASTLE.bottom-CASTLE.top)/WORLD*h);
  ctx.strokeStyle='#b7b9c6';for(const y of [1500,2300,3100]){ctx.beginPath();ctx.moveTo(DUNGEON.left/WORLD*w,y/WORLD*h);ctx.lineTo(DUNGEON.right/WORLD*w,y/WORLD*h);ctx.stroke();}
  for(const x of [8850,9600,10200]){ctx.beginPath();ctx.moveTo(x/WORLD*w,DUNGEON.top/WORLD*h);ctx.lineTo(x/WORLD*w,DUNGEON.bottom/WORLD*h);ctx.stroke();}
  // Na minimapie widać granice, a przerwy w nich wskazują szerokie przejścia.
  ctx.fillStyle='#182b24';
  for(let py=0;py<h;py+=2)for(let px=0;px<w;px+=2){
   const x=(px+.5)/w*WORLD,y=(py+.5)/h*WORLD;
   if(this.regionBoundaryAt(x,y,28))ctx.fillRect(px,py,2,2);
  }
  // Widoczny szlak pomaga odnaleźć kolejne regiony.
  ctx.beginPath();ctx.moveTo(ROAD[0].x/WORLD*w,ROAD[0].y/WORLD*h);
  for(let i=1;i<ROAD.length;i++)ctx.lineTo(ROAD[i].x/WORLD*w,ROAD[i].y/WORLD*h);
  ctx.strokeStyle='#302719';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#f2d89b';ctx.lineWidth=2;ctx.stroke();
  ctx.font='bold 14px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const region of [...REGIONS,{id:7,x:7300,y:2350},{id:8,x:9450,y:2350}]){const px=region.x/WORLD*w,py=region.y/WORLD*h;ctx.lineWidth=3;ctx.strokeStyle='#18251e';ctx.strokeText(String(region.id),px,py);ctx.fillStyle='#ffffff';ctx.fillText(String(region.id),px,py);}
  const px=this.player.x/WORLD*w,py=this.player.y/WORLD*h;
  ctx.beginPath();ctx.arc(px,py,7,0,Math.PI*2);ctx.fillStyle='#ffe35b';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#151515';ctx.stroke();
 }
 renderLockMenu(){
  const area=document.getElementById('lock-buttons');
  area.replaceChildren();
  document.getElementById('lock-count').textContent=this.locked.length+'/'+this.lockLimit();
  for(const p of PRIMES){
   const locked=this.locked.includes(p);
   const btn=document.createElement('button');
   btn.className='lock-button'+(locked?' is-locked':'');
   btn.textContent=(locked?'🔒 ':'')+p;
   btn.disabled=!locked&&this.locked.length>=this.lockLimit();
   btn.title=locked?'Odblokuj dzielnik':'Ustaw jako stały atak';
   btn.onclick=()=>this.togglePrimeLock(p);
   area.append(btn);
  }
 }

 // Trudność zależy od czasu, nie od położenia na mapie.
 enemyPrimePool(minute){
  const unlock=[0,1,4,7,11,15,20,25];
  return PRIMES.filter((p,i)=>minute>=unlock[i]);
 }
 enemyNumber(minute){
  const pool=this.enemyPrimePool(minute);
  const previous=pool.length>1?pool.slice(0,-1):pool;
  const latest=pool[pool.length-1];
  const unlock=[0,1,4,7,11,15,20,25][pool.length-1];
  const chance=Math.min(.55,.08+.075*Math.max(0,minute-unlock));
  const target=Math.min(8,2+Math.floor((minute+Math.random()*5)/5));
  let n=1;
  for(let i=0;i<target;i++){
   const useNew=pool.length>1&&Math.random()<chance;
   const choices=(useNew?[latest]:previous).filter(p=>n*p<=9999);
   if(!choices.length)break;
   n*=choices[Math.floor(Math.random()*choices.length)];
  }
  return n;
 }

 onGameResize(gameSize){this.layoutHUD(gameSize.width,gameSize.height);}
 layoutHUD(width,height){
  // Współrzędne świata są w pikselach gry. Skaluje się tylko HUD na wąskich ekranach.
  const s=Math.min(1,width/960);
  const left=12,top=12;
  this.timeLabel.setPosition(width-80*s,top).setScale(s);
  this.levelLabel.setPosition(247*s,44*s).setScale(s);
  this.hpBar.setPosition(20*s,19*s).setScale(s);

  this.expBar.setPosition(20*s,48*s).setScale(s);
  this.hpLabel.setPosition(25*s,18*s).setScale(s);
  // Elementy tła pasków są przechowywane osobno w wersji 0.1.2.
  this.hpBackground.setPosition(16*s,15*s).setScale(s);
  this.expBackground.setPosition(16*s,44*s).setScale(s);
  const center=width/2, y=height-49*s;
  this.bottomPanel.setPosition(center,y).setScale(s);
  this.primeButtons.forEach((b,i)=>{
   const x=center+(-326+i*72)*s;
   b.bg.setPosition(x,y).setScale(s);
   b.key.setPosition(x-24*s,y-22*s).setScale(s);
   b.label.setPosition(x,y-7*s).setScale(s);
   b.lock.setPosition(x+17*s,y-22*s).setScale(s);
  });
  const dx=center+303*s;
  this.dashBox.setPosition(dx,y).setScale(s);
  this.dashLabel.setPosition(dx,y-15*s).setScale(s);
  this.dashHint.setPosition(dx,y+8*s).setScale(s);
 }
 makeEnemy(n,x,y,options={}){
  const size=options.boss?58:19+factorTypes(n)*7;
  const swamp=this.biomeAt(x,y)==='swamp';
  const baseColor=options.boss?0xb33d53:swamp?0x547f69:0x8e6ac1;
  const body=this.add.circle(0,0,size,baseColor).setStrokeStyle(3,options.boss?0x601b2c:swamp?0x294e42:0x4a3471);
  const ears=[this.add.ellipse(-size*.6,-size*.7,12,18,0x8e6ac1),this.add.ellipse(size*.6,-size*.7,12,18,0x8e6ac1)];
  const tail=this.add.arc(size*.8,size*.6,16,285,90,false,0x76539d).setStrokeStyle(3,0x76539d);
  const label=this.add.text(0,0,String(n),{fontFamily:'Arial',fontSize:size>30?'23px':'19px',fontStyle:'bold',color:'#ffffff',stroke:'#342044',strokeThickness:4}).setOrigin(.5);
  const eyes=swamp&&!options.boss?[this.add.circle(-size*.3,-size*.12,4,0xe3dc80),this.add.circle(size*.3,-size*.12,4,0xe3dc80)]:[];
  const view=this.add.container(x,y,[tail,...ears,body,...eyes,label]).setDepth(7);
  const enemy={n,x,y,size,view,label,body,boss:!!options.boss,swarm:!!options.swarm,hitPoints:options.hitPoints||0,armor:options.boss?10:0,baseColor,bornMinute:Math.floor((this.clock-this.startTime)/60000)};
  this.enemies.push(enemy);
  return enemy;
 }
 spawnZones(){
  const view=this.cameras.main.worldView;
  const margin=165,edge=65,zones=[];
  const rand=(lo,hi)=>Phaser.Math.Between(Math.ceil(lo),Math.floor(hi));
  const xMin=Math.max(edge,view.left),xMax=Math.min(WORLD-edge,view.right);
  const yMin=Math.max(edge,view.top),yMax=Math.min(WORLD-edge,view.bottom);
  if(view.top-margin>=edge)zones.push(()=>({x:rand(xMin,xMax),y:view.top-margin}));
  if(view.bottom+margin<=WORLD-edge)zones.push(()=>({x:rand(xMin,xMax),y:view.bottom+margin}));
  if(view.left-margin>=edge)zones.push(()=>({x:view.left-margin,y:rand(yMin,yMax)}));
  if(view.right+margin<=WORLD-edge)zones.push(()=>({x:view.right+margin,y:rand(yMin,yMax)}));
  return zones;
 }
 spawnWave(count){
  const zones=this.spawnZones();
  if(!zones.length)return;
  const minute=Math.floor((this.clock-this.startTime)/60000);
  for(let i=0;i<count;i++){
   let pos;for(let tries=0;tries<15;tries++){pos=zones[Math.floor(Math.random()*zones.length)]();if(!this.blocked(pos.x,pos.y,30))break;}
   if(pos&&!this.blocked(pos.x,pos.y,30))this.makeEnemy(this.enemyNumber(minute),pos.x,pos.y);
  }
 }
 // Specjalne wydarzenia nie podlegają limitowi zwykłych wrogów.
 prepareEvent(minute){
  const swarm=minute%10===5;
  this.special={kind:swarm?'swarm':'boss',minute,total:0,remaining:0,active:false};
  this.warningUntil=this.clock+2000;
  const banner=document.getElementById('event-warning');
  banner.textContent=swarm?'⚠ NADCIĄGA RÓJ!':'⚠ POJAWI SIĘ MINIBOSS!';
  banner.hidden=false;
 }
 beginEvent(){
  const event=this.special;
  if(!event||event.active)return;
  const zones=this.spawnZones();
  if(!zones.length){this.special=null;return;}
  event.active=true;
  document.getElementById('event-warning').hidden=true;
  const stage=Math.floor(event.minute/10);
  if(event.kind==='swarm'){
   const count=event.minute===5?30:event.minute===15?40:50;
   // 5 min: wszystkie strony; 15 min: jedna; 25 min: dwie.
   const numberOfSides=event.minute===5?zones.length:event.minute===15?1:Math.min(2,zones.length);
   const chosen=Phaser.Utils.Array.Shuffle([...zones]).slice(0,numberOfSides);
   for(let i=0;i<count;i++){
    let pos;for(let tries=0;tries<20;tries++){pos=chosen[i%chosen.length]();if(!this.blocked(pos.x,pos.y,30))break;}
    if(!pos||this.blocked(pos.x,pos.y,30))continue;
    const difficulty=event.minute===5?0:event.minute===15?2:4;
    const n=this.swarmNumber(difficulty);
    this.makeEnemy(n,pos.x,pos.y,{swarm:true});
   }
   event.total=this.enemies.filter(e=>e.swarm&&e.bornMinute===event.minute).length;event.remaining=event.total;
  }else{
   let pos;for(let tries=0;tries<30;tries++){pos=zones[Math.floor(Math.random()*zones.length)]();if(!this.blocked(pos.x,pos.y,35))break;}
   if(!pos||this.blocked(pos.x,pos.y,35)){this.special=null;return;}
   const n=event.minute===10?6912:event.minute===20?8640:9600;
   const hits=this.factorCount(n)*10;
   this.makeEnemy(n,pos.x,pos.y,{boss:true,hitPoints:hits});
   event.total=hits;event.remaining=hits;
  }
  this.updateEventBar();
 }
 factorCount(n){
  let count=0;
  for(const p of PRIMES)while(n>1&&n%p===0){n/=p;count++;}
  return count;
 }
 swarmNumber(stage){
  const pool=stage===0?[2,3]:stage===2?[2,3,5,7]:[2,3,5,7,11];
  const count=stage===0?1+Math.floor(Math.random()*2):stage===2?2+Math.floor(Math.random()*2):3+Math.floor(Math.random()*2);
  let n=1;
  for(let i=0;i<count;i++){
   const possible=pool.filter(p=>n*p<=9999);
   n*=possible[Math.floor(Math.random()*possible.length)];
  }
  return n;
 }
 updateEventBar(){
  const bar=document.getElementById('event-bar');
  if(!this.special||!this.special.active){bar.hidden=true;return;}
  bar.hidden=false;
  document.getElementById('event-name').textContent=this.special.kind==='swarm'?'⚔ RÓJ PRZECIWNIKÓW':'☠ MINIBOSS';
  document.getElementById('event-value').textContent=this.special.remaining+' / '+this.special.total;
  document.getElementById('event-fill').style.width=(100*this.special.remaining/this.special.total)+'%';
  if(this.special.remaining<=0){this.special=null;bar.hidden=true;}
 }
 spawnDrop(type,x,y){
  const color=type==='potion'?0xd94d60:0x48bfe6;
  const icon=type==='potion'?'♥':'M';
  const view=this.add.container(x,y,[
   this.add.circle(0,0,15,color).setStrokeStyle(3,0xffffff),
   this.add.text(0,0,icon,{font:'bold 19px Arial',color:'#ffffff'}).setOrigin(.5)
  ]).setDepth(5);
  this.drops.push({type,x,y,view});
 }
 collectMagnet(){
  // Magnes zasysa wszystkie dotychczas leżące na mapie punkty EXP.
  for(const token of [...this.tokens]){
   token.view.destroy();
   this.tokens.splice(this.tokens.indexOf(token),1);
   this.exp++;this.total++;
   while(this.exp>=nextCost(this.level)){
    this.exp-=nextCost(this.level);this.level++;this.pendingUpgrades++;
   }
  }
 }

 shoot(target,prime,now){
  const dx=target.x-this.player.x,dy=target.y-this.player.y,dist=Math.hypot(dx,dy)||1;
  const line=this.add.line(0,0,this.player.x,this.player.y,this.player.x+dx/dist*18,this.player.y+dy/dist*18,0x4d3423).setOrigin(0).setLineWidth(2).setDepth(9);
  this.arrows.push({line,from:now,originX:this.player.x,originY:this.player.y,target,prime});
 }
 hit(enemy,prime){
  if(!this.enemies.includes(enemy)||enemy.n%prime!==0)return;
  if(enemy.boss){
   enemy.armor--;
   if(this.special?.active&&this.special.kind==='boss'){
    this.special.remaining=Math.max(0,this.special.remaining-1);this.updateEventBar();
   }
   if(enemy.armor>0){enemy.body.setFillStyle(0xf1a5b1);this.time.delayedCall(85,()=>{if(enemy.view.active)enemy.body.setFillStyle(enemy.baseColor);});return;}
   enemy.armor=10;
  }
  enemy.n/=prime;enemy.label.setText(String(enemy.n));enemy.body.setFillStyle(0xc9a5f0);
  this.time.delayedCall(85,()=>{if(enemy.view.active)enemy.body.setFillStyle(enemy.baseColor)});
  if(enemy.n===1){
   const reward=enemy.boss?(enemy.bornMinute===10?30:enemy.bornMinute===20?40:50):1;
   for(let i=0;i<reward;i++){
    const angle=i*2.39996,radius=enemy.boss?12+Math.sqrt(i)*14:0;
    const tx=clamp(enemy.x+Math.cos(angle)*radius,15,WORLD-15);
    const ty=clamp(enemy.y+Math.sin(angle)*radius,15,WORLD-15);
    const token=this.add.container(tx,ty,[this.add.circle(0,0,11,0xf6c83f).setStrokeStyle(2,0x9c7418),this.add.text(0,0,'1',{font:'bold 14px Arial',color:'#624800'}).setOrigin(.5)]).setDepth(4);
    this.tokens.push({x:tx,y:ty,view:token});
   }
   if(Math.random()<this.potionLevel*.005)this.spawnDrop('potion',enemy.x+22,enemy.y);
   if(Math.random()<.005)this.spawnDrop('magnet',enemy.x-22,enemy.y);
   if(enemy.boss){this.spawnDrop('potion',enemy.x+40,enemy.y);this.spawnDrop('magnet',enemy.x-40,enemy.y);}
   if(enemy.swarm&&this.special?.kind==='swarm'&&this.special.active){this.special.remaining--;this.updateEventBar();}
   enemy.view.destroy();this.enemies.splice(this.enemies.indexOf(enemy),1);
  }
 }
 update(frameNow,delta){
  const profiling=this.perfToggle.checked;
  const profileStart=profiling?performance.now():0;
  let terrainMs=0,enemyMs=0;
  if(this.upgradeOpen||this.manualPause)return;
  this.clock+=Math.min(delta,50);
  const now=this.clock;
  if(this.lastSpawn<0){this.spawnWave(2);this.lastSpawn=now;}
  if(this.health<=0){this.scene.pause();this.add.text(this.cameras.main.scrollX+400,this.cameras.main.scrollY+250,'KONIEC GRY',{font:'bold 52px Arial',color:'#fff'}).setOrigin(.5);return;}
  const dt=Math.min(delta,50)/1000;
  let dx=Number(this.isPressed('d','right'))-Number(this.isPressed('a','left'))+(this.controlMode==='touch'?this.touchVector.x:0);
  let dy=Number(this.isPressed('s','down'))-Number(this.isPressed('w','up'))+(this.controlMode==='touch'?this.touchVector.y:0);
  const len=Math.hypot(dx,dy);
  if(len){dx/=len;dy/=len;this.lastMove.set(dx,dy);}
  const dash=(this.isPressed('space')||this.touchDash)&&now-this.lastDash>4000;
  if(dash){this.lastDash=now;this.dashUntil=now+220;this.invulnUntil=now+220;this.dashDirection.copy(this.lastMove);}
  const dashing=now<this.dashUntil;
  const mx=dashing?this.dashDirection.x:dx,my=dashing?this.dashDirection.y:dy;
  const speed=dashing?780:220*this.moveMultiplier;
  this.moveAround(this.player,mx,my,dt,speed,16);
  const currentRegion=regionAt(this.player.x,this.player.y);
  if(currentRegion.id<=6)this.highestRegion=Math.max(this.highestRegion,currentRegion.id);
  // Zmiana chunków potrzebna tylko po przesunięciu kamery do innego obszaru.
  const camera=this.cameras.main.worldView;
  const terrainKey=[Math.floor(camera.left/CHUNK),Math.floor(camera.top/CHUNK),Math.ceil(camera.right/CHUNK),Math.ceil(camera.bottom/CHUNK)].join(',');
  if(terrainKey!==this.lastTerrainKey){const t=profiling?performance.now():0;this.lastTerrainKey=terrainKey;this.updateTerrain();if(profiling)terrainMs+=performance.now()-t;}
  const minute=Math.floor((now-this.startTime)/60000);
  if(minute>=5&&minute<=25&&minute%5===0&&this.eventIndex<minute/5){this.eventIndex=minute/5;this.prepareEvent(minute);}
  if(this.special&&!this.special.active&&now>=this.warningUntil)this.beginEvent();
  const normalCount=this.enemies.filter(e=>!e.swarm&&!e.boss).length;
  if(minute===0){if(now-this.lastSpawn>=10000&&normalCount<30){this.spawnWave(2);this.lastSpawn=now;}}
  else if(now-this.lastSpawn>2500&&normalCount<Math.min(12+minute*2,45)){this.spawnWave(2);this.lastSpawn=now;}
  const cam=this.cameras.main;const bound=cam.worldView;
  const enemyStart=profiling?performance.now():0;
  for(const enemy of [...this.enemies]){
   const distance=Math.hypot(this.player.x-enemy.x,this.player.y-enemy.y)||1;
   if(!enemy.swarm&&!enemy.boss&&enemy.bornMinute<minute&&(enemy.x<bound.left-400||enemy.x>bound.right+400||enemy.y<bound.top-300||enemy.y>bound.bottom+300)){enemy.view.destroy();this.enemies.splice(this.enemies.indexOf(enemy),1);continue;}
   // Przeciwnik ściga gracza niezależnie od odległości i rozmiaru okna.
   const enemySpeed=enemy.boss?38:55;
   this.steerEnemy(enemy,dt,enemySpeed);enemy.view.setPosition(enemy.x,enemy.y);
   if(distance<enemy.size+12&&now-this.lastDamage>850&&now>this.invulnUntil){this.health-=enemy.boss?2:1;this.lastDamage=now;}
  }
  if(profiling)enemyMs=performance.now()-enemyStart;
  for(const p of this.active){
   if(now-(this.lastAttack.get(p)||0)<650/this.attackRate)continue;
   const targets=this.enemies.filter(e=>e.n%p===0&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<this.attackRange).sort((a,b)=>Phaser.Math.Distance.Between(a.x,a.y,this.player.x,this.player.y)-Phaser.Math.Distance.Between(b.x,b.y,this.player.x,this.player.y));
   if(targets.length){for(const target of targets.slice(0,this.multishot))this.shoot(target,p,now);this.lastAttack.set(p,now);}
  }
  for(const a of [...this.arrows]){
   const age=now-a.from,progress=Math.min(age/170,1),tx=a.target.x,ty=a.target.y;
   a.line.setTo(a.originX+(tx-a.originX)*progress,a.originY+(ty-a.originY)*progress,a.originX+(tx-a.originX)*progress+8,a.originY+(ty-a.originY)*progress+3);
   if(progress===1){a.line.destroy();this.arrows.splice(this.arrows.indexOf(a),1);this.hit(a.target,a.prime);}
  }
  for(const t of [...this.tokens])if(Math.hypot(t.x-this.player.x,t.y-this.player.y)<this.pickupRadius){t.view.destroy();this.tokens.splice(this.tokens.indexOf(t),1);this.exp++;this.total++;while(this.exp>=nextCost(this.level)){this.exp-=nextCost(this.level);this.level++;this.pendingUpgrades++;}}
  for(const drop of [...this.drops]){
   if(Math.hypot(drop.x-this.player.x,drop.y-this.player.y)>this.pickupRadius)continue;
   if(drop.type==='potion'&&this.health>=this.maxHealth)continue;
   if(drop.type==='potion')this.health=this.maxHealth;
   else this.collectMagnet();
   drop.view.destroy();this.drops.splice(this.drops.indexOf(drop),1);
  }
  if(this.pendingUpgrades>0&&!this.upgradeOpen)this.showUpgrade();
  this.hpBar.width=214*clamp(this.health/this.maxHealth,0,1);
  this.hpLabel.setText('HP  '+this.health+'/'+this.maxHealth);

  this.expBar.width=214*clamp(this.exp/nextCost(this.level),0,1);
  this.levelLabel.setText('Poziom '+this.level);
  this.timeLabel.setText(Math.floor((now-this.startTime)/60000)+':'+String(Math.floor((now-this.startTime)/1000)%60).padStart(2,'0'));
  this.primeButtons.forEach((button,i)=>{
   const selected=this.active.includes(PRIMES[i]);
   button.bg.setFillStyle(selected?0x278a4a:0x515b55).setStrokeStyle(2,selected?0x8cde9b:0x7d8980);
   button.label.setColor(selected?'#ffffff':'#c0c8c1');
   button.lock.setVisible(this.controlMode!=='touch'&&this.locked.includes(PRIMES[i]));
  });
  this.touchPrimes.querySelectorAll('button').forEach((button,i)=>{
   const selected=this.active.includes(PRIMES[i]);button.classList.toggle('is-selected',selected);
   button.setAttribute('aria-pressed',String(selected));
  });
  const dashReady=now-this.lastDash>=4000;
  document.getElementById('touch-dash').classList.toggle('is-cooling',!dashReady);
  this.dashBox.setFillStyle(dashReady?0x278a4a:0x515b55).setStrokeStyle(2,dashReady?0x8cde9b:0x7d8980);
  if(profiling){
   const ms=performance.now()-profileStart,p=this.perfSamples;
   p.count++;p.total+=ms;p.terrain+=terrainMs;p.enemies+=enemyMs;p.max=Math.max(p.max,ms);
   if(frameNow-this.perfLast>=600){
    const avg=v=>(v/p.count).toFixed(1);
    this.perfPanel.textContent='FPS '+this.game.loop.actualFps.toFixed(0)+' | Logika '+avg(p.total)+' ms (max '+p.max.toFixed(0)+') | Mapa '+avg(p.terrain)+' ms | Wrogowie '+avg(p.enemies)+' ms | '+this.enemies.length+' wrogów | '+this.terrainChunks.size+' fragmentów';
    this.perfSamples={count:0,total:0,terrain:0,enemies:0,max:0};this.perfLast=frameNow;
   }
  }
 }
 upgradeLevels(){
  return [
   {id:'range',title:'Zasięg ataku',level:Math.round((this.attackRange-450)/50),max:5,effect:'+50 px'},
   {id:'attack',title:'Szybkość ataku',level:Math.round((this.attackRate-1)*10),max:10,effect:'+10%'},
   {id:'movement',title:'Szybkość ruchu',level:Math.round((this.moveMultiplier-1)*20),max:10,effect:'+5%'},
   {id:'pickup',title:'Zasięg zbierania EXP',level:Math.ceil((this.pickupRadius-37)/50),max:5,effect:'+50 px'},
   {id:'health',title:'Maksymalne HP',level:this.maxHealth-5,max:5,effect:'+1 HP (leczy)'},
   {id:'potion',title:'Mikstury zdrowia',level:this.potionLevel,max:5,effect:'+0,5% szansy na miksturę (pełne HP)'},
   {id:'multishot',title:'Wielostrzał',level:this.multishot-1,max:5,effect:'+1 strzała na dzielnik'}
  ];
 }
 statsMarkup(){
  const levels=this.upgradeLevels();
  const rank=id=>{const u=levels.find(v=>v.id===id);return u.level+'/'+u.max;};
  return [
   ['Poziom postaci',this.level],
   ['HP',this.health+' / '+this.maxHealth],
   ['Maksymalne HP '+rank('health'),this.maxHealth],
   ['Szybkość ruchu '+rank('movement'),Math.round(220*this.moveMultiplier)+' px/s'],
   ['Szybkość ataku '+rank('attack'),Math.round(this.attackRate*100)+'%'],
   ['Zasięg ataku '+rank('range'),this.attackRange+' px'],
   ['Zasięg zbierania EXP '+rank('pickup'),this.pickupRadius+' px'],
   ['Wielostrzał '+rank('multishot'),this.multishot+' strzał na dzielnik'],
   ['Mikstury zdrowia '+rank('potion'),(this.potionLevel*.5).toFixed(1).replace('.',',')+'% szansy'],
   ['Magnes EXP','0,5% szansy']
  ];
 }
 renderStats(){
  for(const id of ['character-stats','pause-stats']){
   const host=document.getElementById(id);
   host.replaceChildren();
   for(const [name,value] of this.statsMarkup()){
    const dt=document.createElement('dt');dt.textContent=name;
    const dd=document.createElement('dd');dd.textContent=String(value);
    host.append(dt,dd);
   }
  }
 }
 togglePause(){
  this.manualPause=!this.manualPause;
  this.time.paused=this.manualPause;
  const overlay=document.getElementById('pause-overlay');
  overlay.hidden=!this.manualPause;
  document.getElementById('options-panel').hidden=true;
  if(this.manualPause){this.renderStats();this.renderLockMenu();this.drawMinimap();}
 }
 availableUpgrades(){
  return Phaser.Utils.Array.Shuffle(this.upgradeLevels().filter(u=>u.level<u.max)).slice(0,3);
 }
 showUpgrade(){
  this.upgradeOpen=true;
  this.time.paused=true;
  this.offers=this.availableUpgrades();
  this.renderStats();
  const overlay=document.getElementById('upgrade-overlay');
  const cards=document.getElementById('upgrade-cards');
  document.getElementById('upgrade-level').textContent='Poziom '+this.level+' — wybierz ulepszenie';
  const notice=document.getElementById('slot-unlock');
  notice.hidden=![10,20,30].includes(this.level);
  if(!notice.hidden)notice.textContent='🔓 Nowy slot ataku! Dostępne: '+this.slotCount()+' sloty, '+this.lockLimit()+' blokady.';
  cards.replaceChildren();
  if(!this.offers.length){
   const btn=document.createElement('button');btn.className='upgrade-card';btn.textContent='Kontynuuj (wszystkie ulepszenia osiągnęły limit)';btn.onclick=()=>this.chooseUpgrade(-1);cards.append(btn);
  }else this.offers.forEach((u,i)=>{
   const btn=document.createElement('button');btn.className='upgrade-card';
   const key=document.createElement('span');key.className='upgrade-key';key.textContent=String(i+1);
   const title=document.createElement('strong');title.textContent=u.title;
   const description=document.createElement('span');description.textContent=u.effect+' · Poziom '+(u.level+1)+'/'+u.max;
   btn.append(key,title,description);btn.onclick=()=>this.chooseUpgrade(i);cards.append(btn);
  });
  overlay.hidden=false;
 }
 chooseUpgrade(index){
  if(!this.upgradeOpen)return;
  const u=this.offers[index];
  if(this.offers.length&& !u)return;
  if(u){
   switch(u.id){
    case 'range':this.attackRange=Math.min(700,this.attackRange+50);break;
    case 'attack':this.attackRate=Math.min(2,Math.round((this.attackRate+.1)*100)/100);break;
    case 'movement':this.moveMultiplier=Math.min(1.5,Math.round((this.moveMultiplier+.05)*100)/100);break;
    case 'pickup':this.pickupRadius=Math.min(250,this.pickupRadius+50);break;
    case 'health':this.maxHealth++;this.health=Math.min(this.maxHealth,this.health+1);break;
    case 'potion':this.potionLevel=Math.min(5,this.potionLevel+1);break;
    case 'multishot':this.multishot=Math.min(6,this.multishot+1);break;
   }
  }
  this.pendingUpgrades=Math.max(0,this.pendingUpgrades-1);
  document.getElementById('upgrade-overlay').hidden=true;
  this.upgradeOpen=false;this.time.paused=false;
  if(this.pendingUpgrades>0)this.showUpgrade();
 }
}

const host=document.getElementById('game');
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:host.clientWidth,height:host.clientHeight,scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.NO_CENTER},backgroundColor:'#79b65d',render:{pixelArt:true},scene:[Meadow]});
const observer=new ResizeObserver(()=>{
 const w=Math.round(host.clientWidth),h=Math.round(host.clientHeight);
 if(w>0&&h>0&&(game.scale.width!==w||game.scale.height!==h))game.scale.resize(w,h);
});
observer.observe(host);
