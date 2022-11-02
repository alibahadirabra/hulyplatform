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

import { Domain, IndexKind } from '@hcengineering/core'
import { Builder, Index, Model, Prop, TypeString } from '@hcengineering/model'
import core, { TDoc } from '@hcengineering/model-core'
import textEditor from '@hcengineering/model-text-editor'
import setting from '@hcengineering/setting'
import type { MessageTemplate } from '@hcengineering/templates'
import templates from './plugin'

export const DOMAIN_TEMPLATES = 'templates' as Domain

@Model(templates.class.MessageTemplate, core.class.Doc, DOMAIN_TEMPLATES)
export class TMessageTemplate extends TDoc implements MessageTemplate {
  @Prop(TypeString(), templates.string.Title)
  @Index(IndexKind.FullText)
    title!: string

  @Prop(TypeString(), templates.string.Message)
  @Index(IndexKind.FullText)
    message!: string
}

export function createModel (builder: Builder): void {
  builder.createModel(TMessageTemplate)

  builder.createDoc(
    setting.class.WorkspaceSettingCategory,
    core.space.Model,
    {
      name: 'message-templates',
      label: templates.string.Templates,
      icon: templates.icon.Templates,
      component: templates.component.Templates,
      group: 'settings-editor',
      secured: false,
      order: 3500
    },
    templates.ids.Templates
  )

  builder.createDoc(
    textEditor.class.RefInputActionItem,
    core.space.Model,
    {
      label: templates.string.Templates,
      icon: templates.icon.Template,
      action: templates.action.ShowTemplates,
      order: 1500
    },
    templates.ids.TemplatePopupAction
  )
}

export { templatesOperation } from './migration'
