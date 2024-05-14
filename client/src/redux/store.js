import { configureStore } from '@reduxjs/toolkit'
import messages, { setup } from './messagesSlice'

function storeSetup(workers) {

  // Configurer le store redux
  const store = configureStore({

    reducer: {messages},

    middleware: (getDefaultMiddleware) => {
      
      const { downloadMessagesMiddleware, dechiffrageMiddleware } = setup(workers)

      // Prepend, evite le serializability check
      return getDefaultMiddleware()
        .prepend(dechiffrageMiddleware.middleware)
        .prepend(downloadMessagesMiddleware.middleware)

    },
  })

  return store
}

export default storeSetup
