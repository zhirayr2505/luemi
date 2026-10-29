import test from 'node:test';
import assert from 'node:assert/strict';
import {readConfig} from '../src/config.js';

const base={
  NODE_ENV:'production',PORT:'3001',APP_ORIGIN:'https://luemi.onrender.com',
  TELEGRAM_BOT_TOKEN:'123456:unit_testing_bot_token',HEALTH_CHECK_KEY:'a'.repeat(32),
  REM05B_SESSIONS_ENABLED:'1',REM05B_BOT_NAMESPACE:'luemi-live',
  REM05B_AUTH_DATABASE_URL:'postgres://issuer.example.invalid/postgres',
  REM05B_REQUEST_DATABASE_URL:'postgres://request.example.invalid/postgres',
  REM05B_SESSION_PEPPER:'p'.repeat(64),REM06_PRIVACY_APPROVED:'1',
  REM06_CONSENT_VERSION:'luemi-v1',REM06_PRIVATE_DRAFT_ENABLED:'1',
  REM06_MEDIA_ENABLED:'1',REM06_MEDIA_WORKER_DATABASE_URL:'postgres://worker.example.invalid/postgres',
  REM06_MEDIA_BUCKET:'luemi-profile-private',REM06_SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',
  REM06_SUPABASE_STORAGE_SECRET:'sb_secret_'+'x'.repeat(32),REM06_PUBLICATION_ENABLED:'1',
  REM06_MODERATION_OPERATIONAL_APPROVED:'1',
  REM06_PUBLISHER_DATABASE_URL:'postgres://publisher.example.invalid/postgres',
  REM06_DISCOVERY_DATABASE_URL:'postgres://discovery.example.invalid/postgres',
  REM06_OPEN_SIGNUPS_ENABLED:'1',REM06_OPEN_SIGNUPS_APPROVED:'1',
};
const bliki={
  BLIKI_V1_ENABLED:'1',BLIKI_V1_PUBLICATION_ENABLED:'1',
  BLIKI_V1_MEDIA_PIPELINE_ENABLED:'1',BLIKI_V1_INTERACTION_ENABLED:'1',
  BLIKI_V1_STORAGE_PROJECT_REF:'czzyoxrwtnvbicypwrdd',
  BLIKI_V1_STORAGE_SECRET:'sb_secret_'+'b'.repeat(32),
  BLIKI_V1_READ_DATABASE_URL:'postgres://bliki_read.example.invalid/postgres',
  BLIKI_V1_MEDIA_DATABASE_URL:'postgres://bliki_media.example.invalid/postgres',
  BLIKI_V1_WRITE_DATABASE_URL:'postgres://bliki_write.example.invalid/postgres',
  BLIKI_V1_INTERACTION_DATABASE_URL:'postgres://bliki_interaction.example.invalid/postgres',
};

test('Bliki remains absent by default and all subfeatures are explicit',()=>{
  const off=readConfig(base);
  assert.equal(off.bliki,undefined);assert.equal(off.blikiPublication,undefined);
  const on=readConfig({...base,...bliki});
  assert.equal(on.bliki?.enabled,true);assert.equal(on.blikiMedia?.enabled,true);
  assert.equal(on.blikiPublication?.enabled,true);assert.equal(on.blikiInteraction?.enabled,true);
});

test('Bliki fails closed for missing pipeline, wrong project or reused principals',()=>{
  for(const patch of [
    {BLIKI_V1_MEDIA_PIPELINE_ENABLED:'0'},
    {BLIKI_V1_STORAGE_PROJECT_REF:'another-project'},
    {BLIKI_V1_MEDIA_DATABASE_URL:bliki.BLIKI_V1_READ_DATABASE_URL},
    {BLIKI_V1_WRITE_DATABASE_URL:base.REM06_PUBLISHER_DATABASE_URL},
  ]) assert.throws(()=>readConfig({...base,...bliki,...patch}),/BLIKI/);
});

test('Bliki subfeatures cannot be enabled under a disabled root gate',()=>{
  assert.throws(()=>readConfig({...base,BLIKI_V1_PUBLICATION_ENABLED:'1',
    BLIKI_V1_MEDIA_PIPELINE_ENABLED:'1',BLIKI_V1_WRITE_DATABASE_URL:bliki.BLIKI_V1_WRITE_DATABASE_URL}),/BLIKI/);
});
