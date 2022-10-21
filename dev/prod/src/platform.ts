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

import { addLocation } from '@hcengineering/platform'

import login, { loginId } from '@hcengineering/login'
import workbench, { workbenchId } from '@hcengineering/workbench'
import uiPlugin from '@hcengineering/ui'
import { viewId } from '@hcengineering/view'
import { taskId } from '@hcengineering/task'
import { contactId } from '@hcengineering/contact'
import { chunterId } from '@hcengineering/chunter'
import { recruitId } from '@hcengineering/recruit'
import { activityId } from '@hcengineering/activity'
import { automationId } from '@hcengineering/automation'
import { settingId } from '@hcengineering/setting'
import { telegramId } from '@hcengineering/telegram'
import { attachmentId } from '@hcengineering/attachment'
import { leadId } from '@hcengineering/lead'
import { clientId } from '@hcengineering/client'
import { gmailId } from '@hcengineering/gmail'
import { imageCropperId } from '@hcengineering/image-cropper'
import { inventoryId } from '@hcengineering/inventory'
import { templatesId } from '@hcengineering/templates'
import { notificationId } from '@hcengineering/notification'
import { preferenceId } from '@hcengineering/preference'
import { tagsId } from '@hcengineering/tags'
import { calendarId } from '@hcengineering/calendar'
import { trackerId } from '@hcengineering/tracker'
import { boardId } from '@hcengineering/board'
import { hrId } from '@hcengineering/hr'
import rekoni from '@hcengineering/rekoni'
import { documentId } from '@hcengineering/document'

import '@hcengineering/login-assets'
import '@hcengineering/task-assets'
import '@hcengineering/view-assets'
import '@hcengineering/chunter-assets'
import '@hcengineering/attachment-assets'
import '@hcengineering/contact-assets'
import '@hcengineering/recruit-assets'
import '@hcengineering/activity-assets'
import '@hcengineering/automation-assets'
import '@hcengineering/setting-assets'
import '@hcengineering/telegram-assets'
import '@hcengineering/lead-assets'
import '@hcengineering/gmail-assets'
import '@hcengineering/workbench-assets'
import '@hcengineering/inventory-assets'
import '@hcengineering/templates-assets'
import '@hcengineering/notification-assets'
import '@hcengineering/tags-assets'
import '@hcengineering/calendar-assets'
import '@hcengineering/tracker-assets'
import '@hcengineering/board-assets'
import '@hcengineering/preference-assets'
import '@hcengineering/hr-assets'
import '@hcengineering/document-assets'

import presentation, { presentationId } from '@hcengineering/presentation'
import { coreId } from '@hcengineering/core'
import { textEditorId } from '@hcengineering/text-editor'

import { setMetadata } from '@hcengineering/platform'

export async function configurePlatform() {
  const config = await (await fetch('/config.json')).json()
  console.log('loading configuration', config)
  setMetadata(login.metadata.AccountsUrl, config.ACCOUNTS_URL)
  setMetadata(login.metadata.UploadUrl, config.UPLOAD_URL)

  if (config.MODEL_VERSION != null) {
    console.log('Minimal Model version requirement', config.MODEL_VERSION)
    setMetadata(presentation.metadata.RequiredVersion, config.MODEL_VERSION)
  }
  setMetadata(login.metadata.TelegramUrl, process.env.TELEGRAM_URL ?? 'http://localhost:8086')
  setMetadata(login.metadata.GmailUrl, process.env.GMAIL_URL ?? 'http://localhost:8087')
  setMetadata(login.metadata.OverrideEndpoint, process.env.LOGIN_ENDPOINT)
  setMetadata(login.metadata.FrontUrl, process.env.FRONT_URL)

  setMetadata(rekoni.metadata.RekoniUrl, process.env.REKONI_URL)

  setMetadata(uiPlugin.metadata.DefaultApplication, workbench.component.WorkbenchApp)

  setMetadata(
    uiPlugin.metadata.Routes,
    new Map([
      [workbenchId, workbench.component.WorkbenchApp],
      [loginId, login.component.LoginApp]
    ])
  )

  addLocation(coreId, async () => ({ default: async () => ({}) }))
  addLocation(presentationId, async () => ({ default: async () => ({}) }))
  addLocation(textEditorId, async () => ({ default: async () => ({}) }))

  addLocation(clientId, () => import(/* webpackChunkName: "client" */ '@hcengineering/client-resources'))
  addLocation(loginId, () => import(/* webpackChunkName: "login" */ '@hcengineering/login-resources'))
  addLocation(workbenchId, () => import(/* webpackChunkName: "workbench" */ '@hcengineering/workbench-resources'))
  addLocation(viewId, () => import(/* webpackChunkName: "view" */ '@hcengineering/view-resources'))
  addLocation(taskId, () => import(/* webpackChunkName: "task" */ '@hcengineering/task-resources'))
  addLocation(contactId, () => import(/* webpackChunkName: "contact" */ '@hcengineering/contact-resources'))
  addLocation(chunterId, () => import(/* webpackChunkName: "chunter" */ '@hcengineering/chunter-resources'))
  addLocation(recruitId, () => import(/* webpackChunkName: "recruit" */ '@hcengineering/recruit-resources'))
  addLocation(activityId, () => import(/*webpackChunkName: "activity" */ '@hcengineering/activity-resources'))
  addLocation(settingId, () => import(/* webpackChunkName: "setting" */ '@hcengineering/setting-resources'))
  addLocation(leadId, () => import(/* webpackChunkName: "lead" */ '@hcengineering/lead-resources'))
  addLocation(telegramId, () => import(/* webpackChunkName: "telegram" */ '@hcengineering/telegram-resources'))
  addLocation(attachmentId, () => import(/* webpackChunkName: "attachment" */ '@hcengineering/attachment-resources'))
  addLocation(gmailId, () => import(/* webpackChunkName: "gmail" */ '@hcengineering/gmail-resources'))
  addLocation(imageCropperId, () => import(/* webpackChunkName: "image-cropper" */ '@hcengineering/image-cropper-resources'))
  addLocation(inventoryId, () => import(/* webpackChunkName: "inventory" */ '@hcengineering/inventory-resources'))
  addLocation(templatesId, () => import(/* webpackChunkName: "templates" */ '@hcengineering/templates-resources'))
  addLocation(notificationId, () => import(/* webpackChunkName: "notification" */ '@hcengineering/notification-resources'))
  addLocation(tagsId, () => import(/* webpackChunkName: "tags" */ '@hcengineering/tags-resources'))
  addLocation(calendarId, () => import(/* webpackChunkName: "calendar" */ '@hcengineering/calendar-resources'))

  addLocation(trackerId, () => import(/* webpackChunkName: "tracker" */ '@hcengineering/tracker-resources'))
  addLocation(boardId, () => import(/* webpackChunkName: "board" */ '@hcengineering/board-resources'))
  addLocation(automationId, () => import(/* webpackChunkName: "automation" */ '@hcengineering/automation-resources'))
  addLocation(hrId, () => import(/* webpackChunkName: "hr" */ '@hcengineering/hr-resources'))
  addLocation(documentId, () => import(/* webpackChunkName: "hr" */ '@hcengineering/document-resources'))

  setMetadata(workbench.metadata.PlatformTitle, 'Platform')
}
