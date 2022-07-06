import client from '@anticrm/client'
import contact from '@anticrm/contact'
import core, { Client, setCurrentAccount, Version } from '@anticrm/core'
import login from '@anticrm/login'
import { getMetadata, getResource, setMetadata } from '@anticrm/platform'
import { fetchMetadataLocalStorage, getCurrentLocation, navigate, setMetadataLocalStorage } from '@anticrm/ui'
import presentation from './plugin'

export let versionError: string | undefined = ''

export async function connect (title: string): Promise<Client | undefined> {
  const loc = getCurrentLocation()
  const ws = loc.path[1]
  const tokens: Record<string, string> = fetchMetadataLocalStorage(login.metadata.LoginTokens) ?? {}
  const token = tokens[ws]
  setMetadata(login.metadata.LoginToken, token)
  const endpoint = fetchMetadataLocalStorage(login.metadata.LoginEndpoint)
  const email = fetchMetadataLocalStorage(login.metadata.LoginEmail)

  if (token === undefined || endpoint === null || email === null) {
    navigate({
      path: [login.component.LoginApp],
      query: { navigateUrl: encodeURIComponent(JSON.stringify(loc)) }
    })
    return
  }

  const getClient = await getResource(client.function.GetClient)
  const instance = await getClient(
    token,
    endpoint,
    () => {
      location.reload()
    },
    () => {
      clearMetadata(ws)
      navigate({
        path: [login.component.LoginApp],
        query: {}
      })
    }
  )
  console.log('logging in as', email)

  const me = await instance.findOne(contact.class.EmployeeAccount, { email })
  if (me !== undefined) {
    console.log('login: employee account', me)
    setCurrentAccount(me)
  } else {
    console.error('WARNING: no employee account found.')
    clearMetadata(ws)
    navigate({
      path: [login.component.LoginApp],
      query: { navigateUrl: encodeURIComponent(JSON.stringify(getCurrentLocation())) }
    })
    return
  }

  try {
    const version = await instance.findOne<Version>(core.class.Version, {})
    console.log('Model version', version)

    const requirdVersion = getMetadata(presentation.metadata.RequiredVersion)
    if (requirdVersion !== undefined) {
      console.log('checking min model version', requirdVersion)
      const versionStr = `${version?.major as number}.${version?.minor as number}.${version?.patch as number}`

      if (version === undefined || requirdVersion !== versionStr) {
        versionError = `${versionStr} => ${requirdVersion}`
        return undefined
      }
    }
  } catch (err: any) {
    console.log(err)
    const requirdVersion = getMetadata(presentation.metadata.RequiredVersion)
    console.log('checking min model version', requirdVersion)
    if (requirdVersion !== undefined) {
      versionError = `'unknown' => ${requirdVersion}`
      return undefined
    }
  }

  // Update window title
  document.title = [ws, title].filter((it) => it).join(' - ')

  return instance
}
function clearMetadata (ws: string): void {
  const tokens = fetchMetadataLocalStorage(login.metadata.LoginTokens)
  if (tokens !== null) {
    const loc = getCurrentLocation()
    // eslint-disable-next-line
    delete tokens[loc.path[1]]
    setMetadataLocalStorage(login.metadata.LoginTokens, tokens)
  }
  setMetadata(login.metadata.LoginToken, null)
  setMetadataLocalStorage(login.metadata.LoginEndpoint, null)
  setMetadataLocalStorage(login.metadata.LoginEmail, null)
}
