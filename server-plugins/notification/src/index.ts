//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021, 2022 Hardcore Engineering Inc.
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

import contact, { Employee, EmployeeAccount } from '@hcengineering/contact'
import core, { Account, Class, Doc, Mixin, Ref, TxCreateDoc, TxFactory, TxUpdateDoc } from '@hcengineering/core'
import notification, { LastView } from '@hcengineering/notification'
import { Plugin, plugin, Resource } from '@hcengineering/platform'
import type { TriggerControl, TriggerFunc } from '@hcengineering/server-core'

/**
 * @public
 */
export const serverNotificationId = 'server-notification' as Plugin

/**
 * @public
 */
export async function getUpdateLastViewTx (
  findAll: TriggerControl['findAll'],
  attachedTo: Ref<Doc>,
  attachedToClass: Ref<Class<Doc>>,
  lastView: number,
  user: Ref<Account>
): Promise<TxUpdateDoc<LastView> | TxCreateDoc<LastView> | undefined> {
  const current = (
    await findAll(
      notification.class.LastView,
      {
        attachedTo,
        attachedToClass,
        user
      },
      { limit: 1 }
    )
  )[0]
  const factory = new TxFactory(user)
  if (current !== undefined) {
    if (current.lastView === -1) {
      return
    }
    const u = factory.createTxUpdateDoc(current._class, current.space, current._id, {
      lastView
    })
    u.space = core.space.DerivedTx
    return u
  } else {
    const u = factory.createTxCreateDoc(notification.class.LastView, notification.space.Notifications, {
      user,
      lastView,
      attachedTo,
      attachedToClass,
      collection: 'lastViews'
    })
    u.space = core.space.DerivedTx
    return u
  }
}

/**
 * @public
 */
export async function getEmployeeAccount (
  employee: Ref<Employee>,
  control: TriggerControl
): Promise<EmployeeAccount | undefined> {
  const account = (
    await control.modelDb.findAll(
      contact.class.EmployeeAccount,
      {
        employee
      },
      { limit: 1 }
    )
  )[0]
  return account
}

/**
 * @public
 */
export async function getEmployeeAccountById (
  _id: Ref<Account>,
  control: TriggerControl
): Promise<EmployeeAccount | undefined> {
  const account = (
    await control.modelDb.findAll(
      contact.class.EmployeeAccount,
      {
        _id: _id as Ref<EmployeeAccount>
      },
      { limit: 1 }
    )
  )[0]
  return account
}

/**
 * @public
 */
export async function getEmployee (employee: Ref<Employee>, control: TriggerControl): Promise<Employee | undefined> {
  const account = (
    await control.findAll(
      contact.class.Employee,
      {
        _id: employee
      },
      { limit: 1 }
    )
  )[0]
  return account
}

/**
 * @public
 */
export async function createLastViewTx (
  findAll: TriggerControl['findAll'],
  attachedTo: Ref<Doc>,
  attachedToClass: Ref<Class<Doc>>,
  user: Ref<Account>
): Promise<TxCreateDoc<LastView> | undefined> {
  const current = (
    await findAll(
      notification.class.LastView,
      {
        attachedTo,
        attachedToClass,
        user
      },
      { limit: 1 }
    )
  )[0]
  if (current === undefined) {
    const factory = new TxFactory(user)
    const u = factory.createTxCreateDoc(notification.class.LastView, notification.space.Notifications, {
      user,
      lastView: 1,
      attachedTo,
      attachedToClass,
      collection: 'lastViews'
    })
    u.space = core.space.DerivedTx
    return u
  }
}

/**
 * @public
 */
export type Presenter = (doc: Doc, control: TriggerControl) => Promise<string>

/**
 * @public
 */
export interface HTMLPresenter extends Class<Doc> {
  presenter: Resource<Presenter>
}

/**
 * @public
 */
export interface TextPresenter extends Class<Doc> {
  presenter: Resource<Presenter>
}

/**
 * @public
 */
export default plugin(serverNotificationId, {
  mixin: {
    HTMLPresenter: '' as Ref<Mixin<HTMLPresenter>>,
    TextPresenter: '' as Ref<Mixin<TextPresenter>>
  },
  trigger: {
    OnBacklinkCreate: '' as Resource<TriggerFunc>,
    UpdateLastView: '' as Resource<TriggerFunc>
  }
})
