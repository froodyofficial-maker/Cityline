/* ================= v9: STORY — "EMBER CITY: ASHES" (world additions, cutscenes, missions) ================= */
const GAR=[115,44],GFC=[115,31],CASX=2400,CASZ=2400,ROOFY=16.06;
/* --- Okafor Auto (Dex's garage) + freight-yard props, built into the world for story & free roam --- */
(function(){const gx=GAR[0],gz=GAR[1];WK=5;wall(14,6,12,0x8a9098,gx,gz);foot(gx,gz,14,12,6);bx(7.2,4.4,.3,0x0e0e12,gx-2,2.26,gz-6.02,sc);bx(7.4,1.1,.4,0xa0a6ae,gx-2,3.95,gz-6.1,sc);for(let i=0;i<6;i++)bx(7.3,.06,.42,0x6a7078,gx-2,3.45+i*.18,gz-6.12,sc);
 bx(2.2,2.4,.2,0x2a2a30,gx+4.2,1.26,gz-6.02,sc);nb(1.4,.9,.05,0xffd27a,gx+4.2,1.7,gz-6.15);const q=nsign('OKAFOR AUTO','#5aa8ff',gx+1,6.9,gz-6.12,9);q.rotation.y=PI;
 bx(18,.07,12,0x8d8b86,gx,.035,gz-12,sc);for(let i=0;i<5;i++)cy(.45,.32,0x1a1a1a,gx+6.4,.16+i*.31,gz-7.4,12);for(let i=0;i<3;i++)cy(.45,.32,0x1a1a1a,gx+7.4,.16+i*.31,gz-8.1,12);
 for(const[x,c]of[[-6.4,0xb03030],[-5.5,0x2b6fd0],[-6,0xb03030]])cy(.38,1.1,c,gx+x,.55,gz-7+(x==-6?-.9:0),12);bx(3,1,1,0x5a4a3a,gx+5,.5,gz-9.8,sc);bx(.3,1.6,.3,0x444,gx+3.8,.8,gz-9.8,sc);
 const wk=car(0x7a5a3a,0);setCar(wk,gx-8.6,gz-11,.15);wk.g.position.y=.55;for(const[x,z]of[[-9.4,-12.3],[-7.8,-12.3],[-9.4,-9.7],[-7.8,-9.7]])bx(.5,.55,.5,0x555,gx+x,.27,gz+z,sc);
 for(const[x,z]of[[261,2],[262.6,2],[261.8,3.6]])bx(1.5,1.5,1.5,0x8a6a3a,x,.75,z,sc);B.push({x1:260,x2:263.6,z1:1.2,z2:4.6,h:1.6});
 WK=5;wall(6.2,2.7,2.7,0xa83a2a,300,-2);foot(300,-2,6.2,2.7,2.7);bx(.1,2.4,2.4,0x7a2a1e,303.15,1.3,-2,sc);
 for(const x of[292,308])bx(2.4,2.4,2.4,0x2b6f9a,x,1.26,-3,sc);B.push({x1:290.8,x2:293.2,z1:-4.2,z2:-1.8,h:2.5},{x1:306.8,x2:309.2,z1:-4.2,z2:-1.8,h:2.5})})();
/* --- persistent world hooks --- */
function storyWorldU(){}
const vset=(c,x,z,h)=>{setCar(c,x,z,h);c.sp=0;c.v=0;c.mode='park'};const vgo=(c,x,z,h,top)=>{c.mode='goto';c.gt=[x,z,h];c.top=top||10};
const cafeSt=()=>shops.find(s=>s.name=='CAFE').st,cafeClerk=()=>clerks.find(c=>c.st===cafeSt());
const bankLad=()=>ladders.find(l=>Math.abs(l.roofY-ROOFY)<.3&&Math.abs(l.x+11)<2)||ladders[0];
function nicoAt(x,z,h){place('NICO',x,z,h);camYaw=h;P.h=h}
/* ===================== CUTSCENES ===================== */
const CS={};
CS.pro1=A=>[
 {fade:0,fs:2,title:['HOMECOMING','PROLOGUE · EMBER CITY · SIX YEARS LATER',5],c:[-70,62,130,0,8,0],c2:[30,40,95,40,4,10],on:()=>{nicoAt(116,27.5,-PI/2);hideAll();objSet('')},l:[["NICO","Six years. Two thousand, one hundred and ninety-one days."],["NICO","You count them at first. Then you stop. Counting is how they get you."]]},
 {fol:['NICO',-2.6,1.6,4.2,1.3],on:()=>{walk('NICO',99.5,25.4,1.35)},l:[["NICO","The van left me at the edge of the bridge. No bus fare. No phone. A plastic bag with a shirt in it that doesn't fit anymore."],["NICO","Ember City looks exactly the same. It never changes. It just gets more expensive."]]},
 {d:4.6,c:[94,1.4,31,108,1.1,17],on:()=>{const c=svCar('mara',0x3fb8af,0,150,17,-PI/2,{top:15});c.keep=1;vgo(c,101,17,-PI/2,15)},ev:[[3.6,()=>{snd(420,.18,'square',.05);setTimeout(()=>snd(420,.25,'square',.05),220)}]]},
 {on:()=>{vset(A.v.mara,101,17,-PI/2);nicoAt(99.5,25.2,PI);place('MARA',101.6,19.3,0);walk('MARA',100.2,22.6,1.3);face('NICO','MARA')},two:['NICO','MARA',4.4,-1],l:[["MARA","You look old."],["NICO","You look... grown up."],["MARA","That happens. When you're gone for six years."],["NICO","Mara, I—"]]},
 {cu:['MARA',1.6],l:[["MARA","Don't. Not on the side of the road, Nico."],["MARA","Get in. I'm double parked and I can't afford the ticket."]],post:()=>{face('MARA',null)}}];
CS.pro2=A=>[
 {c:[-29,2.3,23,-40,1.4,11],on:()=>{const c=A.v.mara;if(c){vset(c,-33,17.2,-PI/2)}nicoAt(-35.5,14.8,PI*1.05);place('MARA',-37.2,14.6,PI);walk('NICO',-39.2,12.9,1.3);walk('MARA',-41,13.1,1.3);place('SAL',-40.2,10.6,0,'cross');place('THUG1',-42.7,10.9,.3,'lean');face('SAL','NICO')},
  l:[["SAL","Mara Vance. Right on time. And look who it is."],["SAL","The famous brother. Victor said you'd be out this week. Victor's always right."]]},
 {ots:['NICO','SAL'],on:()=>{face('NICO','SAL');face('MARA','SAL')},l:[["MARA","It's not the first of the month, Sal."],["SAL","Mr. Calloway is adjusting the schedule. Interest went up. Twelve grand. Friday."]]},
 {cu:['NICO',1.7],l:[["NICO","Twelve grand for what? Mara — what is he talking about?"],["MARA","Not now, Nico."]]},
 {two:['SAL','NICO',4.6],l:[["SAL","Oh, she didn't tell you? Your mother's hospital bills. Sixty thousand dollars of chemo, courtesy of the Calloway Community Fund."],["SAL","Now it's a hundred and twenty. Victor's a generous man. But he charges for it."]]},
 {cu:['NICO',1.5],l:[["NICO","Walk away, Sal."]]},
 {ots:['SAL','NICO'],l:[["SAL","Or what, jailbird? You gonna violate parole on your first day home?"]],ev:[[1.4,()=>{walk('SAL',-40.6,12,2.5);setTimeout(()=>{walk('MARA',-42.2,14.4,3);anim('MARA','hurt');snd(120,.15,'sawtooth',.06)},350)}]]},
 {cu:['NICO',1.3,.1],d:3.2,l:[["NICO","...Yeah. I think I am."]],post:()=>{hideN('SAL');hideN('THUG1');hideN('MARA')}}];
CS.pro3=A=>[
 {fade:0,fs:1,c:[OX+6,2.6,OZ+8,OX+1.5,1,OZ+5.6],on:()=>{HOME=HOME||{home:1,ret:{x:apt.x,z:apt.z+1.5},exit:aexit};IN=HOME;place('MARA',OX+1.3,OZ+6.25,PI,'sit').seat=.92;nicoAt(OX+3.6,OZ+3.6,-PI*.75);face('NICO','MARA')},
  l:[["MARA","Are you insane? You just started a war with the Calloways. On your first day home."],["NICO","They put their hands on you."],["MARA","They've done worse. And I handled it. For six years I handled it, while you were—"]]},
 {cu:['MARA',1.5],l:[["MARA","...I'm sorry. That's not fair."],["NICO","It's fair. Tell me about the money."]]},
 {two:['NICO','MARA',3.4,-1],l:[["MARA","Mom got sick the year after you went in. Insurance laughed at us. Then Calloway's people started showing up at the hospital. 'Community loans. No credit check.'"],["MARA","I signed. I'd sign again. She got eight more months. She got to see me start nursing school."]]},
 {c:[OX+2.75,1.6,OZ+5.1,OX+3.6,1.42,OZ+3.6],c2:[OX+2.85,1.58,OZ+4.95,OX+3.6,1.42,OZ+3.6],on:()=>{face('NICO','MARA')},l:[["NICO","Then it's my debt too."]]},
 {cu:['MARA',1.5],on:()=>{anim('MARA','sit')},l:[["MARA","No. You get a job. You check in with your parole officer. You stay out of it."],["MARA","Please, Nico. I can't lose you again. I can't do another six years of visiting hours."],["NICO","You won't."]]},
 {c:[OX-4,2.2,OZ+8.5,OX+2,1.2,OZ+5],c2:[OX-5.5,2.8,OZ+9.5,OX+2,1.2,OZ+5],l:[["NICO","It was the first lie I'd told her since I got home."],["NICO","It wouldn't be the last."]],post:()=>{hideN('MARA');nicoAt(OX+1,OZ+5,PI)}}];
CS.dex1=A=>[
 {c:[GFC[0]+9,2.2,GFC[1]-6,GAR[0]-2,1.6,GAR[1]-6],c2:[GFC[0]+6,1.9,GFC[1]-3,GAR[0]-2,1.2,GAR[1]-6],on:()=>{nicoAt(GFC[0]+3,GFC[1]-3,-.3);place('DEX',GAR[0]-2.6,GAR[1]-8.6,PI*.8,'work');walk('NICO',GAR[0]-.8,GAR[1]-9.8,1.3)},
  l:[["DEX","Imani, baby, hand me the ten millimeter—"],["DEX","...Nico?"]]},
 {two:['DEX','NICO',4.2],on:()=>{anim('DEX','idle');face('DEX','NICO');face('NICO','DEX')},l:[["DEX","NICO VANCE. Look at you! Six years and you still got that face like somebody owes you money."],["NICO","Somebody does. Hey, Dex."]],ev:[[2.6,()=>{walk('DEX',GAR[0]-1.6,GAR[1]-9.5,2);setTimeout(()=>{anim('DEX','hug');anim('NICO','hug')},700)}]]},
 {cu:['DEX',1.7],on:()=>{anim('DEX','idle');anim('NICO','idle')},l:[["DEX","Why didn't you call? I would've picked you up, man!"],["NICO","Mara picked me up. She told me about the debt. And about who you work for now."]]},
 {ots:['NICO','DEX'],l:[["DEX","...Yeah. Okay. Look — the garage was going under. Calloway sends cars my way, I fix 'em, I don't ask. That's all it is."],["NICO","That's never all it is."],["DEX","You want to lecture me, or you want to help your sister? 'Cause I can help you help her."]]},
 {cu:['DEX',1.6,-.3],l:[["DEX","There's a car. Calloway's nephew parks it outside the Golden Ember like he owns the street. Comet SR. Cherry red."],["DEX","Buyer up north pays twenty for it. No questions."],["NICO","Stealing from Calloway's family to pay Calloway."],["DEX","Poetry, right?"]]},
 {two:['NICO','DEX',4.8,-1],l:[["DEX","Not a scratch on it. And if the cops get on you, you lose 'em before you come back here. I got a daughter sleeps upstairs."],["NICO","Imani. She must be what — eleven now?"],["DEX","Twelve. Smarter than both of us put together. Go."]],post:()=>{anim('DEX','work');nicoAt(GAR[0]-.8,GAR[1]-11,PI)}}];
CS.dex2=A=>[
 {c:[GFC[0]-7,2,GFC[1]+1,GAR[0]-1,1.2,GAR[1]-9],on:()=>{const c=A.v.comet;if(c&&P.car===c){P.car=null}if(c)vset(c,GAR[0]-3,GAR[1]-10,PI);nicoAt(GAR[0]+.4,GAR[1]-11.2,-PI*.6);place('DEX',GAR[0]+2.6,GAR[1]-9,PI*1.2);face('DEX','NICO');face('NICO','DEX')},
  l:[["DEX","Not a scratch. Damn. You still got it."],["DEX","Twenty. Well — eighteen. I took two for the plates. Business."]]},
 {cu:['NICO',1.6],l:[["NICO","That's not even a sixth of what she owes."],["DEX","Rome, brother. Wasn't built in a day."]]},
 {cu:['DEX',1.5],l:[["DEX","Nico... about that night. Six years ago. I never got to say—"],["NICO","You don't have to."],["DEX","I do. You came back for me. You could've driven away and you came back, and they got you instead of me."],["DEX","I think about that every day."]]},
 {two:['NICO','DEX',4],l:[["NICO","Then stop thinking about it. We're square."],["DEX","...Yeah. Square."]],post:()=>{walk('NICO',GAR[0]+6,GAR[1]-20,1.4)}},
 {d:3.2,c:[GAR[0]+4,1.7,GAR[1]-14,GAR[0]+2.6,1.4,GAR[1]-9],on:()=>{anim('DEX','down')}},
 {cu:['DEX',1.4,.3],on:()=>{anim('DEX','phone');hideN('NICO')},ev:[[.2,()=>{for(let i=0;i<3;i++)setTimeout(()=>snd(880,.12,'square',.03),i*260)}]],l:[["DEX","...Yeah. He's out."],["DEX","No. No, he doesn't know anything."],["DEX","I said he doesn't know, Victor."]],post:()=>{hideN('DEX');nicoAt(GAR[0]+5,GAR[1]-18,PI)}}];
CS.lena1=A=>[
 {c:[14,9,-18,0,1,-38],c2:[8,5,-24,0,1,-44],on:()=>{nicoAt(0,-26,PI);walk('NICO',.6,-46.6,1.4);place('LENA',0,-49,0,'sit')},l:[["NICO","The text said: Fountain park. Ten o'clock. Come alone. — L."],["NICO","There was only one L who ever had my number."]]},
 {two:['LENA','NICO',4.6],on:()=>{face('NICO','LENA')},l:[["LENA","You're late. Six years late, actually."],["NICO","Lena. They made you a detective."],["LENA","Detective Cruz. Organized Crime. Don't look so surprised. Somebody had to clean up after people like you."]]},
 {cu:['LENA',1.6],on:()=>{anim('LENA','idle');place('LENA',0,-49,0)},l:[["LENA","You put three of Calloway's collectors in the hospital yesterday. One of them won't use his left hand again."],["LENA","Your parole officer would love that report."],["NICO","So arrest me."],["LENA","I lost the report, Nico. That's why you're not in a cell."]]},
 {ots:['NICO','LENA'],l:[["NICO","What do you want?"],["LENA","Calloway. I've wanted him for three years. Since my partner — Antonio Ruiz — was pulled out of the river with his badge in his mouth."],["LENA","Everybody knows Victor did it. Nobody can prove it. Every case I build disappears on Captain Harlan's desk."]]},
 {cu:['NICO',1.6],l:[["NICO","So you want an errand boy who can't say no."]]},
 {two:['NICO','LENA',4.3,-1],l:[["LENA","I want someone with a reason to want him gone. You have a sister with a hundred and twenty thousand reasons."],["LENA","Every Thursday a courier leaves the Golden Ember with a bag of cash. He drops it somewhere we've never found. Follow him. Don't get spotted. Find me the drop."],["NICO","And if I say no?"]]},
 {cu:['LENA',1.4],l:[["LENA","Then you're a parole violator who assaulted three men."],["LENA","...Please don't make me do that, Nico."],["NICO","You used to say please like you meant it."],["LENA","I still do. That's the problem."]],post:()=>{const c=svCar('lcar',0x2a3038,0,8,-23,PI/2);c.free=1;c.keep=1;hideN('LENA');nicoAt(3,-27,PI/2)}}];
CS.photo=A=>[
 {c:[271,1.7,6.2,286.5,1.3,11.8],c2:[272,1.6,6.6,286.5,1.3,11.8],fov:42,on:()=>{nicoAt(262,5,PI*.55);anim('NICO','kneel');const c=A.v.cour;if(c)vset(c,287,9,PI/2);place('COURIER',285.6,11.3,PI/2,'idle');place('HARLAN',288.2,12.4,-PI/2,'cross');place('THUG1',284,14.8,PI,'cross');face('COURIER','HARLAN');face('HARLAN','COURIER')},
  l:[["COURIER","Same as always, Captain. Count it if you want."],["HARLAN","If I wanted to count, I'd have become an accountant. Tell Victor the Delacroix thing is handled. Nobody's reopening anything."]],ev:[[1,()=>{$('fx').style.background='#fff';$('fx').style.opacity=.6;setTimeout(()=>$('fx').style.opacity=0,80);snd(1500,.05,'square',.04)}],[3.4,()=>{$('fx').style.opacity=.6;setTimeout(()=>$('fx').style.opacity=0,80);snd(1500,.05,'square',.04)}]]},
 {cu:['NICO',1.4,.4],l:[["NICO","(whispering) Lena. Your captain's here. He's taking the bag."],["RADIO","...Harlan. You son of a— Get the photos and get out of there, Nico."]],ev:[[.5,()=>{$('fx').style.opacity=.6;setTimeout(()=>$('fx').style.opacity=0,80);snd(1500,.05,'square',.04)}]]},
 {cu:['HARLAN',1.8],l:[["HARLAN","...Did you hear that? Somebody's by the crates."],["HARLAN","Handle it. I was never here."]],post:()=>{hideN('HARLAN');hideN('COURIER');hideN('THUG1');anim('NICO','idle');const c=A.v.cour;if(c){c.top=20;svRoute(c,[[270,20],[180,20],[120,20]],20)}}}];
CS.lena2=A=>[
 {c:[56,4,-30,66,1.2,-22],on:()=>{if(P.car){P.car.v=0;P.car=null}nicoAt(63.5,-23.6,PI/2);place('LENA',66,-23.2,-PI/2,'cross');face('NICO','LENA');face('LENA','NICO')},l:[["LENA","These are... Nico, these are enough for a federal warrant. Harlan, taking cash from Calloway's courier."],["NICO","So arrest him."]]},
 {ots:['NICO','LENA'],l:[["LENA","Harlan is a captain. If I take this through the department, it disappears. And so do I."],["LENA","I need the source. Calloway's books — the real ones. Who he pays, how much, since when."],["NICO","And where are those?"],["LENA","If I knew that, I wouldn't need a felon."],["NICO","Charming."]]},
 {cu:['LENA',1.5],on:()=>{anim('LENA','idle')},l:[["LENA","...You look good, Nico. Prison suited you. You stopped talking so much."],["NICO","You stopped smiling."],["LENA","Ruiz used to make me smile. Bad jokes. Every single morning."],["LENA","Go home. Stay alive. I'll call you."]],post:()=>{hideN('LENA')}}];
CS.cafe1=A=>{const st=cafeSt(),ox=st.ox,oz=st.oz;return[
 {fade:0,c:[ox-5,2.6,oz+4,ox+3,1.3,oz-3],on:()=>{IN=st;const cl=cafeClerk();if(cl)cl.g.visible=false;place('MARA',ox+4.6,oz-5,0,'idle');nicoAt(ox+3.6,oz-2.1,PI);face('NICO','MARA');face('MARA','NICO')},l:[["MARA","Don't sit there, that stool's broken. Sit here."],["NICO","So this is the Sunrise."],["MARA","Mr. Okonkwo's place. He hired me when nobody would hire 'the convict's sister.' Pays for night classes."]]},
 {two:['NICO','MARA',3,1],l:[["NICO","Nursing school. Mom told me, in her last letter. She was so proud she spelled it wrong."],["MARA","She spelled everything wrong. She never had time to learn properly. She was always working."],["MARA","Her nurses were the only people who were kind to us at the end. I want to be that for somebody."]]},
 {cu:['NICO',1.5],l:[["NICO","She'd be proud of you, Mara."]]},
 {cu:['MARA',1.5],l:[["MARA","She'd kill you for the thing with Sal."],["MARA","And then she'd make you soup."]],ev:[[4,()=>{snd(70,.6,'sawtooth',.06)}]]},
 {c:[ox+2,2.4,oz-4.6,ox,1.2,oz+3],on:()=>{place('BRICK',ox,oz+4.6,PI,'idle');walk('BRICK',ox+1,oz+.4,1.6);place('THUG1',ox-1.5,oz+4.6,PI);walk('THUG1',ox-1.4,oz+2,1.6);place('THUG2',ox+1.8,oz+4.6,PI);walk('THUG2',ox+2.6,oz+2.4,1.6);face('MARA','BRICK')},l:[["BRICK","Okonkwo! Where's my envelope, old man?"]]},
 {ots:['MARA','BRICK'],l:[["MARA","He's sick today, Brick. There's no money this week — the street's been dead since the bridge closed—"],["BRICK","Then I guess the windows are gonna be dead too."]]},
 {ots:['BRICK','NICO',-1],on:()=>{face('NICO','BRICK');face('BRICK','NICO')},l:[["NICO","There's a guy in the hospital who tried something like this yesterday."]]},
 {cu:['BRICK',2.1],l:[["BRICK","You're the brother. Victor said you'd be trouble."],["BRICK","(to his men) Burn the block. Every shop that's late. Start with this one."]],post:()=>{hideN('BRICK');hideN('THUG1');hideN('THUG2');hideN('MARA');IN=0;nicoAt(0,48,PI)}}]};
CS.brick1=A=>{const c=A.v.brick,x=c?c.x:0,z=c?c.z:0;return[
 {c:[x+6,2.2,z+6,x,.8,z],on:()=>{if(P.car){P.car.v=0;P.car=null}place('BRICK',x+2.6,z+1.4,PI*.25,'kneel');nicoAt(x+5.4,z+4.2,-PI*.7);face('NICO','BRICK');face('BRICK','NICO')},l:[["BRICK","(coughing) You think this ends with me? Victor's got fifty guys like me."],["NICO","Then I'll have a busy week. Why does Victor care about one café?"]]},
 {cu:['BRICK',1.9],l:[["BRICK","It's not the café, genius. It's the street. One shop stops paying, they all stop paying."],["BRICK","Victor owns this city one envelope at a time."]]},
 {cu:['NICO',1.6],on:()=>{anim('NICO','gun')},l:[["NICO","Tell him the Sunrise is under new management."]]},
 {two:['BRICK','NICO',4.2],l:[["BRICK","Tell him yourself. He wants to meet you. Golden Ember, tomorrow night."],["BRICK","He said to tell you... “Rosa's boy.”"],["NICO","...How does he know my mother's name?"],["BRICK","(laughing, coughing) He knows everybody's mother's name."]],post:()=>{anim('NICO','idle');hideN('BRICK')}}]};
CS.cas0=A=>[{c:[52,3,28,40,6,10],c2:[47,1.8,22,40,5,10],on:()=>{nicoAt(40,17,PI)},l:[["NICO","The Golden Ember. My mother cleaned its offices for nine years. She used to say the carpets were worth more than our whole building."],["NICO","I'd never been inside."]]}];
CS.victor1=A=>{const ox=CASX,oz=CASZ;return[
 {fade:0,c:[ox-6,3.4,oz+6,ox+2,1.4,oz-3],on:()=>{IN=CAS;$('md').style.display='none';mode='play';nicoAt(ox-1.5,oz+1,PI*.8);walk('NICO',ox+1.1,oz-2,1.3);place('VICTOR',ox+3,oz-4.4,-PI*.75,'idle');place('THUG1',ox+4.6,oz-6,-PI*.6,'cross');place('THUG2',ox+1.6,oz-6.4,-PI*.9,'cross');face('VICTOR','NICO')},l:[["VICTOR","Rosa Vance's son. You have her eyes. Not her patience, I hear."]]},
 {two:['NICO','VICTOR',3.6],on:()=>{face('NICO','VICTOR')},l:[["NICO","You knew my mother."],["VICTOR","She cleaned my offices for nine years. Never stole so much as a paperclip. Do you know how rare that is, in this city?"],["VICTOR","I paid for her funeral. Did Mara tell you that? The lilies were my idea."]]},
 {cu:['NICO',1.6],l:[["NICO","She told me you're bleeding her for a hundred and twenty thousand dollars."]]},
 {cu:['VICTOR',1.7,-.35],l:[["VICTOR","I gave your mother eight more months of life. Interest is just the price of time, Nico. Everything costs time."],["VICTOR","You should know. You paid six years for somebody else's mistake."]]},
 {ots:['NICO','VICTOR'],l:[["NICO","What do you want?"],["VICTOR","To make you an offer. I need a driver. The best. Everyone says you were the best, before your... sabbatical."],["VICTOR","One job. One delivery to the airport. Do it, and Mara's debt is gone. Torn up. Forgiven."]]},
 {cu:['NICO',1.4],l:[["NICO","And if I say no?"]]},
 {cu:['VICTOR',1.45,.2],l:[["VICTOR","Then nothing happens. Nothing at all."],["VICTOR","Mara walks home from night class at eleven-fifteen. Tuesdays and Thursdays. Down Fourth Street, under the broken lamp."],["VICTOR","And nothing happens to her."]]},
 {cu:['NICO',1.3,.1],d:3.5,l:[["NICO","...When?"]]},
 {two:['VICTOR','NICO',4.4,-1],on:()=>{walk('VICTOR',ox-5,oz+7,1.2)},l:[["VICTOR","Soon. Dex will give you the van. Oh — and Nico?"],["VICTOR","Detective Cruz is a lovely woman. Lovely. It would be such a shame if she ended up like her partner."],["VICTOR","Give her my regards."]]},
 {c:[ox+3,2.2,oz-1,ox-1,1.4,oz+2],l:[["NICO","He knew about Lena. He knew about everything."],["NICO","The only question was how."]],post:()=>{hideN('VICTOR');hideN('THUG1');hideN('THUG2');nicoAt(ox,oz+4,PI)}}]};
CS.lena3=A=>[
 {c:[58,3.4,-31,66,1.3,-22],on:()=>{if(P.car){P.car.v=0;P.car=null}nicoAt(63.5,-23.6,PI/2);place('LENA',66,-23.2,-PI/2,'lean');face('NICO','LENA');face('LENA','NICO')},l:[["NICO","Victor knows about you. He told me to give you his regards."],["LENA","Then he knows I'm getting close. Good. Scared men make mistakes."],["LENA","I pulled the old files. Before Calloway, the west side belonged to the Delacroix family. Remy Delacroix ran it."]]},
 {ots:['NICO','LENA'],l:[["LENA","Ten years ago, Remy disappeared. Calloway owned everything within a month."],["NICO","Let me guess. Remy's in the river."],["LENA","Never found. But Remy's accountant told a grand jury that Remy kept a ledger. Every payoff, every cop, every judge. Including Victor's first 'investments.'"],["LENA","The accountant died before his second day of testimony. The ledger was never found."]]},
 {cu:['LENA',1.6],l:[["LENA","I think his mother has it. Ma Delacroix. Eighty-one years old. She still lives in the family house on the west side."],["NICO","So we knock and ask nicely."],["LENA","The last process server who knocked on her door got talked out of his own job. He runs her errands now."]]},
 {two:['NICO','LENA',4.2,-1],l:[["LENA","Forty years running the cranes at the Ember docks. Half the longshoremen in this city learned their trade from her, and every one of them would walk through a wall for her. Nobody on the west side calls her anything but 'Ma.'"],["NICO","You're sending me to shake down an old woman."],["LENA","I'm sending you to ask an old woman for help. And Nico — Victor's people watch that house. Expect company."],["LENA","Be polite. She can smell a liar from the end of the street."]],post:()=>{hideN('LENA')}}];
CS.ma1=A=>{const d=MAH.door,cx=MAH.cx,hz=MAH.hz;return[
 {c:[cx+6,1.9,hz+14,cx,1.5,hz+7],on:()=>{nicoAt(cx,hz+9.6,PI);walk('NICO',cx,hz+8.2,1.1);place('MA',d.x,d.z-.3,0,'cross');face('MA','NICO')},l:[["MA","That's close enough. One word from me and every porch on this street empties, so choose your next one carefully."]]},
 {ots:['NICO','MA'],l:[["NICO","Ma'am, I'm not here to hurt you. I'm here about Remy's book."],["MA","Nobody ever is. And yet you're the third man on my porch this month asking about my son's book. The other two worked for Victor."]]},
 {cu:['MA',1.4],l:[["MA","...Step into the light. Let me see your face."],["MA","You're Rosa's boy. Rosa Vance."],["NICO","You knew my mother?"]]},
 {cu:['MA',1.35,-.3],on:()=>{anim('MA','idle')},l:[["MA","Rosa cleaned this house for eleven years, before she went to work for that snake Calloway. She used to bring a little boy with a runny nose who broke my Chinese vase."],["MA","That was you."]]},
 {cu:['NICO',1.35],l:[["NICO","...I'm sorry about the vase."],["MA","You should be. It was ugly, but it was mine."]]},
 {ots:['MA','NICO'],l:[["MA","Why do you want Remy's book?"],["NICO","To bury Victor Calloway."]]},
 {cu:['MA',1.3],l:[["MA","Victor sat at my kitchen table. Ate my gumbo. Called me 'Mama.'"],["MA","Then my Remy went out one night to meet him and never came home."],["MA","Ten years I kept that book under the floorboards. Waiting for somebody with enough spine to use it."]]},
 {two:['NICO','MA',3.6],l:[["MA","Half of it's gone. Remy tore out the last pages the night he died — the pages about Victor. Hid them somewhere. I never found where."],["NICO","Then I'll find them."],["MA","You'll get yourself killed, is what you'll do."]]},
 {cu:['MA',1.3,.25],on:()=>{place('MA',d.x,d.z-.3,0,'idle')},l:[["MA","...Wait here."]],pad:1.6,post:()=>{walk('MA',d.x,d.z-2,1)}},
 {cu:['MA',1.35],on:()=>{place('MA',d.x,d.z-.3,0,'idle')},l:[["MA","Here. Wrapped in my good tablecloth. Don't you dare get gravy on it."],["MA","And Rosa's boy? Come back alive. I want my vase money."]],ev:[[6,()=>{snd(300,.15,'square',.05)}]]},
 {c:[cx+6,2.4,MAH.cz+14,cx,1.4,MAH.cz+18],d:4,on:()=>{for(const[x,z]of[[-74,24],[-86,23],[-80,26]])place(x==-74?'THUG1':x==-86?'THUG2':'SAL2',x,z,PI)},l:[["MA","...Hm. You brought friends."],["NICO","They're not mine."]],post:()=>{hideN('THUG1');hideN('THUG2');hideN('SAL2');nicoAt(cx+1.5,hz+9.6,0)}}]};
CS.ma2=A=>[
 {c:[MAH.cx+5,2,MAH.cz+11,MAH.cx,1.2,MAH.cz+8],on:()=>{nicoAt(MAH.cx+1.8,MAH.cz+9,-PI*.6);const m=npc('MA');m.anim='idle';face('MA','NICO');face('NICO','MA')},l:[["MA","Ten years I waited for Victor's boys to come for me. Took their sweet time."],["NICO","You can still shoot, Ma."],["MA","My hands shake when I make coffee, child. Not when I make a point."],["NICO","They followed me here. I'm sorry."],["MA","Don't be. I was getting bored."]]},
 {cu:['MA',1.3],l:[["MA","Go on. Find those pages. And Nico — Victor knew you'd come here. Somebody close to you is talking."],["MA","You remember that, when you decide who to trust."]],post:()=>{hideN('MA')}}];
CS.dex3=A=>[
 {c:[GFC[0]-6,2.2,GFC[1]-3,GAR[0],1.3,GAR[1]-9],on:()=>{nicoAt(GAR[0]-4,GAR[1]-12.6,PI*.7);place('DEX',GAR[0]-1.2,GAR[1]-14,-PI*.4,'cross');face('DEX','NICO');face('NICO','DEX');const v=svCar('van',0xe8e8e8,2,GAR[0]+3,GAR[1]-13,PI);v.free=1},l:[["DEX","Victor's van. Don't open the back. I mean it, Nico. Whatever's in there, we don't want to know."],["NICO","You know."]]},
 {cu:['DEX',1.5],l:[["DEX","I know it's going on a plane at seven, and you're driving it there, and then Mara's free. That's what I know."]]},
 {ots:['NICO','DEX'],l:[["NICO","Dex. How does Victor know about Lena?"]]},
 {cu:['DEX',1.3,.2],on:()=>{anim('DEX','idle')},d:2.4},
 {cu:['DEX',1.45,-.2],l:[["DEX","Lena? Lena Cruz? I — how would I know how Victor knows anything? Man's got ears in every wall in this city."],["NICO","Yeah. Every wall."],["DEX","First the casino loading dock. Then hangar three. The pilot's name is Ortega. Don't be late. Victor hates late."]],post:()=>{hideN('DEX');nicoAt(GAR[0]+1,GAR[1]-14.5,PI)}}];
CS.run1=A=>[
 {c:[296,2.2,24,285,1.2,14],on:()=>{const v=A.v.van;if(P.car===v){P.car=null}if(v)vset(v,297,18,-PI/2);nicoAt(294,16,-PI*.6);place('ORTEGA',286,13.6,0,'dead');place('THUG1',282,24.3,PI*.8,'gun');place('THUG2',289,24.5,-PI*.8,'gun');face('NICO','ORTEGA')},l:[["NICO","Ortega?"]]},
 {cu:['NICO',1.4],l:[["NICO","...He's been dead for an hour."]],ev:[[2.2,()=>snd(260,.1,'square',.04)]]},
 {ots:['NICO','THUG1'],d:3.2,l:[["THUG","Victor says hi, Vance."]],post:()=>{hideN('THUG1');hideN('THUG2')}}];
CS.run2=A=>[
 {c:[300.5,1.6,22.6,297,1,18],on:()=>{const v=A.v.van;nicoAt(299.6,18,-PI/2);anim('NICO','idle')},l:[["NICO","The van was empty. No cargo. No crates. Just an envelope, taped to the floor."]]},
 {cu:['NICO',1.2,.2],on:()=>{anim('NICO','phone')},l:[["NICO","Inside: a photo of Mara, taken this morning, outside the Sunrise. And a note."],["NICO","“Rosa's boy. You should have said no.”"]],ev:[[6,()=>{for(let i=0;i<3;i++)setTimeout(()=>snd(880,.12,'square',.03),i*260)}]]},
 {cu:['NICO',1.4,-.2],l:[["VICTOR","Did you think I wouldn't find out? You drank my whiskey while you were whispering to Detective Cruz."],["NICO","Where is she?"],["VICTOR","Mara is safe. Mara is, at this moment, eating a very nice breakfast. Whether she has lunch is up to you."]]},
 {c:[304,3.4,26,297,1.3,18],l:[["VICTOR","Bring me Ma Delacroix's little book. Yes — I know about that, too. Calloway Freight yard. Tonight. Alone."],["NICO","Victor. If you touch her—"],["VICTOR","You'll what? Count the days? I'm told you're good at that."]]},
 {cu:['NICO',1.3],l:[["NICO","There was only one person who knew about the ledger, who knew about Lena, who knew where I'd be every step of the way."],["NICO","Dex."]],post:()=>{anim('NICO','idle')}}];
CS.dex4=A=>[
 {on:()=>{setRain(1);nicoAt(GAR[0]+3,GAR[1]-19,PI*.9);walk('NICO',GAR[0]-.6,GAR[1]-10.4,3.2);place('DEX',GAR[0]-1.6,GAR[1]-8.5,PI,'idle');face('DEX','NICO')},c:[GAR[0]+5,1.8,GAR[1]-15,GAR[0]-1,1.3,GAR[1]-9],l:[["DEX","Nico! I heard — I heard about Mara, I swear to God I didn't know they'd—"]]},
 {d:1.6,cu:['DEX',1.2],shake:.05,on:()=>{nicoAt(GAR[0]-1.4,GAR[1]-9.6,0);place('DEX',GAR[0]-1.5,GAR[1]-7.6,PI,'hurt');snd(90,.3,'sawtooth',.1)}},
 {ots:['NICO','DEX'],l:[["NICO","How long."],["DEX","Nico—"],["NICO","HOW LONG, DEX."]]},
 {cu:['DEX',1.3,.2],on:()=>{anim('DEX','down')},l:[["DEX","...Six years."]],pad:1.6},
 {cu:['DEX',1.4,-.2],l:[["DEX","Victor came to me a week before the armored truck job. He already knew about it. He wanted the route and the time."],["DEX","He said if I didn't give it to him, Imani would have an accident at school. She was six, Nico. She was SIX."],["DEX","I thought the cops would just stop the truck. I didn't think you'd come back for me."]]},
 {two:['NICO','DEX',3.4],on:()=>{anim('DEX','cry')},l:[["DEX","Why did you come back for me?!"],["NICO","Because you were my brother."]]},
 {cu:['DEX',1.3],l:[["DEX","And I've been his dog ever since. Every week he calls. 'What's Nico doing. Who's Nico seeing.'"],["DEX","I told him about Lena. I told him about the ledger. I'm sorry. I'm so sorry."]]},
 {cu:['NICO',1.4],l:[["NICO","Where is she."]]},
 {ots:['NICO','DEX'],on:()=>{anim('DEX','down')},l:[["DEX","Calloway Freight. The yard by the hangars. They'll have her in a container. Nico, let me come with you, let me—"],["NICO","You've done enough."]],post:()=>{hideN('DEX');nicoAt(GAR[0]+1,GAR[1]-16,PI)}}];
CS.mara2=A=>[
 {c:[307.6,1.7,-.4,301.5,1.1,-2],on:()=>{nicoAt(304.4,-1.6,-PI/2);place('MARA',301.6,-2,PI/2,'cry');face('NICO','MARA')},l:[["NICO","Mara!"]]},
 {two:['NICO','MARA',3],on:()=>{walk('MARA',303.2,-1.8,2);setTimeout(()=>{anim('MARA','hug');anim('NICO','hug')},600)},l:[["MARA","Nico — I knew — I knew you'd come—"],["NICO","Are you hurt?"],["MARA","They didn't touch me. The big one kept apologizing. He said he had a daughter my age."]]},
 {cu:['MARA',1.4],on:()=>{anim('MARA','idle');anim('NICO','idle');face('MARA','NICO')},l:[["MARA","Nico, Victor was here. He laughed. He said to tell you, 'The pages are sleeping with the money.'"],["MARA","What does that mean?"]]},
 {cu:['NICO',1.4],l:[["NICO","...Ember Federal. Victor's private vault. Remy's pages are in the bank."]],ev:[[2.6,()=>{$('sir').style.opacity=1;snd(600,.5,'sine',.04)}]]},
 {c:[290,6,10,320,2,22],d:4,l:[["MARA","Those are police cars—"],["NICO","Harlan's police. Get in. Stay down."]],post:()=>{$('sir').style.opacity=0}}];
CS.ma3=A=>[
 {c:[MAH.cx+5,2.2,MAH.cz+16,MAH.cx,1.3,MAH.cz+12],on:()=>{setRain(0);if(P.car){P.car.v=0;P.car=null}nicoAt(MAH.cx+1,MAH.cz+13.4,PI);place('MARA',MAH.cx-.6,MAH.cz+13.2,PI);place('MA',MAH.cx,MAH.cz+10.4,0,'idle');face('MA','MARA');face('MARA','MA')},l:[["MA","So this is Rosa's girl. Come in, child, you're shaking."],["MARA","Who... who is she?"]]},
 {two:['NICO','MA',3.6],l:[["NICO","Somebody who owes Victor as much as we do. You'll be safe here."],["MA","Safer than anywhere in this city. Forty dockworkers owe me a favour, and every one of them lives within shouting distance."]]},
 {cu:['MARA',1.4],on:()=>{face('MARA','NICO');face('NICO','MARA')},l:[["MARA","Nico. Whatever you're about to do... don't become him."],["MARA","Promise me."]]},
 {cu:['NICO',1.4],pad:2.2,l:[["NICO","...I'll see you soon."]]},
 {c:[MAH.cx-3,1.8,MAH.cz+17,MAH.cx,1.3,MAH.cz+12],l:[["NICO","I didn't promise."]],post:()=>{hideN('MA');hideN('MARA');nicoAt(MAH.cx,MAH.cz+16,0)}}];
CS.roof1=A=>[
 {c:[-16,24,-14,0,15,-30],c2:[-10,19.5,-6,0,14,-35],on:()=>{const l=bankLad();nicoAt(-6.2,-3.8,PI*.95);P.y=ROOFY;PN.y=ROOFY;P.roof=l;place('LENA',-4.4,-5.4,PI*.9,'idle');npc('LENA').y=ROOFY;face('LENA','NICO');face('NICO','LENA')},l:[["LENA","Harlan's meeting one of Calloway's lieutenants at the fountain in twenty minutes. Internal Affairs will finally listen — if I get it on tape."],["LENA","I'm wearing the wire."]]},
 {two:['NICO','LENA',3.2],l:[["NICO","You're going down there alone."],["LENA","Harlan knows me. If anyone else shows up, he walks. You're my overwatch."],["LENA","Ruiz's rifle. He'd want it used on these people."]]},
 {cu:['NICO',1.5],l:[["NICO","Lena, Victor knows about you. He knew before I did. If this is a setup—"],["LENA","Then you'd better be a good shot."]]},
 {cu:['NICO',1.3,-.3],pad:1.2,l:[["NICO","Six years ago, I had a ring in my pocket. The night of the job. I was going to ask you after."]]},
 {cu:['LENA',1.4],l:[["LENA","...Why are you telling me this now?"],["NICO","In case I'm not a good shot."],["LENA","...Ask me after. Tonight."]],post:()=>{hideN('LENA');PN.y=0;nicoAt(-5,-6,PI);P.y=ROOFY;P.roof=bankLad();camYaw=PI;camPitch=.2;zoom=.6}}];
CS.harlan1=A=>{const c=A.v.harlan,x=c?c.x:0,z=c?c.z:-60;return[
 {c:[x+6,2,z+5,x,.8,z],on:()=>{if(P.car){P.car.v=0;P.car=null}place('HARLAN',x+2.4,z+1.6,PI*.3,'kneel');nicoAt(x+5,z+4.6,-PI*.7);anim('NICO','gun');face('NICO','HARLAN');face('HARLAN','NICO')},l:[["HARLAN","(bleeding) You idiots. You think taking me matters? I'm a line item."],["HARLAN","Victor has the mayor. The district attorney. Half the judges in this county."]]},
 {c:[x-4,1.9,z+7,x+2,1.1,z+2],on:()=>{place('LENA',x-1.6,z+5.6,PI*.8,'gun');face('LENA','HARLAN')},l:[["LENA","Then you'll have a lot of names to give us. Richard Harlan, you're under arrest."],["HARLAN","Ruiz said that too. Right before."]]},
 {cu:['LENA',1.3],pad:1.5,l:[["NICO","Lena. He wants you to do it. Don't give him that."]]},
 {cu:['LENA',1.35,-.2],on:()=>{anim('LENA','idle')},l:[["LENA","...You're under arrest, Captain."]]},
 {two:['NICO','LENA',3.6],on:()=>{anim('NICO','idle');face('NICO','LENA');face('LENA','NICO')},l:[["LENA","The vault. If Remy's pages are in Calloway's box at Ember Federal, a warrant takes weeks. Victor will burn them by morning."],["NICO","Then we don't wait for a warrant."],["LENA","I didn't hear that."],["LENA","...Be careful. You still owe me a question."]],post:()=>{hideN('LENA');hideN('HARLAN')}}]};
CS.crew1=A=>[
 {c:[MAH.cx+7,2.4,MAH.cz+19,MAH.cx,1.3,MAH.cz+13],on:()=>{nicoAt(MAH.cx+1.6,MAH.cz+15,-PI*.85);place('MA',MAH.cx-1,MAH.cz+13,PI*.2,'cross');place('MARA',MAH.cx+.6,MAH.cz+12.4,PI*.9,'cross');face('MA','NICO');face('MARA','NICO');face('NICO','MA')},l:[["MA","So. A bank job. At my age. Remy would laugh himself sick."],["NICO","I need explosives for the vault door. A way in. A way out. And a crew I can trust. I'm short on the last one."]]},
 {c:[MAH.cx+4,1.8,MAH.cz+19.5,MAH.cx+1,1.3,MAH.cz+14],on:()=>{place('DEX',MAH.cx+4,MAH.cz+21,PI);walk('DEX',MAH.cx+3,MAH.cz+16.6,1.2);face('MARA','DEX')},l:[["DEX","Then let me be the one you can't trust... who shows up anyway."]]},
 {cu:['MARA',1.5],l:[["MARA","You've got some nerve, showing your face here."]]},
 {two:['DEX','NICO',3.8],on:()=>{face('DEX','NICO');face('NICO','DEX')},l:[["DEX","I know. I know what I did. I can't fix six years."],["DEX","But I can cut a vault. I've got a thermal lance at the garage that'll go through ten inches of steel. And nobody knows Victor's armored cars better than the guy who's been fixing them."]]},
 {cu:['NICO',1.5],pad:1.4,l:[["NICO","...Where's Imani?"]]},
 {cu:['DEX',1.4],l:[["DEX","With her aunt, in Port Vale. Out of his reach. First time in six years I can breathe."],["NICO","Then breathe. You're in."]]},
 {two:['MA','NICO',3.4],l:[["NICO","Ma. Do you know where I could get explosives?"],["MA","Boy, I'm eighty-one years old and I live alone on the west side."],["MA","What do you think is under my porch?"]],post:()=>{hideN('MARA');hideN('MA')}}];
CS.crew2=A=>[
 {c:[GFC[0]-6,2.3,GFC[1]-1,GAR[0],1.3,GAR[1]-9],on:()=>{const v=A.v.arm;if(v){if(P.car===v)P.car=null;vset(v,GAR[0]-3.4,GAR[1]-11,PI)}nicoAt(GAR[0]+.6,GAR[1]-12.4,PI*.9);place('DEX',GAR[0]-.6,GAR[1]-9.6,PI*.9,'work');place('MARA',GAR[0]+2.4,GAR[1]-10.4,-PI*.7,'cross');face('MARA','NICO')},l:[["DEX","Armored car's ready. Lance is charged. The dynamite is... vintage. I'm not gonna ask how old."],["MARA","I'm coming with you."],["NICO","No."]]},
 {cu:['MARA',1.4],l:[["MARA","I'm a nurse. Almost. If someone gets shot, you'll want me there."],["MARA","And I am not sitting in an old woman's kitchen waiting to hear if my brother's dead. Not again."]]},
 {cu:['NICO',1.5],pad:1.2,l:[["NICO","...You stay in the car. No matter what happens."]]},
 {cu:['NICO',1.3,.3],on:()=>{anim('NICO','phone')},ev:[[.1,()=>{for(let i=0;i<2;i++)setTimeout(()=>snd(880,.12,'square',.03),i*260)}]],l:[["LENA","Nico. A federal judge signed something. Not a warrant — an order to seize the vault contents if they're 'turned over voluntarily.'"],["LENA","Which is a polite way of saying I'll be outside the bank at midnight, and I won't ask how the door got open."],["NICO","See you there."],["LENA","Nico? ...Bring the ring."]],post:()=>{anim('NICO','idle');hideN('DEX');hideN('MARA')}}];
CS.heist1=A=>[
 {title:['EMBER FALLS','FINAL CHAPTER',4],c:[22,10,32,0,4,10],c2:[14,4,26,0,3,12],on:()=>{const v=svCar('arm2',0x2a2d33,2,40,17.2,-PI/2,{top:12});vgo(v,6,17.2,-PI/2,12);v.keep=0;v.free=1;nicoAt(0,30,PI);P.g.visible=false;hideAll()},d:6},
 {two:['NICO','DEX',3.6],on:()=>{const v=A.v.arm2;vset(v,6,17.2,-PI/2);nicoAt(2,14.6,PI);place('DEX',-.4,14.4,PI*1.1);face('NICO','DEX');face('DEX','NICO')},l:[["DEX","Alarm's looped. We've got four minutes before the backup line calls it in. Maybe less."],["NICO","Then we take three."],["DEX","Hey. Whatever happens in there—"],["NICO","Tell me after."]]},
 {c:[0,2.2,22,0,2.4,10],on:()=>{walk('DEX',0,10.6,1.6)},d:3.5,post:()=>{hideN('DEX');nicoAt(1,13.6,0)}}];
CS.heist2=A=>[
 {c:[9,2.2,19,1.5,1.2,12],on:()=>{const v=A.v.arm2;if(v){if(P.car===v)P.car=null;vset(v,13,17.2,-PI/2)}nicoAt(2.6,13.2,PI*.85);place('DEX',-.6,11,0,'idle');walk('DEX',.8,12.6,1.6);place('MARA',9.6,15.4,-PI/2,'cross');face('NICO','DEX')},l:[["DEX","Nico! It's here. Remy's pages — and more. Victor kept everything. Every payoff since Remy."],["DEX","There's a page in here about Ruiz. Dates. Names. Who held him under."],["NICO","Lena needs to see that."]]},
 {c:[32,3,25,8,1.5,16],d:2.6,on:()=>{const v=svCar('vic',0xf2f0ea,1,64,17.2,-PI/2,{top:22});vgo(v,26,17.2,-PI/2,22);snd(200,.6,'sawtooth',.05);walk('MARA',5.2,13.9,1.4);face('MARA','NICO')}},
 {c:[-2.5,1.8,17.5,4,1.1,13.4],on:()=>{place('MARA',5.2,13.9,PI*1.1)},ev:[[.3,()=>{tracer(26,17,5,14,0xff8855,1.3);tracer(26,17,3,13.5,0xff8855,1.3);snd(300,.1,'sawtooth',.06)}],[.6,()=>{walk('DEX',4.2,14.2,4.5);snd(300,.1,'sawtooth',.06)}],[1.3,()=>{anim('DEX','hurt');snd(110,.25,'sawtooth',.08);part(4.2,1.2,14.2,0,3,0,.15,BL[1],5)}],[2.3,()=>{anim('DEX','lie')}]],l:[["MARA","DEX!"]],d:3.4},
 {c:[.6,1.25,16.6,4,.35,13.8],on:()=>{const v=A.v.vic;vgo(v,-40,17.2,-PI/2,26);place('DEX',4,13.8,PI/2,'lie');place('MARA',4.4,14.9,PI,'kneel');nicoAt(2.9,14.7,PI*.65);anim('NICO','kneel');face('MARA','DEX')},l:[["DEX","Hey... hey, Nico."],["DEX","Square now?"],["NICO","We were always square, you idiot. Stay with me."]]},
 {cu:['MARA',1.2,.2],l:[["MARA","I've got pressure on it — Dex, look at me, keep your eyes open—"],["DEX","Tell Imani..."],["DEX","Tell her her dad fixed something. Finally."]],pad:2.4},
 {c:[4,4.5,19,4,.4,13.8],c2:[4,7.5,21,4,.4,13.8],d:5,l:[["MARA","Dex? Dex!"],["MARA","...Nico, he's gone."]]},
 {cu:['MARA',1.3],on:()=>{anim('NICO','idle');nicoAt(3,15.8,PI*.4);anim('MARA','kneel')},l:[["MARA","Victor's running. He's going to the airport — he has a plane."],["MARA","Go. GO! Don't let him get away with this too!"]],post:()=>{hideN('DEX');hideN('MARA');nicoAt(8,15.6,PI/2)}}];
CS.jet1=A=>[
 {c:[168,4,-40,154,1.6,-52],on:()=>{const j=A.jet;if(P.car){P.car.v=0}place('VICTOR',150,-48,PI,'idle');walk('VICTOR',151,-53,2.2);place('THUG1',148.5,-49.6,PI)},l:[["VICTOR","(into his phone) Wheels up in two minutes. I don't care what the tower says. I own the tower."]],d:4.2,post:()=>{hideN('VICTOR');hideN('THUG1')}}];
CS.final1=A=>{const j=A.jet,x=(j?j.x:220)-6,z=-45;return[
 {c:[x-14,6,z+14,x+4,2,z-8],on:()=>{for(const c of cars){if(c.key=='vic'||c.key=='lena4')continue;if(Math.hypot(c.x-(x-8),c.z-(z+6))<16){if(P.car===c)P.car=null;setCar(c,x-30,z+26,PI/2);c.v=0;c.sp=0;if(c.sv)c.mode='park'}}if(P.car){P.car.v=0;P.car=null}place('VICTOR',x-6,z+3,-PI*.7,'hurt');nicoAt(x-10.4,z+7,PI*.7);anim('NICO','gun');face('NICO','VICTOR');face('VICTOR','NICO');setRain(0)},l:[["VICTOR","(laughing, coughing) Rosa's boy. Look at you. Covered in ash."],["VICTOR","Ember City finally made you one of us."]]},
 {cu:['NICO',1.5],l:[["NICO","I'm nothing like you."]]},
 {cu:['VICTOR',1.5,-.3],on:()=>{anim('VICTOR','kneel')},l:[["VICTOR","No? You lied to your sister. You used the woman who loves you. You let your best friend bleed out for a stack of paper."],["VICTOR","Tell me the difference, Nico. Please. I'd love to know."]]},
 {ots:['NICO','VICTOR'],l:[["VICTOR","Go on. Six years in a cage for my mistake. Your mother's bills. Dex."],["VICTOR","You've earned it. Nobody in this city would blame you."]],ev:[[3,()=>{$('sir').style.opacity=.8;snd(600,.6,'sine',.03)}]]},
 {cu:['NICO',1.2,.1],pad:2,l:[["NICO","..."]],post:()=>{$('sir').style.opacity=0}}]};
CS.endA=A=>{const j=A.jet,x=(j?j.x:220)-6,z=-45;return[
 {cu:['NICO',1.4],on:()=>{anim('NICO','idle')},l:[["NICO","No. You don't get to make me into you."]]},
 {c:[x-20,3,z+16,x-8,1.4,z+5],on:()=>{const c=svCar('lena4',0x2a3038,0,x-46,-20,PI*.8,{top:16});vgo(c,x-24,z+17,PI*.75,16);place('LENA',x-22,z+15,PI*.75);npc('LENA').g.visible=false},d:4.2,post:()=>{npc('LENA').g.visible=true;walk('LENA',x-7.6,z+4.4,1.6);face('LENA','VICTOR')}},
 {two:['LENA','VICTOR',4.6],l:[["LENA","Victor Calloway. You're under arrest for the murders of Detective Antonio Ruiz, Remy Delacroix, and Dexter Okafor."],["LENA","Honestly, Victor, I'm going to need a bigger notebook."],["VICTOR","I'll be out in a week."],["LENA","Federal judge, Victor. Not one of yours. And Harlan's been singing since breakfast."]]},
 {two:['NICO','LENA',3.6],on:()=>{hideN('VICTOR');face('NICO','LENA');face('LENA','NICO')},l:[["LENA","You could have killed him. Nobody would have known."],["NICO","I would have. And Mara would have."],["LENA","...So. I believe you had a question."]]},
 {cu:['NICO',1.3],l:[["NICO","It's six years late."]]},
 {cu:['LENA',1.3],l:[["LENA","Good things usually are."]],pad:2.2},
 {tod:.27,fade:0,c:[-80,70,120,0,10,0],c2:[60,40,110,30,5,0],title:['SIX MONTHS LATER','',5],l:[["NICO","Victor Calloway got two life sentences. Remy's ledger took down forty-one people — a judge, a deputy mayor, and most of Harlan's precinct."],["NICO","Mara passed her boards in the spring. First in her class. She works nights at Ember General now. She says the hardest part is the paperwork."]]},
 {c:[MAH.cx+12,6,MAH.cz+28,MAH.cx,2,MAH.cz],l:[["NICO","Ma Delacroix finally buried an empty coffin for Remy. Half the west side came. She made gumbo for three hundred people, and hit a councilman with a ladle."],["NICO","Dex's daughter Imani got a letter from me. I told her the truth. That her father made a terrible mistake when he was scared — and fixed it when it counted."]]},
 {c:[30,3,40,0,2,20],c2:[10,2,34,0,2,20],l:[["NICO","And me? I drive a cab. The pay is terrible. Nobody shoots at me."],["NICO","Most days, I don't count anything at all."]],post:()=>{ST.ending='justice';hideAll()}}]};
CS.endB=A=>{const j=A.jet,x=(j?j.x:220)-6,z=-45;return[
 {cu:['NICO',1.4],l:[["NICO","You're right. Nobody would blame me."]],ev:[[2.6,()=>{$('fx').style.background='#fff';$('fx').style.opacity=.9;setTimeout(()=>$('fx').style.opacity=0,120);snd(90,.5,'sawtooth',.2);shake=1;tracer(x-10.4,z+7,x-6,z+3,0xffe066,1.3);setTimeout(()=>{anim('VICTOR','dead');part(x-6,1.2,z+3,0,3,0,.2,BL[1],6);splat(x-6,z+3,1.4)},100)}]]},
 {c:[x-18,2.4,z+15,x-8,1.2,z+4],d:3.4,on:()=>{const c=svCar('lena4',0x2a3038,0,x-46,-20,PI*.8,{top:16});vgo(c,x-24,z+17,PI*.75,16)},post:()=>{place('LENA',x-14,z+11,PI*.75);walk('LENA',x-9.2,z+6.4,1.2);face('LENA','NICO')}},
 {cu:['LENA',1.4],l:[["LENA","...Nico. What did you do."],["NICO","What he deserved."]]},
 {ots:['NICO','LENA'],l:[["LENA","That wasn't your call to make. He was supposed to answer for Ruiz. For all of it. In a courtroom, where the whole city could watch."],["LENA","Now he's just another body in Ember City. And you're just another man who made one."],["NICO","Lena—"]]},
 {cu:['LENA',1.3],pad:1.5,l:[["LENA","Go. Before I have to arrest you."],["LENA","...And don't ask me the question. Not now. Not ever."]]},
 {tod:.27,fade:0,c:[-80,70,120,0,10,0],c2:[60,40,110,30,5,0],title:['SIX MONTHS LATER','',5],on:()=>{hideAll()},l:[["NICO","The ledger still did its work. Forty-one names. But without Victor on the stand, half of them walked."],["NICO","Mara passed her boards. First in her class. She sends a card every Christmas. She doesn't visit."]]},
 {c:[MAH.cx+12,6,MAH.cz+28,MAH.cx,2,MAH.cz],l:[["NICO","Ma Delacroix says I did what she never could. She says it like it's a compliment."],["NICO","Some nights I believe her."]]},
 {c:[55,4,30,40,6,8],c2:[48,2.4,24,40,5,8],l:[["NICO","The Golden Ember has a new owner now. Somebody has to run the night in Ember City."],["NICO","And me? I'm counting again. I just don't know what I'm counting down to."]],post:()=>{ST.ending='revenge'}}]};
/* ===================== MISSIONS ===================== */
function spawnAround(A,G,pts,o){for(const p of pts)G.push(thug(p[0],p[1],Object.assign({},o||{},p[2]||{})))}
function arsonWave(A,G,w){const shopsX=[0,-40,40],k=w%3;for(let i=0;i<3;i++){const sx=shopsX[(k+i)%3],from=[[sx+rr(-30,30),78],[sx-40,rr(55,75)],[sx+40,rr(55,75)]][i%3];const e=thug(from[0],from[1],{mode:'goto',to:[sx+rr(-4,4),45.8],hp:2});e.tgt=sx;G.push(e)}}
const MIS=[
 {t:'HOMECOMING',ch:'PROLOGUE',L:'P',at:[112,27],tod0:.27,reward:500,noTitle:1,steps:[
  SC('pro1'),
  SDO(A=>{const c=A.v.mara;c.free=1;ally('MARA',c.x-cos(c.h)*2.2,c.z+sin(c.h)*2.2,{h:0})}),
  SSAY([["MARA","Driver's side. Mom always said you were the better driver. Don't make me regret it."]]),
  SCOND(()=>P.car===ST.act.v.mara,"Get in *Mara's car*."),
  SSAY([["MARA","Mom kept your room exactly how you left it. I couldn't bring myself to touch it."],["NICO","Mara... I'm sorry I wasn't at the funeral."],["MARA","They wouldn't let you out. I know. I wrote you about it. You never wrote back."],["NICO","I wrote every week. I just never sent them."],["MARA","...That is the most Nico thing I have ever heard."],["MARA","Left at the river, then straight. And try not to kill anyone. You're on parole."]]),
  SGO(-36,17.5,"Drive *Mara* home to the *apartments*.",{veh:'mara',ally:['MARA'],r:5,vehTxt:"Get back in *Mara's car*."}),
  SC('pro2'),
  SDO(A=>{A.al.length=0;const c=svCar('sal',0x1b1b1e,0,-74,23,PI/2,{top:16});vgo(c,-50,23,PI/2,16)}),
  SKILL("Deal with Calloway's *collectors*.",(A,G)=>{G.push(thug(-40.2,10.6,{lbl:'SAL',acc:.25}),thug(-42.7,10.9,{acc:.25}),thug(-62,25.4,{acc:.25}),thug(-64,26,{acc:.25}))}),
  SSAY([["NICO","(to himself) Day one. Great start."]]),
  SGO(-40,12.5,"Go *inside* to Mara.",{r:2.6,foot:1}),
  SC('pro3')],onPass:()=>{ST.flags.debt=120000},after:[["MARA","(text) I put clean sheets on your bed. Don't make it weird."],["MARA","(text) ...I'm glad you're home."]],hint:"Visit your old friend *Dex* at Okafor Auto — east of the river, by the airport (*D*)."},
 {t:'OLD FRIENDS',ch:'CHAPTER 1',L:'D',col:'#5aa8ff',at:[GFC[0],GFC[1]-1],tod0:.45,reward:18000,steps:[
  SC('dex1'),
  SDO(A=>{const c=svCar('comet',0xd8161c,1,47,14.7,PI/2);c.free=1;c.dmg=0;c.keep=1}),
  SCOND(A=>{beaconObj(A.v.comet,0x37e6ff);return P.car===A.v.comet},"Steal the cherry-red *Comet SR* parked outside the *Golden Ember Casino*."),
  SDO(A=>{heat=Math.max(heat,2.6);say([["THUG","Hey! HEY! That's Mr. Calloway's car!"],["NICO","Easy, sweetheart. Just like the old days."]]);A.grp=[thug(40,10.5,{acc:.25}),thug(44,11,{acc:.25})]}),
  SGO(GAR[0]-3,GAR[1]-11,"Lose the cops and bring the *Comet* to *Okafor Auto*. Don't wreck it.",{veh:'comet',maxDmg:140,clean:1,r:4.5,vehTxt:"Get back in the *Comet*.",vehFail:"You wrecked the Comet."}),
  SC('dex2')],after:[["RADIO","(unknown number) You still drive like you're angry at the road."],["RADIO","(unknown number) Fountain park. Ten o'clock. Come alone. — L"]],hint:"A text from an unknown number: “Fountain park. 10pm. — L.” (*L*)"},
 {t:'THE DETECTIVE',ch:'CHAPTER 2',L:'L',col:'#ff5f93',at:[0,-24],tod0:.84,reward:5000,steps:[
  SC('lena1'),
  SGO(32,26,"Take Lena's car and wait near the *Golden Ember Casino*.",{car:1,r:9,carTxt:"Get in *Lena's car*."}),
  SDO(A=>{const c=svCar('cour',0x111114,0,47,17,-PI/2,{top:12});c.ent=null;say([["RADIO","That's him. Black sedan pulling out of the casino. Don't get close — he's paranoid. He checks his mirrors."]]);svRoute(c,[[20,20],[20,60],[-20,60],[-20,-20],[20,-20],[60,-20],[100,-20],[180,-20],[260,-20],[272,0,0,8],[287,9,0,6]],12)}),
  SSAY([["RADIO","Stay back. Keep a few cars between you."],["NICO","I've done this before, Lena."],["RADIO","I know. I read your file. Twice."]]),
  STAIL("*Follow* the courier. Don't lose him — and don't get spotted.",'cour',{min:13,max:85,spot:4}),
  SSAY([["RADIO","He stopped at the Calloway Freight hangars? Get eyes on the drop. Find cover."]]),
  SGO(261.8,5.4,"Sneak to the *crates* by the hangars and photograph the drop.",{r:2.2,foot:1}),
  SC('photo'),
  SKILL("Calloway's men spotted you. *Survive*.",(A,G)=>spawnAround(A,G,[[283,15],[287,16],[290,26],[279,24],[296,12]])),
  SLOSE("Harlan called it in. *Lose the cops*.",2),
  SGO(64,-24,"Meet *Lena* at the west end of the Fourth St bridge.",{r:4,clean:1}),
  SC('lena2')],after:[["MARA","(phone) Lena Cruz came by the café today asking about you. She tipped twenty percent. Should I be worried?"],["NICO","Probably."],["MARA","Come by tomorrow. I'll make you lunch. Real food. Not whatever they fed you inside."]],hint:"Mara texted: “Come by the Sunrise Café. I'll make you lunch.” (*M*)"},
 {t:'SMALL BUSINESS',ch:'CHAPTER 3',L:'M',col:'#3fd6c4',at:[0,48.5],tod0:.55,reward:3000,steps:[
  SC('cafe1'),
  SDO(A=>{A.burn=0;A.burned={}}),
  SDEF("Stop Brick's crew from torching the *shops* — café, burger joint and noodle bar.",62,arsonWave,{every:10,clear:1,lab:'DEFEND',check:A=>{for(const e of A.grp)if(!e.dead&&e.at>3.5&&!A.burned[e.tgt]){A.burned[e.tgt]=1;A.burn++;FIRES.push({x:e.tgt,z:39.5,t:90});FIRES.push({x:e.tgt+3,z:39.5,t:90});say([["NICO","They lit one up — damn it!"]])}if(A.burn>=2)return'Two shops burned down.'}}),
  SDO(A=>{const c=svCar('brick',0x26262c,2,-20,57,PI/2,{hp:42,top:21});c.mode='flee';say([["MARA","(phone) Nico! Brick's running — the black SUV! Don't let him come back here!"]])}),
  SCHASE("Take down *Brick's* SUV before he gets away.",'brick',{lab:'BRICK'}),
  SC('brick1')],after:[["NEWS","Ember News: a fire on Fourth Street was put out before it could spread. Witnesses describe 'a man in a red shirt' chasing the arsonists."],["MARA","(phone) Mr. Okonkwo is back. He cried when he saw the windows. He wants to name a sandwich after you."],["NICO","What's in it?"],["MARA","Mostly hot sauce. He says that's your personality."]],hint:"Victor Calloway wants to meet. The *Golden Ember Casino* (*V*)."},
 {t:'HIGH ROLLER',ch:'CHAPTER 4',L:'V',col:'#ffd23f',at:[40,17],tod0:.9,reward:0,steps:[
  SC('cas0'),
  SCOND(()=>IN===CAS,"Enter the *Golden Ember Casino* (E at the door).",[40,12.5]),
  SDO(A=>{ST.games=0;cash+=2000;say([["THUG","Compliments of Mr. Calloway. Two thousand in chips. He'll find you when he's ready."],["NICO","(to himself) Of course he will."]])}),
  SCOND(()=>ST.games>=3,"Play *3 rounds* — slots, roulette or blackjack (walk up and press E)."),
  SDO(()=>{closeCas();if(IN!==CAS)IN=CAS}),
  SC('victor1')],keepIn:1,after:[["NICO","I didn't tell Mara about Victor's offer. I didn't tell Lena either."],["NICO","Six years in a cell teaches you to keep things in. It doesn't teach you when to stop."]],hint:"Lena wants to talk. West end of the Fourth St bridge (*L*)."},
 {t:'MA DELACROIX',ch:'CHAPTER 5',L:'L',col:'#ff5f93',at:[62,-26],tod0:.5,reward:0,steps:[
  SC('lena3'),
  SGO(MAH.cx,MAH.cz+16,"Go to *Ma Delacroix's* house on the west side.",{r:5}),
  SKILL("Calloway's men are watching the house. Take them out.",(A,G)=>{spawnAround(A,G,[[-72,19],[-89,20],[-66,24],[-94,25]],{acc:.24})}),
  SGO(MAH.door.x,MAH.door.z+3,"Knock on *Ma Delacroix's* door.",{r:2.2,foot:1}),
  SC('ma1'),
  SDO(A=>{const m=ally('MA',MAH.door.x,MAH.door.z+.6,{hp:420,follow:0,vital:1,shoot:22});m.anim='gun';m.dmgE=2}),
  SKILL("Calloway's men followed you. Protect *Ma Delacroix*.",(A,G)=>{const m=npc('MA');spawnAround(A,G,[[-74,26],[-86,25],[-80,28],[-70,22],[-90,22],[-78,32],[-84,33]],{tg:m});for(let i=0;i<3;i++)G[i].tg=null}),
  SC('ma2')],onPass:()=>{ST.flags.ledger=1},after:[["MA","(phone) Rosa's boy. You left mud on my rug. I'm adding it to the vase."],["NICO","Yes, ma'am."],["MA","And eat something. You look like a coat hanger."]],hint:"Victor's job. Pick up the van at Okafor Auto (*D*)."},
 {t:'THE RUN',ch:'CHAPTER 6',L:'D',col:'#5aa8ff',at:[GFC[0],GFC[1]-1],tod0:.27,reward:0,steps:[
  SC('dex3'),
  SGO(40,-17.4,"Drive the *van* to the casino loading dock.",{veh:'van',r:5,vehTxt:"Get in the *van*.",vehFail:"You destroyed Victor's van."}),
  SSAY([["THUG","Cargo's loaded. Don't open it, don't stop, don't be late. Mr. Calloway's watching."]]),
  SDO(A=>{for(const[k,x,z]of[['p1',-20,-57],['p2',100,-57]]){const c=svCar(k,0x7a1a1a,0,x,z,0,{hp:30,top:24});c.mode='pursue';c.gunner=1}say([["NICO","Company. Two cars. Not cops."]])}),
  SGO(297,18,"Get the *van* to hangar three at *Calloway Freight* — fast.",{veh:'van',time:140,r:6,vehTxt:"Get back in the *van*.",vehFail:"You destroyed Victor's van."}),
  SC('run1'),
  SKILL("It's an ambush. *Survive*.",(A,G)=>spawnAround(A,G,[[282,24],[289,24.5],[276,12],[300,26],[310,12],[270,4],[318,24]])),
  {init(A){const v=A.v.van;A.pk=pickup(v.x-sin(v.h)*2.8,v.z-cos(v.h)*2.8,'Open the back of the van',{mesh:new T.Group(),r:2.6,onPick:()=>{A.pkd=1}});A.pkd=0;beaconObj(A.pk,0xffd23f);objSet("Check the *van*.")},tick(A){return A.pkd}},
  SC('run2')],onPass:()=>{ST.flags.plane=1;setTimeout(()=>msg('UNLOCKED: AIRPLANES AT EMBER INTL','#ffd23f'),5200)},hint:"Dex. Okafor Auto (*D*). Now."},
 {t:'BLOOD IS THICKER',ch:'CHAPTER 7',L:'D',col:'#5aa8ff',at:[GFC[0],GFC[1]-1],tod0:.92,reward:0,steps:[
  SC('dex4'),
  SGO(286,4,"Get to the *freight yard*. Find *Mara*.",{r:16}),
  SKILL("Kill *Victor's men*.",(A,G)=>{spawnAround(A,G,[[282,15],[288,16],[296,8],[304,8],[312,14],[318,24],[276,24],[300,26]]);G.push(thug(300,16,{big:1,hp:12}))}),
  {init(A){A.pk=pickup(303.4,-2,'Open the container',{mesh:new T.Group(),r:2.4,onPick:()=>{A.pkd=1}});A.pkd=0;beaconObj(A.pk,0xffd23f);objSet("Open the *container*.")},tick(A){return A.pkd}},
  SC('mara2'),
  SDO(A=>{ally('MARA',302.6,-.2,{hp:120});heat=Math.max(heat,3.6);say([["MARA","Nico, they're coming from everywhere!"]])}),
  SLOSE("Lose *Harlan's* dirty cops. Keep *Mara* safe.",3),
  SGO(MAH.cx,MAH.cz+14,"Take *Mara* to *Ma Delacroix's* house.",{ally:['MARA'],clean:1,r:5}),
  SC('ma3')],after:[["LENA","(phone) I heard about the freight yard. Is Mara okay?"],["NICO","She's with an eighty-one-year-old crane operator with a very loud opinion and half the docks on speed dial."],["LENA","...That's not even the strangest sentence I've heard today."]],hint:"Lena: “Bank roof. Bring steady hands.” Climb the ladder on the west side of the bank (*L*)."},
 {t:'ROOFTOPS',ch:'CHAPTER 8',L:'L',col:'#ff5f93',at:[-13,2.5],tod0:.86,reward:5000,steps:[
  SC('roof1'),
  SDO(A=>{own.sniper=1;ammo.sniper=Math.max(ammo.sniper,30);setW('sniper');lastHot='';const l=ally('LENA',-11.5,2.5,{hp:240,follow:0,vital:1,shoot:24});l.to=[-13,-13];l.path=[[-1,-26],[1.2,-36.2]];l.sp=1.5;place('HARLAN',-12,-62,0);walk('HARLAN',-1.6,-38.6,1.4);place('THUG3',-13.4,-62.6,0);walk('THUG3',-3.2,-40.4,1.4)}),
  STALK([["RADIO","Ladder's on the west side, I'm walking. Scope's yours. Hold right-click to look through it."],["NICO","I see you. I see the fountain."],["HARLAN","Detective Cruz. Out for a midnight walk?"],["LENA","Couldn't sleep, Captain. Thought I'd come watch you take Calloway's money in person."],["HARLAN","You always did talk too much. Just like Ruiz."],["HARLAN","You think I don't know a wire when I see one, Cruz?"]],"Watch over *Lena* from the bank roof. Hold *RMB* to scope."),
  SDO(A=>{hideN('THUG3')}),
  SKILL("It's a setup! Snipe the *hitmen* before they reach *Lena*.",(A,G)=>{const L=npc('LENA');spawnAround(A,G,[[-14,-54],[14,-53],[-16,-28],[15,-29]],{tg:L,pref:7,rng:30,acc:.22,dmg:3});say([["LENA","Nico! Left side — they're everywhere!"]])},{check:A=>{if(!A.hf&&A.t>2){A.hf=1;walk('HARLAN',-1.6,-62,4)}if(!A.w2&&A.t>14){A.w2=1;spawnAround(A,A.grp,[[0,-58],[-18,-44],[18,-44],[7,-25]],{tg:npc('LENA'),pref:7,rng:30,acc:.22,dmg:3});say([["LENA","More of them — south and east!"]])}}}),
  SDO(A=>{hideN('HARLAN');const c=svCar('harlan',0x1d3b8a,0,-6,-63,-PI/2,{hp:40,top:20});c.mode='flee';say([["LENA","Harlan's running! Blue cruiser, heading out of the park! Get down there!"]])}),
  SCHASE("Get down from the roof and stop *Harlan*.",'harlan',{lab:'HARLAN',lose:240}),
  SC('harlan1')],onPass:()=>{ST.flags.harlan=1;ST.flags.heli=1;setTimeout(()=>msg('UNLOCKED: HELICOPTERS','#ffd23f'),5200)},after:[["NEWS","Ember News: Police Captain Richard Harlan was taken into federal custody overnight. The department has declined to comment."],["MARA","(phone) Ma taught me to make gumbo. I think she's adopting me."],["MARA","Come home soon, okay? Both of us are worried. She just shows it with a ladle."]],hint:"Ma Delacroix has an idea. Her house on the west side (*MA*)."},
 {t:'THE CREW',ch:'CHAPTER 9',L:'MA',col:'#c890ff',at:[MAH.cx,MAH.cz+15.5],tod0:.43,reward:0,steps:[
  SC('crew1'),
  SDO(A=>{ally('DEX',MAH.cx+3,MAH.cz+16.6,{hp:150,shoot:20})}),
  SPICK(MAH.cx+3.5,MAH.cz+8.4,"Get Ma's *dynamite* from under the porch.","Take the dynamite",{col:0xb03020}),
  SSAY([["DEX","...That's from the seventies. Don't drop it. Seriously. Don't drop it."],["DEX","Victor's armored car does a cash pickup at the Mart on the east side. Three guards. They take their sweet time."]]),
  SGO(40,-26,"Go to the *Mart*. Victor's armored car is making a pickup.",{r:9,ally:['DEX']}),
  SDO(A=>{const v=svCar('arm',0x2a2d33,2,46,-17,PI/2);v.free=1;v.keep=0}),
  SKILL("Take out the *guards*.",(A,G)=>spawnAround(A,G,[[44,-26],[49,-24],[36,-30]])),
  SCOND(A=>{beaconObj(A.v.arm,0x37e6ff);return P.car===A.v.arm},"Take Victor's *armored car*."),
  SGO(GAR[0]-3,GAR[1]-11,"Bring the armored car to *Okafor Auto*.",{veh:'arm',ally:['DEX'],clean:1,r:5,vehTxt:"Get back in the *armored car*."}),
  SDO(A=>{const v=A.v.arm;if(P.car===v){P.car=null;P.x=v.x+2.5;P.z=v.z}}),
  SPICK(GAR[0]-2,GAR[1]-7.4,"Grab the *thermal lance* inside the garage.","Take the thermal lance",{col:0xd0a020}),
  SC('crew2')],hint:"Everything is ready. Okafor Auto (*B*). Midnight."},
 {t:'EMBER FALLS',ch:'CHAPTER 10',L:'B',col:'#ff3b3b',at:[GFC[0],GFC[1]-1],tod0:.97,reward:50000,final:1,noTitle:1,steps:[
  SC('heist1'),
  SDO(A=>{const m=ally('MARA',6,17.2,{hp:150,follow:0,vital:0});m.hidden=1;m.g.visible=false;A.vt=0}),
  SDEF("Hold the *bank entrance* while *Dex* cuts the vault.",95,(A,G,w)=>{const sp=[[30,24],[-30,24],[0,45],[24,40],[-24,40],[30,-2],[-28,-2]];for(let i=0;i<3+Math.min(2,w>>1);i++){const p=ri(sp);G.push(thug(p[0]+rr(-3,3),p[1]+rr(-3,3),{acc:.28}))}if(w==3)heat=Math.max(heat,2.4)},{every:12,clear:1,lab:'VAULT',prog:'DRILL'}),
  SC('heist2'),
  SDO(A=>{const v=A.v.vic;v.ent=null;v.top=21;svRoute(v,[[-60,20],[-60,-20],[-20,-20],[20,-20],[60,-20],[100,-20],[140,-20],[150,-36,0,10],[151,-48,0,6]],21);for(const[k,x]of[['e1',-60],['e2',-70]]){const c=svCar(k,0x111114,0,x,17,-PI/2,{hp:28,top:22});c.mode='pursue';c.gunner=1}heat=Math.max(heat,1.6)}),
  STAIL("Follow *Victor* — he's heading for the airport.",'vic',{min:2,max:150,spot:1e9,lostTxt:'Victor got away.'}),
  SDO(A=>{const j=mkPlane('jet',150,-56,PI/2);planes.splice(planes.indexOf(j),1);A.jet={j,x:150,z:-56,v:0};const e={isVeh:1,enm:1,x:150,z:-56,hp:70,hp0:70,rad:4.8,dead:0,onDie:()=>{A.jet.dead=1}};A.jet.e=e;ENM.push(e);A.ents.push(e);A.ents.push({obj:j.g})}),
  SC('jet1'),
  {init(A){objSet("Stop the *jet* before it takes off! Shoot it or ram it.");beaconObj(A.jet.e,0xff3b3b)},tick(A,dt){const J=A.jet,e=J.e;if(J.dead){if(!J.boom){J.boom=1;for(let i=0;i<5;i++)setTimeout(()=>explode(J.x+rr(-6,6),1.5,J.z+rr(-3,3)),i*180);J.j.g.rotation.z=.25;J.j.g.position.y=-.4;FIRES.push({x:J.x,z:J.z,t:60});debris(J.x,2,J.z,16)}return A.t>1.6&&(J.tt=(J.tt||0)+dt)>2.2}
   J.v=Math.min(22,J.v+dt*(J.x<200?.9:1.3));J.x+=J.v*dt;J.j.g.position.set(J.x,J.x>325?(J.x-325)*.35:0,J.z);J.j.g.rotation.x=J.x>325?-.18:0;e.x=J.x;e.z=J.z;if(J.x>352)return'Victor escaped.';
   if(P.car&&Math.hypot(P.car.x-J.x,P.car.z-J.z)<6.5&&Math.abs(P.car.v)>7&&(J.rc=(J.rc||0)-dt)<=0){J.rc=.6;e.hp-=18;shake=1;snd(80,.4,'sawtooth',.12);P.car.v*=.3}
   if(e.hp<=0&&!e.dead){e.dead=1;J.dead=1}sbarSet(barH('JET',e.hp/e.hp0,'#ff4f4f')+'<span>RUNWAY '+Math.max(0,Math.round((352-J.x)))+'M</span>');return 0}},
  SC('final1'),
  SCHOICE("Victor Calloway is on his knees in the ash. The sirens are getting closer.","Lower the gun. Let Lena take him.","Pull the trigger."),
  {init(A){A.cd=0;cinPlay(CS[A.ch==1?'endA':'endB'](A),()=>{A.cd=1})},tick(A){return A.cd},wait:1},
  SDO(A=>{ST.flags.debt=0;stSave()})]}];
const CREDITS=['#EMBER CITY','!A STORY OF ASHES',' ','!STARRING','NICO VANCE','MARA VANCE','DEXTER “DEX” OKAFOR','DETECTIVE LENA CRUZ','MA DELACROIX','VICTOR CALLOWAY',' ','!AND','CAPTAIN RICHARD HARLAN','BRICK','SAL','MR. OKONKWO (OFFSTAGE, SICK)',' ','!IN MEMORY OF','REMY DELACROIX','DET. ANTONIO RUIZ','DEX OKAFOR',' ','!THANK YOU FOR PLAYING','Ember City is still out there.','The casino is still open. Ma still keeps her shotgun by the door.',' ','#THE END'];
