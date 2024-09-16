//
// Copyright © 2020 Anticrm Platform Contributors.
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

import { type Class, DOMAIN_MODEL, type Ref, type Space, type AccountRole } from '@hcengineering/core'
import { type Builder, Mixin, Model, Prop, TypeRef, UX } from '@hcengineering/model'
import preference, { TPreference } from '@hcengineering/model-preference'
import { createAction } from '@hcengineering/model-view'
import { getEmbeddedLabel, type Asset, type IntlString, type Resource } from '@hcengineering/platform'
import view, { type KeyBinding } from '@hcengineering/view'
import type {
  Application,
  ApplicationNavModel,
  HiddenApplication,
  SpaceView,
  ViewConfiguration,
  Widget,
  WidgetPreference,
  WidgetTab,
  WidgetType
} from '@hcengineering/workbench'
import { type AnyComponent } from '@hcengineering/ui'
import core, { TClass, TDoc } from '@hcengineering/model-core'

import workbench from './plugin'

export { workbenchId } from '@hcengineering/workbench'
export type { Application }

@Model(workbench.class.Application, core.class.Doc, DOMAIN_MODEL)
@UX(workbench.string.Application)
export class TApplication extends TDoc implements Application {
  label!: IntlString
  icon!: Asset
  alias!: string
  position?: 'top' | 'mid'
  hidden!: boolean
  accessLevel?: AccountRole
}

@Model(workbench.class.ApplicationNavModel, core.class.Doc, DOMAIN_MODEL)
@UX(workbench.string.Application)
export class TApplicationNavModel extends TDoc implements ApplicationNavModel {
  extends!: Ref<Application>
}

@Model(workbench.class.HiddenApplication, preference.class.Preference)
export class THiddenApplication extends TPreference implements HiddenApplication {
  @Prop(TypeRef(workbench.class.Application), workbench.string.HiddenApplication)
  declare attachedTo: Ref<Application>
}

@Mixin(workbench.mixin.SpaceView, core.class.Class)
export class TSpaceView extends TClass implements SpaceView {
  view!: ViewConfiguration
}

@Model(workbench.class.Widget, core.class.Doc, DOMAIN_MODEL)
@UX(workbench.string.Widget)
export class TWidget extends TDoc implements Widget {
  label!: IntlString
  icon!: Asset
  type!: WidgetType

  component!: AnyComponent
  tabComponent?: AnyComponent
  headerLabel?: IntlString

  closeIfNoTabs?: boolean
  onTabClose?: Resource<(tab: WidgetTab) => Promise<void>>
}

@Model(workbench.class.WidgetPreference, preference.class.Preference)
@UX(workbench.string.WidgetPreference)
export class TWidgetPreference extends TPreference implements WidgetPreference {
  @Prop(TypeRef(workbench.class.Widget), workbench.string.WidgetPreference)
  declare attachedTo: Ref<Widget>

  enabled!: boolean
}

export function createModel (builder: Builder): void {
  builder.createModel(TApplication, TSpaceView, THiddenApplication, TApplicationNavModel, TWidget, TWidgetPreference)

  builder.mixin(workbench.class.Application, core.class.Class, view.mixin.ObjectPresenter, {
    presenter: workbench.component.ApplicationPresenter
  })

  builder.mixin(workbench.class.Application, core.class.Class, view.mixin.IgnoreActions, {
    actions: [view.action.Delete]
  })

  createAction(builder, {
    action: view.actionImpl.ShowPopup,
    actionProps: {
      component: workbench.component.ServerManager,
      element: 'content'
    },
    label: getEmbeddedLabel('Server statistics'),
    icon: view.icon.Configure,
    input: 'none',
    category: view.category.General,
    target: core.class.Doc,
    secured: true,
    context: {
      mode: ['workbench']
    }
  })
}

export default workbench

export function createNavigateAction (
  builder: Builder,
  key: KeyBinding,
  label: IntlString,
  application: Ref<Application>,
  props: {
    mode: 'app' | 'special' | 'space'
    application?: string
    special?: string
    space?: Ref<Space>
    spaceClass?: Ref<Class<Space>>
    spaceSpecial?: string
    query?: Record<string, string | null>
  }
): void {
  createAction(builder, {
    action: workbench.actionImpl.Navigate,
    actionProps: props,
    label,
    icon: view.icon.ArrowRight,
    keyBinding: [key],
    input: 'none',
    category: view.category.Navigation,
    target: core.class.Doc,
    context: {
      mode: ['workbench', 'browser', 'editor', 'panel', 'popup'],
      application
    }
  })
}
