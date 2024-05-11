import { configureStore } from '@reduxjs/toolkit'
import appareils, { appareilsMiddlewareSetup } from './appareilsSlice'

function storeSetup(workers) {

  // Configurer le store redux
  const store = configureStore({

    reducer: { 
      appareils, 
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
