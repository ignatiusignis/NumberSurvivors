// Number Survivors 0.9.13 — klasy, umiejętności, grafiki i menu
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
 preload(){
  const sprites=['blue_mage','warrior','mage_lightning_beam','mage_chain_lightning','mage_stun_small','mage_stun_medium','mage_stun_large','mage_static_shield','mage_shield_bubble','warrior_cone_small','warrior_cone_medium','warrior_cone_large','warrior_cone_max','warrior_charge_01','warrior_block','warrior_invulnerability','rogue_arrow','rogue_dash','rogue_dodge','rogue_hit_spark','rogue_invulnerability','rogue_multishot','rogue_stun','rogue_archer_new','blue_mage_new','warrior_new','dark_mage','skeleton','skeleton_attack','golem','golem_attack','dark_aura_small','dark_aura_medium','dark_aura_large','dark_magic_circle','dark_mage_fear','dark_mage_lifesteal','dark_mage_taunt','mage_shield_active','mage_shield_burst','warrior_sword_swing','warrior_sword_swing_2','warrior_charge','warrior_charge_fast','rogue_archer','slime_green','slime_bunny','slime_horned','slime_winged','slime_sword','slime_spear','slime_axe','slime_king'];
  for(const name of sprites)this.load.image(name,'assets/sprites/'+name+'.png?v=093');
 }
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
  this.gameEnded=false;
  this.endOverlay=document.getElementById('end-overlay');
  document.getElementById('end-menu').addEventListener('click',()=>{
   sessionStorage.removeItem('ns-start-immediately');location.reload();
  });
  this.menuOpen=true;
  this.menu=document.getElementById('main-menu');
  this.menuHelp=document.getElementById('menu-help-panel');
  this.menuOptions=document.getElementById('menu-options-panel');
  this.menuBack=document.getElementById('menu-back');
  const openMenuPanel=which=>{
   this.menuHelp.hidden=which!=='help';this.menuOptions.hidden=which!=='options';document.getElementById('menu-difficulty-panel').hidden=which!=='difficulty';
   document.querySelector('.menu-buttons').hidden=!!which;
   this.menuBack.hidden=!which;
   const optionsPanel=document.getElementById('options-panel');
   if(which==='options'){document.getElementById('menu-options-slot').append(optionsPanel);optionsPanel.hidden=false;}
   else {document.querySelector('.pause-modal').append(optionsPanel);optionsPanel.hidden=true;}
  };
  document.getElementById('menu-help').addEventListener('click',()=>openMenuPanel('help'));
  document.getElementById('menu-options').addEventListener('click',()=>openMenuPanel('options'));
  this.menuBack.addEventListener('click',()=>openMenuPanel(null));
  document.getElementById('menu-new').addEventListener('click',()=>{
   openMenuPanel('difficulty');
  });
  document.getElementById('difficulty-start').addEventListener('click',()=>{
   const choice=document.querySelector('input[name="difficulty"]:checked')?.value||'veryeasy';
   const character=document.querySelector('input[name="character-class"]:checked')?.value||'archer';
   if(this.menuNeedsRestart){sessionStorage.setItem('ns-start-immediately','1');sessionStorage.setItem('ns-difficulty',choice);sessionStorage.setItem('ns-character',character);location.reload();return;}
   this.applyDifficulty(choice);
   this.applyCharacter(character);
   openMenuPanel(null);
   this.menuOpen=false;this.menu.hidden=true;this.time.paused=false;
   this.physicalKeys.clear();
   if(this.controlMode==='keyboard')this.activateKeyboard();
  });
  document.getElementById('pause-menu').addEventListener('click',()=>{
   if(!this.manualPause)return;
   this.manualPause=false;
   document.getElementById('pause-overlay').hidden=true;
   this.menuOpen=true;this.menuNeedsRestart=true;this.menu.hidden=false;
   this.time.paused=true;this.physicalKeys.clear();
  });
  const menuControl=document.getElementById('menu-control-mode');
  menuControl.addEventListener('change',()=>{this.controlSelect.value=menuControl.value;this.setControlMode(menuControl.value);});
  const syncMenuControl=()=>{menuControl.value=this.controlSelect.value;};
  this.controlSelect.addEventListener('change',syncMenuControl);
  syncMenuControl();
  if(sessionStorage.getItem('ns-start-immediately')==='1'){
   sessionStorage.removeItem('ns-start-immediately');this.applyDifficulty(sessionStorage.getItem('ns-difficulty')||'veryeasy');sessionStorage.removeItem('ns-difficulty');this.applyCharacter(sessionStorage.getItem('ns-character')||'archer');sessionStorage.removeItem('ns-character');this.menuOpen=false;this.menu.hidden=true;
  }
  this.time.paused=this.menuOpen;

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
  // Diagnostyka granic: włączana wyłącznie na żądanie w Opcjach.
  this.collisionToggle=document.getElementById('show-collision-borders');
  this.collisionToggle.checked=false;
  this.collisionToggle.addEventListener('change',()=>{
   this.collisionDebug=this.collisionToggle.checked;
   this.collisionGraphics.setVisible(this.collisionDebug);
   this.collisionReadout.setVisible(this.collisionDebug);
   if(this.collisionDebug)this.drawCollisionDebug(true);
  });
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
   if(this.menuOpen)return;
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
  const caseTest=document.getElementById('test-briefcase');
  if(caseTest)caseTest.addEventListener('click',()=>{
   if(!this.manualPause)return;
   this.teleportTesting=true;
   const candidates=[[this.briefcaseX-140,this.briefcaseY],[this.briefcaseX-180,this.briefcaseY],[this.briefcaseX-240,this.briefcaseY]];
   const target=candidates.find(([x,y])=>!this.blocked(x,y,17));
   this.teleportTesting=false;
   if(!target){document.getElementById('teleport-status').textContent='Brak wolnego miejsca przy teczce.';return;}
   this.player.setPosition(...target);this.highestRegion=6;this.cameras.main.centerOn(...target);
   this.updateTerrain();this.drawMinimap();
   document.getElementById('teleport-status').textContent='Przeniesiono w pobliże teczki. Wznów grę i podejdź do niej.';
  });
  this.difficulty='veryeasy';this.hitsPerFactor=1;this.enemyMultiplier=1;this.characterClass='archer';
  this.player=this.add.container(420,11500).setDepth(10);
  this.collisionDebug=false;
  this.collisionGraphics=this.add.graphics().setDepth(85).setVisible(false);
  this.collisionReadout=this.add.text(16,115,'',{fontFamily:'Arial',fontSize:'15px',fontStyle:'bold',color:'#ffffff',backgroundColor:'#4b1820',padding:{x:8,y:5}}).setScrollFactor(0).setDepth(120).setVisible(false);
  this.collisionDrawTime=0;
  // Cel wyprawy: teczka z czerwonymi paskami na końcu lochów.
  this.briefcaseX=10200;this.briefcaseY=2300;
  const caseArt=this.add.graphics().setDepth(8);
  caseArt.fillStyle(0x131719,.45).fillEllipse(this.briefcaseX+3,this.briefcaseY+16,52,15);
  caseArt.fillStyle(0x20242a).fillRoundedRect(this.briefcaseX-24,this.briefcaseY-14,48,35,5);
  caseArt.lineStyle(4,0xc6a975).strokeRoundedRect(this.briefcaseX-24,this.briefcaseY-14,48,35,5);
  caseArt.lineStyle(6,0xb52e35).lineBetween(this.briefcaseX-9,this.briefcaseY-12,this.briefcaseX-9,this.briefcaseY+18);
  caseArt.lineStyle(6,0xb52e35).lineBetween(this.briefcaseX+7,this.briefcaseY-12,this.briefcaseX+7,this.briefcaseY+18);
  caseArt.lineStyle(5,0xc6a975).strokeRoundedRect(this.briefcaseX-9,this.briefcaseY-23,18,11,3);
  this.briefcaseArt=caseArt;
  caseArt.setScale(1.9);
  this.briefcaseBeacon=this.add.text(this.briefcaseX,this.briefcaseY-85,'★ TECZKA ★',{font:'bold 22px Arial',color:'#ffd86a',stroke:'#151819',strokeThickness:5}).setOrigin(.5).setDepth(12);
  // Jedna gotowa tekstura radialnego półmroku, bez przeliczania światła co klatkę.
  const fogCanvas=document.createElement('canvas');fogCanvas.width=2048;fogCanvas.height=2048;
  const fogCtx=fogCanvas.getContext('2d');
  const fogGradient=fogCtx.createRadialGradient(1024,1024,115,1024,1024,940);
  fogGradient.addColorStop(0,'rgba(9,10,18,0)');
  fogGradient.addColorStop(.20,'rgba(9,10,18,.10)');
  fogGradient.addColorStop(.46,'rgba(9,10,18,.62)');
  fogGradient.addColorStop(.78,'rgba(9,10,18,.94)');
  fogGradient.addColorStop(1,'rgba(9,10,18,.97)');
  fogCtx.fillStyle=fogGradient;fogCtx.fillRect(0,0,2048,2048);
  this.textures.addCanvas('dungeon-vision',fogCanvas);
  this.dungeonVision=this.add.image(0,0,'dungeon-vision').setOrigin(.5).setScrollFactor(0).setDepth(50).setVisible(false);

  // Łotrzyk-łucznik: prosta grafika wektorowa, bez dodatkowych tekstur i animacji GPU.
  const hero=this.add.container(0,0);
  const shadow=this.add.ellipse(0,13,35,12,0x142b1b,.4);
  const boots=[this.add.ellipse(-7,10,10,13,0x503426),this.add.ellipse(7,10,10,13,0x503426)];
  const cloak=this.add.ellipse(0,0,29,30,0x245537).setStrokeStyle(2,0x153b27);
  const torso=this.add.ellipse(0,1,21,23,0x438143);
  const belt=this.add.rectangle(0,7,23,5,0x8b5631);
  const face=this.add.ellipse(0,-12,17,15,0xf1c69b);
  const hood=this.add.triangle(0,-18,-18,6,0,-27,18,6,0x317344).setStrokeStyle(2,0x17452c);
  const quiver=this.add.rectangle(-15,-5,8,22,0x7b4b2b).setAngle(-19);
  const feathers=[this.add.line(0,0,-18,-20,-20,-30,0xf3dfaa).setLineWidth(2),this.add.line(0,0,-14,-19,-15,-30,0xe9e2ce).setLineWidth(2)];
  const bow=this.add.arc(14,-1,15,275,85,false,0xb98447).setStrokeStyle(3,0x9b6032);
  const string=this.add.line(0,0,15,-16,15,15,0xe7d6b1).setLineWidth(1);
  hero.add([shadow,...boots,quiver,...feathers,cloak,torso,belt,face,hood,bow,string]);
  this.player.add(hero);this.heroVisual=hero;this.heroBoots=boots;
  if(this.textures.exists('rogue_archer')){
   hero.setVisible(false);
   this.heroSprite=this.add.image(0,-7,'rogue_archer_new').setDisplaySize(76,76);
   this.player.add(this.heroSprite);
   this.heroSprite.setOrigin(.5,.62);
  }
  this.classVisual=this.add.container(0,0).setVisible(false);this.player.add(this.classVisual);this.classSprite=null;
  this.laserVisual=this.add.graphics().setDepth(9);this.meleeVisual=this.add.graphics().setDepth(9);this.chainVisual=this.add.graphics().setDepth(11);this.shieldVisual=this.add.graphics().setDepth(10);this.darkAuraVisual=this.add.graphics().setDepth(8);
  this.classFacing=new Phaser.Math.Vector2(1,0);
  this.cameras.main.startFollow(this.player,true,0.12,0.12);this.cameras.main.setBounds(0,0,WORLD,WORLD);
  this.keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT');
  this.highestRegion=1;this.teleportTesting=false;
  this.active=[2];this.locked=[];this.enemies=[];this.tokens=[];this.arrows=[];this.level=1;this.exp=0;this.total=0;this.health=5;this.startTime=0;this.clock=0;this.upgradeOpen=false;this.manualPause=false;this.pendingUpgrades=0;this.attackRange=450;this.attackRate=1;this.multishot=1;this.moveMultiplier=1;this.pickupRadius=37;this.maxHealth=5;this.potionLevel=0;this.dashRangeLevel=0;this.dashCooldownLevel=0;this.warriorPushRange=0;this.darkSkeletonCount=0;this.darkSkeletonRate=0;this.darkFear=0;this.darkAuraRange=0;this.darkAuraRate=0;this.darkLifesteal=0;this.darkGolemLevel=0;this.darkTauntDuration=0;this.darkTauntCooldown=0;this.darkSkeletons=[];this.darkGolem=null;this.darkAuraLast=0;this.darkTauntUntil=0;this.warriorSecondSwingAt=0;this.warriorSwingAngle=0;this.warriorConeRange=0;this.warriorConeWidth=0;this.warriorBlock=0;this.warriorDoublePotion=0;this.warriorIFrames=0;this.mageChainChance=0;this.mageChainCount=0;this.mageStunRange=0;this.mageStunDuration=0;this.mageStunCooldown=0;this.mageShieldRange=0;this.mageShieldCooldown=0;this.mageAttackRate=0;this.mageAttackRange=0;this.warriorAttackRate=0;this.specialLast=-10000;this.mageShieldLast=-10000;this.mageStunUntil=0;this.specialEffects=[];this.mageChains=new Map();this.chargeHitEnemies=new Set();this.knockbackLevel=0;this.attackDodgeLevel=0;this.rerollsLeft=3;this.drops=[];this.special=null;this.eventIndex=0;this.warningUntil=0;this.lastDash=-10000;this.invulnUntil=0;this.dashUntil=0;this.dashDirection=new Phaser.Math.Vector2(1,0);this.lastSpawn=-99999;this.lastAttack=new Map();this.lastDamage=0;this.lastMove=new Phaser.Math.Vector2(1,0);
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
  // Widoczna granica między biomami, również nad miejscem startowym.
  // Odpowiada dokładnie regionBoundaryAt: tylko tam, gdzie kolizja blokuje ruch.
  // Mała liczba elementów na fragment mapy, bez nowych obiektów Phaser.
  const borderStep=52;
  for(let yy=Math.floor(oy/borderStep)*borderStep;yy<=oy+CHUNK+borderStep;yy+=borderStep){
   for(let xx=Math.floor(ox/borderStep)*borderStep;xx<=ox+CHUNK+borderStep;xx+=borderStep){
    if(xx<ox-40||xx>ox+CHUNK+40||yy<oy-40||yy>oy+CHUNK+40)continue;
    if(!this.regionBoundaryAt(xx,yy,10)||this.barrierAt(xx,yy,25))continue;
    if(roadNearest(xx,yy).distance<760)continue;
    const gx=Math.round(xx/borderStep),gy=Math.round(yy/borderStep);
    const x=xx+(hash(gx,gy,332)-.5)*13,y=yy+(hash(gx,gy,333)-.5)*13;
    const radius=19+hash(gx,gy,334)*13;
    if(hash(gx,gy,335)>.77){
     g.fillStyle(0x3a3d31,.25).fillEllipse(x+6,y+11,radius*1.9,radius*.65);
     g.fillStyle(0x656b59).fillEllipse(x,y,radius*1.8,radius*1.05);
     g.fillStyle(0x9b9d82).fillEllipse(x-4,y-5,radius*1.5,radius*.8);
    }else{
     g.fillStyle(0x143522,.42).fillEllipse(x+7,y+13,radius*2.2,radius*.7);
     g.fillStyle(0x6a4a2f).fillRoundedRect(x-4,y-5,8,radius*.95,3);
     for(const [dx,dy,s] of [[-12,-11,.75],[9,-15,.86],[0,-25,.95]]){
      g.fillStyle(0x153c28).fillCircle(x+dx+3,y+dy+4,radius*s+3);
      g.fillStyle(hash(gx+dx,gy+dy,337)>.5?0x316c38:0x427b3d).fillCircle(x+dx,y+dy,radius*s);
     }
    }
   }
  }
  // Domknięcie zachodniego końca bariery nad startem (x=0..~310, y~10700).
  // To wyłącznie warstwa wizualna: brak zmian w kolizjach i trasach.
  if(ox<400&&ox+CHUNK>=0&&oy<10920&&oy+CHUNK>10520){
   for(let x=-12;x<=340;x+=37){
    const y=10805-x*.235+Math.sin(x/63)*9;
    if(x<ox-48||x>ox+CHUNK+48||y<oy-65||y>oy+CHUNK+65)continue;
    const seed=Math.round(x/37),r=23+hash(seed,22,901)*9;
    if(hash(seed,22,902)>.77){
     g.fillStyle(0x273d30,.3).fillEllipse(x+8,y+13,r*2,r*.65);
     g.fillStyle(0x696a57).fillEllipse(x,y,r*1.8,r*1.18);
     g.fillStyle(0xaaa68c).fillEllipse(x-5,y-6,r*1.45,r*.75);
    }else{
     g.fillStyle(0x183a27,.4).fillEllipse(x+9,y+15,r*2.5,r*.8);
     g.fillStyle(0x65462b).fillRoundedRect(x-5,y-5,10,23,3);
     for(const [dx,dy,s] of [[-13,-9,.78],[12,-12,.82],[0,-24,.96]]){
      g.fillStyle(0x163b25).fillCircle(x+dx+4,y+dy+5,r*s+3);
      g.fillStyle(hash(seed+dx,22+dy,903)>.5?0x2e6638:0x3d773e).fillCircle(x+dx,y+dy,r*s);
     }
    }
   }
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
   // Półkoliste, a nie pełne okrągłe zakończenia rzeki.
   // Łuk leży tylko POZA ostatnim przekrojem rzeki.
   for(const [endY,direction] of [[8100,-1],[11700,1]]){
    const rx=this.riverX(endY)+5*Math.sin(endY/91)+3*Math.sin(endY/37);
    if(rx+165<ox||rx-165>ox+CHUNK||endY+165<oy||endY-165>oy+CHUNK)continue;
    for(const [radius,color] of [[159,0x394f3b],[152,0x69866b],[144,0x3d8292]]){
     const points=[];
     for(let j=0;j<=24;j++){
      const theta=Math.PI*j/24;
      points.push({x:rx+Math.cos(theta)*radius,y:endY+direction*Math.sin(theta)*radius});
     }
     g.fillStyle(color,1).fillPoints(points,true);
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
  // Osobna bariera leśna pod zamkiem i lochami, aż na zachód mapy.
  // Światowa siatka z przesuniętymi rzędami zapobiega powtarzalnym kolumnom.
  // Tylko wygląd: castleForestAt nadal odpowiada za kolizje i przełęcz.
  const stepX=76,stepY=67;
  for(let row=Math.floor((oy-120)/stepY);row<=Math.ceil((oy+CHUNK+120)/stepY);row++){
   const baseY=row*stepY;
   const shift=(row&1)*stepX*.48;
   for(let col=Math.floor((ox-125-shift)/stepX);col<=Math.ceil((ox+CHUNK+125-shift)/stepX);col++){
    const baseX=col*stepX+shift;
    const jitterX=(hash(col,row,9210)-.5)*25;
    const jitterY=(hash(col,row,9211)-.5)*21;
    const x=baseX+jitterX,y=baseY+jitterY;
    if(!this.castleForestAt(x,y,0))continue;
    // Nie zasłaniamy wizualnie jedynego przejścia.
    if(x>1740&&x<2520)continue;
    const radius=34+hash(col,row,9212)*17;
    const pine=hash(col,row,9213)>.89;
    g.fillStyle(0x102d20,.5).fillEllipse(x+8,y+radius*.66,radius*2.25,radius*.85);
    g.fillStyle(0x62452b).fillRoundedRect(x-radius*.13,y-radius*.02,radius*.28,radius*1.12,5);
    g.lineStyle(3,0x3d2b20,.8).lineBetween(x,y+radius*.5,x-radius*.34,y+radius*.94);
    if(pine){
     g.fillStyle(0x173e2e).fillPoints([{x:x,y:y-radius*1.32},{x:x-radius*.85,y:y+radius*.45},{x:x+radius*.85,y:y+radius*.45}],true);
     g.fillStyle(0x376e43).fillPoints([{x:x,y:y-radius*1.13},{x:x-radius*.68,y:y+radius*.17},{x:x+radius*.68,y:y+radius*.17}],true);
    }else{
     g.fillStyle(0x143b25).fillEllipse(x+5,y+5,radius*2.5,radius*1.98);
     for(let k=0;k<5;k++){
      const angle=k*2.4+hash(col,row,9220+k)*.7;
      const px=x+Math.cos(angle)*radius*.42,py=y-7+Math.sin(angle)*radius*.34;
      g.fillStyle(k%2?0x326c3b:0x275a32).fillEllipse(px,py,radius*1.4,radius*1.1);
     }
     g.fillStyle(0x659447,.43).fillEllipse(x-radius*.32,y-radius*.53,radius*.75,radius*.29);
    }
   }
  }
  // Droga: przywrócona na całej mapie. Rysowanie odcinków i wspólnych
  // okrągłych łączeń eliminuje szczeliny na zakrętach i granicach chunków.
  // Przebieg i kolizje są oparte na niezmienionej tablicy ROAD.
  for(const [width,edge] of [[132,true],[118,false]]){
   for(let i=1;i<ROAD.length;i++){
    const p=ROAD[i-1],q=ROAD[i];
    if(Math.max(p.x,q.x)<ox-width||Math.min(p.x,q.x)>ox+CHUNK+width||Math.max(p.y,q.y)<oy-width||Math.min(p.y,q.y)>oy+CHUNK+width)continue;
    const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;
    const nx=-dy/len*width/2,ny=dx/len*width/2;
    const biome=this.biomeAt((p.x+q.x)/2,(p.y+q.y)/2);
    const palette=biome==='swamp'?[0x464a32,0x8b7953]:biome==='badlands'?[0x6a4536,0xaf795a]:biome==='forest'?[0x594b36,0x9b855f]:[0x71583a,0xb99a70];
    g.fillStyle(palette[edge?0:1],1).fillPoints([
     {x:p.x+nx,y:p.y+ny},{x:q.x+nx,y:q.y+ny},
     {x:q.x-nx,y:q.y-ny},{x:p.x-nx,y:p.y-ny}
    ],true);
   }
   // Łączniki są pełne i rysowane tylko na załamaniach trasy.
   for(let i=1;i<ROAD.length-1;i++){
    const p=ROAD[i];
    if(p.x<ox-width||p.x>ox+CHUNK+width||p.y<oy-width||p.y>oy+CHUNK+width)continue;
    const biome=this.biomeAt(p.x,p.y);
    const palette=biome==='swamp'?[0x464a32,0x8b7953]:biome==='badlands'?[0x6a4536,0xaf795a]:biome==='forest'?[0x594b36,0x9b855f]:[0x71583a,0xb99a70];
    g.fillStyle(palette[edge?0:1],1).fillCircle(p.x,p.y,width/2);
   }
  }
  // Twarde granice biomów poza szerokimi bramami w pobliżu drogi.
  // Granice: nieregularne, zachodzące na siebie krzewy, bez szeregów kół.
  // Kolizje i położenie przejść pozostają nietknięte.
  for(let yy=Math.floor((oy-60)/44)*44;yy<oy+CHUNK+60;yy+=44)
   for(let xx=Math.floor((ox-60)/44)*44;xx<ox+CHUNK+60;xx+=44){
    if(!this.regionBoundaryAt(xx+22,yy+22,24))continue;
    const kind=this.biomeAt(xx+22,yy+22);
    const sx=Math.floor(xx/44),sy=Math.floor(yy/44);
    const x=xx+22+(hash(sx,sy,6101)-.5)*18,y=yy+22+(hash(sx,sy,6102)-.5)*16;
    const size=28+hash(sx,sy,6103)*12;
    if(kind==='forest'||kind==='thicket'||kind==='meadow'){
     // Cień, pień i korzenie nadają granicy wygląd lasu zamiast szeregu kul.
     g.fillStyle(0x132d20,.42).fillEllipse(x+8,y+size*.65,size*2.1,size*.85);
     g.fillStyle(0x4b3423).fillRoundedRect(x-size*.13,y+size*.04,size*.28,size*.95,3);
     g.lineStyle(3,0x765035,.8).lineBetween(x,y+size*.25,x-size*.13,y+size*.85);
     g.fillStyle(0x163a25).fillEllipse(x+4,y+10,size*2.5,size*1.9);
     for(let j=0;j<4;j++){
      const a=j*2.4+hash(sx,sy,6200+j);
      const px=x+Math.cos(a)*size*.38,py=y+Math.sin(a)*size*.3;
      g.fillStyle(j%2?0x376f39:0x2a5d33).fillEllipse(px,py,size*1.25,size*1.08);
     }
     g.fillStyle(0x6a9c4d,.5).fillEllipse(x-size*.3,y-size*.45,size*.7,size*.25);
    }else{
     g.fillStyle(kind==='swamp'?0x3e5b3c:kind==='badlands'?0x5a443c:0x716451).fillEllipse(x+3,y+6,size*2.3,size*1.55);
     g.fillStyle(kind==='swamp'?0x63794a:kind==='badlands'?0x92725b:0xa39677).fillPoints([{x:x-size,y:y+size*.15},{x:x-size*.6,y:y-size*.58},{x:x+size*.2,y:y-size*.85},{x:x+size*.95,y:y-size*.2},{x:x+size*.8,y:y+size*.3}],true);
    }
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
  // Długie sztandary zawieszone na istniejących murach zamku.
  // Dzielimy rysunek na fragmenty mapy, aby nie ucinać dekoracji na granicach chunków.
  for(const [x,y] of [[CASTLE.left+28,1350],[CASTLE.left+28,3150],[CASTLE.right-30,1350],[CASTLE.right-30,3150]]){
   const length=360,width=32;
   if(x+width<ox||x-width>ox+CHUNK||y+length<oy||y-28>oy+CHUNK)continue;
   g.fillStyle(0x24242c,.45).fillRect(x+6,y+4,width,length);
   g.fillStyle(0x8e3736).fillPoints([{x:x-width/2,y:y},{x:x+width/2,y:y},{x:x+width/2,y:y+length},{x:x,y:y+length-27},{x:x-width/2,y:y+length}],true);
   g.lineStyle(3,0xb68a49).lineBetween(x-width/2+3,y+5,x-width/2+3,y+length-10);
   g.lineStyle(3,0xb68a49).lineBetween(x+width/2-3,y+5,x+width/2-3,y+length-10);
   g.fillStyle(0xd4a956).fillCircle(x,y+65,10);
   g.fillStyle(0x5b4b36).fillRoundedRect(x-width/2-7,y-9,width+14,9,3);
   g.fillStyle(0xc59a58).fillCircle(x-width/2-7,y-5,5);
   g.fillStyle(0xc59a58).fillCircle(x+width/2+7,y-5,5);
  }
  // Cegły na mijankę: co drugi rząd przesunięty o pół cegły.
  // Każda cegła rysowana tylko w miejscach istniejących ścian.
  for(let yy=Math.floor(oy/28)*28;yy<oy+CHUNK;yy+=28){
   const row=Math.floor(yy/28),offset=(row&1)*24;
   for(let xx=Math.floor((ox-offset)/48)*48+offset;xx<ox+CHUNK;xx+=48){
    const mx=xx+24,my=yy+14,kind=this.biomeAt(mx,my);
    if(kind!=='castle'&&kind!=='dungeon')continue;
    if(this.structureBlocked(mx,my,4)){
     const base=kind==='castle'?0x55575e:0x171821;
     const light=kind==='castle'?0x8f9296:0x4e5060;
     g.fillStyle(0x15151c,.85).fillRoundedRect(xx,yy,49,29,3);
     g.fillStyle(base).fillRoundedRect(xx+2,yy+2,45,25,3);
     g.fillStyle(light,.72).fillRect(xx+5,yy+4,38,3);
     g.fillStyle(0x11131a,.3).fillRect(xx+4,yy+23,40,3);
    }
   }
  }
  // Rysunkowe szczegóły architektury — statyczne, wypalane w teksturze.
  for(let i=0;i<12;i++){
   const x=ox+48+hash(cx,cy,8100+i*3)*(CHUNK-96),y=oy+48+hash(cx,cy,8101+i*3)*(CHUNK-96);
   const kind=this.biomeAt(x,y);
   if(kind!=='castle'&&kind!=='dungeon'||this.structureBlocked(x,y,25))continue;
   if(kind==='castle'){
    g.fillStyle(0x34323a,.22).fillEllipse(x+5,y+9,24,10);
    g.fillStyle(0x57565b).fillPoints([{x:x-12,y:y+4},{x:x-6,y:y-9},{x:x+8,y:y-8},{x:x+13,y:y+5}],true);
    g.fillStyle(0xa6a49e,.65).fillEllipse(x-5,y-7,12,4);
   }else{
    // Pochodnia i kamienie, bez animacji i nowych kolizji.
    if(i%3===0){
     // Pełna, symetryczna pochodnia — bez uciętej połowy.
     g.fillStyle(0xe77e2f,.10).fillCircle(x,y-9,20);
     g.fillStyle(0x6e513b).fillRoundedRect(x-5,y-2,10,22,3);
     g.fillStyle(0xb08a52).fillRoundedRect(x-7,y-3,14,6,2);
     g.fillStyle(0xf28b34).fillEllipse(x,y-13,16,23);
     g.fillStyle(0xffd67a).fillEllipse(x,y-13,8,14);
    }else{
     g.fillStyle(0x464650).fillEllipse(x,y,19,9);
     g.fillStyle(0x71717b,.55).fillEllipse(x-4,y-3,10,4);
    }
   }
  }
  for(const o of this.obstaclesFor(cx,cy)){
   if(o.kind==='swamp'){
    // Staw w górnym zakończeniu rzeki zasłaniał jej naturalny brzeg.
    if(Math.hypot(o.x-this.riverX(8100),o.y-8100)<410)continue;
    this.drawSwampPond(g,o);
   }else if(o.kind==='thicket'){
    this.drawThicket(g,o.x,o.y,o.radius,Math.floor(o.x+o.y));
   }else if(o.kind==='forest'){
    this.drawForestTree(g,o.x,o.y,o.radius,Math.floor(o.x+o.y));
   }
  }
  // Zwalenie drzewa przy samym wejściu: pień poziomo przecina drogę,
  // gałęzie i korzenie kończą się przy zachodniej krawędzi świata.
  if(cx===0&&cy===Math.floor(11500/CHUNK)){
   const x=84,y=11500;
   g.fillStyle(0x253b23,.22).fillEllipse(x+6,y+12,230,230);
   g.lineStyle(70,0x543923).lineBetween(x-12,y-130,x+18,y+130);
   g.lineStyle(55,0x99683e).lineBetween(x-12,y-130,x+18,y+130);
   g.lineStyle(4,0xc18a51,.6).lineBetween(x-5,y-81,x+25,y+79);
   for(const [x1,y1,x2,y2] of [[-10,-66,-56,-107],[9,29,62,12],[17,71,55,113]]){
    g.lineStyle(12,0x64432c).lineBetween(x+x1,y+y1,x+x2,y+y2);
    g.lineStyle(6,0x9a7044).lineBetween(x+x1,y+y1,x+x2,y+y2);
   }
   for(const [dx,dy,rr] of [[-24,-145,40],[-51,-133,33],[51,14,35],[49,148,39]]){
    g.fillStyle(0x21482a).fillCircle(x+dx+3,y+dy+5,rr+3);
    g.fillStyle(0x4d963f).fillCircle(x+dx,y+dy,rr);
    g.fillStyle(0x80b451,.7).fillEllipse(x+dx-8,y+dy-8,rr*.8,rr*.4);
   }
  }
  const textureKey='terrain-'+key;
  g.generateTexture(textureKey,CHUNK,CHUNK);
  g.destroy();
  const image=this.add.image(ox,oy,textureKey).setOrigin(0).setDepth(-10);
  this.terrainChunks.set(key,image);
 }
 slotCount(){return 1+Number(this.level>=10)+Number(this.level>=20)+Number(this.level>=30)+Number(this.level>=40);}
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
  // Cel wyprawy jest oznaczony także na mapie pauzy.
  const bx=this.briefcaseX/WORLD*w,by=this.briefcaseY/WORLD*h;
  ctx.fillStyle='#ffce51';ctx.strokeStyle='#6e2028';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(bx,by,7,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.font='bold 12px Arial';ctx.fillStyle='#ffe5a3';ctx.textAlign='center';ctx.fillText('TECZKA',bx,by-13);
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
  // Slime'y z deterministycznymi odmianami: uszy, rogi, skrzydła i broń.
  const variant=options.boss?'king':(['basic','rabbit','horned','winged','sword','spear','axe'][Math.abs(n+Math.floor(x/100)+Math.floor(y/100))%7]);
  const color=options.boss?0xc94e55:({basic:0x73c64d,rabbit:0x46b7d9,horned:0xd65a57,winged:0x9860c6,sword:0x7fbb53,spear:0x4cb2bf,axe:0x70a856})[variant];
  const outline=options.boss?0x78313e:0x294e46;
  const parts=[];
  const shape=(obj)=>{parts.push(obj);return obj;};
  shape(this.add.ellipse(3,size*.7,size*2.05,size*.55,0x18251f,.35));
  if(variant==='rabbit'){
   shape(this.add.ellipse(-size*.5,-size*.97,size*.48,size*1.2,0x3a93b3).setAngle(-13));
   shape(this.add.ellipse(size*.5,-size*.97,size*.48,size*1.2,0x3a93b3).setAngle(13));
   shape(this.add.ellipse(-size*.5,-size*.97,size*.21,size*.87,0xf0a9c2).setAngle(-13));
   shape(this.add.ellipse(size*.5,-size*.97,size*.21,size*.87,0xf0a9c2).setAngle(13));
  }else if(variant==='horned'||variant==='axe'){
   shape(this.add.triangle(-size*.65,-size*.7,-size*.28,0,0,-size*.8,size*.4,0,0xf2d5a4));
   shape(this.add.triangle(size*.65,-size*.7,-size*.4,0,0,-size*.8,size*.28,0,0xf2d5a4));
  }else if(variant==='winged'){
   shape(this.add.triangle(-size*.9,-size*.1,0,0,-size*.5,-size*1.4,-size*1.2,-size*.85,0x7c47a8));
   shape(this.add.triangle(size*.9,-size*.1,0,0,size*.5,-size*1.4,size*1.2,-size*.85,0x7c47a8));
  }
  const body=shape(this.add.ellipse(0,0,size*2.1,size*1.65,color).setStrokeStyle(3,outline));
  shape(this.add.ellipse(-size*.45,-size*.4,size*.5,size*.21,0xffffff,.4));
  for(const sign of [-1,1]){
   shape(this.add.ellipse(sign*size*.35,-size*.13,size*.23,size*.32,0x16242a));
   shape(this.add.circle(sign*size*.39,-size*.2,Math.max(2,size*.065),0xffffff));
  }
  shape(this.add.arc(0,size*.27,size*.22,10,170,false,0x263238).setStrokeStyle(2,0x263238));
  if(['sword','spear','axe'].includes(variant)){
   shape(this.add.rectangle(size*.95,-size*.15,Math.max(4,size*.14),size*1.6,0x9b744b).setAngle(-20));
   if(variant==='sword')shape(this.add.triangle(size*1.2,-size*1.1,-size*.22,size*.3,0,-size*.65,size*.22,size*.3,0xcbd5da));
   if(variant==='spear')shape(this.add.triangle(size*1.2,-size*1.15,-size*.22,size*.32,0,-size*.75,size*.22,size*.32,0xd7dbd8));
   if(variant==='axe')shape(this.add.ellipse(size*1.35,-size*.85,size*.7,size*.55,0xb8c2c5));
  }
  if(variant==='king'){
   shape(this.add.triangle(-size*.5,-size*.9,-size*.55,0,-size*.3,-size*.75,-size*.1,0,0xf0c44b));
   shape(this.add.triangle(0,-size*1.05,-size*.25,0,0,-size*.9,size*.25,0,0xf0c44b));
   shape(this.add.triangle(size*.5,-size*.9,-size*.1,0,size*.3,-size*.75,size*.55,0,0xf0c44b));
  }
  // Liczba jest ponad głową, nigdy na twarzy slime'a.
  const label=this.add.text(0,-size*1.32,String(n),{fontFamily:'Arial',fontSize:size>30?'23px':'19px',fontStyle:'bold',color:'#ffffff',stroke:'#342044',strokeThickness:4}).setOrigin(.5);
  const spriteNames={basic:'slime_green',rabbit:'slime_bunny',horned:'slime_horned',winged:'slime_winged',sword:'slime_sword',spear:'slime_spear',axe:'slime_axe',king:'slime_king'};
  const spriteKey=spriteNames[variant];
  let sprite=null;
  if(this.textures.exists(spriteKey)){
   for(const p of parts)p.setVisible(false);
   sprite=this.add.image(0,-size*.3,spriteKey).setDisplaySize(size*2.8,size*2.8);
   label.setY(-size*1.95);
  }
  const view=this.add.container(x,y,[...parts,...(sprite?[sprite]:[]),label]).setDepth(7);
  const enemy={n,x,y,size,view,label,body,sprite,boss:!!options.boss,swarm:!!options.swarm,hitPoints:options.hitPoints||0,armor:options.boss?10:0,baseColor:color,bornMinute:Math.floor((this.clock-this.startTime)/60000),bornAt:this.clock,factorHits:0};
  enemy.animPhase=hash(Math.floor(x),Math.floor(y),418)*Math.PI*2;
  enemy.hitUntil=0;
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
 applyDifficulty(id){
  const modes={veryeasy:[1,1],easy:[2,1],normal:[2,2],hard:[4,2],veryhard:[4,4]};
  const mode=modes[id]||modes.veryeasy;
  this.difficulty=modes[id]?id:'veryeasy';
  this.hitsPerFactor=mode[0];this.enemyMultiplier=mode[1];
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
  if(type==='potion'&&this.characterClass==='warrior'&&Math.random()<this.warriorDoublePotion*.1){const extra=this.add.container(x+25,y,[this.add.circle(0,0,15,0xd94d60).setStrokeStyle(3,0xffffff),this.add.text(0,0,'♥',{font:'bold 19px Arial',color:'#ffffff'}).setOrigin(.5)]).setDepth(5);this.drops.push({type,x:x+25,y,view:extra});}
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

 spawnHitSpark(x,y){
  // Jeden krótki błysk na trafienie, bez systemu cząsteczek aktualizowanego co klatkę.
  const flash=this.add.circle(x,y,7,0xffe4a0,.85).setDepth(11);
  this.tweens.add({targets:flash,scale:2.2,alpha:0,duration:165,ease:'Quad.Out',onComplete:()=>flash.destroy()});
 }
 shoot(target,prime,now,angle=null){
  const dx=target?target.x-this.player.x:Math.cos(angle),dy=target?target.y-this.player.y:Math.sin(angle),dist=Math.hypot(dx,dy)||1;
  const dir=angle===null?Math.atan2(dy,dx):angle;
  const line=this.add.line(0,0,this.player.x,this.player.y,this.player.x+Math.cos(dir)*18,this.player.y+Math.sin(dir)*18,0x4d3423).setOrigin(0).setLineWidth(2).setDepth(9);
  this.arrows.push({line,from:now,originX:this.player.x,originY:this.player.y,target,prime,angle:dir,range:this.attackRange});
  this.heroShootUntil=now+180;
  this.heroAimX=dx/dist;
 }
 hit(enemy,prime){
  if(!this.enemies.includes(enemy)||enemy.n%prime!==0)return;
  enemy.hitUntil=this.clock+180;
  this.spawnHitSpark(enemy.x,enemy.y);
  if(!enemy.boss&&!enemy.swarm&&this.knockbackLevel>0&&Math.random()<this.knockbackLevel*.01)enemy.stunnedUntil=Math.max(enemy.stunnedUntil||0,this.clock+1000);
  if(enemy.boss){
   enemy.armor--;
   if(this.special?.active&&this.special.kind==='boss'){
    this.special.remaining=Math.max(0,this.special.remaining-1);this.updateEventBar();
   }
   if(enemy.armor>0){enemy.body.setFillStyle(0xf1a5b1);if(enemy.sprite)enemy.sprite.setTint(0xffaaaa);this.time.delayedCall(85,()=>{if(enemy.view.active){enemy.body.setFillStyle(enemy.baseColor);if(enemy.sprite)enemy.sprite.clearTint();}});return;}
   enemy.armor=10;
  }
  enemy.factorHits=(enemy.factorHits||0)+1;
  if(enemy.factorHits<this.hitsPerFactor){
   // Ukryty licznik trafień: nad przeciwnikiem pozostaje tylko jego liczba.
   return;
  }
  enemy.factorHits=0;
  enemy.n/=prime;enemy.label.setText(String(enemy.n));enemy.body.setFillStyle(0xc9a5f0);if(enemy.sprite)enemy.sprite.setTint(0xe7baff);
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
   if(enemy.sprite){
    const ghost=this.add.image(enemy.x,enemy.y-enemy.size*.3,enemy.sprite.texture.key)
     .setDisplaySize(enemy.size*2.8,enemy.size*2.8).setDepth(8).setAlpha(.85);
    this.tweens.add({targets:ghost,alpha:0,scaleX:.3,scaleY:.3,y:ghost.y-18,duration:240,ease:'Quad.Out',onComplete:()=>ghost.destroy()});
   }
   enemy.view.destroy();this.enemies.splice(this.enemies.indexOf(enemy),1);
  }
 }
 drawCollisionDebug(force=false){
  if(!this.collisionDebug)return;
  const now=performance.now();if(!force&&now-this.collisionDrawTime<250)return;
  this.collisionDrawTime=now;
  const px=this.player.x,py=this.player.y,g=this.collisionGraphics;
  g.clear();
  // Czerwone punkty: kolizja granicy regionu. Zielone: sąsiednie pola przejścia.
  // Próbkujemy tylko widoczne sąsiedztwo bohatera, nie cały świat.
  const step=26,range=390;
  for(let y=Math.floor((py-range)/step)*step;y<=py+range;y+=step){
   for(let x=Math.floor((px-range)/step)*step;x<=px+range;x+=step){
    if(x<0||y<0||x>WORLD||y>WORLD)continue;
    const blocked=this.regionBoundaryAt(x,y,16);
    if(blocked){g.fillStyle(0xff3949,.85);g.fillCircle(x,y,8);}
    else if(this.regionBoundaryAt(x+step,y,16)||this.regionBoundaryAt(x-step,y,16)||this.regionBoundaryAt(x,y+step,16)||this.regionBoundaryAt(x,y-step,16)){
     g.fillStyle(0x55ef77,.8);g.fillCircle(x,y,5);
    }
   }
  }
  this.collisionReadout.setText('X: '+Math.round(px)+'  Y: '+Math.round(py)+'  | Region: '+regionAt(px,py).id+'  | Granica: '+(this.regionBoundaryAt(px,py,16)?'TAK':'NIE'));
 }
 update(frameNow,delta){
  if(this.collisionDebug)this.drawCollisionDebug();
  const profiling=this.perfToggle.checked;
  const profileStart=profiling?performance.now():0;
  let terrainMs=0,enemyMs=0;
  if(this.menuOpen||this.gameEnded||this.upgradeOpen||this.manualPause)return;
  this.clock+=Math.min(delta,50);
  const now=this.clock;
  if(this.lastSpawn<0){this.spawnWave(2);this.lastSpawn=now;}
  if(this.health<=0){this.finishGame(false);return;}
  if(Math.hypot(this.player.x-this.briefcaseX,this.player.y-this.briefcaseY)<65){this.finishGame(true);return;}
  const dt=Math.min(delta,50)/1000;
  let dx=Number(this.isPressed('d','right'))-Number(this.isPressed('a','left'))+(this.controlMode==='touch'?this.touchVector.x:0);
  let dy=Number(this.isPressed('s','down'))-Number(this.isPressed('w','up'))+(this.controlMode==='touch'?this.touchVector.y:0);
  const len=Math.hypot(dx,dy);
  if(len){dx/=len;dy/=len;this.lastMove.set(dx,dy);}
  if(len)this.classFacing.set(dx,dy);
  const specialPressed=this.isPressed('space')||this.touchDash;
  const specialCooldown=this.characterClass==='warrior'?4000*(1-this.dashCooldownLevel*.05):4000*(1-this.dashCooldownLevel*.05);
  const dash=specialPressed&&(this.characterClass==='archer'||this.characterClass==='warrior')&&now-this.lastDash>specialCooldown;
  if(dash){this.lastDash=now;this.chargeHitEnemies.clear();this.dashUntil=now+220;this.invulnUntil=now+220;this.dashDirection.copy(this.lastMove);if(this.characterClass==='warrior')this.showEffect('warrior_charge',this.player.x,this.player.y,240,115);else this.showEffect('rogue_dash',this.player.x,this.player.y,220,90);}
  if(specialPressed&&this.characterClass==='mage'&&now-this.specialLast>8000*(1-this.mageStunCooldown*.05)){
   this.specialLast=now;const radius=75+this.mageStunRange*15;this.showEffect('mage_stun_large',this.player.x,this.player.y,400,radius*2);
   for(const e of this.enemies)if(!e.boss&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<radius+e.size)e.stunnedUntil=Math.max(e.stunnedUntil||0,now+800+this.mageStunDuration*200);
  }
  if(specialPressed&&this.characterClass==='dark_mage'&&this.darkGolem&&now-this.specialLast>=30000-this.darkTauntCooldown*2000){this.specialLast=now;this.darkTauntUntil=now+1000+this.darkTauntDuration*1000;this.showEffect('dark_mage_taunt',this.darkGolem.x,this.darkGolem.y,500,110);}
  const dashing=now<this.dashUntil;
  if(this.heroSprite){
   const firing=now<(this.heroShootUntil||0);
   const facing=firing?this.heroAimX:len?dx:this.lastMove.x;
   this.heroSprite.setFlipX(facing<-.15);
   const stride=Math.sin(now*.021),moving=len>.1||dashing;
   this.heroSprite.y=-7+(moving?Math.abs(stride)*2.5:Math.sin(now*.002)*.6)-(firing?2:0);
   this.heroSprite.setAngle((moving?stride*2.3:Math.sin(now*.0018)*.6)+(firing?(facing<0?-6:6):0));
   this.heroSprite.setDisplaySize(76*(firing?1.07:1),76*(moving?1+Math.abs(stride)*.025:1));
   if(dashing)this.heroSprite.setAlpha(.82);else this.heroSprite.setAlpha(1);
  }
  else if(this.classSprite){const facing=len?dx:this.classFacing.x;this.classSprite.setFlipX(facing<-.15);this.classSprite.y=-7+(len?Math.abs(Math.sin(now*.021))*2:0);this.classSprite.setAngle(len?Math.sin(now*.021)*2:0);this.classSprite.setAlpha(dashing?.83:1);}
  else if(this.heroVisual){this.heroVisual.setScale(dx<-.15?-1:1,1);this.heroBoots[0].y=10+(len?Math.sin(now*.018)*3:0);this.heroBoots[1].y=10-(len?Math.sin(now*.018)*3:0);}
  const mx=dashing?this.dashDirection.x:dx,my=dashing?this.dashDirection.y:dy;
  const speed=dashing?780*(1+this.dashRangeLevel*.05):220*this.moveMultiplier;
  const oldX=this.player.x,oldY=this.player.y;this.moveAround(this.player,mx,my,dt,speed,16);
  if(dashing&&this.characterClass==='warrior')for(const e of [...this.enemies]){const ax=this.player.x-oldX,ay=this.player.y-oldY,dist=Math.hypot(ax,ay)||1,ex=e.x-oldX,ey=e.y-oldY,along=(ex*ax+ey*ay)/dist,side=Math.abs(ex*ay-ey*ax)/dist;if(along>=0&&along<=dist+e.size+15&&side<e.size+18&&!this.chargeHitEnemies.has(e)){this.chargeHitEnemies.add(e);for(const p of this.active)if(e.n%p===0&&this.enemies.includes(e))this.hit(e,p);if(this.enemies.includes(e))this.pushEnemy(e,150*(1+this.warriorPushRange*.15));}}
  // Ograniczona widoczność działa tylko wewnątrz lochów.
  const inDungeon=this.player.x>=DUNGEON.left&&this.player.x<DUNGEON.right&&this.player.y>=DUNGEON.top&&this.player.y<DUNGEON.bottom;
  this.dungeonVision.setVisible(inDungeon);
  if(inDungeon){
   this.dungeonVision.setPosition(this.player.x-this.cameras.main.scrollX,this.player.y-this.cameras.main.scrollY);
  }
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
  if(minute===0){if(now-this.lastSpawn>=10000&&normalCount<45*this.enemyMultiplier){this.spawnWave(3*this.enemyMultiplier);this.lastSpawn=now;}}
  else if(now-this.lastSpawn>2500&&normalCount<Math.min(18+minute*3,68)*this.enemyMultiplier){this.spawnWave(3*this.enemyMultiplier);this.lastSpawn=now;}
  const cam=this.cameras.main;const bound=cam.worldView;
  const enemyStart=profiling?performance.now():0;
  for(const enemy of [...this.enemies]){
   const distance=Math.hypot(this.player.x-enemy.x,this.player.y-enemy.y)||1;
   if(!enemy.swarm&&!enemy.boss&&enemy.bornMinute<minute&&(enemy.x<bound.left-400||enemy.x>bound.right+400||enemy.y<bound.top-300||enemy.y>bound.bottom+300)){enemy.view.destroy();this.enemies.splice(this.enemies.indexOf(enemy),1);continue;}
   // Przeciwnik ściga gracza niezależnie od odległości i rozmiaru okna.
   const enemySpeed=(enemy.boss?38:55)*((enemy.boss||enemy.swarm)&&now-enemy.bornAt<3000?2:1);
   if(now>=(enemy.stunnedUntil||0)){
    if(this.characterClass==='dark_mage'&&this.darkGolem&&now<this.darkTauntUntil){const oldX=this.player.x,oldY=this.player.y;this.player.x=this.darkGolem.x;this.player.y=this.darkGolem.y;this.steerEnemy(enemy,dt,enemySpeed*(now<(enemy.fearedUntil||0)?.5:1));this.player.x=oldX;this.player.y=oldY;}
    else this.steerEnemy(enemy,dt,enemySpeed*(now<(enemy.fearedUntil||0)?.5:1));
   }enemy.view.setPosition(enemy.x,enemy.y);
   if(enemy.sprite){
    const phase=now*.006+enemy.animPhase;
    const bounce=Math.abs(Math.sin(phase));
    enemy.sprite.y=-enemy.size*.3-bounce*3.2;
    enemy.sprite.setDisplaySize(enemy.size*2.8*(1+.035*Math.sin(phase)),enemy.size*2.8*(1-.045*bounce));
    enemy.sprite.setAngle(Math.sin(phase*.65)*2.5);
    if(now<enemy.hitUntil)enemy.sprite.setTint(0xffd1d1);
    else enemy.sprite.clearTint();
   }
   if(distance<enemy.size+12&&now-this.lastDamage>(this.characterClass==='warrior'?1500+this.warriorIFrames*100:850)&&now>this.invulnUntil){
    const blocked=this.characterClass==='warrior'&&Math.random()<(.10+this.warriorBlock*.05);
    const dodged=this.characterClass==='archer'&&Math.random()<this.attackDodgeLevel*.01;
    if(!blocked&&!dodged){this.health-=enemy.boss?2:1;
     if(this.characterClass==='mage'&&now-this.mageShieldLast>=Math.max(1000,6000-this.mageShieldCooldown*1000)){this.mageShieldLast=now;const r=45+this.mageShieldRange*12;this.showEffect('mage_shield_burst',this.player.x,this.player.y,300,r*2);for(const e of this.enemies)if(Math.hypot(e.x-this.player.x,e.y-this.player.y)<r+e.size)this.pushEnemy(e,55+this.mageShieldRange*15);}
    }else if(blocked)this.showEffect('warrior_block',this.player.x,this.player.y,240,76);else this.showEffect('rogue_dodge',this.player.x,this.player.y,200,76);
    this.lastDamage=now;
   }
  }
  if(profiling)enemyMs=performance.now()-enemyStart;
  this.laserVisual.clear();this.meleeVisual.clear();this.chainVisual.clear();this.shieldVisual.clear();this.darkAuraVisual.clear();
  if(this.characterClass==='dark_mage')this.updateDarkSummons(now,dt);
  if(this.characterClass==='mage'&&now-this.mageShieldLast>=Math.max(1000,6000-this.mageShieldCooldown*1000)){
   const x=this.player.x,y=this.player.y,r=34+Math.sin(now*.005)*2;
   this.shieldVisual.lineStyle(3,0x69eaff,.75).strokeCircle(x,y,r);
   this.shieldVisual.lineStyle(8,0x3c9eff,.13).strokeCircle(x,y,r+3);
   for(let k=0;k<5;k++){const a=k*Math.PI*2/5+now*.0012;this.shieldVisual.fillStyle(0xc9ffff,.8).fillCircle(x+Math.cos(a)*r,y+Math.sin(a)*r,2.4);}
  }
  const attackColors=[0x53dfff,0x79ff70,0xffd85a,0xe189ff,0xff7272,0x69e7ff,0xffffff,0xffa958];
  if(this.characterClass==='warrior'){this.updateWarriorSwing(now);if(this.warriorSecondSwingAt&&now>=this.warriorSecondSwingAt){this.performWarriorSwing(this.warriorSwingAngle,now);this.warriorSecondSwingAt=0;}}
  for(const [slot,p] of this.active.entries()){
   if(this.characterClass==='dark_mage'||this.characterClass==='warrior')continue;
   const color=attackColors[slot%attackColors.length];
   if(this.characterClass==='mage'){
    const range=450+this.mageAttackRange*50;
    let chain=this.mageChains.get(p)||[];
    // Zachowaj trafione cele; usuwaj tylko te, które już nie przyjmują tego dzielnika.
    chain=chain.filter(e=>this.enemies.includes(e)&&e.n%p===0);
    // Gdy początkowy cel zniknie, pozostałe cele automatycznie stają się początkiem łańcucha.
    if(!chain.length){
     const targets=this.enemies.filter(e=>e.n%p===0&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<=range);
     targets.sort((a,b)=>Math.hypot(a.x-this.player.x,a.y-this.player.y)-Math.hypot(b.x-this.player.x,b.y-this.player.y));
     if(targets.length)chain.push(targets[0]);
    }
    // Utrzymuj odcinki do poruszających się celów; przeskoki nie są krótkimi animacjami.
    let fromX=this.player.x,fromY=this.player.y;
    for(let i=0;i<chain.length;i++){
     const target=chain[i];
     this.drawLightning(this.chainVisual,fromX,fromY,target.x,target.y,color,now+slot*73+i*31);
     fromX=target.x;fromY=target.y;
    }
    if(chain.length&&now-(this.lastAttack.get(p)||0)>=650/(1+this.mageAttackRate*.1)){
     // Każdy podłączony przeciwnik otrzymuje obrażenia przy każdym impulsie.
     for(const target of [...chain])if(this.enemies.includes(target)&&target.n%p===0)this.hit(target,p);
     chain=chain.filter(e=>this.enemies.includes(e)&&e.n%p===0);
     // Wolne miejsca w łańcuchu można uzupełnić; każda próba ma własną szansę.
     while(chain.length&&chain.length<1+this.mageChainCount){
      if(Math.random()>=(.10+this.mageChainChance*.15))break;
      const last=chain[chain.length-1];
      const candidates=this.enemies.filter(e=>!chain.includes(e)&&e.n%p===0&&Math.hypot(e.x-last.x,e.y-last.y)<=range);
      candidates.sort((a,b)=>Math.hypot(a.x-last.x,a.y-last.y)-Math.hypot(b.x-last.x,b.y-last.y));
      if(!candidates.length)break;
      const next=candidates[0];chain.push(next);
      // Nowy cel również od razu otrzymuje pierwszy impuls.
      this.hit(next,p);
      if(!this.enemies.includes(next)||next.n%p!==0)chain=chain.filter(e=>this.enemies.includes(e)&&e.n%p===0);
     }
     this.lastAttack.set(p,now);
    }
    this.mageChains.set(p,chain);
    continue;
   }
   const rate=this.characterClass==='warrior'?1+this.warriorAttackRate*.1:this.attackRate;
   if(now-(this.lastAttack.get(p)||0)<650/rate)continue;
   if(this.characterClass==='warrior'||this.characterClass==='dark_mage')continue;
   const targets=this.enemies.filter(e=>e.n%p===0&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<this.attackRange).sort((a,b)=>Phaser.Math.Distance.Between(a.x,a.y,this.player.x,this.player.y)-Phaser.Math.Distance.Between(b.x,b.y,this.player.x,this.player.y));
   if(targets.length){
    const main=targets[0],cx=this.player.x,cy=this.player.y,base=Math.atan2(main.y-cy,main.x-cx);
    const spread=Math.PI/6,count=this.multishot;
    for(let i=0;i<count;i++){
     const angle=base+(count===1?0:(i/(count-1)-.5)*spread),ux=Math.cos(angle),uy=Math.sin(angle);
     const candidates=targets.filter(e=>{const ex=e.x-cx,ey=e.y-cy,d=Math.hypot(ex,ey),along=ex*ux+ey*uy,side=Math.abs(ex*uy-ey*ux);return along>0&&along<=this.attackRange&&side<=e.size+10;});
     candidates.sort((a,b)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy));
     this.shoot(candidates[0]||null,p,now,angle);
    }
    this.lastAttack.set(p,now);
   }
  }
  for(const a of [...this.arrows]){
   const age=now-a.from,progress=Math.min(age/170,1),tx=a.originX+Math.cos(a.angle)*a.range,ty=a.originY+Math.sin(a.angle)*a.range;
   a.line.setTo(a.originX+(tx-a.originX)*progress,a.originY+(ty-a.originY)*progress,a.originX+(tx-a.originX)*progress+8,a.originY+(ty-a.originY)*progress+3);
   if(progress===1){a.line.destroy();this.arrows.splice(this.arrows.indexOf(a),1);const dx=Math.cos(a.angle),dy=Math.sin(a.angle);const hits=this.enemies.filter(e=>e.n%a.prime===0&&Math.hypot(e.x-a.originX,e.y-a.originY)<=a.range+e.size&&((e.x-a.originX)*dx+(e.y-a.originY)*dy)>0&&Math.abs((e.x-a.originX)*dy-(e.y-a.originY)*dx)<=e.size+9);hits.sort((x,y)=>Math.hypot(x.x-a.originX,x.y-a.originY)-Math.hypot(y.x-a.originX,y.y-a.originY));if(hits.length)this.hit(hits[0],a.prime);}
  }
  for(const t of [...this.tokens])if(Math.hypot(t.x-this.player.x,t.y-this.player.y)<this.pickupRadius){t.view.destroy();this.tokens.splice(this.tokens.indexOf(t),1);this.exp++;this.total++;while(this.exp>=nextCost(this.level)){this.exp-=nextCost(this.level);this.level++;this.pendingUpgrades++;}}
  for(const drop of [...this.drops]){
   if(Math.hypot(drop.x-this.player.x,drop.y-this.player.y)>this.pickupRadius)continue;
   if(drop.type==='potion'&&this.health>=this.maxHealth)continue;
   if(drop.type==='potion')this.health=Math.min(this.maxHealth,this.health+1);
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
  const dashReady=this.characterClass==='dark_mage'?!!this.darkGolem&&now-this.specialLast>=30000-this.darkTauntCooldown*2000:this.characterClass==='mage'?now-this.specialLast>=8000*(1-this.mageStunCooldown*.05):now-this.lastDash>=4000*(1-this.dashCooldownLevel*.05);
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
   {id:'potion',title:'Mikstury zdrowia',level:this.potionLevel,max:5,effect:'+0,5% szansy na miksturę (+1 HP)'},
   {id:'multishot',title:'Wielostrzał',level:(this.multishot-1)/2,max:5,effect:'+2 strzały (stożek 30°)'},
   {id:'dashRange',title:this.characterClass==='warrior'?'Zasięg szarży (spacja)':'Zasięg uniku (spacja)',level:this.dashRangeLevel,max:5,effect:'+5% zasięgu'},
   {id:'dashCooldown',title:this.characterClass==='warrior'?'Odnowienie szarży (spacja)':'Odnowienie uniku (spacja)',level:this.dashCooldownLevel,max:5,effect:'−5% czasu odnowienia'},
   {id:'knockback',title:'Powalający strzał',level:this.knockbackLevel,max:10,effect:'+1% szansy na zatrzymanie zwykłego wroga na 1 s'},
   {id:'attackDodge',title:'Uniknięcie ataku',level:this.attackDodgeLevel,max:10,effect:'+1% szansy na uniknięcie obrażeń'}
  ].concat(this.characterClass==='mage'?[
   {id:'mageAttackRate',title:'Częstotliwość piorunów',level:this.mageAttackRate,max:10,effect:'+10% częstotliwości obrażeń'},
   {id:'mageAttackRange',title:'Zasięg wiązki',level:this.mageAttackRange,max:5,effect:'+50 px'},
   {id:'mageChainChance',title:'Szansa przeskoku',level:this.mageChainChance,max:6,effect:'+15% szansy (start 10%)'},
   {id:'mageChainCount',title:'Liczba przeskoków',level:this.mageChainCount,max:4,effect:'+1 możliwy przeskok'},
   {id:'mageStunRange',title:'Zasięg ogłuszenia (spacja)',level:this.mageStunRange,max:5,effect:'+15 px'},
   {id:'mageStunDuration',title:'Czas ogłuszenia',level:this.mageStunDuration,max:5,effect:'+0,2 s'},
   {id:'mageStunCooldown',title:'Odnowienie ogłuszenia',level:this.mageStunCooldown,max:5,effect:'−5% czasu odnowienia'},
   {id:'mageShieldRange',title:'Zasięg tarczy statycznej',level:this.mageShieldRange,max:5,effect:'+12 px'},
   {id:'mageShieldCooldown',title:'Ładowanie tarczy',level:this.mageShieldCooldown,max:5,effect:'−1 s'}
  ]:this.characterClass==='warrior'?[
   {id:'warriorConeRange',title:'Zasięg ataku',level:this.warriorConeRange,max:5,effect:'+40% zasięgu początkowego'},
   {id:'warriorConeWidth',title:'Szerokość ataku',level:this.warriorConeWidth,max:5,effect:'+14° (maks. 90°)'},
   {id:'warriorPushRange',title:'Zasięg odepchnięcia',level:this.warriorPushRange,max:5,effect:'+15% odrzutu'},
   {id:'warriorBlock',title:'Blok',level:this.warriorBlock,max:5,effect:'+5% szansy'},
   {id:'warriorDoublePotion',title:'Podwójna mikstura',level:this.warriorDoublePotion,max:5,effect:'+10% szansy'},
   {id:'warriorAttackRate',title:'Szybkość zamachu',level:this.warriorAttackRate,max:10,effect:'+10% częstotliwości'},
   {id:'warriorIFrames',title:'Nietykalność po obrażeniach',level:this.warriorIFrames,max:10,effect:'+0,1 s'}
  ]:this.characterClass==='dark_mage'?[
   {id:'darkSkeletonCount',title:'Liczba szkieletów',level:this.darkSkeletonCount,max:8,effect:'+1 szkielet (maks. 10)'},
   {id:'darkSkeletonRate',title:'Szybkość ataku szkieletów',level:this.darkSkeletonRate,max:6,effect:'+16,7% szybkości'},
   {id:'darkFear',title:'Strach szkieletów',level:this.darkFear,max:6,effect:'+5% szansy (spowolnienie 50% na 2 s)'},
   {id:'darkAuraRange',title:'Zasięg aury mroku',level:this.darkAuraRange,max:5,effect:'+6 px'},
   {id:'darkAuraRate',title:'Częstotliwość aury',level:this.darkAuraRate,max:5,effect:'+20%'},
   {id:'darkLifesteal',title:'Wysysanie życia',level:this.darkLifesteal,max:5,effect:'+0,5% szansy na +1 HP'},
   {id:'darkGolemLevel',title:'Golem',level:this.darkGolemLevel,max:5,effect:this.darkGolemLevel===0?'Odblokuj golema':'+25% szybkości ataku golema'},
   {id:'darkTauntDuration',title:'Odwrócenie uwagi (spacja)',level:this.darkTauntDuration,max:5,effect:'+1 s działania (maks. 6 s)'},
   {id:'darkTauntCooldown',title:'Odnowienie odwrócenia uwagi',level:this.darkTauntCooldown,max:5,effect:'−2 s (start 30 s)'}
  ]:[]).filter(u=>['movement','pickup','health','potion'].includes(u.id)||(this.characterClass==='archer'&&!['mage','warrior'].includes(u.id))||(this.characterClass==='warrior'&&['warriorConeRange','warriorConeWidth','dashRange','warriorPushRange','dashCooldown','warriorBlock','warriorDoublePotion','warriorAttackRate','warriorIFrames'].includes(u.id))||(this.characterClass==='mage'&&u.id.startsWith('mage'))||(this.characterClass==='dark_mage'&&u.id.startsWith('dark')));
 }
 statsMarkup(){
  const levels=this.upgradeLevels();
  const rank=id=>{const u=levels.find(v=>v.id===id);return u?u.level+'/'+u.max:'0/0';};
  const rows=[
   ['Klasa',this.characterClass==='dark_mage'?'Mroczny Mag':this.characterClass==='mage'?'Niebieski Mag':this.characterClass==='warrior'?'Wojownik':'Łucznik'],
   ['Poziom postaci',this.level],
   ['HP',this.health+' / '+this.maxHealth],
   ['Maksymalne HP '+rank('health'),this.maxHealth],
   ['Szybkość ruchu '+rank('movement'),Math.round(220*this.moveMultiplier)+' px/s'],
   ['Zasięg zbierania EXP '+rank('pickup'),this.pickupRadius+' px'],
   ['Mikstury zdrowia '+rank('potion'),(this.potionLevel*.5).toFixed(1).replace('.',',')+'% szansy (+1 HP)']
  ];
  if(this.characterClass==='archer')rows.push(
   ['Szybkość ataku '+rank('attack'),Math.round(this.attackRate*100)+'%'],
   ['Zasięg ataku '+rank('range'),this.attackRange+' px'],
   ['Wielostrzał '+rank('multishot'),this.multishot+' strzał na dzielnik (30°)'],
   ['Zasięg uniku '+rank('dashRange'),'+'+(this.dashRangeLevel*5)+'%'],
   ['Odnowienie uniku '+rank('dashCooldown'),'-'+(this.dashCooldownLevel*5)+'%'],
   ['Powalający strzał '+rank('knockback'),this.knockbackLevel+'%'],
   ['Uniknięcie ataku '+rank('attackDodge'),this.attackDodgeLevel+'%']
  );
  if(this.characterClass==='warrior')rows.push(
   ['Szybkość ataku '+rank('warriorAttackRate'),Math.round((1+this.warriorAttackRate*.1)*100)+'%'],
   ['Zasięg ataku '+rank('warriorConeRange'),Math.round(120*(1+this.warriorConeRange*.4))+' px'],
   ['Szerokość ataku '+rank('warriorConeWidth'),20+this.warriorConeWidth*14+'°'],
   ['Zasięg szarży '+rank('dashRange'),'+'+this.dashRangeLevel*5+'%'],
   ['Zasięg odepchnięcia '+rank('warriorPushRange'),'+'+this.warriorPushRange*15+'%'],
   ['Odnowienie szarży '+rank('dashCooldown'),'-'+this.dashCooldownLevel*5+'%'],
   ['Blok '+rank('warriorBlock'),(10+this.warriorBlock*5)+'%'],
   ['Podwójny zamach','25% szansy'],
   ['Podwójna mikstura '+rank('warriorDoublePotion'),this.warriorDoublePotion*10+'%'],
   ['Nietykalność po trafieniu '+rank('warriorIFrames'),(1.5+this.warriorIFrames*.1).toFixed(1)+' s']
  );
  if(this.characterClass==='dark_mage')rows.push(
   ['Szkielety '+rank('darkSkeletonCount'),2+this.darkSkeletonCount],
   ['Szybkość szkieletów '+rank('darkSkeletonRate'),Math.round((1+this.darkSkeletonRate/6)*100)+'%'],
   ['Strach '+rank('darkFear'),5+this.darkFear*5+'% (2 s, -50%)'],
   ['Zasięg aury '+rank('darkAuraRange'),90+this.darkAuraRange*6+' px'],
   ['Częstotliwość aury '+rank('darkAuraRate'),100+this.darkAuraRate*20+'%'],
   ['Wysysanie krwi '+rank('darkLifesteal'),(this.darkLifesteal*.5).toFixed(1)+'%'],
   ['Golem '+rank('darkGolemLevel'),this.darkGolemLevel?'aktywny':'zablokowany'],
   ['Odwrócenie uwagi '+rank('darkTauntDuration'),1+this.darkTauntDuration+' s'],
   ['Odnowienie spacji '+rank('darkTauntCooldown'),30-this.darkTauntCooldown*2+' s']
  );
  if(this.characterClass==='mage')rows.push(
   ['Częstotliwość piorunów '+rank('mageAttackRate'),Math.round((1+this.mageAttackRate*.1)*100)+'%'],
   ['Zasięg wiązki '+rank('mageAttackRange'),450+this.mageAttackRange*50+' px'],
   ['Szansa przeskoku '+rank('mageChainChance'),(10+this.mageChainChance*15)+'%'],
   ['Maks. liczba przeskoków '+rank('mageChainCount'),this.mageChainCount],
   ['Zasięg ogłuszenia '+rank('mageStunRange'),75+this.mageStunRange*15+' px'],
   ['Czas ogłuszenia '+rank('mageStunDuration'),(0.8+this.mageStunDuration*.2).toFixed(1)+' s'],
   ['Odnowienie ogłuszenia '+rank('mageStunCooldown'),(8*(1-this.mageStunCooldown*.05)).toFixed(1)+' s'],
   ['Zasięg tarczy '+rank('mageShieldRange'),45+this.mageShieldRange*12+' px'],
   ['Ładowanie tarczy '+rank('mageShieldCooldown'),6-this.mageShieldCooldown+' s']
  );
  rows.push(['Przerzucenia ulepszeń',this.rerollsLeft+' / 3'],['Magnes EXP','0,5% szansy']);
  return rows;
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
 finishGame(won){
  if(this.gameEnded)return;
  this.gameEnded=true;this.time.paused=true;this.physicalKeys.clear();
  document.getElementById('pause-overlay').hidden=true;
  document.getElementById('upgrade-overlay').hidden=true;
  this.endOverlay.hidden=false;
  this.endOverlay.classList.toggle('is-victory',won);
  document.getElementById('end-symbol').textContent=won?'▣':'☠';
  document.getElementById('end-title').textContent=won?'Gratulacje!':'Umarłeś!';
  document.getElementById('end-message').textContent=won?'Znalazłeś teczkę z czerwonymi paskami!':'Nie udało się przetrwać. Spróbuj ponownie!';
 }
 updateWarriorSwing(now){
  const cooldown=650/(1+this.warriorAttackRate*.1);
  if(now-(this.warriorLastSwing||0)<cooldown)return;
  const px=this.player.x,py=this.player.y,range=120*(1+this.warriorConeRange*.4);
  const targets=this.enemies.filter(e=>this.active.some(p=>e.n%p===0)&&Math.hypot(e.x-px,e.y-py)<=range+e.size);
  if(!targets.length)return;
  targets.sort((a,b)=>Math.hypot(a.x-px,a.y-py)-Math.hypot(b.x-px,b.y-py));
  const angle=Math.atan2(targets[0].y-py,targets[0].x-px);
  this.performWarriorSwing(angle,now);
  this.warriorLastSwing=now;
  if(Math.random()<.25){this.warriorSecondSwingAt=now+170;this.warriorSwingAngle=angle;}
 }
 performWarriorSwing(angle,now){
  const px=this.player.x,py=this.player.y,range=120*(1+this.warriorConeRange*.4),half=(10+this.warriorConeWidth*7)*Math.PI/180;
  this.meleeVisual.fillStyle(0xffd277,.28);
  this.meleeVisual.beginPath();this.meleeVisual.moveTo(px,py);this.meleeVisual.arc(px,py,range,angle-half,angle+half,false);this.meleeVisual.closePath();this.meleeVisual.fillPath();
  this.meleeVisual.lineStyle(3,0xffe5a0,.9);this.meleeVisual.beginPath();this.meleeVisual.arc(px,py,range,angle-half,angle+half,false);this.meleeVisual.strokePath();
  this.showEffect('warrior_sword_swing',px+Math.cos(angle)*range*.48,py+Math.sin(angle)*range*.48,190,Math.min(range,210),angle*180/Math.PI);
  for(const e of [...this.enemies]){
   const ex=e.x-px,ey=e.y-py,d=Math.hypot(ex,ey);
   if(d>range+e.size)continue;
   const diff=Math.abs(Math.atan2(Math.sin(Math.atan2(ey,ex)-angle),Math.cos(Math.atan2(ey,ex)-angle)));
   if(diff>half+(d>e.size?Math.asin(Math.min(1,e.size/d)):Math.PI))continue;
   for(const p of this.active)if(this.enemies.includes(e)&&e.n%p===0)this.hit(e,p);
  }
 }
 updateDarkSummons(now,dt){
  const px=this.player.x,py=this.player.y,range=90+this.darkAuraRange*6;
  this.darkAuraVisual.fillStyle(0x5a1c80,.17);this.darkAuraVisual.fillCircle(px,py,range);
  this.darkAuraVisual.lineStyle(3,0xbb70ed,.75);this.darkAuraVisual.strokeCircle(px,py,range);
  for(let k=0;k<8;k++){const a=k*Math.PI/4+now*.0003;this.darkAuraVisual.fillStyle(0xc887ff,.7);this.darkAuraVisual.fillCircle(px+Math.cos(a)*range,py+Math.sin(a)*range,2.5);}
  if(now-this.darkAuraLast>=650/(1+this.darkAuraRate*.2)){
   this.darkAuraLast=now;
   for(const e of [...this.enemies])if(Math.hypot(e.x-px,e.y-py)<=range+e.size){
    let damaged=false;
    for(const p of this.active)if(this.enemies.includes(e)&&e.n%p===0){this.hit(e,p);damaged=true;}
    if(damaged&&Math.random()<this.darkLifesteal*.005&&this.health<this.maxHealth){this.health++;this.showEffect('dark_mage_lifesteal',px,py,260,70);}
   }
  }
  const count=2+this.darkSkeletonCount;
  while(this.darkSkeletons.length<count){
   const i=this.darkSkeletons.length,a=i*Math.PI*2/count;
   const x=px+Math.cos(a)*55,y=py+Math.sin(a)*55;
   const sprite=this.add.image(x,y,'skeleton').setDisplaySize(54,54).setDepth(9);
   this.darkSkeletons.push({x,y,sprite,lastHit:-1000,index:i});
  }
  for(const s of this.darkSkeletons){
   const targets=this.enemies.filter(e=>this.active.some(p=>e.n%p===0));
   targets.sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y));
   const target=targets[0];
   const angle=s.index*Math.PI*2/count+now*.00035;
   const destX=target?target.x:px+Math.cos(angle)*60,destY=target?target.y:py+Math.sin(angle)*60;
   const dx=destX-s.x,dy=destY-s.y,d=Math.hypot(dx,dy)||1;
   if(d>(target?target.size+22:10)){const step=Math.min(d,125*dt);s.x+=dx/d*step;s.y+=dy/d*step;}
   s.sprite.setPosition(s.x,s.y).setFlipX(dx<0);
   if(target&&d<target.size+35&&now-s.lastHit>=650/(1+this.darkSkeletonRate/6)){
    s.lastHit=now;this.showEffect('skeleton_attack',target.x,target.y,150,55);
    for(const p of this.active)if(this.enemies.includes(target)&&target.n%p===0)this.hit(target,p);
    if(Math.random()<.05+this.darkFear*.05){target.fearedUntil=Math.max(target.fearedUntil||0,now+2000);this.showEffect('dark_mage_fear',target.x,target.y,220,70);}
   }
  }
  if(this.darkGolemLevel>0){
   if(!this.darkGolem){const sprite=this.add.image(px+75,py,'golem').setDisplaySize(86,86).setDepth(9);this.darkGolem={x:px+75,y:py,sprite,lastHit:-1000};}
   const g=this.darkGolem,targets=this.enemies.filter(e=>this.active.some(p=>e.n%p===0));
   targets.sort((a,b)=>Math.hypot(a.x-g.x,a.y-g.y)-Math.hypot(b.x-g.x,b.y-g.y));
   const t=targets[0],dx=(t?t.x:px+70)-g.x,dy=(t?t.y:py)-g.y,d=Math.hypot(dx,dy)||1;
   if(d>(t?t.size+35:10)){const step=Math.min(d,100*dt);g.x+=dx/d*step;g.y+=dy/d*step;}
   g.sprite.setPosition(g.x,g.y).setFlipX(dx<0);
   if(now<this.darkTauntUntil){g.sprite.setTint(0xffb9fa);this.darkAuraVisual.lineStyle(3,0xe19bff,.9);this.darkAuraVisual.strokeCircle(g.x,g.y,52);}else g.sprite.clearTint();
   if(t&&d<t.size+47&&now-g.lastHit>=650/(1+(this.darkGolemLevel-1)*.25)){
    g.lastHit=now;this.showEffect('golem_attack',t.x,t.y,170,78);
    for(const p of this.active)if(this.enemies.includes(t)&&t.n%p===0)this.hit(t,p);
   }
  }
 }
 showEffect(key,x,y,duration=240,size=110,angle=0){
  if(!this.textures.exists(key))return;
  const img=this.add.image(x,y,key).setDisplaySize(size,size).setAngle(angle).setAlpha(.85).setDepth(12);
  this.tweens.add({targets:img,alpha:0,scaleX:1.2,scaleY:1.2,duration,onComplete:()=>img.destroy()});
 }
 pushEnemy(enemy,distance){
  const dx=enemy.x-this.player.x,dy=enemy.y-this.player.y,len=Math.hypot(dx,dy)||1;
  const nx=Phaser.Math.Clamp(enemy.x+dx/len*distance,20,WORLD-20),ny=Phaser.Math.Clamp(enemy.y+dy/len*distance,20,WORLD-20);
  if(!this.isBlocked?.(nx,ny)) {enemy.x=nx;enemy.y=ny;enemy.view.setPosition(nx,ny);}
 }
 drawLightning(g,x1,y1,x2,y2,color,seed){
  const d=Math.hypot(x2-x1,y2-y1)||1,steps=Math.max(2,Math.ceil(d/24)),nx=-(y2-y1)/d,ny=(x2-x1)/d;
  g.lineStyle(6,color,.22);g.lineBetween(x1,y1,x2,y2);
  g.lineStyle(2.8,color,.95);
  let px=x1,py=y1;
  for(let i=1;i<=steps;i++){const t=i/steps,j=i===steps?0:Math.sin(seed*.027+i*18.2)*6;const x=x1+(x2-x1)*t+nx*j,y=y1+(y2-y1)*t+ny*j;g.lineBetween(px,py,x,y);px=x;py=y;}
 }
 applyCharacter(character){
  this.characterClass=character==='engineer'?'mage':['archer','warrior','mage','dark_mage'].includes(character)?character:'archer';
  this.heroVisual?.setVisible(false);this.heroSprite?.setVisible(this.characterClass==='archer');
  const ability=this.characterClass==='dark_mage'?'ODWRÓĆ UWAGĘ':this.characterClass==='mage'?'OGŁUSZENIE':this.characterClass==='warrior'?'SZARŻA':'UNIK';
  this.dashHint?.setText(ability);const touch=document.getElementById('touch-dash');if(touch)touch.textContent=ability;
  this.classVisual.setVisible(false);if(this.classSprite){this.classSprite.destroy();this.classSprite=null;}
  if(this.characterClass!=='archer'){
   const key=this.characterClass==='dark_mage'?'dark_mage':this.characterClass==='mage'?'blue_mage_new':'warrior_new';
   if(this.textures.exists(key)){this.classSprite=this.add.image(0,-7,key).setDisplaySize(76,76).setOrigin(.5,.62);this.player.add(this.classSprite);}
   else this.classVisual.setVisible(true);
  }
 }
 togglePause(){
  if(this.menuOpen)return;
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
  notice.hidden=![10,20,30,40].includes(this.level);
  if(!notice.hidden)notice.textContent='🔓 Nowy slot ataku! Dostępne: '+this.slotCount()+' sloty, '+this.lockLimit()+' blokady.';
  cards.replaceChildren();
  let reroll=document.getElementById('upgrade-reroll');
  if(!reroll){reroll=document.createElement('button');reroll.id='upgrade-reroll';reroll.type='button';reroll.className='menu-primary';reroll.addEventListener('click',()=>this.rerollUpgrades());cards.insertAdjacentElement('afterend',reroll);}
  reroll.hidden=this.rerollsLeft<=0||!this.offers.length;
  reroll.disabled=this.rerollsLeft<=0||!this.offers.length;
  reroll.textContent='↻ Losuj ponownie ('+this.rerollsLeft+' / 3)';
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
 rerollUpgrades(){
  if(!this.upgradeOpen||this.rerollsLeft<=0||!this.offers.length)return;
  this.rerollsLeft--;
  const previous=this.offers.map(u=>u.id).join(',');
  for(let attempt=0;attempt<6;attempt++){
   const next=this.availableUpgrades();
   this.offers=next;
   if(next.map(u=>u.id).join(',')!==previous)break;
  }
  this.renderUpgradeCards();
 }
 renderUpgradeCards(){
  // Odświeżamy jedynie karty, nie losujemy ich ponownie przy renderowaniu.
  const cards=document.getElementById('upgrade-cards');
  cards.replaceChildren();
  if(!this.offers.length){const btn=document.createElement('button');btn.className='upgrade-card';btn.textContent='Kontynuuj (wszystkie ulepszenia osiągnęły limit)';btn.onclick=()=>this.chooseUpgrade(-1);cards.append(btn);}
  else this.offers.forEach((u,i)=>{const btn=document.createElement('button');btn.className='upgrade-card';const key=document.createElement('span');key.className='upgrade-key';key.textContent=String(i+1);const title=document.createElement('strong');title.textContent=u.title;const description=document.createElement('span');description.textContent=u.effect+' · Poziom '+(u.level+1)+'/'+u.max;btn.append(key,title,description);btn.onclick=()=>this.chooseUpgrade(i);cards.append(btn);});
  const reroll=document.getElementById('upgrade-reroll');if(reroll){reroll.hidden=this.rerollsLeft<=0||!this.offers.length;reroll.disabled=reroll.hidden;reroll.textContent='↻ Losuj ponownie ('+this.rerollsLeft+' / 3)';}
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
    case 'multishot':this.multishot=Math.min(11,this.multishot+2);break;
    case 'dashRange':this.dashRangeLevel=Math.min(5,this.dashRangeLevel+1);break;
    case 'warriorPushRange':this.warriorPushRange=Math.min(5,this.warriorPushRange+1);break;
    case 'dashCooldown':this.dashCooldownLevel=Math.min(5,this.dashCooldownLevel+1);break;
    case 'knockback':this.knockbackLevel=Math.min(10,this.knockbackLevel+1);break;
    case 'attackDodge':this.attackDodgeLevel=Math.min(10,this.attackDodgeLevel+1);break;
    case 'mageAttackRate':this.mageAttackRate=Math.min(10,this.mageAttackRate+1);break;
    case 'mageAttackRange':this.mageAttackRange=Math.min(5,this.mageAttackRange+1);break;
    case 'mageChainChance':this.mageChainChance=Math.min(6,this.mageChainChance+1);break;
    case 'mageChainCount':this.mageChainCount=Math.min(4,this.mageChainCount+1);break;
    case 'mageStunRange':this.mageStunRange=Math.min(5,this.mageStunRange+1);break;
    case 'mageStunDuration':this.mageStunDuration=Math.min(5,this.mageStunDuration+1);break;
    case 'mageStunCooldown':this.mageStunCooldown=Math.min(5,this.mageStunCooldown+1);break;
    case 'mageShieldRange':this.mageShieldRange=Math.min(5,this.mageShieldRange+1);break;
    case 'mageShieldCooldown':this.mageShieldCooldown=Math.min(5,this.mageShieldCooldown+1);break;
    case 'warriorConeRange':this.warriorConeRange=Math.min(5,this.warriorConeRange+1);break;
    case 'warriorConeWidth':this.warriorConeWidth=Math.min(5,this.warriorConeWidth+1);break;
    case 'warriorBlock':this.warriorBlock=Math.min(5,this.warriorBlock+1);break;
    case 'warriorDoublePotion':this.warriorDoublePotion=Math.min(5,this.warriorDoublePotion+1);break;
    case 'warriorAttackRate':this.warriorAttackRate=Math.min(10,this.warriorAttackRate+1);break;
    case 'warriorIFrames':this.warriorIFrames=Math.min(10,this.warriorIFrames+1);break;
    case 'darkSkeletonCount':this.darkSkeletonCount=Math.min(8,this.darkSkeletonCount+1);break;
    case 'darkSkeletonRate':this.darkSkeletonRate=Math.min(6,this.darkSkeletonRate+1);break;
    case 'darkFear':this.darkFear=Math.min(6,this.darkFear+1);break;
    case 'darkAuraRange':this.darkAuraRange=Math.min(5,this.darkAuraRange+1);break;
    case 'darkAuraRate':this.darkAuraRate=Math.min(5,this.darkAuraRate+1);break;
    case 'darkLifesteal':this.darkLifesteal=Math.min(5,this.darkLifesteal+1);break;
    case 'darkGolemLevel':this.darkGolemLevel=Math.min(5,this.darkGolemLevel+1);break;
    case 'darkTauntDuration':this.darkTauntDuration=Math.min(5,this.darkTauntDuration+1);break;
    case 'darkTauntCooldown':this.darkTauntCooldown=Math.min(5,this.darkTauntCooldown+1);break;
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
