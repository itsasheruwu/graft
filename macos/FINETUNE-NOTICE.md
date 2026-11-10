# FineTune-derived audio functionality

Graft's macOS application incorporates audio engine, DSP, monitoring, model,
persistence, automation, and test code from FineTune by Ronit Singh and its
contributors: https://github.com/ronitsingh10/FineTune.

The supplied local FineTune snapshot was imported on September 14, 2026. The
original file hashes are recorded in FINETUNE-SOURCE.json because that checkout
has no tracked source revision. FineTune is licensed under GNU GPL version 3;
the full license is included in FINETUNE-LICENSE and LICENSE.

The combined Graft macOS application is distributed under GPLv3. Original
MIT-licensed Graft portions retain their copyright and permission notice in
GRAFT-MIT-LICENSE. Bendable's notices remain separately included. The independent
browser extension and website retain the repository root MIT license; they do
not link the GraftAudio module.

Changes for Graft include a SwiftPM module boundary; Graft-owned UI, lifecycle,
permission state, data paths, URL namespace and migration; deferred capture;
FineTune conflict handling; and removal of FineTune's app entrypoint, updater,
menu framework, startup registration and process-wide crash signal handlers.

Corresponding source is the complete Graft release source tree, including macos/,
script/, and resource files referenced by script/build_and_run.sh. Distribute the
matching source archive and this build script alongside each macOS binary release.
Do not publish a binary without its matching source. Build with a macOS 15+ SDK
and a Swift 6.2+ toolchain using `swift build --package-path macos`, or package with
`./script/build_and_run.sh build`. No FineTune installation is needed to build.

AutoEQ profiles are obtained on demand from https://github.com/jaakkopasanen/AutoEq.
They retain their source project's license and measurement attribution. The
catalog is not bundled into Graft's source or binary.
