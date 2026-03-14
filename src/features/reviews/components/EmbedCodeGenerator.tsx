'use client'

import { useState } from 'react'

interface EmbedCodeGeneratorProps {
  publicKey: string
  propertyName: string
}

export function EmbedCodeGenerator({ publicKey, propertyName }: EmbedCodeGeneratorProps) {
  const [copied, setCopied] = useState(false)

  const embedUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/embed/reviews/${publicKey}`

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="600"
  frameborder="0"
  title="Resenas de ${propertyName}"
  style="border: none; border-radius: 12px; overflow: hidden;"
></iframe>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = iframeCode
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">
          Codigo para insertar en tu sitio web
        </h3>
        <p className="text-xs text-foreground-muted mb-3">
          Copia este codigo y pegalo en el HTML de tu sitio web donde quieras mostrar las resenas.
        </p>
      </div>

      {/* Code block */}
      <div className="relative">
        <pre className="bg-gray-900 text-gray-100 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all font-mono">
          {iframeCode}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>

      {/* Preview */}
      <div>
        <h4 className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-2">
          Vista previa
        </h4>
        <div className="border border-border rounded-xl overflow-hidden bg-white">
          <iframe
            src={`/embed/reviews/${publicKey}`}
            width="100%"
            height="400"
            style={{ border: 'none' }}
            title={`Preview - Resenas de ${propertyName}`}
          />
        </div>
      </div>
    </div>
  )
}
