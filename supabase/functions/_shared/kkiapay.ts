import { kkiapay } from 'npm:@kkiapay-org/nodejs-sdk@1.0.7'

const privateKey = Deno.env.get('KKIAPAY_PRIVATE_KEY')?.trim()
const publicKey = Deno.env.get('KKIAPAY_PUBLIC_KEY')?.trim()
const secretKey = Deno.env.get('KKIAPAY_SECRET_KEY')?.trim()
const sandbox = Deno.env.get('KKIAPAY_SANDBOX')?.trim().toLowerCase() === 'true'

export type VerifiedKkiapayTransaction = {
  transactionId: string
  partnerId: string
  amount: number
  status: string
  type: string
  source: string | null
  performedAt: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function verifyKkiapayTransaction(transactionId: string): Promise<VerifiedKkiapayTransaction> {
  if (!privateKey || !publicKey || !secretKey) throw new Error('Configuration API KKiaPay incomplète.')
  const client = kkiapay({ privatekey: privateKey, publickey: publicKey, secretkey: secretKey, sandbox })
  const result: unknown = await client.verify(transactionId)
  if (!isRecord(result)) throw new Error('KKiaPay a retourné une réponse de transaction invalide.')

  const verified: VerifiedKkiapayTransaction = {
    transactionId: typeof result.transactionId === 'string' ? result.transactionId : '',
    partnerId: typeof result.partnerId === 'string' ? result.partnerId : '',
    amount: Number(result.amount),
    status: typeof result.status === 'string' ? result.status.toUpperCase() : '',
    type: typeof result.type === 'string' ? result.type.toUpperCase() : '',
    source: typeof result.source === 'string' ? result.source : null,
    performedAt: typeof result.performed_at === 'string'
      ? result.performed_at
      : typeof result.performedAt === 'string'
        ? result.performedAt
        : null,
  }
  if (
    verified.transactionId !== transactionId ||
    !verified.partnerId ||
    !Number.isFinite(verified.amount)
  ) {
    throw new Error('La réponse KKiaPay ne correspond pas à la transaction demandée.')
  }
  return verified
}
