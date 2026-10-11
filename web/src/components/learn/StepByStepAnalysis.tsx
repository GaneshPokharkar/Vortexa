import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { type StepByStepAnalysis } from "../../lib/api";

export function StepByStepAnalysis({ analysis, correctAnswerSteps }: {
  analysis: StepByStepAnalysis;
  correctAnswerSteps?: string[];
}) {
  if (!analysis.has_steps || analysis.total_steps === 0) return null;

  const divergencePoint = analysis.divergence_point;

  return (
    <div className="rounded-lg border border-line bg-surface-soft p-4 sm:p-5">
      <h3 className="text-[15px] font-semibold text-ink mb-4">Step-by-step breakdown</h3>

      <div className="space-y-3">
        {analysis.steps.map((step, idx) => {
          const isDiverged = divergencePoint && step.step_number >= divergencePoint;
          const isFirst = step.step_number === 1;

          return (
            <div key={step.step_number} className={`
              rounded-lg border p-3 transition-colors
              ${isDiverged ? "border-amber-300 bg-amber-50" : "border-line bg-surface"}
            `}>
              {/* Step header */}
              <div className="flex items-start gap-3 mb-2">
                <div className={`flex-shrink-0 rounded-full w-6 h-6 flex items-center justify-center font-semibold text-[13px]
                  ${step.is_correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
                `}>
                  {step.step_number}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-ink">{step.description}</p>
                </div>
                <div className="flex-shrink-0">
                  {step.is_correct ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>
              </div>

              {/* Correct answer */}
              <div className="ml-9 mb-2">
                <p className="text-[12px] text-muted mb-1">Correct answer:</p>
                <p className="text-[13px] font-mono bg-green-50 border border-green-200 rounded px-2 py-1.5 text-green-900">
                  {step.correct_answer}
                </p>
              </div>

              {/* Student's answer */}
              {step.student_answer && (
                <div className="ml-9 mb-2">
                  <p className="text-[12px] text-muted mb-1">Your answer:</p>
                  <p className={`text-[13px] font-mono rounded px-2 py-1.5 border
                    ${step.is_correct
                      ? "bg-green-50 border-green-200 text-green-900"
                      : "bg-red-50 border-red-200 text-red-900"}
                  `}>
                    {step.student_answer}
                  </p>
                </div>
              )}

              {/* Misconception note */}
              {step.misconception_code && !step.is_correct && (
                <div className="ml-9">
                  <div className="flex items-start gap-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Misconception detected: {step.misconception_code}</span>
                  </div>
                </div>
              )}

              {/* Divergence indicator */}
              {isDiverged && isFirst && (
                <div className="ml-9 mt-2 text-[12px] font-semibold text-amber-700">
                  ⚠ You went off track starting here
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {divergencePoint && (
        <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-[13px] text-amber-900">
            <span className="font-semibold">You diverged at Step {divergencePoint}.</span> Everything before that was correct. The issue started here—review this step and compare your reasoning with the correct approach above.
          </p>
        </div>
      )}

      {!divergencePoint && (
        <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-[13px] text-green-900 font-semibold">
            ✓ All steps correct!
          </p>
        </div>
      )}
    </div>
  );
}
