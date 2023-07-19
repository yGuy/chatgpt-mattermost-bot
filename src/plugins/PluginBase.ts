import {Log} from "debug-level";
import {AiResponse, MessageData} from "../types";

/**
 * A base class for plugins defining some default functionality.
 */
export abstract class PluginBase {
    protected readonly log = new Log('bot')

    public constructor(
        public readonly key: string,
        public readonly description: string,
        public readonly promptDescription: string) {}

    abstract runPlugin(prompt: string, msgData: MessageData): Promise<AiResponse>;
    setup(): boolean {
        return true
    }
}