import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Rocket, LayoutDashboard, CheckSquare, FolderKey, ArrowRight } from 'lucide-react';
import { completeOnboarding } from '../lib/api';

interface TutorialProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: Rocket,
    title: 'Welcome to Made4Founders',
    subtitle: 'Your Command Center for Running a Startup',
    content: 'Everything you need to manage your business in one secure place. Track compliance, store documents, manage contacts, and monitor your growth.',
    color: 'from-cyan-500 to-violet-600',
  },
  {
    icon: LayoutDashboard,
    title: 'Your Dashboard',
    subtitle: 'Daily Brief & Key Metrics',
    content: 'Start each day with your personalized dashboard. See upcoming deadlines, track tasks, monitor business health, and get actionable insights at a glance.',
    color: 'from-cyan-500 to-cyan-600',
  },
  {
    icon: CheckSquare,
    title: 'Setup Checklist',
    subtitle: '98 Items Across 11 Categories',
    content: 'Never miss a compliance requirement. From entity formation to cybersecurity, our comprehensive checklist guides you through everything your business needs.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: FolderKey,
    title: 'Secure Your Business',
    subtitle: 'Documents, Vault & More',
    content: 'Store documents securely, protect credentials in the encrypted Vault, manage contacts, and track important deadlines. All your sensitive data, protected.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    icon: ArrowRight,
    title: "Let's Get Started",
    subtitle: 'Your First Steps',
    content: null, // Will render checklist instead
    color: 'from-emerald-500 to-emerald-600',
    checklist: [
      { label: 'Explore your Dashboard', path: '/app' },
      { label: 'Review the Setup Checklist', path: '/app/getting-started' },
      { label: 'Add your first contact', path: '/app/contacts' },
    ],
  },
];

export default function Tutorial({ onComplete }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const handleComplete = async () => {
    setIsClosing(true);
    try {
      await completeOnboarding();
    } catch (err) {
      console.error('Failed to mark onboarding complete:', err);
    }
    onComplete();
  };

  const handleSkip = async () => {
    setIsClosing(true);
    try {
      await completeOnboarding();
    } catch (err) {
      console.error('Failed to mark onboarding complete:', err);
    }
    onComplete();
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const Icon = step.icon;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleSkip} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#1a1d24] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition z-10"
          title="Skip tutorial"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${step.color} p-8 text-center`}>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1a1d24]/20 rounded-2xl mb-4">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">{step.title}</h2>
          <p className="text-white/80 text-sm">{step.subtitle}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {step.content && (
            <p className="text-gray-300 text-center leading-relaxed">{step.content}</p>
          )}

          {step.checklist && (
            <div className="space-y-3">
              {step.checklist.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1d24]/5 border border-white/10"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <span className="text-gray-200">{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-6 bg-cyan-500'
                    : index < currentStep
                    ? 'bg-cyan-500/50'
                    : 'bg-[#1a1d24]/20'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {isLastStep ? (
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium rounded-lg hover:opacity-90 transition"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-medium rounded-lg hover:opacity-90 transition"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
