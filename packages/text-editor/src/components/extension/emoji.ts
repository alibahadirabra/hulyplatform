import { Extension } from '@tiptap/core'

const emojiReplaceDict = {
  '0:)': '😇',
  '0:-)': '😇',
  '0:-3': '😇',
  '0:3': '😇',
  '0;^)': '😇',
  'O:-)': '😇',
  '3:)': '😈',
  '3:-)': '😈',
  '}:)': '😈',
  '}:-)': '😈',
  '>:)': '😈',
  '>:-)': '😈',
  '>;)': '😈',
  ':-D': '😁',
  ":')": '😂',
  ":'-)": '😂',
  ':)': '😊',
  ':-)': '😄',
  ':]': '😄',
  ':^)': '😄',
  ':o)': '😄',
  ':}': '😄',
  '*-)': '😉',
  ':-,': '😉',
  ';)': '😉',
  ';-)': '😉',
  ';-]': '😉',
  ';]': '😉',
  ';^)': '😉',
  ':-|': '😐',
  ':|': '😐',
  ':(': '😞',
  ':-(': '😒',
  ':-<': '😒',
  ':-[': '😒',
  ':-c': '😒',
  ':<': '😒',
  ':[': '😒',
  ':{': '😒',
  '%)': '😖',
  '%-)': '😖',
  ':-P': '😜',
  ':-p': '😜',
  ';(': '😜',
  ':-||': '😠',
  ':-.': '😡',
  ':-/': '😡',
  ':/': '😐',
  ":'(": '😢',
  ":'-(": '😢',
  ':-O': '😲',
  ':-o': '😲',
  ':-&': '😶',
  ':-X': '😶'
}

function escapeRegExp (text: string): string {
  return text.replace(/[[\]{}()*+?.\\^$|#]/g, '\\$&')
}

export const EmojiExtension = Extension.create({
  addInputRules () {
    return Object.keys(emojiReplaceDict).map((pattern) => {
      return {
        find: new RegExp(escapeRegExp(pattern)),
        handler: ({ range, match, commands }) => {
          commands.insertContentAt(range, [
            {
              type: 'text',
              text: emojiReplaceDict[pattern as keyof typeof emojiReplaceDict]
            }
          ])
        }
      }
    })
  }
})
