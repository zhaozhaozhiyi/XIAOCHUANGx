import baseConfig from "./playwright.config";

const noWebserverConfig = {
  ...baseConfig,
  webServer: undefined,
};

export default noWebserverConfig;
