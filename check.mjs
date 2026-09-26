import fs from 'fs';
const firebaseConfig = {
    apiKey: 'AIzaSyCfLLfHSHiWEGrcwct9NdLk8hHS4V0DSEU',
    projectId: 'billing-dc0b2'
};
const refreshToken = 'AMf-vBy67DqZ0l7XyTEBIo9NB55T_zwowgMMKhTTpN10TTjgNckTl-06ctMeb5ICjtreTIVJGXq6s3rwIwM0SELFcgP_s6j-tEUp4dZ1SG8RNfZM8ZtMpis52XDWpMyfxBo0BgBqUDQDy9SxPQwNlG8rA3ybDJKWN1upM0C4B9Ihkb4q4Pk5zSv9iAeILb9DgeZ22j7Dh8zw-P_kTfkDOA6pXToVv7KI911m2HPfbthKWip53lqnI_FC-TE-kSbnEA6VLFi4ILLLCWLLLfg5N1FDhQnVA5_XrgpBH8c7MypNgzan9vhKHkc';

async function main() {
  const tokenRes = await fetch('https://securetoken.googleapis.com/v1/token?key=' + firebaseConfig.apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
  });
  const tokenData = await tokenRes.json();
  const idToken = tokenData.id_token;
  const res = await fetch('https://firestore.googleapis.com/v1/projects/' + firebaseConfig.projectId + '/databases/(default)/documents/users/do139V31SkRXMSpkLIW1AroA9ZO2', {
    headers: { 'Authorization': 'Bearer ' + idToken }
  });
  const doc = await res.json();
  console.log('All fields on user doc:', Object.keys(doc.fields || {}));
  for (const k of Object.keys(doc.fields || {})) {
    if (k === 'transactions') {
      console.log(' - transactions: count =', doc.fields[k].arrayValue?.values?.length);
    } else {
      console.log(' -', k, ':', JSON.stringify(doc.fields[k]));
    }
  }
}
main();
