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

import { Class, Doc, Ref, Space } from '@hcengineering/core'
import { plugin, IntlString, type Asset, type Plugin, type Resource } from '@hcengineering/platform'
import { Viewlet } from '@hcengineering/view'
import { type AnyComponent, type ResolvedLocation } from '@hcengineering/ui'
import { Poll, Survey } from './types'

export * from './types'

export const surveyId = 'survey' as Plugin

const survey = plugin(surveyId, {
  class: {
    Poll: '' as Ref<Class<Poll>>,
    Survey: '' as Ref<Class<Survey>>
  },
  icon: {
    Application: '' as Asset,
    Poll: '' as Asset,
    Question: '' as Asset,
    QuestionKindString: '' as Asset,
    QuestionKindOption: '' as Asset,
    QuestionKindOptions: '' as Asset,
    QuestionIsMandatory: '' as Asset,
    QuestionHasCustomOption: '' as Asset,
    Survey: '' as Asset
  },
  space: {
    Survey: '' as Ref<Space>
  },
  app: {
    Survey: '' as Ref<Doc>
  },
  string: {
    Answer: '' as IntlString,
    AnswerPlaceholder: '' as IntlString,
    AnswerCustomOption: '' as IntlString,
    Application: '' as IntlString,
    Close: '' as IntlString,
    Control: '' as IntlString,
    CreatePoll: '' as IntlString,
    CreateSurvey: '' as IntlString,
    DeleteOption: '' as IntlString,
    DeleteQuestion: '' as IntlString,
    DeleteQuestionConfirm: '' as IntlString,
    Name: '' as IntlString,
    NoAnswer: '' as IntlString,
    NoName: '' as IntlString,
    NoPollsForDocument: '' as IntlString,
    Settings: '' as IntlString,
    Poll: '' as IntlString,
    Polls: '' as IntlString,
    Prompt: '' as IntlString,
    PromptPlaceholder: '' as IntlString,
    Question: '' as IntlString,
    Questions: '' as IntlString,
    QuestionKind: '' as IntlString,
    QuestionKindString: '' as IntlString,
    QuestionKindOption: '' as IntlString,
    QuestionKindOptions: '' as IntlString,
    QuestionIsMandatory: '' as IntlString,
    QuestionHasCustomOption: '' as IntlString,
    QuestionOptions: '' as IntlString,
    QuestionOptionPlaceholder: '' as IntlString,
    QuestionPlaceholder: '' as IntlString,
    QuestionEmptyPlaceholder: '' as IntlString,
    Survey: '' as IntlString,
    Surveys: '' as IntlString,
    SurveyPreview: '' as IntlString,
    SurveySubmit: '' as IntlString
  },
  component: {
    CreateSurvey: '' as AnyComponent,
    EditSurveyPanel: '' as AnyComponent,
    PollCollection: '' as AnyComponent,
    PollPresenter: '' as AnyComponent,
    SurveyPresenter: '' as AnyComponent
  },
  viewlet: {
    TableSurvey: '' as Ref<Viewlet>,
    TablePoll: '' as Ref<Viewlet>
  },
  resolver: {
    Location: '' as Resource<(loc: Location) => Promise<ResolvedLocation | undefined>>
  }
})

export default survey
