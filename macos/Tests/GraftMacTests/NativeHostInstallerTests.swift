import Foundation
import Testing
@testable import GraftMac

// NativeHostInstaller is main-actor isolated by the GraftMac target's default isolation.
@Suite("Extension ID validation")
@MainActor
struct NativeHostInstallerTests {
    @Test("Accepts a well-formed ID, and tolerates surrounding whitespace from a paste", arguments: [
        "abcdefghijklmnopabcdefghijklmnop",
        "  abcdefghijklmnopabcdefghijklmnop  ",
        "abcdefghijklmnopabcdefghijklmnop\n",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "pppppppppppppppppppppppppppppppp",
    ])
    func acceptsValidIDs(id: String) {
        #expect(NativeHostInstaller.isValidExtensionID(id))
    }

    @Test("Rejects wrong lengths, out-of-range letters, and embedded matches", arguments: [
        "",
        "abcdefghijklmnopabcdefghijklmno",     // 31 characters
        "abcdefghijklmnopabcdefghijklmnopq",   // 33 characters
        "abcdefghijklmnopabcdefghijklmnoq",    // 'q' is outside a-p
        "ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP",    // uppercase
        "abcdefghijklmnopabcdefghijklmn0p",    // digit
        "prefix abcdefghijklmnopabcdefghijklmnop",
        "abcdefghijklmnopabcdefghijklmnop suffix",
    ])
    func rejectsInvalidIDs(id: String) {
        #expect(!NativeHostInstaller.isValidExtensionID(id))
    }

    @Test("install throws before touching the filesystem when the ID is malformed")
    func installRejectsMalformedID() {
        #expect(throws: NativeHostInstallerError.invalidExtensionID) {
            try NativeHostInstaller.install(extensionID: "not-an-extension-id")
        }
    }
}
