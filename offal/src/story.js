// What story mode is about, floor by floor. You are Dale Hollis's kid. He went in for the night shift at
// Hollow Pines the night it closed, in 1998, and never came out. Last week his time card came in the post,
// stamped with tonight's date. Somebody on a walkie talks you down through the plant; his notes are lying
// about on the way; the PA gets stranger the deeper you go. At the bottom you find out who's been
// following you. Nothing here is gameplay: it's all words, timed by main.js.

export const INTRO = [
  'Hollow Pines Meatworks closed in 1998.',
  'Your father worked nights there. On the last night he clocked in at 22:00, and he didn’t come home.',
  'Last week an envelope came, addressed to him. Inside was his time card, stamped with tonight’s date, and four words in red: REPORT FOR YOUR SHIFT.',
  'You drove out at ten. The gates were open. The lights were on.',
  'The lift was waiting for you.',
];

// one per floor, B1..B10
// arrive / leave: what the voice on the walkie says when the gate goes up, and when the lift starts to move
// pa: the tannoy, once you've been on the floor a while. last: the tannoy when the last tag is cut
// note: a page of your father's night log, lying somewhere on the floor
export const BEATS = [
  { arrive: ['…is this thing on? Hello?', 'If you can hear me, you’re on the line. Cut the tags off the dead ones. The lift won’t move without them.'],
    leave: ['Good. Keep going down. Don’t let him see you.'],
    pa: 'WELCOME TO HOLLOW PINES. THE NIGHT SHIFT BEGINS AT 22:00. IT ENDS WHEN THE QUOTA IS MET.',
    last: 'THE LINE IS SHORT ONE WORKER. FOREMAN TO THE FLOOR.',
    note: 'Night 1.\n$14 an hour, cash, nights only. Just for a year. Marie thinks I’m crazy.\nThe Foreman showed me round. Never seen a man that tall. Never seen him blink.' },
  { arrive: ['You came back for somebody. Everybody who comes down here came back for somebody.'],
    leave: ['He worked this floor, your dad. Said you stop hearing the guns after a week.'],
    pa: 'REMINDER: A CLEAN SHOT IS A KIND SHOT.',
    last: 'STUNNING IS BEHIND QUOTA. FOREMAN TO STUNNING.',
    note: 'Night 30.\nThey gave me a bolt gun. You put it to the head and pull. The cattle don’t scream.\nThat’s the thing that gets you, after a while. That they don’t.' },
  { arrive: ['They filed us down here. Name, number, drawer.', 'Don’t read the names.'],
    leave: ['Was one of them his?', '…Don’t answer that.'],
    pa: 'STAFF ARE REMINDED NOT TO READ THE DRAWER LABELS.',
    last: 'A DRAWER IS OPEN IN THE MORGUE. FOREMAN, PLEASE FILE IT.',
    note: 'Night 200-something.\nHeadcount was down again. Foreman said he’d take care of it.\nThe new ones come down in the lift. I’ve never seen one go back up.' },
  { arrive: ['Stay out of the water if you can. What’s in the water isn’t all the way dead.'],
    leave: ['You’re doing better than I did.'],
    pa: 'THE DRAINS ARE OUT OF BOUNDS. THE DRAINS ARE ALWAYS OUT OF BOUNDS.',
    last: 'SOMETHING IN THE DRAINS SHOULD BE ON THE LINE. FOREMAN TO THE DRAINS.',
    note: 'Found Ray in the drains. Twenty years he worked here, they gave him a lighter.\nI cut his tag off so somebody would remember his number. 4417.' },
  { arrive: ['There’s two of him now. Or he’s faster than he used to be. I can’t tell any more.'],
    leave: ['Better than I did? Who said that?', '…It doesn’t matter. Keep going.'],
    pa: 'CONGRATULATIONS TO THE FOREMAN ON HIS FORTIETH YEAR OF SERVICE.',
    last: 'EVISCERATION HAS A WALK-IN. BOTH FOREMEN TO THE FLOOR.',
    note: 'The quota went up again. It always goes up.\nThe Foreman stands at the end of the line and watches. I don’t think he’s a man.\nI think he was one.' },
  { arrive: ['Read what they signed up here. Then you’ll know why nobody came looking.'],
    leave: ['Your mother called this place every night for a year.', 'Somebody up here wrote down every call.'],
    pa: 'STAFF WISHING TO RESIGN SHOULD REPORT TO THE LOWER FLOORS.',
    last: 'ADMINISTRATION REMINDS STAFF THAT NOBODY QUITS. FOREMAN TO THE OFFICES.',
    note: 'Went up to the offices to quit.\nThere’s a file with my name on it. It already says TERMINATED.\nIt already has a date on it. It’s the night the plant closes.' },
  { arrive: ['Count the marks on the walls. Those are nights.'],
    leave: ['Nine thousand, four hundred and twelve.', 'Mine.'],
    pa: 'THE COLD ROOM IS AT CAPACITY. THE COLD ROOM IS ALWAYS AT CAPACITY.',
    last: 'THE COLD ROOM IS ONE DRAWER SHORT. FOREMAN, MAKE ROOM.',
    note: 'I’ve stopped going home. I don’t remember deciding to.\nMarie, if anybody gives you this, I’m sorry.\nTell the kid I’m on nights.' },
  { arrive: ['It gets cold enough down here that you stop feeling it. That’s when it gets easy.', 'Don’t let it get easy.'],
    leave: ['Whatever happens down there, don’t stay.'],
    pa: 'HYPOTHERMIA IS NOT AN ACCEPTED REASON FOR ABSENCE.',
    last: 'A FREEZER DOOR IS OPEN. SOMETHING WARM IS IN THE FREEZER.',
    note: 'He let me look inside his coat tonight. It’s warm in there.\nThere’s room. He says there’s always room.' },
  { arrive: ['can you hear it. the line. it sounds like breathing.', 'it sounds like me.'],
    leave: ['…kiddo.'],
    pa: 'THE FOREMAN IS RETIRING. APPLICATIONS FOR THE POSITION ARE NOW CLOSED.',
    last: 'THE LINE IS LISTENING. THE LINE IS LISTENING. THE LINE IS LISTENING.',
    note: 'The Foreman is getting old. He told me so.\nSomebody has to take the line when he’s done, he said.\nThen he looked at me for a long time.' },
  { arrive: ['Stop the line. Then go.', 'Don’t look for me. You already found me. You’ve been running from me all night.'],
    leave: [],
    pa: 'HOLLIS, D. NUMBER 0451. RETURN TO YOUR STATION.',
    last: '',
    note: 'If you’re reading this, you came down. Of course you did. You always were stubborn.\nStop the line. Don’t look at his face. You’ll know it.\nGo home.\n— Dad' },
];
export const NOTE_IDS = BEATS.map((_, i) => 'note-' + (i + 1));
export const noteTitle = (i) => `NIGHT LOG, PAGE ${i + 1}`;

// the card after the film: the way out, and what follows you home
export const ENDING = [
  '06:00. Somewhere outside, birds.',
  'There are two cars in the staff lot. Yours, and a Ford under twenty-five years of leaves.',
  'The walkie on your belt clicks once. A voice you knew before you could remember anything says, very quietly: “Go home, kiddo.”',
  'In your pocket, your time card has been stamped. Under your name, in his handwriting: SEE YOU TONIGHT.',
];
