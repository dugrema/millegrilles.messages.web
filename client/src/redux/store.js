import { configureStore } from '@reduxjs/toolkit'
import messages, { messagesMiddlewareSetup } from './messagesSlice'

function storeSetup(workers) {

  // Configurer le store redux
  const store = configureStore({

    reducer: { 
      messages, 
    },

    middleware: (getDefaultMiddleware) => {
      
      // const { appareilsMiddleware } = appareilsMiddlewareSetup(workers)

      // Prepend, evite le serializability check
      return getDefaultMiddleware()
        // .prepend(appareilsMiddleware.middleware)

    },
  })

  return store
}

export default storeSetup
