import assert from 'node:assert/strict';
import {recoverServerFields} from '../apps/web/src/registration/remote-recovery.ts';

const fields={displayName:'Анна',birthDate:'1998-05-12',gender:'woman',city:'Краснодар',
 countryCode:'RU',radius:100,searchScope:'radius',audience:'everyone',ageMin:18,ageMax:35,
 goal:'serious',interests:['music'],about:'Привет',languages:['ru']};
const recovered=recoverServerFields(fields);
assert.equal(recovered?.name,'Анна');
assert.equal(recovered?.year,'1998');
assert.equal(recovered?.placeId,''); // The server cannot prove the local city selection.
assert.equal(recoverServerFields({...fields,ageMin:-1}),null);
console.log('remote field recovery: PASS');
