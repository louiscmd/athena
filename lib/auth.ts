// Native stub — auth only runs on web
export interface AthenaUser { id: string; email: string }
export async function signUp(_e: string, _p: string): Promise<AthenaUser> { throw new Error('web only'); }
export async function signIn(_e: string, _p: string): Promise<AthenaUser> { throw new Error('web only'); }
export async function signOut(): Promise<void> {}
export async function getUser(): Promise<AthenaUser | null> { return null; }
export function onAuthChange(_cb: (u: AthenaUser | null) => void): () => void { return () => {}; }
