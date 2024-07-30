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

import { type Builder } from '@hcengineering/model'
import view, { actionTemplates as viewTemplates, createAction, template } from '@hcengineering/model-view'
import notification, { notificationActionTemplates } from '@hcengineering/model-notification'
import activity from '@hcengineering/activity'
import workbench from '@hcengineering/model-workbench'

import chunter from './plugin'

const actionTemplates = template({
  removeChannel: {
    action: chunter.actionImpl.RemoveChannel,
    label: view.string.Archive,
    icon: view.icon.Delete,
    input: 'focus',
    keyBinding: ['Backspace'],
    category: chunter.category.Chunter,
    target: notification.class.DocNotifyContext,
    context: { mode: ['context', 'browser'], group: 'remove' }
  }
})

export function defineActions (builder: Builder): void {
  createAction(
    builder,
    {
      action: chunter.actionImpl.ReplyToThread,
      label: chunter.string.ReplyToThread,
      icon: chunter.icon.Thread,
      input: 'focus',
      category: chunter.category.Chunter,
      target: activity.class.ActivityMessage,
      visibilityTester: chunter.function.CanReplyToThread,
      inline: true,
      context: {
        mode: 'context',
        group: 'edit'
      }
    },
    chunter.action.ReplyToThreadAction
  )

  createAction(
    builder,
    {
      action: view.actionImpl.CopyTextToClipboard,
      actionProps: {
        textProvider: chunter.function.GetLink
      },
      label: chunter.string.CopyLink,
      icon: chunter.icon.Copy,
      input: 'none',
      category: chunter.category.Chunter,
      target: activity.class.ActivityMessage,
      visibilityTester: chunter.function.CanCopyMessageLink,
      context: {
        mode: ['context', 'browser'],
        application: chunter.app.Chunter,
        group: 'copy'
      }
    },
    chunter.action.CopyChatMessageLink
  )

  createAction(
    builder,
    {
      action: chunter.actionImpl.UnarchiveChannel,
      label: chunter.string.UnarchiveChannel,
      icon: view.icon.Archive,
      input: 'focus',
      category: chunter.category.Chunter,
      target: chunter.class.Channel,
      query: {
        archived: true
      },
      context: {
        mode: 'context',
        group: 'tools'
      }
    },
    chunter.action.UnarchiveChannel
  )

  createAction(
    builder,
    {
      action: chunter.actionImpl.ConvertDmToPrivateChannel,
      label: chunter.string.ConvertToPrivate,
      icon: chunter.icon.Lock,
      input: 'focus',
      category: chunter.category.Chunter,
      target: chunter.class.DirectMessage,
      context: {
        mode: 'context',
        group: 'edit'
      }
    },
    chunter.action.ConvertToPrivate
  )

  createAction(
    builder,
    {
      action: chunter.actionImpl.ArchiveChannel,
      label: chunter.string.ArchiveChannel,
      icon: view.icon.Archive,
      input: 'focus',
      category: chunter.category.Chunter,
      target: chunter.class.Channel,
      query: {
        archived: false
      },
      context: {
        mode: 'context',
        group: 'tools'
      }
    },
    chunter.action.ArchiveChannel
  )

  createAction(builder, {
    ...viewTemplates.open,
    target: chunter.class.Channel,
    context: {
      mode: ['browser', 'context'],
      group: 'create'
    },
    action: workbench.actionImpl.Navigate,
    actionProps: {
      mode: 'space'
    }
  })

  createAction(
    builder,
    {
      action: chunter.actionImpl.DeleteChatMessage,
      label: view.string.Delete,
      icon: view.icon.Delete,
      input: 'focus',
      keyBinding: ['Backspace'],
      category: chunter.category.Chunter,
      target: chunter.class.ChatMessage,
      visibilityTester: chunter.function.CanDeleteMessage,
      context: { mode: ['context', 'browser'], group: 'remove' }
    },
    chunter.action.DeleteChatMessage
  )

  createAction(
    builder,
    {
      ...actionTemplates.removeChannel,
      icon: view.icon.EyeCrossed,
      label: view.string.Hide,
      query: {
        attachedToClass: { $nin: [chunter.class.DirectMessage, chunter.class.Channel] }
      }
    },
    chunter.action.RemoveChannel
  )

  createAction(
    builder,
    {
      ...actionTemplates.removeChannel,
      label: chunter.string.CloseConversation,
      query: {
        attachedToClass: chunter.class.DirectMessage
      }
    },
    chunter.action.CloseConversation
  )

  createAction(
    builder,
    {
      ...actionTemplates.removeChannel,
      action: chunter.actionImpl.LeaveChannel,
      label: chunter.string.LeaveChannel,
      query: {
        attachedToClass: chunter.class.Channel
      }
    },
    chunter.action.LeaveChannel
  )

  createAction(builder, {
    ...notificationActionTemplates.pinContext,
    label: chunter.string.StarChannel,
    query: {
      attachedToClass: chunter.class.Channel
    },
    override: [notification.action.PinDocNotifyContext]
  })

  createAction(builder, {
    ...notificationActionTemplates.unpinContext,
    label: chunter.string.UnstarChannel,
    query: {
      attachedToClass: chunter.class.Channel
    }
  })

  createAction(builder, {
    ...notificationActionTemplates.pinContext,
    label: chunter.string.StarConversation,
    query: {
      attachedToClass: chunter.class.DirectMessage
    }
  })

  createAction(builder, {
    ...notificationActionTemplates.unpinContext,
    label: chunter.string.UnstarConversation,
    query: {
      attachedToClass: chunter.class.DirectMessage
    }
  })

  createAction(builder, {
    ...notificationActionTemplates.pinContext,
    query: {
      attachedToClass: { $nin: [chunter.class.DirectMessage, chunter.class.Channel] }
    }
  })

  createAction(builder, {
    ...notificationActionTemplates.unpinContext,
    query: {
      attachedToClass: { $nin: [chunter.class.DirectMessage, chunter.class.Channel] }
    }
  })
}
