(() => {
  const $ = (id) => document.getElementById(id);
  const initialStocks = [
    {id:"nex",name:"NEXUS TECH",sector:"テクノロジー",price:1240,trend:0.012,vol:0.075},
    {id:"mori",name:"MORI FOODS",sector:"食品・生活",price:860,trend:0.004,vol:0.035},
    {id:"aero",name:"AEROLINK",sector:"輸送・航空",price:2150,trend:-0.006,vol:0.09},
    {id:"sol",name:"SOLARIS ENERGY",sector:"再生エネルギー",price:1580,trend:0.009,vol:0.065}
  ];
  const actionInfo = {
    class:{label:"授業に出席",note:"授業に出席する。地道な積み重ねが成績につながる。",run:s=>{s.grade+=4;s.knowledge+=2;s.stamina-=10;s.reputation+=2;}},
    study:{label:"自習",note:"自習室で勉強する。投資にも役立つ知識が身につく。",run:s=>{s.grade+=2;s.knowledge+=5;s.stamina-=15;}},
    work:{label:"アルバイト",note:"放課後にアルバイト。収入は得られるが体力を消耗する。",run:s=>{s.cash+=8000;s.stamina-=20;s.reputation-=1;}},
    research:{label:"市場調査",note:"企業ニュースや市場動向を調べる。翌日の値動きの予測精度が上がる。",run:s=>{s.knowledge+=3;s.stamina-=8;s.research=true;}},
    rest:{label:"休息",note:"今日は無理をせず休む。体力を回復する。",run:s=>{s.stamina+=25;s.reputation+=1;}}
  };
  let state;
  function fresh(){return {day:1,cash:100000,stamina:80,grade:50,knowledge:10,reputation:50,stocks:initialStocks.map(x=>({...x,prev:x.price,change:0})),portfolio:{},action:"class",research:false,news:"新学期が始まった。まずは学校と市場の様子を見てみよう。",forecast:"市場分析を行うと、次の日の値動きのヒントが得られる。",history:[],done:false};}
  state=fresh();
  const yen=n=>"¥"+Math.round(n).toLocaleString("ja-JP");
  const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
  function totalHoldings(){return state.stocks.reduce((sum,st)=>sum+(state.portfolio[st.id]||0)*st.price,0);}
  function netWorth(){return state.cash+totalHoldings();}
  function log(msg){state.history.unshift("DAY "+String(state.day).padStart(2,"0")+" · "+msg);state.history=state.history.slice(0,8);}
  function render(){
    $("day").innerHTML=String(state.day).padStart(2,"0")+' <small>/ 30</small>';
    $("cash").textContent=yen(state.cash);$("networth").textContent=yen(netWorth());$("stamina").textContent=state.stamina+" / 100";
    $("grade").textContent=state.grade;$("knowledge").textContent=state.knowledge;$("reputation").textContent=state.reputation;
    $("grade-bar").style.width=state.grade+"%";$("knowledge-bar").style.width=state.knowledge+"%";$("reputation-bar").style.width=state.reputation+"%";
    $("holdings-value").textContent=yen(totalHoldings());
    $("news").textContent=state.news;$("forecast").textContent=state.forecast;
    $("log").innerHTML=state.history.map(x=>"<li>"+x+"</li>").join("");
    $("stock-list").innerHTML=state.stocks.map(st=>{const sign=st.change>0?"+":"";const cls=st.change>0?"up":st.change<0?"down":"flat";return '<div class="stock-row"><div class="stock-name"><strong>'+st.name+'</strong><small>'+st.sector+'</small></div><div class="stock-price">'+yen(st.price)+'</div><div class="stock-change '+cls+'">'+sign+(st.change*100).toFixed(2)+'%</div></div>';}).join("");
    $("trade-stock").innerHTML=state.stocks.map(st=>'<option value="'+st.id+'">'+st.name+'</option>').join("");
    $("portfolio").innerHTML=state.stocks.filter(st=>(state.portfolio[st.id]||0)>0).map(st=>'<div class="portfolio-item"><div><strong>'+st.name+'</strong><small>'+(state.portfolio[st.id])+' 株保有</small></div><span>'+yen(st.price*state.portfolio[st.id])+'</span></div>').join("")||'<p class="empty">まだ株を保有していない。</p>';
    document.querySelectorAll(".action-card").forEach(btn=>btn.classList.toggle("selected",btn.dataset.action===state.action));
    $("day-state").textContent=state.done?"30日間終了":"行動選択中";
    $("actions").querySelectorAll("button").forEach(b=>b.disabled=state.done);
    $("finish-day").disabled=state.done;$("buy").disabled=state.done;$("sell").disabled=state.done;
    updateEstimate();
  }
  function updateEstimate(){const st=state.stocks.find(x=>x.id===$("trade-stock").value)||state.stocks[0];const qty=Math.max(1,Math.floor(Number($("trade-qty").value)||1));$("trade-total").textContent=yen(st.price*qty);}
  function trade(type){
    if(state.done)return;
    const st=state.stocks.find(x=>x.id===$("trade-stock").value);const qty=Math.floor(Number($("trade-qty").value));
    if(!st||!Number.isFinite(qty)||qty<1){$("trade-message").textContent="株数は1以上の整数で指定してください。";return;}
    const cost=st.price*qty;const owned=state.portfolio[st.id]||0;
    if(type==="buy"){
      if(cost>state.cash){$("trade-message").textContent="資金が足りない。アルバイトで資金を増やそう。";return;}
      state.cash-=cost;state.portfolio[st.id]=owned+qty;log(st.name+"を"+qty+"株購入。");
      $("trade-message").textContent=st.name+"を"+qty+"株購入した。";
    }else{
      if(qty>owned){$("trade-message").textContent="保有株数が足りない。";return;}
      state.cash+=cost;state.portfolio[st.id]=owned-qty;log(st.name+"を"+qty+"株売却。");
      $("trade-message").textContent=st.name+"を"+qty+"株売却した。";
    }
    render();
  }
  function finishDay(){
    if(state.done)return;
    const action=actionInfo[state.action];if(state.stamina<8&&state.action!=="rest"){$("action-note").textContent="体力が足りない。休息を選ぼう。";return;}
    action.run(state);state.grade=clamp(state.grade);state.knowledge=clamp(state.knowledge);state.reputation=clamp(state.reputation);state.stamina=clamp(state.stamina);
    log(action.label+"を実行。");
    const events=[
      {text:"NEXUS TECHが新製品を発表。市場の期待が高まっている。",id:"nex",bias:.065},
      {text:"MORI FOODSの新商品が好評。生活関連株に買いが集まった。",id:"mori",bias:.05},
      {text:"AEROLINKで整備コスト増加の報道。短期的な警戒感が広がる。",id:"aero",bias:-.075},
      {text:"SOLARIS ENERGYが大型契約を獲得。再エネ分野に注目が集まる。",id:"sol",bias:.07},
      {text:"市場に大きな材料はなく、投資家は様子見を続けている。",id:null,bias:0}
    ];
    const event=events[Math.floor(Math.random()*events.length)];
    state.stocks.forEach(st=>{
      const random=(Math.random()-.5)*2*st.vol;
      const knowledgeBonus=state.knowledge/1000;
      const bias=st.id===event.id?event.bias:0;
      let change=st.trend+random+bias+(Math.random()<.08?(Math.random()-.5)*.12:0);
      if(state.research)change+=Math.sign(st.trend)*knowledgeBonus;
      change=Math.max(-.22,Math.min(.22,change));
      st.prev=st.price;st.price=Math.max(50,Math.round(st.price*(1+change)));st.change=st.price/st.prev-1;
    });
    state.news=event.text;
    state.forecast=state.research?"調査結果：知識が値動きの分析に役立った。今回の予測補正が適用された。":"次の値動きは不確実。複数の銘柄に分散することも考えよう。";
    state.research=false;
    if(state.day>=30){endGame();return;}
    state.day++;state.action="class";
    render();
    $("action-note").textContent="翌日になった。今日の行動を選ぼう。";
  }
  function endGame(){
    state.done=true;
    const worth=netWorth();
    const score=Math.round(worth/1000+state.grade*30+state.knowledge*20+state.reputation*10);
    $("result-copy").textContent="最終資産 "+yen(worth)+" / 学業成績 "+state.grade+" / 投資知識 "+state.knowledge+"。学校生活と資産運用の30日間が終了した。";
    $("final-score").textContent=score.toLocaleString("ja-JP")+" PTS";
    $("result").classList.remove("hidden");
    render();
    $("result").scrollIntoView({behavior:"smooth",block:"center"});
  }
  document.querySelectorAll(".action-card").forEach(btn=>btn.addEventListener("click",()=>{if(state.done)return;state.action=btn.dataset.action;$("action-note").textContent=actionInfo[state.action].note;render();}));
  $("finish-day").addEventListener("click",finishDay);
  $("buy").addEventListener("click",()=>trade("buy"));$("sell").addEventListener("click",()=>trade("sell"));
  $("trade-stock").addEventListener("change",updateEstimate);$("trade-qty").addEventListener("input",updateEstimate);
  $("restart").addEventListener("click",()=>{state=fresh();$("result").classList.add("hidden");$("trade-message").textContent="銘柄と株数を選択してください。";$("action-note").textContent=actionInfo.class.note;render();window.scrollTo({top:0,behavior:"smooth"});});
  render();
})();