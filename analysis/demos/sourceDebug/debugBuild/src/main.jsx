import { StrictMode, Profiler } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'


const DebugApp = (<Profiler id="App" onRender={(id, phase, actualDuration) => {
  // debugger
  console.log(`Render ${id} took ${actualDuration}ms`);
}}>
  <App />
</Profiler>)

const root = createRoot(document.getElementById('root'))
performance.mark('start')
root.render(DebugApp)

performance.mark('end')
performance.measure('App', 'start', 'end')

console.log(performance.getEntriesByType('measure'))