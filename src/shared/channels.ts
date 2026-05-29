export const IPC = {
  DIALOG_OPEN_FOLDER: 'dialog:openFolder',
  INFER_OUT_DIR: 'translation:inferOutDir',
  TRANSLATION_START: 'translation:start',
  TRANSLATION_STOP: 'translation:stop',
  KEYCHAIN_GET: 'keychain:get',
  KEYCHAIN_SET: 'keychain:set',
  KEYCHAIN_DELETE: 'keychain:delete',
  STORE_GET: 'store:get',
  STORE_SET: 'store:set',
  STORE_RESET: 'store:reset',
  // push from main → renderer
  TRANSLATION_LOG: 'translation:log',
  TRANSLATION_PROGRESS: 'translation:progress',
  TRANSLATION_DONE: 'translation:done',
  TRANSLATION_ERROR: 'translation:error',
} as const
