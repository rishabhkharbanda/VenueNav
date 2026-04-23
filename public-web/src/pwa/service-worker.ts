/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { installPrecache, installRuntimeCaching } from "./cacheStrategies";

installPrecache();
installRuntimeCaching();
