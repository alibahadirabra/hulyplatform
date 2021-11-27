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

import { Status, OK, unknownError, getMetadata, serialize } from '@anticrm/platform'
import type { Request, Response } from '@anticrm/platform'

import login from '@anticrm/login'

export interface LoginInfo {
  token: string
  endpoint: string
  email: string
}

/**
 * Perform a login operation to required workspace with user credentials.
 */
export async function doLogin (
  email: string,
  password: string,
  workspace: string
): Promise<[Status, LoginInfo | undefined]> {
  const accountsUrl = getMetadata(login.metadata.AccountsUrl)

  if (accountsUrl === undefined) {
    throw new Error('accounts url not specified')
  }

  const token = getMetadata(login.metadata.OverrideLoginToken)
  if (token !== undefined) {
    const endpoint = getMetadata(login.metadata.OverrideEndpoint)
    if (endpoint !== undefined) {
      return [OK, { token, endpoint, email }]
    }
  }

  const request: Request<[string, string, string]> = {
    method: 'login',
    params: [email, password, workspace]
  }

  try {
    const response = await fetch(accountsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: serialize(request)
    })
    const result: Response<any> = await response.json()
    console.log('login result', result)
    return [result.error ?? OK, result.result]
  } catch (err) {
    console.log('login error', err)
    return [unknownError(err), undefined]
  }
}
