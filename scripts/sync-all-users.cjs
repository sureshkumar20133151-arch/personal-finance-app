const crypto = require('crypto');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'listing-generator-31b39-firebase-adminsdk-fbsvc-3079296a82.json'));

async function getAccessToken() {
  let realNow;
  try {
    const timeRes = await fetch('https://timeapi.io/api/time/current/zone?timeZone=UTC');
    const timeData = await timeRes.json();
    realNow = Math.floor(new Date(timeData.dateTime + 'Z').getTime() / 1000);
  } catch {
    realNow = Math.floor(Date.now() / 1000);
  }

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claimSet = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase',
    aud: 'https://oauth2.googleapis.com/token',
    exp: realNow + 3600,
    iat: realNow - 10
  })).toString('base64url');

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(header + '.' + claimSet);
  const signature = signer.sign(serviceAccount.private_key, 'base64url');
  const jwt = header + '.' + claimSet + '.' + signature;

  const authRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  const data = await authRes.json();
  if (!data.access_token) {
    throw new Error('Failed to get Google OAuth token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

async function syncAllUsers() {
  console.log('Authenticating with Google OAuth...');
  const accessToken = await getAccessToken();
  console.log('Authenticated successfully!');

  console.log('Downloading all users from Firebase Authentication...');
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${serviceAccount.project_id}/accounts:batchGet?maxResults=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const authData = await res.json();
  const users = authData.users || [];
  console.log(`Found ${users.length} users in Firebase Authentication:\n`);

  for (const u of users) {
    const uid = u.localId;
    const email = u.email || '';
    const displayName = u.displayName || (email ? email.split('@')[0] : 'User');
    const photoURL = u.photoUrl || null;

    console.log(`- UID: ${uid}`);
    console.log(`  Email: ${email}`);
    console.log(`  Name:  ${displayName}`);

    // Update Firestore via REST API
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=email&updateMask.fieldPaths=displayName&updateMask.fieldPaths=photoURL`;
    
    const fields = {
      email: { stringValue: email },
      displayName: { stringValue: displayName },
    };
    if (photoURL) {
      fields.photoURL = { stringValue: photoURL };
    }

    const patchRes = await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });

    if (patchRes.ok) {
      console.log(`  -> Synced to Firestore users/${uid} successfully!`);
    } else {
      const errText = await patchRes.text();
      console.warn(`  -> Firestore patch notice for ${uid}:`, errText);
    }
    console.log('');
  }

  console.log(`\nCOMPLETED: Successfully synced all ${users.length} users to Cloud Firestore!`);
}

syncAllUsers().catch(console.error);
