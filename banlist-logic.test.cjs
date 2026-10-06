const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {join}=require("node:path");
const test=require("node:test");
const vm=require("node:vm");

const source=readFileSync(join(__dirname,"app.js"),"utf8");
const logic=source.slice(0,source.indexOf('elements.nameSearch.addEventListener'));

function run(expression){
  const element={value:"all",options:[],querySelectorAll:()=>[],addEventListener(){}};
  const sandbox={
    document:{querySelector:()=>element,querySelectorAll:()=>[]},
    localStorage:{getItem:()=>null,setItem(){}},
    console,
  };
  vm.runInNewContext(`${logic}\nglobalThis.answer=JSON.parse(JSON.stringify(${expression}));`,sandbox);
  return JSON.parse(JSON.stringify(sandbox.answer));
}

test("level, rank, and link labels resolve to a shared numeric rating",()=>{
  const result=run(`[
    ratingValue({levelRankLink:"Level 8"}),
    ratingValue({levelRankLink:"Rank 4"}),
    ratingValue({levelRankLink:"Link 3"}),
    ratingValue({levelRankLink:"Link-2"}),
    ratingValue({levelRankLink:""})
  ]`);
  assert.deepEqual(result,[8,4,3,2,null]);
});

test("rating filter finds matching Levels, Ranks, and Link Ratings",()=>{
  const result=run(`(()=>{
    state.cards=[
      {id:1,name:"Level Monster",status:"unlimeade",source:"custom",cardType:"Effect Monster",levelRankLink:"Level 4"},
      {id:2,name:"Xyz Monster",status:"limeade",source:"custom",cardType:"Xyz Monster",levelRankLink:"Rank 4"},
      {id:3,name:"Link Monster",status:"banned",source:"custom",cardType:"Link Monster",levelRankLink:"Link 3"},
      {id:4,name:"Spell",status:"unlimeade",source:"official",cardType:"Spell Card"}
    ];
    state.rating="4";
    return getVisibleCards().map(card=>card.name);
  })()`);
  assert.deepEqual(result,["Level Monster","Xyz Monster"]);
});

test("rating sorting keeps unrated cards last in either direction",()=>{
  const result=run(`(()=>{
    state.cards=[
      {id:1,name:"Level Eight",status:"unlimeade",source:"custom",cardType:"Effect Monster",levelRankLink:"Level 8"},
      {id:2,name:"Rank Four",status:"limeade",source:"custom",cardType:"Xyz Monster",levelRankLink:"Rank 4"},
      {id:3,name:"Spell",status:"banned",source:"official",cardType:"Spell Card"}
    ];
    state.sort="rating-desc";
    return getVisibleCards().map(card=>card.name);
  })()`);
  assert.deepEqual(result,["Level Eight","Rank Four","Spell"]);
});

