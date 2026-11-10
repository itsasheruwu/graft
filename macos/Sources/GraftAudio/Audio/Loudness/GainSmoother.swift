// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
import Foundation

/// Smooths gain changes using asymmetric attack/release time constants.
/// Ticks once per analysis hop. RT-safe — no allocations in `process`.
package final class GainSmoother: @unchecked Sendable {
    private var settings: LoudnessEqualizerSettings
    private var attackCoeff: Float
    private var releaseCoeff: Float
    package private(set) var currentGainDb: Float = 0

    package init(settings: LoudnessEqualizerSettings, sampleRate: Float) {
        self.settings = settings
        let hopMs = settings.analysisHopMs
        self.attackCoeff  = LoudnessEqualizerMath.timeConstantCoefficient(timeMs: settings.gainAttackMs,  stepMs: hopMs)
        self.releaseCoeff = LoudnessEqualizerMath.timeConstantCoefficient(timeMs: settings.gainReleaseMs, stepMs: hopMs)
    }

    /// Reset smoother to a known initial gain.
    package func reset(initialGainDb: Float = 0) {
        currentGainDb = initialGainDb
    }

    /// Advance one hop toward `targetGainDb`. Returns the current smoothed gain.
    package func process(targetGainDb: Float) -> Float {
        // Attack: target < current means gain is being reduced (signal got louder) — use faster coeff
        // Release: target >= current means gain is recovering — use slower coeff
        let coeff: Float = targetGainDb < currentGainDb ? attackCoeff : releaseCoeff
        currentGainDb += coeff * (targetGainDb - currentGainDb)
        return currentGainDb
    }
}
