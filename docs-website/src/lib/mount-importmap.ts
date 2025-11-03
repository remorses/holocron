import importMap from 'virtual:importmap'

export function mountImportMap() {
  if (typeof document === 'undefined') return
  
  const mapScript = document.createElement('script')
  mapScript.type = 'importmap'
  mapScript.textContent = JSON.stringify(importMap, null, 2)
  console.log(mapScript.textContent)
  document.head.append(mapScript)
}

if (typeof document !== 'undefined') {
  mountImportMap()
}
