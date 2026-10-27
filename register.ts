import { registerCommands } from "dressed/server";
import * as config from "./src/bot/cmds/config";
import * as init from "./src/bot/cmds/init";

registerCommands({ config, init });
