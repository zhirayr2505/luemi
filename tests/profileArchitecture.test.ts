import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync,existsSync} from 'node:fs';

const path=(name:string)=>new URL('../apps/web/src/'+name,import.meta.url);
const source=(name:string)=>readFileSync(path(name),'utf8');

test('Profile motion has one scroller and one independent overlay',()=>{
 const profile=source('ProfileMotion.tsx');
 assert.match(profile,/className="profile-detail-root"/);
 assert.match(profile,/<main ref=\{scroller\} className="profile-detail-scroll"/);
 assert.match(profile,/className="profile-morph-overlay"/);
 const scrollStart=profile.indexOf('className="profile-detail-scroll"');
 const scrollEnd=profile.indexOf('</main>',scrollStart);
 const overlayStart=profile.indexOf('className="profile-morph-overlay"');
 assert.ok(scrollStart>=0&&scrollEnd>scrollStart&&overlayStart>scrollEnd,'overlay must be a sibling outside native scroll');
});
test('No competing RAF scroll writer or counter-translation',()=>{
 const code=source('motion/useProfilePhotoMorph.ts');
 const frame=code.slice(code.indexOf('const draw='),code.indexOf('const queue='));
 assert.ok(frame.length>100);
 assert.doesNotMatch(frame,/scrollTop\s*=|scrollTo\s*\(/,'no scrollTop writes in compositor RAF');
 assert.doesNotMatch(frame,/translateY|translate3d\([^\n]*f\.translateY/,'no inverse scroll Y compensation');
 assert.match(code,/addEventListener\('scrollend'/);
 assert.match(code,/if\(snapping\)\{snapping=false/);
});
test('Profile styles have one owner, no legacy stylesheet',()=>{
 assert.equal(existsSync(path('style.css')),false,'delete dead v0 stylesheet');
 const css=source('profileMotion.css');
 assert.match(css,/\.profile-morph-overlay/);
 assert.match(css,/\.profile-detail-scroll/);
 assert.doesNotMatch(css,/position:\s*sticky/i);
 assert.doesNotMatch(source('styles.css'),/\.profile-morph-stage\{/);
});
test('Logo does not animate its glare on profile scroll',()=>{
 assert.match(source('LiquidLogo.tsx'),/el\.closest\('\.profile-detail-root'\)/);
});
