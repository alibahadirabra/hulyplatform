//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
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

import type { Plugin, Asset, Resource, IntlString } from '@anticrm/platform'
import { plugin } from '@anticrm/platform'
import type { Ref, Mixin, UXObject, Space, FindOptions, Class, Doc, Arr, State, Client, Obj } from '@anticrm/core'

import type { AnyComponent, AnySvelteComponent } from '@anticrm/ui'

/**
 * @public
 */
export interface AttributeEditor extends Class<Doc> {
  editor: AnyComponent
}

/**
 * @public
 */
export interface AttributePresenter extends Class<Doc> {
  presenter: AnyComponent
}

/**
 * @public
 */
export interface KanbanCard extends Class<Doc> {
  card: AnyComponent
}

/**
 * @public
 */
export interface ObjectEditor extends Class<Doc> {
  editor: AnyComponent
}

/**
 * @public
 */
export interface ViewletDescriptor extends Doc, UXObject {
  component: AnyComponent
}

/**
 * @public
 */
export interface Viewlet extends Doc {
  attachTo: Ref<Class<Space>>
  descriptor: Ref<ViewletDescriptor>
  open: AnyComponent
  options?: FindOptions<Doc>
  config: any
}

/**
 * @public
 */
export interface Action extends Doc, UXObject {
  action: Resource<(doc: Doc) => Promise<void>>
}

/**
 * @public
 */
export interface ActionTarget extends Doc {
  target: Ref<Class<Doc>>
  action: Ref<Action>
}

/**
 * @public
 */
export interface Kanban extends Doc {
  attachedTo: Ref<Space>
  states: Arr<Ref<State>>
  order: Arr<Ref<Doc>>
}

/**
 * @public
 */
export interface Sequence extends Doc {
  attachedTo: Ref<Class<Doc>>
  sequence: number
}

/**
 * @public
 */
export const viewId = 'view' as Plugin

/**
 * @public
 */
export interface AttributeModel {
  key: string
  label: IntlString
  presenter: AnySvelteComponent
}

/**
 * @public
 */
export interface BuildModelOptions {
  client: Client
  _class: Ref<Class<Obj>>
  keys: string[]
  options?: FindOptions<Doc>
  ignoreMissing?: boolean
}

export default plugin(viewId, {
  mixin: {
    AttributeEditor: '' as Ref<Mixin<AttributeEditor>>,
    AttributePresenter: '' as Ref<Mixin<AttributePresenter>>,
    KanbanCard: '' as Ref<Mixin<KanbanCard>>,
    ObjectEditor: '' as Ref<Mixin<ObjectEditor>>
  },
  class: {
    ViewletDescriptor: '' as Ref<Class<ViewletDescriptor>>,
    Viewlet: '' as Ref<Class<Viewlet>>,
    Action: '' as Ref<Class<Action>>,
    ActionTarget: '' as Ref<Class<ActionTarget>>,
    Kanban: '' as Ref<Class<Kanban>>,
    Sequence: '' as Ref<Class<Sequence>>
  },
  viewlet: {
    Table: '' as Ref<ViewletDescriptor>,
    Kanban: '' as Ref<ViewletDescriptor>
  },
  space: {
    Sequence: '' as Ref<Space>
  },
  icon: {
    Table: '' as Asset,
    Kanban: '' as Asset,
    Delete: '' as Asset
  }
})
