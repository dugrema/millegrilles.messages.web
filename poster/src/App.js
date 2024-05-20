import {lazy, Suspense} from 'react'

import './App.css'
import './index.scss'

const PosterMessage = lazy(()=>import('./PosterMessage'))

const urlPoster = 'https://thinkcentre1.maple.maceroc.com/reception/message'

function App() {
  return (
    <div className="App">
      <Suspense load={Loading}>
        <PosterMessage urlPoster={urlPoster} />
      </Suspense>
    </div>
  );
}

export default App;

function Loading(props) {
  return 'loading'
}
