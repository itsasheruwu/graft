import SwiftUI

struct BlissStudioNotice: ViewModifier {
    static let repository = URL(string: "https://github.com/itsasheruwu/bliss-studio")!
    @AppStorage("didAcknowledgeBlissStudioMove") private var acknowledged = false
    @Environment(\.openURL) private var openURL
    @FocusState private var dismissFocused: Bool
    @State private var downloadFailed = false

    func body(content: Content) -> some View {
        ZStack {
            content
                .disabled(!acknowledged)
                .accessibilityHidden(!acknowledged)
            if !acknowledged {
                Color.black.opacity(0.25).ignoresSafeArea()
                card
                    .accessibilityElement(children: .contain)
                    .onAppear { dismissFocused = true }
            }
        }
    }

    @ViewBuilder private var card: some View {
        let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)
        if #available(macOS 26, *) {
            message.background {
                shape.fill(.clear).glassEffect(.regular, in: shape)
            }
        } else {
            message.background(.regularMaterial, in: shape)
        }
    }

    private var message: some View {
        VStack(spacing: 10) {
            Text("Music Scene has moved")
                .font(.title2.weight(.semibold))
                .accessibilityAddTraits(.isHeader)
            Text("Music Scene is now Bliss Studio, a standalone Mac app. Download it to keep using your player, lyrics, and lighting.")
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if downloadFailed {
                Text("Couldn’t open GitHub. Try Download again.").font(.callout)
            }
            HStack(spacing: 10) {
                Button {
                    acknowledged = true
                } label: {
                    Text("Dismiss").frame(maxWidth: .infinity)
                }
                .focused($dismissFocused)
                .keyboardShortcut(.cancelAction)
                Button {
                    openURL(Self.repository) { opened in
                        if opened { acknowledged = true } else { downloadFailed = true }
                    }
                } label: {
                    Text("Download")
                        .frame(maxWidth: .infinity, minHeight: 28)
                        .foregroundStyle(.white)
                        .background(Color(nsColor: .controlAccentColor), in: Capsule())
                }
                .buttonStyle(.plain)
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
            .controlSize(.large)
            .padding(.top, 8)
        }
        .multilineTextAlignment(.center)
        .padding(26)
        .frame(width: 390)
    }
}
