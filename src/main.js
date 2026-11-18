// Number Survivors 0.2.5 — pierwsza łąka, prototyp mechanik
const PRIMES=[2,3,5,7,11,13,17,19];
const WORLD=3200;
const nextCost=level=>Math.min(40,level*2);
const factorTypes=n=>PRIMES.filter(p=>{let x=n;return x%p===0}).length;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
class Meadow extends Phaser.Scene{
 constructor(){super('Meadow');}
 create(){
  this.cameras.main.setBackgroundColor('#79b65d');
  this.add.grid(WORLD/2,WORLD/2,WORLD,WORLD,80,80,0x80b861,1,0x6da351,0.24).setDepth(-10);
  this.player=this.add.container(WORLD/2,WORLD/2).setDepth(10);
  this.player.add([this.add.ellipse(0,7,29,14,0x314b2c),this.add.circle(0,-2,16,0x315a39),this.add.triangle(0,-12,-17,5,0,-24,17,5,0x467d45),this.add.circle(0,-11,7,0xf4c69c),this.add.line(0,0,12,-2,21,12,0xb77d46).setLineWidth(3)]);
  this.cameras.main.startFollow(this.player,true,0.12,0.12);this.cameras.main.setBounds(0,0,WORLD,WORLD);
  this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT');
  this.active=[2];this.locked=[];this.enemies=[];this.tokens=[];this.arrows=[];this.level=1;this.exp=0;this.total=0;this.health=5;this.startTime=0;this.clock=0;this.upgradeOpen=false;this.manualPause=false;this.pendingUpgrades=0;this.attackRange=450;this.attackRate=1;this.multishot=1;this.moveMultiplier=1;this.pickupRadius=37;this.maxHealth=5;this.regeneration=false;this.lastRegen=0;this.lastDash=-10000;this.invulnUntil=0;this.dashUntil=0;this.dashDirection=new Phaser.Math.Vector2(1,0);this.lastSpawn=-99999;this.lastAttack=new Map();this.lastDamage=0;this.lastMove=new Phaser.Math.Vector2(1,0);
  // Stałe elementy HUD: paski w lewym górnym rogu, dzielniki i unik na dole.
  const ui=(obj)=>obj.setScrollFactor(0).setDepth(100);
  const txt=(x,y,s,size=16)=>ui(this.add.text(x,y,s,{fontFamily:'Arial',fontSize:size+'px',fontStyle:'bold',color:'#ffffff',stroke:'#233c27',strokeThickness:3}));
  this.hpBackground=ui(this.add.rectangle(16,15,222,24,0x25352b,.86).setOrigin(0));
  this.hpBar=ui(this.add.rectangle(20,19,214,16,0x50c46b).setOrigin(0));
  this.hpLabel=txt(25,18,'HP',14);
  this.regenLabel=txt(244,18,'',14);
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
  this.spawnWave(2);this.lastSpawn=this.clock;
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
  this.regenLabel.setPosition(244*s,18*s).setScale(s);
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
 makeEnemy(n,x,y){
  const size=19+factorTypes(n)*7;
  const body=this.add.circle(0,0,size,0x8e6ac1).setStrokeStyle(3,0x4a3471);
  const ears=[this.add.ellipse(-size*.6,-size*.7,12,18,0x8e6ac1),this.add.ellipse(size*.6,-size*.7,12,18,0x8e6ac1)];
  const tail=this.add.arc(size*.8,size*.6,16,285,90,false,0x76539d).setStrokeStyle(3,0x76539d);
  const label=this.add.text(0,0,String(n),{fontFamily:'Arial',fontSize:size>30?'23px':'19px',fontStyle:'bold',color:'#ffffff',stroke:'#342044',strokeThickness:4}).setOrigin(.5);
  const view=this.add.container(x,y,[tail,...ears,body,label]).setDepth(7);
  this.enemies.push({n,x,y,size,view,label,body,bornMinute:Math.floor((this.clock-this.startTime)/60000)});
 }
 spawnWave(count){
  const minute=Math.floor((this.clock-this.startTime)/60000);
  const view=this.cameras.main.worldView;
  const margin=165,edge=40,zones=[];
  const rand=(lo,hi)=>Phaser.Math.Between(Math.ceil(lo),Math.floor(hi));
  const xMin=Math.max(edge,view.left),xMax=Math.min(WORLD-edge,view.right);
  const yMin=Math.max(edge,view.top),yMax=Math.min(WORLD-edge,view.bottom);
  if(view.top-margin>=edge)zones.push(()=>({x:rand(xMin,xMax),y:view.top-margin}));
  if(view.bottom+margin<=WORLD-edge)zones.push(()=>({x:rand(xMin,xMax),y:view.bottom+margin}));
  if(view.left-margin>=edge)zones.push(()=>({x:view.left-margin,y:rand(yMin,yMax)}));
  if(view.right+margin<=WORLD-edge)zones.push(()=>({x:view.right+margin,y:rand(yMin,yMax)}));
  if(!zones.length)return;
  for(let i=0;i<count;i++){
   const pos=zones[Math.floor(Math.random()*zones.length)]();
   this.makeEnemy(this.enemyNumber(minute),pos.x,pos.y);
  }
 }

 shoot(target,prime,now){
  const dx=target.x-this.player.x,dy=target.y-this.player.y,dist=Math.hypot(dx,dy)||1;
  const line=this.add.line(0,0,this.player.x,this.player.y,this.player.x+dx/dist*18,this.player.y+dy/dist*18,0x4d3423).setOrigin(0).setLineWidth(2).setDepth(9);
  this.arrows.push({line,from:now,originX:this.player.x,originY:this.player.y,target,prime});
 }
 hit(enemy,prime){
  if(!this.enemies.includes(enemy)||enemy.n%prime!==0)return;
  enemy.n/=prime;enemy.label.setText(String(enemy.n));enemy.body.setFillStyle(0xc9a5f0);
  this.time.delayedCall(85,()=>{if(enemy.view.active)enemy.body.setFillStyle(0x8e6ac1)});
  if(enemy.n===1){
   const token=this.add.container(enemy.x,enemy.y,[this.add.circle(0,0,11,0xf6c83f).setStrokeStyle(2,0x9c7418),this.add.text(0,0,'1',{font:'bold 14px Arial',color:'#624800'}).setOrigin(.5)]).setDepth(4);
   this.tokens.push({x:enemy.x,y:enemy.y,view:token});
   enemy.view.destroy();this.enemies.splice(this.enemies.indexOf(enemy),1);
  }
 }
 update(frameNow,delta){
  if(this.upgradeOpen||this.manualPause)return;
  this.clock+=Math.min(delta,50);
  const now=this.clock;
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
  const minute=Math.floor((now-this.startTime)/60000);
  if(minute===0){if(now-this.lastSpawn>=10000&&this.enemies.length<30){this.spawnWave(2);this.lastSpawn=now;}}
  else if(now-this.lastSpawn>2500&&this.enemies.length<Math.min(12+minute*2,45)){this.spawnWave(2);this.lastSpawn=now;}
  const cam=this.cameras.main;const bound=cam.worldView;
  for(const enemy of [...this.enemies]){
   const distance=Math.hypot(this.player.x-enemy.x,this.player.y-enemy.y)||1;
   if(enemy.bornMinute<minute&&(enemy.x<bound.left-400||enemy.x>bound.right+400||enemy.y<bound.top-300||enemy.y>bound.bottom+300)){enemy.view.destroy();this.enemies.splice(this.enemies.indexOf(enemy),1);continue;}
   // Przeciwnik ściga gracza niezależnie od odległości i rozmiaru okna.
   enemy.x+=(this.player.x-enemy.x)/distance*55*dt;enemy.y+=(this.player.y-enemy.y)/distance*55*dt;enemy.view.setPosition(enemy.x,enemy.y);
   if(distance<enemy.size+12&&now-this.lastDamage>850&&now>this.invulnUntil){this.health--;this.lastDamage=now;this.lastRegen=now;}
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
  if(this.regeneration&&this.health<this.maxHealth&&now-Math.max(this.lastDamage,this.lastRegen)>=5000){this.health++;this.lastRegen=now;}
  if(this.pendingUpgrades>0&&!this.upgradeOpen)this.showUpgrade();
  this.hpBar.width=214*clamp(this.health/this.maxHealth,0,1);
  this.hpLabel.setText('HP  '+this.health+'/'+this.maxHealth);
  this.regenLabel.setText(this.regeneration&&this.health<this.maxHealth?'+'+Math.max(1,Math.ceil((5000-(now-Math.max(this.lastDamage,this.lastRegen)))/1000))+' s':'');
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
   {id:'regen',title:'Regeneracja',level:Number(this.regeneration),max:1,effect:'1 HP co 5 s bez obrażeń'},
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
   ['Regeneracja '+rank('regen'),this.regeneration?'1 HP / 5 s':'Nieodblokowana']
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
    case 'regen':this.regeneration=true;this.lastRegen=this.clock;break;
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
