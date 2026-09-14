const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {webcrypto}=require("node:crypto");
const test=require("node:test");
const vm=require("node:vm");

const source=readFileSync(require("node:path").join(__dirname,"draft.js"),"utf8");
const logic=source.slice(0,source.indexOf('elements.modes.forEach(button=>button.addEventListener'));

function run(expression){
  const sandbox={crypto:webcrypto,document:{querySelectorAll:()=>[],querySelector:()=>({})},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},console};
  vm.runInNewContext(`${logic}\nglobalThis.answer=JSON.parse(JSON.stringify(${expression}));`,sandbox);
  return JSON.parse(JSON.stringify(sandbox.answer));
}

test("draft cards fill Main, Side, and Extra in DuelingBook order",()=>{
  const result=run(`(()=>{
    const main=Array.from({length:75},(_,id)=>({id:id+1,name:"Main "+id,source:"custom",duelingbookId:id+1,cardType:"Effect Monster"}));
    const extra=Array.from({length:15},(_,id)=>({id:id+100,name:"Extra "+id,source:"official",duelingbookId:id+100,passcode:"00102380",cardType:"Fusion Monster"}));
    const zones=assignZones([...main.slice(0,60),...extra,...main.slice(60)]);
    return {main:zones.main.length,side:zones.side.length,extra:zones.extra.length,complete:deckComplete(zones)};
  })()`);
  assert.deepEqual(result,{main:60,side:15,extra:15,complete:true});
});

test("no more than twenty Extra Deck monsters can be collected",()=>{
  const result=run(`(()=>{
    const extra=Array.from({length:21},(_,id)=>({id:id+1,name:"Extra "+id,source:"custom",duelingbookId:id+1,cardType:"Link Monster"}));
    const zones=assignZones(extra);
    return {extra:zones.extra.length,side:zones.side.length,twentyFirstFits:canAddCard(extra[20],extra.slice(0,20))};
  })()`);
  assert.deepEqual(result,{extra:15,side:5,twentyFirstFits:false});
});

test("full Main and Side zones stop non-Extra cards but still accept Extra cards",()=>{
  const result=run(`(()=>{
    const main=Array.from({length:76},(_,id)=>({id:id+1,name:"Main "+id,source:"custom",duelingbookId:id+1,cardType:"Spell Card"}));
    const extra={id:500,name:"Extra",source:"custom",duelingbookId:500,cardType:"Synchro Monster"};
    return {mainFits:canAddCard(main[75],main.slice(0,75)),extraFits:canAddCard(extra,main.slice(0,75))};
  })()`);
  assert.deepEqual(result,{mainFits:false,extraFits:true});
});

test("official XML cards use DuelingBook IDs and numeric passcodes",()=>{
  const line=run(`xmlCard({name:"A & B's Card",source:"official",duelingbookId:2518,passcode:"00102380"})`);
  assert.equal(line,'  <card id="2518" passcode="102380">A &amp; B&#39;s Card</card>');
});

test("card types can only use their legal primary zone or the Side Deck",()=>{
  const result=run(`({main:allowedZones({cardType:"Effect Monster"}),spell:allowedZones({cardType:"Spell Card"}),extra:allowedZones({cardType:"Xyz Monster"})})`);
  assert.deepEqual(result,{main:["main","side"],spell:["main","side"],extra:["extra","side"]});
});

test("saved card order is respected within a deck zone",()=>{
  const result=run(`(()=>{
    state.mode="rips";
    state.ripPacks=[[1,2,3].map(id=>({id,name:"Card "+id,source:"custom",duelingbookId:id,cardType:"Effect Monster"}))];
    state.zoneOrder.rips.main=["rips-0-2","rips-0-0","rips-0-1"];
    return activeZoneInstances().main.map(item=>item.key);
  })()`);
  assert.deepEqual(result,["rips-0-2","rips-0-0","rips-0-1"]);
});

