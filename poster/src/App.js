import {lazy, Suspense} from 'react'

import './App.css'
import './index.scss'

const PosterMessage = lazy(()=>import('./PosterMessage'))

function App() {
  return (
    <div className="App">
      <Suspense load={Loading}>
        <PosterMessage />
      </Suspense>
    </div>
  );
}

export default App;

function Loading(props) {
  return 'loading'
}
