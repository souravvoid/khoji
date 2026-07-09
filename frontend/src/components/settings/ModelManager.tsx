import { useEffect } from 'react'
import { Cpu, ScanText, Brain } from 'lucide-react'
import { ModelCard } from './ModelCard'
import { useSettingsStore } from '../../stores/settingsStore'
import { getModels, downloadModel as downloadModelApi, selectModel as selectModelApi } from '../../lib/ipc'

const sectionIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  ocr: ScanText,
  embedding: Brain,
  llm: Cpu,
}

const sectionLabels: Record<string, string> = {
  ocr: 'OCR Engine',
  embedding: 'Embedding Model',
  llm: 'Language Model',
}

export function ModelManager() {
  const models = useSettingsStore((s) => s.models)

  useEffect(() => {
    getModels()
      .then((models) => useSettingsStore.getState().setModels(models || []))
      .catch(console.error)
  }, [])

  const handleSelect = async (modelId: string) => {
    try {
      const result = await selectModelApi(modelId)
      if (result.selected) {
        const models = await getModels()
        useSettingsStore.getState().setModels(models || [])
      }
    } catch (e) {
      console.error('Select model failed:', e)
    }
  }

  const handleDownload = async (modelId: string) => {
    useSettingsStore.getState().updateModel(modelId, { status: 'downloading', progress: 0 })
    try {
      await downloadModelApi(modelId)
      useSettingsStore.getState().updateModel(modelId, { status: 'downloaded', progress: 100 })
      const models = await getModels()
      useSettingsStore.getState().setModels(models || [])
    } catch (e) {
      console.error('Download failed:', e)
      useSettingsStore.getState().updateModel(modelId, { status: 'not-installed' })
    }
  }

  const grouped = models.reduce<Record<string, typeof models>>((acc, m) => {
    (acc[m.type] ??= []).push(m)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, typeModels]) => {
        const Icon = sectionIcons[type] || Cpu
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-3">
               <Icon size={16} />
              <h3 className="text-sm font-semibold text-text-primary">{sectionLabels[type] || type}</h3>
            </div>
            <div className="space-y-2">
              {typeModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  onDownload={() => handleDownload(model.id)}
                  onSelect={() => handleSelect(model.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
