import { configureStore } from '@reduxjs/toolkit'
import messages, { setup } from './messagesSlice'
import downloader, { downloaderMiddlewareSetup } from './downloaderSlice'

function storeSetup(workers) {

  // Configurer le store redux
  const store = configureStore({

    reducer: {messages, downloader},

    middleware: (getDefaultMiddleware) => {
      
      const { downloadMessagesMiddleware, dechiffrageMiddleware } = setup(workers)
      const downloaderMiddleware = downloaderMiddlewareSetup(workers)

      // Prepend, evite le serializability check
      return getDefaultMiddleware()
        .prepend(dechiffrageMiddleware.middleware)
        .prepend(downloadMessagesMiddleware.middleware)
        .prepend(downloaderMiddleware.middleware)

    },
  })

  return store
}

export default storeSetup
