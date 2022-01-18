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

import { loadMetadata, addStringsLoader } from '@anticrm/platform'
import setting, { settingId } from '@anticrm/setting'

const icons = require('../assets/icons.svg')
loadMetadata(setting.icon, {
  EditProfile: `${icons}#edit`,
  Password: `${icons}#password`,
  Setting: `${icons}#settings`,
  Integrations: `${icons}#integration`,
  Support: `${icons}#support`,
  Privacy: `${icons}#privacy`,
  Terms: `${icons}#terms`
})

addStringsLoader(settingId, async (lang: string) => await import(`../lang/${lang}.json`))
