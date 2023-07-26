import {Post} from "@mattermost/types/lib/posts";

export type JSONMessageData = {
    mentions?: string,
    post: string,
    sender_name: string
}

export type MessageData = {
    mentions: string[],
    post: Post,
    sender_name: string
}

export type AiResponse = {
    message: string,
    props?: Record<string, string>,
    fileId?: string,
    intermediate?: boolean
}