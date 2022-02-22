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

import type { Person } from '@anticrm/contact'
import type { Class, Doc, Mixin, Ref, Space, Timestamp } from '@anticrm/core'
import type { Asset, Plugin, Resource } from '@anticrm/platform'
import { plugin } from '@anticrm/platform'
import type { KanbanTemplateSpace, SpaceWithStates, Task } from '@anticrm/task'

/**
 * @public
 */
export interface Vacancy extends SpaceWithStates {
  fullDescription?: string
  attachments?: number
  dueTo?: Timestamp
  location?: string
  company?: string
}

/**
 * @public
 */
export interface Candidates extends Space {}

/**
 * @public
 */
export interface Candidate extends Person {
  title?: string
  applications?: number
  onsite?: boolean
  remote?: boolean
  source?: string
  skills?: number
}

/**
 * @public
 */
export interface Applicant extends Task {
  attachments?: number
  comments?: number
}

/**
 * @public
 */
export const recruitId = 'recruit' as Plugin

/**
 * @public
 */
const recruit = plugin(recruitId, {
  class: {
    Applicant: '' as Ref<Class<Applicant>>,
    Candidates: '' as Ref<Class<Candidates>>,
    Vacancy: '' as Ref<Class<Vacancy>>
  },
  mixin: {
    Candidate: '' as Ref<Mixin<Candidate>>
  },
  function: {
    VacancyHTMLPresenter: '' as Resource<(doc: Doc) => string>,
    VacancyTextPresenter: '' as Resource<(doc: Doc) => string>,
    ApplicationHTMLPresenter: '' as Resource<(doc: Doc) => string>,
    ApplicationTextPresenter: '' as Resource<(doc: Doc) => string>
  },
  icon: {
    RecruitApplication: '' as Asset,
    Vacancy: '' as Asset,
    Location: '' as Asset,
    Calendar: '' as Asset,
    Create: '' as Asset,
    Application: '' as Asset
  },
  space: {
    VacancyTemplates: '' as Ref<KanbanTemplateSpace>
  }
})

export default recruit
