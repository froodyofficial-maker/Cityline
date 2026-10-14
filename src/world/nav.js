/* ---- navigation: grid breadth-first pathfinding for police, enemies and allies ---- */
function gbfs(sx,sz,tx,tz,G0){const G=G0||GG,cell=(x,z)=>[Math.max(0,Math.min(G.w-1,((x-G.x0)/G.res)|0)),Math.max(0,Math.min(G.h-1,((z-G.z0)/G.res)|0))];
 const fix=c=>{if(!G.occ[c[1]*G.w+c[0]])return c;for(let r=1;r<6;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){const a=c[0]+dx,b=c[1]+dz;if(a>=0&&b>=0&&a<G.w&&b<G.h&&!G.occ[b*G.w+a])return[a,b]}return c};
 /* parent + visit-stamp buffers live on the grid and are reused, and the search is capped, so chases across the big map stay cheap */
 if(!G.par){G.par=new Int32Array(G.w*G.h);G.vis=new Uint32Array(G.w*G.h);G.st=0}const par=G.par,vis=G.vis,st=++G.st;
 const s=fix(cell(sx,sz)),t=fix(cell(tx,tz)),q=[s[1]*G.w+s[0]];par[q[0]]=q[0];vis[q[0]]=st;const goal=t[1]*G.w+t[0];let qi=0;
 while(qi<q.length&&qi<24000){const c=q[qi++];if(c===goal)break;const cx=c%G.w,cz=(c/G.w)|0;for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const a=cx+dx,b=cz+dz;if(a<0||b<0||a>=G.w||b>=G.h)continue;const n=b*G.w+a;if(vis[n]===st||G.occ[n])continue;if(dx&&dz&&(G.occ[cz*G.w+a]||G.occ[b*G.w+cx]))continue;vis[n]=st;par[n]=c;q.push(n)}}
 if(vis[goal]!==st)return null;const path=[];let c=goal,k=0;while(c!==q[0]){if((k++)%2==0)path.push([G.x0+((c%G.w)+.5)*G.res,G.z0+(((c/G.w)|0)+.5)*G.res]);c=par[c]}return path.reverse()}
let CG=null;
function buildCityGrid(){const res=1.5,x0=-122,z0=-122,w=Math.ceil(246/res),h=Math.ceil(246/res),occ=new Uint8Array(w*h),R2=.9;
 const mark=b=>{const i0=Math.max(0,((b.x1-R2-x0)/res)|0),i1=Math.min(w-1,((b.x2+R2-x0)/res)|0),j0=Math.max(0,((b.z1-R2-z0)/res)|0),j1=Math.min(h-1,((b.z2+R2-z0)/res)|0);for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)occ[j*w+i]=1};
 for(const b of B)if(!b.air)mark(b);CG={x0,z0,res,w,h,occ}}
let WG=null;
function buildWorldGrid(){const res=2.5,x0=WB.x0-8,z0=WB.z0-8,w=Math.ceil((WB.x1-x0+8)/res),h=Math.ceil((WB.z1+40-z0)/res),occ=new Uint8Array(w*h),R2=.9;
 for(const b of B){if(b.air)continue;const i0=Math.max(0,((b.x1-R2-x0)/res)|0),i1=Math.min(w-1,((b.x2+R2-x0)/res)|0),j0=Math.max(0,((b.z1-R2-z0)/res)|0),j1=Math.min(h-1,((b.z2+R2-z0)/res)|0);for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)occ[j*w+i]=1}WG={x0,z0,res,w,h,occ}}
const inCG=(x,z)=>x>-120&&x<120&&z>-120&&z<120;
function cpath(e,tx,tz,dt){if((e.ct=(e.ct||0)-dt)<=0||!e.cpath||!e.cpath.length){e.ct=.6;const G=inCG(e.x,e.z)&&inCG(tx,tz)?CG:WG;e.cpath=G?(gbfs(e.x,e.z,tx,tz,G)||[]):[]}while(e.cpath.length&&Math.hypot(e.cpath[0][0]-e.x,e.cpath[0][1]-e.z)<1.2)e.cpath.shift();return e.cpath.length?e.cpath[0]:[tx,tz]}
