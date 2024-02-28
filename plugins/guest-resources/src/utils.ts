import client from '@hcengineering/client'
import { type Doc } from '@hcengineering/core'
import login from '@hcengineering/login'
import { getResource, setMetadata } from '@hcengineering/platform'
import presentation from '@hcengineering/presentation'
import { fetchMetadataLocalStorage, getCurrentLocation, navigate } from '@hcengineering/ui'
import view from '@hcengineering/view'
import { getObjectLinkFragment } from '@hcengineering/view-resources'

export async function checkAccess (doc: Doc): Promise<void> {
  const loc = getCurrentLocation()
  const ws = loc.path[1]
  const tokens: Record<string, string> = fetchMetadataLocalStorage(login.metadata.LoginTokens) ?? {}
  const token = tokens[ws]
  if (token === undefined) return
  const getEndpoint = await getResource(login.function.GetEndpoint)
  const endpoint = await getEndpoint()
  const clientFactory = await getResource(client.function.GetClient)
  const _client = await clientFactory(token, endpoint)

  const res = _client.findOne(doc._class, { _id: doc._id })
  const hierarchy = _client.getHierarchy()
  await _client.close()
  if (res !== undefined) {
    const panelComponent = hierarchy.classHierarchyMixin(doc._class, view.mixin.ObjectPanel)
    const comp = panelComponent?.component ?? view.component.EditDoc
    const loc = await getObjectLinkFragment(hierarchy, doc, {}, comp)
    // We have access, let's set correct tokens and redirect)
    setMetadata(presentation.metadata.Token, token)
    navigate(loc)
  }
}
