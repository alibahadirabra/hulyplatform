//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import {
  Account,
  AttachedData,
  AttachedDoc,
  Class,
  Client,
  Data,
  Doc,
  FindResult,
  Ref,
  Space,
  Timestamp,
  UXObject
} from '@hcengineering/core'
import type { Asset, Plugin } from '@hcengineering/platform'
import { IntlString, plugin } from '@hcengineering/platform'
import type { AnyComponent } from '@hcengineering/ui'
import { ViewAction, Viewlet } from '@hcengineering/view'

/**
 * @public
 */
export interface Organizations extends Space {}

/**
 * @public
 */
export interface Persons extends Space {}

/**
 * @public
 */
export interface ChannelProvider extends Doc, UXObject {
  // Placeholder
  placeholder: IntlString

  // Presenter will be shown on click for channel
  presenter?: AnyComponent

  // Action to be performed if there is no presenter defined.
  action?: ViewAction

  // Integration type
  integrationType?: Ref<Doc>
}

/**
 * @public
 */
export interface Channel extends AttachedDoc {
  provider: Ref<ChannelProvider>
  value: string
  items?: number
  lastMessage?: Timestamp
}

/**
 * @public
 */
export interface Contact extends Doc {
  name: string
  avatar?: string | null
  attachments?: number
  comments?: number
  channels?: number
  city: string
}

/**
 * @public
 */
export interface Person extends Contact {
  birthday?: Timestamp | null
}

/**
 * @public
 */
export interface Member extends AttachedDoc {
  contact: Ref<Contact>
}
/**
 * @public
 */
export interface Organization extends Contact {
  members: number
}

/**
 * @public
 */
export interface Status extends AttachedDoc {
  attachedTo: Ref<Employee>
  attachedToClass: Ref<Class<Employee>>
  name: string
  dueDate: Timestamp
}

/**
 * @public
 */
export interface Employee extends Person {
  active: boolean
  statuses?: number
}

/**
 * @public
 */
export interface EmployeeAccount extends Account {
  employee: Ref<Employee>
  name: string
}

const SEP = ','

/**
 * @public
 */
export function combineName (first: string, last: string): string {
  return last + SEP + first
}

/**
 * @public
 */
export function getFirstName (name: string): string {
  return name !== undefined ? name.substring(name.indexOf(SEP) + 1) : ''
}

/**
 * @public
 */
export function getLastName (name: string): string {
  return name !== undefined ? name.substring(0, name.indexOf(SEP)) : ''
}

/**
 * @public
 */
export function formatName (name: string): string {
  return getFirstName(name) + ' ' + getLastName(name)
}

/**
 * @public
 */
export const contactId = 'contact' as Plugin

/**
 * @public
 */
const contactPlugin = plugin(contactId, {
  class: {
    ChannelProvider: '' as Ref<Class<ChannelProvider>>,
    Channel: '' as Ref<Class<Channel>>,
    Contact: '' as Ref<Class<Contact>>,
    Person: '' as Ref<Class<Person>>,
    Persons: '' as Ref<Class<Persons>>,
    Member: '' as Ref<Class<Member>>,
    Organization: '' as Ref<Class<Organization>>,
    Organizations: '' as Ref<Class<Organizations>>,
    Employee: '' as Ref<Class<Employee>>,
    EmployeeAccount: '' as Ref<Class<EmployeeAccount>>,
    Status: '' as Ref<Class<Status>>
  },
  component: {
    SocialEditor: '' as AnyComponent,
    CreateOrganization: '' as AnyComponent,
    CreatePerson: '' as AnyComponent,
    ChannelsPresenter: '' as AnyComponent
  },
  channelProvider: {
    Email: '' as Ref<ChannelProvider>,
    Phone: '' as Ref<ChannelProvider>,
    LinkedIn: '' as Ref<ChannelProvider>,
    Twitter: '' as Ref<ChannelProvider>,
    Telegram: '' as Ref<ChannelProvider>,
    GitHub: '' as Ref<ChannelProvider>,
    Facebook: '' as Ref<ChannelProvider>,
    Homepage: '' as Ref<ChannelProvider>
  },
  icon: {
    ContactApplication: '' as Asset,
    Phone: '' as Asset,
    Email: '' as Asset,
    Discord: '' as Asset,
    Facebook: '' as Asset,
    Instagram: '' as Asset,
    LinkedIn: '' as Asset,
    Telegram: '' as Asset,
    Twitter: '' as Asset,
    VK: '' as Asset,
    WhatsApp: '' as Asset,
    Youtube: '' as Asset,
    GitHub: '' as Asset,
    Edit: '' as Asset,
    Person: '' as Asset,
    Company: '' as Asset,
    SocialEdit: '' as Asset,
    Homepage: '' as Asset
  },
  space: {
    Employee: '' as Ref<Space>,
    Contacts: '' as Ref<Space>
  },
  app: {
    Contacts: '' as Ref<Doc>
  },
  string: {
    PersonAlreadyExists: '' as IntlString,
    Person: '' as IntlString,
    Employee: '' as IntlString,
    CreateOrganization: '' as IntlString
  },
  viewlet: {
    TableMember: '' as Ref<Viewlet>,
    TableContact: '' as Ref<Viewlet>
  }
})

export default contactPlugin

/**
 * @public
 */
export async function findContacts (
  client: Client,
  _class: Ref<Class<Doc>>,
  person: Data<Contact>,
  channels: AttachedData<Channel>[]
): Promise<{ contacts: Contact[], channels: AttachedData<Channel>[] }> {
  if (channels.length === 0 && person.name.length === 0) {
    return { contacts: [], channels: [] }
  }
  // Take only first part of first name for match.
  const values = channels.map((it) => it.value)

  // Same name persons

  const potentialChannels = await client.findAll(contactPlugin.class.Channel, { value: { $in: values } })
  let potentialContactIds = Array.from(new Set(potentialChannels.map((it) => it.attachedTo as Ref<Contact>)).values())

  if (potentialContactIds.length === 0) {
    if (client.getHierarchy().isDerived(_class, contactPlugin.class.Person)) {
      const firstName = getFirstName(person.name).split(' ').shift() ?? ''
      const lastName = getLastName(person.name)
      // try match using just first/last name
      potentialContactIds = (
        await client.findAll(contactPlugin.class.Contact, { name: { $like: `${lastName}%${firstName}%` } })
      ).map((it) => it._id)
      if (potentialContactIds.length === 0) {
        return { contacts: [], channels: [] }
      }
    } else if (client.getHierarchy().isDerived(_class, contactPlugin.class.Organization)) {
      // try match using just first/last name
      potentialContactIds = (
        await client.findAll(contactPlugin.class.Contact, { name: { $like: `${person.name}` } })
      ).map((it) => it._id)
      if (potentialContactIds.length === 0) {
        return { contacts: [], channels: [] }
      }
    }
  }

  const potentialPersons: FindResult<Contact> = await client.findAll(
    contactPlugin.class.Contact,
    { _id: { $in: potentialContactIds } },
    {
      lookup: {
        _id: {
          channels: contactPlugin.class.Channel
        }
      }
    }
  )

  const result: Contact[] = []
  const resChannels: AttachedData<Channel>[] = []
  for (const c of potentialPersons) {
    let matches = 0
    if (c.name === person.name) {
      matches++
    }
    for (const ch of (c.$lookup?.channels as Channel[]) ?? []) {
      for (const chc of channels) {
        if (chc.provider === ch.provider && chc.value === ch.value.trim()) {
          // We have matched value
          resChannels.push(chc)
          matches += 2
          break
        }
      }
    }

    if (matches > 0) {
      result.push(c)
    }
  }
  return { contacts: result, channels: resChannels }
}

/**
 * @public

 */
export async function findPerson (
  client: Client,
  person: Data<Person>,
  channels: AttachedData<Channel>[]
): Promise<Person[]> {
  const result = await findContacts(client, contactPlugin.class.Person, person, channels)
  return result.contacts as Person[]
}
