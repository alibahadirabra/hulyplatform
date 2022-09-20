//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
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

import type { Request, Response } from '@hcengineering/platform'
import platform, { Status, Severity } from '@hcengineering/platform'

import { generateToken } from '@hcengineering/server-token'

interface LoginInfo {
  token: string
  endpoint: string
}

function login (endpoint: string, email: string, password: string, workspace: string): Response<LoginInfo> {
  if (email !== 'rosamund@hc.engineering' && email !== 'elon@hc.engineering') {
    return { error: new Status(Severity.ERROR, platform.status.Unauthorized, {}) }
  }

  if (password !== '1111') {
    return { error: new Status(Severity.ERROR, platform.status.Unauthorized, {}) }
  }

  if (workspace !== 'ws1' && workspace !== 'ws2') {
    return { error: new Status(Severity.ERROR, platform.status.Unauthorized, {}) }
  }

  const token = generateToken(email, workspace)
  return { result: { token, endpoint } }
}

export function handleRequest (req: Request<any[]>, serverEndpoint: string): Response<any> {
  if (req.method === 'login') {
    return login(serverEndpoint, ...(req as Request<[string, string, string]>).params)
  }

  return { error: new Status(Severity.ERROR, platform.status.BadRequest, {}) }
}
