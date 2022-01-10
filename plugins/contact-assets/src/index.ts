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

import { addStringsLoader, loadMetadata } from '@anticrm/platform'
import contact, { contactId } from '@anticrm/contact'

const icons = require('../assets/icons.svg')
loadMetadata(contact.icon, {
  Phone: `${icons}#phone`,
  Email: `${icons}#email`,
  Discord: `${icons}#discord`,
  Facebook: `${icons}#facebook`,
  Instagram: `${icons}#instagram`,
  LinkedIn: `${icons}#linkedin`,
  Telegram: `${icons}#telegram`,
  Twitter: `${icons}#twitter`,
  VK: `${icons}#vk`,
  WhatsApp: `${icons}#whatsapp`,
  Youtube: `${icons}#youtube`,
  GitHub: `${icons}#github`,
  Edit: `${icons}#edit`,
  Person: `${icons}#person`,
  Company: `${icons}#company`
})
addStringsLoader(contactId, async (lang: string) => await import(`../lang/${lang}.json`))

