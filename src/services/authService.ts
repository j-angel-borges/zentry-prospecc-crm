import { auth, db } from '../firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export type UserRole = 'superadmin' | 'director' | 'sales_rep';

export interface CrmUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  assignedRepName?: string;
  assignedTabs?: string[];
  lastLogin?: any;
}

// Lista de correos con permisos SuperAdmin directos en Zentry
const SUPERADMIN_EMAILS = [
  'mipropiadinastia@gmail.com',
  'jangelborges@gmail.com',
  'jangelborges@quarz.online'
];

export const LS_GOOGLE_ACCESS_TOKEN = 'zentry_google_access_token_v2';

/**
 * Crea una nueva instancia de GoogleAuthProvider con scopes explícitos de Contactos y Calendario
 */
export function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Scope estándar de Google People API para lectura de contactos
  provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
  // Scope estándar de Google Calendar para sincronización y creación de eventos
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
  provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
  provider.addScope('https://www.googleapis.com/auth/userinfo.email');
  
  // Forzar diálogo de consentimiento de Google para grantear los scopes solicitados y refresh
  provider.setCustomParameters({
    prompt: 'consent select_account',
    access_type: 'offline'
  });
  return provider;
}

export const googleProvider = createGoogleProvider();

export const getStoredAccessToken = (): string | null => {
  try {
    return localStorage.getItem(LS_GOOGLE_ACCESS_TOKEN);
  } catch {
    return null;
  }
};

export const setStoredAccessToken = (token: string | null) => {
  try {
    if (token) {
      localStorage.setItem(LS_GOOGLE_ACCESS_TOKEN, token);
    } else {
      localStorage.removeItem(LS_GOOGLE_ACCESS_TOKEN);
    }
  } catch {}
};

/**
 * Iniciar sesión con Google OAuth solicitando permisos de Contactos y Calendario
 */
export async function loginWithGoogle(): Promise<{ user: User; profile: CrmUserProfile; accessToken?: string }> {
  const provider = createGoogleProvider();
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  console.log('[Auth] Google Login Zentry exitoso. Access token presente:', !!accessToken);

  if (accessToken) {
    setStoredAccessToken(accessToken);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('zentry_google_token_updated'));
    }
  }

  const user = result.user;
  const userDocRef = doc(db, 'crm_users', user.uid);
  const snap = await getDoc(userDocRef);

  let profile: CrmUserProfile;
  const emailLower = (user.email || '').toLowerCase();
  const isSuperAdminEmail = SUPERADMIN_EMAILS.some(e => emailLower.includes(e.toLowerCase()));

  const assignedRep = 'Jose Angel';
  const assignedRole: UserRole = isSuperAdminEmail ? 'superadmin' : 'sales_rep';

  if (snap.exists()) {
    profile = snap.data() as CrmUserProfile;
    let needsUpdate = false;
    const updates: Partial<CrmUserProfile> = {};

    if (profile.role !== assignedRole) {
      profile.role = assignedRole;
      updates.role = assignedRole;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await setDoc(userDocRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
    }
  } else {
    profile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || (isSuperAdminEmail ? 'Super Admin Zentry' : 'Operador ZentryOS'),
      photoURL: user.photoURL || undefined,
      role: assignedRole,
      assignedRepName: assignedRep,
      lastLogin: serverTimestamp()
    };
    await setDoc(userDocRef, profile, { merge: true });
  }

  return { user, profile, accessToken };
}

/**
 * Cerrar sesión y purgar tokens de caché
 */
export async function logoutUser(): Promise<void> {
  setStoredAccessToken(null);
  try {
    localStorage.removeItem(LS_GOOGLE_ACCESS_TOKEN);
  } catch {}
  await signOut(auth);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('zentry_google_token_updated'));
  }
}

/**
 * Obtener perfil de usuario desde Firestore
 */
export async function getUserProfile(uid: string, email?: string | null): Promise<CrmUserProfile | null> {
  try {
    const userDocRef = doc(db, 'crm_users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as CrmUserProfile;
    }

    const emailLower = (email || '').toLowerCase();
    const isSuperAdminEmail = SUPERADMIN_EMAILS.some(e => emailLower.includes(e.toLowerCase()));
    const assignedRole: UserRole = isSuperAdminEmail ? 'superadmin' : 'sales_rep';

    const defaultProfile: CrmUserProfile = {
      uid,
      email: email || '',
      displayName: isSuperAdminEmail ? 'Super Admin Zentry' : 'Operador ZentryOS',
      role: assignedRole,
      assignedRepName: 'Jose Angel',
      lastLogin: serverTimestamp()
    };

    await setDoc(userDocRef, defaultProfile, { merge: true });
    return defaultProfile;
  } catch (e) {
    console.warn('Error obteniendo perfil de usuario:', e);
    return null;
  }
}

export { onAuthStateChanged };
export type { User };
