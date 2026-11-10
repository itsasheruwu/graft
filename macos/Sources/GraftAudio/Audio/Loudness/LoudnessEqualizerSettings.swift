// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
package struct LoudnessEqualizerSettings: Codable, Equatable, Sendable {
    package var targetLoudnessDb: Float = -12
    package var maxBoostDb: Float = 15
    package var maxCutDb: Float = 4
    package var compressionThresholdOffsetDb: Float = 6
    package var compressionRatio: Float = 1.6
    package var compressionKneeDb: Float = 8

    package var analysisWindowMs: Float = 30
    package var analysisHopMs: Float = 15

    package var detectorAttackMs: Float = 25
    package var detectorReleaseMs: Float = 400

    package var gainAttackMs: Float = 180
    package var gainReleaseMs: Float = 5000

    package var noiseFloorThresholdDb: Float = -48
    package var lowLevelMaxBoostDb: Float = 1.5

    package var enabled: Bool = false
}
