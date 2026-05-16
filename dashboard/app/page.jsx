'use client';
import { useState } from 'react';
import SkillsTab from './tabs/SkillsTab';
import RunsTab from './tabs/RunsTab';
import MemoryTab from './tabs/MemoryTab';
import JobsTab from './tabs/JobsTab';
import ResumesTab from './tabs/ResumesTab';

const TABS = [
  { id: 'skills', label: 'Skill diff', C: SkillsTab },
  { id: 'runs', label: 'Runs & feedback', C: RunsTab },
  { id: 'memory', label: 'Memory', C: MemoryTab },
  { id: 'jobs', label: 'Jobs', C: JobsTab },
  { id: 'resumes', label: 'Resumes', C: ResumesTab }
];

export default function Page() {
  const [active, setActive] = useState('skills');
  const Active = TABS.find(t => t.id === active).C;
  return (
    <>
      <div className="tabs">
        {TABS.map(t => (
          <div key={t.id} className={'tab' + (active === t.id ? ' active' : '')} onClick={() => setActive(t.id)}>
            {t.label}
          </div>
        ))}
      </div>
      <Active />
    </>
  );
}
