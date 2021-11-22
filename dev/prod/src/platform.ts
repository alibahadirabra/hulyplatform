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

import { addLocation } from '@anticrm/platform'

import login, { loginId } from '@anticrm/login'
import { clientId } from '@anticrm/client'
import { workbenchId } from '@anticrm/workbench'
import { viewId } from '@anticrm/view'
import { taskId } from '@anticrm/task'
import { contactId } from '@anticrm/contact'
import { chunterId } from '@anticrm/chunter'
import { recruitId } from '@anticrm/recruit'
import { activityId } from '@anticrm/activity'
import { settingId } from '@anticrm/setting'

import { serverChunterId } from '@anticrm/server-chunter'
import { serverRecruitId } from '@anticrm/server-recruit'
import { serverViewId } from '@anticrm/server-view'

import '@anticrm/login-assets'
import '@anticrm/task-assets'
import '@anticrm/view-assets'
import '@anticrm/chunter-assets'
import '@anticrm/contact-assets'
import '@anticrm/recruit-assets'
import '@anticrm/activity-assets'
import '@anticrm/setting-assets'

import { setMetadata } from '@anticrm/platform'
export function configurePlatform() {  
  fetch('/config.json').then(config => {
    config.json().then(value => {
      console.log('loading configuration', value)
      setMetadata(login.metadata.AccountsUrl, value.ACCOUNTS_URL)
      setMetadata(login.metadata.UploadUrl,  value.UPLOAD_URL)  
    })    
  })    
  setMetadata(login.metadata.TelegramUrl, process.env.TELEGRAM_URL)
  setMetadata(login.metadata.OverrideEndpoint, process.env.LOGIN_ENDPOINT)

  if (process.env.CLIENT_TYPE === 'dev') {
    setMetadata(login.metadata.OverrideLoginToken, process.env.LOGIN_TOKEN_DEV)
    setMetadata(login.metadata.OverrideEndpoint, process.env.LOGIN_ENDPOINT_DEV)
    console.log('Use DEV server')
    addLocation(clientId, () => import(/* webpackChunkName: "client-dev" */ '@anticrm/dev-client-resources'))
    addLocation(serverChunterId, () => import(/* webpackChunkName: "server-chunter" */ '@anticrm/dev-server-chunter-resources'))
    addLocation(serverRecruitId, () => import(/* webpackChunkName: "server-recruit" */ '@anticrm/server-recruit-resources'))
    addLocation(serverViewId, () => import(/* webpackChunkName: "server-view" */ '@anticrm/server-view-resources'))
  } else {
    if (process.env.CLIENT_TYPE === 'dev-server') {
      console.log('Use Endpoint override:', process.env.LOGIN_ENDPOINT)
      setMetadata(login.metadata.OverrideEndpoint, process.env.LOGIN_ENDPOINT)
    }
    console.log('Use server')
    addLocation(clientId, () => import(/* webpackChunkName: "client" */ '@anticrm/client-resources'))
  }
  
  addLocation(loginId, () => import(/* webpackChunkName: "login" */ '@anticrm/login-resources'))
  addLocation(workbenchId, () => import(/* webpackChunkName: "workbench" */ '@anticrm/workbench-resources'))
  addLocation(viewId, () => import(/* webpackChunkName: "view" */ '@anticrm/view-resources'))
  addLocation(taskId, () => import(/* webpackChunkName: "task" */ '@anticrm/task-resources'))
  addLocation(contactId, () => import(/* webpackChunkName: "contact" */ '@anticrm/contact-resources'))
  addLocation(chunterId, () => import(/* webpackChunkName: "chunter" */ '@anticrm/chunter-resources'))
  addLocation(recruitId, () => import(/* webpackChunkName: "recruit" */ '@anticrm/recruit-resources'))
  addLocation(activityId, () => import(/*webpackChunkName: "activity" */ '@anticrm/activity-resources'))
  addLocation(settingId, () => import(/* webpackChunkName: "setting" */ '@anticrm/setting-resources'))
}
