// Number Survivors 0.4.3 — czytelne przyciski dotykowe bez dolnego paska
const PRIMES=[2,3,5,7,11,13,17,19];
const WORLD=12800;
const CHUNK=640;
const hash=(x,y,k=0)=>{let n=Math.imul(x+1297,374761393)^Math.imul(y+7919,668265263)^Math.imul(k+31,2246822519);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const CASTLE={left:8200,right:10400,top:900,bottom:3700};
const DUNGEON={left:10400,right:12500,top:900,bottom:3700};
const REGIONS=[
 {id:6,name:'Czerwone pustkowia',x:2500,y:2250,color:[147,69,59],kind:'badlands'},
 {id:5,name:'Suche równiny',x:2300,y:5850,color:[168,125,82],kind:'plains'},
 {id:4,name:'Gęsty las',x:5800,y:5700,color:[49,99,55],kind:'forest'},
 {id:3,name:'Zarośla',x:9900,y:5150,color:[75,141,66],kind:'thicket'},
 {id:1,name:'Łąka',x:5850,y:9750,color:[130,189,71],kind:'meadow'},
 {id:2,name:'Mokradła',x:9950,y:9800,color:[76,134,140],kind:'swamp'}
];
const REGION_SEED=48371; // Stały świat — powtarzalny układ do testowania
// Kolejność punktów: łąka → mokradła → zarośla → las → równiny → pustkowia → zamek.
// Delikatne przesunięcia punktów zmieniają trasę przy każdej nowej rozgrywce.
const ROAD_ANCHORS=[[5850,9750],[7100,10100],[8550,9850],[9800,10050],[10800,8900],[10400,7200],[9900,5300],[8350,5000],[6800,5500],[5700,5700],[4100,6100],[2300,5850],[2000,4300],[2500,2250],[4300,2900],[6100,3500],[7550,2800],[8150,2350],[8550,2350]];
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
 if(x>=CASTLE.left&&x<CASTLE.right&&y>=CASTLE.top&&y<CASTLE.bottom)return {id:7,name:'Zamek',kind:'castle',color:[111,113,119]};
 if(x>=DUNGEON.left&&x<DUNGEON.right&&y>=DUNGEON.top&&y<DUNGEON.bottom)return {id:8,name:'Lochy',kind:'dungeon',color:[55,56,69]};
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
  gameHost.addEventListener('pointerdown',event=>{if(event.target.tagName==='CANVAS'&&event.target!==document.getElementById('world-minimap'))this.activateKeyboard();});
  this.updateKeyboardStatus('Dotknij Aktywuj klawiaturę');
  const minimap=document.getElementById('world-minimap');
  minimap.addEventListener('click',event=>this.teleportFromMap(event));
  this.player=this.add.container(5850,9750).setDepth(10);
  this.player.add([this.add.ellipse(0,7,29,14,0x314b2c),this.add.circle(0,-2,16,0x315a39),this.add.triangle(0,-12,-17,5,0,-24,17,5,0x467d45),this.add.circle(0,-11,7,0xf4c69c),this.add.line(0,0,12,-2,21,12,0xb77d46).setLineWidth(3)]);
  this.cameras.main.startFollow(this.player,true,0.12,0.12);this.cameras.main.setBounds(0,0,WORLD,WORLD);
  this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT');
  this.highestRegion=1;
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
 setControlMode(mode){
  this.controlMode=mode;this.touchControls.hidden=mode!=='touch';
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
  const nearRoad=roadNearest(x,y).distance<740+radius;
  if(nearRoad)return false;
  const offsets=[[radius+32,0],[-radius-32,0],[0,radius+32],[0,-radius-32]];
  return offsets.some(([dx,dy])=>{
   const other=regionAt(x+dx,y+dy);
   return other.kind!=='castle'&&other.kind!=='dungeon'&&other.id!==current.id;
  });
 }
 inRect(x,y,r){return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
 dungeonOpen(x,y){
  // Szerokie skrzyżowania i korytarze w układzie kratowym.
  const horizontal=[1500,2300,3100].some(yy=>Math.abs(y-yy)<110);
  const vertical=[10850,11600,12200].some(xx=>Math.abs(x-xx)<110);
  return horizontal||vertical;
 }
 structureBlocked(x,y,radius=0){
  const x0=x-radius,x1=x+radius,y0=y-radius,y1=y+radius;
  const castleOuter=x1>CASTLE.left&&x0<CASTLE.right&&y1>CASTLE.top&&y0<CASTLE.bottom;
  const dungeonOuter=x1>DUNGEON.left&&x0<DUNGEON.right&&y1>DUNGEON.top&&y0<DUNGEON.bottom;
  if(castleOuter){
   // Brama południowa i przejście do lochów na wschodzie.
   // Jedyna brama zewnętrzna prowadzi od pustkowi, po zachodniej stronie.
   if(x0<CASTLE.left+75&&x1>CASTLE.left&&y1>CASTLE.top&&y0<CASTLE.bottom&&Math.abs(y-2350)>210)return true;
   if(y0<CASTLE.top+75&&y1>CASTLE.top)return true;
   // Południowa ściana zamku jest w całości nieprzebyta.
   if(y1>CASTLE.bottom-75&&y0<CASTLE.bottom)return true;
   if(x1>CASTLE.right-75&&x0<CASTLE.right&&Math.abs(y-2300)>170)return true;
   // Dziedziniec, dwa skrzydła z drzwiami pośrodku.
   if(x1>8800&&x0<8900&&y1>1450&&y0<3150&&Math.abs(y-2300)>180)return true;
   if(x1>9700&&x0<9800&&y1>1450&&y0<3150&&Math.abs(y-2300)>180)return true;
   if(y1>1450&&y0<1540&&x1>8800&&x0<9800&&Math.abs(x-9300)>170)return true;
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
  if(!this.blocked(x,y,17))target={x,y};
  else for(let radius=30;radius<=600&&!target;radius+=30)for(let a=0;a<32;a++){
   const angle=a*Math.PI/16,tx=clamp(x+Math.cos(angle)*radius,30,WORLD-30),ty=clamp(y+Math.sin(angle)*radius,30,WORLD-30);
   if(!this.blocked(tx,ty,17)){target={x:tx,y:ty};break;}
  }
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
 barrierAt(x,y,radius=0){return this.riverAt(x,y,radius)||this.forestWallAt(x,y,radius);}
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
   if(Math.hypot(x-5850,y-9750)<450||roadNearest(x,y).distance<radius+100)continue;
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
 blocked(x,y,radius){
  if(x<radius||y<radius||x>WORLD-radius||y>WORLD-radius||this.barrierAt(x,y,radius)||this.structureBlocked(x,y,radius)||this.regionBoundaryAt(x,y,radius))return true;
  const targetRegion=regionAt(x,y);
  if(targetRegion.id===7&&this.highestRegion<6)return true;
  if(targetRegion.id<=6&&targetRegion.id>this.highestRegion+1)return true;
  return this.nearbyObstacles(x,y).some(o=>Math.hypot(x-o.x,y-o.y)<o.radius+radius);
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
  for(const [key,g] of this.terrainChunks)if(!visible.has(key)){g.destroy();this.terrainChunks.delete(key);}
 }
 buildChunk(cx,cy,key){
  const g=this.add.graphics().setDepth(-10);
  const ox=cx*CHUNK,oy=cy*CHUNK;
  // Małe pola o zmiennym nasyceniu tworzą łagodne, nieregularne przejście.
  for(let iy=0;iy<10;iy++)for(let ix=0;ix<10;ix++){
   const x=ox+ix*64,y=oy+iy*64;
   const noise=(hash(cx*10+ix,cy*10+iy,2)-.5)*.24;
   const b=biomeWeights(x+32,y+32);
   const rgb={r:Math.round(130*b.meadow+76*b.swamp+82*b.thicket+48*b.forest+168*b.plains+147*b.badlands+111*b.castle+55*b.dungeon),g:Math.round(189*b.meadow+134*b.swamp+141*b.thicket+99*b.forest+125*b.plains+69*b.badlands+113*b.castle+56*b.dungeon),b:Math.round(71*b.meadow+140*b.swamp+66*b.thicket+55*b.forest+82*b.plains+59*b.badlands+119*b.castle+69*b.dungeon)};
   const n=noise*26;rgb.r=clamp(rgb.r+n,0,255);rgb.g=clamp(rgb.g+n,0,255);rgb.b=clamp(rgb.b+n,0,255);
   const color=Phaser.Display.Color.GetColor(rgb.r,rgb.g,rgb.b);
   g.fillStyle(color,1).fillRect(x,y,65,65);
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
  // Ciągłe bariery: rzeka z przejściem na północy oraz gęsty las z obejściem na południu.
  for(let yy=oy;yy<oy+CHUNK;yy+=32){
   const rx=this.riverX(yy);
   if(yy>8100&&yy<11700&&rx+145>=ox&&rx-145<=ox+CHUNK){
    g.fillStyle(0x355d4b).fillRect(rx-156,yy,312,33);
    g.fillStyle(0x3d8292).fillRect(rx-145,yy,290,33);
    g.lineStyle(2,0x8db5ae,.5).lineBetween(rx-145,yy,rx-145,yy+33);
   }
  }
  for(let xx=ox;xx<ox+CHUNK;xx+=32){
   const fy=7400+Math.sin(xx/650+REGION_SEED)*115;
   if(xx>4200&&xx<7900&&fy+165>=oy&&fy-165<=oy+CHUNK){
    g.fillStyle(0x1e4628).fillRect(xx,fy-165,33,330);
    for(let j=0;j<5;j++)g.fillStyle(j%2?0x275a30:0x356e35).fillCircle(xx+16,fy-145+j*70,29);
   }
  }
  // Twarde granice biomów poza szerokimi bramami w pobliżu drogi.
  for(let yy=oy;yy<oy+CHUNK;yy+=24)for(let xx=ox;xx<ox+CHUNK;xx+=24){
   if(this.regionBoundaryAt(xx+12,yy+12,12)){
    const kind=this.biomeAt(xx+12,yy+12);
    const color=kind==='swamp'?0x315f77:kind==='forest'||kind==='thicket'?0x234b2c:0x555b4b;
    g.fillStyle(color,.95).fillRect(xx,yy,25,25);
    if(kind==='forest'||kind==='thicket')g.fillStyle(0x367342).fillCircle(xx+12,yy+12,14);
   }
  }
  // Szlak jest rysowany nad wodą i lasem: w przecięciach powstają mosty i przesmyki.
  g.lineStyle(120,0x594a36,.88);g.beginPath();
  for(let i=0;i<ROAD.length-1;i++){
   const a=ROAD[i],b=ROAD[i+1];
   if(Math.max(a.x,b.x)<ox-130||Math.min(a.x,b.x)>ox+CHUNK+130||Math.max(a.y,b.y)<oy-130||Math.min(a.y,b.y)>oy+CHUNK+130)continue;
   g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);
  }
  g.strokePath();
  g.lineStyle(104,0xb79a66,.95);g.beginPath();
  for(let i=0;i<ROAD.length-1;i++){
   const a=ROAD[i],b=ROAD[i+1];
   if(Math.max(a.x,b.x)<ox-130||Math.min(a.x,b.x)>ox+CHUNK+130||Math.max(a.y,b.y)<oy-130||Math.min(a.y,b.y)>oy+CHUNK+130)continue;
   g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);
  }
  g.strokePath();
  // Nieprzebyty pas lasu wokół zamku; jedynie zachodnia brama pozostaje otwarta.
  for(let yy=oy;yy<oy+CHUNK;yy+=40)for(let xx=ox;xx<ox+CHUNK;xx+=40){
   const x=xx+20,y=yy+20;
   const south=y>CASTLE.bottom-115&&y<CASTLE.bottom+160&&x>CASTLE.left-170&&x<CASTLE.right+150;
   const west=x>CASTLE.left-170&&x<CASTLE.left+90&&y>CASTLE.top-100&&y<CASTLE.bottom+100&&Math.abs(y-2350)>270;
   const north=y>CASTLE.top-120&&y<CASTLE.top+90&&x>CASTLE.left-170&&x<CASTLE.right+100;
   if(south||west||north){g.fillStyle(0x173c24).fillCircle(x,y,29);g.fillStyle(0x326c37).fillCircle(x-7,y-8,20);}
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
  for(const o of this.obstaclesFor(cx,cy)){
   if(o.kind==='swamp'){
    g.fillStyle(0x314f45,.8).fillEllipse(o.x+5,o.y+8,o.radius*2+20,o.radius*2+15);
    g.fillStyle(0x3c7a88,1).fillEllipse(o.x,o.y,o.radius*2,o.radius*2);
    g.lineStyle(3,0x89a899,.7).strokeEllipse(o.x,o.y,o.radius*2,o.radius*2);
    if(o.shape==='channel'){g.fillStyle(0x3c7a88).fillRoundedRect(o.x-o.radius*.6,o.y-o.radius*.75,o.radius*1.2,o.radius*1.5,20);}
   }else if(o.kind==='thicket'){
    g.fillStyle(0x294c29).fillCircle(o.x,o.y,o.radius+8);
    for(let j=0;j<6;j++)g.fillStyle(j%2?0x477d38:0x3c682d).fillCircle(o.x+Math.cos(j)*o.radius*.55,o.y+Math.sin(j)*o.radius*.55,o.radius*.58);
   }else{
    g.fillStyle(0x493728).fillRect(o.x-9,o.y-8,18,29);
    g.fillStyle(0x1e4a2a).fillCircle(o.x,o.y-12,o.radius+9);
    g.fillStyle(0x316d35).fillCircle(o.x-9,o.y-18,o.radius*.7);
   }
  }
  this.terrainChunks.set(key,g);
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
  ctx.fillStyle='#777983';ctx.fillRect(CASTLE.left/WORLD*w,CASTLE.top/WORLD*h,(CASTLE.right-CASTLE.left)/WORLD*w,(CASTLE.bottom-CASTLE.top)/WORLD*h);
  ctx.fillStyle='#383943';ctx.fillRect(DUNGEON.left/WORLD*w,DUNGEON.top/WORLD*h,(DUNGEON.right-DUNGEON.left)/WORLD*w,(DUNGEON.bottom-DUNGEON.top)/WORLD*h);
  ctx.strokeStyle='#c6c9d0';ctx.lineWidth=2;ctx.strokeRect(CASTLE.left/WORLD*w,CASTLE.top/WORLD*h,(CASTLE.right-CASTLE.left)/WORLD*w,(CASTLE.bottom-CASTLE.top)/WORLD*h);
  ctx.strokeStyle='#b7b9c6';for(const y of [1500,2300,3100]){ctx.beginPath();ctx.moveTo(DUNGEON.left/WORLD*w,y/WORLD*h);ctx.lineTo(DUNGEON.right/WORLD*w,y/WORLD*h);ctx.stroke();}
  for(const x of [10850,11600,12200]){ctx.beginPath();ctx.moveTo(x/WORLD*w,DUNGEON.top/WORLD*h);ctx.lineTo(x/WORLD*w,DUNGEON.bottom/WORLD*h);ctx.stroke();}
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
  for(const region of [...REGIONS,{id:7,x:9200,y:2350},{id:8,x:11500,y:2350}]){const px=region.x/WORLD*w,py=region.y/WORLD*h;ctx.lineWidth=3;ctx.strokeStyle='#18251e';ctx.strokeText(String(region.id),px,py);ctx.fillStyle='#ffffff';ctx.fillText(String(region.id),px,py);}
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
  this.updateTerrain();
  const minute=Math.floor((now-this.startTime)/60000);
  if(minute>=5&&minute<=25&&minute%5===0&&this.eventIndex<minute/5){this.eventIndex=minute/5;this.prepareEvent(minute);}
  if(this.special&&!this.special.active&&now>=this.warningUntil)this.beginEvent();
  const normalCount=this.enemies.filter(e=>!e.swarm&&!e.boss).length;
  if(minute===0){if(now-this.lastSpawn>=10000&&normalCount<30){this.spawnWave(2);this.lastSpawn=now;}}
  else if(now-this.lastSpawn>2500&&normalCount<Math.min(12+minute*2,45)){this.spawnWave(2);this.lastSpawn=now;}
  const cam=this.cameras.main;const bound=cam.worldView;
  for(const enemy of [...this.enemies]){
   const distance=Math.hypot(this.player.x-enemy.x,this.player.y-enemy.y)||1;
   if(!enemy.swarm&&!enemy.boss&&enemy.bornMinute<minute&&(enemy.x<bound.left-400||enemy.x>bound.right+400||enemy.y<bound.top-300||enemy.y>bound.bottom+300)){enemy.view.destroy();this.enemies.splice(this.enemies.indexOf(enemy),1);continue;}
   // Przeciwnik ściga gracza niezależnie od odległości i rozmiaru okna.
   const enemySpeed=enemy.boss?38:55;
   this.steerEnemy(enemy,dt,enemySpeed);enemy.view.setPosition(enemy.x,enemy.y);
   if(distance<enemy.size+12&&now-this.lastDamage>850&&now>this.invulnUntil){this.health-=enemy.boss?2:1;this.lastDamage=now;}
  }
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
