import { useState } from 'react'
import { storyToText, copyText } from '../format.js'

const CATEGORY_LABEL = {
  viral: 'viral',
  creator: 'creator / streamer',
  gaming: 'gaming',
  tech: 'tech / AI',
  entertainment: 'entertainment',
  world: 'world news',
  money: 'money / crypto',
  sports: 'sports',
  science: 'science',
  bizarre: 'bizarre internet'
}

const CATEGORY_EMOJI = {
  viral: '🚀', creator: '🎥', gaming: '🎮', tech: '🤖', entertainment: '🎬',
  world: '🌍', money: '💸', sports: '🏆', science: '🔬', bizarre: '👁️'
}

export default function StoryCard ({ story, index }) {
  const [copied, setCopied] = useState(null)

  const flash = async (key, text) => {
    const ok = await copyText(text)
    setCopied(ok ? key : 'fail')
    setTimeout(() => setCopied(null), 1400)
    return ok
  }

  const btnClass = key => `btn sm${copied === key ? ' copied' : ''}`
  const label = (key, fallback) => (copied === key ? 'COPIED' : copied === 'fail' ? 'FAILED' : fallback)

  return (
    <article className={`card ${story.severity === 'wild' ? 'wild' : ''}`}>
      <div className="card-head">
        <span className="num">{String(index + 1).padStart(2, '0')}</span>
        <div>
          <h2 className="title">{story.topicTitle}</h2>
          <div className="tags">
            <span className={`tag ${story.category}`}>
              {CATEGORY_EMOJI[story.category] || '📌'} {CATEGORY_LABEL[story.category] || story.category}
            </span>
            {story.severity === 'wild' && <span className="tag wild">🔥 wild</span>}
            {story.severity === 'mild' && <span className="tag">mild</span>}
            {story.ageHours != null && <span className="tag age">{story.ageHours}h old</span>}
          </div>
        </div>
      </div>

      <div className="block src">
        <span className="label src"><i className="bar" />Source / Context</span>
        <p className="body">{story.sourceContext}</p>
      </div>

      <div className="block why">
        <span className="label why"><i className="bar" />Why it's viral</span>
        <p className="body">{story.whyViral}</p>
      </div>

      <div className="block">
        <span className="label hook"><i className="bar" />The hook line</span>
        <div className="hooks">
          <div className="hook">
            <span className="hook-letter">A</span>
            <p>{story.hookA}</p>
            <button className={btnClass('a')} onClick={() => flash('a', story.hookA)} title="Copy hook A">
              {label('a', 'COPY')}
            </button>
          </div>
          <div className="hook">
            <span className="hook-letter">B</span>
            <p>{story.hookB}</p>
            <button className={btnClass('b')} onClick={() => flash('b', story.hookB)} title="Copy hook B">
              {label('b', 'COPY')}
            </button>
          </div>
        </div>
      </div>

      <div className="card-foot">
        {story.sourceUrl ? (
          <a className="src-link" href={story.sourceUrl} target="_blank" rel="noreferrer noopener">
            ↗ {story.sourceName || story.sourceUrl}
          </a>
        ) : (
          <span className="src-link" style={{ color: 'var(--dimmer)' }}>{story.sourceName || 'no source'}</span>
        )}
        <span className="spacer" />
        <button className={btnClass('card')} onClick={() => flash('card', storyToText(story, index + 1))}>
          {label('card', 'COPY CARD')}
        </button>
      </div>
    </article>
  )
}
