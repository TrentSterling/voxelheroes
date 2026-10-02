// Original reward silhouettes at character voxel scale. These fill the gaps
// in grant metadata; authored tool and story models keep their own designs.
import { DenseGrid } from '../../core/vox.js';
import { model, modelMesh } from '../kit.js';
import { heartContainerModel, tokenModel } from './items.js';

const GOLD=0xe9b832, LIGHT=0xffe6a2, DARK=0x394761;
const ACCENTS=[0xb0743c,0x72a9bd,0x996fcd,0xe3804e,0x5ab8ff,0xffdf8e];

export function shieldModel(tier=1) {
  tier=Math.max(1,Math.min(6,Math.floor(tier)));
  return model(`reward:shield:${tier}`,()=>{
    const g=new DenseGrid(10,11,3);
    g.box(1,0,0,9,11,2,GOLD);g.box(0,2,0,10,10,2,GOLD);
    g.box(1,2,1,9,10,3,ACCENTS[tier-1]);
    g.box(4,3,2,6,9,3,LIGHT);g.box(2,5,2,8,7,3,LIGHT);
    if(tier>1)for(const x of [2,7])g.box(x,8,2,x+1,9,3,0xffffff);
    return g;
  },{origin:[5,0,1.5]});
}

function sword(id) {
  const accent=id==='blade-dawn'?0xffd978:id==='blade-warden'?0x73d3c0:0xd9e5f0;
  const g=new DenseGrid(14,24,4);
  g.box(6,0,1,8,5,3,0x865236);g.box(5,0,1,9,2,3,GOLD);
  g.box(1,5,1,13,7,3,GOLD);g.box(5,4,0,9,8,4,GOLD);
  g.box(5,8,1,9,21,3,accent);g.box(6,8,2,7,22,3,0xffffff);
  g.box(6,21,1,8,23,3,accent);g.box(6,23,1,7,24,3,0xffffff);
  return g;
}

function boots(id) {
  const g=new DenseGrid(18,14,14),bog=id==='boots-swamp',leather=bog?0x437a69:0x985b3c;
  for(const x of [0,10]) {
    g.box(x,0,1,x+8,3,14,DARK);g.box(x,3,2,x+8,7,13,leather);
    g.box(x+1,7,2,x+7,13,8,leather);g.box(x,11,1,x+8,14,9,GOLD);
    g.box(x+2,6,9,x+6,7,13,LIGHT);g.box(x+2,8,7,x+6,10,9,GOLD);
  }
  return g;
}

function ring(id) {
  const g=new DenseGrid(14,15,5);
  g.ellipsoid(7,6,2.5,6,6,2.5,GOLD);
  g.ellipsoid(7,6,2.5,3.7,3.7,3,null);
  g.box(4,10,1,10,13,4,GOLD);
  g.box(5,11,1,9,15,4,id==='ring-half'?0x8264d6:0x5ab8ff);
  g.box(5,13,3,6,15,4,LIGHT);return g;
}

function key(id) {
  const c=id==='key-red'?0xe97670:id==='key-blue'?0x64baff:id==='key-green'?0x73cda0:GOLD;
  const g=new DenseGrid(14,20,4);
  g.ellipsoid(7,15,2,6,5,2,c);g.ellipsoid(7,15,2,2.5,2,3,null);
  g.box(6,1,1,9,12,3,c);g.box(8,2,1,13,5,3,c);g.box(8,7,1,12,9,3,c);
  g.box(4,17,3,7,18,4,LIGHT);return g;
}

function book(id) {
  const g=new DenseGrid(16,19,6);
  const c=id==='spell-freeze'?0x67c9e4:id==='spell-quake'?0xb08351:id==='spell-reflect'?0xc797dc:0x658cae;
  g.box(0,0,0,16,19,6,c);g.box(2,1,1,15,18,5,0xeadcba);
  g.box(0,0,5,16,19,6,c);g.box(0,0,0,3,19,6,GOLD);
  g.box(7,5,5,10,14,6,LIGHT);g.box(4,8,5,13,11,6,LIGHT);
  g.box(13,0,5,15,5,6,0xdb7868);return g;
}

function mapGrid() {
  const g=new DenseGrid(18,15,4);g.box(1,1,1,17,14,3,0xeadcba);
  for(const x of [0,16])g.box(x,0,0,x+2,15,4,GOLD);
  g.box(4,4,2,13,6,3,0x79978b);g.box(10,4,2,12,11,3,0x79978b);
  g.box(8,9,2,14,11,3,0xba6266);g.box(10,7,2,12,13,3,0xba6266);return g;
}

function jar() {
  const g=new DenseGrid(12,18,12);g.ellipsoid(6,7,6,5.7,7,5.7,0x63c6cf);
  g.box(3,12,3,9,15,9,0x5b8ac6);g.box(2,15,2,10,18,10,GOLD);
  g.box(3,7,10,5,11,11,LIGHT);return g;
}

function orb(id) {
  const tier=Number(id.split('-').at(-1))||1,c=ACCENTS[(tier-1)%6];
  const g=new DenseGrid(16,18,16);g.ellipsoid(8,9,8,7,7,7,c);
  g.box(3,0,3,13,3,13,GOLD);g.box(5,2,5,11,5,11,GOLD);
  g.box(4,10,13,6,13,15,LIGHT);return g;
}

function bag() {
  const g=new DenseGrid(14,17,12);g.ellipsoid(7,6,6,7,6,6,0x967255);
  g.box(3,9,2,11,14,10,0xb28b66);g.box(2,12,1,12,14,11,GOLD);
  g.box(6,13,4,8,17,6,DARK);g.box(3,4,10,11,8,12,DARK);
  g.box(6,5,11,8,8,12,GOLD);return g;
}

// Null remains meaningful for unknown extension grants. The native catalog
// audit must catch a new fanfare item without a model instead of hiding it.
export function rewardModel(id,kind=null) {
  let build;
  if(id.startsWith('shield-'))return()=>modelMesh(shieldModel(Number(id.slice(7))));
  if(id.startsWith('blade-')||kind==='sword')build=()=>sword(id);
  else if(id.startsWith('boots-'))build=()=>boots(id);
  else if(id.startsWith('ring-'))build=()=>ring(id);
  else if(id==='heart-piece')return()=>{const m=modelMesh(heartContainerModel());m.scale.setScalar(.7);m.name='heart-piece';return m;};
  else if(id==='token')return()=>modelMesh(tokenModel());
  else if(id==='magic-container')build=jar;
  else if(id==='map')build=mapGrid;
  else if(id.startsWith('key-'))build=()=>key(id);
  else if(id.startsWith('orb-'))build=()=>orb(id);
  else if(id.startsWith('spell-')||kind==='spell')build=()=>book(id);
  else if(id.startsWith('bomb-bag-'))build=bag;
  else return null;
  return()=>{const mesh=modelMesh(model(`reward:${id}`,build));mesh.name=`reward-${id}`;return mesh;};
}

export const rewardGlintModel=()=>model('reward:glint',()=>{
  const g=new DenseGrid(5,5,1);g.box(2,0,0,3,5,1,LIGHT);g.box(0,2,0,5,3,1,GOLD);return g;
});
