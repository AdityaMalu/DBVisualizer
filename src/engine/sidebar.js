/* ---------- topic sidebar: collapse/expand and drag-to-resize on wide screens, slide-in drawer on narrow ones.
   The open/closed choice and the width are remembered in this browser. ---------- */
const RAIL_KEY = 'dbv-rail-v1', RAIL_MIN = 220, RAIL_MAX = 480, RAIL_DEFAULT = 270;
const narrow = matchMedia('(max-width: 980px)');
const app = document.querySelector('.app');
let rail = {open: true, w: RAIL_DEFAULT}, drawerOpen = false;
try { Object.assign(rail, JSON.parse(localStorage.getItem(RAIL_KEY) || '{}')); } catch(e){}
function saveRail(){ try { localStorage.setItem(RAIL_KEY, JSON.stringify(rail)); } catch(e){} }

function setRailWidth(w){
  rail.w = Math.round(Math.min(RAIL_MAX, Math.max(RAIL_MIN, +w || RAIL_DEFAULT)));
  app.style.setProperty('--rail-w', rail.w + 'px');
  $('railResize').setAttribute('aria-valuenow', rail.w);
}
function applyRail(){
  const shown = narrow.matches ? drawerOpen : rail.open;
  app.classList.toggle('rail-closed', !narrow.matches && !rail.open);
  app.classList.toggle('rail-open', narrow.matches && drawerOpen);
  $('railBackdrop').hidden = !(narrow.matches && drawerOpen);
  $('railToggle').setAttribute('aria-expanded', shown);
  $('railToggle').title = shown ? 'Hide the topic list' : 'Show the topic list';
}
function openRail(){
  if (narrow.matches) drawerOpen = true; else { rail.open = true; saveRail(); }
  applyRail();
  ($('rail').querySelector('button[aria-current="true"]') || $('railClose')).focus({preventScroll: true});
  $('rail').querySelector('button[aria-current="true"]')?.scrollIntoView({block: 'nearest'});
}
function closeRail(){
  if (narrow.matches) drawerOpen = false; else { rail.open = false; saveRail(); }
  applyRail();
  $('railToggle').focus({preventScroll: true});
}

$('railToggle').onclick = () => (narrow.matches ? drawerOpen : rail.open) ? closeRail() : openRail();
$('railClose').onclick = closeRail;
$('railBackdrop').onclick = closeRail;
$('sidebar').addEventListener('click', e => {           // picking a topic in the drawer closes it
  if (narrow.matches && drawerOpen && e.target.closest('#rail button')) { drawerOpen = false; applyRail(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && narrow.matches && drawerOpen) closeRail(); });
narrow.addEventListener('change', () => { drawerOpen = false; applyRail(); });

// drag the right edge to resize; arrow keys when focused; double-click resets
const grip = $('railResize');
grip.addEventListener('pointerdown', e => { e.preventDefault(); grip.setPointerCapture(e.pointerId); app.classList.add('resizing'); });
grip.addEventListener('pointermove', e => { if (grip.hasPointerCapture(e.pointerId)) setRailWidth(e.clientX); });
grip.addEventListener('pointerup', () => { app.classList.remove('resizing'); saveRail(); });
grip.addEventListener('lostpointercapture', () => app.classList.remove('resizing'));
grip.addEventListener('dblclick', () => { setRailWidth(RAIL_DEFAULT); saveRail(); });
grip.addEventListener('keydown', e => {
  const d = {ArrowLeft: -20, ArrowRight: 20}[e.key];
  if (e.key === 'Home' || e.key === 'End') setRailWidth(e.key === 'Home' ? RAIL_MIN : RAIL_MAX);
  else if (d) setRailWidth(rail.w + d);
  else return;
  e.preventDefault(); e.stopPropagation(); saveRail();     // keep ← → from also stepping the walkthrough
});

setRailWidth(rail.w);
applyRail();
