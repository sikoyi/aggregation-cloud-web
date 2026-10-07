export interface CommentReplyScheduleOptions {
  inherit: boolean
  times: string[]
}

export interface CommentReplySchedulePolicy extends CommentReplyScheduleOptions {
  timezone: string
}
