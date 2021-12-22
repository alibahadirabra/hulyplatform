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

import core, { TxOperations } from '@anticrm/core'
import type { Client, Ref } from '@anticrm/core'
import task, { createKanban } from '@anticrm/task'
import type { KanbanTemplate } from '@anticrm/task'
import { createKanbanTemplate } from '@anticrm/model-task'

import lead from './plugin'

export async function createDeps (client: Client): Promise<void> {
  const tx = new TxOperations(client, core.account.System)

  await tx.createDoc(
    task.class.Sequence,
    task.space.Sequence,
    {
      attachedTo: lead.class.Lead,
      sequence: 0
    }
  )
  const defaultTmpl = await createDefaultKanbanTemplate(tx)
  await createKanban(tx, lead.space.DefaultFunnel, defaultTmpl)
}

const defaultKanban = {
  states: [
    { color: '#7C6FCD', title: 'Incoming' },
    { color: '#6F7BC5', title: 'Negotation' },
    { color: '#77C07B', title: 'Offer preparing' },
    { color: '#A5D179', title: 'Make a decision' },
    { color: '#F28469', title: 'Contract conclusion' },
    { color: '#7C6FCD', title: 'Done' }
  ],
  doneStates: [
    { isWon: true, title: 'Won' },
    { isWon: false, title: 'Lost' }
  ]
}

const createDefaultKanbanTemplate = async (client: TxOperations): Promise<Ref<KanbanTemplate>> =>
  await createKanbanTemplate(client, {
    kanbanId: lead.template.DefaultFunnel,
    space: lead.space.FunnelTemplates,
    title: 'Default funnel',
    states: defaultKanban.states,
    doneStates: defaultKanban.doneStates
  })
