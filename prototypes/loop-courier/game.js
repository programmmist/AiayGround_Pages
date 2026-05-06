(() => {
  const W = 6, H = 6, MAX = 8;
  const walls = new Set(['1,1','4,1','2,3','3,3','1,4']);
  const start = {x:0,y:5};
  const goal = {x:5,y:0};
  const packages0 = [{x:0,y:0},{x:3,y:2},{x:5,y:5}];
  const guards0 = [{x:2,y:0,axis:'x',dir:1,min:2,max:5},{x:4,y:5,axis:'y',dir:-1,min:2,max:5}];
  const icon = {U:'↑',D:'↓',L:'←',R:'→',W:'·'};
  const el = Object.fromEntries(['startScreen','gameScreen','resultScreen','board','program','log','attemptText','deliveredText','bestText','stateText','resultTitle','resultSummary','resultStats','resultJson'].map(id=>[id,document.getElementById(id)]));
  let program=[], attempt=1, best=0, sim=null, running=false;
  function key(p){return `${p.x},${p.y}`}
  function clone(o){return JSON.parse(JSON.stringify(o))}
  function resetSim(){sim={bot:{...start},packages:clone(packages0),guards:clone(guards0),delivered:0,collisions:0,step:0,events:[]};}
  function show(name){['startScreen','gameScreen','resultScreen'].forEach(id=>el[id].classList.remove('screen-active')); el[name+'Screen']?.classList.add('screen-active');}
  function valid(p){return p.x>=0&&p.x<W&&p.y>=0&&p.y<H&&!walls.has(key(p));}
  function move(p,cmd){const n={...p}; if(cmd==='U')n.y--; if(cmd==='D')n.y++; if(cmd==='L')n.x--; if(cmd==='R')n.x++; return valid(n)?n:p;}
  function guardMove(g){let n={...g}; n[g.axis]+=g.dir; if(n[g.axis]<g.min||n[g.axis]>g.max){g.dir*=-1; n={...g}; n[g.axis]+=g.dir;} return {...n,dir:g.dir};}
  function render(){
    el.board.innerHTML='';
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=document.createElement('div'); c.className='cell'; const p={x,y}; if(walls.has(key(p)))c.classList.add('wall'); if(x===goal.x&&y===goal.y)c.classList.add('goal'); let text=''; if(x===goal.x&&y===goal.y)text='🏁'; if(sim.packages.some(q=>q.x===x&&q.y===y)){text='📦'; c.classList.add('pkg')} if(sim.guards.some(g=>g.x===x&&g.y===y)){text='👁'; c.classList.add('guard')} if(sim.bot.x===x&&sim.bot.y===y){text='🤖'; c.classList.add('bot')} c.textContent=text; el.board.appendChild(c);}
    el.program.innerHTML=Array.from({length:MAX},(_,i)=>`<div class="slot ${i===sim.step%Math.max(1,program.length)&&running?'active':''}">${program[i]?icon[program[i]]:''}</div>`).join('');
    el.attemptText.textContent=attempt; el.deliveredText.textContent=`${sim.delivered}/3`; el.bestText.textContent=best; el.stateText.textContent=running?'실행':'편집';
  }
  function log(s){el.log.textContent=s;}
  function add(cmd){if(running||program.length>=MAX)return; program.push(cmd); log(`명령 추가: ${icon[cmd]}`); render();}
  function clear(){if(running)return; program=[]; resetSim(); log('명령을 지웠습니다.'); render();}
  function hardReset(){if(running)return; attempt=1; best=0; program=[]; resetSim(); log('맵을 리셋했습니다.'); render();}
  function pickupOrDeliver(){
    const before=sim.packages.length; sim.packages=sim.packages.filter(p=>!(p.x===sim.bot.x&&p.y===sim.bot.y));
    if(sim.packages.length<before){sim.events.push({step:sim.step,type:'pickup'}); log('상자를 회수했습니다. 이제 깃발 칸으로!');}
    if(sim.bot.x===goal.x&&sim.bot.y===goal.y && before>sim.packages.length){sim.delivered++; best=Math.max(best,sim.delivered); sim.events.push({step:sim.step,type:'deliver',delivered:sim.delivered}); log('배달 성공. 다음 상자를 노리세요.');}
  }
  async function run(){
    if(running||program.length===0)return; running=true; attempt++; resetSim(); log('루프 실행 중...'); render();
    const steps=program.length*3;
    for(let i=0;i<steps;i++){
      sim.step=i; const cmd=program[i%program.length]; sim.bot=move(sim.bot,cmd); sim.guards=sim.guards.map(guardMove); pickupOrDeliver();
      if(sim.guards.some(g=>g.x===sim.bot.x&&g.y===sim.bot.y)){sim.collisions++; sim.events.push({step:i,type:'collision'}); log('경비와 충돌! 루트를 수정해보세요.'); break;}
      render(); await new Promise(r=>setTimeout(r,360));
      if(sim.delivered>=3)break;
    }
    running=false; render(); finish();
  }
  function finish(){
    const success=sim.delivered>=3;
    const report={id:'loop-courier',success,delivered:sim.delivered,collisions:sim.collisions,commands:program.map(c=>icon[c]).join(' '),attempts:attempt-1,best,events:sim.events,validationQuestion:'짧은 명령 루프를 짜고 실행 결과를 보며 수정하는 계획-관찰-수정 루프가 5분 안에 계속 재시도 욕구를 만드는가?'};
    el.resultTitle.textContent=success?'완전 배달 성공':'루프 결과';
    el.resultSummary.textContent=success?'8개 이하 명령으로 모든 상자를 처리했습니다. 이제 더 짧은 루프를 찾고 싶은지 확인하세요.':'결과를 보고 명령 루프를 수정하세요. 실패 지점이 명확하면 재시도 루프가 작동하는 것입니다.';
    el.resultStats.innerHTML=Object.entries({배달:sim.delivered,충돌:sim.collisions,명령수:program.length,시도:attempt-1,최고:best}).map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
    el.resultJson.textContent=JSON.stringify(report,null,2); show('resultScreen'.replace('Screen',''));
  }
  document.getElementById('startButton').addEventListener('click',()=>{resetSim();show('game');render();});
  document.getElementById('continueButton').addEventListener('click',()=>{show('game');render();});
  document.getElementById('runButton').addEventListener('click',run); document.getElementById('clearButton').addEventListener('click',clear); document.getElementById('resetButton').addEventListener('click',hardReset);
  document.querySelectorAll('[data-cmd]').forEach(b=>b.addEventListener('click',()=>add(b.dataset.cmd)));
  resetSim(); render();
})();
