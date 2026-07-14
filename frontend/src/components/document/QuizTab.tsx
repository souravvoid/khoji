import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Clock, CheckCircle2, XCircle, HelpCircle, Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressBar'
import { EmptyState } from '../ui/EmptyState'
import { useDocumentStore } from '../../stores/documentStore'
import { getDocument, type QuizQuestion } from '../../lib/ipc'
import { QUIZ_PASS_PERCENTAGE, QUIZ_NEAR_PASS_PERCENTAGE, QUIZ_RESULT_LABEL_MAX } from '../../lib/constants'

type QuizView = 'config' | 'active' | 'result'

export function QuizTab() {
  const { activeDocument } = useDocumentStore()
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [view, setView] = useState<QuizView>('config')
  const [currentQ, setCurrentQ] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [showResult, setShowResult] = useState(false)

  useEffect(() => {
    if (!activeDocument) return
    setLoading(true)
    setFetchError('')
    getDocument(activeDocument.id)
      .then((data) => {
        if (data?.quiz) {
          setQuestions(data.quiz)
        } else {
          setQuestions([])
        }
      })
      .catch(() => {
        setQuestions([])
        setFetchError('Failed to load quiz questions')
      })
      .finally(() => setLoading(false))
  }, [activeDocument?.id])

  const handleStart = () => {
    setView('active')
    setCurrentQ(0)
    setSelected(null)
    setAnswers([])
    setShowResult(false)
  }

  const handleSelect = (index: number) => {
    if (showResult) return
    setSelected(index)
  }

  const handleConfirm = () => {
    if (selected === null) return
    const newAnswers = [...answers]
    newAnswers[currentQ] = selected
    setAnswers(newAnswers)
    setShowResult(true)
  }

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1)
      setSelected(null)
      setShowResult(false)
    } else {
      setView('result')
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (view !== 'active') return
      const q = questions[currentQ]
      if (!q) return
      if (!showResult) {
        if (e.key >= '1' && e.key <= '4') {
          const idx = parseInt(e.key) - 1
          if (idx < (q.options || []).length) setSelected(idx)
        }
        if (e.key === 'Enter' && selected !== null) handleConfirm()
      } else {
        if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault()
          handleNext()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  })

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-status-error">{fetchError}</p>
      </div>
    )
  }

  if (view === 'result') {
    const correct = answers.filter((a, i) => a === questions[i]?.correct_answer_index).length
    const percentage = Math.round((correct / questions.length) * 100)
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 gap-6">
           <div className={`text-5xl ${percentage >= QUIZ_PASS_PERCENTAGE ? 'text-success-500' : percentage >= QUIZ_NEAR_PASS_PERCENTAGE ? 'text-warning-500' : 'text-error-500'}`}>
          {percentage >= 80 ? <CheckCircle2 size={48} /> : percentage >= 50 ? <Clock size={48} /> : <XCircle size={48} />}
        </div>
        <h2 className="text-2xl font-bold text-text-primary">Quiz Complete!</h2>
        <p className="text-4xl font-bold text-text-primary">{percentage}%</p>
        <p className="text-sm text-text-tertiary">{correct} of {questions.length} correct</p>
        <div className="w-full max-w-md space-y-2">
          {questions.map((q: QuizQuestion, i: number) => (
            <div key={q.id || i} className={`p-3 rounded-lg text-sm flex items-center gap-2 ${answers[i] === q.correct_answer_index ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'}`}>
              {answers[i] === q.correct_answer_index ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
               <span className="truncate">{(q.question || '').slice(0, QUIZ_RESULT_LABEL_MAX)}...</span>
            </div>
          ))}
        </div>
        <Button onClick={() => setView('config')}>Retry Quiz</Button>
      </div>
    )
  }

  if (view === 'active') {
    const q = questions[currentQ]
    if (!q) return null
    const options = q.options || []
    return (
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-border-default">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-tertiary">Question {currentQ + 1} of {questions.length}</span>
            <span className="text-sm text-text-tertiary">{Math.round(((currentQ + 1) / questions.length) * 100)}%</span>
          </div>
          <ProgressBar value={((currentQ + 1) / questions.length) * 100} />
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <h3 className="text-lg font-semibold text-text-primary">{q.question}</h3>
          <div className="space-y-3">
            {options.map((opt: string, i: number) => {
              let style = 'border-border-default hover:border-primary-300 hover:bg-primary-50/50'
              if (showResult) {
                if (i === q.correct_answer_index) style = 'border-success-500 bg-success-50'
                else if (i === selected && selected !== q.correct_answer_index) style = 'border-error-500 bg-error-50'
                else style = 'border-border-default opacity-60'
              } else if (selected === i) {
                style = 'border-primary-500 bg-primary-50'
              }
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`w-full text-left p-4 border rounded-lg transition-all cursor-pointer ${style}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                      ${showResult && i === q.correct_answer_index ? 'bg-success-500 text-white' :
                        showResult && i === selected && selected !== q.correct_answer_index ? 'bg-error-500 text-white' :
                        selected === i ? 'bg-primary-500 text-white' : 'bg-bg-tertiary text-text-tertiary'}`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="text-sm text-text-primary">{opt}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {showResult && (
            <div className="p-4 bg-bg-secondary rounded-lg border border-border-default">
              <p className="text-xs font-semibold text-text-tertiary mb-1">Explanation</p>
              <p className="text-sm text-text-secondary">{q.explanation || ''}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border-default flex justify-between">
          <Button variant="ghost" onClick={() => { setCurrentQ(Math.max(0, currentQ - 1)); setSelected(answers[currentQ - 1] ?? null); setShowResult(false) }} disabled={currentQ === 0}>
            <ArrowLeft size={16} /> Previous
          </Button>
          {showResult ? (
            <Button onClick={handleNext}>{currentQ < questions.length - 1 ? 'Next Question' : 'See Results'} <ArrowRight size={16} /></Button>
          ) : (
            <Button onClick={handleConfirm} disabled={selected === null}>Submit Answer</Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 gap-6">
      <EmptyState
        icon={<HelpCircle size={48} />}
        title="Quiz Ready"
        description={`${questions.length} multiple-choice questions generated from this document. Test your knowledge.`}
        action={{ label: 'Start Quiz', onClick: handleStart }}
      />
    </div>
  )
}
