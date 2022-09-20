import core, { Doc, Ref, TxOperations } from '@hcengineering/core'
import { translate } from '@hcengineering/platform'
import { getClient } from '@hcengineering/presentation'
import { Applicant, Candidate } from '@hcengineering/recruit'
import { getPanelURI } from '@hcengineering/ui'
import view from '@hcengineering/view'
import recruit from './plugin'

export async function getApplicationTitle (client: TxOperations, ref: Ref<Doc>): Promise<string> {
  const object = await client.findOne(
    recruit.class.Applicant,
    { _id: ref as Ref<Applicant> },
    { lookup: { _class: core.class.Class } }
  )
  if (object?.$lookup?._class?.shortLabel === undefined) {
    throw new Error(`Application shortLabel not found, _id: ${ref}`)
  }
  const label = await translate(object.$lookup._class.shortLabel, {})
  return `${label}-${object.number}`
}

export async function copyToClipboard (
  object: Applicant | Candidate,
  ev: Event,
  { type }: { type: string }
): Promise<void> {
  const client = getClient()
  let text: string
  switch (type) {
    case 'id':
      text = await getApplicationTitle(client, object._id)
      break
    case 'link':
      // TODO: fix when short link is available
      text = `${window.location.href}#${getPanelURI(view.component.EditDoc, object._id, object._class, 'content')}`
      break
    default:
      return
  }
  await navigator.clipboard.writeText(text)
}
