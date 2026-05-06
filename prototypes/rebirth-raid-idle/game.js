(() => {
  const RUN_SECONDS = 240;
  const zones = [
    {name:'초원 멧돼지', req:0, hp:28, gold:7, xp:8, loot:'낡은 장갑'},
    {name:'폐광 고블린', req:34, hp:70, gold:18, xp:18, loot:'녹슨 검'},
    {name:'해골 성채', req:90, hp:160, gold:42, xp:44, loot:'기사 흉갑'},
    {name:'용의 둥지', req:220, hp:360, gold:110, xp:120, loot:'화룡 반지'},
  ];
  const el = Object.fromEntries(['startScreen','gameScreen','resultScreen','timeText','powerText','goldText','rebirthText','heroSprite','hpBar','combatText','lootList','zones','trainButton','gearButton','relicButton','rebirthButton','levelText','gearText','relicText','bestZoneText','resultTitle','resultSummary','resultStats','resultJson'].map(id=>[id,document.getElementById(id)]));
  let s, timer;
  function show(name){['startScreen','gameScreen','resultScreen'].forEach(id=>el[id].classList.remove('screen-active')); el[name+'Screen'].classList.add('screen-active');}
  function fmt(t){t=Math.max(0,Math.ceil(t));return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`}
  function power(){return Math.floor((10+s.level*4+s.gear*9)*(1+s.relic*0.18+s.rebirths*0.08));}
  function newRun(){s={elapsed:0,level:1,xp:0,gold:0,gear:1,relic:0,rebirths:0,zone:0,enemyHp:zones[0].hp,bestZone:0,bossKills:0,loot:[],events:[],firstRebirth:null};}
  function start(){clearInterval(timer);newRun();show('game');render();timer=setInterval(tick,250);}
  function log(type,data={}){s.events.push({t:Math.round(s.elapsed),type,...data}); if(s.events.length>80)s.events.shift();}
  function kill(){const z=zones[s.zone]; s.gold+=Math.round(z.gold*(1+s.zone*.25)); s.xp+=z.xp; s.bossKills+=s.zone===3?1:0; if(Math.random()<0.28){s.gear++; s.loot.unshift(`+${s.gear} ${z.loot}`); s.loot=s.loot.slice(0,6); log('loot',{item:z.loot,gear:s.gear});}
    while(s.xp>=s.level*22){s.xp-=s.level*22; s.level++; log('level',{level:s.level});}
    s.enemyHp=z.hp*(1+s.zone*.2); log('kill',{zone:z.name,gold:s.gold});}
  function tick(){s.elapsed+=0.25; const dps=power()*0.34; s.enemyHp-=dps*0.25; if(s.enemyHp<=0)kill(); if(s.elapsed>=RUN_SECONDS)finish(); render();}
  function setZone(i){if(power()>=zones[i].req){s.zone=i;s.bestZone=Math.max(s.bestZone,i);s.enemyHp=zones[i].hp*(1+i*.2);log('zone',{zone:zones[i].name});render();}}
  function train(){const cost=20+s.level*12; if(s.gold>=cost){s.gold-=cost;s.level++;log('train',{level:s.level});render();}}
  function gear(){const cost=35+s.gear*18; if(s.gold>=cost){s.gold-=cost;s.gear++;s.loot.unshift(`강화 성공: 장비 +${s.gear}`);s.loot=s.loot.slice(0,6);log('gear',{gear:s.gear});render();}}
  function relic(){const cost=120+s.relic*90; if(s.gold>=cost){s.gold-=cost;s.relic++;log('relic',{relic:s.relic});render();}}
  function rebirth(){const gain=Math.max(1,Math.floor((s.level+s.gear+s.bestZone*3)/8)); s.relic+=gain; s.rebirths++; if(s.firstRebirth===null)s.firstRebirth=Math.round(s.elapsed); log('rebirth',{gain,relic:s.relic}); s.level=1;s.xp=0;s.gold=0;s.gear=1;s.zone=0;s.enemyHp=zones[0].hp;s.loot.unshift(`환생 보상: 유물 +${gain}`);s.loot=s.loot.slice(0,6);render();}
  function render(){el.timeText.textContent=fmt(RUN_SECONDS-s.elapsed);el.powerText.textContent=power();el.goldText.textContent=Math.floor(s.gold);el.rebirthText.textContent=s.rebirths;el.levelText.textContent=s.level;el.gearText.textContent=`+${s.gear}`;el.relicText.textContent=s.relic;el.bestZoneText.textContent=s.bestZone+1;el.hpBar.style.width=`${Math.max(0,Math.min(100,s.enemyHp/(zones[s.zone].hp*(1+s.zone*.2))*100))}%`;el.combatText.textContent=`${zones[s.zone].name} 사냥 중 · 몬스터 HP ${Math.max(0,Math.ceil(s.enemyHp))}`;el.lootList.innerHTML=s.loot.length?s.loot.map(x=>`<li>${x}</li>`).join(''):'<li>아직 전리품 없음</li>';el.zones.innerHTML=zones.map((z,i)=>`<button class="${i===s.zone?'active':''} ${power()<z.req?'locked':''}" data-zone="${i}">${i+1}. ${z.name}<br><small>요구 전투력 ${z.req} · ${z.loot}</small></button>`).join('');el.zones.querySelectorAll('[data-zone]').forEach(b=>b.addEventListener('click',()=>setZone(+b.dataset.zone)));}
  function finish(){clearInterval(timer);const report={id:'rebirth-raid-idle',rebirths:s.rebirths,highestZone:s.bestZone+1,level:s.level,gear:s.gear,relic:s.relic,bossKills:s.bossKills,firstRebirthSeconds:s.firstRebirth,totalPower:power(),events:s.events,validationQuestion:'MMORPG식 사냥/장비 성장과 짧은 환생 보상이 5분 안에 “한 번 더 환생” 욕구를 만드는가?'};el.resultTitle.textContent='원정 리포트';el.resultSummary.textContent=s.rebirths>0?'환생 루프까지 도달했습니다. 핵심은 환생 직후 더 빨라진 체감이 충분한지입니다.':'환생까지 도달하지 못했습니다. 첫 환생 요구치를 더 낮춰야 할 가능성이 큽니다.';el.resultStats.innerHTML=Object.entries({환생:s.rebirths,최고지역:s.bestZone+1,레벨:s.level,장비:`+${s.gear}`,유물:s.relic,전투력:power()}).map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('');el.resultJson.textContent=JSON.stringify(report,null,2);show('result');}
  document.getElementById('startButton').addEventListener('click',start);document.getElementById('retryButton').addEventListener('click',start);el.trainButton.addEventListener('click',train);el.gearButton.addEventListener('click',gear);el.relicButton.addEventListener('click',relic);el.rebirthButton.addEventListener('click',rebirth);
})();