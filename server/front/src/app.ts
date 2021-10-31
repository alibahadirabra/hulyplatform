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

import { resolve, join } from 'path'
import express from 'express'
import fileUpload, { UploadedFile } from 'express-fileupload'
import cors from 'cors'
import { v4 as uuid } from 'uuid'
import { decode } from 'jwt-simple'

import { Space, Ref, Doc, Account, generateId } from '@anticrm/core'
// import { TxFactory } from '@anticrm/core'
import type { Token, IndexedDoc } from '@anticrm/server-core'
import { createElasticAdapter } from '@anticrm/elastic'
import chunter from '@anticrm/chunter'
// import { createContributingClient } from '@anticrm/contrib'

import { Client, ItemBucketMetadata } from 'minio'

// import { createElasticAdapter } from '@anticrm/elastic'

// const BUCKET = 'anticrm-upload-9e4e89c'

// async function awsUpload (file: UploadedFile): Promise<string> {
//   const id = uuid()
//   const s3 = new S3()
//   const resp = await s3.upload({
//     Bucket: BUCKET,
//     Key: id,
//     Body: file.data,
//     ContentType: file.mimetype,
//     ACL: 'public-read'
//   }).promise()
//   console.log(resp)
//   return id
// }

async function minioUpload (minio: Client, workspace: string, file: UploadedFile): Promise<string> {
  const id = uuid()
  const meta: ItemBucketMetadata = {
    'Content-Type': file.mimetype
  }

  const resp = await minio.putObject(workspace, id, file.data, file.size, meta)

  console.log(resp)
  return id
}

// async function createAttachment (endpoint: string, token: string, account: Ref<Account>, space: Ref<Space>, attachedTo: Ref<Doc>, collection: string, name: string, file: string): Promise<void> {
//   const txFactory = new TxFactory(account)
//   const tx = txFactory.createTxCreateDoc(chunter.class.Attachment, space, {
//     attachedTo,
//     collection,
//     name,
//     file
//   })
//   const url = new URL(`/${token}`, endpoint)
//   const client = await createContributingClient(url.href)
//   await client.tx(tx)
//   client.close()
// }

/**
 * @public
 * @param port -
 */
export function start (transactorEndpoint: string, elasticUrl: string, minio: Client, port: number): void {
  const app = express()

  app.use(cors())
  app.use(fileUpload())

  const dist = resolve(__dirname, 'dist')
  console.log('serving static files from', dist)
  app.use(express.static(dist, { maxAge: '10m' }))

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.get('/files', async (req, res) => {
    try {
      const token = req.query.token as string
      const payload = decode(token, 'secret', false) as Token
      const uuid = req.query.file as string

      const stat = await minio.statObject(payload.workspace, uuid)
      minio.getObject(payload.workspace, uuid, function (err, dataStream) {
        if (err !== null) {
          return console.log(err)
        }
        res.status(200)

        const contentType = stat.metaData['content-type']
        if (contentType !== undefined) {
          res.setHeader('Content-Type', contentType)
        }

        dataStream.on('data', function (chunk) {
          res.write(chunk)
        })
        dataStream.on('end', function () {
          res.end()
        })
        dataStream.on('error', function (err) {
          console.log(err)
        })
      })
    } catch (error) {
      console.log(error)
      res.status(500).send()
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/files', async (req, res) => {
    const file = req.files?.file as UploadedFile

    if (file === undefined) {
      res.status(400).send()
      return
    }

    const authHeader = req.headers.authorization
    if (authHeader === undefined) {
      res.status(403).send()
      return
    }

    try {
      const token = authHeader.split(' ')[1]
      const payload = decode(token ?? '', 'secret', false) as Token
      // const fileId = await awsUpload(file as UploadedFile)
      const uuid = await minioUpload(minio, payload.workspace, file)
      console.log('uploaded uuid', uuid)

      const name = req.query.name as string
      const space = req.query.space as Ref<Space>
      const attachedTo = req.query.attachedTo as Ref<Doc>
      // const name = req.query.name as string

      // await createAttachment(
      //   transactorEndpoint,
      //   token,
      //   'core:account:System' as Ref<Account>,
      //   space,
      //   attachedTo,
      //   collection,
      //   name,
      //   fileId
      // )

      const elastic = await createElasticAdapter(elasticUrl, payload.workspace)

      const indexedDoc: IndexedDoc = {
        id: generateId() + '/attachments/' + name,
        _class: chunter.class.Attachment,
        space,
        modifiedOn: Date.now(),
        modifiedBy: 'core:account:System' as Ref<Account>,
        attachedTo,
        data: file.data.toString('base64')
      }

      await elastic.index(indexedDoc)

      res.status(200).send(uuid)
    } catch (error) {
      console.log(error)
      res.status(500).send()
    }
  })

  app.get('*', function (request, response) {
    response.sendFile(join(dist, 'index.html'))
  })

  app.listen(port)
}
