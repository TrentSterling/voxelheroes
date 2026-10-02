// The party menu stays in the game's canvas; a hidden input supplies mobile keyboards.
import { state } from '../../core/state.js';
import { input } from '../../core/input.js';
import { registerMode, pushMode, popMode } from '../../core/modes.js';
import { createParty, joinParty, leaveParty, partyView, inviteLink } from '../../game/party.js';
import { registerUiPart, requestUi, COLORS } from '../canvas/gfx.js';
import { hideOverlay } from '../overlay.js';
import { partyShortcutLayout } from '../shortcuts.js';
import * as THREE from 'three';
import { camera } from '../../core/renderer.js';
import { partyFriends } from '../../game/party.js';
import { GROUND_Y } from '../../core/constants.js';

let open = false, value = '', notice = '', busy = false, field = null;
let rosterPage=0;
const clean = (text) => {
  try { if (text.includes('://')) text = new URLSearchParams(new URL(text).hash.slice(1)).get('party') ?? text; } catch {}
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
};
export function openParty() { if (!open && ['title', 'play', 'paused'].includes(state.mode)) pushMode('party'); }
export function closeParty() { if (state.mode === 'party') popMode(); }
export const partyMenuView = () => ({ open, value, notice, busy });

function editCode() {
  if (!field) {
    field = document.createElement('input');
    field.type = 'text'; field.autocomplete = 'off'; field.inputMode = 'text'; field.maxLength = 200;
    field.setAttribute('aria-label', 'Party code or invite link');
    field.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none;font-size:16px';
    field.addEventListener('input', () => { value = clean(field.value); notice = ''; requestUi(); });
    field.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') { event.preventDefault(); field.blur(); start(false); }
      if (event.key === 'Escape') { event.preventDefault(); field.blur(); closeParty(); }
    });
    document.body.append(field);
  }
  field.value = value; field.focus(); field.select();
}

async function start(hosting) {
  if (busy) return;
  busy = true; notice = ''; requestUi();
  const ok = await (hosting ? createParty() : joinParty(value));
  busy = false;
  if (ok) { field?.blur(); if (state.mode === 'party') closeParty(); }
  else notice = partyView().error;
  requestUi();
}
async function copyInvite() {
  try { await navigator.clipboard.writeText(inviteLink()); notice = 'Invite link copied'; }
  catch { notice = `Share code ${partyView().code}`; }
  requestUi();
}

registerMode('party', {
  enter() { open = true; notice = ''; rosterPage=0; hideOverlay(); requestUi(); },
  exit() { open = false; field?.blur(); requestUi(); },
  update() { if (document.activeElement !== field && input.pressed('menu')) closeParty(); },
});

registerUiPart({
  id: 'party-names', order: 5,
  key: () => state.mode === 'play' ? partyFriends().map((e) => `${e.peerId}:${e.object.visible}:${e.x.toFixed(2)}:${e.z.toFixed(2)}:${e.info?.name}`).join('|') : '-',
  busy: () => state.mode === 'play' && partyView().count > 1,
  draw(g) {
    if (state.mode !== 'play') return;
    camera.updateMatrixWorld();
    for (const e of partyFriends()) {
      if (!e.object.visible) continue;
      const p = new THREE.Vector3(e.x, GROUND_Y + 1.6, e.z).project(camera);
      if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) continue;
      let x=Math.round((p.x+1)*g.w/2),y=Math.round((1-p.y)*g.h/2);
      const text=g.fit(e.info?.name??'Friend',g.w-24),w=g.measure(text)+8;
      x=Math.max(4+w/2,Math.min(g.w-4-w/2,x));y=Math.max(4,Math.min(g.h-16,y));
      g.panel(x - w / 2, y, w, 12, { shadow: false });
      g.text(text, x, y + 3, { align: 'center', color: COLORS.ink });
    }
  },
});

registerUiPart({
  id: 'party-entry', order: 65,
  key: () => `${state.mode}|${partyView().count}|${partyView().active}|${partyView().ready}`,
  draw(g) {
    const layout = partyShortcutLayout(g);
    if (layout) g.button(layout.id, layout.label, layout.x, layout.y, openParty);
  },
});

registerUiPart({
  id: 'party-menu', order: 90,
  key: () => open ? JSON.stringify([value,notice,busy,rosterPage,partyView()]) : '-',
  draw(g) {
    if (!open) return;
    const view=partyView(),pw=Math.min(300,g.w-16),inner=pw-28,narrow=inner<220;
    const intro=g.wrap('Shared quests. Explore your own way.',inner);
    const entryHint=g.wrap('Or enter a code / paste an invite',inner);
    const bonk=g.wrap('Friends can bonk, never hurt you.',inner);
    const codeLines=g.wrap(view.code??'',inner,2);
    const status=g.wrap(view.ready?`${view.count}/8 heroes - ${view.status}`:'Finding friends...',inner);
    const message=g.wrap(notice||view.error||'',inner).filter(l=>l.text);
    const codeStacked=inner<140;
    const copy=g.buttonMetrics('Copy invite',{primary:true,maxWidth:inner});
    const leave=g.buttonMetrics('Leave party',{maxWidth:inner});
    const stackActions=copy.w+10+leave.w>inner;
    const actionsH=stackActions?copy.h+6+leave.h:Math.max(copy.h,leave.h);
    const rosterTop=14+12+12+codeLines.length*18+6+status.length*11+9;
    const rowH=narrow?24:13;
    const reserve=actionsH+message.length*11+17+13+24;
    const shownCount=Math.max(1,Math.floor((g.h-12-rosterTop-reserve)/rowH));
    const pages=Math.max(1,Math.ceil(view.members.length/shownCount));
    rosterPage=Math.min(rosterPage,pages-1);
    const members=view.members.slice(rosterPage*shownCount,(rosterPage+1)*shownCount);
    const activeH=rosterTop+members.length*rowH+6+actionsH+message.length*11+8+(pages>1?17:0)+13+12;
    const compact=g.h<190;
    const createY=26+intro.length*11+(compact?4:6);
    const hintY=createY+17+(compact?6:12);
    const fieldY=hintY+entryHint.length*11+(compact?4:6);
    const bonkY=fieldY+(codeStacked?19+6+17:19)+(compact?6:12);
    const inactiveH=bonkY+bonk.length*11+(compact?6:8)+message.length*11+13+12;
    const ph=view.active?activeH:inactiveH;
    const x=Math.round((g.w-pw)/2),y=Math.max(6,Math.round((g.h-ph)/2));
    g.rect(0, 0, g.w, g.h, 'rgba(8,17,13,0.72)');
    g.hit('party-scrim', 0, 0, g.w, g.h, closeParty);
    g.panel(x, y, pw, ph, { accent: true }); g.hit('party-panel', x, y, pw, ph, () => {});
    g.text('Adventure together', x + 14, y + 14, { color: COLORS.gold });
    if (view.active) {
      let ry=y+26;
      g.text('PARTY CODE',x+14,ry,{color:COLORS.muted});ry+=12;
      for(const line of codeLines){g.text(line.text,x+14,ry,{size:2,color:COLORS.ink});ry+=18;}
      ry+=6;for(const line of status){g.text(line.text,x+14,ry,{color:COLORS.muted});ry+=11;}ry+=9;
      for (const member of members) {
        g.text(g.fit(`${member.id===view.selfId?'* ':'  '}${member.name}`,narrow?inner:inner/2-5),x+14,ry,{color:COLORS.ink});
        g.text(g.fit(member.area,narrow?inner:inner/2-5),narrow?x+14:x+pw-14,narrow?ry+11:ry,{align:narrow?'left':'right',color:COLORS.muted});
        ry += rowH;
      }
      ry+=6;
      g.primary('party-copy','Copy invite',x+14,ry,copyInvite,{maxWidth:inner});
      g.button('party-leave','Leave party',stackActions?x+14:x+14+copy.w+10,stackActions?ry+copy.h+6:ry+2,()=>{leaveParty();notice='';},{maxWidth:inner});
      ry+=actionsH+8;
      for(const line of message){g.text(line.text,x+14,ry,{color:COLORS.gold});ry+=11;}
      if(pages>1){
        const change=d=>{rosterPage=(rosterPage+d+pages)%pages;requestUi();};
        g.button('party-prev','<',x+14,ry,()=>change(-1));
        g.text(`${rosterPage+1}/${pages}`,x+34,ry+3,{color:COLORS.muted});
        g.button('party-next','>',x+58,ry,()=>change(1));
      }
    } else {
      intro.forEach((l,i)=>g.text(l.text,x+14,y+26+i*11,{color:COLORS.muted}));
      g.primary('party-create',busy?'Connecting...':'Create party',x+14,y+createY,()=>start(true),{maxWidth:inner});
      entryHint.forEach((l,i)=>g.text(l.text,x+14,y+hintY+i*11,{color:COLORS.muted}));
      const fieldW=codeStacked?inner:inner-g.measure('Join')-28;
      g.panel(x+14,y+fieldY,fieldW,19,{shadow:false});
      g.text(g.fit(value||'Enter code',fieldW-12),x+20,y+fieldY+6,{color:value?COLORS.ink:COLORS.muted});
      g.hit('party-code',x+14,y+fieldY,fieldW,19,editCode,'text');
      g.primary('party-join','Join',codeStacked?x+14:x+14+fieldW+8,codeStacked?y+fieldY+25:y+fieldY+1,()=>start(false));
      bonk.forEach((l,i)=>g.text(l.text,x+14,y+bonkY+i*11,{color:COLORS.muted}));
      message.forEach((l,i)=>g.text(l.text,x+14,y+bonkY+bonk.length*11+8+i*11,{color:COLORS.gold}));
    }
    g.button('party-close', 'Back', x + pw - 48, y + ph - 18, closeParty);
  },
});
