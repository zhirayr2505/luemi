import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const base = 'https://luemi.onrender.com';
const expectedCommit = '09f012b949810c1dff0e1a3569b2762fdcdae2e1';
const errors = [];
const shots = 'qa-shots';
await mkdir(shots, { recursive: true });

async function awaitNewDeployment() {
  for (let attempt = 0; attempt < 48; attempt++) {
    try {
      const healthResponse = await fetch(base + '/api/health', { cache: 'no-store' });
      const health = await healthResponse.json();
      if (healthResponse.status !== 200 || health.service !== 'luemi' || health.status !== 'ok') {
        throw Error('Health mismatch ' + JSON.stringify(health));
      }
      const html = await (await fetch(base + '/?qa=' + Date.now(), { cache: 'no-store' })).text();
      const cssPath = html.match(/href="([^"]+\.css)"/)?.[1];
      if (cssPath) {
        const css = await (await fetch(new URL(cssPath, base), { cache: 'no-store' })).text();
        if (css.includes('.photo-viewer') && css.includes('luemi-photo-rim')) {
          console.log('LIVE_COMMIT_ASSET_GATE_PASS', expectedCommit, cssPath, JSON.stringify(health));
          return;
        }
      }
    } catch (e) {
      console.log('Live readiness attempt', attempt + 1, String(e));
    }
    await sleep(5000);
  }
  throw Error('Live production does not serve v5 photo-viewer assets + healthy API');
}
const assert = (truth, explanation) => {
  if (!truth) throw Error(explanation);
};
let browser;
try {
  await awaitNewDeployment();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  await page.goto(base + '/?qa=v5prod', { waitUntil: 'networkidle' });
  await page.locator('.slide-pane[data-page="Знакомства"] .profile-name').first().click();
  await page.locator('.profile-detail-root').waitFor({ state: 'visible' });

  const data = await page.evaluate(() => {
    const a = document.querySelector('.profile-snap-open');
    const b = document.querySelector('.profile-snap-closed');
    return { travel: b.offsetTop - a.offsetTop };
  });
  assert(data.travel > 200 && data.travel < 360, 'Invalid morph travel ' + data.travel);
  assert(await page.locator('.profile-morph-circle-rim').count() === 0, 'Legacy rim returned');
  const opacities = [];
  for (let y = 0; y <= data.travel; y += 20) {
    const val = await page.evaluate(async y => {
      const sc = document.querySelector('.profile-detail-scroll');
      sc.style.scrollSnapType = 'none';
      sc.scrollTop = y;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return parseFloat(getComputedStyle(document.querySelector('.profile-morph-photo'), '::after').opacity);
    }, Math.min(y, data.travel));
    opacities.push({ y, opacity: val });
  }
  const rect = await page.evaluate(async travel => {
    document.querySelector('.profile-detail-scroll').scrollTop = travel;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return document.querySelector('.profile-morph-photo').getBoundingClientRect().toJSON();
  }, data.travel);
  const opacity = await page.locator('.profile-morph-photo').evaluate(el =>
    parseFloat(getComputedStyle(el, '::after').opacity));
  assert(opacities.filter(p => p.y <= data.travel * 0.48).every(p => p.opacity < 0.08),
    'Rim appears too early ' + JSON.stringify(opacities));
  assert(opacity > 0.95, 'Rim does not reach 1: ' + opacity);
  assert(Math.abs(rect.width - 56) <= 1 && Math.abs(rect.height - 56) <= 1,
    'Portrait not 56×56: ' + JSON.stringify(rect));
  const polish=await page.evaluate(()=>{
    const logo=document.querySelector('.logo-island')?.getBoundingClientRect();
    const mark=document.querySelector('.logo-island-wordmark')?.getBoundingClientRect();
    const compact=document.querySelector('.profile-morph-compact');
    const rail=document.querySelector('.profile-tabs-rail');
    return {logoWidth:logo?.width,markWidth:mark?.width,
      centers:[logo?.left+logo?.width/2,mark?.left+mark?.width/2],
      blur:getComputedStyle(compact).backdropFilter,
      shadow:getComputedStyle(rail).boxShadow,
      interests:document.querySelectorAll('#profile-panel-0 .interest-chip-icon').length};
  });
  assert(polish.logoWidth===116 && polish.markWidth===70,'Logo not v6-sized '+JSON.stringify(polish));
  assert(Math.abs(polish.centers[0]-polish.centers[1])<1.5,'Wordmark not centered');
  assert(polish.blur.includes('blur(14px)'),'Name capsule blur missing '+polish.blur);
  assert(polish.shadow.includes('inset')&&!polish.shadow.includes('0px -12px'),'Tab halo remains '+polish.shadow);
  assert(polish.interests>=5,'Interest icons missing '+polish.interests);
  console.log('PRODUCTION_V6_POLISH_PASS',JSON.stringify(polish));
  await page.screenshot({ path: shots + '/production-collapsed-ring.png' });
  console.log('PRODUCTION_1_RING_PASS', JSON.stringify({ travel: data.travel, photo: rect, opacity }));

  await page.locator('.profile-detail-scroll').evaluate(e => { e.scrollTop = 650; });
  await page.getByRole('tab', { name: 'Фото', exact: true }).click();
  await page.screenshot({ path: shots + '/production-tabs-photo.png' });
  assert(await page.locator('.profile-photo-tile').count() === 3, 'Alina photos count !=3');
  await page.locator('.profile-photo-tile').first().click();
  const dlg = page.locator('dialog.photo-viewer');
  await dlg.waitFor({ state: 'visible' });
  let geometry = await dlg.evaluate(e => ({ rect: e.getBoundingClientRect().toJSON(), background: getComputedStyle(e).backgroundColor }));
  assert(Math.abs(geometry.rect.width - 393) <= 2 && Math.abs(geometry.rect.height - 852) <= 2,
    'Viewer not fullscreen ' + JSON.stringify(geometry));
  assert(geometry.background === 'rgb(12, 7, 18)', 'Viewer not dark ' + geometry.background);
  assert((await page.locator('.pv-counter').innerText()).trim() === '1 / 3', 'Counter not initial 1/3');
  assert(await page.locator('.pv-progress > span').count()===3,'Photo progress indicators missing');
  await page.screenshot({ path: shots + '/production-viewer.png' });
  const cdp = await page.context().newCDPSession(page);
  const point = (x,y) => [{ x, y, radiusX: 2, radiusY: 2, force: 1, id: 0 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(315,420) });
  for (let i=1;i<=10;i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(315-Math.round(i*25),420) });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await cdp.detach();
  await sleep(700);
  assert((await page.locator('.pv-counter').innerText()).trim() === '2 / 3',
    'Photo swipe did not advance to 2/3');
  const stage = page.locator('.pv-slide[data-index="1"] .pv-photo-stage');
  const box = await stage.boundingBox();
  const x = box.x + box.width/2, y = box.y + box.height/2;
  await page.touchscreen.tap(x,y);
  await sleep(110);
  await page.touchscreen.tap(x,y);
  await sleep(120);
  const scale = await stage.evaluate(e => Math.hypot(
    new DOMMatrixReadOnly(getComputedStyle(e).transform).a,
    new DOMMatrixReadOnly(getComputedStyle(e).transform).b,
  ));
  assert(scale > 2.2 && scale < 2.8, 'Photo double-tap zoom not 2.5: '+scale);
  await page.screenshot({ path: shots + '/production-viewer-zoom.png' });
  await page.getByRole('button', {name:'Действия с фото'}).click();
  for(const action of ['Поделиться','Скопировать ссылку','Пожаловаться на фото','Заблокировать']) {
    assert(await page.getByRole('menuitem',{name:action}).count()===1,'Photo menu missing: '+action);
  }
  await page.screenshot({ path: shots + '/production-photo-menu.png' });
  await page.getByRole('menuitem',{name:'Пожаловаться на фото'}).click();
  assert(await page.getByText('Пожаловаться',{exact:true}).count()>0,'Existing report dialog did not open');
  assert(errors.length===0,'Production JS errors '+errors.join(' | '));
  console.log('PRODUCTION_6_VIEWER_PASS',JSON.stringify({geometry,scale,errors}));
  console.log('PRODUCTION_MOBILE_QA_PASS',expectedCommit);
} finally {
  await browser?.close();
}
