// Number Survivors 0.3.0 — rozległa polana i mokradła
const PRIMES=[2,3,5,7,11,13,17,19];
const WORLD=6400;
const CHUNK=640;
const hash=(x,y,k=0)=>{let n=Math.imul(x+1297,374761393)^Math.imul(y+7919,668265263)^Math.imul(k+31,2246822519);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const swampBlend=x=>clamp((x-3450)/1450,0,1);
const nextCost=level=>Math.min(40,level*2);
const factorTypes=n=>PRIMES.filter(p=>{let x=n;return x%p===0}).length;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
class Meadow extends Phaser.Scene{
 constructor(){super('Meadow');}
 create(){
  this.cameras.main.setBackgroundColor('#79b65d');
  this.terrainChunks=new Map();
  this.player=this.add.container(1900,WORLD/2).setDepth(10);
  this.player.add([this.add.ellipse(0,7,29,14,0x314b2c),this.add.circle(0,-2,16,0x315a39),this.add.triangle(0,-12,-17,5,0,-24,17,5,0x467d45),this.add.circle(0,-11,7,0xf4c69c),this.add.line(0,0,12,-2,21,12,0xb77d46).setLineWidth(3)]);
  this.cameras.main.startFollow(this.player,true,0.12,0.12);this.cameras.main.setBounds(0,0,WORLD,WORLD);
  this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT');
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
  this.input.keyboard.on('keydown',e=>{if(e.repeat)return;if(e.key.toLowerCase()==='p'){if(!this.upgradeOpen)this.togglePause();return;}if(this.upgradeOpen){if(['1','2','3'].includes(e.key))this.chooseUpgrade(Number(e.key)-1);return;}if(this.manualPause)return;const i=Number(e.key)-1;if(i>=0&&i<8){const p=PRIMES[i];this.selectPrime(p);}});
  this.layoutHUD(this.scale.width,this.scale.height);
  this.scale.on('resize',this.onGameResize,this);
  this.events.once('shutdown',()=>{this.input.keyboard.removeAllListeners('keydown');this.scale.off('resize',this.onGameResize,this);});
  // Pierwsza fala dopiero po ustawieniu kamery w pierwszej klatce.
  this.lastSpawn=-1;
  this.updateTerrain();
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
   const blend=clamp(swampBlend(x+32)+noise,0,1);
   const rgb=this.terrainColor(blend);
   const color=Phaser.Display.Color.GetColor(rgb.r,rgb.g,rgb.b);
   g.fillStyle(color,1).fillRect(x,y,65,65);
  }
  for(let i=0;i<65;i++){
   const x=ox+hash(cx,cy,i*3+1)*CHUNK;
   const y=oy+hash(cx,cy,i*3+2)*CHUNK;
   const wet=swampBlend(x)+(hash(cx,cy,i*3+3)-.5)*.32;
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
  const swamp=swampBlend(x)>.55;
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
   const pos=zones[Math.floor(Math.random()*zones.length)]();
   this.makeEnemy(this.enemyNumber(minute),pos.x,pos.y);
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
    const pos=chosen[i%chosen.length]();
    const difficulty=event.minute===5?0:event.minute===15?2:4;
    const n=this.swarmNumber(difficulty);
    this.makeEnemy(n,pos.x,pos.y,{swarm:true});
   }
   event.total=count;event.remaining=count;
  }else{
   const pos=zones[Math.floor(Math.random()*zones.length)]();
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
  let dx=Number(this.keys.D.isDown||this.keys.RIGHT.isDown)-Number(this.keys.A.isDown||this.keys.LEFT.isDown);
  let dy=Number(this.keys.S.isDown||this.keys.DOWN.isDown)-Number(this.keys.W.isDown||this.keys.UP.isDown);
  const len=Math.hypot(dx,dy);
  if(len){dx/=len;dy/=len;this.lastMove.set(dx,dy);}
  const dash=this.keys.SPACE.isDown&&now-this.lastDash>4000;
  if(dash){this.lastDash=now;this.dashUntil=now+220;this.invulnUntil=now+220;this.dashDirection.copy(this.lastMove);}
  const dashing=now<this.dashUntil;
  const mx=dashing?this.dashDirection.x:dx,my=dashing?this.dashDirection.y:dy;
  const speed=dashing?780:220*this.moveMultiplier;
  this.player.x=clamp(this.player.x+mx*speed*dt,30,WORLD-30);this.player.y=clamp(this.player.y+my*speed*dt,30,WORLD-30);
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
   enemy.x+=(this.player.x-enemy.x)/distance*enemySpeed*dt;enemy.y+=(this.player.y-enemy.y)/distance*enemySpeed*dt;enemy.view.setPosition(enemy.x,enemy.y);
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
   button.lock.setVisible(this.locked.includes(PRIMES[i]));
  });
  const dashReady=now-this.lastDash>=4000;
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
  if(this.manualPause){this.renderStats();this.renderLockMenu();}
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
