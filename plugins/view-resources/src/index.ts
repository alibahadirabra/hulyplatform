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

import { ObjQueryType } from '@anticrm/core'
import { Resources } from '@anticrm/platform'
import { getEventPopupPositionElement, PopupAlignment } from '@anticrm/ui'
import { actionImpl } from './actionImpl'
import ActionsPopup from './components/ActionsPopup.svelte'
import BooleanEditor from './components/BooleanEditor.svelte'
import BooleanPresenter from './components/BooleanPresenter.svelte'
import BooleanTruePresenter from './components/BooleanTruePresenter.svelte'
import ClassAttributeBar from './components/ClassAttributeBar.svelte'
import ClassPresenter from './components/ClassPresenter.svelte'
import ColorsPopup from './components/ColorsPopup.svelte'
import DateEditor from './components/DateEditor.svelte'
import DatePresenter from './components/DatePresenter.svelte'
import DocAttributeBar from './components/DocAttributeBar.svelte'
import EditBoxPopup from './components/EditBoxPopup.svelte'
import EditDoc from './components/EditDoc.svelte'
import EnumEditor from './components/EnumEditor.svelte'
import FilterBar from './components/filter/FilterBar.svelte'
import ObjectFilter from './components/filter/ObjectFilter.svelte'
import TimestampFilter from './components/filter/TimestampFilter.svelte'
import ValueFilter from './components/filter/ValueFilter.svelte'
import HTMLPresenter from './components/HTMLPresenter.svelte'
import IntlStringPresenter from './components/IntlStringPresenter.svelte'
import GithubPresenter from './components/linkPresenters/GithubPresenter.svelte'
import YoutubePresenter from './components/linkPresenters/YoutubePresenter.svelte'
import Menu from './components/Menu.svelte'
import NumberEditor from './components/NumberEditor.svelte'
import NumberPresenter from './components/NumberPresenter.svelte'
import ObjectPresenter from './components/ObjectPresenter.svelte'
import RolePresenter from './components/RolePresenter.svelte'
import SpacePresenter from './components/SpacePresenter.svelte'
import StringEditor from './components/StringEditor.svelte'
import StringPresenter from './components/StringPresenter.svelte'
import Table from './components/Table.svelte'
import TableBrowser from './components/TableBrowser.svelte'
import TimestampPresenter from './components/TimestampPresenter.svelte'
import UpDownNavigator from './components/UpDownNavigator.svelte'
import ViewletSettingButton from './components/ViewletSettingButton.svelte'

function PositionElementAlignment (e?: Event): PopupAlignment | undefined {
  return getEventPopupPositionElement(e)
}

export { getActions, invokeAction } from './actions'
export { default as ActionContext } from './components/ActionContext.svelte'
export { default as ActionHandler } from './components/ActionHandler.svelte'
export { default as FilterButton } from './components/filter/FilterButton.svelte'
export { default as LinkPresenter } from './components/LinkPresenter.svelte'
export { default as ContextMenu } from './components/Menu.svelte'
export { default as TableBrowser } from './components/TableBrowser.svelte'
export * from './context'
export * from './selection'
export { buildModel, getCollectionCounter, getObjectPresenter, LoadingProps } from './utils'
export {
  HTMLPresenter,
  Table,
  DateEditor,
  DocAttributeBar,
  EditDoc,
  ColorsPopup,
  Menu,
  SpacePresenter,
  UpDownNavigator,
  ViewletSettingButton,
  FilterBar,
  ClassAttributeBar
}

export async function objectInResult (res: any[]): Promise<ObjQueryType<any>> {
  return { $in: res }
}

export async function objectNinResult (res: any[]): Promise<ObjQueryType<any>> {
  return { $nin: res }
}

export async function valueInResult (res: any[]): Promise<ObjQueryType<any>> {
  return { $in: res.map((p) => p[1]).flat() }
}

export async function valueNinResult (res: any[]): Promise<ObjQueryType<any>> {
  return { $nin: res.map((p) => p[1]).flat() }
}

export async function beforeResult (res: any[]): Promise<ObjQueryType<any>> {
  return { $lt: res[0] }
}

export async function afterResult (res: any[]): Promise<ObjQueryType<any>> {
  return { $gt: res[0] }
}

export default async (): Promise<Resources> => ({
  actionImpl: actionImpl,
  component: {
    ClassPresenter,
    ObjectFilter,
    ValueFilter,
    TimestampFilter,
    TableBrowser,
    SpacePresenter,
    StringEditor,
    StringPresenter,
    NumberEditor,
    NumberPresenter,
    BooleanPresenter,
    BooleanEditor,
    TimestampPresenter,
    DateEditor,
    DatePresenter,
    RolePresenter,
    ObjectPresenter,
    EditDoc,
    HTMLPresenter,
    IntlStringPresenter,
    GithubPresenter,
    YoutubePresenter,
    ActionsPopup,
    StringEditorPopup: EditBoxPopup,
    BooleanTruePresenter,
    EnumEditor
  },
  popup: {
    PositionElementAlignment
  },
  function: {
    FilterObjectInResult: objectInResult,
    FilterObjectNinResult: objectNinResult,
    FilterValueInResult: valueInResult,
    FilterValueNinResult: valueNinResult,
    FilterBeforeResult: beforeResult,
    FilterAfterResult: afterResult
  }
})
