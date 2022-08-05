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

import type { IntlString } from '@anticrm/platform'
import { mergeIds } from '@anticrm/platform'
import setting, { settingId } from '@anticrm/setting'
import { AnyComponent } from '@anticrm/ui'

export default mergeIds(settingId, setting, {
  component: {
    EditEnum: '' as AnyComponent
  },
  string: {
    IntegrationDisabled: '' as IntlString,
    IntegrationWith: '' as IntlString,
    DeleteStatus: '' as IntlString,
    DeleteStatusConfirm: '' as IntlString,
    DeleteAttribute: '' as IntlString,
    DeleteAttributeConfirm: '' as IntlString,
    DeleteAttributeExistConfirm: '' as IntlString,
    DeleteMixin: '' as IntlString,
    DeleteMixinConfirm: '' as IntlString,
    DeleteMixinExistConfirm: '' as IntlString,
    Attribute: '' as IntlString,
    Attributes: '' as IntlString,
    Custom: '' as IntlString,
    WithTime: '' as IntlString,
    Type: '' as IntlString,
    CreatingAttribute: '' as IntlString,
    EditAttribute: '' as IntlString,
    CreateEnum: '' as IntlString,
    Enums: '' as IntlString,
    NewValue: '' as IntlString,
    Leave: '' as IntlString,
    LeaveDescr: '' as IntlString,
    Select: '' as IntlString,
    AddOwner: '' as IntlString,
    User: '' as IntlString,
    Maintainer: '' as IntlString,
    Owner: '' as IntlString,
    Role: '' as IntlString,
    FailedToSave: '' as IntlString,
    ImportEnum: '' as IntlString,
    ImportEnumCopy: '' as IntlString,
    CreateMixin: '' as IntlString,
    OldNames: '' as IntlString,
    NewClassName: '' as IntlString
  }
})
