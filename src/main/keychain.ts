const SERVICE = 'MCModLocalizer2'
const ACCOUNT = 'gemini-api-key'

type Keytar = typeof import('keytar')

async function loadKeytar(): Promise<Keytar> {
  const mod = await import('keytar')
  // CJS modules imported via dynamic import() land on .default
  return ((mod as { default?: Keytar }).default ?? mod) as Keytar
}

export async function getApiKey(): Promise<string | null> {
  try {
    const keytar = await loadKeytar()
    return await keytar.getPassword(SERVICE, ACCOUNT)
  } catch {
    return null
  }
}

export async function setApiKey(password: string): Promise<void> {
  const keytar = await loadKeytar()
  // Strip non-ASCII-printable chars (terminals inject arrows like ➜ U+279C when copied)
  const clean = password.replace(/[^\x20-\x7E]/g, '').trim()
  await keytar.setPassword(SERVICE, ACCOUNT, clean)
}

export async function deleteApiKey(): Promise<void> {
  const keytar = await loadKeytar()
  await keytar.deletePassword(SERVICE, ACCOUNT)
}
