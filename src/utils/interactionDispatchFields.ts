import type { FieldConfig } from '@/types/crud'

const INTERACTION_MAIN_FIELD_KEYS = new Set([
  'main_account_id',
  'square_target_account_id',
])

export function groupInteractionDispatchFields(fields: FieldConfig[]) {
  return {
    main: fields.filter((field) => INTERACTION_MAIN_FIELD_KEYS.has(field.key)),
    comment: fields.filter((field) => field.key === 'comment_account_ids'),
    params: fields.filter((field) => (
      !INTERACTION_MAIN_FIELD_KEYS.has(field.key)
      && field.key !== 'comment_account_ids'
    )),
  }
}
