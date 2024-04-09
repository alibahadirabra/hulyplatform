//
// Copyright © 2024 Hardcore Engineering Inc.
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

import type { Employee, Organization } from '@hcengineering/contact'
import { type Domain, IndexKind, type Markup, type Ref, type Status, type Timestamp, type Type } from '@hcengineering/core'
import {
  Collection,
  Hidden,
  Index,
  Mixin,
  Model,
  Prop,
  ReadOnly,
  TypeBoolean,
  TypeCollaborativeMarkup,
  TypeDate,
  TypeMarkup,
  TypeRef,
  TypeString,
  UX
} from '@hcengineering/model'
import attachment from '@hcengineering/model-attachment'
import calendar, { TEvent } from '@hcengineering/model-calendar'
import chunter from '@hcengineering/model-chunter'
import contact, { TOrganization, TPerson } from '@hcengineering/model-contact'
import core, { TAttachedDoc, TClass, TSpace } from '@hcengineering/model-core'
import tags from '@hcengineering/model-tags'
import task, { DOMAIN_TASK, TProject, TTask } from '@hcengineering/model-task'
import { getEmbeddedLabel, type Resource } from '@hcengineering/platform'
import type {
  Applicant,
  ApplicantMatch,
  Candidate,
  Candidates,
  Opinion,
  Review,
  ScriptTypedAttributeEditorComponentType,
  ScriptTypedAttributeEditorMixin,
  ScriptTypedAttributeFactoryFn,
  ScriptTypedAttributeFactoryMixin,
  ScriptTypedPropertyEditorComponentType,
  ScriptTypedPropertyEditorMixin,
  Vacancy,
  VacancyList
} from '@hcengineering/recruit'
import recruit from './plugin'

@Model(recruit.class.Vacancy, task.class.Project)
@UX(recruit.string.Vacancy, recruit.icon.Vacancy, 'VCN', 'name', undefined, recruit.string.Vacancies)
export class TVacancy extends TProject implements Vacancy {
  @Prop(TypeCollaborativeMarkup(), recruit.string.FullDescription)
  @Index(IndexKind.FullText)
    fullDescription?: string

  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments, { shortLabel: attachment.string.Files })
    attachments?: number

  @Prop(TypeDate(), recruit.string.Due, recruit.icon.Calendar)
    dueTo?: Timestamp

  @Prop(TypeString(), recruit.string.Location, recruit.icon.Location)
  @Index(IndexKind.FullText)
    location?: string

  @Prop(TypeRef(contact.class.Organization), recruit.string.Company, { icon: contact.icon.Company })
    company?: Ref<Organization>

  @Prop(Collection(chunter.class.ChatMessage), chunter.string.Comments)
    comments?: number

  @Prop(TypeString(), recruit.string.Vacancy)
  @Index(IndexKind.FullText)
  @Hidden()
    number!: number
}

@Model(recruit.class.Candidates, core.class.Space)
@UX(recruit.string.TalentPools, recruit.icon.RecruitApplication)
export class TCandidates extends TSpace implements Candidates {}

@Mixin(recruit.mixin.Candidate, contact.class.Person)
@UX(recruit.string.Talent, recruit.icon.RecruitApplication, 'TLNT', 'name', undefined, recruit.string.Talents)
export class TCandidate extends TPerson implements Candidate {
  @Prop(TypeString(), recruit.string.Title)
  @Index(IndexKind.FullText)
    title?: string

  @Prop(Collection(recruit.class.Applicant), recruit.string.Applications, {
    shortLabel: recruit.string.ApplicationsShort
  })
    applications?: number

  @Prop(TypeBoolean(), recruit.string.Onsite)
    onsite?: boolean

  @Prop(TypeBoolean(), recruit.string.Remote)
    remote?: boolean

  @Prop(TypeString(), recruit.string.Source)
  @Index(IndexKind.FullText)
    source?: string

  @Prop(Collection(tags.class.TagReference, recruit.string.SkillLabel), recruit.string.SkillsLabel, {
    icon: recruit.icon.Skills,
    schema: '3'
  })
    skills?: number

  @Prop(Collection(recruit.class.Review, recruit.string.Review), recruit.string.Reviews)
    reviews?: number

  @Prop(
    Collection(recruit.class.ApplicantMatch, getEmbeddedLabel('Vacancy match')),
    getEmbeddedLabel('Vacancy Matches')
  )
    vacancyMatch?: number
}

@Mixin(recruit.mixin.VacancyList, contact.class.Organization)
@UX(recruit.string.VacancyList, recruit.icon.RecruitApplication, 'CM', 'name')
export class TVacancyList extends TOrganization implements VacancyList {
  @Prop(Collection(recruit.class.Vacancy), recruit.string.Vacancies)
    vacancies!: number
}

@Model(recruit.class.Applicant, task.class.Task)
@UX(recruit.string.Application, recruit.icon.Application, 'APP', 'number', undefined, recruit.string.Applications)
export class TApplicant extends TTask implements Applicant {
  // We need to declare, to provide property with label
  @Prop(TypeRef(recruit.mixin.Candidate), recruit.string.Talent)
  @Index(IndexKind.Indexed)
  @ReadOnly()
  declare attachedTo: Ref<Candidate>

  // We need to declare, to provide property with label
  @Prop(TypeRef(recruit.class.Vacancy), recruit.string.Vacancy)
  @Index(IndexKind.Indexed)
  declare space: Ref<Vacancy>

  @Prop(TypeDate(), task.string.StartDate)
    startDate!: Timestamp | null

  @Prop(TypeRef(contact.mixin.Employee), recruit.string.AssignedRecruiter)
  @Index(IndexKind.Indexed)
  declare assignee: Ref<Employee> | null

  @Prop(TypeRef(core.class.Status), task.string.TaskState, { _id: recruit.attribute.State })
  @Index(IndexKind.Indexed)
  declare status: Ref<Status>
}

@Model(recruit.class.ApplicantMatch, core.class.AttachedDoc, DOMAIN_TASK)
@UX(recruit.string.Application, recruit.icon.Application, 'APP', 'number')
export class TApplicantMatch extends TAttachedDoc implements ApplicantMatch {
  // We need to declare, to provide property with label
  @Prop(TypeRef(recruit.mixin.Candidate), recruit.string.Talent)
  @Index(IndexKind.Indexed)
  declare attachedTo: Ref<Candidate>

  @Prop(TypeBoolean(), getEmbeddedLabel('Complete'))
  @ReadOnly()
    complete!: boolean

  @Prop(TypeString(), getEmbeddedLabel('Vacancy'))
  @ReadOnly()
    vacancy!: string

  @Prop(TypeString(), getEmbeddedLabel('Summary'))
  @ReadOnly()
    summary!: string

  @Prop(TypeMarkup(), getEmbeddedLabel('Response'))
  @ReadOnly()
    response!: string
}

@Model(recruit.class.Review, calendar.class.Event)
@UX(recruit.string.Review, recruit.icon.Review, 'RVE', 'number', undefined, recruit.string.Reviews)
export class TReview extends TEvent implements Review {
  // We need to declare, to provide property with label
  @Prop(TypeRef(recruit.mixin.Candidate), recruit.string.Talent)
  declare attachedTo: Ref<Candidate>

  @Prop(TypeString(), recruit.string.Review)
    number!: number

  @Prop(TypeString(), recruit.string.Verdict)
  @Index(IndexKind.FullText)
    verdict!: string

  @Prop(TypeRef(recruit.class.Applicant), recruit.string.Application, { icon: recruit.icon.Application })
    application?: Ref<Applicant>

  @Prop(TypeRef(contact.class.Organization), recruit.string.Company, { icon: contact.icon.Company })
    company?: Ref<Organization>

  @Prop(Collection(recruit.class.Opinion), recruit.string.Opinions)
    opinions?: number
}

@Model(recruit.class.Opinion, core.class.AttachedDoc, 'recruit' as Domain)
@UX(recruit.string.Opinion, recruit.icon.Opinion, 'OPE')
export class TOpinion extends TAttachedDoc implements Opinion {
  @Prop(TypeString(), task.string.TaskNumber)
    number!: number

  // We need to declare, to provide property with label
  @Prop(TypeRef(recruit.class.Review), recruit.string.Review)
  declare attachedTo: Ref<Review>

  @Prop(Collection(attachment.class.Attachment), attachment.string.Attachments, { shortLabel: attachment.string.Files })
    attachments?: number

  @Prop(Collection(chunter.class.ChatMessage), chunter.string.Comments)
    comments?: number

  @Prop(TypeMarkup(), recruit.string.Description)
    description!: Markup

  @Prop(TypeString(), recruit.string.OpinionValue)
    value!: string
}

@Mixin(recruit.mixin.ScriptTypedAttributeEditor, core.class.Class)
export class TScriptTypedAttributeEditorMixin<T extends Type<any>>
  extends TClass
  implements ScriptTypedAttributeEditorMixin<T> {
  editor!: Resource<ScriptTypedAttributeEditorComponentType<T>>
}

@Mixin(recruit.mixin.ScriptTypedAttributeFactory, core.class.Class)
export class TScriptTypedAttributeFactoryMixin<T extends Type<any>>
  extends TClass
  implements ScriptTypedAttributeFactoryMixin<T> {
  factory!: Resource<ScriptTypedAttributeFactoryFn<T>>
}

@Mixin(recruit.mixin.ScriptTypedPropertyEditor, core.class.Class)
export class TScriptTypedPropertyEditorMixin<T extends Type<any>>
  extends TClass
  implements ScriptTypedPropertyEditorMixin<T> {
  editor!: Resource<ScriptTypedPropertyEditorComponentType<T>>
}
