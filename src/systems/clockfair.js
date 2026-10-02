import { state, hasFlag } from '../core/state.js';
import { entities } from '../entities/manager.js';
import { grant, registerGrant } from './grants.js';

export const FAIR = { screen: 'mossbrook-fair:0,0', medal: 'fair:bell-medal', duration: 70,
  bells: [[3,3],[8,3],[12,3],[3,8],[8,8],[12,8]], pots: [[2,12],[4,12],[11,12],[13,12]] };
export const fairRequest = () => Math.max(0,...[...state.flags].map(f=>/^fair:start:(\d+)$/.exec(f)).filter(Boolean).map(m=>Number(m[1])));
export const fairBest = () => {
  const times=[...state.flags].map(f=>/^fair:time:(\d+)$/.exec(f)).filter(Boolean).map(m=>Number(m[1])/10);
  return times.length ? Math.min(...times) : null;
};
export const fairMachine = () => entities.find(e=>e.type==='fair-clock'&&!e.removed);
export const fairScore = mask => FAIR.bells.filter((_,i)=>mask&(1<<i)).length;
export function fairGoal() {
  const a=fairMachine()?.ai;
  if(a?.phase==='running')return `Bells ${fairScore(a.mask)}/6. Throw clay at the glowing bell; guard or dodge the wind-up notes.`;
  return 'Enter the brass fair arch in the southeast of Mossbrook Square. Read Wyll\'s board to start the six-bell trial.';
}
export function fairJournalEntry() {
  const done=hasFlag(FAIR.medal),started=fairRequest()>0,best=fairBest();
  return {id:'clockfair',title:'The Bells We Borrow',giver:'Tinker Wyll',where:'Mossbrook Clockfair',status:done?'done':started?'active':'offer',
    detail:done?'Six bells rang together. The first medal is earned; the board still offers repeat attempts to improve your time. A friend can share the same round or explore elsewhere.':fairGoal(),
    progress:best===null?'Six bells, seventy seconds':`Best: ${best.toFixed(1)} seconds`,reward:'First medal: 60 coins; repeat for a better time'};
}

registerGrant('fair-medal',()=>grant('coins',60,{source:'fair-medal',fanfare:false}),{name:'Clockfair Medal',fanfare:false});
