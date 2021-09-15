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

import type { IntlString } from '@anticrm/platform'
import { Builder, Model, UX, Prop, TypeString, Bag as TypeBag } from '@anticrm/model'
import type { Ref, FindOptions, Doc, Domain, State, Bag } from '@anticrm/core'
import core, { TSpace, TDoc } from '@anticrm/model-core'
import type { Vacancy, Candidates, Candidate, Applicant } from '@anticrm/recruit'
import type { Attachment } from '@anticrm/chunter'

import workbench from '@anticrm/model-workbench'

import view from '@anticrm/model-view'
import contact, { TPerson } from '@anticrm/model-contact'
import recruit from './plugin'

export const DOMAIN_RECRUIT = 'recruit' as Domain

@Model(recruit.class.Vacancy, core.class.Space)
@UX(recruit.string.Vacancy, recruit.icon.Vacancy)
export class TVacancy extends TSpace implements Vacancy {}

@Model(recruit.class.Candidates, core.class.Space)
@UX(recruit.string.CandidatePools, recruit.icon.RecruitApplication)
export class TCandidates extends TSpace implements Candidates {}

@Model(recruit.class.Candidate, contact.class.Person)
@UX('Candidate' as IntlString)
export class TCandidate extends TPerson implements Candidate {
  @Prop(TypeString(), 'Title' as IntlString)
  title?: string

  @Prop(TypeBag(), 'Attachments' as IntlString)
  attachments!: Bag<Attachment>
}

@Model(recruit.class.Applicant, core.class.Doc, DOMAIN_RECRUIT)
export class TApplicant extends TDoc implements Applicant {
  @Prop(TypeString(), 'Candidate' as IntlString)
  candidate!: Ref<Candidate>

  @Prop(TypeString(), 'State' as IntlString)
  state!: Ref<State>
}

export function createModel (builder: Builder): void {
  builder.createModel(TVacancy, TCandidates, TCandidate, TApplicant)

  builder.mixin(recruit.class.Vacancy, core.class.Class, workbench.mixin.SpaceView, {
    view: {
      class: recruit.class.Applicant,
      createItemDialog: recruit.component.CreateApplication
    }
  })

  builder.mixin(recruit.class.Candidates, core.class.Class, workbench.mixin.SpaceView, {
    view: {
      class: recruit.class.Candidate,
      createItemDialog: recruit.component.CreateCandidate
    }
  })

  builder.createDoc(workbench.class.Application, core.space.Model, {
    label: recruit.string.RecruitApplication,
    icon: recruit.icon.RecruitApplication,
    navigatorModel: {
      spaces: [
        {
          label: recruit.string.Vacancies,
          spaceClass: recruit.class.Vacancy,
          addSpaceLabel: recruit.string.CreateVacancy,
          createComponent: recruit.component.CreateVacancy
        },
        {
          label: recruit.string.CandidatePools,
          spaceClass: recruit.class.Candidates,
          addSpaceLabel: recruit.string.CreateCandidates,
          createComponent: recruit.component.CreateCandidates
        }
      ]
    }
  })
  builder.createDoc(recruit.class.Candidates, core.space.Model, {
    name: 'public',
    description: 'Public Candidates',
    private: false,
    members: []
  }, recruit.space.CandidatesPublic)

  builder.createDoc(view.class.Viewlet, core.space.Model, {
    attachTo: recruit.class.Candidate,
    descriptor: view.viewlet.Table,
    open: recruit.component.EditCandidate,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    options: {
      // lookup: {
      //   resume: chunter.class.Attachment
      // }
    } as FindOptions<Doc>, // TODO: fix
    config: ['', '#' + recruit.component.CreateApplicationPresenter + '/Action', 'city', 'channels']
  })

  builder.createDoc(view.class.Viewlet, core.space.Model, {
    attachTo: recruit.class.Applicant,
    descriptor: view.viewlet.Table,
    open: recruit.component.EditCandidate,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    options: {
      lookup: {
        candidate: recruit.class.Candidate,
        state: core.class.State
      }
    } as FindOptions<Doc>, // TODO: fix
    config: ['$lookup.candidate', '#' + recruit.component.ApplicationPresenter + '/Application', '$lookup.state', '$lookup.candidate.city', '$lookup.candidate.channels']
  })

  builder.createDoc(view.class.Viewlet, core.space.Model, {
    attachTo: recruit.class.Applicant,
    descriptor: view.viewlet.Kanban,
    open: recruit.component.EditCandidate,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    options: {
      lookup: {
        candidate: recruit.class.Candidate,
        state: core.class.State
      }
    } as FindOptions<Doc>, // TODO: fix
    config: ['$lookup.candidate', '$lookup.state', '$lookup.candidate.city', '$lookup.candidate.channels']
  })

  builder.mixin(recruit.class.Applicant, core.class.Class, view.mixin.KanbanCard, {
    card: recruit.component.KanbanCard
  })

  builder.mixin(recruit.class.Candidate, core.class.Class, view.mixin.ObjectEditor, {
    editor: recruit.component.EditCandidate
  })
}

export { default } from './plugin'
