//
// Copyright © 2022 Hardcore Engineering Inc.
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

import core, {
  AttachedDoc,
  Doc,
  Tx,
  TxCollectionCUD,
  TxCreateDoc,
  TxCUD,
  TxProcessor,
  TxUpdateDoc
} from '@anticrm/core'
import lead, { leadId, Lead } from '@anticrm/lead'
import login from '@anticrm/login'
import { getMetadata } from '@anticrm/platform'
import { TriggerControl } from '@anticrm/server-core'
import view from '@anticrm/view'
import { workbenchId } from '@anticrm/workbench'
import { addAssigneeNotification } from '@anticrm/server-task-resources'

/**
 * @public
 */
export function leadHTMLPresenter (doc: Doc): string {
  const lead = doc as Lead
  const front = getMetadata(login.metadata.FrontUrl) ?? ''
  return `<a href="${front}/${workbenchId}/${leadId}/${lead.space}/#${view.component.EditDoc}|${lead._id}|${lead._class}">${lead.title}</a>`
}

/**
 * @public
 */
export function leadTextPresenter (doc: Doc): string {
  const lead = doc as Lead
  return `LEAD-${lead.number}`
}

/**
 * @public
 */
export async function OnLeadUpdate (tx: Tx, control: TriggerControl): Promise<Tx[]> {
  const actualTx = TxProcessor.extractTx(tx)

  const res: Tx[] = []

  const cud = actualTx as TxCUD<Doc>

  if (actualTx._class === core.class.TxCreateDoc) {
    await handleLeadCreate(control, cud, res, tx)
  }

  if (actualTx._class === core.class.TxUpdateDoc) {
    await handleLeadUpdate(control, cud, res, tx)
  }
  return res
}

async function handleLeadCreate (control: TriggerControl, cud: TxCUD<Doc>, res: Tx[], tx: Tx): Promise<void> {
  if (control.hierarchy.isDerived(cud.objectClass, lead.class.Lead)) {
    const createTx = cud as TxCreateDoc<Lead>
    const leadValue = TxProcessor.createDoc2Doc(createTx)
    if (leadValue.assignee != null) {
      await addAssigneeNotification(
        control,
        res,
        leadValue,
        leadTextPresenter(leadValue),
        leadValue.assignee,
        tx as TxCollectionCUD<Lead, AttachedDoc>
      )
    }
  }
}

async function handleLeadUpdate (control: TriggerControl, cud: TxCUD<Doc>, res: Tx[], tx: Tx): Promise<void> {
  if (control.hierarchy.isDerived(cud.objectClass, lead.class.Lead)) {
    const updateTx = cud as TxUpdateDoc<Lead>
    if (updateTx.operations.assignee != null) {
      const leadValue = (await control.findAll(lead.class.Lead, { _id: updateTx.objectId }, { limit: 1 })).shift()

      if (leadValue?.assignee != null) {
        await addAssigneeNotification(
          control,
          res,
          leadValue,
          leadTextPresenter(leadValue),
          leadValue.assignee,
          tx as TxCollectionCUD<Lead, AttachedDoc>
        )
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default async () => ({
  function: {
    LeadHTMLPresenter: leadHTMLPresenter,
    LeadTextPresenter: leadTextPresenter
  },
  trigger: {
    OnLeadUpdate
  }
})
