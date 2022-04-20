import contact, { EmployeeAccount, formatName } from '@anticrm/contact'
import { Account, Class, Client, Obj, Ref, Space, getCurrentAccount } from '@anticrm/core'
import { Asset } from '@anticrm/platform'

export async function getUser (
  client: Client,
  user: Ref<EmployeeAccount> | Ref<Account>
): Promise<EmployeeAccount | undefined> {
  return await client.findOne(contact.class.EmployeeAccount, { _id: user as Ref<EmployeeAccount> })
}

export function getTime (time: number): string {
  let options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: 'numeric' }
  if (!isToday(time)) {
    options = {
      month: 'numeric',
      day: 'numeric',
      ...options
    }
  }

  return new Date(time).toLocaleString('default', options)
}

export function isToday (time: number): boolean {
  const current = new Date()
  const target = new Date(time)
  return (
    current.getDate() === target.getDate() &&
    current.getMonth() === target.getMonth() &&
    current.getFullYear() === target.getFullYear()
  )
}

export function classIcon (client: Client, _class: Ref<Class<Obj>>): Asset | undefined {
  return client.getHierarchy().getClass(_class).icon
}

export async function getDmName (client: Client, dm: Space): Promise<string> {
  const myAccId = getCurrentAccount()._id

  const employeeAccounts = await client.findAll(contact.class.EmployeeAccount, {
    _id: { $in: dm.members as Array<Ref<EmployeeAccount>> }
  })

  const name = (dm.members.length > 1 ? employeeAccounts.filter((a) => a._id !== myAccId) : employeeAccounts)
    .map((a) => formatName(a.name))
    .join(', ')

  return name
}
