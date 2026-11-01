import { describe, expect, it } from 'vitest'
import { findClientDuplicates, parseClientImportRows } from './clientTools'
import type { ClientRecord } from './data'

const client: ClientRecord = {
  id: 'client-1',
  name: 'Atelier Kora',
  email: 'contact@kora.bj',
  phone: '+229 97 00 11 22',
  address: null,
  client_type: 'company',
  notes: null,
  status: 'active',
}

describe('client management tools', () => {
  it('normalizes French import headers and ignores rows without a name', () => {
    expect(parseClientImportRows([
      { 'Nom du client': 'Maison Aïcha', 'Adresse email': 'contact@aicha.bj', Téléphone: '+229 90 00 00 00', Type: 'Entreprise' },
      { 'Adresse email': 'no-name@example.com' },
    ])).toEqual([{
      name: 'Maison Aïcha',
      email: 'contact@aicha.bj',
      phone: '+229 90 00 00 00',
      address: '',
      clientType: 'company',
      notes: '',
    }])
  })

  it('detects duplicate emails and normalized phone numbers', () => {
    expect(findClientDuplicates({ email: ' CONTACT@KORA.BJ ', phone: '97001122' }, [client])).toEqual([
      { client, fields: ['email', 'phone'] },
    ])
    expect(findClientDuplicates({ email: '', phone: '00229 97 00 11 22' }, [client])).toEqual([
      { client, fields: ['phone'] },
    ])
    expect(findClientDuplicates({ email: '', phone: '' }, [client])).toEqual([])
    expect(findClientDuplicates({ email: 'contact@kora.bj', phone: '' }, [client], client.id)).toEqual([])
  })
})
