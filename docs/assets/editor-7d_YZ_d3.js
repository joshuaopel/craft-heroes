import{a as e,c as t,d as n,f as r,i,l as a,m as o,n as s,o as c,p as l,r as u,s as d,t as f,u as p}from"./LevelScene-Dm5_RaO0.js";function m(e){return structuredClone(e)}function h(e){return`craft-heroes-level:${e}`}function g(e){return`craft-heroes-campaign:${e}`}function ee(e){localStorage.setItem(h(e.id),JSON.stringify(e,null,2))}function te(e){localStorage.setItem(g(e.id),JSON.stringify(e,null,2))}function _(e,t){return e.tiles[t.z]?.[t.x]}function v(e,t){return t.x>=0&&t.z>=0&&t.x<e.width&&t.z<e.depth}function y(e,t,n){let r=m(e),i=_(r,t);return i&&(i.height=Math.max(0,Math.min(6,i.height+n))),r}function ne(e,t,n){let r=m(e),i=_(r,t);return i&&(i.terrain=n),r}function re(e,t,n,r=`grass`){let i=m(e),a=Math.max(4,Math.min(32,Math.round(t))),o=Math.max(4,Math.min(32,Math.round(n)));i.width=a,i.depth=o,i.tiles=Array.from({length:o},(t,n)=>Array.from({length:a},(t,i)=>{let a=e.tiles[n]?.[i];return a?{...a}:{height:1,terrain:r}})),i.obstacles=i.obstacles.filter(e=>v(i,e)),i.units=i.units.filter(e=>v(i,e));let s=new Set(i.units.map(e=>e.id));return i.initiativeOrder=(i.initiativeOrder??e.units.map(e=>e.id)).filter(e=>s.has(e)),i}function ie(e,t,n,r=0){let i=m(e);return i.obstacles=i.obstacles.filter(e=>e.x!==t.x||e.z!==t.z),i.obstacles.push({id:`obs-${n}-${Date.now()}`,type:n,x:t.x,z:t.z,rotation:r}),i}function ae(e,t,n,r){let i=m(e),a=i.units.filter(e=>e.x===t.x&&e.z===t.z).map(e=>e.id),o=`${n}-${Date.now()}`;return i.units=i.units.filter(e=>e.x!==t.x||e.z!==t.z),i.units.push({id:o,team:n,templateId:r.id,name:n===`player`?`Player Cube`:r.name,x:t.x,z:t.z,hp:r.hp,aiBehavior:n===`enemy`?`straight-offense`:void 0,rotations:{head:0,body:n===`enemy`?2:0,legs:0},faces:structuredClone(r.faces)}),i.initiativeOrder=[...(i.initiativeOrder??e.units.map(e=>e.id)).filter(e=>!a.includes(e)),o],i}function oe(e,t){let n=m(e),r=n.units.filter(e=>e.x===t.x&&e.z===t.z).map(e=>e.id);return n.obstacles=n.obstacles.filter(e=>e.x!==t.x||e.z!==t.z),n.units=n.units.filter(e=>e.x!==t.x||e.z!==t.z),r.length>0&&(n.initiativeOrder=(n.initiativeOrder??e.units.map(e=>e.id)).filter(e=>!r.includes(e))),n}function se(e){let t=[];e.units.some(e=>e.team===`player`)||t.push(`No player unit placed.`),e.units.some(e=>e.team===`enemy`)||t.push(`No enemy units placed.`),e.objectives.length===0&&t.push(`No objective configured.`);for(let n of e.units)v(e,n)||t.push(`${n.name} is outside the board.`);return t}var b=[`S`,`E`,`N`,`W`],x=[`head`,`body`,`legs`],S=[`active`,`passive`,`onMove`,`onAttack`,`onDefend`,`onSupport`],C=[`buff`,`debuff`,`trap`,`status`],w=[{id:`straight-offense`,label:`Straight Offense`,summary:`Attack, advance, attack again.`},{id:`cautionary-cycle`,label:`Cautionary Cycle`,summary:`Attack, defend, attack.`},{id:`avoidance-cycle`,label:`Avoidance Cycle`,summary:`Avoid, attack, defend, avoid.`}],T=[{key:`attack`,label:`ATK`},{key:`defense`,label:`DEF`},{key:`move`,label:`MOVE`},{key:`range`,label:`RNG`},{key:`support`,label:`SUP`}],E=`craft-heroes-unit-templates`,ce=`craft-heroes-class-definitions`,le=`craft-heroes-environment-materials`,ue=`craft-heroes-prop-definitions`;function D(e){return e.replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#039;`})[e])}function O(e){return e?`<img src="${D(e)}" alt="">`:``}function de(e){return e.trim().toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``)||`build-${Date.now()}`}function k(e){return e.trim().toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``)||`class-${Date.now()}`}function A(e){return e.trim().toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``)||`material-${Date.now()}`}function j(e){return e.trim().toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``)||`prop-${Date.now()}`}function M(e){return e.trim().toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``)||`level-${Date.now()}`}function fe(e){let t=M(e);return t.endsWith(`.json`)?t:`${t}.json`}function N(e){try{let t=localStorage.getItem(e);return t?JSON.parse(t):void 0}catch{return}}function P(e,t){let n=Number(e);return Number.isFinite(n)?n:t}function F(e){return w.some(t=>t.id===e)?e:`straight-offense`}function I(e,t){let n=e.map(e=>e.id),r=Array.isArray(t)?t.map(String).filter(e=>n.includes(e)):[];return[...r,...n.filter(e=>!r.includes(e))]}function pe(e){return{attack:Math.max(0,Math.min(12,P(e?.attack,0))),defense:Math.max(0,Math.min(12,P(e?.defense,0))),move:Math.max(0,Math.min(12,P(e?.move,0))),range:Math.max(0,Math.min(12,P(e?.range,0))),support:Math.max(0,Math.min(12,P(e?.support,0)))}}function L(e){return{attack:Math.max(-12,Math.min(12,P(e?.attack,0))),defense:Math.max(-12,Math.min(12,P(e?.defense,0))),move:Math.max(-12,Math.min(12,P(e?.move,0))),range:Math.max(-12,Math.min(12,P(e?.range,0))),support:Math.max(-12,Math.min(12,P(e?.support,0))),initiative:Math.max(-12,Math.min(12,P(e?.initiative,0)))}}function me(e){return Object.entries(e).filter(([,e])=>Number(e)!==0).map(([e,t])=>`${e}:${t}`).join(`;`)}function he(e){let t={};for(let n of e.split(`;`).map(e=>e.trim()).filter(Boolean)){let[e,r]=n.split(`:`).map(e=>e.trim());if(!e)continue;let i=P(r,0);[`attack`,`defense`,`move`,`range`,`support`,`initiative`].includes(e)&&(t[e]=Math.max(-12,Math.min(12,i)))}return L(t)}function R(e,t){return e.trim().toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-+|-+$/g,``)||`${t}-${Date.now()}`}function z(e,t){let n=e.name||e.description||`Ability ${t+1}`,r=S.includes(e.trigger)?e.trigger:`passive`;return{id:e.id||R(n,`ability`),name:n,trigger:r,icon:(e.icon||n.slice(0,2)||`FX`).toUpperCase().slice(0,3),color:V(e.color)?e.color:`#60d7e4`,description:e.description||``,effect:e.effect||``}}function ge(e){return Array.isArray(e)?e.map((e,t)=>z(e,t)):[]}function B(e){return e===`grass`||e===`water`||e===`solid`?e:`solid`}function V(e){return typeof e==`string`&&/^#[0-9a-f]{6}$/i.test(e)}function H(e,t){return[...Array.isArray(e)?e.filter(V):[],...t.filter(V),`#79b95a`,`#94c866`,`#b1dc70`].slice(0,3)}function _e(e){let t=P(e,0),n=Math.PI/2;return(Math.round(t/n)%4+4)%4*n}function U(e){let t=d[0],n=e.id||k(e.name||`class`),r={};for(let n of x){let i=e.sections?.[n]??t.sections[n];r[n]={imageUrl:typeof i.imageUrl==`string`?i.imageUrl:``,stats:pe(i.stats),abilities:ge(i.abilities),conditions:Array.isArray(i.conditions)?i.conditions.map(String).filter(Boolean):[]}}return{id:n,name:e.name||n,color:e.color||t.color,sections:r}}function W(...e){let t=new Map;for(let n of e)for(let e of n){let n=U(e);t.set(n.id,n)}return[...t.values()]}function G(e){let t=e?.backgroundModel;return{skyColor:e?.skyColor||a.skyColor,fogColor:e?.fogColor||a.fogColor,groundColor:e?.groundColor||a.groundColor,groundTextureUrl:e?.groundTextureUrl||``,ambientIntensity:Math.max(0,Math.min(4,P(e?.ambientIntensity,a.ambientIntensity))),sunIntensity:Math.max(0,Math.min(6,P(e?.sunIntensity,a.sunIntensity))),windStrength:Math.max(0,Math.min(3,P(e?.windStrength,a.windStrength))),windSpeed:Math.max(0,Math.min(4,P(e?.windSpeed,a.windSpeed))),backgroundModel:{modelUrl:typeof t?.modelUrl==`string`?t.modelUrl:``,modelFileName:typeof t?.modelFileName==`string`?t.modelFileName:``,fitToMap:t?.fitToMap??!0,scale:Math.max(.01,Math.min(20,P(t?.scale,1))),rotation:P(t?.rotation,0),offsetY:Math.max(-20,Math.min(20,P(t?.offsetY,0)))}}}function K(e){let n=t[0],r=e.id||A(e.name||n.name);return{id:r,name:e.name||r,surfaceEffect:B(e.surfaceEffect??n.surfaceEffect),grassDensity:Math.max(0,Math.min(30,P(e.grassDensity,n.grassDensity??0))),grassHeightMin:Math.max(.01,Math.min(.3,P(e.grassHeightMin,n.grassHeightMin??.03))),grassHeightMax:Math.max(.01,Math.min(.35,P(e.grassHeightMax,n.grassHeightMax??.095))),grassColors:H(e.grassColors,n.grassColors??[]),topColor:e.topColor||n.topColor,sideColor:e.sideColor||n.sideColor,sideCapColor:e.sideCapColor||e.sideColor||n.sideCapColor,sideFullColor:e.sideFullColor||e.sideColor||n.sideFullColor,sideHalfColor:e.sideHalfColor||e.sideColor||n.sideHalfColor,topImageUrl:typeof e.topImageUrl==`string`?e.topImageUrl:``,sideImageUrl:typeof e.sideImageUrl==`string`?e.sideImageUrl:``,sideCapImageUrl:typeof e.sideCapImageUrl==`string`?e.sideCapImageUrl:typeof e.sideImageUrl==`string`?e.sideImageUrl:``,sideFullImageUrl:typeof e.sideFullImageUrl==`string`?e.sideFullImageUrl:typeof e.sideImageUrl==`string`?e.sideImageUrl:``,sideHalfImageUrl:typeof e.sideHalfImageUrl==`string`?e.sideHalfImageUrl:typeof e.sideImageUrl==`string`?e.sideImageUrl:``,topRule:e.topRule||``,sideRule:e.sideRule||``,movementCost:Math.max(1,Math.min(9,P(e.movementCost,1))),blocksLineOfSight:!!e.blocksLineOfSight}}function q(...e){let t=new Map;for(let n of e)for(let e of n){let n=K(e);t.set(n.id,n)}return[...t.values()]}function ve(e){let t=r[0],n=e.id||j(e.name||t.name),i=e.role===`cover`||e.role===`decor`||e.role===`blocker`?e.role:t.role;return{id:n,name:e.name||n,role:i,assetKind:e.assetKind===`glb`?`glb`:`box`,windEffect:!!(e.windEffect??t.windEffect),emitsLight:!!(e.emitsLight??t.emitsLight),lightColor:V(e.lightColor)?e.lightColor:t.lightColor||`#ffb85c`,lightIntensity:Math.max(0,Math.min(8,P(e.lightIntensity,t.lightIntensity??1.4))),lightRange:Math.max(.5,Math.min(16,P(e.lightRange,t.lightRange??4))),lightOffsetY:Math.max(0,Math.min(5,P(e.lightOffsetY,t.lightOffsetY??t.height))),color:e.color||t.color,textureUrl:typeof e.textureUrl==`string`?e.textureUrl:``,modelUrl:typeof e.modelUrl==`string`?e.modelUrl:``,modelFileName:typeof e.modelFileName==`string`?e.modelFileName:``,fitModelToTile:e.fitModelToTile??!0,width:Math.max(.1,Math.min(3,P(e.width,t.width))),height:Math.max(.1,Math.min(4,P(e.height,t.height))),depth:Math.max(.1,Math.min(3,P(e.depth,t.depth))),blocksMovement:e.blocksMovement??i!==`decor`,blocksLineOfSight:!!e.blocksLineOfSight,coverBonus:Math.max(0,Math.min(9,P(e.coverBonus,+(i===`cover`)))),notes:Array.isArray(e.notes)?e.notes.map(String).filter(Boolean):[]}}function J(...e){let t=new Map;for(let n of e)for(let e of n){let n=ve(e);t.set(n.id,n)}return[...t.values()]}function ye(e,t,n,r){let i=e.trigger===`tileEnter`||e.trigger===`levelComplete`?e.trigger:`levelStart`,a=e.presentation===`screen`?`screen`:`dialog`,o={id:String(e.id||`story-${t+1}`),trigger:i,presentation:a,title:String(e.title??``),speaker:String(e.speaker??``),text:String(e.text||`New story beat`),avatarUrl:typeof e.avatarUrl==`string`?e.avatarUrl:``};return i===`tileEnter`&&(o.x=Math.max(0,Math.min(Math.max(0,n-1),Math.round(P(e.x,0)))),o.z=Math.max(0,Math.min(Math.max(0,r-1),Math.round(P(e.z,0))))),o}function Y(e){let t=Array.isArray(e.units)?e.units.map(e=>({...e,aiBehavior:e.team===`enemy`?F(e.aiBehavior):void 0,conditions:Array.isArray(e.conditions)?e.conditions.map(e=>({id:String(e.id??``),turns:Math.max(0,Math.min(12,P(e.turns,0))),stacks:Math.max(1,Math.min(9,P(e.stacks,1))),source:e.source})).filter(e=>e.id):[]})):[];return{...e,environment:G(e.environment),obstacles:Array.isArray(e.obstacles)?e.obstacles.map(e=>({...e,rotation:_e(e.rotation)})):[],surroundings:Array.isArray(e.surroundings)?e.surroundings:[],units:t,initiativeOrder:I(t,e.initiativeOrder),story:Array.isArray(e.story)?e.story.map((t,n)=>ye(t,n,e.width,e.depth)):[]}}function X(e,t){let n=c.titleScreen;return{kicker:e?.kicker||n?.kicker||`Voxel tactics prototype`,headline:e?.headline||n?.headline||`Craft Heroes`,subhead:e?.subhead||n?.subhead||`Rotate class faces, chain handmade levels, and test the build language for a Steam-ready tactics pitch.`,backgroundLevelId:e?.backgroundLevelId||n?.backgroundLevelId||t,cameraOrbit:e?.cameraOrbit??n?.cameraOrbit??!0,orbitSpeed:Math.max(.01,Math.min(.4,P(e?.orbitSpeed,n?.orbitSpeed??.08))),mockBattle:e?.mockBattle??n?.mockBattle??!0}}function be(e,t){let n=p.conditions[t]??p.conditions[0],r=e.name||n.name||`Condition ${t+1}`,i=C.includes(e.kind)?e.kind:n.kind;return{id:e.id||R(r,`condition`),name:r,kind:i,icon:(e.icon||r.slice(0,2)||`FX`).toUpperCase().slice(0,3),color:V(e.color)?e.color:n.color,duration:Math.max(0,Math.min(12,P(e.duration,n.duration))),stackable:!!(e.stackable??n.stackable),hidden:!!(e.hidden??n.hidden),description:e.description||n.description||``,modifiers:L(e.modifiers??n.modifiers),effect:e.effect||``}}function Z(e){let t=Array.isArray(e?.conditions)?e.conditions:p.conditions;return{initiative:{base:Math.max(0,Math.min(50,P(e?.initiative?.base,p.initiative.base))),headWeight:Math.max(0,Math.min(5,P(e?.initiative?.headWeight,p.initiative.headWeight))),bodyWeight:Math.max(0,Math.min(5,P(e?.initiative?.bodyWeight,p.initiative.bodyWeight))),legsWeight:Math.max(0,Math.min(5,P(e?.initiative?.legsWeight,p.initiative.legsWeight))),heightWeight:Math.max(0,Math.min(5,P(e?.initiative?.heightWeight,p.initiative.heightWeight))),conditionWeight:Math.max(0,Math.min(5,P(e?.initiative?.conditionWeight,p.initiative.conditionWeight))),random:Math.max(0,Math.min(10,P(e?.initiative?.random,p.initiative.random))),tieBreaker:e?.initiative?.tieBreaker===`enemy`||e?.initiative?.tieBreaker===`higherHp`?e.initiative.tieBreaker:p.initiative.tieBreaker},conditions:t.map((e,t)=>be(e,t))}}function Q(e,t){let n=new Set(t.map(e=>e.id)),r=Array.isArray(e.levels)&&e.levels.length>0?e.levels.filter(e=>typeof e.id==`string`&&e.id).map(e=>({id:e.id,file:e.file||`levels/${e.id}.json`,next:Array.isArray(e.next)?e.next.filter(e=>typeof e==`string`&&e):[]})):t.map((e,n)=>({id:e.id,file:`levels/${e.id}.json`,next:t[n+1]?[t[n+1].id]:[]})),i=new Set(r.map(e=>e.id));for(let e of t)i.has(e.id)||r.push({id:e.id,file:`levels/${e.id}.json`,next:e.links[0]?.to?[e.links[0].to]:[]});let a=t[0]?.id??c.startLevel,o=n.has(e.startLevel)?e.startLevel:r[0]?.id??a;return{...e,id:e.id||c.id,title:e.title||c.title,startLevel:o,titleScreen:X(e.titleScreen,o),gameplay:Z(e.gameplay),levels:r}}function xe(){let e=N(ce);return Array.isArray(e)&&e.length>0?W(d,e):d.map(e=>structuredClone(e))}function Se(){let e=N(le);return Array.isArray(e)&&e.length>0?q(t,e):t.map(e=>structuredClone(e))}function Ce(){let e=N(ue);return Array.isArray(e)&&e.length>0?J(r,e):r.map(e=>structuredClone(e))}function we(){let e=N(E);return Array.isArray(e)&&e.length>0?e.map(e=>structuredClone(e)):o.map(e=>structuredClone(e))}function $(e){return e.join(`; `)}function Te(e){return e.map(e=>[e.name,e.trigger,e.icon,e.color,e.description,e.effect].map(e=>e.trim()).join(` | `)).join(`
`)}function Ee(e,t=[]){let n=e.split(/[;\n]+/).map(e=>e.trim()).filter(Boolean);return n.length===0?t:n.map((e,t)=>{let[n=`Ability ${t+1}`,r=`passive`,i=``,a=`#60d7e4`,o=``,s=``]=e.split(`|`).map(e=>e.trim());return z({id:R(n,`ability`),name:n,trigger:S.includes(r)?r:`passive`,icon:i,color:a,description:o,effect:s},t)})}function De(e){return e.split(/[,;\n]+/).map(e=>e.trim()).filter(Boolean)}function Oe(e){return e.map(e=>[e.name,e.kind,e.icon,e.color,String(e.duration),e.stackable?`stack`:`single`,e.hidden?`hidden`:`shown`,me(e.modifiers),e.effect,e.description].map(e=>e.trim()).join(` | `)).join(`
`)}function ke(e,t){let n=e.split(`
`).map(e=>e.trim()).filter(Boolean);return n.length===0?t:n.map((e,t)=>{let[n=`Condition ${t+1}`,r=`status`,i=``,a=`#60d7e4`,o=`1`,s=`single`,c=`shown`,l=``,u=``,d=``]=e.split(`|`).map(e=>e.trim());return be({id:R(n,`condition`),name:n,kind:C.includes(r)?r:`status`,icon:i,color:a,duration:P(o,1),stackable:/^stack/i.test(s),hidden:/^hidden/i.test(c),modifiers:he(l),effect:u,description:d},t)})}var Ae=class{constructor(e){s(this,`root`,void 0),s(this,`canvas`,void 0),s(this,`scene`,void 0),s(this,`panel`,void 0),s(this,`utility`,void 0),s(this,`levels`,n.map(e=>Y(m(e)))),s(this,`campaign`,Q(structuredClone(c),this.levels)),s(this,`templates`,we()),s(this,`classDefinitions`,xe()),s(this,`environmentMaterials`,Se()),s(this,`propDefinitions`,Ce()),s(this,`state`,{mode:`editor`,tool:`select`,terrain:this.environmentMaterials[0].id,obstacle:this.propDefinitions[0].id,team:`enemy`,templateId:this.templates[1]?.id??this.templates[0].id,classId:this.classDefinitions[0].id,levelId:c.startLevel,propRotationSteps:0,storyDraft:{trigger:`levelStart`,presentation:`dialog`,title:``,speaker:``,text:``,avatarUrl:``,x:0,z:0}}),this.root=e,this.root.className=`app-shell`,this.root.innerHTML=`
      <canvas class="world-canvas" aria-label="Craft Heroes level editor viewport"></canvas>
      <aside class="editor-panel"></aside>
      <div class="utility-layer"></div>
      <div class="status-chip" id="status-chip"></div>
    `,this.canvas=this.root.querySelector(`.world-canvas`),this.panel=this.root.querySelector(`.editor-panel`),this.utility=this.root.querySelector(`.utility-layer`),this.loadStoredProject(),this.scene=new f(this.canvas,this.classDefinitions,this.environmentMaterials,this.propDefinitions),this.scene.onTileClick(e=>this.handleTileClick(e)),this.render(!0)}currentLevel(){return Y(this.levels.find(e=>e.id===this.state.levelId)??this.levels[0])}setCurrentLevel(e){let t=Y(e);this.levels=this.levels.map(e=>e.id===t.id?t:e)}selectedTemplate(){return this.templates.find(e=>e.id===this.state.templateId)??this.templates[0]}selectedClass(){return this.classDefinitions.find(e=>e.id===this.state.classId)??this.classDefinitions[0]}selectedMaterial(){return this.environmentMaterials.find(e=>e.id===this.state.terrain)??this.environmentMaterials[0]}selectedProp(){return this.propDefinitions.find(e=>e.id===this.state.obstacle)??this.propDefinitions[0]}selectedUnit(e=this.currentLevel()){if(this.state.selected)return e.units.find(e=>e.x===this.state.selected?.x&&e.z===this.state.selected?.z)}aiBehaviorOptions(e=`straight-offense`){return w.map(t=>`<option value="${t.id}" ${t.id===e?`selected`:``}>${D(t.label)}</option>`).join(``)}initiativePosition(e,t){return(e.initiativeOrder??e.units.map(e=>e.id)).indexOf(t)}loadStoredProject(){let n=N(e);if(!n)return;n.levels?.length?this.levels=n.levels.map(e=>Y(e)):n.level&&(this.levels=[Y(n.level)]),n.campaign&&(this.campaign=Q(n.campaign,this.levels));let i=n.terrainMaterials??n.environmentMaterials;i?.length&&(this.environmentMaterials=q(t,i));let a=n.props??n.propDefinitions;a?.length&&(this.propDefinitions=J(r,a));let o=n.classes??n.classDefinitions;o?.length&&(this.classDefinitions=W(d,o)),n.templates?.length&&(this.templates=n.templates.map(e=>structuredClone(e))),this.state.levelId=this.levels.find(e=>e.id===this.campaign.startLevel)?.id??this.levels[0]?.id??this.state.levelId,this.state.templateId=this.templates[1]?.id??this.templates[0]?.id??this.state.templateId,this.state.classId=this.classDefinitions[0]?.id??this.state.classId,this.state.terrain=this.environmentMaterials[0]?.id??this.state.terrain,this.state.obstacle=this.propDefinitions[0]?.id??this.state.obstacle}editorBundle(){return{campaign:this.campaign,levels:this.levels,level:this.currentLevel(),templates:this.templates,classes:this.classDefinitions,terrainMaterials:this.environmentMaterials,props:this.propDefinitions}}editorJson(){return JSON.stringify(this.editorBundle(),null,2)}emptyStoryDraft(){return{trigger:`levelStart`,presentation:`dialog`,title:``,speaker:``,text:``,avatarUrl:``,x:0,z:0}}storyDraftFromBeat(e){return{editingId:e.id,trigger:e.trigger,presentation:e.presentation,title:e.title,speaker:e.speaker,text:e.text,avatarUrl:e.avatarUrl??``,x:Math.max(0,Math.round(P(e.x,0))),z:Math.max(0,Math.round(P(e.z,0)))}}editorPreviewBundle(){return{...this.editorBundle(),campaign:{...this.campaign,startLevel:this.state.levelId,titleScreen:{...X(this.campaign.titleScreen,this.state.levelId),backgroundLevelId:this.state.levelId}}}}openClientPreview(){this.syncStoryDraftFromPanel();let t={version:1,source:`editor`,timestamp:Date.now(),campaignId:this.campaign.id,startLevelId:this.state.levelId,content:this.editorPreviewBundle()};localStorage.setItem(e,this.editorJson()),localStorage.setItem(u,JSON.stringify(t)),localStorage.removeItem(i(this.campaign.id));let n=new URL(`client.html`,window.location.href);n.searchParams.set(`preview`,`editor`),n.searchParams.set(`level`,this.state.levelId),n.searchParams.set(`t`,String(t.timestamp)),window.location.href=n.href}levelOptions(e,t=!1){return`${t?`<option value="">Campaign End</option>`:``}${this.levels.map(t=>`<option value="${D(t.id)}" ${t.id===e?`selected`:``}>${D(t.name)}</option>`).join(``)}`}downloadJsonFile(e,t){let n=new Blob([t],{type:`application/json`}),r=document.createElement(`a`);r.href=URL.createObjectURL(n),r.download=e,document.body.append(r),r.click(),r.remove(),URL.revokeObjectURL(r.href)}openUtility(e){this.utility.className=`utility-layer open`,this.utility.innerHTML=e,this.utility.querySelectorAll(`[data-utility-action]`).forEach(e=>{e.addEventListener(`click`,()=>this.handleUtilityAction(e.dataset.utilityAction??``,e.dataset.levelId))}),this.utility.onclick=e=>{e.target===this.utility&&this.closeUtility()}}closeUtility(){this.utility.className=`utility-layer`,this.utility.innerHTML=``}openLevelFlowEditor(){let e=this.levels.some(e=>e.id===this.campaign.startLevel)?this.campaign.startLevel:this.levels[0].id;this.openUtility(`
      <div class="utility-modal flow-modal" role="dialog" aria-modal="true" aria-label="Level flow editor">
        <div class="utility-head">
          <div>
            <span>Campaign Utility</span>
            <h2>Level Flow</h2>
          </div>
          <button data-utility-action="close">Close</button>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Campaign ID</span>
            <input data-flow-campaign="id" type="text" value="${D(this.campaign.id)}">
          </label>
          <label class="field">
            <span>Campaign Title</span>
            <input data-flow-campaign="title" type="text" value="${D(this.campaign.title)}">
          </label>
          <label class="field">
            <span>Start Level</span>
            <select data-flow-campaign="startLevel">${this.levelOptions(e)}</select>
          </label>
          <label class="field">
            <span>Total Missions</span>
            <input type="text" value="${this.levels.length}" disabled>
          </label>
        </div>
        <div class="flow-list">
          ${this.levels.map((e,t)=>{let n=this.campaign.levels.find(t=>t.id===e.id)?.next[0]??``,r=e.links[0]?.to??n;return`
                <div class="flow-row" data-flow-row data-level-id="${D(e.id)}">
                  <strong>${t+1}</strong>
                  <label>
                    <span>Name</span>
                    <input data-flow-field="name" type="text" value="${D(e.name)}">
                  </label>
                  <label>
                    <span>ID</span>
                    <input data-flow-field="id" type="text" value="${D(e.id)}">
                  </label>
                  <label>
                    <span>Next</span>
                    <select data-flow-field="next">${this.levelOptions(r,!0)}</select>
                  </label>
                  <button data-utility-action="open-level" data-level-id="${D(e.id)}">Open</button>
                </div>
              `}).join(``)}
        </div>
        <div class="utility-actions">
          <button data-utility-action="add-flow-level">Add Blank Level</button>
          <button data-utility-action="apply-flow">Apply Flow</button>
        </div>
      </div>
    `)}openTitleEditor(){let e=X(this.campaign.titleScreen,this.campaign.startLevel);this.openUtility(`
      <div class="utility-modal title-editor-modal" role="dialog" aria-modal="true" aria-label="Title screen editor">
        <div class="utility-head">
          <div>
            <span>Client Utility</span>
            <h2>Title Screen</h2>
          </div>
          <button data-utility-action="close">Close</button>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Kicker</span>
            <input data-title-field="kicker" type="text" value="${D(e.kicker)}">
          </label>
          <label class="field">
            <span>Headline</span>
            <input data-title-field="headline" type="text" value="${D(e.headline)}">
          </label>
          <label class="field title-wide">
            <span>Subtitle</span>
            <textarea class="story-textarea" data-title-field="subhead">${D(e.subhead)}</textarea>
          </label>
          <label class="field">
            <span>Backdrop Level</span>
            <select data-title-field="backgroundLevelId">${this.levelOptions(e.backgroundLevelId)}</select>
          </label>
          <label class="field">
            <span>Orbit Speed</span>
            <input data-title-field="orbitSpeed" type="number" min="0.01" max="0.4" step="0.01" value="${e.orbitSpeed}">
          </label>
        </div>
        <label class="check-row">
          <input data-title-field="cameraOrbit" type="checkbox" ${e.cameraOrbit?`checked`:``}>
          <span>Slowly orbit the selected backdrop level while the title menu is open.</span>
        </label>
        <label class="check-row">
          <input data-title-field="mockBattle" type="checkbox" ${e.mockBattle?`checked`:``}>
          <span>Loop class-based move, attack, and rotate callouts over the title scene.</span>
        </label>
        <div class="title-preview-note">
          <strong>Visual editing loop</strong>
          <span>Open the backdrop level here, edit it with the normal terrain, unit, prop, and story tools, then export the campaign JSON.</span>
        </div>
        <div class="utility-actions">
          <button data-utility-action="preview-title-level">Open Backdrop Level</button>
          <button data-utility-action="apply-title">Apply Title Screen</button>
        </div>
      </div>
    `)}openGameplayRulesEditor(){let e=Z(this.campaign.gameplay),t=[`player`,`enemy`,`higherHp`].map(t=>`<option value="${t}" ${e.initiative.tieBreaker===t?`selected`:``}>${t}</option>`).join(``);this.openUtility(`
      <div class="utility-modal rules-editor-modal" role="dialog" aria-modal="true" aria-label="Gameplay rules editor">
        <div class="utility-head">
          <div>
            <span>Gameplay Utility</span>
            <h2>Gameplay Rules</h2>
          </div>
          <button data-utility-action="close">Close</button>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Initiative Base</span>
            <input data-rules-field="base" type="number" min="0" max="50" step="1" value="${e.initiative.base}">
          </label>
          <label class="field">
            <span>Head Weight</span>
            <input data-rules-field="headWeight" type="number" min="0" max="5" step="0.05" value="${e.initiative.headWeight}">
          </label>
          <label class="field">
            <span>Body Weight</span>
            <input data-rules-field="bodyWeight" type="number" min="0" max="5" step="0.05" value="${e.initiative.bodyWeight}">
          </label>
          <label class="field">
            <span>Legs Weight</span>
            <input data-rules-field="legsWeight" type="number" min="0" max="5" step="0.05" value="${e.initiative.legsWeight}">
          </label>
          <label class="field">
            <span>Height Weight</span>
            <input data-rules-field="heightWeight" type="number" min="0" max="5" step="0.05" value="${e.initiative.heightWeight}">
          </label>
          <label class="field">
            <span>Condition Weight</span>
            <input data-rules-field="conditionWeight" type="number" min="0" max="5" step="0.05" value="${e.initiative.conditionWeight}">
          </label>
          <label class="field">
            <span>Random Bonus</span>
            <input data-rules-field="random" type="number" min="0" max="10" step="1" value="${e.initiative.random}">
          </label>
          <label class="field">
            <span>Tie Breaker</span>
            <select data-rules-field="tieBreaker">${t}</select>
          </label>
          <label class="field title-wide">
            <span>Condition Library</span>
            <textarea class="story-textarea rules-textarea" data-rules-field="conditions">${D(Oe(e.conditions))}</textarea>
          </label>
        </div>
        <div class="title-preview-note">
          <strong>Condition row format</strong>
          <span>Name | kind | icon | color | duration | stack/single | hidden/shown | attack:1;defense:-1;initiative:2 | effectKey:1 | Description</span>
        </div>
        <div class="utility-actions">
          <button data-utility-action="apply-rules">Apply Rules</button>
        </div>
      </div>
    `)}handleUtilityAction(e,t){if(e===`close`)this.closeUtility();else if(e===`open-level`&&t)this.state.levelId=t,this.state.selected=void 0,this.render(!0),this.flash(`Opened ${this.currentLevel().name}.`);else if(e===`add-flow-level`)this.addBlankLevel(),this.openLevelFlowEditor(),this.flash(`Added a blank level to the flow.`);else if(e===`apply-flow`)this.applyLevelFlowEditor();else if(e===`apply-title`)this.applyTitleEditor();else if(e===`apply-rules`)this.applyGameplayRulesEditor();else if(e===`preview-title-level`){let e=this.utility.querySelector(`[data-title-field='backgroundLevelId']`)?.value;e&&this.levels.some(t=>t.id===e)&&(this.state.levelId=e,this.state.selected=void 0,this.render(!0),this.flash(`Opened the title backdrop level for visual editing.`))}}addBlankLevel(){let e=this.uniqueLevelId(`level-${this.levels.length+1}`),t=`New Level ${this.levels.length+1}`,n=Y({id:e,name:t,width:10,depth:8,environment:structuredClone(a),tiles:l(10,8),obstacles:[],surroundings:[],units:[],objectives:[{type:`defeatTeam`,team:`enemy`}],links:[],story:[]}),r=this.levels[this.levels.length-1];r&&r.links.length===0&&(r.links=[{id:`${r.id}-next`,label:`Continue to ${t}`,to:e}]),this.levels.push(n);let i=this.campaign.levels[this.campaign.levels.length-1];i&&i.next.length===0&&(i.next=[e]),this.campaign.levels.push({id:e,file:`levels/${e}.json`,next:[]}),this.state.levelId=e,this.state.selected=void 0,this.render(!0)}applyLevelFlowEditor(){let e=[...this.utility.querySelectorAll(`[data-flow-row]`)];if(e.length===0)return;let t=new Map,n=new Set;for(let r of e){let e=r.dataset.levelId??``,i=r.querySelector(`[data-flow-field='name']`)?.value.trim()||`Level`,a=M(r.querySelector(`[data-flow-field='id']`)?.value.trim()||i),o=a,s=2;for(;n.has(o);)o=`${a}-${s}`,s+=1;n.add(o),t.set(e,o)}let r=e.map(e=>{let n=e.dataset.levelId??``,r=this.levels.find(e=>e.id===n)??this.currentLevel(),i=e.querySelector(`[data-flow-field='name']`)?.value.trim()||r.name,a=t.get(n)??r.id,o=e.querySelector(`[data-flow-field='next']`)?.value??``,s=o?t.get(o)??o:``;return Y({...r,id:a,name:i,links:s?[{id:`${a}-next`,label:`Continue to ${s}`,to:s}]:[]})}),i=new Map(r.map(e=>[e.id,e.name])),a=r.map(e=>({...e,links:e.links.map(e=>({...e,label:`Continue to ${i.get(e.to)??e.to}`}))})),o=this.utility.querySelector(`[data-flow-campaign='id']`),s=this.utility.querySelector(`[data-flow-campaign='title']`),c=this.utility.querySelector(`[data-flow-campaign='startLevel']`),l=t.get(c?.value??``)??r[0].id,u=X(this.campaign.titleScreen,l);u.backgroundLevelId=t.get(u.backgroundLevelId)??u.backgroundLevelId,a.some(e=>e.id===u.backgroundLevelId)||(u.backgroundLevelId=l),this.levels=a,this.campaign={...this.campaign,id:M(o?.value||this.campaign.id),title:s?.value.trim()||this.campaign.title,startLevel:l,titleScreen:u,levels:a.map(e=>({id:e.id,file:`levels/${e.id}.json`,next:e.links[0]?.to?[e.links[0].to]:[]}))},this.state.levelId=t.get(this.state.levelId)??l,this.state.selected=void 0,this.closeUtility(),this.render(!0),this.flash(`Updated campaign flow.`)}applyTitleEditor(){let e=e=>this.utility.querySelector(`[data-title-field='${e}']`),t=e(`backgroundLevelId`)?.value||this.campaign.startLevel;this.campaign={...this.campaign,titleScreen:{kicker:e(`kicker`)?.value.trim()||`Voxel tactics prototype`,headline:e(`headline`)?.value.trim()||`Craft Heroes`,subhead:e(`subhead`)?.value.trim()||`Rotate class faces, chain handmade levels, and test the build language for a Steam-ready tactics pitch.`,backgroundLevelId:t,cameraOrbit:e(`cameraOrbit`)?.checked??!0,orbitSpeed:Math.max(.01,Math.min(.4,P(e(`orbitSpeed`)?.value,.08))),mockBattle:e(`mockBattle`)?.checked??!0}},this.closeUtility(),this.updatePanel(),this.flash(`Updated title screen settings.`)}applyGameplayRulesEditor(){let e=e=>this.utility.querySelector(`[data-rules-field='${e}']`),t=Z(this.campaign.gameplay),n=e(`tieBreaker`)?.value,r=n===`enemy`||n===`higherHp`||n===`player`?n:t.initiative.tieBreaker,i=e(`conditions`)?.value??Oe(t.conditions);this.campaign={...this.campaign,gameplay:Z({initiative:{base:P(e(`base`)?.value,t.initiative.base),headWeight:P(e(`headWeight`)?.value,t.initiative.headWeight),bodyWeight:P(e(`bodyWeight`)?.value,t.initiative.bodyWeight),legsWeight:P(e(`legsWeight`)?.value,t.initiative.legsWeight),heightWeight:P(e(`heightWeight`)?.value,t.initiative.heightWeight),conditionWeight:P(e(`conditionWeight`)?.value,t.initiative.conditionWeight),random:P(e(`random`)?.value,t.initiative.random),tieBreaker:r},conditions:ke(i,t.conditions)})},this.closeUtility(),this.updatePanel(),this.flash(`Updated gameplay rules.`)}propRotationAngle(){return this.state.propRotationSteps*(Math.PI/2)}propRotationLabel(){return`${this.state.propRotationSteps*90} deg`}uniqueTemplateId(e){let t=de(e),n=t,r=2;for(;this.templates.some(e=>e.id===n);)n=`${t}-${r}`,r+=1;return n}uniqueClassId(e){let t=k(e),n=t,r=2;for(;this.classDefinitions.some(e=>e.id===n);)n=`${t}-${r}`,r+=1;return n}uniqueMaterialId(e){let t=A(e),n=t,r=2;for(;this.environmentMaterials.some(e=>e.id===n);)n=`${t}-${r}`,r+=1;return n}uniquePropId(e){let t=j(e),n=t,r=2;for(;this.propDefinitions.some(e=>e.id===n);)n=`${t}-${r}`,r+=1;return n}uniqueLevelId(e){let t=M(e),n=t,r=2;for(;this.levels.some(e=>e.id===n);)n=`${t}-${r}`,r+=1;return n}classOptions(e){return this.classDefinitions.map(t=>`<option value="${D(t.id)}" ${t.id===e?`selected`:``}>${D(t.name)}</option>`).join(``)}materialOptions(e){return this.environmentMaterials.map(t=>`<option value="${D(t.id)}" ${t.id===e?`selected`:``}>${D(t.name)}</option>`).join(``)}propOptions(e){return this.propDefinitions.map(t=>`<option value="${D(t.id)}" ${t.id===e?`selected`:``}>${D(t.name)}</option>`).join(``)}readBuildDraft(e=this.state.templateId){let t=this.selectedTemplate(),n=this.panel.querySelector(`[data-build='name']`),r=this.panel.querySelector(`[data-build='hp']`),i=structuredClone(t.faces);for(let e of x)for(let t=0;t<b.length;t+=1){let n=this.panel.querySelector(`[data-face-section='${e}'][data-face-index='${t}']`);i[e][t]=n?.value??i[e][t]}return{id:e,name:n?.value.trim()||t.name,hp:Math.max(1,Math.min(99,Number(r?.value||t.hp))),faces:i}}readClassDraft(e=this.state.classId){let t=this.selectedClass(),n=this.panel.querySelector(`[data-class='name']`),r=this.panel.querySelector(`[data-class='color']`),i=structuredClone(t.sections);for(let e of x){for(let t of T){let n=P(this.panel.querySelector(`[data-class-section='${e}'][data-stat='${t.key}']`)?.value,i[e].stats[t.key]);i[e].stats[t.key]=Math.max(0,Math.min(12,n))}let t=this.panel.querySelector(`[data-class-section='${e}'][data-ability]`),n=this.panel.querySelector(`[data-class-section='${e}'][data-condition]`);i[e].abilities=Ee(t?.value??Te(i[e].abilities),i[e].abilities),i[e].conditions=De(n?.value??$(i[e].conditions))}return U({id:e,name:n?.value.trim()||t.name,color:r?.value||t.color,sections:i})}replaceClassDefinition(e){this.classDefinitions=this.classDefinitions.map(t=>t.id===e.id?e:t),this.scene.setClassDefinitions(this.classDefinitions)}readMaterialDraft(e=this.state.terrain){let t=this.selectedMaterial(),n=this.panel.querySelector(`[data-material='name']`),r=this.panel.querySelector(`[data-material='topColor']`),i=this.panel.querySelector(`[data-material='sideColor']`),a=this.panel.querySelector(`[data-material='sideCapColor']`),o=this.panel.querySelector(`[data-material='sideFullColor']`),s=this.panel.querySelector(`[data-material='sideHalfColor']`),c=this.panel.querySelector(`[data-material='surfaceEffect']`),l=this.panel.querySelector(`[data-material='grassDensity']`),u=this.panel.querySelector(`[data-material='grassHeightMin']`),d=this.panel.querySelector(`[data-material='grassHeightMax']`),f=[...this.panel.querySelectorAll(`[data-material-grass-color]`)],p=this.panel.querySelector(`[data-material='movementCost']`),m=this.panel.querySelector(`[data-material='blocksLineOfSight']`),h=this.panel.querySelector(`[data-material='topRule']`),g=this.panel.querySelector(`[data-material='sideRule']`);return K({...t,id:e,name:n?.value.trim()||t.name,topColor:r?.value||t.topColor,sideColor:i?.value||t.sideColor,sideCapColor:a?.value||t.sideCapColor,sideFullColor:o?.value||t.sideFullColor,sideHalfColor:s?.value||t.sideHalfColor,surfaceEffect:B(c?.value??t.surfaceEffect),grassDensity:P(l?.value,t.grassDensity),grassHeightMin:P(u?.value,t.grassHeightMin),grassHeightMax:P(d?.value,t.grassHeightMax),grassColors:H(f.map(e=>e.value),t.grassColors),topRule:h?.value.trim()||t.topRule,sideRule:g?.value.trim()||t.sideRule,movementCost:P(p?.value,t.movementCost),blocksLineOfSight:!!m?.checked})}replaceMaterialDefinition(e){this.environmentMaterials=this.environmentMaterials.map(t=>t.id===e.id?e:t),this.scene.setEnvironmentMaterials(this.environmentMaterials)}readPropDraft(e=this.state.obstacle){let t=this.selectedProp(),n=this.panel.querySelector(`[data-prop='name']`),r=this.panel.querySelector(`[data-prop='role']`),i=this.panel.querySelector(`[data-prop='assetKind']`),a=this.panel.querySelector(`[data-prop='color']`),o=this.panel.querySelector(`[data-prop='width']`),s=this.panel.querySelector(`[data-prop='height']`),c=this.panel.querySelector(`[data-prop='depth']`),l=this.panel.querySelector(`[data-prop='blocksMovement']`),u=this.panel.querySelector(`[data-prop='blocksLineOfSight']`),d=this.panel.querySelector(`[data-prop='coverBonus']`),f=this.panel.querySelector(`[data-prop='fitModelToTile']`),p=this.panel.querySelector(`[data-prop='windEffect']`),m=this.panel.querySelector(`[data-prop='emitsLight']`),h=this.panel.querySelector(`[data-prop='lightColor']`),g=this.panel.querySelector(`[data-prop='lightIntensity']`),ee=this.panel.querySelector(`[data-prop='lightRange']`),te=this.panel.querySelector(`[data-prop='lightOffsetY']`),_=this.panel.querySelector(`[data-prop='notes']`);return ve({...t,id:e,name:n?.value.trim()||t.name,role:r?.value??t.role,assetKind:i?.value??t.assetKind,color:a?.value||t.color,width:P(o?.value,t.width),height:P(s?.value,t.height),depth:P(c?.value,t.depth),blocksMovement:!!l?.checked,blocksLineOfSight:!!u?.checked,coverBonus:P(d?.value,t.coverBonus),fitModelToTile:f?.checked??t.fitModelToTile,windEffect:p?.checked??t.windEffect,emitsLight:m?.checked??t.emitsLight,lightColor:h?.value||t.lightColor,lightIntensity:P(g?.value,t.lightIntensity),lightRange:P(ee?.value,t.lightRange),lightOffsetY:P(te?.value,t.lightOffsetY),notes:De(_?.value??$(t.notes))})}replacePropDefinition(e){this.propDefinitions=this.propDefinitions.map(t=>t.id===e.id?e:t),this.scene.setPropDefinitions(this.propDefinitions)}readEnvironmentDraft(e){let t=this.panel.querySelector(`[data-environment='skyColor']`),n=this.panel.querySelector(`[data-environment='fogColor']`),r=this.panel.querySelector(`[data-environment='groundColor']`),i=this.panel.querySelector(`[data-environment='ambientIntensity']`),a=this.panel.querySelector(`[data-environment='sunIntensity']`),o=this.panel.querySelector(`[data-environment='windStrength']`),s=this.panel.querySelector(`[data-environment='windSpeed']`),c=this.panel.querySelector(`[data-background='scale']`),l=this.panel.querySelector(`[data-background='rotation']`),u=this.panel.querySelector(`[data-background='offsetY']`),d=this.panel.querySelector(`[data-background='fitToMap']`);return G({...e.environment,skyColor:t?.value||e.environment.skyColor,fogColor:n?.value||e.environment.fogColor,groundColor:r?.value||e.environment.groundColor,ambientIntensity:P(i?.value,e.environment.ambientIntensity),sunIntensity:P(a?.value,e.environment.sunIntensity),windStrength:P(o?.value,e.environment.windStrength),windSpeed:P(s?.value,e.environment.windSpeed),backgroundModel:{...e.environment.backgroundModel,fitToMap:d?.checked??e.environment.backgroundModel.fitToMap,scale:P(c?.value,e.environment.backgroundModel.scale),rotation:P(l?.value,e.environment.backgroundModel.rotation),offsetY:P(u?.value,e.environment.backgroundModel.offsetY)}})}readStoryDraft(){this.syncStoryDraftFromPanel();let e=this.state.storyDraft,t={id:e.editingId||`story-${Date.now()}`,trigger:e.trigger,presentation:e.presentation,title:e.title.trim(),speaker:e.speaker.trim(),text:e.text.trim()||`New story beat`,avatarUrl:e.avatarUrl.trim(),...e.trigger===`tileEnter`?{x:Math.round(P(e.x,this.state.selected?.x??0)),z:Math.round(P(e.z,this.state.selected?.z??0))}:{}};return t.avatarUrl?t:{...t,avatarUrl:``}}syncStoryDraftFromPanel(){let e=this.panel.querySelector(`[data-story='trigger']`),t=this.panel.querySelector(`[data-story='presentation']`),n=this.panel.querySelector(`[data-story='title']`),r=this.panel.querySelector(`[data-story='speaker']`),i=this.panel.querySelector(`[data-story='avatarUrl']`),a=this.panel.querySelector(`[data-story='text']`),o=this.panel.querySelector(`[data-story='x']`),s=this.panel.querySelector(`[data-story='z']`),c=e?.value===`tileEnter`||e?.value===`levelComplete`?e.value:`levelStart`,l=t?.value===`screen`?`screen`:`dialog`;this.state.storyDraft={editingId:this.state.storyDraft.editingId,trigger:c,presentation:l,title:n?.value??this.state.storyDraft.title,speaker:r?.value??this.state.storyDraft.speaker,text:a?.value??this.state.storyDraft.text,avatarUrl:i?.value??this.state.storyDraft.avatarUrl,x:Math.max(0,Math.round(P(o?.value,this.state.storyDraft.x))),z:Math.max(0,Math.round(P(s?.value,this.state.storyDraft.z)))}}setStoryDraftTile(e){this.syncStoryDraftFromPanel(),this.state.storyDraft={...this.state.storyDraft,trigger:`tileEnter`,x:e.x,z:e.z},this.state.selected=e,this.scene.setSelected(e),this.updatePanel(),this.flash(`Story tile set to ${e.x}, ${e.z}.`)}applyLevelSize(){let e=this.panel.querySelector(`[data-size='width']`),t=this.panel.querySelector(`[data-size='depth']`),n=Number(e?.value||this.currentLevel().width),r=Number(t?.value||this.currentLevel().depth),i=re(this.currentLevel(),n,r,this.state.terrain);this.setCurrentLevel(i),this.state.selected&&(this.state.selected.x>=i.width||this.state.selected.z>=i.depth)&&(this.state.selected=void 0),this.scene.setLevel(i),this.scene.setSelected(this.state.selected),this.updatePanel()}applyPropRotation(e){this.state.propRotationSteps=(e%4+4)%4;let t=this.currentLevel();if(!this.state.selected){this.updatePanel(),this.flash(`Prop rotation set to ${this.propRotationLabel()}.`);return}let n=!1,r={...t,obstacles:t.obstacles.map(e=>e.x!==this.state.selected?.x||e.z!==this.state.selected.z?e:(n=!0,{...e,rotation:this.propRotationAngle()}))};n?(this.setCurrentLevel(r),this.scene.setLevel(r),this.scene.setSelected(this.state.selected),this.flash(`Rotated selected prop to ${this.propRotationLabel()}.`)):this.flash(`Prop rotation set to ${this.propRotationLabel()}.`),this.updatePanel()}selectUnitById(e){if(!e)return;let t=this.currentLevel().units.find(t=>t.id===e);t&&(this.state.selected={x:t.x,z:t.z},this.scene.setSelected(this.state.selected),this.updatePanel())}moveInitiativeUnit(e,t){if(!e)return;let n=this.currentLevel(),r=I(n.units,n.initiativeOrder),i=r.indexOf(e),a=i+t;if(i<0||a<0||a>=r.length)return;[r[i],r[a]]=[r[a],r[i]];let o={...n,initiativeOrder:r};this.setCurrentLevel(o),this.scene.setLevel(o),this.selectUnitById(e),this.flash(`Updated initiative order.`)}updateSelectedUnitBehavior(e,t){if(!e)return;let n=this.currentLevel(),r=F(t),i=!1,a={...n,units:n.units.map(t=>t.id!==e||t.team!==`enemy`?t:(i=!0,{...t,aiBehavior:r}))};i&&(this.setCurrentLevel(a),this.scene.setLevel(a),this.updatePanel(),this.flash(`Set AI behavior to ${w.find(e=>e.id===r)?.label??r}.`))}handleTileClick(e){if(this.state.selected=e,this.state.mode===`play`){this.scene.setSelected(e),this.updatePanel();return}let t=this.currentLevel(),n=t;if(this.state.tool===`raise`)n=y(t,e,1);else if(this.state.tool===`lower`)n=y(t,e,-1);else if(this.state.tool===`paint`)n=ne(t,e,this.state.terrain);else if(this.state.tool===`obstacle`)n=ie(t,e,this.state.obstacle,this.propRotationAngle());else if(this.state.tool===`unit`){let r=this.selectedTemplate();n=ae(t,e,this.state.team,r)}else if(this.state.tool===`story`){this.setStoryDraftTile(e);return}else this.state.tool===`erase`&&(n=oe(t,e));this.setCurrentLevel(n),this.scene.setLevel(n),this.scene.setSelected(e),this.updatePanel()}render(e=!1){this.scene.setMode(this.state.mode),this.scene.setLevel(this.currentLevel(),{frame:e}),this.scene.setSelected(this.state.selected),this.updatePanel()}updatePanel(){let e=this.currentLevel(),t=se(e),n=this.selectedTemplate(),r=this.selectedClass(),i=this.selectedMaterial(),a=this.selectedProp(),o=this.state.selected?e.obstacles.find(e=>e.x===this.state.selected?.x&&e.z===this.state.selected?.z):void 0,s=this.selectedUnit(e),c=(e.initiativeOrder??e.units.map(e=>e.id)).map(t=>e.units.find(e=>e.id===t)).filter(e=>!!e),l=this.state.storyDraft,u=this.editorJson(),d=[{label:`Classes`,count:this.classDefinitions.length,details:this.classDefinitions.map(e=>e.name).join(`, `)},{label:`Builds`,count:this.templates.length,details:this.templates.map(e=>e.name).join(`, `)},{label:`Props`,count:this.propDefinitions.length,details:this.propDefinitions.map(e=>e.name).join(`, `)},{label:`Materials`,count:this.environmentMaterials.length,details:this.environmentMaterials.map(e=>e.name).join(`, `)}];this.panel.innerHTML=`
      <div class="editor-column editor-column-left">
      <div class="panel-head">
        <div>
          <h1>Craft Heroes Editor</h1>
          <p>${this.state.mode===`editor`?`Build voxel tactics levels.`:`Play-test the current level data.`}</p>
        </div>
        <div class="head-actions">
          <button data-action="open-client">Client</button>
          <button data-action="toggle-mode">${this.state.mode===`editor`?`Play`:`Edit`}</button>
        </div>
      </div>

      <label class="field">
        <span>Level</span>
        <select data-field="levelId">
          ${this.levels.map(e=>`<option value="${D(e.id)}" ${e.id===this.state.levelId?`selected`:``}>${D(e.name)}</option>`).join(``)}
        </select>
      </label>

      <section class="control-section">
        <div class="section-title">
          <strong>Board Size</strong>
          <span>Grow the map without resetting the camera.</span>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Width</span>
            <input data-size="width" type="number" min="4" max="32" step="1" value="${e.width}">
          </label>
          <label class="field">
            <span>Depth</span>
            <input data-size="depth" type="number" min="4" max="32" step="1" value="${e.depth}">
          </label>
        </div>
        <div class="button-row two">
          <button data-action="apply-size">Apply Size</button>
          <button data-action="frame-board">Frame Board</button>
        </div>
      </section>

      <div class="tool-grid">
        ${[`select`,`raise`,`lower`,`paint`,`obstacle`,`unit`,`story`,`erase`].map(e=>`<button class="${this.state.tool===e?`active`:``}" data-tool="${e}">${e}</button>`).join(``)}
      </div>

      <div class="compact-grid">
        <label class="field">
          <span>Terrain</span>
          <select data-field="terrain">
            ${this.materialOptions(this.state.terrain)}
          </select>
        </label>
        <label class="field">
          <span>Prop / Blocker</span>
          <select data-field="obstacle">
            ${this.propOptions(this.state.obstacle)}
          </select>
        </label>
        <label class="field">
          <span>Team</span>
          <select data-field="team">
            ${[`player`,`enemy`].map(e=>`<option value="${e}" ${e===this.state.team?`selected`:``}>${e}</option>`).join(``)}
          </select>
        </label>
        <label class="field">
          <span>Unit</span>
          <select data-field="templateId">
            ${this.templates.map(e=>`<option value="${D(e.id)}" ${e.id===this.state.templateId?`selected`:``}>${D(e.name)}</option>`).join(``)}
          </select>
        </label>
      </div>
      <section class="control-section">
        <div class="section-title">
          <strong>Prop Placement</strong>
          <span>${o?`Selected ${D(o.type)} @ ${o.x}, ${o.z}`:`Set rotation before placing GLB props or blockers.`}</span>
        </div>
        <div class="button-row two">
          <button data-action="rotate-prop">Rotate 90</button>
          <button data-action="reset-prop-rotation">Reset Rotation</button>
        </div>
        <div class="level-card">
          <strong>${this.propRotationLabel()}</strong>
          <span>${o?`Rotates the selected prop and future placements.`:`Applies to future prop placements.`}</span>
        </div>
      </section>

      <section class="control-section selected-unit-section">
        <div class="section-title">
          <strong>Selected Unit</strong>
          <span>${s?`${D(s.name)} at ${s.x}, ${s.z}`:`Click a placed cube to edit behavior and initiative.`}</span>
        </div>
        ${s?`
              <div class="selected-unit-card">
                <div>
                  <strong>${D(s.name)}</strong>
                  <span>${D(`${s.team} / ${s.templateId} / HP ${s.hp}`)}</span>
                </div>
                <span>${this.initiativePosition(e,s.id)+1} / ${Math.max(1,c.length)}</span>
              </div>
              ${s.team===`enemy`?`
                    <label class="field">
                      <span>AI Behavior</span>
                      <select data-selected-unit-behavior data-unit-id="${D(s.id)}">
                        ${this.aiBehaviorOptions(F(s.aiBehavior))}
                      </select>
                    </label>
                    <div class="level-card subtle-card">
                      <strong>${D(w.find(e=>e.id===F(s.aiBehavior))?.label??`Straight Offense`)}</strong>
                      <span>${D(w.find(e=>e.id===F(s.aiBehavior))?.summary??``)}</span>
                    </div>
                  `:`<div class="level-card subtle-card"><strong>Player Controlled</strong><span>This unit waits for player actions on its initiative turn.</span></div>`}
            `:`<div class="combat-empty"><strong>No Unit Selected</strong><span>Use Select, then click a player or enemy cube.</span></div>`}
        <div class="initiative-list">
          ${c.map((e,t)=>`
                <div class="initiative-editor-row ${s?.id===e.id?`active`:``}">
                  <button data-action="select-initiative-unit" data-unit-id="${D(e.id)}" title="Select ${D(e.name)}">
                    <b>${t+1}</b>
                    <span>${D(e.name)}</span>
                    <small>${D(e.team)}${e.team===`enemy`?` / ${D(w.find(t=>t.id===F(e.aiBehavior))?.label??`Straight Offense`)}`:``}</small>
                  </button>
                  <button data-action="initiative-up" data-unit-id="${D(e.id)}" ${t===0?`disabled`:``} title="Move earlier">^</button>
                  <button data-action="initiative-down" data-unit-id="${D(e.id)}" ${t===c.length-1?`disabled`:``} title="Move later">v</button>
                </div>
              `).join(``)}
        </div>
      </section>

      <section class="control-section">
        <div class="section-title">
          <strong>Environment</strong>
          <span>Sky, fog, ground, and decorative props around the board.</span>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Sky</span>
            <input data-environment="skyColor" type="color" value="${D(e.environment.skyColor)}">
          </label>
          <label class="field">
            <span>Fog</span>
            <input data-environment="fogColor" type="color" value="${D(e.environment.fogColor)}">
          </label>
          <label class="field">
            <span>Ground</span>
            <input data-environment="groundColor" type="color" value="${D(e.environment.groundColor)}">
          </label>
          <label class="field">
            <span>Ground Texture</span>
            <input data-ground-texture type="file" accept="image/*">
          </label>
          <label class="field">
            <span>Ambient</span>
            <input data-environment="ambientIntensity" type="number" min="0" max="4" step="0.1" value="${e.environment.ambientIntensity}">
          </label>
          <label class="field">
            <span>Sun</span>
            <input data-environment="sunIntensity" type="number" min="0" max="6" step="0.1" value="${e.environment.sunIntensity}">
          </label>
          <label class="field">
            <span>Wind Strength</span>
            <input data-environment="windStrength" type="number" min="0" max="3" step="0.05" value="${e.environment.windStrength}">
          </label>
          <label class="field">
            <span>Wind Speed</span>
            <input data-environment="windSpeed" type="number" min="0" max="4" step="0.05" value="${e.environment.windSpeed}">
          </label>
        </div>
        <div class="button-row two">
          <button data-action="update-environment">Update Environment</button>
          <button data-action="clear-ground-texture">Clear Ground Texture</button>
        </div>
        <div class="asset-preview-head">
          <div>
            <strong>Background GLB</strong>
            <span>${D(e.environment.backgroundModel.modelFileName||`No map surround loaded`)}</span>
          </div>
          <input data-background-model type="file" accept=".glb,model/gltf-binary">
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Model Scale</span>
            <input data-background="scale" type="number" min="0.01" max="20" step="0.05" value="${e.environment.backgroundModel.scale}">
          </label>
          <label class="field">
            <span>Rotation</span>
            <input data-background="rotation" type="number" min="-6.28" max="6.28" step="0.1" value="${e.environment.backgroundModel.rotation}">
          </label>
          <label class="field">
            <span>Vertical Offset</span>
            <input data-background="offsetY" type="number" min="-20" max="20" step="0.1" value="${e.environment.backgroundModel.offsetY}">
          </label>
          <label class="check-row">
            <input data-background="fitToMap" type="checkbox" ${e.environment.backgroundModel.fitToMap?`checked`:``}>
            <span>Fit around map</span>
          </label>
        </div>
        <div class="button-row two">
          <button data-action="update-background">Update Background</button>
          <button data-action="clear-background">Clear Background</button>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Surround X</span>
            <input data-surrounding="x" type="number" step="1" value="-2">
          </label>
          <label class="field">
            <span>Surround Z</span>
            <input data-surrounding="z" type="number" step="1" value="0">
          </label>
          <label class="field">
            <span>Rotation</span>
            <input data-surrounding="rotation" type="number" min="0" max="6.28" step="0.1" value="0">
          </label>
          <label class="field">
            <span>Scale</span>
            <input data-surrounding="scale" type="number" min="0.2" max="3" step="0.1" value="1">
          </label>
        </div>
        <div class="button-row two">
          <button data-action="add-surrounding">Add Surrounding Prop</button>
          <button data-action="clear-surroundings">Clear Surroundings</button>
        </div>
      </section>

      <section class="control-section">
        <div class="section-title">
          <strong>Story Beats</strong>
          <span>Show dialog or full-screen story at level start, a tile, or completion.</span>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Trigger</span>
            <select data-story="trigger">
              <option value="levelStart" ${l.trigger===`levelStart`?`selected`:``}>Level Start</option>
              <option value="tileEnter" ${l.trigger===`tileEnter`?`selected`:``}>Tile Enter</option>
              <option value="levelComplete" ${l.trigger===`levelComplete`?`selected`:``}>Level Complete</option>
            </select>
          </label>
          <label class="field">
            <span>Presentation</span>
            <select data-story="presentation">
              <option value="dialog" ${l.presentation===`dialog`?`selected`:``}>Dialog</option>
              <option value="screen" ${l.presentation===`screen`?`selected`:``}>Story Screen</option>
            </select>
          </label>
          <label class="field">
            <span>Tile X (left to right)</span>
            <input data-story="x" type="number" min="0" max="${Math.max(0,e.width-1)}" step="1" value="${l.x}">
          </label>
          <label class="field">
            <span>Tile Z (back to front)</span>
            <input data-story="z" type="number" min="0" max="${Math.max(0,e.depth-1)}" step="1" value="${l.z}">
          </label>
          <label class="field">
            <span>Title</span>
            <input data-story="title" type="text" placeholder="Optional title" value="${D(l.title)}">
          </label>
          <label class="field">
            <span>Speaker</span>
            <input data-story="speaker" type="text" placeholder="Optional speaker" value="${D(l.speaker)}">
          </label>
          <label class="field">
            <span>Avatar URL</span>
            <input data-story="avatarUrl" type="text" placeholder="Optional portrait image URL" value="${D(l.avatarUrl)}">
          </label>
        </div>
        <div class="story-avatar-editor">
          <div class="story-avatar-preview">
            ${l.avatarUrl?`<img src="${D(l.avatarUrl)}" alt="">`:`<span>${D((l.speaker||`CH`).slice(0,2).toUpperCase())}</span>`}
          </div>
          <div>
            <strong>${l.editingId?`Editing Story Beat`:`New Story Beat`}</strong>
            <span>Upload an optional speaker portrait, or paste an image URL.</span>
          </div>
          <input data-story-avatar type="file" accept="image/*">
          <button data-action="clear-story-avatar" ${l.avatarUrl?``:`disabled`}>Clear Avatar</button>
        </div>
        <div class="story-picker">
          <strong>Tile target</strong>
          <span>${l.trigger===`tileEnter`?`Tile ${l.x}, ${l.z} selected. Origin 0,0 is the back-left tile from the default camera.`:`Only used when Trigger is Tile Enter.`}</span>
          <div class="button-row two">
            <button data-action="pick-story-tile">Pick Tile</button>
            <button data-action="use-selected-story-tile" ${this.state.selected?``:`disabled`}>Use Selected Tile</button>
          </div>
        </div>
        <label class="field">
          <span>Story Text</span>
          <textarea class="story-textarea" data-story="text" placeholder="What happens here?">${D(l.text)}</textarea>
        </label>
        <div class="button-row two">
          <button data-action="add-story">${l.editingId?`Update Story Beat`:`Add Story Beat`}</button>
          <button data-action="new-story-draft" ${l.editingId?``:`disabled`}>New Story Beat</button>
        </div>
        <div class="story-list">
          ${e.story.map(e=>`
                <div class="story-item ${l.editingId===e.id?`active`:``}">
                  <div class="story-item-avatar">
                    ${e.avatarUrl?`<img src="${D(e.avatarUrl)}" alt="">`:`<span>${D((e.speaker||e.title||`ST`).slice(0,2).toUpperCase())}</span>`}
                  </div>
                  <div>
                    <strong>${D(e.title||e.speaker||e.presentation)}</strong>
                    <span>${D(e.trigger)}${e.trigger===`tileEnter`?` @ ${e.x}, ${e.z}`:``} / ${D(e.text)}</span>
                  </div>
                  <button data-action="edit-story" data-story-id="${D(e.id)}" title="Edit story beat" aria-label="Edit story beat">Edit</button>
                  <button data-action="remove-story" data-story-id="${D(e.id)}" title="Remove story beat" aria-label="Remove story beat">&times;</button>
                </div>
              `).join(``)||`<span class="empty-note">No story beats in this level.</span>`}
        </div>
      </section>

      </div>
      <div class="editor-column editor-column-right">
      <section class="control-section library-section">
        <div class="section-title">
          <strong>Content Library</strong>
          <span>Reusable content for building scenarios, enemy loadouts, props, terrain, and class faces.</span>
        </div>
        <div class="library-grid">
          ${d.map(e=>`
                <div class="library-card">
                  <strong>${e.count}</strong>
                  <span>${D(e.label)}</span>
                  <small>${D(e.details||`None yet`)}</small>
                </div>
              `).join(``)}
        </div>
        <div class="role-strip">
          <div><b>Head</b><span>Targeting, awareness, support, passive reads.</span></div>
          <div><b>Body / Arms</b><span>Attack shape, defense posture, cast or swing actions.</span></div>
          <div><b>Legs</b><span>Movement range, terrain rules, evasion, post-move pivots.</span></div>
        </div>
      </section>

      <section class="control-section">
        <div class="section-title">
          <strong>Terrain Materials</strong>
          <span>Define tile top art, side art, and placement rules.</span>
        </div>
        <label class="field">
          <span>Material</span>
          <select data-field="terrain">
            ${this.materialOptions(this.state.terrain)}
          </select>
        </label>
        <div class="compact-grid">
          <label class="field">
            <span>Name</span>
            <input data-material="name" type="text" value="${D(i.name)}">
          </label>
          <label class="field">
            <span>Move Cost</span>
            <input data-material="movementCost" type="number" min="1" max="9" step="1" value="${i.movementCost}">
          </label>
          <label class="field">
            <span>Surface Effect</span>
            <select data-material="surfaceEffect">
              ${[`solid`,`grass`,`water`].map(e=>`<option value="${e}" ${i.surfaceEffect===e?`selected`:``}>${e}</option>`).join(``)}
            </select>
          </label>
          <label class="field">
            <span>Grass Density</span>
            <input data-material="grassDensity" type="number" min="0" max="30" step="1" value="${i.grassDensity}">
          </label>
          <label class="field">
            <span>Grass Min Height</span>
            <input data-material="grassHeightMin" type="number" min="0.01" max="0.3" step="0.01" value="${i.grassHeightMin}">
          </label>
          <label class="field">
            <span>Grass Max Height</span>
            <input data-material="grassHeightMax" type="number" min="0.01" max="0.35" step="0.01" value="${i.grassHeightMax}">
          </label>
          <label class="field">
            <span>Top Color</span>
            <input data-material="topColor" type="color" value="${D(i.topColor)}">
          </label>
          <label class="field">
            <span>Legacy Side</span>
            <input data-material="sideColor" type="color" value="${D(i.sideColor)}">
          </label>
        </div>
        <div class="compact-grid">
          ${i.grassColors.map((e,t)=>`
                <label class="field">
                  <span>Grass Color ${t+1}</span>
                  <input data-material-grass-color type="color" value="${D(e)}">
                </label>
              `).join(``)}
        </div>
        <div class="asset-pair">
          <div class="asset-preview-head">
            <strong>Top</strong>
            ${O(i.topImageUrl)}
          </div>
          <div class="asset-preview-head">
            <strong>Cap Side</strong>
            ${O(i.sideCapImageUrl)}
          </div>
          <div class="asset-preview-head">
            <strong>Full Side</strong>
            ${O(i.sideFullImageUrl)}
          </div>
          <div class="asset-preview-head">
            <strong>Half Side</strong>
            ${O(i.sideHalfImageUrl)}
          </div>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Top Texture</span>
            <input data-material-image="top" type="file" accept="image/*">
          </label>
          <label class="field">
            <span>Cap Side Texture</span>
            <input data-material-image="sideCap" type="file" accept="image/*">
          </label>
          <label class="field">
            <span>Full Side Texture</span>
            <input data-material-image="sideFull" type="file" accept="image/*">
          </label>
          <label class="field">
            <span>Half Side Texture</span>
            <input data-material-image="sideHalf" type="file" accept="image/*">
          </label>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Cap Side Color</span>
            <input data-material="sideCapColor" type="color" value="${D(i.sideCapColor)}">
          </label>
          <label class="field">
            <span>Full Side Color</span>
            <input data-material="sideFullColor" type="color" value="${D(i.sideFullColor)}">
          </label>
          <label class="field">
            <span>Half Side Color</span>
            <input data-material="sideHalfColor" type="color" value="${D(i.sideHalfColor)}">
          </label>
        </div>
        <label class="field">
          <span>Top Rule</span>
          <input data-material="topRule" type="text" value="${D(i.topRule)}">
        </label>
        <label class="field">
          <span>Side Rule</span>
          <input data-material="sideRule" type="text" value="${D(i.sideRule)}">
        </label>
        <label class="check-row">
          <input data-material="blocksLineOfSight" type="checkbox" ${i.blocksLineOfSight?`checked`:``}>
          <span>Blocks line of sight when this material is raised.</span>
        </label>
        <div class="button-row two">
          <button data-action="update-material">Update Material</button>
          <button data-action="save-material-new">Save As New Material</button>
        </div>
      </section>

      <section class="control-section">
        <div class="section-title">
          <strong>Props / Blockers</strong>
          <span>Create placeable blockers, cover, and decorative environment props.</span>
        </div>
        <label class="field">
          <span>Prop</span>
          <select data-field="obstacle">
            ${this.propOptions(this.state.obstacle)}
          </select>
        </label>
        <div class="compact-grid">
          <label class="field">
            <span>Name</span>
            <input data-prop="name" type="text" value="${D(a.name)}">
          </label>
          <label class="field">
            <span>Role</span>
            <select data-prop="role">
              ${[`blocker`,`cover`,`decor`].map(e=>`<option value="${e}" ${a.role===e?`selected`:``}>${e}</option>`).join(``)}
            </select>
          </label>
          <label class="field">
            <span>Render As</span>
            <select data-prop="assetKind">
              ${[`box`,`glb`].map(e=>`<option value="${e}" ${a.assetKind===e?`selected`:``}>${e}</option>`).join(``)}
            </select>
          </label>
          <label class="field">
            <span>Color</span>
            <input data-prop="color" type="color" value="${D(a.color)}">
          </label>
          <label class="field">
            <span>Box Texture</span>
            <input data-prop-image type="file" accept="image/*">
          </label>
          <label class="field">
            <span>GLB Model</span>
            <input data-prop-model type="file" accept=".glb,model/gltf-binary">
          </label>
        </div>
        <div class="asset-preview-head">
          <strong>${a.assetKind===`glb`?a.modelFileName||`GLB Model`:`Texture Preview`}</strong>
          ${O(a.textureUrl)}
        </div>
        <div class="stat-grid">
          <label>
            <span>W</span>
            <input data-prop="width" type="number" min="0.1" max="3" step="0.05" value="${a.width}">
          </label>
          <label>
            <span>H</span>
            <input data-prop="height" type="number" min="0.1" max="4" step="0.05" value="${a.height}">
          </label>
          <label>
            <span>D</span>
            <input data-prop="depth" type="number" min="0.1" max="3" step="0.05" value="${a.depth}">
          </label>
          <label>
            <span>COV</span>
            <input data-prop="coverBonus" type="number" min="0" max="9" step="1" value="${a.coverBonus}">
          </label>
        </div>
        <label class="check-row">
          <input data-prop="blocksMovement" type="checkbox" ${a.blocksMovement?`checked`:``}>
          <span>Blocks movement.</span>
        </label>
        <label class="check-row">
          <input data-prop="blocksLineOfSight" type="checkbox" ${a.blocksLineOfSight?`checked`:``}>
          <span>Blocks line of sight.</span>
        </label>
        <label class="check-row">
          <input data-prop="fitModelToTile" type="checkbox" ${a.fitModelToTile?`checked`:``}>
          <span>Fit uploaded GLB to this prop's one-square footprint.</span>
        </label>
        <label class="check-row">
          <input data-prop="windEffect" type="checkbox" ${a.windEffect?`checked`:``}>
          <span>Apply a subtle wind sway to foliage-style props.</span>
        </label>
        <label class="check-row">
          <input data-prop="emitsLight" type="checkbox" ${a.emitsLight?`checked`:``}>
          <span>Emit light from this prop; GLBs use emissive materials or named markers when present.</span>
        </label>
        <div class="compact-grid">
          <label class="field">
            <span>Light Color</span>
            <input data-prop="lightColor" type="color" value="${D(a.lightColor)}">
          </label>
          <label class="field">
            <span>Intensity</span>
            <input data-prop="lightIntensity" type="number" min="0" max="8" step="0.05" value="${a.lightIntensity}">
          </label>
          <label class="field">
            <span>Range</span>
            <input data-prop="lightRange" type="number" min="0.5" max="16" step="0.1" value="${a.lightRange}">
          </label>
          <label class="field">
            <span>Light Height</span>
            <input data-prop="lightOffsetY" type="number" min="0" max="5" step="0.05" value="${a.lightOffsetY}">
          </label>
        </div>
        <label class="field">
          <span>Notes</span>
          <input data-prop="notes" type="text" value="${D($(a.notes))}">
        </label>
        <div class="button-row two">
          <button data-action="update-prop">Update Prop</button>
          <button data-action="save-prop-new">Save As New Prop</button>
        </div>
      </section>

      <section class="control-section">
        <div class="section-title">
          <strong>Class Library</strong>
          <span>${this.classDefinitions.length} classes available.</span>
        </div>
        <label class="field">
          <span>Class</span>
          <select data-field="classId">
            ${this.classOptions(this.state.classId)}
          </select>
        </label>
        <div class="compact-grid">
          <label class="field">
            <span>Class Name</span>
            <input data-class="name" type="text" value="${D(r.name)}">
          </label>
          <label class="field">
            <span>Color</span>
            <input data-class="color" type="color" value="${D(r.color)}">
          </label>
        </div>
        <div class="class-section-list">
          ${x.map(e=>{let t=r.sections[e];return`
                <div class="class-section-card">
                  <div class="class-section-head">
                    <strong>${e===`body`?`body / arms`:e}</strong>
                    ${O(t.imageUrl)}
                  </div>
                  <label class="field">
                    <span>Image</span>
                    <input data-class-image data-class-section="${e}" type="file" accept="image/*">
                  </label>
                  <div class="stat-grid">
                    ${T.map(n=>`
                          <label>
                            <span>${n.label}</span>
                            <input data-class-section="${e}" data-stat="${n.key}" type="number" min="0" max="12" step="1" value="${t.stats[n.key]}">
                          </label>
                        `).join(``)}
                  </div>
                  <label class="field">
                    <span>Conditions</span>
                    <input data-class-section="${e}" data-condition type="text" value="${D($(t.conditions))}">
                  </label>
                  <label class="field">
                    <span>Abilities</span>
                    <textarea class="ability-textarea" data-class-section="${e}" data-ability>${D(Te(t.abilities))}</textarea>
                  </label>
                </div>
              `}).join(``)}
        </div>
        <div class="button-row two">
          <button data-action="update-class">Update Class</button>
          <button data-action="save-class-new">Save As New Class</button>
        </div>
      </section>

      <section class="control-section">
        <div class="section-title">
          <strong>Character Builds</strong>
          <span>Create reusable player or enemy cube layouts.</span>
        </div>
        <div class="compact-grid">
          <label class="field">
            <span>Build Name</span>
            <input data-build="name" type="text" value="${D(n.name)}">
          </label>
          <label class="field">
            <span>HP</span>
            <input data-build="hp" type="number" min="1" max="99" step="1" value="${n.hp}">
          </label>
        </div>
        <div class="face-builder">
          ${x.map(e=>`
                <div class="face-row">
                  <b>${e===`body`?`body / arms`:e}</b>
                  ${b.map((t,r)=>`
                        <label>
                          <span>${t}</span>
                          <select data-face-section="${e}" data-face-index="${r}">
                            ${this.classOptions(n.faces[e][r])}
                          </select>
                        </label>
                      `).join(``)}
                </div>
              `).join(``)}
        </div>
        <div class="button-row two">
          <button data-action="update-build">Update Selected</button>
          <button data-action="save-build-new">Save As New Build</button>
        </div>
      </section>

      <div class="level-card">
        <strong>${e.name}</strong>
        <span>${e.width} x ${e.depth} board / ${e.units.length} units / ${e.obstacles.length} blockers / ${e.surroundings.length} surroundings</span>
        <span>Next: ${e.links.map(e=>e.to).join(`, `)||`campaign end`}</span>
      </div>

      <div class="button-row">
        <button data-action="duplicate-level">Duplicate Level</button>
        <button data-action="save-local">Save Local</button>
        <button data-action="load-sample">Reset Samples</button>
      </div>

      <div class="button-row">
        <button data-action="open-flow-editor">Level Flow</button>
        <button data-action="open-title-editor">Title Screen</button>
        <button data-action="open-rules-editor">Gameplay Rules</button>
      </div>

      <label class="field">
        <span>Export / Import Current Level + Campaign</span>
        <textarea data-json>${u}</textarea>
      </label>

      <div class="button-row">
        <button data-action="download-json">Export JSON</button>
        <button data-action="import-json">Import JSON</button>
        <button data-action="next-level">Load Next</button>
      </div>

      <div class="button-row">
        <button data-action="copy-json">Copy JSON</button>
      </div>

      <ul class="warnings">
        ${(t.length?t:[`Level validates for first-pass playtesting.`]).map(e=>`<li>${e}</li>`).join(``)}
      </ul>
      </div>
    `,this.panel.querySelectorAll(`[data-tool]`).forEach(e=>{e.addEventListener(`click`,()=>{this.state.tool=e.dataset.tool,this.updatePanel()})}),this.panel.querySelectorAll(`[data-field]`).forEach(e=>{e.addEventListener(`change`,()=>{let t=e.dataset.field;if(this.state[t]=e.value,t===`levelId`){this.state.selected=void 0,this.render(!0);return}if(t===`classId`||t===`templateId`){this.updatePanel();return}this.render()})}),this.panel.querySelectorAll(`[data-class-image]`).forEach(e=>{e.addEventListener(`change`,()=>this.handleClassImageUpload(e))}),this.panel.querySelectorAll(`[data-material-image]`).forEach(e=>{e.addEventListener(`change`,()=>this.handleMaterialImageUpload(e))}),this.panel.querySelectorAll(`[data-prop-image]`).forEach(e=>{e.addEventListener(`change`,()=>this.handlePropImageUpload(e))}),this.panel.querySelectorAll(`[data-prop-model]`).forEach(e=>{e.addEventListener(`change`,()=>this.handlePropModelUpload(e))}),this.panel.querySelectorAll(`[data-ground-texture]`).forEach(e=>{e.addEventListener(`change`,()=>this.handleGroundTextureUpload(e))}),this.panel.querySelectorAll(`[data-background-model]`).forEach(e=>{e.addEventListener(`change`,()=>this.handleBackgroundModelUpload(e))}),this.panel.querySelectorAll(`[data-story-avatar]`).forEach(e=>{e.addEventListener(`change`,()=>this.handleStoryAvatarUpload(e))}),this.panel.querySelectorAll(`[data-story]`).forEach(e=>{e.addEventListener(`input`,()=>this.syncStoryDraftFromPanel()),e.addEventListener(`change`,()=>{this.syncStoryDraftFromPanel(),e instanceof HTMLSelectElement&&e.dataset.story===`trigger`&&this.updatePanel()})}),this.panel.querySelectorAll(`[data-selected-unit-behavior]`).forEach(e=>{e.addEventListener(`change`,()=>this.updateSelectedUnitBehavior(e.dataset.unitId,e.value))}),this.panel.querySelectorAll(`[data-action]`).forEach(e=>{e.addEventListener(`click`,()=>this.handleAction(e.dataset.action??``,e.dataset.storyId,e.dataset.unitId))});let f=this.root.querySelector(`#status-chip`);f&&(f.textContent=this.state.selected?`${this.state.mode.toUpperCase()} / ${this.state.tool} / tile ${this.state.selected.x}, ${this.state.selected.z}`:`${this.state.mode.toUpperCase()} / ${this.state.tool} / click a tile`)}handleClassImageUpload(e){let t=e.files?.[0],n=e.dataset.classSection;if(!t||!n||!x.includes(n))return;if(!t.type.startsWith(`image/`)){this.flash(`Class image upload needs an image file.`);return}let r=new FileReader;r.addEventListener(`load`,()=>{let e=String(r.result??``),t=this.readClassDraft();t.sections[n].imageUrl=e,this.replaceClassDefinition(t),this.updatePanel(),this.flash(`Updated ${t.name} ${n} art.`)}),r.addEventListener(`error`,()=>{this.flash(`Class image upload failed.`)}),r.readAsDataURL(t)}handleMaterialImageUpload(e){let t=e.files?.[0],n=e.dataset.materialImage;if(!t||n!==`top`&&n!==`sideCap`&&n!==`sideFull`&&n!==`sideHalf`)return;if(!t.type.startsWith(`image/`)){this.flash(`Terrain texture upload needs an image file.`);return}let r=new FileReader;r.addEventListener(`load`,()=>{let e=this.readMaterialDraft();n===`top`?e.topImageUrl=String(r.result??``):n===`sideCap`?e.sideCapImageUrl=String(r.result??``):n===`sideFull`?e.sideFullImageUrl=String(r.result??``):n===`sideHalf`&&(e.sideHalfImageUrl=String(r.result??``)),this.replaceMaterialDefinition(e),this.updatePanel(),this.flash(`Updated ${e.name} ${n} texture.`)}),r.addEventListener(`error`,()=>{this.flash(`Terrain texture upload failed.`)}),r.readAsDataURL(t)}handlePropImageUpload(e){let t=e.files?.[0];if(!t)return;if(!t.type.startsWith(`image/`)){this.flash(`Prop texture upload needs an image file.`);return}let n=new FileReader;n.addEventListener(`load`,()=>{let e=this.readPropDraft();e.textureUrl=String(n.result??``),this.replacePropDefinition(e),this.updatePanel(),this.flash(`Updated ${e.name} texture.`)}),n.addEventListener(`error`,()=>{this.flash(`Prop texture upload failed.`)}),n.readAsDataURL(t)}handlePropModelUpload(e){let t=e.files?.[0];if(!t)return;if(!(t.name.toLowerCase().endsWith(`.glb`)||t.type===`model/gltf-binary`)){this.flash(`Prop model upload needs a .glb file.`);return}let n=new FileReader;n.addEventListener(`load`,()=>{let e=this.readPropDraft();e.assetKind=`glb`,e.modelUrl=String(n.result??``),e.modelFileName=t.name,e.fitModelToTile=!0,this.replacePropDefinition(e),this.updatePanel(),this.flash(`Updated ${e.name} GLB model.`)}),n.addEventListener(`error`,()=>{this.flash(`Prop model upload failed.`)}),n.readAsDataURL(t)}handleGroundTextureUpload(e){let t=e.files?.[0];if(!t)return;if(!t.type.startsWith(`image/`)){this.flash(`Ground texture upload needs an image file.`);return}let n=new FileReader;n.addEventListener(`load`,()=>{let e=this.currentLevel(),t={...e,environment:{...this.readEnvironmentDraft(e),groundTextureUrl:String(n.result??``)}};this.setCurrentLevel(t),this.scene.setLevel(t),this.updatePanel(),this.flash(`Updated ground texture.`)}),n.addEventListener(`error`,()=>{this.flash(`Ground texture upload failed.`)}),n.readAsDataURL(t)}handleBackgroundModelUpload(e){let t=e.files?.[0];if(!t)return;if(!(t.name.toLowerCase().endsWith(`.glb`)||t.type===`model/gltf-binary`)){this.flash(`Background model upload needs a .glb file.`);return}let n=new FileReader;n.addEventListener(`load`,()=>{let e=this.currentLevel(),r=Y({...e,environment:{...this.readEnvironmentDraft(e),backgroundModel:{...this.readEnvironmentDraft(e).backgroundModel,modelUrl:String(n.result??``),modelFileName:t.name}}});this.setCurrentLevel(r),this.scene.setLevel(r),this.updatePanel(),this.flash(`Loaded background ${t.name}.`)}),n.addEventListener(`error`,()=>{this.flash(`Background model upload failed.`)}),n.readAsDataURL(t)}handleStoryAvatarUpload(e){let t=e.files?.[0];if(!t)return;if(!t.type.startsWith(`image/`)){this.flash(`Story avatar upload needs an image file.`);return}let n=new FileReader;n.addEventListener(`load`,()=>{this.syncStoryDraftFromPanel(),this.state.storyDraft={...this.state.storyDraft,avatarUrl:String(n.result??``)},this.updatePanel(),this.flash(`Loaded avatar ${t.name}.`)}),n.addEventListener(`error`,()=>{this.flash(`Story avatar upload failed.`)}),n.readAsDataURL(t)}handleAction(i,a,s){if(i===`open-client`)this.openClientPreview();else if(i===`toggle-mode`)this.state.mode=this.state.mode===`editor`?`play`:`editor`,this.scene.setMode(this.state.mode),this.updatePanel();else if(i===`apply-size`)this.applyLevelSize();else if(i===`frame-board`)this.scene.frameCurrentLevel(),this.flash(`Camera framed to the current board.`);else if(i===`rotate-prop`){let e=this.currentLevel(),t=this.state.selected?e.obstacles.find(e=>e.x===this.state.selected?.x&&e.z===this.state.selected.z):void 0,n=t?Math.round((t.rotation??0)/(Math.PI/2)):this.state.propRotationSteps;this.applyPropRotation(n+1)}else if(i===`reset-prop-rotation`)this.applyPropRotation(0);else if(i===`select-initiative-unit`)this.selectUnitById(s);else if(i===`initiative-up`)this.moveInitiativeUnit(s,-1);else if(i===`initiative-down`)this.moveInitiativeUnit(s,1);else if(i===`update-build`){let e=this.readBuildDraft();this.templates=this.templates.map(t=>t.id===e.id?e:t),this.updatePanel(),this.flash(`Updated ${e.name}.`)}else if(i===`save-build-new`){let e=this.readBuildDraft(),t={...e,id:this.uniqueTemplateId(e.name)};this.templates.push(t),this.state.templateId=t.id,this.updatePanel(),this.flash(`Created ${t.name}.`)}else if(i===`update-class`){let e=this.readClassDraft();this.replaceClassDefinition(e),this.updatePanel(),this.flash(`Updated ${e.name}.`)}else if(i===`save-class-new`){let e=this.readClassDraft(),t={...e,id:this.uniqueClassId(e.name)};this.classDefinitions.push(t),this.state.classId=t.id,this.scene.setClassDefinitions(this.classDefinitions),this.updatePanel(),this.flash(`Created ${t.name}.`)}else if(i===`update-material`){let e=this.readMaterialDraft();this.replaceMaterialDefinition(e),this.updatePanel(),this.flash(`Updated ${e.name}.`)}else if(i===`save-material-new`){let e=this.readMaterialDraft(),t={...e,id:this.uniqueMaterialId(e.name)};this.environmentMaterials.push(t),this.state.terrain=t.id,this.scene.setEnvironmentMaterials(this.environmentMaterials),this.updatePanel(),this.flash(`Created ${t.name}.`)}else if(i===`update-prop`){let e=this.readPropDraft();this.replacePropDefinition(e),this.updatePanel(),this.flash(`Updated ${e.name}.`)}else if(i===`save-prop-new`){let e=this.readPropDraft(),t={...e,id:this.uniquePropId(e.name)};this.propDefinitions.push(t),this.state.obstacle=t.id,this.scene.setPropDefinitions(this.propDefinitions),this.updatePanel(),this.flash(`Created ${t.name}.`)}else if(i===`update-environment`){let e=this.currentLevel(),t={...e,environment:this.readEnvironmentDraft(e)};this.setCurrentLevel(t),this.scene.setLevel(t),this.updatePanel(),this.flash(`Updated level environment.`)}else if(i===`update-background`){let e=this.currentLevel(),t={...e,environment:this.readEnvironmentDraft(e)};this.setCurrentLevel(t),this.scene.setLevel(t),this.updatePanel(),this.flash(`Updated background model placement.`)}else if(i===`clear-background`){let e=this.currentLevel(),t={...e,environment:{...this.readEnvironmentDraft(e),backgroundModel:{...e.environment.backgroundModel,modelUrl:``,modelFileName:``}}};this.setCurrentLevel(t),this.scene.setLevel(t),this.updatePanel(),this.flash(`Cleared background model.`)}else if(i===`clear-ground-texture`){let e=this.currentLevel(),t={...e,environment:{...this.readEnvironmentDraft(e),groundTextureUrl:``}};this.setCurrentLevel(t),this.scene.setLevel(t),this.updatePanel(),this.flash(`Cleared ground texture.`)}else if(i===`add-surrounding`){let e=this.currentLevel(),t=this.panel.querySelector(`[data-surrounding='x']`),n=this.panel.querySelector(`[data-surrounding='z']`),r=this.panel.querySelector(`[data-surrounding='rotation']`),i=this.panel.querySelector(`[data-surrounding='scale']`),a={...e,surroundings:[...e.surroundings,{id:`sur-${this.state.obstacle}-${Date.now()}`,type:this.state.obstacle,x:Math.round(P(t?.value,-2)),z:Math.round(P(n?.value,0)),rotation:P(r?.value,0),scale:Math.max(.2,Math.min(3,P(i?.value,1)))}]};this.setCurrentLevel(a),this.scene.setLevel(a),this.updatePanel(),this.flash(`Added surrounding ${this.selectedProp().name}.`)}else if(i===`clear-surroundings`){let e={...this.currentLevel(),surroundings:[]};this.setCurrentLevel(e),this.scene.setLevel(e),this.updatePanel(),this.flash(`Cleared surrounding props.`)}else if(i===`pick-story-tile`)this.syncStoryDraftFromPanel(),this.state.tool=`story`,this.updatePanel(),this.flash(`Story tile picker active. Click the tile that should trigger this beat.`);else if(i===`use-selected-story-tile`)this.state.selected?this.setStoryDraftTile(this.state.selected):this.flash(`Select a tile first, then use it for the story beat.`);else if(i===`clear-story-avatar`)this.syncStoryDraftFromPanel(),this.state.storyDraft={...this.state.storyDraft,avatarUrl:``},this.updatePanel(),this.flash(`Cleared story avatar.`);else if(i===`new-story-draft`)this.state.storyDraft=this.emptyStoryDraft(),this.updatePanel(),this.flash(`Ready for a new story beat.`);else if(i===`edit-story`&&a){let e=this.currentLevel().story.find(e=>e.id===a);e&&(this.state.storyDraft=this.storyDraftFromBeat(e),e.trigger===`tileEnter`&&e.x!==void 0&&e.z!==void 0&&(this.state.selected={x:e.x,z:e.z},this.scene.setSelected(this.state.selected)),this.updatePanel(),this.flash(`Loaded story beat for editing.`))}else if(i===`add-story`){let e=this.currentLevel(),t=this.readStoryDraft(),n=!!this.state.storyDraft.editingId,r={...e,story:n?e.story.map(e=>e.id===t.id?t:e):[...e.story,t]};this.setCurrentLevel(r),this.state.storyDraft=this.storyDraftFromBeat(t),this.updatePanel(),this.flash(`${n?`Updated`:`Added`} story beat${t.trigger===`tileEnter`?` at ${t.x}, ${t.z}`:``}.`)}else if(i===`remove-story`&&a){let e=this.currentLevel(),t={...e,story:e.story.filter(e=>e.id!==a)};this.setCurrentLevel(t),this.state.storyDraft.editingId===a&&(this.state.storyDraft=this.emptyStoryDraft()),this.updatePanel(),this.flash(`Removed story beat.`)}else if(i===`duplicate-level`){let e=this.currentLevel(),t=m(e);t.id=`${e.id}-copy-${this.levels.length+1}`,t.name=`${e.name} Copy`,t.links=[],this.levels.push(t),this.campaign.levels.push({id:t.id,file:`levels/${t.id}.json`,next:[]}),this.state.levelId=t.id,this.state.selected=void 0,this.render(!0)}else if(i===`save-local`)ee(this.currentLevel()),te(this.campaign),localStorage.setItem(e,this.editorJson()),localStorage.setItem(E,JSON.stringify(this.templates,null,2)),localStorage.setItem(ce,JSON.stringify(this.classDefinitions,null,2)),localStorage.setItem(le,JSON.stringify(this.environmentMaterials,null,2)),localStorage.setItem(ue,JSON.stringify(this.propDefinitions,null,2)),this.flash(`Saved campaign, level, builds, classes, materials, and props.`);else if(i===`load-sample`)this.levels=n.map(e=>Y(m(e))),this.campaign=Q(structuredClone(c),this.levels),this.templates=o.map(e=>structuredClone(e)),this.classDefinitions=d.map(e=>structuredClone(e)),this.environmentMaterials=t.map(e=>structuredClone(e)),this.propDefinitions=r.map(e=>structuredClone(e)),this.state.levelId=this.campaign.startLevel,this.state.templateId=this.templates[1]?.id??this.templates[0].id,this.state.classId=this.classDefinitions[0].id,this.state.terrain=this.environmentMaterials[0].id,this.state.obstacle=this.propDefinitions[0].id,this.state.propRotationSteps=0,this.state.storyDraft=this.emptyStoryDraft(),this.state.selected=void 0,this.scene.setClassDefinitions(this.classDefinitions),this.scene.setEnvironmentMaterials(this.environmentMaterials),this.scene.setPropDefinitions(this.propDefinitions),localStorage.removeItem(e),this.render(!0);else if(i===`open-flow-editor`)this.openLevelFlowEditor();else if(i===`open-title-editor`)this.openTitleEditor();else if(i===`open-rules-editor`)this.openGameplayRulesEditor();else if(i===`download-json`)this.downloadJsonFile(fe(this.campaign.id||`craft-heroes-campaign`),this.editorJson()),this.flash(`Exported campaign JSON.`);else if(i===`copy-json`){let e=this.panel.querySelector(`[data-json]`);e&&(navigator.clipboard?.writeText(e.value),this.flash(`Copied editor JSON.`))}else if(i===`import-json`)this.importJson();else if(i===`next-level`){let e=this.currentLevel().links[0]?.to??this.campaign.levels.find(e=>e.id===this.state.levelId)?.next[0];e&&this.levels.some(t=>t.id===e)?(this.state.levelId=e,this.state.selected=void 0,this.render(!0)):this.flash(`No next level is configured.`)}}importJson(){let e=this.panel.querySelector(`[data-json]`);if(e)try{let n=JSON.parse(e.value);n.levels?.length&&(this.levels=n.levels.map(e=>Y(e)));let i=n.terrainMaterials??n.environmentMaterials;i?.length&&(this.environmentMaterials=q(t,i),this.environmentMaterials.some(e=>e.id===this.state.terrain)||(this.state.terrain=this.environmentMaterials[0].id),this.scene.setEnvironmentMaterials(this.environmentMaterials));let a=n.props??n.propDefinitions;a?.length&&(this.propDefinitions=J(r,a),this.propDefinitions.some(e=>e.id===this.state.obstacle)||(this.state.obstacle=this.propDefinitions[0].id),this.scene.setPropDefinitions(this.propDefinitions));let o=n.classes??n.classDefinitions;if(o?.length&&(this.classDefinitions=W(d,o),this.classDefinitions.some(e=>e.id===this.state.classId)||(this.state.classId=this.classDefinitions[0].id),this.scene.setClassDefinitions(this.classDefinitions)),n.templates?.length&&(this.templates=n.templates,this.templates.some(e=>e.id===this.state.templateId)||(this.state.templateId=this.templates[0].id)),n.level){let e=Y(n.level);this.levels.some(t=>t.id===e.id)?this.setCurrentLevel(e):this.levels.push(e),this.state.levelId=e.id}else this.levels.some(e=>e.id===this.state.levelId)||(this.state.levelId=this.levels.find(e=>e.id===this.campaign.startLevel)?.id??this.levels[0].id);n.campaign?this.campaign=Q(n.campaign,this.levels):this.campaign=Q(this.campaign,this.levels),this.levels.some(e=>e.id===this.state.levelId)||(this.state.levelId=this.levels.find(e=>e.id===this.campaign.startLevel)?.id??this.levels[0].id),this.render(!0),this.flash(`Imported editor JSON.`)}catch{this.flash(`Import failed: invalid JSON.`)}}flash(e){let t=this.root.querySelector(`#status-chip`);t&&(t.textContent=e)}},je=document.querySelector(`#app`);if(!je)throw Error(`Missing #app root.`);new URLSearchParams(window.location.search).get(`view`)===`game`?window.location.replace(new URL(`client.html`,window.location.href)):new Ae(je);