import { registerAs } from '@nestjs/config';

export interface FirebaseConfig {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  databaseURL?: string;
  adminTopic?: string;
}

export default registerAs('firebase', (): FirebaseConfig => {
  const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY ?? undefined;
  const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_B64 ?? undefined;

  let privateKey = privateKeyEnv;

  if (!privateKey && privateKeyBase64) {
    try {
      privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
    } catch {
      // Fallback to raw value if decoding fails
      privateKey = privateKeyBase64;
    }
  }

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
    adminTopic: process.env.FIREBASE_ADMIN_TOPIC,
  };
});
