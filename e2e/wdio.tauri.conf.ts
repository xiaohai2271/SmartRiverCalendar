import type { Options } from '@wdio/types'

export const config: Options.Testrunner = {
  runner: 'local',
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
      esModule: true,
    },
  },
  specs: ['./tauri/**/*.spec.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      browserName: 'custom',
      'tauri:options': {
        application: '../src-tauri/target/release/smart-river-calendar.exe',
      },
    },
  ],
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:5173',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: ['tauri'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
}
