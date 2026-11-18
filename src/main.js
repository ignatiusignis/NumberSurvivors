// Number Survivors 0.1.1 — pierwsza łąka, prototyp mechanik
const PRIMES=[2,3,5,7,11,13,17,19];
const WORLD=3200;
const COSTS=[2,4,6,10,20,30,40,50,60,70,80,90];
const nextCost=level=>COSTS[level-1]??100;
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
  this.active=[2];this.enemies=[];this.tokens=[];this.arrows=[];this.level=1;this.exp=0;this.total=0;this.health=5;this.startTime=this.time.now;this.lastDash=-10000;this.invulnUntil=0;this.dashUntil=0;this.dashDirection=new Phaser.Math.Vector2(1,0);this.lastSpawn=-99999;this.lastAttack=new Map();this.lastDamage=0;this.lastMove=new Phaser.Math.Vector2(1,0);
  // Stałe elementy HUD: paski w lewym górnym rogu, dzielniki i unik na dole.
  const ui=(obj)=>obj.setScrollFactor(0).setDepth(100);
  const txt=(x,y,s,size=16)=>ui(this.add.text(x,y,s,{fontFamily:'Arial',fontSize:size+'px',fontStyle:'bold',color:'#ffffff',stroke:'#233c27',strokeThickness:3}));
  ui(this.add.rectangle(16,15,222,24,0x25352b,.86).setOrigin(0));
  this.hpBar=ui(this.add.rectangle(20,19,214,16,0x50c46b).setOrigin(0));
  this.hpLabel=txt(25,18,'HP',14);
  ui(this.add.rectangle(16,44,222,19,0x25352b,.86).setOrigin(0));
  this.expBar=ui(this.add.rectangle(20,48,214,11,0xe2b84e).setOrigin(0));
  this.levelLabel=txt(247,44,'Poziom 1',15);
  this.timeLabel=txt(848,15,'0:00',19);
  ui(this.add.rectangle(480,551,726,78,0x182b20,.86).setStrokeStyle(2,0x63825a));
  this.primeButtons=PRIMES.map((p,i)=>{
   const x=154+i*72;
   const bg=ui(this.add.rectangle(x,550,62,56,0x59615b).setStrokeStyle(2,0x89938a));
   const key=txt(x-24,528,String(i+1),12);
   const label=txt(x,543,String(p),23).setOrigin(.5,0);
   return {bg,key,label};
  });
  this.dashBox=ui(this.add.rectangle(783,550,100,56,0x339b54).setStrokeStyle(2,0x91d6a3));
  this.dashLabel=txt(783,535,'SPACJA',16).setOrigin(.5,0);
  this.dashHint=txt(783,558,'UNIK',12).setOrigin(.5,0);
  this.input.keyboard.on('keydown',e=>{const i=Number(e.key)-1;if(i>=0&&i<8){const p=PRIMES[i];if(!this.active.includes(p)){this.active.push(p);const slots=this.level>=40?3:this.level>=20?2:1;while(this.active.length>slots)this.active.shift();}}});
  this.events.on('shutdown',()=>this.input.keyboard.removeAllListeners('keydown'));
  this.spawnWave(2);this.lastSpawn=this.time.now;
 }
 makeEnemy(n,x,y){
  const size=19+factorTypes(n)*7;
  const body=this.add.circle(0,0,size,0x8e6ac1).setStrokeStyle(3,0x4a3471);
  const ears=[this.add.ellipse(-size*.6,-size*.7,12,18,0x8e6ac1),this.add.ellipse(size*.6,-size*.7,12,18,0x8e6ac1)];
  const tail=this.add.arc(size*.8,size*.6,16,285,90,false,0x76539d).setStrokeStyle(3,0x76539d);
  const label=this.add.text(0,0,String(n),{fontFamily:'Arial',fontSize:size>30?'23px':'19px',fontStyle:'bold',color:'#ffffff',stroke:'#342044',strokeThickness:4}).setOrigin(.5);
  const view=this.add.container(x,y,[tail,...ears,body,label]).setDepth(7);
  this.enemies.push({n,x,y,size,view,label,body,bornMinute:Math.floor((this.time.now-this.startTime)/60000)});
 }
 spawnWave(count){
  const minute=Math.floor((this.time.now-this.startTime)/60000);
  const pool=minute===0?[8]:minute===1?[8,12]:[12,16,24];
  for(let i=0;i<count;i++){
   const angle=Math.random()*Math.PI*2,dist=580;
   const x=clamp(this.player.x+Math.cos(angle)*dist,40,WORLD-40),y=clamp(this.player.y+Math.sin(angle)*dist,40,WORLD-40);
   this.makeEnemy(pool[Math.floor(Math.random()*pool.length)],x,y);
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
 update(now,delta){
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
  const speed=dashing?780:220;
  this.player.x=clamp(this.player.x+mx*speed*dt,30,WORLD-30);this.player.y=clamp(this.player.y+my*speed*dt,30,WORLD-30);
  const minute=Math.floor((now-this.startTime)/60000);
  if(minute===0){if(now-this.lastSpawn>=10000&&this.enemies.length<30){this.spawnWave(2);this.lastSpawn=now;}}
  else if(now-this.lastSpawn>2500&&this.enemies.length<Math.min(12+minute*2,45)){this.spawnWave(2);this.lastSpawn=now;}
  const cam=this.cameras.main;const bound=cam.worldView;
  for(const enemy of [...this.enemies]){
   const distance=Math.hypot(this.player.x-enemy.x,this.player.y-enemy.y)||1;
   if(enemy.bornMinute<minute&&(enemy.x<bound.left-400||enemy.x>bound.right+400||enemy.y<bound.top-300||enemy.y>bound.bottom+300)){enemy.view.destroy();this.enemies.splice(this.enemies.indexOf(enemy),1);continue;}
   if(distance<750){enemy.x+=(this.player.x-enemy.x)/distance*55*dt;enemy.y+=(this.player.y-enemy.y)/distance*55*dt;enemy.view.setPosition(enemy.x,enemy.y);}
   if(distance<enemy.size+12&&now-this.lastDamage>850&&now>this.invulnUntil){this.health--;this.lastDamage=now;}
  }
  for(const p of this.active){
   if(now-(this.lastAttack.get(p)||0)<650)continue;
   const targets=this.enemies.filter(e=>e.n%p===0&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<450).sort((a,b)=>Phaser.Math.Distance.Between(a.x,a.y,this.player.x,this.player.y)-Phaser.Math.Distance.Between(b.x,b.y,this.player.x,this.player.y));
   if(targets.length){this.shoot(targets[0],p,now);this.lastAttack.set(p,now);}
  }
  for(const a of [...this.arrows]){
   const age=now-a.from,progress=Math.min(age/170,1),tx=a.target.x,ty=a.target.y;
   a.line.setTo(a.originX+(tx-a.originX)*progress,a.originY+(ty-a.originY)*progress,a.originX+(tx-a.originX)*progress+8,a.originY+(ty-a.originY)*progress+3);
   if(progress===1){a.line.destroy();this.arrows.splice(this.arrows.indexOf(a),1);this.hit(a.target,a.prime);}
  }
  for(const t of [...this.tokens])if(Math.hypot(t.x-this.player.x,t.y-this.player.y)<37){t.view.destroy();this.tokens.splice(this.tokens.indexOf(t),1);this.exp++;this.total++;if(this.exp>=nextCost(this.level)){this.exp-=nextCost(this.level);this.level++;}}
  this.hpBar.width=214*clamp(this.health/5,0,1);
  this.hpLabel.setText('HP  '+this.health+'/5');
  this.expBar.width=214*clamp(this.exp/nextCost(this.level),0,1);
  this.levelLabel.setText('Poziom '+this.level);
  this.timeLabel.setText(Math.floor((now-this.startTime)/60000)+':'+String(Math.floor((now-this.startTime)/1000)%60).padStart(2,'0'));
  this.primeButtons.forEach((button,i)=>{
   const selected=this.active.includes(PRIMES[i]);
   button.bg.setFillStyle(selected?0x278a4a:0x515b55).setStrokeStyle(2,selected?0x8cde9b:0x7d8980);
   button.label.setColor(selected?'#ffffff':'#c0c8c1');
  });
  const dashReady=now-this.lastDash>=4000;
  this.dashBox.setFillStyle(dashReady?0x278a4a:0x515b55).setStrokeStyle(2,dashReady?0x8cde9b:0x7d8980);
 }
}
new Phaser.Game({type:Phaser.AUTO,parent:'game',width:960,height:600,backgroundColor:'#79b65d',render:{pixelArt:true},scene:[Meadow]});
